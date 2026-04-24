// Verify.js v3 — handles ?tx= and ?election= URL params
import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { useSearchParams } from 'react-router-dom';
import { CONTRACT_ADDRESS, CONTRACT_ABI, RPC_URL } from '../config/contract';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

export default function Verify() {
  const [searchParams]        = useSearchParams();
  const [txInput, setTxInput] = useState('');
  const [result,  setResult]  = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  // Auto-verify if ?tx= param in URL
  useEffect(() => {
    const tx  = searchParams.get('tx');
    const eid = searchParams.get('election');

    if (tx) {
      setTxInput(tx);
      handleVerify(tx);
    } else if (eid) {
      // Election-level verification — show election info
      loadElectionInfo(Number(eid));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadElectionInfo(electionId) {
    setLoading(true); setError(''); setResult(null);
    try {
      const [elRes, resRes] = await Promise.all([
        fetch(`${API}/elections/${electionId}`),
        fetch(`${API}/elections/${electionId}/results`),
      ]);
      const elData  = await elRes.json();
      const resData = await resRes.json();

      if (!elData.success) throw new Error('Election not found');

      setResult({
        type:       'election',
        election:   elData.election,
        results:    resData.restricted ? null : resData,
        restricted: resData.restricted,
      });
    } catch (e) {
      setError('Could not load election: ' + e.message);
    }
    setLoading(false);
  }

  async function handleVerify(txHash) {
    const tx = (txHash || txInput).trim();
    if (!tx || !/^0x[a-fA-F0-9]{64}$/.test(tx)) {
      setError('TX Hash invalide. Format : 0x suivi de 64 caractères hexadécimaux.');
      return;
    }
    setError(''); setResult(null); setLoading(true);

    try {
      const provider = new ethers.JsonRpcProvider(RPC_URL);
      const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);

      const [transaction, receipt] = await Promise.all([
        provider.getTransaction(tx),
        provider.getTransactionReceipt(tx),
      ]);

      if (!transaction) { setError('Transaction introuvable.'); setLoading(false); return; }
      if (!receipt)     { setError('Reçu introuvable.'); setLoading(false); return; }

      const block = await provider.getBlock(receipt.blockNumber);

      let eventType = null;
      let eventData = {};
      let electionIdFound = null;

      const regIface   = new ethers.Interface([
        "event VoterRegistered(uint256 indexed electionId, address indexed voter, bytes32 indexed idHash)"
      ]);
      const voteIface  = new ethers.Interface([
        "event VoteCast(uint256 indexed electionId, address indexed voter, uint256 indexed candidateId, uint256 timestamp)"
      ]);
      const delegIface = new ethers.Interface([
        "event VoteDelegated(uint256 indexed electionId, address indexed from, address indexed to)"
      ]);
      const commitIface = new ethers.Interface([
        "event VoteCommitted(uint256 indexed electionId, address indexed voter)"
      ]);
      const revealIface = new ethers.Interface([
        "event VoteRevealed(uint256 indexed electionId, address indexed voter, uint256 indexed candidateId)"
      ]);

      for (const log of receipt.logs) {
        // VoteCast
        try {
          const p = voteIface.parseLog(log);
          if (p) {
            eventType = 'vote'; electionIdFound = Number(p.args.electionId);
            const cid = Number(p.args.candidateId);
            let candidateName = cid === 0 ? '∅ Vote Blanc' : `Candidat #${cid}`;
            try {
              const r = await fetch(`${API}/elections/${electionIdFound}/candidates`);
              const d = await r.json();
              const found = (d.candidates || []).find(c => Number(c.id) === cid);
              if (found) candidateName = found.name;
            } catch {}
            eventData = { voter: p.args.voter, candidateId: cid, candidateName, timestamp: Number(p.args.timestamp) };
          }
        } catch {}

        // VoteRevealed (commit-reveal)
        if (!eventType) try {
          const p = revealIface.parseLog(log);
          if (p) {
            eventType = 'reveal'; electionIdFound = Number(p.args.electionId);
            const cid = Number(p.args.candidateId);
            let candidateName = cid === 0 ? '∅ Vote Blanc' : `Candidat #${cid}`;
            try {
              const r = await fetch(`${API}/elections/${electionIdFound}/candidates`);
              const d = await r.json();
              const found = (d.candidates || []).find(c => Number(c.id) === cid);
              if (found) candidateName = found.name;
            } catch {}
            eventData = { voter: p.args.voter, candidateId: cid, candidateName };
          }
        } catch {}

        // VoteCommitted
        if (!eventType) try {
          const p = commitIface.parseLog(log);
          if (p) {
            eventType = 'commit'; electionIdFound = Number(p.args.electionId);
            eventData = { voter: p.args.voter };
          }
        } catch {}

        // VoterRegistered
        if (!eventType) try {
          const p = regIface.parseLog(log);
          if (p) {
            eventType = 'register'; electionIdFound = Number(p.args.electionId);
            eventData = { voter: p.args.voter, idHash: p.args.idHash };
          }
        } catch {}

        // VoteDelegated
        if (!eventType) try {
          const p = delegIface.parseLog(log);
          if (p) {
            eventType = 'delegate'; electionIdFound = Number(p.args.electionId);
            eventData = { from: p.args.from, to: p.args.to };
          }
        } catch {}
      }

      // On-chain voter status
      let voterStatus = null;
      const addr = eventData.voter || eventData.from;
      if (electionIdFound && addr) {
        try {
          const s = await contract.getVoterStatus(electionIdFound, addr);
          voterStatus = { isRegistered: s.isRegistered, hasVoted: s.hasVoted, timestamp: Number(s.voteTimestamp) };
        } catch {}
      }

      // Election name from API
      let electionName = null;
      if (electionIdFound) {
        try {
          const r = await fetch(`${API}/elections/${electionIdFound}`);
          const d = await r.json();
          if (d.success) electionName = d.election.name;
        } catch {}
      }

      setResult({
        type:        'tx',
        txHash:      tx,
        blockNumber: receipt.blockNumber,
        blockHash:   block?.hash,
        timestamp:   block ? Number(block.timestamp) : 0,
        from:        transaction.from,
        gasUsed:     receipt.gasUsed.toString(),
        status:      receipt.status === 1 ? 'success' : 'failed',
        electionId:  electionIdFound,
        electionName,
        eventType,
        eventData,
        voterStatus,
      });

    } catch (e) {
      setError('Erreur : ' + e.message);
    }
    setLoading(false);
  }

  function fmt(ts) {
    if (!ts) return '—';
    return new Date(ts * 1000).toLocaleString('fr-FR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
  }
  function short(h, n = 12) {
    if (!h) return '—';
    return `${h.slice(0, n)}...${h.slice(-8)}`;
  }

  const EVENT_CONFIG = {
    vote:     { label: '🗳 VOTE ON-CHAIN',      color: 'var(--green)',   bg: 'rgba(0,255,136,0.07)',  border: 'rgba(0,255,136,0.25)' },
    reveal:   { label: '🕵️ VOTE RÉVÉLÉ',        color: '#a855f7',        bg: 'rgba(168,85,247,0.07)', border: 'rgba(168,85,247,0.25)' },
    commit:   { label: '🔒 VOTE COMMITÉ',        color: '#a855f7',        bg: 'rgba(168,85,247,0.07)', border: 'rgba(168,85,247,0.2)' },
    register: { label: '👤 INSCRIPTION',         color: '#a855f7',        bg: 'rgba(168,85,247,0.07)', border: 'rgba(168,85,247,0.25)' },
    delegate: { label: '🤝 DÉLÉGATION ON-CHAIN', color: 'var(--yellow)',  bg: 'rgba(255,170,0,0.07)', border: 'rgba(255,170,0,0.25)' },
  };

  return (
    <div style={{ paddingTop: '64px', minHeight: '100vh', padding: '90px 1rem 3rem' }}>
      <div style={{ maxWidth: '700px', margin: '0 auto' }}>

        {/* Header */}
        <div style={{ marginBottom: '2.5rem' }}>
          <div style={{ fontSize: '0.65rem', color: 'var(--muted2)', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
            Preuve cryptographique
          </div>
          <h1 style={{ fontFamily: 'Syne', fontWeight: 800, fontSize: '1.8rem', margin: '0 0 0.5rem' }}>
            Vérifier un <span style={{ color: 'var(--accent)' }}>Vote</span>
          </h1>
          <p style={{ color: 'var(--muted)', fontSize: '0.82rem', margin: 0, lineHeight: 1.7 }}>
            Entrez un TX Hash — ou scannez le QR du certificat — pour vérifier un vote sur la blockchain.
          </p>
        </div>

        {/* Input */}
        <div style={{
          background: 'var(--bg2)', border: '1px solid var(--border2)',
          borderRadius: '8px', padding: '1.5rem', marginBottom: '1.5rem',
        }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--muted)', letterSpacing: '0.1em', marginBottom: '0.75rem', textTransform: 'uppercase' }}>
            Transaction Hash
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <input
              value={txInput}
              onChange={e => setTxInput(e.target.value.trim())}
              onKeyDown={e => e.key === 'Enter' && handleVerify()}
              placeholder="0x3dea6a8d71d327c38dc50c6129197389..."
              style={{
                flex: 1, background: 'var(--bg3)',
                border: '1px solid var(--border2)',
                borderRadius: '4px', padding: '12px 14px',
                color: 'var(--text)', fontFamily: 'monospace',
                fontSize: '0.78rem', outline: 'none',
              }}
              onFocus={e => e.target.style.borderColor = 'var(--accent)'}
              onBlur={e => e.target.style.borderColor = 'var(--border2)'}
            />
            <button onClick={() => handleVerify()} disabled={loading} style={{
              background: loading ? 'var(--border2)' : 'linear-gradient(135deg, var(--accent), #0055cc)',
              color: loading ? 'var(--muted)' : '#fff',
              border: '1px solid var(--border)', borderRadius: '4px',
              padding: '12px 20px', fontWeight: 700, fontSize: '0.82rem',
              cursor: loading ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap',
            }}>
              {loading ? '⏳ ...' : '🔍 Vérifier'}
            </button>
          </div>
          {error && (
            <div style={{
              marginTop: '0.75rem', padding: '10px 14px',
              background: 'rgba(255,59,92,0.07)', border: '1px solid rgba(255,59,92,0.2)',
              borderRadius: '4px', fontSize: '0.78rem', color: '#ff6b6b',
            }}>⚠ {error}</div>
          )}
        </div>

        {/* ── Election result (from QR scan ?election=) ──────── */}
        {result?.type === 'election' && (
          <div>
            <div style={{
              padding: '1.25rem 1.5rem', borderRadius: '8px', marginBottom: '1rem',
              background: 'rgba(0,212,255,0.07)', border: '1px solid rgba(0,212,255,0.2)',
            }}>
              <div style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--cyan)' }}>
                🗳 {result.election.name}
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: '0.3rem' }}>
                {result.election.categoryLabel} · Élection #{result.election.id} · {result.election.statusLabel}
              </div>
            </div>

            {result.restricted ? (
              <div style={{
                padding: '1rem', borderRadius: 8,
                background: 'rgba(255,180,0,0.07)', border: '1px solid rgba(255,180,0,0.2)',
                color: '#ffb400', fontSize: '0.82rem',
              }}>
                🔒 Résultats disponibles après clôture de l'élection.
              </div>
            ) : result.results && (
              <div style={{
                background: 'var(--bg2)', border: '1px solid var(--border2)',
                borderRadius: 8, padding: '1.25rem',
              }}>
                <div style={{ fontWeight: 700, marginBottom: '0.75rem' }}>📊 Résultats</div>
                {result.results.candidates?.map((c, i) => (
                  <div key={c.id} style={{ marginBottom: '0.75rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                      <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>{i + 1}. {c.name}</span>
                      <span style={{ fontSize: '0.82rem', color: 'var(--cyan)', fontWeight: 700 }}>
                        {c.percentage}% ({c.voteCount} votes)
                      </span>
                    </div>
                    <div style={{ height: 6, background: 'var(--border2)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${c.percentage}%`, background: 'var(--cyan)', borderRadius: 3 }} />
                    </div>
                  </div>
                ))}
                <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '0.5rem' }}>
                  Total: {result.results.totalVotes} votes · Participation: {result.results.turnout}%
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── TX result ─────────────────────────────────────────── */}
        {result?.type === 'tx' && (
          <div>
            {/* Status banner */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: '1rem',
              padding: '1.25rem 1.5rem', borderRadius: '8px', marginBottom: '1rem',
              background: result.status === 'success' ? 'rgba(0,255,136,0.07)' : 'rgba(255,59,92,0.07)',
              border: `1px solid ${result.status === 'success' ? 'rgba(0,255,136,0.25)' : 'rgba(255,59,92,0.25)'}`,
            }}>
              <div style={{ fontSize: '2rem' }}>{result.status === 'success' ? '✅' : '❌'}</div>
              <div>
                <div style={{
                  fontWeight: 800, fontSize: '1.1rem',
                  color: result.status === 'success' ? 'var(--green)' : '#ff6b6b',
                }}>
                  {result.status === 'success' ? 'Transaction valide et confirmée' : 'Transaction échouée'}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--muted2)', marginTop: '2px' }}>
                  {result.electionName ? `Élection: ${result.electionName}` : ''}
                  {result.electionId ? ` #${result.electionId}` : ''}
                </div>
              </div>
            </div>

            {/* Event badge */}
            {result.eventType && EVENT_CONFIG[result.eventType] && (
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: '8px',
                padding: '6px 16px', borderRadius: '100px', marginBottom: '1rem',
                background: EVENT_CONFIG[result.eventType].bg,
                border: `1px solid ${EVENT_CONFIG[result.eventType].border}`,
                fontSize: '0.72rem', fontWeight: 700,
                color: EVENT_CONFIG[result.eventType].color,
              }}>
                {EVENT_CONFIG[result.eventType].label}
              </div>
            )}

            {/* Vote / Reveal details */}
            {(result.eventType === 'vote' || result.eventType === 'reveal') && (
              <div style={{
                background: 'rgba(0,255,136,0.05)', border: '1px solid rgba(0,255,136,0.15)',
                borderRadius: '8px', padding: '1.25rem', marginBottom: '1rem',
              }}>
                <div style={{ fontWeight: 700, marginBottom: '0.75rem', color: 'var(--green)', fontSize: '0.85rem' }}>
                  {result.eventType === 'reveal' ? '🕵️ Vote révélé' : '🗳 Vote enregistré'}
                </div>
                {result.electionId && <Row label="Élection #" val={String(result.electionId)} />}
                <Row label="Candidat" val={result.eventData.candidateName} highlight />
                <Row label="Wallet" val={short(result.eventData.voter, 14)} mono />
                {result.eventData.timestamp > 0 && (
                  <Row label="Horodatage" val={fmt(result.eventData.timestamp)} last />
                )}
              </div>
            )}

            {/* Commit details */}
            {result.eventType === 'commit' && (
              <div style={{
                background: 'rgba(168,85,247,0.05)', border: '1px solid rgba(168,85,247,0.15)',
                borderRadius: '8px', padding: '1.25rem', marginBottom: '1rem',
              }}>
                <div style={{ fontWeight: 700, marginBottom: '0.75rem', color: '#a855f7', fontSize: '0.85rem' }}>
                  🔒 Engagement (vote chiffré)
                </div>
                {result.electionId && <Row label="Élection #" val={String(result.electionId)} />}
                <Row label="Wallet" val={short(result.eventData.voter, 14)} mono />
                <Row label="Statut" val="Vote commité — révélation en attente" last />
              </div>
            )}

            {/* Delegate details */}
            {result.eventType === 'delegate' && (
              <div style={{
                background: 'rgba(255,170,0,0.05)', border: '1px solid rgba(255,170,0,0.15)',
                borderRadius: '8px', padding: '1.25rem', marginBottom: '1rem',
              }}>
                <div style={{ fontWeight: 700, marginBottom: '0.75rem', color: 'var(--yellow)', fontSize: '0.85rem' }}>
                  🤝 Délégation
                </div>
                <Row label="Délégant" val={short(result.eventData.from, 14)} mono />
                <Row label="Délégué" val={short(result.eventData.to, 14)} mono last />
              </div>
            )}

            {/* Register details */}
            {result.eventType === 'register' && (
              <div style={{
                background: 'rgba(168,85,247,0.05)', border: '1px solid rgba(168,85,247,0.15)',
                borderRadius: '8px', padding: '1.25rem', marginBottom: '1rem',
              }}>
                <div style={{ fontWeight: 700, marginBottom: '0.75rem', color: '#a855f7', fontSize: '0.85rem' }}>
                  👤 Inscription
                </div>
                <Row label="Wallet" val={short(result.eventData.voter, 14)} mono />
                <Row label="CIN hashé" val={short(result.eventData.idHash, 14)} mono last />
              </div>
            )}

            {/* Voter on-chain status */}
            {result.voterStatus && (
              <div style={{
                background: 'var(--bg2)', border: '1px solid var(--border2)',
                borderRadius: '8px', padding: '1.25rem', marginBottom: '1rem',
              }}>
                <div style={{ fontWeight: 700, marginBottom: '0.75rem', color: 'var(--accent)', fontSize: '0.85rem' }}>
                  ⛓ Statut on-chain
                </div>
                <Row label="Inscrit"  val={result.voterStatus.isRegistered ? '✅ Oui' : '❌ Non'} />
                <Row label="A voté"   val={result.voterStatus.hasVoted ? '✅ Oui' : '⏳ Non'} />
                {result.voterStatus.timestamp > 0 && (
                  <Row label="Voté le" val={fmt(result.voterStatus.timestamp)} last />
                )}
              </div>
            )}

            {/* Block details */}
            <div style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: '8px', padding: '1.25rem' }}>
              <div style={{ fontWeight: 700, marginBottom: '0.75rem', fontSize: '0.85rem' }}>🧱 Détails du bloc</div>
              <Row label="TX Hash"      val={short(result.txHash, 16)} mono />
              <Row label="Bloc #"       val={`#${result.blockNumber}`} />
              <Row label="Hash du bloc" val={short(result.blockHash, 16)} mono />
              <Row label="Horodatage"   val={fmt(result.timestamp)} />
              <Row label="Gas utilisé"  val={Number(result.gasUsed).toLocaleString() + ' gas'} />
              <Row label="Statut"       val={result.status === 'success' ? '✅ Succès' : '❌ Échec'} last />
            </div>

            <div style={{
              marginTop: '1rem', padding: '1rem 1.25rem',
              background: 'var(--border2)', borderRadius: '8px',
              fontSize: '0.72rem', color: 'var(--muted)', lineHeight: 1.7,
            }}>
              🔒 Cette transaction est <strong>définitivement gravée</strong> sur la blockchain.
              Elle ne peut être ni modifiée, ni supprimée par aucune autorité.
            </div>
          </div>
        )}

        {/* Help */}
        {!result && !loading && (
          <div style={{
            background: 'var(--bg2)', border: '1px solid var(--border2)',
            borderRadius: '8px', padding: '1.5rem',
          }}>
            <div style={{ fontWeight: 700, marginBottom: '0.75rem', fontSize: '0.85rem' }}>💡 Comment vérifier ?</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--muted)', lineHeight: 1.8 }}>
              1. Votez et copiez votre <span style={{ color: 'var(--accent)' }}>TX Hash</span><br />
              2. Ou scannez le <span style={{ color: 'var(--accent)' }}>QR Code</span> sur le certificat officiel<br />
              3. Collez le hash ici → preuve cryptographique immédiate<br />
              4. Fonctionne pour votes, commits, révélations, délégations et inscriptions
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, val, mono, highlight, last }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '7px 0',
      borderBottom: last ? 'none' : '1px solid var(--border2)',
    }}>
      <span style={{ fontSize: '0.72rem', color: 'var(--muted2)' }}>{label}</span>
      <span style={{
        fontSize: '0.72rem',
        fontFamily: mono ? 'monospace' : 'inherit',
        fontWeight: highlight ? 800 : 500,
        color: highlight ? 'var(--green)' : 'var(--text)',
        maxWidth: '60%', textAlign: 'right', wordBreak: 'break-all',
      }}>{val}</span>
    </div>
  );
}
