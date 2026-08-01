import { useState } from 'react';
import { LOGO } from '../constants.js';

export function PortalLogin({ onAuthenticated }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const response = await fetch('/api/session', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: password.trim() }),
    });
    if (response.ok) {
      const session = await response.json();
      return onAuthenticated({ role: session.role });
    }
    setError(response.status === 503 ? 'As senhas do portal ainda não foram configuradas.' : 'Senha incorreta.');
    setBusy(false);
  }

  return (
    <main className="login-shell">
      <section className="login-panel">
        <div className="login-brand">
          <span className="login-logo-badge"><img src={LOGO} alt="Ital in House" /></span>
          <div><strong>Portal de inteligência</strong><small>Gestão da rede</small></div>
        </div>
        <div className="login-copy">
          <span className="eyebrow">ACESSO PROTEGIDO</span>
          <h1>Dados da rede protegidos por perfil de acesso.</h1>
          <p>A senha identifica automaticamente se o acesso é Administrativo ou de Franqueado.</p>
        </div>
        <form onSubmit={submit} className="login-form">
          <label htmlFor="portal-password">Senha de acesso</label>
          <input id="portal-password" type="password" autoComplete="current-password" value={password}
            onChange={(event) => setPassword(event.target.value)} autoFocus />
          {error && <div className="login-error">{error}</div>}
          <button type="submit" disabled={busy || !password}>{busy ? 'Validando…' : 'Entrar no portal'}</button>
        </form>
        <small className="security-note">A sessão termina ao fechar esta janela.</small>
      </section>
      <aside className="login-visual" aria-hidden="true">
        <div className="login-visual-copy">
          <span>VISÃO OPERACIONAL</span>
          <strong>Uma rede inteira.<br />Uma leitura simples.</strong>
          <small>Itens ativos, pausas e oportunidades em um só lugar.</small>
        </div>
        <div className="brand-orbit orbit-orange">Fast Food Caipira</div>
        <div className="brand-orbit orbit-blue">City Burger</div>
        <div className="brand-orbit orbit-green">Green</div>
        <div className="brand-orbit orbit-red">Ital in House</div>
      </aside>
    </main>
  );
}
