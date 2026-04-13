import { C } from '../../../constants.js';

export function Gauge({ value, size = 190 }) {
  const color = value >= 80 ? C.green : value >= 60 ? C.amber : C.red;
  const label = value >= 80 ? 'Ótimo' : value >= 60 ? 'Atenção' : 'Crítico';
  const R = size / 2 - 14;
  const toRad = (d) => (d * Math.PI) / 180;
  const angle = (value / 100) * 180;
  const endX = size / 2 + R * Math.cos(toRad(180 - angle));
  const endY = size / 2 - R * Math.sin(toRad(180 - angle));
  const bgPath = `M ${size / 2 - R} ${size / 2} A ${R} ${R} 0 0 1 ${size / 2 + R} ${size / 2}`;
  const fillPath = `M ${size / 2 - R} ${size / 2} A ${R} ${R} 0 ${
    angle > 180 ? 1 : 0
  } 1 ${endX} ${endY}`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <svg width={size} height={size / 2 + 24}>
        <path d={bgPath} fill="none" stroke={C.border} strokeWidth={13} strokeLinecap="round" />
        <path d={fillPath} fill="none" stroke={color} strokeWidth={13} strokeLinecap="round" />
        <text
          x={size / 2}
          y={size / 2 + 2}
          textAnchor="middle"
          style={{ fontSize: 28, fontWeight: 900, fill: color }}
        >
          {value}%
        </text>
        <text
          x={size / 2}
          y={size / 2 + 20}
          textAnchor="middle"
          style={{ fontSize: 12, fill: C.muted }}
        >
          {label}
        </text>
      </svg>
    </div>
  );
}
