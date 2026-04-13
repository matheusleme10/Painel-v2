import { C } from '../../constants.js';
import { Card } from './Card.jsx';
import { Ic } from './Icon.jsx';

export function Kpi({ label, value, sub, icon, accent = C.red, accentBg = C.redL, small }) {
  return (
    <Card style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ fontSize: 11, color: C.muted, fontWeight: 600, lineHeight: 1.3 }}>
          {label}
        </div>
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: 9,
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
      <div style={{ fontSize: small ? 18 : 28, fontWeight: 900, color: C.text, lineHeight: 1 }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.4 }}>{sub}</div>}
    </Card>
  );
}
