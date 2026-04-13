import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { sanitize } from './security.js';
import { parsePrice } from './format.js';

export function normalizeRow(raw) {
  const clean = {};
  for (const k in raw) {
    clean[k.replace(/^\uFEFF/, '').trim()] = raw[k];
  }

  const get = (...keys) => {
    for (const k of keys) {
      const v = clean[k];
      if (v != null && String(v).trim() !== '') return String(v).trim();
    }
    return '';
  };

  const rawStatus = get('status', 'Status', 'statusByCatalogAvailable');
  const rawCat = get('categoriesAvailable', 'CategoriesAvailable');
  const sl = rawStatus.toLowerCase();

  let status = 'Ativo';
  if (sl === 'pausado' || sl === 'false' || sl === 'falso') status = 'Pausado';
  else if (sl === 'true' || sl === 'verdadeiro' || sl === 'ativo') status = 'Ativo';
  else if (rawCat.toLowerCase() === 'false' || rawCat.toLowerCase() === 'falso') status = 'Pausado';

  const precoRaw = get('priceValue', 'Preço', 'preco', 'price');

  return {
    loja: sanitize(get('lojasSimpleName', 'lojasName', 'Nome da Loja', 'loja')),
    categoria: sanitize(get('categoriesName', 'Categoria', 'categoria')),
    item: sanitize(get('rowsName', 'Item', 'item')),
    dia: sanitize(get('data', 'Dia', 'dia', 'Data')),
    status,
    preco: precoRaw,
    precoNum: parsePrice(precoRaw),
  };
}

export function parseCSV(text) {
  const r1 = Papa.parse(text.replace(/^\uFEFF/, ''), { header: true, skipEmptyLines: true });
  let rows = r1.data;
  if (rows.length && Object.keys(rows[0]).some(k => k.includes(';'))) {
    rows = Papa.parse(text.replace(/^\uFEFF/, ''), { header: true, delimiter: ';', skipEmptyLines: true }).data;
  }
  return rows.map(normalizeRow).filter(r => r.loja);
}

export function parseXLSX(ab) {
  const wb = XLSX.read(ab, { type: 'array' });
  return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' })
    .map(normalizeRow)
    .filter(r => r.loja);
}
