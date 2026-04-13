import { C } from '../../constants.js';
import { Ic } from './Icon.jsx';

export function AlertBanner({ items }) {
  if (!items.length) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {items.map((a, i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            gap: 9,
            alignItems: 'center',
            padding: '9px 13px',
            background: a.lvl === 'crit' ? C.redL : C.amberL,
            border: `1px solid ${a.lvl === 'crit' ? C.redM : C.amberM}`,
            borderRadius: 10,
          }}
        >
          <Ic n="alert" s={14} c={a.lvl === 'crit' ? C.red : C.amber} />
          <span style={{ fontSize: 12, color: a.lvl === 'crit' ? C.red : C.amber, fontWeight: 600 }}>
            {a.msg}
          </span>
        </div>
      ))}
    </div>
  );
}
