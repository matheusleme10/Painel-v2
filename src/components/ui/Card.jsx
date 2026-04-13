import { C } from '../../constants.js';

export function Card({ children, style, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: C.card,
        borderRadius: 16,
        border: `1px solid ${C.border}`,
        boxShadow: '0 1px 6px rgba(0,0,0,.05)',
        padding: 20,
        ...style,
        cursor: onClick ? 'pointer' : undefined,
      }}
    >
      {children}
    </div>
  );
}
