import { useMemo, useState } from 'react';
import { Card } from './Card.jsx';
import { DraftPriceField } from './DraftPriceField.jsx';
import { brl } from '../../utils/format.js';
import { classifyPriceStatus } from '../../utils/price-status.js';

const DIACRITICS = new RegExp('[' + String.fromCharCode(0x0300) + '-' + String.fromCharCode(0x036f) + ']', 'g');
const normalize = (value) => String(value || '')
  .normalize('NFD').replace(DIACRITICS, '')
  .toLocaleLowerCase('pt-BR');

const PAGE_SIZE = 10;

const STATUS_FILTERS = [
  { value: 'all', label: 'Todos' },
  { value: 'missing', label: 'Sem preço' },
  { value: 'suspicious', label: 'Verificar preço' },
  { value: 'ok', label: 'Preço OK' },
];

// Tabela "AJUSTE DE PREÇOS" compartilhada entre admin (rede inteira) e
// franqueado (a própria unidade). O objetivo é achar rápido o item com
// problema e corrigir — por isso a classificação de situação do preço e os
// filtros rápidos ficam centralizados aqui, num único lugar.
export function PriceAdjustTable({
  items,
  isAdmin = false,
  onSetDraft,
  onSavePrice,
  helpText = 'Digite o valor correto e clique em Salvar. O ajuste tem prioridade sobre a planilha e permanece após novos uploads.',
}) {
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [oddOnly, setOddOnly] = useState(false);
  const [networkWide, setNetworkWide] = useState(false);
  const [page, setPage] = useState(0);

  const enriched = useMemo(() => items.map((item) => {
    const averagePrice = item.pricedCount ? item.priceSum / item.pricedCount : 0;
    const status = classifyPriceStatus({ pricedCount: item.pricedCount, averagePrice });
    const oddPrice = Boolean(item.pricedCount > 0 && item.minPrice > 0 && item.maxPrice > 0 && item.maxPrice / item.minPrice >= 1.15);
    return { ...item, averagePrice, status, oddPrice };
  }), [items]);

  const totals = useMemo(() => enriched.reduce((sum, item) => ({
    active: sum.active + (item.active || 0),
    paused: sum.paused + (item.paused || 0),
  }), { active: 0, paused: 0 }), [enriched]);
  const predominant = totals.paused > totals.active ? 'paused' : 'active';

  const categories = useMemo(() => (
    [...new Set(enriched.map((item) => item.category || 'Sem categoria'))].sort((a, b) => a.localeCompare(b, 'pt-BR'))
  ), [enriched]);

  const statusCounts = useMemo(() => enriched.reduce((counts, item) => {
    counts[item.status.key] = (counts[item.status.key] || 0) + 1;
    return counts;
  }, {}), [enriched]);

  const filtered = useMemo(() => {
    const term = normalize(query);
    return enriched.filter((item) => {
      const matchesText = !term || normalize(`${item.name} ${item.category || ''}`).includes(term);
      const matchesCategory = categoryFilter === 'all' || (item.category || 'Sem categoria') === categoryFilter;
      const matchesStatus = statusFilter === 'all' || item.status.key === statusFilter;
      const matchesOdd = !oddOnly || item.oddPrice;
      return matchesText && matchesCategory && matchesStatus && matchesOdd;
    });
  }, [enriched, query, categoryFilter, statusFilter, oddOnly]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages - 1);
  const paginated = filtered.slice(currentPage * PAGE_SIZE, currentPage * PAGE_SIZE + PAGE_SIZE);

  function changeFilter(action) {
    action();
    setPage(0);
  }

  if (!items.length) return null;

  return (
    <Card className="price-adjust-card">
      <div className="paused-card-heading">
        <div><span className="eyebrow">AJUSTE DE PREÇOS</span><h2>Corrigir preço dos itens</h2></div>
        <div className="price-status-summary">
          <b className={predominant === 'active' ? 'is-active' : 'is-paused'}>
            {predominant === 'active' ? `${totals.active} ativos` : `${totals.paused} pausados`}
          </b>
          <small>{predominant === 'active' ? `${totals.paused} pausados` : `${totals.active} ativos`}</small>
        </div>
      </div>
      <p className="draft-price-note">{helpText}</p>
      <div className="price-status-chips">
        {STATUS_FILTERS.map((option) => (
          <button
            type="button"
            key={option.value}
            className={statusFilter === option.value ? 'active' : ''}
            onClick={() => changeFilter(() => setStatusFilter(option.value))}
          >
            {option.label}
            {option.value !== 'all' && statusCounts[option.value] ? ` (${statusCounts[option.value]})` : ''}
          </button>
        ))}
      </div>
      <div className="items-toolbar price-adjust-toolbar">
        <input
          type="search"
          value={query}
          placeholder="Pesquisar produto ou categoria..."
          onChange={(event) => changeFilter(() => setQuery(event.target.value))}
        />
        <select value={categoryFilter} onChange={(event) => changeFilter(() => setCategoryFilter(event.target.value))} aria-label="Filtrar por categoria">
          <option value="all">Todas as categorias</option>
          {categories.map((category) => <option key={category} value={category}>{category}</option>)}
        </select>
        {isAdmin && (
          <label className="draft-price-toggle">
            <input type="checkbox" checked={oddOnly} onChange={(event) => changeFilter(() => setOddOnly(event.target.checked))} />
            Só preços que variam entre lojas
          </label>
        )}
        {isAdmin && (
          <label className="draft-price-toggle">
            <input type="checkbox" checked={networkWide} onChange={(event) => setNetworkWide(event.target.checked)} />
            Aplicar preço em todas as unidades
          </label>
        )}
      </div>
      <div className="price-adjust-table-wrap">
        <table className="price-adjust-table">
          <thead>
            <tr>
              <th>Item</th>
              <th>Categoria</th>
              <th>Status</th>
              <th>Preço atual</th>
              <th>Situação</th>
              <th>Ação</th>
            </tr>
          </thead>
          <tbody>
            {paginated.map((item) => (
              <tr key={item.name}>
                <td className="price-adjust-name">{item.name}</td>
                <td>{item.category || 'Sem categoria'}</td>
                <td>
                  <span className="price-adjust-status">
                    {item.active > 0 && <em className="badge-active">Ativo{item.active > 1 ? ` ×${item.active}` : ''}</em>}
                    {item.paused > 0 && <em className="badge-paused">Pausado{item.paused > 1 ? ` ×${item.paused}` : ''}</em>}
                  </span>
                </td>
                <td className="price-adjust-price">
                  {item.pricedCount ? brl(item.averagePrice) : '—'}
                  {item.oddPrice && <small className="price-adjust-odd-hint">{brl(item.minPrice)} a {brl(item.maxPrice)}</small>}
                </td>
                <td><em className={`badge-${item.status.badgeClass}`}>{item.status.label}</em></td>
                <td className="price-adjust-action">
                  <DraftPriceField
                    itemName={item.name}
                    category={item.category}
                    stores={item.stores}
                    isAdmin={isAdmin}
                    networkWide={isAdmin && networkWide}
                    onChange={onSetDraft}
                    onSave={onSavePrice}
                    currentPrice={item.pricedCount ? item.averagePrice : 0}
                    compact
                  />
                </td>
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
  );
}
