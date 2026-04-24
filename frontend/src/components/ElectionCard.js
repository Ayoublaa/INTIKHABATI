import StatusBadge    from './StatusBadge';
import CountdownTimer from './CountdownTimer';

const ICONS = {
  Presidential: '🏛',
  Legislative:  '📜',
  Municipal:    '🏙',
  Regional:     '🗺',
  Referendum:   '📋',
};

export default function ElectionCard({ election, onClick }) {
  const icon = ICONS[election.categoryLabel] || '🗳';
  const participation = election.totalRegistered > 0
    ? ((election.totalVotes / election.totalRegistered) * 100).toFixed(1)
    : '0';

  return (
    <div
      onClick={onClick}
      style={{
        background:   'var(--bg2, #0d1b2e)',
        border:       '1px solid var(--border2, #1e3a5f)',
        borderRadius: 14,
        padding:      '1.2rem',
        cursor:       'pointer',
        transition:   'transform 0.15s, box-shadow 0.15s',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.transform  = 'translateY(-3px)';
        e.currentTarget.style.boxShadow  = '0 8px 24px rgba(0,212,255,0.12)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform  = 'translateY(0)';
        e.currentTarget.style.boxShadow  = 'none';
      }}
    >
      {/* Top row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <span style={{ fontSize: '2rem' }}>{icon}</span>
        <StatusBadge status={election.statusLabel} />
      </div>

      {/* Name */}
      <h3 style={{ margin: '0.6rem 0 0.2rem', fontSize: '1rem', color: 'var(--text, #e8f4ff)' }}>
        {election.name}
      </h3>
      <p style={{ fontSize: '0.78rem', color: 'var(--muted, #4a7090)', margin: 0 }}>
        {election.categoryLabel}
      </p>

      {/* Stats */}
      <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', fontSize: '0.82rem' }}>
        <div>
          <div style={{ fontWeight: 700, color: 'var(--text, #e8f4ff)' }}>{election.totalVotes}</div>
          <div style={{ color: 'var(--muted)' }}>Votes</div>
        </div>
        <div>
          <div style={{ fontWeight: 700, color: 'var(--text, #e8f4ff)' }}>{participation}%</div>
          <div style={{ color: 'var(--muted)' }}>Turnout</div>
        </div>
        <div>
          <div style={{ fontWeight: 700, color: 'var(--text, #e8f4ff)' }}>{election.candidateCount}</div>
          <div style={{ color: 'var(--muted)' }}>Candidates</div>
        </div>
      </div>

      {/* Countdown for open elections */}
      {election.statusLabel === 'Open' && election.deadline > 0 && (
        <div style={{ marginTop: '0.8rem', fontSize: '0.78rem', color: 'var(--cyan, #00d4ff)' }}>
          <CountdownTimer deadline={election.deadline} />
        </div>
      )}

      <div style={{ marginTop: '0.8rem', fontSize: '0.78rem', color: 'var(--cyan, #00d4ff)' }}>
        Click to view →
      </div>
    </div>
  );
}
