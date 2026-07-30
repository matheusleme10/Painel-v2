export function parsePrice(p) {
  if (p == null || p === '') return 0;
  if (typeof p === 'number') return Number.isFinite(p) ? p : 0;
  const clean = String(p).replace(/[R$\s]/g, '');
  const n = clean.includes(',')
    ? clean.replace(/\./g, '').replace(',', '.')
    : clean;
  const v = parseFloat(n);
  return isNaN(v) ? 0 : v;
}

export function brl(v) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function formatDateBR(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : String(value || '');
}

export function formatDateRangeBR(value) {
  const [from, to] = String(value || '').split(' a ');
  return to ? `${formatDateBR(from)} a ${formatDateBR(to)}` : formatDateBR(from);
}

export const pct = (a, b) => b === 0 ? 0 : Math.round(a / b * 100);

export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export const shortName = s => s.replace(/Italin House\s*/i, '').replace(/Macarrao Gourmet\s*/i, '').trim() || s;
