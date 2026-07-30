import { C } from '../../constants.js';
import { Ic } from './Icon.jsx';

export function Kpi({ label, value, sub, icon, accent = C.red, accentBg = C.redL, small }) {
  return (
    <div
      className="kpi-card"
      style={{
        padding: '16px 18px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        minWidth: 0,
        transition: 'box-shadow .25s ease, transform .2s ease',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ fontSize: 11, color: C.muted, fontWeight: 600, lineHeight: 1.3 }}>
          {label}
        </div>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: accentBg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Ic n={icon} s={16} c={accent} />
        </div>
      </div>
      <div style={{ fontSize: small ? 18 : 28, fontWeight: 900, color: C.text, lineHeight: 1, letterSpacing: -0.5 }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.4 }}>
          {sub}
        </div>
      )}
    </div>
  );
}
