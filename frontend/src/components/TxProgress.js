export default function TxProgress({ message = 'Transaction pending...' }) {
  return (
    <div style={{
      position:       'fixed',
      inset:          0,
      background:     'rgba(0,0,0,0.7)',
      display:        'flex',
      flexDirection:  'column',
      alignItems:     'center',
      justifyContent: 'center',
      zIndex:         9999,
    }}>
      <div style={{
        background: 'var(--bg2, #0d1b2e)',
        border:     '1px solid var(--cyan, #00d4ff)',
        borderRadius: 16,
        padding:    '2rem 3rem',
        textAlign:  'center',
      }}>
        <div style={{
          width: 40, height: 40, border: '3px solid #00d4ff33',
          borderTop: '3px solid #00d4ff', borderRadius: '50%',
          animation: 'spin 0.8s linear infinite', margin: '0 auto 1rem',
        }} />
        <p style={{ color: 'var(--cyan, #00d4ff)', fontWeight: 700, margin: 0 }}>
          {message}
        </p>
        <p style={{ color: '#888', fontSize: '0.8rem', marginTop: '0.5rem' }}>
          Please confirm in MetaMask and wait...
        </p>
      </div>
    </div>
  );
}
