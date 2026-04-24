// ── Composant carte Maroc réutilisable ────────────────────────
// viewBox 0 0 500 420 — coordonnées calées sur la vraie forme

const CITIES = [
  { name: 'Tanger',     x: 168, y: 72,  key: 'Tanger' },
  { name: 'Tétouan',    x: 185, y: 85,  key: 'Tétouan' },
  { name: 'Oujda',      x: 340, y: 115, key: 'Oujda' },
  { name: 'Fès',        x: 248, y: 128, key: 'Fès' },
  { name: 'Meknès',     x: 218, y: 138, key: 'Meknès' },
  { name: 'Rabat',      x: 152, y: 152, key: 'Rabat' },
  { name: 'Salé',       x: 158, y: 148, key: 'Salé' },
  { name: 'Kénitra',    x: 148, y: 142, key: 'Kénitra' },
  { name: 'Casablanca', x: 148, y: 178, key: 'Casablanca' },
  { name: 'Marrakech',  x: 185, y: 248, key: 'Marrakech' },
  { name: 'Agadir',     x: 138, y: 298, key: 'Agadir' },
];

export function MoroccoMap({ cityData = [] }) {
  const maxVotes = Math.max(...cityData.map(c => c.votes), 1);

  const getVotes = (key) => {
    const found = cityData.find(c =>
      c.city?.toLowerCase().includes(key.toLowerCase()) ||
      key.toLowerCase().includes(c.city?.toLowerCase())
    );
    return found?.votes || 0;
  };

  return (
    <svg viewBox="0 0 500 420" style={{ width: '100%', height: '100%' }}>
      {/* Fond */}
      <rect width="500" height="420" fill="#030b14" rx="8" />

      {/* Océan Atlantique */}
      <rect x="0" y="0" width="120" height="420" fill="rgba(0,50,100,0.15)" />
      <text x="55" y="200" fill="rgba(0,150,255,0.2)" fontSize="9" fontFamily="serif" textAnchor="middle" transform="rotate(-90, 55, 200)">OCÉAN ATLANTIQUE</text>

      {/* Mer Méditerranée */}
      <rect x="120" y="0" width="380" height="60" fill="rgba(0,80,150,0.12)" />
      <text x="320" y="30" fill="rgba(0,150,255,0.2)" fontSize="9" fontFamily="serif" textAnchor="middle">MER MÉDITERRANÉE</text>

      {/* Forme du Maroc — plus précise */}
      <path
        d="M 168 68
           L 195 58 L 230 55 L 265 62 L 295 72
           L 340 85 L 368 98 L 378 115
           L 372 132 L 358 145 L 348 165
           L 342 188 L 338 215 L 332 242
           L 318 268 L 295 292 L 272 315
           L 245 335 L 215 348 L 188 352
           L 162 348 L 142 335 L 125 315
           L 115 292 L 112 268 L 118 242
           L 122 215 L 125 188 L 128 165
           L 132 145 L 138 125 L 142 105
           L 148 88 L 158 75 Z"
        fill="rgba(0,100,200,0.1)"
        stroke="rgba(0,212,255,0.3)"
        strokeWidth="1.5"
      />

      {/* Sahara occidental (zone grisée) */}
      <path
        d="M 118 268 L 125 292 L 135 315 L 148 335 L 162 348 L 188 352 L 215 348 L 245 335 L 272 315 L 295 292 L 318 268 L 332 242 L 338 215 L 342 188 L 195 188 L 155 215 L 125 242 Z"
        fill="rgba(255,180,0,0.04)"
        stroke="rgba(255,180,0,0.1)"
        strokeWidth="0.5"
        strokeDasharray="4 4"
      />

      {/* Grille légère */}
      {[100,150,200,250,300,350].map(y => (
        <line key={`h${y}`} x1="110" y1={y} x2="390" y2={y} stroke="rgba(0,212,255,0.04)" strokeWidth="0.5" />
      ))}
      {[140,190,240,290,340].map(x => (
        <line key={`v${x}`} x1={x} y1="55" x2={x} y2="360" stroke="rgba(0,212,255,0.04)" strokeWidth="0.5" />
      ))}

      {/* Villes */}
      {CITIES.map((city) => {
        const votes  = getVotes(city.key);
        const ratio  = votes / maxVotes;
        const radius = votes > 0 ? Math.max(7, Math.min(24, ratio * 24)) : 4;
        const color  = votes > 0
          ? (ratio > 0.7 ? '#ff3b5c' : ratio > 0.4 ? '#ffb400' : '#00d4ff')
          : 'rgba(0,212,255,0.15)';
        const isSuspect = ratio > 0.7 && votes > 1;

        return (
          <g key={city.name}>
            {/* Pulse pour villes suspectes */}
            {isSuspect && (
              <circle cx={city.x} cy={city.y} r={radius + 6} fill="none" stroke="#ff3b5c" strokeWidth="1" opacity="0.5">
                <animate attributeName="r" values={`${radius+4};${radius+14};${radius+4}`} dur="2s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.5;0;0.5" dur="2s" repeatCount="indefinite" />
              </circle>
            )}

            {/* Cercle vote */}
            {votes > 0 && (
              <circle cx={city.x} cy={city.y} r={radius}
                fill={color} fillOpacity={0.7}
                stroke={color} strokeWidth="1.5"
              />
            )}

            {/* Point ville */}
            <circle cx={city.x} cy={city.y} r={votes > 0 ? 2.5 : 2}
              fill={votes > 0 ? '#fff' : 'rgba(0,212,255,0.3)'}
            />

            {/* Label */}
            <text
              x={city.x + (votes > 0 ? radius + 4 : 6)}
              y={city.y + 4}
              fill={votes > 0 ? '#e8f4ff' : '#2a4060'}
              fontSize="8.5"
              fontFamily="JetBrains Mono"
            >
              {city.name}{votes > 0 ? ` (${votes})` : ''}
            </text>
          </g>
        );
      })}

      {/* Légende */}
      <g transform="translate(12, 360)">
        <rect width="125" height="50" rx="4" fill="rgba(0,0,0,0.7)" stroke="rgba(0,212,255,0.1)" strokeWidth="0.5" />
        <text x="8" y="12" fill="rgba(0,212,255,0.5)" fontSize="7" fontFamily="Syne" fontWeight="700">LÉGENDE</text>
        {[
          { color: '#00d4ff', label: 'Activité normale' },
          { color: '#ffb400', label: 'Activité modérée' },
          { color: '#ff3b5c', label: 'Activité suspecte' },
        ].map((l, i) => (
          <g key={l.label} transform={`translate(8, ${18 + i * 11})`}>
            <circle cx={4} cy={0} r={3.5} fill={l.color} />
            <text x="12" y="4" fill="#4a7090" fontSize="8" fontFamily="JetBrains Mono">{l.label}</text>
          </g>
        ))}
      </g>

      {/* Titre */}
      <text x="250" y="22" textAnchor="middle" fill="rgba(0,212,255,0.4)" fontSize="9.5" fontFamily="Syne" fontWeight="700">
        🇲🇦  ROYAUME DU MAROC — DISTRIBUTION DES VOTES
      </text>
    </svg>
  );
}