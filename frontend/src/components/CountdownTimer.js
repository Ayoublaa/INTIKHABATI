import { useState, useEffect } from 'react';

export default function CountdownTimer({ deadline, onExpire }) {
  const [timeLeft, setTimeLeft] = useState(0);

  useEffect(() => {
    function calc() {
      const diff = Math.max(0, deadline - Math.floor(Date.now() / 1000));
      setTimeLeft(diff);
      if (diff === 0 && onExpire) onExpire();
    }
    calc();
    const id = setInterval(calc, 1000);
    return () => clearInterval(id);
  }, [deadline, onExpire]);

  if (timeLeft === 0) return <span style={{ color: 'var(--red, #ff6b6b)' }}>Closed</span>;

  const h = Math.floor(timeLeft / 3600);
  const m = Math.floor((timeLeft % 3600) / 60);
  const s = timeLeft % 60;

  return (
    <span style={{ fontVariantNumeric: 'tabular-nums' }}>
      ⏱ {h > 0 && `${h}h `}{m}m {String(s).padStart(2, '0')}s
    </span>
  );
}
