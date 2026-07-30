import { C, PAL } from '../../../constants.js';
import { pct } from '../../../utils/format.js';

export function Donut({ data, size = 150 }) {
  const r = size / 2 - 10;
  const circ = 2 * Math.PI * r;
  const total = data.reduce((s, d) => s + d.v, 0) || 1;
  let off = 0;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', flexShrink: 0 }}>
        {data.map((d, i) => {
          const dash = circ * (d.v / total);
          const el = (
            <circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={PAL[i % PAL.length]}
              strokeWidth={22}
              strokeDasharray={`${dash} ${circ - dash}`}
              strokeDashoffset={-off}
            />
          );
          off += dash;
          return el;
        })}
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {data.slice(0, 7).map((d, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
            <div
              style={{
                width: 9,
                height: 9,
                borderRadius: 3,
                background: PAL[i % PAL.length],
                flexShrink: 0,
              }}
            />
            <span
              style={{
                color: C.muted,
                flex: 1,
                minWidth: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {d.n}
            </span>
            <span style={{ fontWeight: 700, color: C.text, marginLeft: 4 }}>
              {pct(d.v, total)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
