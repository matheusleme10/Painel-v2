import { pct } from './format.js';

export function rowsByStatus(rows, status) {
  return rows.filter((row) => row.status === status);
}

// Quando o filtro "Ambos" (Almoço + Jantar) está ativo, cada item aparece
// em até 2 linhas nesse mesmo dia — uma por turno. Somar as duas linhas
// direto infla a contagem (um item pausado nos dois turnos contava como 2
// itens pausados, em vez de 1). O que faz sentido pra um resumo do dia é a
// UNIÃO dos itens diferentes: se pausou em qualquer um dos turnos, conta
// como pausado 1x nesse dia — e um item que só existe num dos turnos ainda
// entra na conta normalmente. Ex.: turno A com 50 pausados + turno B com só
// 2 itens diferentes (não presentes em A) = 52, não 100.
export function collapseShiftRows(rows) {
  const map = new Map();
  rows.forEach((row) => {
    const key = `${row.loja}|${row.item}|${row.categoria}|${row.dia}`;
    const current = map.get(key);
    if (!current) {
      map.set(key, { ...row });
      return;
    }
    if (row.status === 'Pausado') current.status = 'Pausado';
    if (!(Number(current.precoNum) > 0) && Number(row.precoNum) > 0) {
      current.precoNum = row.precoNum;
      current.preco = row.preco;
    }
  });
  return [...map.values()];
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
