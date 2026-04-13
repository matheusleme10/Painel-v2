import { C } from '../../constants.js';

export function Pill({ children, color = C.red, bg = C.redL, s = 11 }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        background: bg,
        color,
        borderRadius: 20,
        padding: '2px 9px',
        fontSize: s,
        fontWeight: 700,
        letterSpacing: 0.3,
      }}
    >
      {children}
    </span>
  );
}
