import { useMemo, useState } from 'react';
import { C } from '../constants.js';
import { Card } from '../components/ui/Card.jsx';
import { Kpi } from '../components/ui/Kpi.jsx';
import { Pill } from '../components/ui/Pill.jsx';
import { brl } from '../utils/format.js';
import { DailyItemsMatrix } from '../components/ui/DailyItemsMatrix.jsx';
import { DraftPriceField } from '../components/ui/DraftPriceField.jsx';

const PAGE_SIZE = 10;

const normalize = (value) => String(value || '')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase('pt-BR');

export function ItemsOverviewPage({ rows, onSetDraft, onSavePrice }) {
  const [query, setQuery] = useState('');
  const [storeQuery, setStoreQuery] = useState('');
  const [storeOpen, setStoreOpen] = useState(false);
  const [status, setStatus] = useState('all');
  const [sortCol, setSortCol] = useState('paused');
  const [sortDir, setSortDir] = useState('desc');
  const [page, setPage] = useState(0);
  const [applyNetworkWide, setApplyNetworkWide] = useState(false);
  const [priceQuery, setPriceQuery] = useState('');
  const [priceCategory, setPriceCategory] = useState('all');
  const [priceOddOnly, setPriceOddOnly] = useState(false);
  const [pricePage, setPricePage] = useState(0);

  const stores = useMemo(() => [...new Set(rows.map((row) => row.loja).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR')), [rows]);
  const scopedRows = useMemo(() => {
    const term = normalize(storeQuery);
    return term ? rows.filter((row) => normalize(row.loja).includes(term)) : rows;
  }, [rows, storeQuery]);
  const storeSuggestions = useMemo(() => {
    const term = normalize(storeQuery);
    if (!term) return [];
    return stores.filter((store) => normalize(store).includes(term)).slice(0, 8);
  }, [stores, storeQuery]);

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
        pricedCount: 0,
        priceSum: 0,
        minPrice: 0,
        maxPrice: 0,
        manual: false,
        stores: new Set(),
        pausedStores: new Set(),
        dates: new Set(),
      };
      item.stores.add(row.loja);
      if (row.dia) item.dates.add(row.dia);
      if (row.status === 'Ativo') item.active += 1;
      if (row.status === 'Pausado') {
        item.paused += 1;
        item.pausedStores.add(row.loja);
      }
      if (Number(row.precoNum) > 0) {
        const price = Number(row.precoNum);
        item.pricedCount += 1;
        item.priceSum += price;
        item.minPrice = item.minPrice ? Math.min(item.minPrice, price) : price;
        item.maxPrice = Math.max(item.maxPrice, price);
        if (row.status === 'Pausado') item.risk += price;
        if (row.precoManual) item.manual = true;
      }
      map.set(key, item);
    });
    return [...map.values()].sort((a, b) => b.paused - a.paused || a.name.localeCompare(b.name, 'pt-BR'));
  }, [scopedRows]);

  // Qualquer item sem preço em nenhuma ocorrência — ativo ou pausado, tanto
  // faz — entra aqui pra poder receber um valor local (não salvo).
  const editableItems = useMemo(() => [...items]
    .sort((a, b) => (b.active + b.paused) - (a.active + a.paused)), [items]);

  // "Preço esquisito" = mesmo item com preços bem diferentes entre unidades
  // (provável erro de cadastro) — ajuda a achar rápido sem precisar olhar
  // linha por linha numa lista com centenas de produtos.
  const isOddPrice = (item) => item.pricedCount > 0 && item.minPrice > 0 && item.maxPrice / item.minPrice >= 1.15;

  const priceCategories = useMemo(() => (
    [...new Set(editableItems.map((item) => item.category || 'Sem categoria'))].sort((a, b) => a.localeCompare(b, 'pt-BR'))
  ), [editableItems]);

  const filteredEditableItems = useMemo(() => {
    const term = normalize(priceQuery);
    return editableItems.filter((item) => {
      const matchesText = !term || normalize(`${item.name} ${item.category || ''}`).includes(term);
      const matchesCategory = priceCategory === 'all' || (item.category || 'Sem categoria') === priceCategory;
      const matchesOdd = !priceOddOnly || isOddPrice(item);
      return matchesText && matchesCategory && matchesOdd;
    });
  }, [editableItems, priceQuery, priceCategory, priceOddOnly]);

  const pricePages = Math.max(1, Math.ceil(filteredEditableItems.length / PAGE_SIZE));
  const currentPricePage = Math.min(pricePage, pricePages - 1);
  const paginatedEditableItems = filteredEditableItems.slice(currentPricePage * PAGE_SIZE, currentPricePage * PAGE_SIZE + PAGE_SIZE);

  function changePriceFilter(action) {
    action();
    setPricePage(0);
  }

  const visible = useMemo(() => {
    const term = normalize(query);
    return items.filter((item) => {
      const matchesText = !term || normalize(`${item.name} ${item.category} ${[...item.stores].join(' ')}`).includes(term);
      const matchesStatus = status === 'all'
        || (status === 'paused' ? item.paused > 0 : item.active > 0);
      return matchesText && matchesStatus;
    });
  }, [items, query, status]);
  const sortedVisible = useMemo(() => {
    const direction = sortDir === 'asc' ? 1 : -1;
    return [...visible].sort((a, b) => {
      const values = { name: [a.name, b.name], category: [a.category, b.category], active: [a.active, b.active], paused: [a.paused, b.paused], affected: [a.pausedStores.size, b.pausedStores.size], risk: [a.risk, b.risk] }[sortCol];
      return typeof values[0] === 'number' ? (values[0] - values[1]) * direction : String(values[0] || '').localeCompare(String(values[1] || ''), 'pt-BR') * direction;
    });
  }, [visible, sortCol, sortDir]);

  const totalPaused = items.reduce((sum, item) => sum + item.paused, 0);
  const totalActive = items.reduce((sum, item) => sum + item.active, 0);
  const totalRisk = items.reduce((sum, item) => sum + item.risk, 0);
  const pages = Math.max(1, Math.ceil(sortedVisible.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages - 1);
  const paginated = sortedVisible.slice(currentPage * PAGE_SIZE, currentPage * PAGE_SIZE + PAGE_SIZE);

  function toggleSort(column) {
    if (sortCol === column) setSortDir((current) => current === 'asc' ? 'desc' : 'asc');
    else { setSortCol(column); setSortDir(['name', 'category'].includes(column) ? 'asc' : 'desc'); }
    setPage(0);
  }

  const SortTh = ({ column, children }) => <th><button type="button" className={sortCol === column ? 'items-sort active' : 'items-sort'} onClick={() => toggleSort(column)}>{children}<span>{sortCol === column ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}</span></button></th>;

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
            <span className="items-store-search"><input type="search" value={storeQuery} placeholder="Pesquisar uma unidade..." onFocus={() => setStoreOpen(true)} onBlur={() => setTimeout(() => setStoreOpen(false), 120)} onChange={(event) => { setStoreQuery(event.target.value); setStoreOpen(true); setPage(0); }} />
              {storeOpen && storeQuery && <span className="items-store-suggestions">{storeSuggestions.map((store) => <button type="button" key={store} onMouseDown={() => { setStoreQuery(store); setStoreOpen(false); setPage(0); }}>{store}</button>)}{!storeSuggestions.length && <small>Nenhuma unidade encontrada.</small>}</span>}
            </span>
            {storeQuery && <button type="button" onClick={() => { setStoreQuery(''); setPage(0); }}>Limpar unidade</button>}
          </div>
          <input
            type="search"
            value={query}
            placeholder="Pesquisar produto ou categoria..."
            onChange={(event) => changeFilter(() => setQuery(event.target.value))}
          />
          <div className="items-status-chips">{[['all','Todos'],['active','Ativos'],['paused','Pausados']].map(([value,label]) => <button type="button" key={value} className={status === value ? 'active' : ''} onClick={() => changeFilter(() => setStatus(value))}>{label}</button>)}</div>
        </div>
        <div className="items-table-wrap">
          <table className="items-table">
            <thead>
              <tr>
                <SortTh column="name">Produto</SortTh>
                <SortTh column="category">Categoria</SortTh>
                <SortTh column="active">Ativo</SortTh>
                <SortTh column="paused">Pausou no período</SortTh>
                <SortTh column="affected">Unidades afetadas</SortTh>
                <SortTh column="risk">Risco</SortTh>
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
      {onSetDraft && editableItems.length > 0 && (
        <Card className="unpriced-items-card">
          <div className="paused-card-heading">
            <div><span className="eyebrow">AJUSTE DE PREÇOS</span><h2>Corrigir preço dos itens</h2></div>
          </div>
          <div className="draft-price-toolbar">
            <label className="draft-price-toggle">
              <input type="checkbox" checked={applyNetworkWide} onChange={(event) => setApplyNetworkWide(event.target.checked)} />
              Aplicar preço em todas as unidades
            </label>
          </div>
          <p className="draft-price-note">
            Digite o valor correto e clique em Salvar. O ajuste tem prioridade sobre a planilha e permanece após novos uploads.
          </p>
          <div className="items-toolbar price-adjust-toolbar">
            <input
              type="search"
              value={priceQuery}
              placeholder="Pesquisar produto ou categoria..."
              onChange={(event) => changePriceFilter(() => setPriceQuery(event.target.value))}
            />
            <select value={priceCategory} onChange={(event) => changePriceFilter(() => setPriceCategory(event.target.value))} aria-label="Filtrar por categoria">
              <option value="all">Todas as categorias</option>
              {priceCategories.map((category) => <option key={category} value={category}>{category}</option>)}
            </select>
            <label className="draft-price-toggle">
              <input type="checkbox" checked={priceOddOnly} onChange={(event) => changePriceFilter(() => setPriceOddOnly(event.target.checked))} />
              Só preços que variam entre lojas
            </label>
          </div>
          <div className="unpriced-items-list">
            {paginatedEditableItems.map((item) => (
              <article key={item.name} className="unpriced-item-row">
                <span>
                  <strong>{item.name}</strong>
                  <small>{item.category || 'Sem categoria'} · {item.stores.size} unidade(s)</small>
                  {isOddPrice(item) && <em className="price-odd-badge">Varia de {brl(item.minPrice)} a {brl(item.maxPrice)} entre lojas</em>}
                </span>
                <span><b>{item.active}× ativo</b><small>{item.paused}× pausado</small></span>
                <DraftPriceField itemName={item.name} category={item.category} stores={item.stores} isAdmin networkWide={applyNetworkWide} onChange={onSetDraft} onSave={onSavePrice} currentPrice={item.pricedCount ? item.priceSum / item.pricedCount : 0} compact />
              </article>
            ))}
            {!paginatedEditableItems.length && <div className="empty-state">Nenhum item encontrado neste filtro.</div>}
          </div>
          {pricePages > 1 && (
            <div className="forneria-pagination">
              <button disabled={currentPricePage === 0} onClick={() => setPricePage((value) => value - 1)}>Anterior</button>
              <span>{currentPricePage + 1} de {pricePages}</span>
              <button disabled={currentPricePage + 1 >= pricePages} onClick={() => setPricePage((value) => value + 1)}>Próxima</button>
            </div>
          )}
        </Card>
      )}
    </section>
  );
}
