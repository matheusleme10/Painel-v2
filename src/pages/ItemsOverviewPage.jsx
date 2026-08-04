import { useMemo, useState } from 'react';
import { C } from '../constants.js';
import { Card } from '../components/ui/Card.jsx';
import { Kpi } from '../components/ui/Kpi.jsx';
import { Pill } from '../components/ui/Pill.jsx';
import { brl } from '../utils/format.js';
import { DailyItemsMatrix } from '../components/ui/DailyItemsMatrix.jsx';

const PAGE_SIZE = 10;

const normalize = (value) => String(value || '')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase('pt-BR');

export function ItemsOverviewPage({ rows }) {
  const [query, setQuery] = useState('');
  const [storeQuery, setStoreQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(0);

  const stores = useMemo(() => [...new Set(rows.map((row) => row.loja).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR')), [rows]);
  const scopedRows = useMemo(() => {
    const term = normalize(storeQuery);
    return term ? rows.filter((row) => normalize(row.loja).includes(term)) : rows;
  }, [rows, storeQuery]);

  const items = useMemo(() => {
    const map = new Map();
    scopedRows.forEach((row) => {
      if (!row.item) return;
      const key = normalize(row.item);
      const item = map.get(key) || {
        name: row.item,
        category: row.categoria,
        active: 0,
        paused: 0,
        risk: 0,
        stores: new Set(),
        pausedStores: new Set(),
        dates: new Set(),
      };
      item.stores.add(row.loja);
      if (row.dia) item.dates.add(row.dia);
      if (row.status === 'Ativo') item.active += 1;
      if (row.status === 'Pausado') {
        item.paused += 1;
        item.risk += Number(row.precoNum) || 0;
        item.pausedStores.add(row.loja);
      }
      map.set(key, item);
    });
    return [...map.values()].sort((a, b) => b.paused - a.paused || a.name.localeCompare(b.name, 'pt-BR'));
  }, [scopedRows]);

  const visible = useMemo(() => {
    const term = normalize(query);
    return items.filter((item) => {
      const matchesText = !term || normalize(`${item.name} ${item.category} ${[...item.stores].join(' ')}`).includes(term);
      const matchesStatus = status === 'all'
        || (status === 'paused' ? item.paused > 0 : item.active > 0);
      return matchesText && matchesStatus;
    });
  }, [items, query, status]);

  const totalPaused = items.reduce((sum, item) => sum + item.paused, 0);
  const totalActive = items.reduce((sum, item) => sum + item.active, 0);
  const totalRisk = items.reduce((sum, item) => sum + item.risk, 0);
  const pages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages - 1);
  const paginated = visible.slice(currentPage * PAGE_SIZE, currentPage * PAGE_SIZE + PAGE_SIZE);

  function changeFilter(action) {
    action();
    setPage(0);
  }

  return (
    <section className="items-overview">
      <div className="network-hero">
        <div>
          <span className="eyebrow">CATÁLOGO OPERACIONAL</span>
          <h1>Itens da rede</h1>
          <p>Uma única visão para pesquisar produtos, categorias, marcas e unidades.</p>
        </div>
      </div>
      <div className="network-kpis">
        <Kpi label="Produtos identificados" value={items.length} icon="item" accent={C.blue} accentBg={C.blueL} />
        <Kpi label="Ocorrências ativas" value={totalActive} icon="check" accent={C.green} accentBg={C.greenL} />
        <Kpi label="Ocorrências pausadas" value={totalPaused} icon="pause" accent={C.red} accentBg={C.redL} />
        <Kpi label="Receita observada em risco" value={brl(totalRisk)} icon="money" accent={C.orange} accentBg={C.orangeL} />
      </div>
      <Card>
        <div className="items-toolbar">
          <div className="items-store-filter">
            <input type="search" value={storeQuery} list="items-store-options" placeholder="Filtrar por unidade..." onChange={(event) => { setStoreQuery(event.target.value); setPage(0); }} />
            <datalist id="items-store-options">{stores.map((store) => <option key={store} value={store} />)}</datalist>
            {storeQuery && <button type="button" onClick={() => { setStoreQuery(''); setPage(0); }}>Limpar unidade</button>}
          </div>
          <input
            type="search"
            value={query}
            placeholder="Pesquisar produto ou categoria..."
            onChange={(event) => changeFilter(() => setQuery(event.target.value))}
          />
          <select value={status} onChange={(event) => changeFilter(() => setStatus(event.target.value))}>
            <option value="all">Todos os status</option>
            <option value="active">Com ocorrência ativa</option>
            <option value="paused">Com ocorrência pausada</option>
          </select>
        </div>
        <div className="items-table-wrap">
          <table className="items-table">
            <thead>
              <tr>
                <th>Produto</th>
                <th>Categoria</th>
                <th>Ativo</th>
                <th>Pausou no período</th>
                <th>Marcas/unidades afetadas</th>
                <th>Risco</th>
              </tr>
            </thead>
            <tbody>
              {paginated.map((item) => (
                <tr key={item.name}>
                  <td><strong>{item.name}</strong></td>
                  <td>{item.category || 'Sem categoria'}</td>
                  <td><Pill color={C.green} bg={C.greenL}>{item.active}×</Pill></td>
                  <td><Pill color={C.red} bg={C.redL}>{item.paused}×</Pill></td>
                  <td>{item.pausedStores.size} de {item.stores.size}</td>
                  <td>{item.risk > 0 ? brl(item.risk) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!paginated.length && <div className="empty-state">Nenhum item encontrado neste filtro.</div>}
        </div>
        {pages > 1 && (
          <div className="forneria-pagination">
            <button disabled={currentPage === 0} onClick={() => setPage((value) => value - 1)}>Anterior</button>
            <span>{currentPage + 1} de {pages}</span>
            <button disabled={currentPage + 1 >= pages} onClick={() => setPage((value) => value + 1)}>Próxima</button>
          </div>
        )}
      </Card>
      <DailyItemsMatrix rows={scopedRows} title={storeQuery ? `Evolução diária · ${storeQuery}` : 'Evolução diária dos itens da rede'} />
    </section>
  );
}
