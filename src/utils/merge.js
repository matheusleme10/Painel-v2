/**
 * merge.js — Mescla novas linhas importadas com o histórico já salvo.
 *
 * Antes, cada importação SUBSTITUÍA todo o histórico (por isso o dashboard
 * "só lia um dia": ao importar o arquivo do dia seguinte, os dias anteriores
 * eram apagados). Agora, linhas com a mesma combinação loja+categoria+item+dia
 * são atualizadas (o novo valor vence) e todo o restante do histórico é
 * preservado — permitindo acumular 7, 30, ou quantos dias forem importados.
 */

function rowKey(r) {
  return `${r.loja}|${r.categoria}|${r.item}|${r.dia}|${r.shift || ''}`;
}

const META_FIELDS = [
  'networkSummary', 'networkHistory', 'unitStats', 'unitHistory',
  'dataShift', 'catalogRows', 'catalogHistory', 'productHistory', 'forneriaSummaryHistory', 'catalogCube',
];

function mergeHistory(existing = [], incoming = [], keyOf) {
  const map = new Map();
  for (const entry of existing || []) map.set(keyOf(entry), entry);
  for (const entry of incoming || []) map.set(keyOf(entry), entry);
  return [...map.values()];
}

/**
 * @param {Array} existing - linhas já salvas (histórico atual)
 * @param {Array} incoming - linhas recém-importadas do arquivo
 * @returns {Array} histórico mesclado
 */
export function mergeRows(existing, incoming) {
  const map = new Map();
  for (const r of existing) map.set(rowKey(r), r);
  for (const r of incoming) map.set(rowKey(r), r);
  const rows = Array.from(map.values());
  const oldMeta = existing.find((row) => row.networkSummary || row.catalogRows) || {};
  const newMeta = incoming.find((row) => row.networkSummary || row.catalogRows) || {};
  for (const row of rows) {
    for (const field of META_FIELDS) delete row[field];
  }
  if (!rows.length) return rows;
  rows[0].networkSummary = newMeta.networkSummary || oldMeta.networkSummary;
  rows[0].networkHistory = mergeHistory(
    oldMeta.networkHistory,
    newMeta.networkHistory,
    (entry) => `${entry.date}|${entry.shift || ''}`
  );
  rows[0].unitHistory = mergeHistory(
    oldMeta.unitHistory,
    newMeta.unitHistory,
    (entry) => `${entry.label}|${entry.date}|${entry.shift || ''}`
  );
  rows[0].catalogHistory = mergeHistory(
    oldMeta.catalogHistory || oldMeta.catalogRows,
    newMeta.catalogHistory || newMeta.catalogRows,
    (entry) => `${entry.loja}|${entry.item}|${entry.dia}|${entry.shift || ''}`
  );
  rows[0].productHistory = mergeHistory(
    oldMeta.productHistory,
    newMeta.productHistory,
    (entry) => `${entry.brandId || entry.loja}|${entry.item}|${entry.dia}|${entry.shift || ''}`
  );
  rows[0].forneriaSummaryHistory = mergeHistory(
    oldMeta.forneriaSummaryHistory,
    newMeta.forneriaSummaryHistory,
    (entry) => `${entry.brandId}|${entry.family}|${entry.date}|${entry.shift || ''}`
  );
  rows[0].catalogCube = newMeta.catalogCube || oldMeta.catalogCube;
  rows[0].unitStats = newMeta.unitStats || oldMeta.unitStats || [];
  rows[0].dataShift = newMeta.dataShift || oldMeta.dataShift;
  rows[0].catalogRows = newMeta.catalogRows || oldMeta.catalogRows || [];
  return rows;
}
