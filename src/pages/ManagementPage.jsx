import { useEffect, useMemo, useState } from 'react';
import { AccessLogsPage } from './AccessLogsPage.jsx';

function parseCsv(text) {
  const rows = []; let row = []; let cell = ''; let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]; const next = text[index + 1];
    if (char === '"' && quoted && next === '"') { cell += '"'; index += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === ',' && !quoted) { row.push(cell); cell = ''; }
    else if ((char === '\n' || char === '\r') && !quoted) { if (char === '\r' && next === '\n') index += 1; row.push(cell); if (row.some((value) => value.trim())) rows.push(row); row = []; cell = ''; }
    else cell += char;
  }
  row.push(cell); if (row.some((value) => value.trim())) rows.push(row);
  return rows;
}

function FeedbackTable() {
  const [data, setData] = useState([]); const [error, setError] = useState(''); const [loading, setLoading] = useState(true); const [query, setQuery] = useState(''); const [configured, setConfigured] = useState(true);
  async function load() {
    setLoading(true); setError('');
    try { const response = await fetch('/api/feedback', { credentials: 'same-origin', cache: 'no-store' }); if (response.status === 503) { setConfigured(false); return; } if (!response.ok) throw new Error('Não foi possível consultar o Google Sheets.'); setConfigured(true); setData(parseCsv(await response.text())); }
    catch (reason) { setError(`${reason.message} Confira se a planilha foi publicada como CSV.`); } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);
  const headers = data[0] || [];
  const rows = useMemo(() => { const needle = query.toLocaleLowerCase('pt-BR'); return data.slice(1).filter((row) => !needle || row.join(' ').toLocaleLowerCase('pt-BR').includes(needle)); }, [data, query]);
  if (!configured) return <div className="feedback-setup"><strong>Integração aguardando o Google Sheets</strong><p>Depois de criar o formulário, publique a planilha de respostas como CSV e configure na Vercel:</p><code>FEEDBACK_SHEET_CSV_URL</code><small>Marque a variável como Sensitive. A URL será lida somente pelo backend e ficará oculta no navegador.</small></div>;
  return <section className="feedback-admin-card"><div className="feedback-toolbar"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Pesquisar resposta, pessoa, unidade ou nota..." /><span>{rows.length} resposta(s)</span><button type="button" onClick={load}>Atualizar</button></div>{error && <div className="identity-error">{error}</div>}{loading ? <div className="access-empty">Carregando feedbacks...</div> : <div className="feedback-table-wrap"><table><thead><tr>{headers.map((header, index) => <th key={`${header}-${index}`}>{header || `Campo ${index + 1}`}</th>)}</tr></thead><tbody>{rows.map((row, rowIndex) => <tr key={rowIndex}>{headers.map((_, index) => <td key={index}>{row[index] || '—'}</td>)}</tr>)}</tbody></table>{!rows.length && <div className="access-empty">Nenhum feedback encontrado.</div>}</div>}</section>;
}

export function ManagementPage() {
  const [section, setSection] = useState('emails');
  return <section className="management-page"><header className="page-hero"><span className="eyebrow">GESTÃO DO PORTAL</span><h1>Gestão</h1><p>Permissões de e-mail, auditoria de acessos e opinião dos franqueados em um só lugar.</p></header><nav className="management-tabs">{[['emails','1 · Gestão de e-mails'],['logs','2 · Logs de acesso'],['feedback','3 · Feedbacks recebidos']].map(([id,label]) => <button type="button" key={id} className={section === id ? 'active' : ''} onClick={() => setSection(id)}>{label}</button>)}</nav>{section === 'feedback' ? <FeedbackTable /> : <AccessLogsPage section={section} embedded />}</section>;
}
