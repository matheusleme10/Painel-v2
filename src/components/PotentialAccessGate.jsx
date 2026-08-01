import { useEffect, useState } from 'react';

export function PotentialAccessGate({ children }) {
  const [status, setStatus] = useState('loading');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/potential/session', { credentials: 'same-origin', cache: 'no-store' })
      .then((response) => response.ok ? response.json() : { authorized: false })
      .then((result) => setStatus(result.authorized ? 'authorized' : 'locked'))
      .catch(() => setStatus('locked'));
  }, []);

  async function unlock(event) {
    event.preventDefault();
    setError('');
    const response = await fetch('/api/potential/session', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(result.detail || 'Senha do Potencial incorreta.');
      return;
    }
    setPassword('');
    setStatus('authorized');
  }

  if (status === 'loading') return <div className="potential-gate"><p>Validando acesso...</p></div>;
  if (status === 'authorized') return children;
  return (
    <section className="potential-gate">
      <span className="potential-gate-mark">$</span>
      <div><span className="eyebrow">ACESSO RESTRITO</span><h1>Potencial de faturamento</h1><p>Digite a senha adicional fornecida pela rede.</p></div>
      <form onSubmit={unlock}>
        <label htmlFor="potential-password">Senha do Potencial</label>
        <input id="potential-password" type="password" value={password} autoComplete="current-password" required onChange={(event) => setPassword(event.target.value)} />
        {error && <div className="login-error">{error}</div>}
        <button type="submit">Liberar acesso</button>
      </form>
    </section>
  );
}
