import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const payload = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(projectRoot, 'data', 'current.json.gz'))));
const search = process.argv.slice(2).join(' ').trim() || 'São Carlos';
const normalize = (value) => String(value || '')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
const family = (item) => {
  const name = normalize(item);
  return ['cannoli', 'crostini', 'palha', 'brownie', 'tiramisu'].find((term) => name.includes(term));
};

const rows = (payload.rows.find((row) => row.catalogRows)?.catalogRows || [])
  .filter((row) => normalize(row.loja).includes(normalize(search)) && family(row.item));
const stores = Object.values(rows.reduce((groups, row) => {
  (groups[row.loja] ||= []).push(row);
  return groups;
}, {}));

if (!stores.length) throw new Error(`Forneria não encontrada para "${search}".`);

console.table(stores.flatMap((storeRows) => storeRows.map((row) => ({
  loja: row.loja,
  tipo: family(row.item),
  item: row.item,
  status: row.status,
}))));

const italStore = stores.find((storeRows) => /italin house/i.test(storeRows[0].loja));
const required = new Set(['cannoli', 'crostini', 'palha', 'brownie', 'tiramisu']);
const found = new Set((italStore || []).map((row) => family(row.item)));
const missing = [...required].filter((entry) => !found.has(entry));
if (missing.length) throw new Error(`Tipos ausentes na Ital in House: ${missing.join(', ')}.`);
if (italStore.some((row) => row.status !== 'Ativo')) throw new Error('São Carlos possui item da Forneria pausado no último relatório.');

console.log('Forneria validada: cinco tipos encontrados e todos ativos na Ital in House São Carlos.');
