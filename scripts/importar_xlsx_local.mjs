import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { parseXLSX } from '../src/utils/parser.js';
import { parsePivotCatalog } from '../src/utils/pivot-cache.js';

const source = process.argv[2];
if (!source) {
  console.error('Uso: node scripts/importar_xlsx_local.mjs "C:\\caminho\\arquivo.xlsx"');
  process.exit(1);
}

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const destinationDir = path.join(projectRoot, 'data');
const destination = path.join(destinationDir, 'current.json.gz');
const temporary = path.join(destinationDir, 'current.next.json.gz');

const workbook = fs.readFileSync(path.resolve(source));
const rows = parseXLSX(workbook);
if (!rows.length) throw new Error('Nenhuma linha válida foi encontrada no XLSX.');
const metadata = rows.find((row) => row.networkHistory || row.catalogRows) || rows[0];
const allowedDates = (metadata.networkHistory || []).map((entry) => entry.date);
const workbookBuffer = workbook.buffer.slice(workbook.byteOffset, workbook.byteOffset + workbook.byteLength);
const pivot = await parsePivotCatalog(workbookBuffer, allowedDates);
if (pivot?.totalRecords) {
  metadata.catalogCube = pivot.catalogCube;
  metadata.networkHistory = pivot.networkHistory;
  metadata.unitHistory = pivot.unitHistory;
}

const payload = {
  rows,
  totalRows: rows.length,
  uploadedAt: new Date().toISOString(),
  sourceName: path.basename(source),
};

fs.mkdirSync(destinationDir, { recursive: true });
fs.writeFileSync(temporary, zlib.gzipSync(JSON.stringify(payload), { level: 9 }));
fs.renameSync(temporary, destination);

const priced = rows.filter((row) => Number(row.precoNum) > 0).length;
const stores = new Set(rows.map((row) => row.loja)).size;
const summary = rows.find((row) => row.networkSummary)?.networkSummary || {};

console.log(JSON.stringify({
  rows: rows.length,
  stores,
  priced,
  priceCoveragePct: Number((priced / rows.length * 100).toFixed(1)),
  activeItems: summary.activeItems || 0,
  pausedItems: summary.pausedItems || 0,
  totalItems: summary.totalItems || 0,
  pivotRecords: pivot?.totalRecords || 0,
}, null, 2));
