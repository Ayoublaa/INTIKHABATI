// Vote.js v3.1 — Gasless voting via EIP-2771 meta-transactions
// Route: /elections/:id/vote

import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ethers } from 'ethers';
import { useElection } from '../hooks/useElections';
import TxProgress    from '../components/TxProgress';
import StatusBadge   from '../components/StatusBadge';
import CountdownTimer from '../components/CountdownTimer';
import axios from 'axios';
import { signAndRelay } from '../utils/signMetaTx';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

const card = {
  background:   'var(--bg2)',
  border:       '1px solid var(--border2)',
  borderRadius: 14,
  padding:      '1.5rem',
  marginBottom: '1.2rem',
};

export default function Vote() {
  const { id }   = useParams();
  const navigate = useNavigate();
  const { election, candidates, loading } = useElection(id);

  const [step,        setStep]        = useState(0);
  const [wallet,      setWallet]      = useState('');
  const [cin,         setCin]         = useState('');
  const [voterProfile, setVoterProfile] = useState(null);
  const [selected,    setSelected]    = useState(null);
  const [delegateTo,  setDelegateTo]  = useState('');
  const [mode,        setMode]        = useState('vote');
  const [txState,     setTxState]     = useState('idle');
  const [txHash,      setTxHash]      = useState('');
  const [error,       setError]       = useState('');
  const [sigLoading,  setSigLoading]  = useState(false);

  // ── v3: Commit-Reveal state ───────────────────────────────
  const [crSecret,    setCrSecret]    = useState('');  // bytes32 hex secret
  const [crCandidate, setCrCandidate] = useState(null);

  // ── Connect wallet on mount ───────────────────────────────
  useEffect(() => {
    (async () => {
      if (!window.ethereum) return;
      try {
        let accounts = await window.ethereum.request({ method: 'eth_accounts' });
        if (!accounts[0]) {
          accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        }
        if (accounts[0]) setWallet(accounts[0]);
        else navigate(`/elections/${id}`);
      } catch {
        navigate(`/elections/${id}`);
      }
    })();
  }, [id, navigate]);

  // ── Load commit-reveal state from localStorage ────────────
  useEffect(() => {
    if (!wallet || !id) return;
    const storedSecret = localStorage.getItem(`cr_secret_${id}_${wallet.toLowerCase()}`);
    const storedCand   = localStorage.getItem(`cr_candidate_${id}_${wallet.toLowerCase()}`);
    if (storedSecret) setCrSecret(storedSecret);
    if (storedCand !== null) setCrCandidate(Number(storedCand));
  }, [wallet, id]);

  if (loading) {
    return (
      <div style={{ padding: '90px 1rem', textAlign: 'center', color: 'var(--muted)' }}>
        Loading...
      </div>
    );
  }

  const nowWall        = Math.floor(Date.now() / 1000);
  const deadline       = Number(election?.deadline || 0);
  const statusLabel    = election?.statusLabel || '';
  const isCommitReveal = election?.isCommitReveal || false;
  const isOpen         = (statusLabel === 'Open' || statusLabel === 'Revealing')
                          && (deadline === 0 || nowWall < deadline);

  if (!isOpen) {
    return (
      <div style={{ padding: '90px 1.5rem', maxWidth: 600, margin: '0 auto', textAlign: 'center' }}>
        <div style={card}>
          <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>🔒</div>
          <h2 style={{ marginTop: 0 }}>This election is not open for voting</h2>
          <StatusBadge status={statusLabel || 'Unknown'} />
          <br /><br />
          <Link to={`/elections/${id}`} style={{ color: 'var(--cyan)' }}>← Back to election</Link>
        </div>
      </div>
    );
  }

  // ── Phase helpers ─────────────────────────────────────────
  const isRevealPhase  = statusLabel === 'Revealing';
  const hasLocalSecret = crSecret.length > 0;

  // ── STEP 0: Identity — with wallet signature ──────────────
  const handleIdentity = async () => {
    if (!cin.trim()) return setError('Please enter your CIN.');
    setError('');
    setSigLoading(true);
    try {
      // 1. Get signer FIRST — use signer.address as source of truth
      const provider   = new ethers.BrowserProvider(window.ethereum);
      const signer     = await provider.getSigner();
      const signerAddr = await signer.getAddress(); // exact address MetaMask will sign with

      // 2. Get nonce for the exact signer address
      const nonceRes = await axios.get(`${API}/voters/nonce/${signerAddr}`);
      const { nonce, message } = nonceRes.data;

      // 3. Sign with MetaMask (EIP-191 personal_sign)
      const signature = await signer.signMessage(message);

      // 4. Register — walletAddress = signerAddr (guaranteed match)
      const res = await axios.post(`${API}/voters/register`, {
        electionId:    Number(id),
        cin:           cin.trim(),
        walletAddress: signerAddr,
        signature,
        nonce,
      });

      if (res.data.success) {
        if (res.data.voterProfile) setVoterProfile(res.data.voterProfile);
        setStep(1);
      } else {
        setError(res.data.message);
      }
    } catch (err) {
      if (err.code === 'ACTION_REJECTED' || err.code === 4001) {
        setError('Signature cancelled. Please sign the MetaMask message to continue.');
      } else {
        const data = err.response?.data;
        if (data?.geoBlocked) {
          const loc = data.voterLocation;
          setError(
            `📍 ${data.message}\n` +
            (loc ? `Votre localisation : ${loc.district ? loc.district + ', ' : ''}${loc.city} (${loc.region || 'région inconnue'})` : '')
          );
        } else {
          const msg = data?.message || err.message;
          if (msg.includes('already registered') || msg.includes('already linked')) {
            setStep(1);
          } else {
            setError(msg);
          }
        }
      }
    } finally {
      setSigLoading(false);
    }
  };

  // ── STEP 1 (Commit phase) — gasless commitVote ───────────
  const handleCommit = async () => {
    if (selected === null) return setError('Please select a candidate.');
    setTxState('pending'); setError('');
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer   = await provider.getSigner();

      const candId = selected === -1 ? 0 : selected;

      // Auto-generate secret (bytes32)
      const secretBytes = ethers.hexlify(ethers.randomBytes(32));

      // commitment = keccak256(abi.encodePacked(candidateId, secret))
      const commitment = ethers.keccak256(
        ethers.solidityPacked(['uint256', 'bytes32'], [ethers.toBigInt(candId), secretBytes])
      );

      // ⚡ Gasless: sign EIP-712 + relay (no ETH needed!)
      const hash = await signAndRelay(signer, 'commitVote', [Number(id), commitment]);
      setTxHash(hash);

      // Store secret in localStorage for reveal phase
      localStorage.setItem(`cr_secret_${id}_${wallet.toLowerCase()}`, secretBytes);
      localStorage.setItem(`cr_candidate_${id}_${wallet.toLowerCase()}`, String(candId));
      setCrSecret(secretBytes);
      setCrCandidate(candId);

      setTxState('success');
      setStep(2);
    } catch (err) {
      setTxState('error');
      if (err.code === 'ACTION_REJECTED' || err.code === 4001) setError('Signature cancelled.');
      else setError(err.message || 'Relay error');
    }
  };

  // ── STEP 1 (Reveal phase) — gasless revealVote ──────────
  const handleReveal = async () => {
    if (election?.statusLabel !== 'Revealing') {
      return setError("La phase de révélation n'est pas encore ouverte");
    }
    if (!hasLocalSecret) {
      return setError('No commitment found. Use the same browser where you committed.');
    }
    setTxState('pending'); setError('');
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer   = await provider.getSigner();

      // ⚡ Gasless: sign EIP-712 + relay
      const hash = await signAndRelay(signer, 'revealVote', [
        Number(id),
        ethers.toBigInt(crCandidate),
        crSecret,
      ]);
      setTxHash(hash);

      // Clean up localStorage
      localStorage.removeItem(`cr_secret_${id}_${wallet.toLowerCase()}`);
      localStorage.removeItem(`cr_candidate_${id}_${wallet.toLowerCase()}`);

      setTxState('success');
      setStep(2);
    } catch (err) {
      setTxState('error');
      if (err.code === 'ACTION_REJECTED' || err.code === 4001) setError('Signature cancelled.');
      else if (err.message?.includes('mismatch')) setError('Commitment mismatch — wrong secret or candidate.');
      else setError(err.message || 'Relay error');
    }
  };

  // ── STEP 1 (Direct vote / delegate) — gasless ────────────
  const handleVote = async () => {
    if (mode === 'vote' && selected === null) return setError('Please select a candidate.');
    if (mode === 'delegate' && !delegateTo.match(/^0x[a-fA-F0-9]{40}$/)) {
      return setError('Enter a valid wallet address to delegate to.');
    }
    setTxState('pending'); setError('');
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer   = await provider.getSigner();

      let hash;
      if (mode === 'delegate') {
        // Check that the target wallet is registered in this election
        const statusRes = await axios.get(`${API}/voters/status?electionId=${id}&wallet=${delegateTo}`);
        if (!statusRes.data.isRegistered) {
          setTxState('idle');
          return setError("Ce wallet n'est pas inscrit dans cette élection");
        }
        // ⚡ Gasless delegation
        hash = await signAndRelay(signer, 'delegate', [Number(id), delegateTo]);
      } else {
        const candId = selected === -1 ? 0 : selected;
        // ⚡ Gasless vote
        hash = await signAndRelay(signer, 'vote', [Number(id), candId]);
      }
      setTxHash(hash);
      setTxState('success');
      setStep(2);
    } catch (err) {
      setTxState('error');
      if (err.code === 'ACTION_REJECTED' || err.code === 4001) setError('Signature cancelled.');
      else if (err.message?.includes('already voted'))         setError('You have already voted.');
      else if (err.message?.includes('not open'))              setError('This election has just closed.');
      else                                                      setError(err.message || 'Relay error');
    }
  };

  // ── Labels per phase ─────────────────────────────────────
  const STEPS = isCommitReveal
    ? (isRevealPhase ? ['Identity', 'Reveal Vote', 'Confirmed'] : ['Identity', 'Commit Vote', 'Committed'])
    : ['Identity', 'Choose Candidate', 'Confirmed'];

  return (
    <div style={{ padding: '90px 1.5rem 3rem', maxWidth: 600, margin: '0 auto' }}>

      <Link to={`/elections/${id}`}
        style={{ color: 'var(--cyan)', fontSize: '0.85rem', textDecoration: 'none' }}>
        ← Back to election
      </Link>

      {/* Election banner */}
      <div style={{ ...card, marginTop: '1rem' }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem',
        }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>{election?.name}</div>
            <div style={{ color: 'var(--muted)', fontSize: '0.82rem', marginTop: '0.2rem' }}>
              {election?.categoryLabel}
              {isCommitReveal && (
                <span style={{
                  marginLeft: '0.6rem', color: '#a855f7',
                  fontSize: '0.75rem', fontWeight: 600,
                }}>🔒 Commit-Reveal</span>
              )}
              {/* Geo restriction badge */}
              {election?.geo?.allowedCities?.length > 0 && (
                <span style={{
                  marginLeft: '0.6rem', color: '#0ea5e9',
                  fontSize: '0.75rem', fontWeight: 600,
                }}>
                  📍 {election.geo.allowedCities.join(', ')}
                </span>
              )}
              {!election?.geo?.allowedCities?.length && election?.geo?.allowedRegions?.length > 0 && (
                <span style={{
                  marginLeft: '0.6rem', color: '#0ea5e9',
                  fontSize: '0.75rem', fontWeight: 600,
                }}>
                  📍 {election.geo.allowedRegions.join(', ')}
                </span>
              )}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <StatusBadge status={statusLabel} />
            {deadline > 0 && (
              <div style={{ fontSize: '0.75rem', color: 'var(--cyan)', marginTop: '0.3rem' }}>
                <CountdownTimer deadline={deadline} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Step indicator */}
      <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1.5rem' }}>
        {STEPS.map((s, i) => (
          <div key={s} style={{
            flex: 1, textAlign: 'center', fontSize: '0.75rem',
            color: i <= step ? 'var(--cyan)' : 'var(--muted)',
            borderBottom: `2px solid ${i <= step ? 'var(--cyan)' : 'var(--border2)'}`,
            paddingBottom: '0.4rem',
          }}>
            {s}
          </div>
        ))}
      </div>

      {/* ── STEP 0: Identity + Wallet Signature ─────────────── */}
      {step === 0 && (
        <div style={card}>
          <h3 style={{ marginTop: 0 }}>🪪 Verify Your Identity</h3>
          {voterProfile && (
            <div style={{
              background: 'rgba(0,255,136,0.08)', border: '1px solid rgba(0,255,136,0.2)',
              borderRadius: 8, padding: '0.6rem 1rem', marginBottom: '1rem',
              fontSize: '0.82rem', color: '#00ff88',
            }}>
              ✅ {voterProfile.fullName} — {voterProfile.city}
            </div>
          )}
          <p style={{ color: 'var(--muted)', fontSize: '0.85rem', marginBottom: '1.2rem' }}>
            Enter your national ID (CIN). Your wallet will sign a message to prove ownership.
          </p>
          <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginBottom: '0.5rem' }}>
            Wallet: {wallet.slice(0, 10)}...{wallet.slice(-6)}
          </div>
          <input
            type="text"
            placeholder="Your CIN number"
            value={cin}
            onChange={e => setCin(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !sigLoading && handleIdentity()}
            style={{
              width: '100%', padding: '0.75rem', borderRadius: 10,
              boxSizing: 'border-box',
              background: 'var(--bg)', border: '1px solid var(--border2)',
              color: 'var(--text)', fontSize: '1rem', marginBottom: '1rem',
            }}
          />
          {error && (
            <p style={{ color: '#ff6b6b', fontSize: '0.85rem', margin: '0 0 0.8rem' }}>{error}</p>
          )}
          {/* Signature info banner */}
          <div style={{
            background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.2)',
            borderRadius: 8, padding: '0.6rem 1rem', marginBottom: '1rem',
            fontSize: '0.78rem', color: '#a855f7',
          }}>
            🔐 MetaMask will ask you to sign a message to verify wallet ownership.
            No gas fee — signature only.
          </div>
          <button onClick={handleIdentity} disabled={sigLoading} style={{
            width: '100%', padding: '0.85rem', borderRadius: 10,
            background: sigLoading ? '#334' : 'var(--cyan)',
            color: sigLoading ? 'var(--muted)' : '#000',
            border: 'none', fontWeight: 700, fontSize: '1rem',
            cursor: sigLoading ? 'not-allowed' : 'pointer',
          }}>
            {sigLoading ? '⏳ Sign in MetaMask...' : 'Verify & Continue →'}
          </button>
        </div>
      )}

      {/* ── STEP 1: Choose / Commit / Reveal ────────────────── */}
      {step === 1 && (
        <div>

          {/* ── COMMIT-REVEAL: Reveal phase ───────────────── */}
          {isCommitReveal && isRevealPhase && (
            <div style={card}>
              <h3 style={{ marginTop: 0, color: '#a855f7' }}>🕵️ Reveal Your Vote</h3>
              {hasLocalSecret ? (
                <>
                  <p style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>
                    Your committed vote was found. Click below to reveal it on-chain.
                  </p>
                  <div style={{
                    background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.2)',
                    borderRadius: 8, padding: '0.8rem', marginBottom: '1rem', fontSize: '0.78rem',
                  }}>
                    <div style={{ color: 'var(--muted)', marginBottom: '0.3rem' }}>Committed candidate ID:</div>
                    <div style={{ fontWeight: 700, color: '#a855f7' }}>
                      {crCandidate === 0
                        ? '∅ Vote Blanc'
                        : candidates.find(c => c.id === crCandidate)?.name || `Candidate #${crCandidate}`}
                    </div>
                  </div>
                </>
              ) : (
                <div style={{
                  background: 'rgba(255,107,107,0.08)', border: '1px solid rgba(255,107,107,0.2)',
                  borderRadius: 8, padding: '0.8rem', fontSize: '0.82rem', color: '#ff6b6b',
                }}>
                  ⚠ No commitment found in this browser. You must use the same device where you committed.
                </div>
              )}
              {error && (
                <p style={{ color: '#ff6b6b', fontSize: '0.85rem', margin: '0.5rem 0' }}>{error}</p>
              )}
              <button
                onClick={handleReveal}
                disabled={!hasLocalSecret || txState === 'pending'}
                style={{
                  width: '100%', padding: '0.9rem', borderRadius: 10, marginTop: '0.5rem',
                  background: !hasLocalSecret || txState === 'pending'
                    ? '#334' : 'linear-gradient(135deg, #a855f7, #7c3aed)',
                  color: '#fff', border: 'none', fontWeight: 700, fontSize: '1rem',
                  cursor: !hasLocalSecret || txState === 'pending' ? 'not-allowed' : 'pointer',
                }}>
                {txState === 'pending' ? '⏳ Signing (gasless)...' : '🕵️ Reveal Vote (Gasless) →'}
              </button>
            </div>
          )}

          {/* ── COMMIT-REVEAL: Commit phase ───────────────── */}
          {isCommitReveal && !isRevealPhase && (
            <div>
              <div style={{
                ...card,
                background: 'rgba(168,85,247,0.06)',
                border: '1px solid rgba(168,85,247,0.2)',
                marginBottom: '1rem', padding: '1rem',
              }}>
                <div style={{ fontWeight: 700, color: '#a855f7', marginBottom: '0.4rem' }}>
                  🔒 Commit-Reveal Mode
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--muted)', lineHeight: 1.7 }}>
                  Select a candidate below. Your choice will be <strong>encrypted</strong> on-chain
                  — nobody can see it until the admin starts the reveal phase.
                  A secret key will be auto-generated and saved in your browser.
                </div>
              </div>

              <h3 style={{ marginTop: 0, marginBottom: '1rem' }}>Select a Candidate to Commit</h3>

              {election?.blankVoteEnabled && (
                <div onClick={() => setSelected(-1)} style={{
                  ...card,
                  border: `2px solid ${selected === -1 ? 'var(--muted)' : 'var(--border2)'}`,
                  cursor: 'pointer', padding: '1rem',
                }}>
                  <span style={{ fontWeight: 600, color: 'var(--muted)' }}>∅ Blank Vote</span>
                </div>
              )}

              {candidates.map(c => (
                <div key={c.id} onClick={() => setSelected(c.id)} style={{
                  ...card,
                  border: `2px solid ${selected === c.id ? '#a855f7' : 'var(--border2)'}`,
                  background: selected === c.id ? 'rgba(168,85,247,0.08)' : 'var(--bg2)',
                  cursor: 'pointer', padding: '1rem',
                }}>
                  <div style={{ fontWeight: 600 }}>{c.name}</div>
                  {c.party && (
                    <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: '0.2rem' }}>{c.party}</div>
                  )}
                </div>
              ))}

              {error && (
                <p style={{ color: '#ff6b6b', fontSize: '0.85rem', margin: '0.5rem 0' }}>{error}</p>
              )}

              <button
                onClick={handleCommit}
                disabled={selected === null || txState === 'pending'}
                style={{
                  width: '100%', padding: '0.9rem', borderRadius: 10, marginTop: '0.5rem',
                  background: selected === null || txState === 'pending'
                    ? '#334' : 'linear-gradient(135deg, #a855f7, #7c3aed)',
                  color: '#fff', border: 'none', fontWeight: 700, fontSize: '1rem',
                  cursor: selected === null || txState === 'pending' ? 'not-allowed' : 'pointer',
                }}>
                {txState === 'pending' ? '⏳ Signing (gasless)...' : '🔒 Commit Vote (Gasless) →'}
              </button>
            </div>
          )}

          {/* ── DIRECT VOTE (non-commit-reveal) ─────────── */}
          {!isCommitReveal && (
            <div>
              {/* Mode toggle */}
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                {[
                  { key: 'vote',     label: '🗳 Vote Directly' },
                  { key: 'delegate', label: '🤝 Delegate Vote' },
                ].map(m => (
                  <button key={m.key}
                    onClick={() => { setMode(m.key); setSelected(null); setError(''); }}
                    style={{
                      flex: 1, padding: '0.6rem',
                      background: mode === m.key ? '#0066cc22' : 'var(--bg2)',
                      color:      mode === m.key ? 'var(--cyan)' : 'var(--muted)',
                      border:     `1px solid ${mode === m.key ? 'var(--cyan)' : 'var(--border2)'}`,
                      borderRadius: 10, cursor: 'pointer',
                      fontWeight: mode === m.key ? 700 : 400,
                    }}>
                    {m.label}
                  </button>
                ))}
              </div>

              {mode === 'vote' && (
                <div>
                  <h3 style={{ marginTop: 0, marginBottom: '1rem' }}>Select a Candidate</h3>

                  {election?.blankVoteEnabled && (
                    <div onClick={() => setSelected(-1)} style={{
                      ...card,
                      border: `2px solid ${selected === -1 ? 'var(--muted)' : 'var(--border2)'}`,
                      cursor: 'pointer', padding: '1rem',
                    }}>
                      <span style={{ fontWeight: 600, color: 'var(--muted)' }}>∅ Blank Vote</span>
                    </div>
                  )}

                  {candidates.map(c => (
                    <div key={c.id} onClick={() => setSelected(c.id)} style={{
                      ...card,
                      border: `2px solid ${selected === c.id ? 'var(--cyan)' : 'var(--border2)'}`,
                      background: selected === c.id ? '#001a3a' : 'var(--bg2)',
                      cursor: 'pointer', padding: '1rem',
                    }}>
                      <div style={{ fontWeight: 600 }}>{c.name}</div>
                      {c.party && (
                        <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: '0.2rem' }}>{c.party}</div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {mode === 'delegate' && (
                <div style={card}>
                  <h3 style={{ marginTop: 0 }}>🤝 Delegate Your Vote</h3>
                  <p style={{ color: 'var(--muted)', fontSize: '0.85rem', marginBottom: '1rem' }}>
                    Enter the wallet address of another registered voter.
                  </p>
                  <input
                    type="text"
                    placeholder="0x... (delegate wallet)"
                    value={delegateTo}
                    onChange={e => setDelegateTo(e.target.value)}
                    style={{
                      width: '100%', padding: '0.75rem', borderRadius: 10,
                      boxSizing: 'border-box',
                      background: 'var(--bg)', border: '1px solid var(--border2)',
                      color: 'var(--text)', fontSize: '0.9rem',
                    }}
                  />
                </div>
              )}

              {error && (
                <p style={{ color: '#ff6b6b', fontSize: '0.85rem', margin: '0.5rem 0' }}>{error}</p>
              )}

              <button
                onClick={handleVote}
                disabled={txState === 'pending' || (mode === 'vote' && selected === null)}
                style={{
                  width: '100%', padding: '0.9rem', borderRadius: 10, marginTop: '0.5rem',
                  background: (mode === 'vote' && selected === null) || txState === 'pending'
                    ? '#334' : 'linear-gradient(135deg, #0066cc, #00d4ff)',
                  color: '#fff', border: 'none', fontWeight: 700, fontSize: '1rem',
                  cursor: (mode === 'vote' && selected === null) || txState === 'pending'
                    ? 'not-allowed' : 'pointer',
                }}>
                {txState === 'pending'
                  ? '⏳ Signing (gasless)...'
                  : mode === 'delegate'
                  ? '🤝 Delegate (Gasless) →'
                  : '🗳 Vote (Gasless — No ETH needed) →'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── STEP 2: Confirmed ────────────────────────────────── */}
      {step === 2 && (
        <div style={{ ...card, textAlign: 'center', padding: '2.5rem 1.5rem' }}>
          <div style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>
            {isCommitReveal && !isRevealPhase ? '🔒' : isCommitReveal ? '✅' : mode === 'delegate' ? '🤝' : '✅'}
          </div>
          <h2 style={{ color: isCommitReveal && !isRevealPhase ? '#a855f7' : '#00ff88', marginTop: 0 }}>
            {isCommitReveal && !isRevealPhase
              ? 'Vote Committed!'
              : isCommitReveal
              ? 'Vote Revealed!'
              : mode === 'delegate'
              ? 'Delegation Confirmed!'
              : 'Vote Recorded!'}
          </h2>

          {/* Commit-reveal waiting message */}
          {isCommitReveal && !isRevealPhase && (
            <div style={{
              background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.2)',
              borderRadius: 10, padding: '1rem', margin: '1rem 0', fontSize: '0.82rem',
              color: 'var(--muted)', lineHeight: 1.8,
            }}>
              <div style={{ color: '#a855f7', fontWeight: 700, marginBottom: '0.4rem' }}>
                🔒 Your vote is encrypted on-chain
              </div>
              Wait for the admin to start the <strong>Reveal Phase</strong>.
              Then return to this page to reveal your vote.<br /><br />
              <span style={{ color: '#ffb400', fontSize: '0.75rem' }}>
                ⚠ Do not clear your browser data — your secret is stored locally.
              </span>
            </div>
          )}

          <div style={{
            background: 'var(--bg)', borderRadius: 8, padding: '0.8rem',
            margin: '1rem 0', wordBreak: 'break-all',
            fontSize: '0.72rem', color: 'var(--muted)',
          }}>
            TX: {txHash}
          </div>
          <div style={{ display: 'flex', gap: '0.8rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button onClick={() => navigate(`/elections/${id}/results`)} style={{
              padding: '0.7rem 1.5rem', borderRadius: 10,
              background: 'var(--cyan)', color: '#000',
              border: 'none', fontWeight: 700, cursor: 'pointer',
            }}>
              📊 View Results
            </button>
            <button onClick={() => navigate('/elections')} style={{
              padding: '0.7rem 1.5rem', borderRadius: 10,
              background: 'var(--bg2)', color: 'var(--cyan)',
              border: '1px solid var(--cyan)', fontWeight: 600, cursor: 'pointer',
            }}>
              ← All Elections
            </button>
          </div>
        </div>
      )}

      {/* TX overlay */}
      {txState === 'pending' && <TxProgress />}
    </div>
  );
}
