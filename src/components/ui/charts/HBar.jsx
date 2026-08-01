import { C } from '../../../constants.js';
import { pct } from '../../../utils/format.js';
import { Ic } from '../Icon.jsx';

export function HBar({ data, maxItems = 8, color = C.red, fmtVal }) {
  const top = [...data].sort((a, b) => b.v - a.v).slice(0, maxItems);
  const max = top[0]?.v || 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      {top.map((d, i) => {
        const col = typeof color === 'function' ? color(d, i) : color;
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              title={d.n}
              style={{
                width: 120,
                fontSize: 11,
                color: C.muted,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                flexShrink: 0,
              }}
            >
              {d.n}
            </div>
            <div
              style={{
                flex: 1,
                height: 16,
                background: C.bg,
                borderRadius: 8,
                overflow: 'hidden',
                position: 'relative',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  height: '100%',
                  width: `${pct(d.v, max)}%`,
                  background: col,
                  borderRadius: 8,
                  transition: 'width .5s',
                }}
              />
            </div>
            <div
              style={{
                width: 50,
                fontSize: 11,
                fontWeight: 700,
                color: C.text,
                textAlign: 'right',
                flexShrink: 0,
              }}
            >
              {fmtVal ? fmtVal(d.v) : d.v}
            </div>
          </div>
        );
      })}
      {top.length === 0 && (
        <div style={{ color: C.muted, fontSize: 12, textAlign: 'center', padding: 16 }}>
          Sem dados
        </div>
      )}
    </div>
  );
}
