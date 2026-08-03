import { useState, useEffect } from 'react';
import { IHMonogram } from '../ui/IHMonogram.jsx';

export function Splash({ onDone }) {
  const [out, setOut] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setOut(true), 800);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (out) {
      const t = setTimeout(onDone, 280);
      return () => clearTimeout(t);
    }
  }, [out, onDone]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'linear-gradient(135deg, #C8102E 0%, #A00C24 40%, #7A0A1C 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        opacity: out ? 0 : 1,
        transition: 'opacity .6s ease-out',
        pointerEvents: out ? 'none' : 'all',
      }}
    >
      {/* Decorative circles */}
      <div style={{
        position: 'absolute',
        width: 300,
        height: 300,
        borderRadius: '50%',
        background: 'rgba(255,255,255,.04)',
        top: -80,
        right: -80,
      }} />
      <div style={{
        position: 'absolute',
        width: 200,
        height: 200,
        borderRadius: '50%',
        background: 'rgba(255,255,255,.03)',
        bottom: -40,
        left: -40,
      }} />

      <IHMonogram className="splash-monogram" />
      <div style={{
        fontSize: 11,
        color: 'rgba(255,255,255,.6)',
        fontWeight: 600,
        letterSpacing: 2,
        textTransform: 'uppercase',
        marginBottom: 28,
        animation: 'fadeInUp 0.8s ease-out 0.2s both',
      }}>
        Gestão de Itens Pausados
      </div>
      <div
        style={{
          width: 200,
          height: 4,
          background: 'rgba(255,255,255,.15)',
          borderRadius: 99,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            background: 'linear-gradient(90deg, rgba(255,255,255,.5), white, rgba(255,255,255,.5))',
            backgroundSize: '200% 100%',
            borderRadius: 99,
            animation: 'sp .7s ease forwards',
          }}
        />
      </div>
    </div>
  );
}
