import { useParams, useNavigate, Link } from 'react-router-dom';
import { useElection } from '../hooks/useElections';
import { useWallet }   from '../hooks/useWallet';
import StatusBadge     from '../components/StatusBadge';
import CountdownTimer  from '../components/CountdownTimer';
import { useState, useEffect } from 'react';
import axios from 'axios';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

const card = {
  background:   'var(--bg2)',
  border:       '1px solid var(--border2)',
  borderRadius: 14,
  padding:      '1.5rem',
  marginBottom: '1.2rem',
};

const CATEGORY_ICONS = {
  Presidential: '🏛', Legislative: '📜',
  Municipal: '🏙', Regional: '🗺', Referendum: '📋',
};

export default function ElectionDetail() {
  const { id }    = useParams();
  const navigate  = useNavigate();
  const { wallet } = useWallet();
  const { election, candidates, loading, error } = useElection(id);
  const [voterStatus, setVoterStatus] = useState(null);
  const [results, setResults]         = useState(null);

  // Load voter status if wallet connected
  useEffect(() => {
    if (!wallet || !id) return;
    axios.get(`${API}/voters/status?electionId=${id}&wallet=${wallet}`)
      .then(r => setVoterStatus(r.data))
      .catch(() => {});
  }, [wallet, id]);

  // Load results if election is closed or public
  useEffect(() => {
    if (!id) return;
    axios.get(`${API}/elections/${id}/results`)
      .then(r => setResults(r.data))
      .catch(() => {});
  }, [id]);

  if (loading) return (
    <div style={{ padding: '90px 1rem', textAlign: 'center', color: 'var(--muted)' }}>
      Loading election...
    </div>
  );
  if (error || !election) return (
    <div style={{ padding: '90px 1rem', textAlign: 'center', color: '#ff6b6b' }}>
      Election not found.
    </div>
  );

  const icon       = CATEGORY_ICONS[election.categoryLabel] || '🗳';
  const isOpen     = election.statusLabel === 'Open';
  const isClosed   = election.statusLabel === 'Closed';
  const totalVotes = Number(results?.totalVotes || election.totalVotes || 0);
  const totalReg   = election.totalRegistered;
  const turnout    = totalReg > 0 ? ((totalVotes / totalReg) * 100).toFixed(1) : '0';

  return (
    <div style={{ padding: '90px 1.5rem 3rem', maxWidth: 800, margin: '0 auto' }}>
      {/* Back */}
      <Link to="/elections" style={{ color: 'var(--cyan)', fontSize: '0.85rem', textDecoration: 'none' }}>
        ← Back to Elections
      </Link>

      {/* Header */}
      <div style={{ ...card, marginTop: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '2rem' }}>{icon}</span>
              <StatusBadge status={election.statusLabel} />
            </div>
            <h1 style={{ margin: 0, fontSize: '1.6rem' }}>{election.name}</h1>
            <p style={{ color: 'var(--muted)', margin: '0.3rem 0 0', fontSize: '0.9rem' }}>
              {election.categoryLabel}
            </p>
          </div>
          {isOpen && election.deadline > 0 && (
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginBottom: '0.3rem' }}>Closes in</div>
              <div style={{ color: 'var(--cyan)', fontWeight: 700 }}>
                <CountdownTimer deadline={election.deadline} />
              </div>
            </div>
          )}
        </div>

        {/* KPIs */}
        <div style={{ display: 'flex', gap: '1rem', marginTop: '1.2rem', flexWrap: 'wrap' }}>
          {[
            { label: 'Registered', value: totalReg },
            { label: 'Votes Cast', value: totalVotes },
            { label: 'Turnout',    value: `${turnout}%` },
            { label: 'Candidates', value: election.candidateCount },
          ].map(k => (
            <div key={k.label} style={{
              background: 'var(--bg)', borderRadius: 10, padding: '0.7rem 1rem',
              minWidth: 90, textAlign: 'center', flex: '1',
            }}>
              <div style={{ fontWeight: 700, fontSize: '1.3rem', color: 'var(--cyan)' }}>{k.value}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{k.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Voter status */}
      {wallet && voterStatus && (
        <div style={{ ...card, borderColor: voterStatus.isRegistered ? '#00ff8833' : '#ff6b6b33' }}>
          {voterStatus.isRegistered ? (
            <div>
              <p style={{ margin: 0, color: '#00ff88', fontWeight: 700 }}>✅ You are registered for this election</p>
              {voterStatus.hasVoted && (
                <p style={{ margin: '0.3rem 0 0', color: 'var(--muted)', fontSize: '0.85rem' }}>
                  ✓ You already voted in this election.
                </p>
              )}
              {voterStatus.hasDelegated && (
                <p style={{ margin: '0.3rem 0 0', color: '#ffb400', fontSize: '0.85rem' }}>
                  You delegated your vote to {voterStatus.delegatedTo?.slice(0, 10)}...
                </p>
              )}
            </div>
          ) : (
            <p style={{ margin: 0, color: '#ff6b6b', fontSize: '0.85rem' }}>
              ⚠ You are not registered for this election.
              <Link to={`/elections/${id}/vote`} style={{ color: 'var(--cyan)', marginLeft: '0.5rem' }}>
                Register &amp; Vote →
              </Link>
            </p>
          )}
        </div>
      )}

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: '0.8rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
        {/* Not registered yet — go to vote page which handles registration first */}
        {isOpen && wallet && !voterStatus?.isRegistered && (
          <button
            onClick={() => navigate(`/elections/${id}/vote`)}
            style={{
              padding: '0.8rem 2rem',
              background: 'linear-gradient(135deg, #0066cc, #00d4ff)',
              color: '#fff', border: 'none', borderRadius: 10,
              fontWeight: 700, fontSize: '1rem', cursor: 'pointer',
            }}>
            🗳 S'inscrire &amp; Voter →
          </button>
        )}
        {/* Already registered, not yet voted */}
        {isOpen && voterStatus?.isRegistered && !voterStatus?.hasVoted && !voterStatus?.hasDelegated && (
          <button
            onClick={() => navigate(`/elections/${id}/vote`)}
            style={{
              padding:      '0.8rem 2rem',
              background:   'linear-gradient(135deg, #0066cc, #00d4ff)',
              color:        '#fff',
              border:       'none',
              borderRadius: 10,
              fontWeight:   700,
              fontSize:     '1rem',
              cursor:       'pointer',
            }}>
            🗳 Vote Now
          </button>
        )}
        {(isClosed || !results?.restricted) && (
          <button
            onClick={() => navigate(`/elections/${id}/results`)}
            style={{
              padding:      '0.8rem 1.5rem',
              background:   'var(--bg2)',
              color:        'var(--cyan)',
              border:       '1px solid var(--cyan)',
              borderRadius: 10,
              fontWeight:   600,
              cursor:       'pointer',
            }}>
            📊 View Results
          </button>
        )}
      </div>

      {/* Candidates list */}
      {candidates.length > 0 && (
        <div style={card}>
          <h3 style={{ marginTop: 0 }}>Candidates ({election.candidateCount})</h3>
          {candidates.map((c, idx) => {
            const pct = totalVotes > 0 ? ((c.voteCount / totalVotes) * 100).toFixed(1) : null;
            return (
              <div key={c.id} style={{
                display:       'flex',
                alignItems:    'center',
                gap:           '1rem',
                padding:       '0.8rem 0',
                borderBottom:  idx < candidates.length - 1 ? '1px solid var(--border2)' : 'none',
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: '50%',
                  background: 'linear-gradient(135deg, #0066cc, #00d4ff)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 700, fontSize: '0.85rem', color: '#fff',
                }}>
                  {idx + 1}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>{c.name}</div>
                  {c.party && <div style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>{c.party}</div>}
                  {pct !== null && (
                    <div style={{ marginTop: '0.3rem' }}>
                      <div style={{ height: 5, background: 'var(--border2)', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: 'var(--cyan)', borderRadius: 3 }} />
                      </div>
                    </div>
                  )}
                </div>
                {pct !== null && (
                  <div style={{ textAlign: 'right', minWidth: 60 }}>
                    <div style={{ fontWeight: 700, color: 'var(--cyan)' }}>{pct}%</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{c.voteCount} votes</div>
                  </div>
                )}
              </div>
            );
          })}
          {election.blankVoteEnabled && results && (
            <div style={{ padding: '0.8rem 0', color: 'var(--muted)', fontSize: '0.85rem' }}>
              ∅ Blank votes: {results.blankVotes || 0}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
