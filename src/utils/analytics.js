import { pct } from './format.js';

export function rowsByStatus(rows, status) {
  return rows.filter((row) => row.status === status);
}

export function sumPrice(rows, status) {
  return rows.reduce(
    (total, row) => total + (status && row.status !== status ? 0 : Number(row.precoNum) || 0),
    0
  );
}

export function buildStoreMetrics(rows) {
  const stores = new Map();
  for (const row of rows) {
    if (!stores.has(row.loja)) {
      stores.set(row.loja, { loja: row.loja, t: 0, a: 0, p: 0, risco: 0, cats: new Set() });
    }
    const store = stores.get(row.loja);
    if (row.unitTotal > 0) {
      store.t = row.unitTotal;
      store.a = row.unitActive;
      store.p = row.unitPaused;
      store.risco = Number(row.unitPausedRevenue) || 0;
    } else if (!row.summaryOnly) {
      store.t += 1;
      if (row.status === 'Pausado') store.p += 1;
      if (row.status === 'Ativo') store.a += 1;
    }
    if (row.status === 'Pausado') store.risco += Number(row.precoNum) || 0;
    if (row.categoria) store.cats.add(row.categoria);
  }
  return [...stores.values()].map((store) => ({
    ...store,
    cats: store.cats.size,
    disponib: pct(store.a, store.t),
  }));
}

export function buildItemMetrics(rows) {
  const items = new Map();
  for (const row of rows) {
    if (!row.item) continue;
    if (!items.has(row.item)) {
      items.set(row.item, { n: row.item, cat: row.categoria, active: 0, paused: 0, risco: 0, lojas: new Set() });
    }
    const item = items.get(row.item);
    if (row.status === 'Ativo') item.active += 1;
    if (row.status === 'Pausado') {
      item.paused += 1;
      item.risco += Number(row.precoNum) || 0;
      item.lojas.add(row.loja);
    }
  }
  return [...items.values()];
}
