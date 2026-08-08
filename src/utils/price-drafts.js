// Ajustes de preço "ao vivo" para itens sem preço cadastrado. Isso NÃO é
// salvo em lugar nenhum (nem backend, nem localStorage) — existe só na
// memória enquanto a página está aberta, pra simular o valor nos cards e
// KPIs. Ao recarregar a página os valores voltam a zero, de propósito.
const DIACRITICS = new RegExp('[' + String.fromCharCode(0x0300) + '-' + String.fromCharCode(0x036f) + ']', 'g');

const norm = (value) => String(value || '')
  .normalize('NFD').replace(DIACRITICS, '')
  .toLocaleLowerCase('pt-BR')
  .trim();

export function draftItemKey(item) {
  return norm(item);
}

export function draftStoreKey(store, item) {
  return `${norm(store)}||${norm(item)}`;
}

export function emptyDrafts() {
  return { byItem: {}, byStore: {} };
}

// info = { item, price, scope: 'store'|'network', store, stores: Set opcional }
export function withPriceDraft(current, info) {
  const next = { byItem: { ...current.byItem }, byStore: { ...current.byStore } };
  const numeric = Number(String(info.price).replace(',', '.'));
  const valid = numeric > 0;

  if (info.scope === 'network') {
    const key = draftItemKey(info.item);
    if (valid) next.byItem[key] = { price: numeric, item: info.item };
    else delete next.byItem[key];
    return next;
  }

  const targets = info.stores && info.stores.size ? [...info.stores] : [info.store].filter(Boolean);
  targets.forEach((store) => {
    const key = draftStoreKey(store, info.item);
    if (valid) next.byStore[key] = { price: numeric, item: info.item, store };
    else delete next.byStore[key];
  });
  return next;
}

export function hasDrafts(drafts) {
  return Boolean(drafts && (Object.keys(drafts.byItem).length || Object.keys(drafts.byStore).length));
}

// Aplica os ajustes por cima das linhas que ainda não têm preço. Nunca
// substitui um preço real cadastrado — o ajuste manual só completa o que
// falta, então uma linha com precoNum > 0 sai intocada.
export function applyPriceDrafts(rows, drafts) {
  if (!hasDrafts(drafts)) return rows;
  return rows.map((row) => {
    if (!row.item) return row;
    const draft = drafts.byStore[draftStoreKey(row.loja, row.item)] ?? drafts.byItem[draftItemKey(row.item)];
    if (!draft) return row;
    return { ...row, precoNum: draft.price, preco: draft.price, precoManual: true, precoDraft: true };
  });
}
