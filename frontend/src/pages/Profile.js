// Profile.js v2 — per-election voter status
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

const CATEGORY_LABELS = ['Presidential', 'Legislative', 'Municipal', 'Regional', 'Referendum'];
const CATEGORY_ICONS  = { Presidential: '🏛', Legislative: '📜', Municipal: '🏙', Regional: '🗺', Referendum: '📋' };
const STATUS_LABELS   = ['Upcoming', 'Open', 'Closed'];
const STATUS_COLORS   = { Open: '#00ff88', Upcoming: '#ffb400', Closed: 'var(--muted)' };

const card = {
  background:   'var(--bg2)',
  border:       '1px solid var(--border2)',
  borderRadius: 12,
  padding:      '1.25rem',
  marginBottom: '1rem',
};

export default function Profile() {
  const [wallet,   setWallet]   = useState(null);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  // Per-election participation data
  const [voterElections, setVoterElections] = useState([]); // [{electionId, hasVoted, hasDelegated, delegatedTo}]
  const [elections,      setElections]      = useState([]); // full election list for name lookup
  const [mongoProfile,   setMongoProfile]   = useState(null); // from /api/voters/verify/:wallet

  // Connect wallet
  async function connectWallet() {
    if (!window.ethereum) return setError('MetaMask not detected.');
    setLoading(true); setError('');
    try {
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      const addr = accounts[0];
      setWallet(addr);
      await loadProfile(addr);
    } catch (e) {
      setError(e.message || 'Connection error');
    }
    setLoading(false);
  }

  async function loadProfile(addr) {
    try {
      const [electionsRes, verifyRes] = await Promise.allSettled([
        axios.get(`${API}/elections`),
        axios.get(`${API}/voters/verify/${addr}`),
      ]);

      if (electionsRes.status === 'fulfilled') {
        setElections(electionsRes.value.data.elections || []);
      }
      if (verifyRes.status === 'fulfilled') {
        // verify returns: { wallet, elections: [{electionId, electionName, isRegistered, hasVoted, voteTimestamp}] }
        const verifyData = verifyRes.value.data;
        setVoterElections(verifyData.elections || []);
        // Also try to get risk profile from the same source
        setMongoProfile(verifyData.mongoProfile || null);
      }
    } catch {}
  }

  // Reload when wallet changes
  useEffect(() => {
    if (!window.ethereum) return;
    window.ethereum.request({ method: 'eth_accounts' }).then(async accounts => {
      if (accounts[0]) {
        setWallet(accounts[0]);
        await loadProfile(accounts[0]);
      }
    }).catch(() => {});

    const handleChange = async (accounts) => {
      if (accounts[0]) {
        setWallet(accounts[0]);
        await loadProfile(accounts[0]);
      } else {
        setWallet(null);
        setVoterElections([]);
        setMongoProfile(null);
      }
    };
    window.ethereum.on('accountsChanged', handleChange);
    return () => window.ethereum?.removeListener?.('accountsChanged', handleChange);
  }, []);

  // Lookup election details by id
  const electionMap = {};
  elections.forEach(e => { electionMap[Number(e.id)] = e; });

  // Stats
  const votedCount     = voterElections.filter(e => e.hasVoted).length;
  const delegatedCount = voterElections.filter(e => e.hasDelegated || e.delegatedTo).length;
  const riskScore      = mongoProfile?.riskScore ?? null;

  return (
    <div style={{ padding: '90px 1.5rem 3rem', maxWidth: 720, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ fontSize: '0.65rem', color: 'var(--muted)', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
          Mon espace électeur
        </div>
        <h1 style={{ fontFamily: 'Syne', fontWeight: 800, fontSize: '1.8rem', margin: 0 }}>
          Mon <span style={{ color: 'var(--cyan)' }}>Profil</span>
        </h1>
        <p style={{ color: 'var(--muted)', fontSize: '0.82rem', marginTop: 4 }}>
          Vérifiez votre statut d'électeur et votre participation par élection.
        </p>
      </div>

      {/* Not connected */}
      {!wallet ? (
        <div style={{ ...card, textAlign: 'center', padding: '2.5rem' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🦊</div>
          <div style={{ fontWeight: 700, marginBottom: '0.5rem' }}>Connectez votre wallet</div>
          <div style={{ color: 'var(--muted)', fontSize: '0.82rem', marginBottom: '1.5rem' }}>
            Pour voir votre profil électeur et votre participation par élection
          </div>
          {error && (
            <div style={{ color: '#ff6b6b', fontSize: '0.82rem', marginBottom: '1rem',
              background: 'rgba(255,59,92,0.07)', borderRadius: 6, padding: '8px 12px' }}>
              ⚠ {error}
            </div>
          )}
          <button onClick={connectWallet} disabled={loading} style={{
            background: loading ? 'rgba(255,255,255,0.04)' : 'linear-gradient(135deg, var(--cyan), #0066ff)',
            color: loading ? 'var(--muted)' : '#000', border: 'none', borderRadius: 8,
            padding: '12px 28px', fontWeight: 700, fontSize: '0.9rem', cursor: loading ? 'not-allowed' : 'pointer',
          }}>
            {loading ? '⏳ Chargement...' : '🦊 Connecter MetaMask'}
          </button>
        </div>
      ) : (
        <>
          {/* Wallet card */}
          <div style={{ ...card, border: '1px solid rgba(0,255,136,0.25)', background: 'rgba(0,255,136,0.04)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#00ff88', boxShadow: '0 0 8px #00ff88', display: 'inline-block' }} />
              <span style={{ color: '#00ff88', fontWeight: 700, fontSize: '0.85rem' }}>Wallet connecté</span>
              <span style={{ color: 'var(--muted)', fontSize: '0.72rem', fontFamily: 'JetBrains Mono' }}>
                {wallet.slice(0, 14)}...{wallet.slice(-8)}
              </span>
            </div>
          </div>

          {/* KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.8rem', marginBottom: '1rem' }}>
            {[
              { label: 'Élections votées',    val: votedCount,     color: '#00ff88' },
              { label: 'Délégations émises',  val: delegatedCount, color: '#a855f7' },
              { label: 'Score de risque',     val: riskScore !== null ? riskScore : '—', color: riskScore > 50 ? '#ff6b6b' : riskScore > 20 ? '#ffb400' : '#00ff88' },
            ].map(({ label, val, color }) => (
              <div key={label} style={{ ...card, textAlign: 'center', padding: '1rem', marginBottom: 0 }}>
                <div style={{ fontWeight: 800, fontSize: '1.5rem', color }}>{val}</div>
                <div style={{ fontSize: '0.68rem', color: 'var(--muted)', marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  {label}
                </div>
              </div>
            ))}
          </div>

          {/* MongoDB profile info */}
          {mongoProfile && (
            <div style={card}>
              <div style={{ fontWeight: 700, marginBottom: '0.8rem', fontSize: '0.9rem' }}>🪪 Profil enregistré</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {[
                  ['CIN Hash',      mongoProfile.idHash ? `${mongoProfile.idHash.slice(0, 18)}…` : '—'],
                  ['IPs uniques',   (mongoProfile.ipAddresses || []).length],
                  ['Tentatives',    mongoProfile.attemptCount || 0],
                  ['Blacklisté',    mongoProfile.isBlacklisted ? '⚠ Oui' : '✅ Non'],
                ].map(([label, val]) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid var(--border2)' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{label}</span>
                    <span style={{ fontSize: '0.75rem', fontFamily: 'JetBrains Mono', color: 'var(--text)' }}>{String(val)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Elections participated */}
          <div style={card}>
            <div style={{ fontWeight: 700, marginBottom: '1rem', fontSize: '0.9rem' }}>
              🗳 Participation par élection
            </div>

            {voterElections.length === 0 ? (
              <div style={{ color: 'var(--muted)', fontSize: '0.82rem', textAlign: 'center', padding: '1.5rem 0' }}>
                Aucune participation enregistrée.<br />
                <Link to="/elections" style={{ color: 'var(--cyan)', marginTop: '0.5rem', display: 'inline-block' }}>
                  Voir les élections disponibles →
                </Link>
              </div>
            ) : (
              voterElections.map(ve => {
                // ve has: { electionId, electionName, isRegistered, hasVoted, hasDelegated?, voteTimestamp }
                const e           = electionMap[ve.electionId];
                const name        = ve.electionName || e?.name || `Election #${ve.electionId}`;
                const catLabel    = e ? CATEGORY_LABELS[Number(e.category)] : '';
                const icon        = CATEGORY_ICONS[catLabel] || '🗳';
                const statusStr   = e ? STATUS_LABELS[Number(e.status)] : '';
                const statusColor = STATUS_COLORS[statusStr] || 'var(--muted)';
                return (
                  <div key={ve.electionId} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '0.8rem', background: 'var(--bg)', borderRadius: 8, marginBottom: '0.6rem',
                    border: '1px solid var(--border2)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem' }}>
                      <span style={{ fontSize: '1.4rem' }}>{icon}</span>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{name}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>
                          {catLabel}{catLabel && ' · '}
                          <span style={{ color: statusColor }}>{statusStr || 'Election'}</span>
                        </div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
                      {ve.hasVoted && (
                        <span style={{
                          fontSize: '0.68rem', padding: '2px 8px', borderRadius: 100,
                          background: 'rgba(0,255,136,0.1)', border: '1px solid rgba(0,255,136,0.3)',
                          color: '#00ff88',
                        }}>✅ Voté</span>
                      )}
                      {ve.hasDelegated && (
                        <span style={{
                          fontSize: '0.68rem', padding: '2px 8px', borderRadius: 100,
                          background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.3)',
                          color: '#a855f7',
                        }}>🤝 Délégué</span>
                      )}
                      {!ve.hasVoted && !ve.hasDelegated && (
                        <span style={{ fontSize: '0.68rem', color: 'var(--muted)' }}>Inscrit</span>
                      )}
                      <Link to={`/elections/${ve.electionId}`}
                        style={{ fontSize: '0.65rem', color: 'var(--cyan)', textDecoration: 'none' }}>
                        Détail →
                      </Link>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Quick links */}
          <div style={{ display: 'flex', gap: '0.8rem', flexWrap: 'wrap' }}>
            <Link to="/elections" style={{
              padding: '0.6rem 1.2rem', borderRadius: 8,
              background: 'var(--bg2)', color: 'var(--cyan)',
              border: '1px solid var(--cyan)', fontSize: '0.82rem', textDecoration: 'none',
              fontWeight: 600,
            }}>
              🗳 Voir les élections
            </Link>
            <Link to="/verify" style={{
              padding: '0.6rem 1.2rem', borderRadius: 8,
              background: 'var(--bg2)', color: 'var(--muted)',
              border: '1px solid var(--border2)', fontSize: '0.82rem', textDecoration: 'none',
            }}>
              🔍 Vérifier un vote
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
