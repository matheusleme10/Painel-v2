import { C } from '../../constants.js';

export function Card({ children, style, onClick, className = '' }) {
  return (
    <div
      className={`surface-card${onClick ? ' interactive' : ''}${className ? ` ${className}` : ''}`}
      onClick={onClick}
      style={{
        padding: 20,
        transition: 'box-shadow .25s ease, transform .2s ease',
        ...style,
        cursor: onClick ? 'pointer' : undefined,
      }}
    >
      {children}
    </div>
  );
}
