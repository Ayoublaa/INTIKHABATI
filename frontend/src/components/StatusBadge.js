export default function StatusBadge({ status }) {
  const cfg = {
    Open:     { bg: '#0d2b0d', color: '#00ff88', label: 'OPEN' },
    Upcoming: { bg: '#1a1a00', color: '#ffb400', label: 'UPCOMING' },
    Closed:   { bg: '#1a0a0a', color: '#ff6b6b', label: 'CLOSED' },
  };
  const c = cfg[status] || { bg: '#111', color: '#aaa', label: status };
  return (
    <span style={{
      background:   c.bg,
      color:        c.color,
      border:       `1px solid ${c.color}`,
      borderRadius: 20,
      padding:      '2px 10px',
      fontSize:     '0.7rem',
      fontWeight:   700,
      letterSpacing: '0.05em',
    }}>
      {c.label}
    </span>
  );
}
