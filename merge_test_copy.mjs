/**
 * merge.js — Mescla novas linhas importadas com o histórico já salvo.
 *
 * Antes, cada importação SUBSTITUÍA todo o histórico (por isso o dashboard
 * "só lia um dia": ao importar o arquivo do dia seguinte, os dias anteriores
 * eram apagados). Agora, linhas com a mesma combinação loja+categoria+item+dia
 * são atualizadas (o novo valor vence) e todo o restante do histórico é
 * preservado — permitindo acumular 7, 30, ou quantos dias forem importados.
 *
 * Duas causas conhecidas de "os dados não salvam" foram corrigidas aqui:
 * 1) O catalogCube (usado pelas telas de catálogo/itens) era SUBSTITUÍDO a
 *    cada upload em vez de mesclado — cada nova carga apagava o detalhe dos
 *    dias/turnos anteriores mesmo com a mesclagem normal ativada.
 * 2) O histórico crescia para sempre (sem limite), e o upload comprimido tem
 *    um teto de ~4 MB no servidor. Depois de algumas semanas de cargas
 *    diárias, o upload em modo "mesclar" passava a falhar sempre, sobrando
 *    só "Substituir todo o histórico" como jeito de salvar — e isso apaga o
 *    turno/dia que não está no arquivo atual. Agora o histórico é limitado a
 *    uma janela recente (RETENTION_DAYS), então o tamanho do pacote para de
 *    crescer indefinidamente.
 */

const RETENTION_DAYS = 45;

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

function cubeIndex(value, list, indexes) {
  const key = String(value ?? '');
  if (indexes.has(key)) return indexes.get(key);
  const index = list.length;
  list.push(key);
  indexes.set(key, index);
  return index;
}

// Mescla dois catalogCube (em vez de o novo simplesmente substituir o
// antigo), preservando o detalhe de dias/turnos anteriores. Em conflito
// (mesma loja+item+data+turno) o valor mais novo vence.
function mergeCatalogCube(oldCube, newCube) {
  if (!oldCube?.records?.length) return newCube || null;
  if (!newCube?.records?.length) return oldCube || null;

  const stores = []; const items = []; const categories = []; const dates = []; const shifts = [];
  const storeIdx = new Map(); const itemIdx = new Map(); const catIdx = new Map();
  const dateIdx = new Map(); const shiftIdx = new Map();
  const merged = new Map();

  function ingest(cube) {
    for (const record of cube.records) {
      const [s, i, c, d, sh, paused, price] = record;
      const store = cube.stores[s];
      const item = cube.items[i];
      const category = cube.categories[c];
      const date = cube.dates[d];
      const shift = cube.shifts[sh];
      const key = `${store}|${item}|${date}|${shift}`;
      merged.set(key, [
        cubeIndex(store, stores, storeIdx),
        cubeIndex(item, items, itemIdx),
        cubeIndex(category, categories, catIdx),
        cubeIndex(date, dates, dateIdx),
        cubeIndex(shift, shifts, shiftIdx),
        paused,
        price,
      ]);
    }
  }
  ingest(oldCube);
  ingest(newCube); // entra por último: em empate de chave, o novo vence.

  return { version: 1, stores, items, categories, dates, shifts, records: [...merged.values()] };
}

function maxDate(...lists) {
  let max = '';
  for (const list of lists) {
    for (const value of list || []) {
      const date = String(value || '');
      if (date && date > max) max = date;
    }
  }
  return max || null;
}

function cutoffFrom(latest, days) {
  if (!latest) return null;
  const date = new Date(`${latest}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
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
  let rows = Array.from(map.values());
  const oldMeta = existing.find((row) => row.networkSummary || row.catalogRows) || {};
  const newMeta = incoming.find((row) => row.networkSummary || row.catalogRows) || {};
  for (const row of rows) {
    for (const field of META_FIELDS) delete row[field];
  }
  if (!rows.length) return rows;

  const networkHistory = mergeHistory(
    oldMeta.networkHistory,
    newMeta.networkHistory,
    (entry) => `${entry.date}|${entry.shift || ''}`
  );
  const unitHistory = mergeHistory(
    oldMeta.unitHistory,
    newMeta.unitHistory,
    (entry) => `${entry.label}|${entry.date}|${entry.shift || ''}`
  );
  const catalogHistory = mergeHistory(
    oldMeta.catalogHistory || oldMeta.catalogRows,
    newMeta.catalogHistory || newMeta.catalogRows,
    (entry) => `${entry.loja}|${entry.item}|${entry.dia}|${entry.shift || ''}`
  );
  const productHistory = mergeHistory(
    oldMeta.productHistory,
    newMeta.productHistory,
    (entry) => `${entry.brandId || entry.loja}|${entry.item}|${entry.dia}|${entry.shift || ''}`
  );
  const forneriaSummaryHistory = mergeHistory(
    oldMeta.forneriaSummaryHistory,
    newMeta.forneriaSummaryHistory,
    (entry) => `${entry.brandId}|${entry.family}|${entry.date}|${entry.shift || ''}`
  );
  const catalogCube = mergeCatalogCube(oldMeta.catalogCube, newMeta.catalogCube);

  // Limita tudo a uma janela recente para o pacote nunca crescer sem fim.
  const latest = maxDate(
    networkHistory.map((entry) => entry.date),
    unitHistory.map((entry) => entry.date),
    catalogHistory.map((entry) => entry.dia),
    rows.map((row) => row.dia)
  );
  const cutoff = cutoffFrom(latest, RETENTION_DAYS);

  if (cutoff) {
    rows = rows.filter((row) => !row.dia || row.dia >= cutoff);
    if (!rows.length) rows = Array.from(map.values()).slice(0, 1); // nunca fica vazio
  }
  const withinRetention = (date) => !cutoff || !date || date >= cutoff;
  const finalNetworkHistory = networkHistory.filter((entry) => withinRetention(entry.date));
  const finalUnitHistory = unitHistory.filter((entry) => withinRetention(entry.date));
  const finalCatalogHistory = catalogHistory.filter((entry) => withinRetention(entry.dia));
  const finalProductHistory = productHistory.filter((entry) => withinRetention(entry.dia));
  const finalForneriaHistory = forneriaSummaryHistory.filter((entry) => withinRetention(entry.date));
  const finalCatalogCube = catalogCube && cutoff
    ? {
      ...catalogCube,
      records: catalogCube.records.filter((record) => withinRetention(catalogCube.dates[record[3]])),
    }
    : catalogCube;

  rows[0].networkSummary = newMeta.networkSummary || oldMeta.networkSummary;
  rows[0].networkHistory = finalNetworkHistory;
  rows[0].unitHistory = finalUnitHistory;
  rows[0].catalogHistory = finalCatalogHistory;
  rows[0].productHistory = finalProductHistory;
  rows[0].forneriaSummaryHistory = finalForneriaHistory;
  rows[0].catalogCube = finalCatalogCube;
  rows[0].unitStats = newMeta.unitStats || oldMeta.unitStats || [];
  rows[0].dataShift = newMeta.dataShift || oldMeta.dataShift;
  rows[0].catalogRows = newMeta.catalogRows || oldMeta.catalogRows || [];
  return rows;
}
