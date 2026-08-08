// Preços definidos manualmente pela franquia (ou pelo admin) para itens
// pausados que não têm preço cadastrado na planilha. Ficam guardados no
// backend, separados do upload principal, então uma nova carga de XLSX não
// apaga o que já foi ajustado — e o admin vê o mesmo valor que a franquia.
const ENDPOINT = '/api/price-overrides';

export function overrideKey(store, item) {
  const clean = (value) => String(value || '').trim().split(/\s+/).join(' ').toLocaleLowerCase('pt-BR');
  return `${clean(store)}||${clean(item)}`;
}

export async function fetchPriceOverrides() {
  try {
    const response = await fetch(ENDPOINT, { credentials: 'same-origin' });
    if (!response.ok) return {};
    const payload = await response.json();
    return payload.overrides || {};
  } catch {
    return {};
  }
}

export async function savePriceOverride({ store, item, categoria = '', price }) {
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ store, item, categoria, price }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.detail || 'Não foi possível salvar o preço.');
  return payload;
}

// Aplica os ajustes por cima das linhas que ainda não têm preço. Não mexe em
// linhas que já têm preço cadastrado — o ajuste manual é só um complemento
// para o que falta, nunca substitui um preço real da planilha.
export function applyPriceOverrides(rows, overrides) {
  if (!overrides || !Object.keys(overrides).length) return rows;
  return rows.map((row) => {
    if (Number(row.precoNum) > 0 || !row.item || !row.loja) return row;
    const override = overrides[overrideKey(row.loja, row.item)];
    if (!override) return row;
    return { ...row, precoNum: override.price, preco: override.price, precoManual: true };
  });
}
