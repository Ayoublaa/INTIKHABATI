// Results.js v2 — per-election results page
// Route: /elections/:id/results

import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { useElection } from '../hooks/useElections';
import StatusBadge    from '../components/StatusBadge';
import CountdownTimer from '../components/CountdownTimer';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';

const API    = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';
const COLORS = ['#00d4ff', '#0066ff', '#00ff88', '#ffb400', '#a855f7', '#ff6b6b'];

const card = {
  background:   'var(--bg2)',
  border:       '1px solid var(--border2)',
  borderRadius: 14,
  padding:      '1.5rem',
  marginBottom: '1.2rem',
};

export default function Results() {
  const { id }   = useParams();
  // eslint-disable-next-line no-unused-vars
  const navigate = useNavigate();
  const { election, loading: electionLoading } = useElection(id);

  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(true);
  const [, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    const load = () =>
      axios.get(`${API}/elections/${id}/results`)
        .then(r => { setResults(r.data); setError(''); })
        .catch(err => setError(err.response?.data?.message || err.message))
        .finally(() => setLoading(false));

    load();
    const t = setInterval(load, 15_000);
    return () => clearInterval(t);
  }, [id]);

  if (loading || electionLoading) {
    return (
      <div style={{ padding: '90px 1rem', textAlign: 'center', color: 'var(--muted)' }}>
        Loading results...
      </div>
    );
  }

  if (!election) {
    return (
      <div style={{ padding: '90px 1rem', textAlign: 'center', color: '#ff6b6b' }}>
        Election not found.
      </div>
    );
  }

  const isOpen   = election.statusLabel === 'Open';
  const isClosed = election.statusLabel === 'Closed';
  const total      = Number(results?.totalVotes || 0);
  const blank      = Number(results?.blankVotes || 0);
  const reg        = Number(election.totalRegistered || 0);
  const turnout    = reg > 0 ? ((total / reg) * 100).toFixed(1) : '0';
  const candidates = results?.candidates || [];
  const deadline   = Number(election.deadline || 0);

  const chartData = candidates.map(c => ({
    name:  c.name.length > 12 ? c.name.slice(0, 12) + '…' : c.name,
    votes: c.voteCount,
  }));

  return (
    <div style={{ padding: '90px 1.5rem 3rem', maxWidth: 900, margin: '0 auto' }}>

      <Link to={`/elections/${id}`}
        style={{ color: 'var(--cyan)', fontSize: '0.85rem', textDecoration: 'none' }}>
        ← Back to election
      </Link>

      {/* Header */}
      <div style={{ ...card, marginTop: '1rem' }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem',
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', marginBottom: '0.4rem' }}>
              <StatusBadge status={election.statusLabel} />
              <h2 style={{ margin: 0, fontSize: '1.4rem' }}>{election.name}</h2>
            </div>
            <p style={{ margin: 0, color: 'var(--muted)', fontSize: '0.85rem' }}>
              {election.categoryLabel} · Election #{id}
            </p>
          </div>
          {isOpen && deadline > 0 && (
            <div style={{ color: 'var(--cyan)', fontWeight: 700 }}>
              <CountdownTimer deadline={deadline} />
            </div>
          )}
        </div>

        {/* KPIs */}
        <div style={{ display: 'flex', gap: '1rem', marginTop: '1.2rem', flexWrap: 'wrap' }}>
          {[
            { label: 'Registered',  value: reg,           color: 'var(--cyan)' },
            { label: 'Votes Cast',  value: total,         color: '#00ff88' },
            { label: 'Blank Votes', value: blank,         color: 'var(--muted)' },
            { label: 'Turnout',     value: `${turnout}%`, color: '#ffb400' },
          ].map(k => (
            <div key={k.label} style={{
              background: 'var(--bg)', borderRadius: 10, padding: '0.7rem 1rem',
              minWidth: 80, textAlign: 'center', flex: '1',
            }}>
              <div style={{ fontWeight: 700, fontSize: '1.3rem', color: k.color }}>{k.value}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{k.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Restricted message — backend flag OR election not yet closed */}
      {(results?.restricted || !isClosed) && (
        <div style={{ ...card, textAlign: 'center', padding: '2.5rem' }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.8rem' }}>🔒</div>
          <p style={{ color: 'var(--muted)', marginBottom: '0.5rem' }}>
            {results?.message || 'Résultats disponibles après clôture de l\'élection'}
          </p>
          {!isClosed && deadline > 0 && (
            <p style={{ color: 'var(--cyan)', margin: 0 }}>
              Résultats dans : <CountdownTimer deadline={deadline} />
            </p>
          )}
        </div>
      )}

      {/* Candidate results — only shown when election is closed */}
      {!results?.restricted && isClosed && candidates.length > 0 && (
        <>
          <div style={card}>
            <h3 style={{ marginTop: 0 }}>Results by Candidate</h3>
            {candidates.map((c, idx) => (
              <div key={c.id} style={{ marginBottom: '1rem' }}>
                <div style={{
                  display: 'flex', justifyContent: 'space-between',
                  marginBottom: '0.3rem', flexWrap: 'wrap', gap: '0.3rem',
                }}>
                  <span style={{ fontWeight: 600 }}>
                    {idx + 1}. {c.name}
                    {c.party && (
                      <span style={{ color: 'var(--muted)', fontWeight: 400, fontSize: '0.82rem' }}>
                        {' '}({c.party})
                      </span>
                    )}
                  </span>
                  <span style={{ color: COLORS[idx % COLORS.length], fontWeight: 700 }}>
                    {c.percentage}% · {c.voteCount} votes
                  </span>
                </div>
                <div style={{ height: 10, background: 'var(--border2)', borderRadius: 5, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', width: `${c.percentage}%`,
                    background: COLORS[idx % COLORS.length],
                    borderRadius: 5, transition: 'width 0.6s ease',
                  }} />
                </div>
              </div>
            ))}
            {election.blankVoteEnabled && (
              <div style={{ marginTop: '0.5rem', color: 'var(--muted)', fontSize: '0.85rem' }}>
                ∅ Blank votes: {blank}
                {total > 0 && ` (${((blank / total) * 100).toFixed(1)}%)`}
              </div>
            )}
          </div>

          {/* Bar chart */}
          {chartData.length > 0 && (
            <div style={card}>
              <h3 style={{ marginTop: 0 }}>Vote Distribution</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                  <XAxis dataKey="name" tick={{ fill: '#aaa', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#aaa', fontSize: 11 }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ background: '#0d1b2e', border: '1px solid #1e3a5f', borderRadius: 8 }}
                    labelStyle={{ color: '#e8f4ff' }}
                    itemStyle={{ color: '#00d4ff' }}
                  />
                  <Bar dataKey="votes" radius={[6, 6, 0, 0]}>
                    {chartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Pie chart */}
          {candidates.length > 1 && (
            <div style={card}>
              <h3 style={{ marginTop: 0 }}>Share of Votes</h3>
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={candidates}
                    dataKey="voteCount"
                    nameKey="name"
                    cx="50%" cy="50%"
                    outerRadius={95}
                    label={({ name, percentage }) => `${name}: ${percentage}%`}
                    labelLine={false}
                  >
                    {candidates.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={v => [`${v} votes`]} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}

      {/* Official certificate */}
      {isClosed && (
        <div style={{ ...card, textAlign: 'center' }}>
          <p style={{ color: 'var(--muted)', marginTop: 0, fontSize: '0.85rem' }}>
            This election is closed. Download the official certified results.
          </p>
          <button
            onClick={() => window.open(`${API}/certificate/${id}`, '_blank')}
            style={{
              padding: '0.8rem 2rem',
              background: 'linear-gradient(135deg, #b8860b, #d4a017)',
              color: '#000', border: 'none', borderRadius: 10,
              fontWeight: 700, cursor: 'pointer', fontSize: '0.95rem',
            }}>
            🏆 Download Official Certificate
          </button>
        </div>
      )}

      {/* Export buttons */}
      {isClosed && (
        <div style={{ display: 'flex', gap: '0.8rem', flexWrap: 'wrap' }}>
          <a href={`${API}/vote/export/csv`} target="_blank" rel="noreferrer"
            style={{
              padding: '0.6rem 1.2rem', borderRadius: 10,
              background: 'var(--bg2)', color: 'var(--cyan)',
              border: '1px solid var(--cyan)', fontSize: '0.85rem', textDecoration: 'none',
            }}>
            📄 Export CSV
          </a>
          <a href={`${API}/vote/export/excel`} target="_blank" rel="noreferrer"
            style={{
              padding: '0.6rem 1.2rem', borderRadius: 10,
              background: 'var(--bg2)', color: '#00ff88',
              border: '1px solid #00ff88', fontSize: '0.85rem', textDecoration: 'none',
            }}>
            📊 Export Excel
          </a>
        </div>
      )}

      {/* Live indicator */}
      {isOpen && (
        <p style={{ textAlign: 'center', color: 'var(--muted)', fontSize: '0.78rem', marginTop: '1.5rem' }}>
          🔄 Results update every 15 seconds
        </p>
      )}
    </div>
  );
}
