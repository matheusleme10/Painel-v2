import { useState } from 'react';
import { IHMonogram } from './ui/IHMonogram.jsx';
import { ThemeToggle } from './ui/ThemeToggle.jsx';

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
      return onAuthenticated({
        role: session.role,
        identified: session.identified,
        identity: session.identity || null,
      });
    }
    setError(response.status === 503 ? 'As senhas do portal ainda não foram configuradas.' : 'Senha incorreta.');
    setBusy(false);
  }

  return (
    <main className="login-shell">
      <ThemeToggle className="theme-toggle-btn theme-toggle-fixed" />
      <section className="login-panel">
        <div className="login-intro">
          <IHMonogram className="login-main-logo" />
          <div className="login-intro-content">
            <span className="login-kicker">OPERAÇÃO</span>
            <h1>Portal de Itens<br /><strong>Pausados <b>×</b> Ativos</strong></h1>
            <p>Visibilidade para agir rápido e manter o cardápio da rede sempre disponível.</p>
          </div>
          <div className="login-brand-list" aria-label="Marcas acompanhadas">
            <span>Ital in House</span><span>Fast Food Caipira</span><span>City Burger</span><span>Green</span>
          </div>
        </div>
        <div className="login-access">
          <div className="login-access-heading">
            <span className="eyebrow">ACESSO AO PAINEL</span>
            <h2>Bem-vindo de volta</h2>
            <p>Use sua senha para entrar como administrador ou franqueado.</p>
          </div>
          <form onSubmit={submit} className="login-form">
            <label htmlFor="portal-password">Senha de acesso</label>
            <input id="portal-password" type="password" autoComplete="current-password" value={password}
              placeholder="Digite sua senha"
              onChange={(event) => setPassword(event.target.value)} autoFocus />
            {error && <div className="login-error">{error}</div>}
            <button type="submit" disabled={busy || !password}>{busy ? 'Validando…' : 'Entrar no portal'}</button>
          </form>
          <div className="login-security">
            <span aria-hidden="true">✓</span>
            <small>Acesso protegido. Sua sessão termina ao fechar esta janela.</small>
          </div>
        </div>
      </section>
      <footer className="login-footer">IH · INTELIGÊNCIA OPERACIONAL</footer>
    </main>
  );
}
