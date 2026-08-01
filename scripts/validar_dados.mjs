import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(projectRoot, 'data', 'current.json.gz');
const search = process.argv.slice(2).join(' ').trim() || 'São Carlos';

if (!fs.existsSync(source)) {
  throw new Error('Base local não encontrada. Importe o XLSX antes de validar.');
}

const normalize = (value) => String(value || '')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase('pt-BR');

const payload = JSON.parse(zlib.gunzipSync(fs.readFileSync(source)));
const metadata = payload.rows.find((row) => row.networkSummary) || {};
const latest = [...new Set((metadata.catalogRows || []).map((row) => row.dia))].sort().at(-1);
const matches = (metadata.catalogRows || []).filter(
  (row) => row.dia === latest && normalize(row.loja).includes(normalize(search))
);

if (!matches.length) {
  throw new Error(`Nenhuma unidade encontrada para "${search}" em ${latest || 'data desconhecida'}.`);
}

const stores = Object.values(matches.reduce((groups, row) => {
  (groups[row.loja] ||= []).push(row);
  return groups;
}, {})).map((rows) => ({
  loja: rows[0].loja,
  data: latest,
  ativos: rows.filter((row) => row.status === 'Ativo').length,
  pausados: rows.filter((row) => row.status === 'Pausado').length,
  total: rows.length,
}));

console.table(stores);
console.log(`Validação concluída: ${stores.length} unidade(s), recorte mais recente ${latest}.`);
