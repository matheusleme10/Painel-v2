import { C } from '../../constants.js';
import { brl } from '../../utils/format.js';
import { rowsByStatus } from '../../utils/analytics.js';
import { Card } from './Card.jsx';
import { Ic } from './Icon.jsx';

const PAGE_SIZE = 7;

function StatusColumn({ title, rows, status, query }) {
  const [page, setPage] = useState(0);
  const [sortCol, setSortCol] = useState('occurrences');
  const [sortDir, setSortDir] = useState('desc');
  const filtered = useMemo(() => {
    const map = new Map();
    rows.forEach((row) => {
      const key = `${row.item}|${row.categoria}`;
      const item = map.get(key) || { item: row.item, categoria: row.categoria, occurrences: 0, priceSum: 0, priced: 0 };
      item.occurrences += 1;
      if (Number(row.precoNum) > 0) { item.priceSum += Number(row.precoNum); item.priced += 1; }
      map.set(key, item);
    });
    const needle = query.toLocaleLowerCase('pt-BR');
    const direction = sortDir === 'asc' ? 1 : -1;
    return [...map.values()].map((item) => ({ ...item, precoNum: item.priced ? item.priceSum / item.priced : 0 }))
      .filter((row) => `${row.item} ${row.categoria}`.toLocaleLowerCase('pt-BR').includes(needle))
      .sort((a, b) => sortCol === 'item' ? a.item.localeCompare(b.item, 'pt-BR') * direction : (a[sortCol] - b[sortCol]) * direction);
  }, [rows, query, sortCol, sortDir]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  useEffect(() => setPage(0), [query, rows]);
  const visible = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
  const color = status === 'Ativo' ? C.green : C.red;
  const background = status === 'Ativo' ? C.greenL : C.redL;
  return (
    <section className="status-column">
      <header><span style={{ background, color }}><Ic n={status === 'Ativo' ? 'check' : 'pause'} s={13} c={color} />{title}</span><strong>{filtered.length}</strong></header>
      <div className="status-sort-row">{[['item','Item'],['occurrences','Ocorrências'],['precoNum','Preço']].map(([column,label]) => <button type="button" key={column} className={sortCol === column ? 'active' : ''} onClick={() => { if (sortCol === column) setSortDir((current) => current === 'asc' ? 'desc' : 'asc'); else { setSortCol(column); setSortDir(column === 'item' ? 'asc' : 'desc'); } }}>{label} <span>{sortCol === column ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}</span></button>)}</div>
      <div>
        {visible.map((row, index) => (
          <article key={`${row.item}-${index}`}>
            <span><strong>{row.item}</strong><small>{row.categoria || 'Sem categoria'}</small></span>
            <b className="status-occurrences">{row.occurrences}×</b>
            <b className="status-price" style={row.precoNum > 0 ? { color } : undefined}>{row.precoNum > 0 ? brl(row.precoNum) : '—'}</b>
          </article>
        ))}
        {!visible.length && <p>Nenhum item encontrado neste status.</p>}
      </div>
      {filtered.length > PAGE_SIZE && (
        <footer className="status-pagination">
          <button disabled={page === 0} onClick={() => setPage((current) => current - 1)}>Anterior</button>
          <span>{page + 1} de {pages}</span>
          <button disabled={page + 1 >= pages} onClick={() => setPage((current) => current + 1)}>Próxima</button>
        </footer>
      )}
    </section>
  );
}

export function StatusItemsPanel({ rows, title = 'Itens do cardápio' }) {
  const [query, setQuery] = useState('');
  const active = rowsByStatus(rows, 'Ativo');
  const paused = rowsByStatus(rows, 'Pausado');
  return (
    <Card>
      <div className="status-panel-title"><strong>{title}</strong><small>7 itens por página</small></div>
      <div className="status-search">
        <Ic n="search" s={14} c={C.muted} />
        <input value={query} onChange={(event) => setQuery(event.target.value)}
          placeholder="Pesquisar item ou categoria…" aria-label="Pesquisar itens ativos e pausados" />
      </div>
      <div className="status-columns">
        <StatusColumn title="Ativos" rows={active} status="Ativo" query={query} />
        <StatusColumn title="Pausados" rows={paused} status="Pausado" query={query} />
      </div>
    </Card>
  );
}
import { useEffect, useMemo, useState } from 'react';
