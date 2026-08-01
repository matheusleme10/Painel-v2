import { useState } from 'react';

export function FranchiseIdentityGate({ onIdentified }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/access/identify', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.detail || 'Não foi possível registrar o acesso.');
      onIdentified(payload.identity);
    } catch (reason) {
      setError(reason.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="identity-shell">
      <section className="identity-card">
        <div className="identity-mark">IH</div>
        <span className="eyebrow">IDENTIFICAÇÃO DE ACESSO</span>
        <h1>Antes de escolher sua unidade</h1>
        <p>Informe seus dados profissionais. Eles serão usados somente para auditoria e segurança do portal.</p>
        <form onSubmit={submit}>
          <label htmlFor="identity-name">Nome completo</label>
          <input id="identity-name" value={name} minLength={2} maxLength={100} required autoComplete="name"
            placeholder="Como podemos identificar você?" onChange={(event) => setName(event.target.value)} />
          <label htmlFor="identity-email">E-mail profissional</label>
          <input id="identity-email" type="email" value={email} maxLength={254} required autoComplete="email"
            placeholder="voce@empresa.com.br" onChange={(event) => setEmail(event.target.value)} />
          {error && <div className="identity-error" role="alert">{error}</div>}
          <button disabled={busy}>{busy ? 'Registrando…' : 'Continuar para as marcas'}</button>
        </form>
        <small>🔒 A sessão é protegida e o histórico fica visível apenas para administradores.</small>
      </section>
    </main>
  );
}
