import { C } from '../../../constants.js';

export function Ring({ v, size = 60 }) {
  const color = v >= 80 ? C.green : v >= 60 ? C.amber : C.red;
  const r = size / 2 - 5;
  const circ = 2 * Math.PI * r;
  const dash = circ * (v / 100);

  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', flexShrink: 0 }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={C.border} strokeWidth={5} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={5}
        strokeDasharray={`${dash} ${circ - dash}`}
        strokeLinecap="round"
      />
      <text
        x={size / 2}
        y={size / 2}
        textAnchor="middle"
        dominantBaseline="central"
        style={{
          fontSize: size * 0.2,
          fontWeight: 900,
          fill: color,
          transform: `rotate(90deg)`,
          transformOrigin: `${size / 2}px ${size / 2}px`,
        }}
      >
        {v}%
      </text>
    </svg>
  );
}
