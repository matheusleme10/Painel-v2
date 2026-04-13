export function parsePrice(p) {
  if (!p) return 0;
  const n = String(p).replace(/[R$\s\.]/g, '').replace(',', '.');
  const v = parseFloat(n);
  return isNaN(v) ? 0 : v;
}

export function brl(v) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export const pct = (a, b) => b === 0 ? 0 : Math.round(a / b * 100);

export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export const shortName = s => s.replace(/Italin House\s*/i, '').replace(/Macarrao Gourmet\s*/i, '').trim() || s;
