import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useElections } from '../hooks/useElections';
import ElectionCard from '../components/ElectionCard';

const CATEGORIES = [
  { label: 'All', value: null },
  { label: 'Presidential', value: 0 },
  { label: 'Legislative',  value: 1 },
  { label: 'Municipal',    value: 2 },
  { label: 'Regional',     value: 3 },
  { label: 'Referendum',   value: 4 },
];
const STATUS_TABS = ['All', 'Open', 'Upcoming', 'Closed'];

const card = {
  background:   'var(--bg2)',
  border:       '1px solid var(--border2)',
  borderRadius: 14,
  padding:      '1.5rem',
};

export default function Elections() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('All');
  const [category,  setCategory]  = useState(null);

  const { elections, loading, error } = useElections();

  const filtered = elections.filter(e => {
    const statusOk   = activeTab === 'All' || e.statusLabel === activeTab;
    const categoryOk = category === null   || e.category === category;
    return statusOk && categoryOk;
  });

  const tabBtn = (tab) => ({
    padding:      '0.4rem 1.1rem',
    borderRadius: 20,
    background:   activeTab === tab ? 'var(--cyan)' : 'var(--bg2)',
    color:        activeTab === tab ? '#000' : 'var(--text)',
    border:       `1px solid ${activeTab === tab ? 'var(--cyan)' : 'var(--border2)'}`,
    cursor:       'pointer',
    fontWeight:   activeTab === tab ? 700 : 400,
    fontSize:     '0.85rem',
  });

  return (
    <div style={{ padding: '90px 1.5rem 3rem', maxWidth: 960, margin: '0 auto' }}>
      {/* Title */}
      <h1 style={{ fontSize: '1.8rem', marginBottom: '0.3rem' }}>Elections</h1>
      <p style={{ color: 'var(--muted)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
        Browse active, upcoming, and past elections.
      </p>

      {/* Filters */}
      <div style={{ ...card, marginBottom: '1.5rem' }}>
        {/* Status tabs */}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
          {STATUS_TABS.map(t => (
            <button key={t} style={tabBtn(t)} onClick={() => setActiveTab(t)}>{t}</button>
          ))}
        </div>
        {/* Category filter */}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ color: 'var(--muted)', fontSize: '0.82rem' }}>Category:</span>
          {CATEGORIES.map(c => (
            <button key={c.label}
              onClick={() => setCategory(c.value)}
              style={{
                padding:      '0.3rem 0.8rem',
                borderRadius: 16,
                background:   category === c.value ? '#0066cc22' : 'transparent',
                color:        category === c.value ? 'var(--cyan)' : 'var(--muted)',
                border:       `1px solid ${category === c.value ? 'var(--cyan)' : 'var(--border2)'}`,
                cursor:       'pointer',
                fontSize:     '0.8rem',
              }}>
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Results */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--muted)' }}>
          Loading elections...
        </div>
      ) : error ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#ff6b6b' }}>
          Could not load elections. Is the backend running?
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ ...card, textAlign: 'center', padding: '3rem', color: 'var(--muted)' }}>
          No elections found for the selected filters.
        </div>
      ) : (
        <div style={{
          display:             'grid',
          gap:                 '1rem',
          gridTemplateColumns: 'repeat(auto-fill, minmax(270px, 1fr))',
        }}>
          {filtered.map(e => (
            <ElectionCard
              key={e.id}
              election={e}
              onClick={() => navigate(`/elections/${e.id}`)}
            />
          ))}
        </div>
      )}

      {/* Summary bar */}
      {!loading && elections.length > 0 && (
        <div style={{ marginTop: '2rem', textAlign: 'center', fontSize: '0.8rem', color: 'var(--muted)' }}>
          {elections.filter(e => e.statusLabel === 'Open').length} open ·{' '}
          {elections.filter(e => e.statusLabel === 'Upcoming').length} upcoming ·{' '}
          {elections.filter(e => e.statusLabel === 'Closed').length} closed
        </div>
      )}
    </div>
  );
}
