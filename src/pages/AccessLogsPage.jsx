import { useEffect, useMemo, useState } from 'react';

function formatDate(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
}

export function AccessLogsPage() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/access-logs?limit=250', { credentials: 'same-origin', cache: 'no-store' });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.detail || 'Falha ao consultar os acessos.');
      setEvents(payload.events || []);
    } catch (reason) {
      setError(reason.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);
  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('pt-BR');
    if (!needle) return events;
    return events.filter((event) => [event.name, event.email, event.store, event.brandId]
      .some((value) => String(value || '').toLocaleLowerCase('pt-BR').includes(needle)));
  }, [events, query]);
  const uniquePeople = new Set(events.map((event) => event.email)).size;
  const uniqueStores = new Set(events.map((event) => event.store).filter(Boolean)).size;

  return (
    <section className="access-page">
      <header className="page-hero access-hero">
        <div><span className="eyebrow">AUDITORIA DO PORTAL</span><h1>Log de acessos</h1>
          <p>Acompanhe quem entrou e qual unidade foi selecionada.</p></div>
        <button type="button" onClick={load} disabled={loading}>↻ Atualizar</button>
      </header>
      <div className="access-kpis">
        <article><small>Pessoas identificadas</small><strong>{uniquePeople}</strong></article>
        <article><small>Eventos registrados</small><strong>{events.length}</strong></article>
        <article><small>Unidades acessadas</small><strong>{uniqueStores}</strong></article>
        <article><small>Último acesso</small><strong className="access-date">{formatDate(events[0]?.accessedAt)}</strong></article>
      </div>
      <section className="access-table-card">
        <div className="access-toolbar">
          <input value={query} onChange={(event) => setQuery(event.target.value)}
            placeholder="Pesquisar nome, e-mail, marca ou unidade…" />
          <span>{filtered.length} registro(s)</span>
        </div>
        {error && <div className="identity-error">{error}</div>}
        {loading ? <div className="access-empty">Carregando acessos…</div> : (
          <div className="access-table-wrap"><table className="access-table">
            <thead><tr><th>Data e hora</th><th>Pessoa</th><th>Evento</th><th>Marca / unidade</th></tr></thead>
            <tbody>{filtered.map((event) => (
              <tr key={event.id || `${event.accessedAt}-${event.email}-${event.store || ''}`}>
                <td>{formatDate(event.accessedAt)}</td>
                <td><strong>{event.name}</strong><small>{event.email}</small></td>
                <td><span className={`access-action ${event.action}`}>{event.action === 'unit_selected' ? 'Unidade selecionada' : 'Login identificado'}</span></td>
                <td><strong>{event.store || '—'}</strong><small>{event.brandId || ''}</small></td>
              </tr>
            ))}</tbody>
          </table>{!filtered.length && <div className="access-empty">Nenhum acesso encontrado.</div>}</div>
        )}
      </section>
    </section>
  );
}
