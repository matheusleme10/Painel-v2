import fs from 'node:fs';
import zlib from 'node:zlib';

const root = new URL('../', import.meta.url);
const payload = JSON.parse(zlib.gunzipSync(fs.readFileSync(new URL('data/current.json.gz', root))));
const metadata = payload.rows.find((row) => row.networkHistory || row.catalogRows) || {};
const history = metadata.unitHistory || [];
const dates = [...new Set(history.map((entry) => entry.date))].sort();
const shifts = [...new Set(history.map((entry) => entry.shift))].sort();
if (dates.length < 2) throw new Error('Histórico de datas insuficiente.');
if (!shifts.includes('Jantar')) throw new Error('Turno Jantar não foi preservado.');

const targetDate = dates.includes('2026-07-28') ? '2026-07-28' : dates.at(-2);
const target = history.filter((entry) => entry.date === targetDate && entry.shift === 'Jantar');
if (!target.length) throw new Error(`Sem dados recalculáveis para ${targetDate}.`);
const summary = target.reduce((acc, entry) => ({
  stores: acc.stores + 1,
  active: acc.active + entry.active,
  paused: acc.paused + entry.paused,
  total: acc.total + entry.total,
}), { stores: 0, active: 0, paused: 0, total: 0 });
if (summary.active + summary.paused !== summary.total) throw new Error('Ativos + pausados não reconciliam.');

const catalogHistory = metadata.catalogHistory || [];
const catalogDates = [...new Set(catalogHistory.map((row) => row.dia))].sort();
if (!catalogDates.length) throw new Error('Snapshot detalhado ausente.');
const productHistory = metadata.productHistory || [];
const productDates = [...new Set(productHistory.map((row) => row.dia))].sort();
const productBrands = [...new Set(productHistory.map((row) => row.brandId))].sort();
if (productDates.length !== dates.length) {
  throw new Error(`Histórico por produto incompleto: ${productDates.length} de ${dates.length} datas.`);
}
if (!productDates.includes('2026-07-13') || !productDates.includes('2026-07-29')) {
  throw new Error('Histórico por produto não cobre 13/07 a 29/07.');
}
if (productBrands.length !== 4) throw new Error('Histórico por produto não cobre as quatro marcas.');
const forneriaSummary = metadata.forneriaSummaryHistory || [];
const lunchForneria = forneriaSummary.filter((entry) => entry.shift === 'Almoço');
if (lunchForneria.length !== 39) {
  throw new Error(`Forneria Almoço incompleta: ${lunchForneria.length} de 39 combinações esperadas.`);
}
const cube = metadata.catalogCube;
if (!cube?.records?.length || cube.records.length < 300_000) {
  throw new Error('Cache completo Almoço/Jantar não foi preservado.');
}
if (!cube.shifts.includes('Almoço') || !cube.shifts.includes('Jantar')) {
  throw new Error('Cache completo não possui os dois turnos.');
}
const networkByShift = (metadata.networkHistory || []).filter((entry) => entry.date === '2026-07-13');
if (!networkByShift.some((entry) => entry.shift === 'Almoço') || !networkByShift.some((entry) => entry.shift === 'Jantar')) {
  throw new Error('Resumo da rede em 13/07 não possui Almoço e Jantar.');
}
if ((metadata.networkHistory || []).length !== dates.length * 2) {
  throw new Error(`Histórico global incompleto: ${(metadata.networkHistory || []).length} de ${dates.length * 2} recortes.`);
}
const latestDinner = (metadata.networkHistory || []).find(
  (entry) => entry.date === '2026-07-29' && entry.shift === 'Jantar',
);
if (!latestDinner || latestDinner.activeItems !== 11392 || latestDinner.pausedItems !== 4531) {
  throw new Error('O último Jantar não reconcilia com a planilha de origem.');
}

console.table([{ date: targetDate, shift: 'Jantar', ...summary }]);
console.log({
  dates: dates.length,
  shifts,
  catalogSnapshots: catalogDates,
  productHistoryDates: productDates.length,
  productHistoryBrands: productBrands,
  productsOn1307: productHistory.filter((row) => row.dia === '2026-07-13').length,
  forneriaLunchEntries: lunchForneria.length,
  catalogCubeRecords: cube.records.length,
  catalogCubeShifts: cube.shifts,
});
console.table(networkByShift.map((entry) => ({
  date: entry.date,
  shift: entry.shift,
  active: entry.activeItems,
  paused: entry.pausedItems,
  total: entry.totalItems,
})));
console.table((metadata.networkHistory || []).map((entry) => ({
  date: entry.date,
  shift: entry.shift,
  active: entry.activeItems,
  paused: entry.pausedItems,
  total: entry.totalItems,
})));
