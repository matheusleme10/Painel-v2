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
      const priceDirection = new Map();
      let previousPrice = 0;
      pricesAsc.forEach((price, index) => {
        if (price > 0 && previousPrice > 0 && Math.abs(price - previousPrice) >= 0.005) {
          changedDates.add(datesAsc[index]);
          priceDirection.set(datesAsc[index], price > previousPrice ? 'up' : 'down');
        }
        if (price > 0) previousPrice = price;
      });
      const firstPrice = pricesAsc.find((price) => price > 0) || 0;
      const lastPrice = [...pricesAsc].reverse().find((price) => price > 0) || 0;
      return { ...item, currentStreak, pausedDays, changedDates, priceDirection, firstPrice, lastPrice };
    }).sort((a, b) => b.currentStreak - a.currentStreak || b.pausedDays - a.pausedDays || a.name.localeCompare(b.name, 'pt-BR'));

    return { dates: [...datesAsc].reverse(), items: enriched, isSingleStore: stores.size <= 1 };
  }, [rows]);

  const { avgActive, avgPaused } = useMemo(() => {
    if (!dates.length || !items.length) return { avgActive: 0, avgPaused: 0 };
    let totalActive = 0;
    let totalPaused = 0;
    dates.forEach((date) => {
      items.forEach((item) => {
        const cell = item.byDate.get(date);
        if (cell) { totalActive += cell.active; totalPaused += cell.paused; }
      });
    });
    return { avgActive: totalActive / dates.length, avgPaused: totalPaused / dates.length };
  }, [dates, items]);

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
            ? 'Acompanhe, dia a dia, se cada item esteve ativo (A) ou pausado (P) e qual preço estava cadastrado. Preços em vermelho mudaram em relação ao dia anterior.'
            : 'Na visão da rede, o número ao lado do P mostra quantas unidades tinham o item pausado naquele dia. Preços em vermelho mudaram em relação ao dia anterior.'}</p>
        </div>
        <div className="daily-matrix-controls">
          <input type="search" value={query} placeholder="Buscar item ou categoria..." onChange={(event) => setQuery(event.target.value)} />
          <label><input type="checkbox" checked={onlyLongPauses} onChange={(event) => setOnlyLongPauses(event.target.checked)} /> Pausado há 2+ dias</label>
        </div>
      </div>

      {dates.length > 1 && <div className="daily-matrix-stats">
        <div className="is-active"><small>Média de itens ativos por dia</small><strong>{Math.round(avgActive)}</strong></div>
        <div className="is-paused"><small>Média de itens pausados por dia</small><strong>{Math.round(avgPaused)}</strong></div>
        <div><small>Período analisado</small><strong>{dates.length} dia(s)</strong></div>
      </div>}

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
                  const direction = item.priceDirection.get(date);
                  const cellClass = paused ? 'matrix-paused' : cell ? 'matrix-active' : 'matrix-empty';
                  return <td key={date} className={cellClass}>
                    <strong>{status}</strong>
                    <small className={changed ? 'price-changed' : ''}>
                      {price > 0 ? brl(price) : 'sem preço'}
                      {changed && direction && (
                        <span className={direction === 'up' ? 'price-arrow price-arrow-up' : 'price-arrow price-arrow-down'}>
                          {direction === 'up' ? '▲' : '▼'}
                        </span>
                      )}
                    </small>
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
