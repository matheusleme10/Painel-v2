import { useMemo, useState } from 'react';
import { brl, formatDateBR } from '../../utils/format.js';

const normalize = (value) => String(value || '')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase('pt-BR');

const keyOf = (row) => `${normalize(row.item)}::${normalize(row.categoria)}`;

export function DailyItemsMatrix({ rows, title = 'Histórico diário dos itens' }) {
  const [query, setQuery] = useState('');
  const [onlyLongPauses, setOnlyLongPauses] = useState(false);
  const [sortCol, setSortCol] = useState('streak');
  const [sortDir, setSortDir] = useState('desc');

  const { dates, items, isSingleStore } = useMemo(() => {
    const datesAsc = [...new Set(rows.map((row) => row.dia).filter(Boolean))].sort();
    const stores = new Set(rows.map((row) => row.loja).filter(Boolean));
    const map = new Map();

    rows.forEach((row) => {
      if (!row.item || !row.dia) return;
      const key = keyOf(row);
      const item = map.get(key) || {
        key,
        name: row.item,
        category: row.categoria || 'Sem categoria',
        byDate: new Map(),
      };
      const cell = item.byDate.get(row.dia) || { active: 0, paused: 0, total: 0, prices: [] };
      cell.total += 1;
      if (row.status === 'Pausado') cell.paused += 1;
      if (row.status === 'Ativo') cell.active += 1;
      if (Number(row.precoNum) > 0) cell.prices.push(Number(row.precoNum));
      item.byDate.set(row.dia, cell);
      map.set(key, item);
    });

    const enriched = [...map.values()].map((item) => {
      let currentStreak = 0;
      for (let index = datesAsc.length - 1; index >= 0; index -= 1) {
        if ((item.byDate.get(datesAsc[index])?.paused || 0) > 0) currentStreak += 1;
        else break;
      }
      const pausedDays = datesAsc.filter((date) => (item.byDate.get(date)?.paused || 0) > 0).length;
      const pricesAsc = datesAsc.map((date) => {
        const prices = item.byDate.get(date)?.prices || [];
        return prices.length ? prices.reduce((sum, price) => sum + price, 0) / prices.length : 0;
      });
      const changedDates = new Set();
      let previousPrice = 0;
      pricesAsc.forEach((price, index) => {
        if (price > 0 && previousPrice > 0 && Math.abs(price - previousPrice) >= 0.005) changedDates.add(datesAsc[index]);
        if (price > 0) previousPrice = price;
      });
      const firstPrice = pricesAsc.find((price) => price > 0) || 0;
      const lastPrice = [...pricesAsc].reverse().find((price) => price > 0) || 0;
      return { ...item, currentStreak, pausedDays, changedDates, firstPrice, lastPrice };
    }).sort((a, b) => b.currentStreak - a.currentStreak || b.pausedDays - a.pausedDays || a.name.localeCompare(b.name, 'pt-BR'));

    return { dates: [...datesAsc].reverse(), items: enriched, isSingleStore: stores.size <= 1 };
  }, [rows]);

  const visible = useMemo(() => {
    const term = normalize(query);
    const filtered = items.filter((item) => {
      if (onlyLongPauses && item.currentStreak < 2) return false;
      return !term || normalize(`${item.name} ${item.category}`).includes(term);
    });
    const direction = sortDir === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      if (sortCol === 'product') return a.name.localeCompare(b.name, 'pt-BR') * direction;
      if (sortCol === 'streak') return (a.currentStreak - b.currentStreak || a.pausedDays - b.pausedDays) * direction;
      return ((a.byDate.get(sortCol)?.paused || 0) - (b.byDate.get(sortCol)?.paused || 0)) * direction;
    });
  }, [items, onlyLongPauses, query, sortCol, sortDir]);

  function toggleSort(column) {
    if (sortCol === column) setSortDir((current) => current === 'asc' ? 'desc' : 'asc');
    else { setSortCol(column); setSortDir(column === 'product' ? 'asc' : 'desc'); }
  }

  const sortMark = (column) => sortCol === column ? (sortDir === 'asc' ? '▲' : '▼') : '⇅';

  return (
    <section className="daily-matrix-card">
      <div className="daily-matrix-heading">
        <div>
          <span className="eyebrow">STATUS E PREÇO POR DATA</span>
          <h2>{title}</h2>
          <p>{isSingleStore
            ? 'P = pausado, A = ativo. O preço em vermelho mudou em relação ao registro anterior.'
            : 'Na visão da rede, P indica quantas unidades tiveram o item pausado naquele dia.'}</p>
        </div>
        <div className="daily-matrix-controls">
          <input type="search" value={query} placeholder="Buscar item ou categoria..." onChange={(event) => setQuery(event.target.value)} />
          <label><input type="checkbox" checked={onlyLongPauses} onChange={(event) => setOnlyLongPauses(event.target.checked)} /> Pausado há 2+ dias</label>
        </div>
      </div>

      <div className="daily-matrix-wrap">
        <table className="daily-matrix">
          <thead><tr>
            <th><button className="matrix-sort" type="button" onClick={() => toggleSort('product')}>Produto <span>{sortMark('product')}</span></button></th>
            <th><button className="matrix-sort" type="button" onClick={() => toggleSort('streak')}>Dias com pausa <span>{sortMark('streak')}</span></button></th>
            {dates.map((date) => <th key={date}><button className="matrix-sort" type="button" onClick={() => toggleSort(date)}>{formatDateBR(date)} <span>{sortMark(date)}</span></button></th>)}
          </tr></thead>
          <tbody>
            {visible.map((item) => (
              <tr key={item.key}>
                <td><strong>{item.name}</strong><small>{item.category}</small></td>
                <td>
                  <b className={item.currentStreak >= 2 ? 'pause-streak is-long' : 'pause-streak'}>{item.currentStreak} consecutivo(s)</b>
                  <small>{item.pausedDays} no período</small>
                </td>
                {dates.map((date) => {
                  const cell = item.byDate.get(date);
                  const prices = cell?.prices || [];
                  const price = prices.length ? prices.reduce((sum, value) => sum + value, 0) / prices.length : 0;
                  const paused = cell?.paused || 0;
                  const status = !cell ? '—' : paused > 0 ? (isSingleStore ? 'P' : `P ${paused}/${cell.total}`) : 'A';
                  const changed = item.changedDates.has(date);
                  const cellClass = `${paused ? 'matrix-paused' : cell ? 'matrix-active' : 'matrix-empty'}${changed ? ' matrix-price-changed' : ''}`;
                  return <td key={date} className={cellClass}>
                    <strong>{status}</strong>
                    <small className={changed ? 'price-changed' : ''}>{price > 0 ? brl(price) : 'sem preço'}</small>
                  </td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
        {!visible.length && <div className="empty-state">Nenhum item encontrado nesta análise.</div>}
      </div>
      <div className="daily-matrix-legend"><span><i className="legend-active" /> Ativo</span><span><i className="legend-paused" /> Pausado</span><span><i className="legend-price" /> Preço alterado</span><small>Valores são preços cadastrados; não representam vendas realizadas.</small></div>
    </section>
  );
}
