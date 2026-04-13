import { useState, useEffect } from 'react';
import { C, LOGO } from '../../constants.js';

export function Splash({ onDone }) {
  const [out, setOut] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setOut(true), 2600);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (out) {
      const t = setTimeout(onDone, 500);
      return () => clearTimeout(t);
    }
  }, [out, onDone]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: C.red,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        opacity: out ? 0 : 1,
        transition: 'opacity .5s',
        pointerEvents: out ? 'none' : 'all',
      }}
    >
      <img
        src={LOGO}
        alt="Ital In House"
        style={{ height: 90, objectFit: 'contain', marginBottom: 40 }}
        onError={(e) => {
          e.target.style.display = 'none';
        }}
      />
      <div
        style={{
          width: 200,
          height: 4,
          background: 'rgba(255,255,255,.2)',
          borderRadius: 4,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            background: 'white',
            borderRadius: 4,
            animation: 'sp 2.5s ease forwards',
          }}
        />
      </div>
    </div>
  );
}
