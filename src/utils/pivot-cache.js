const decoder = new TextDecoder();
import { storeKey } from './stores.js';

// Varre o diretório central do ZIP uma única vez e devolve todas as entradas
// (nome -> {method, compressed}). Antes só procurávamos por um nome exato
// ("pivotCacheDefinition7.xml"/"pivotCacheRecords7.xml"), mas esse número
// depende de quantas tabelas dinâmicas existem no arquivo do Excel — se o
// relatório for regerado com outra ordem de abas/pivôs, o índice muda e a
// extração falhava silenciosamente, fazendo o portal cair para o caminho
// antigo (mais limitado) de leitura de planilha.
function listZipEntries(arrayBuffer) {
  const view = new DataView(arrayBuffer);
  let eocd = -1;
  for (let offset = arrayBuffer.byteLength - 22; offset >= Math.max(0, arrayBuffer.byteLength - 65_557); offset -= 1) {
    if (view.getUint32(offset, true) === 0x06054b50) {
      eocd = offset;
      break;
    }
  }
  if (eocd < 0) throw new Error('Estrutura ZIP do XLSX não encontrada.');
  const totalEntries = view.getUint16(eocd + 10, true);
  let offset = view.getUint32(eocd + 16, true);
  const entries = new Map();
  for (let index = 0; index < totalEntries; index += 1) {
    if (view.getUint32(offset, true) !== 0x02014b50) break;
    const method = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localOffset = view.getUint32(offset + 42, true);
    const name = decoder.decode(new Uint8Array(arrayBuffer, offset + 46, nameLength));
    entries.set(name, { localOffset, method, compressedSize });
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return {
    names: [...entries.keys()],
    read(name) {
      const meta = entries.get(name);
      if (!meta) return null;
      const localNameLength = view.getUint16(meta.localOffset + 26, true);
      const localExtraLength = view.getUint16(meta.localOffset + 28, true);
      const dataOffset = meta.localOffset + 30 + localNameLength + localExtraLength;
      return {
        method: meta.method,
        compressed: arrayBuffer.slice(dataOffset, dataOffset + meta.compressedSize),
      };
    },
  };
}

function decompressedStream(entry) {
  if (!entry) throw new Error('Cache histórico não encontrado dentro do XLSX.');
  const source = new Blob([entry.compressed]).stream();
  if (entry.method === 0) return source;
  if (entry.method === 8 && typeof DecompressionStream !== 'undefined') {
    return source.pipeThrough(new DecompressionStream('deflate-raw'));
  }
  throw new Error('O navegador não suporta a descompressão seletiva deste XLSX.');
}

async function readEntryText(entry) {
  return new Response(decompressedStream(entry)).text();
}

function decodeXml(value = '') {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)));
}

function readValue(attributes) {
  return decodeXml(attributes.match(/\bv="([^"]*)"/)?.[1] || '');
}

function parseDefinition(xml) {
  return [...xml.matchAll(/<cacheField\b([^>]*)>([\s\S]*?)<\/cacheField>/g)].map((match) => {
    const name = decodeXml(match[1].match(/\bname="([^"]*)"/)?.[1] || '');
    const values = [];
    const shared = match[2].match(/<sharedItems\b[^>]*>([\s\S]*?)<\/sharedItems>/)?.[1] || '';
    for (const valueMatch of shared.matchAll(/<(s|d|n|b|m)\b([^>]*)\/>/g)) {
      const type = valueMatch[1];
      const raw = readValue(valueMatch[2]);
      values.push(type === 'n' ? Number(raw) : type === 'b' ? raw === '1' : raw);
    }
    return { name, values };
  });
}

function normalizeDate(value) {
  const match = String(value || '').match(/^(\d{4}-\d{2}-\d{2})/);
  return match?.[1] || '';
}

function brandId(store) {
  const value = String(store || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (value.includes('green')) return 'green';
  if (value.includes('city') || value.includes('burger')) return 'city';
  if (value.includes('caipira') || value.includes('boiadeir')) return 'caipira';
  return 'ital';
}

function dictionaryIndex(value, values, indexes) {
  const key = String(value || '');
  if (indexes.has(key)) return indexes.get(key);
  const index = values.length;
  values.push(key);
  indexes.set(key, index);
  return index;
}

const REQUIRED_PIVOT_FIELDS = ['lojasName', 'categoriesName', 'data', 'rowsName', 'priceValue', 'status', 'Horario'];

// Encontra, entre todos os caches de tabela dinâmica do arquivo, o par
// definition/records que contém os campos necessários. O número
// ("...Definition7.xml") não é fixo: muda conforme quantas tabelas
// dinâmicas o Excel cria, então testamos todos em vez de assumir um índice.
async function findUsablePivotCache(entries) {
  const candidates = entries.names
    .map((name) => name.match(/^xl\/pivotCache\/pivotCacheDefinition(\d+)\.xml$/)?.[1])
    .filter(Boolean)
    .sort((a, b) => Number(a) - Number(b));

  for (const index of candidates) {
    const definitionEntry = entries.read(`xl/pivotCache/pivotCacheDefinition${index}.xml`);
    const recordsEntry = entries.read(`xl/pivotCache/pivotCacheRecords${index}.xml`);
    if (!definitionEntry || !recordsEntry) continue;
    const fields = parseDefinition(await readEntryText(definitionEntry));
    const fieldIndex = new Map(fields.map((field, fieldPos) => [field.name, fieldPos]));
    if (REQUIRED_PIVOT_FIELDS.every((field) => fieldIndex.has(field))) {
      return { fields, fieldIndex, recordsEntry };
    }
  }
  return null;
}

export async function parsePivotCatalog(arrayBuffer, allowedDates = []) {
  const entries = listZipEntries(arrayBuffer);
  const usable = await findUsablePivotCache(entries);
  if (!usable) return null;
  const { fields, fieldIndex, recordsEntry } = usable;

  const allowed = new Set(allowedDates);
  const stores = [];
  const items = [];
  const categories = [];
  const dates = [];
  const shifts = [];
  const storeIndexes = new Map();
  const itemIndexes = new Map();
  const categoryIndexes = new Map();
  const dateIndexes = new Map();
  const shiftIndexes = new Map();
  const records = [];
  const networkMap = new Map();
  const unitMap = new Map();

  function decodeRecord(xml) {
    const values = [];
    for (const match of xml.matchAll(/<(x|s|d|n|b|m)\b([^>]*)\/>/g)) {
      const type = match[1];
      const raw = readValue(match[2]);
      const position = values.length;
      if (type === 'x') values.push(fields[position]?.values?.[Number(raw)]);
      else if (type === 'n') values.push(Number(raw));
      else if (type === 'b') values.push(raw === '1');
      else values.push(raw);
    }
    const store = values[fieldIndex.get('lojasName')] || values[fieldIndex.get('lojasSimpleName')];
    const category = values[fieldIndex.get('categoriesName')];
    const item = values[fieldIndex.get('rowsName')];
    const date = normalizeDate(values[fieldIndex.get('data')]);
    const shift = values[fieldIndex.get('Horario')];
    const status = values[fieldIndex.get('status')];
    const price = Number(values[fieldIndex.get('priceValue')]) || 0;
    if (!store || !item || !date || !shift || (status !== 'Ativo' && status !== 'Pausado')) return;
    if (allowed.size && !allowed.has(date)) return;

    const storeIndex = dictionaryIndex(store, stores, storeIndexes);
    const itemIndex = dictionaryIndex(item, items, itemIndexes);
    const categoryIndex = dictionaryIndex(category || 'Sem categoria', categories, categoryIndexes);
    const dateIndex = dictionaryIndex(date, dates, dateIndexes);
    const shiftIndex = dictionaryIndex(shift, shifts, shiftIndexes);
    const paused = status === 'Pausado' ? 1 : 0;
    records.push([storeIndex, itemIndex, categoryIndex, dateIndex, shiftIndex, paused, price]);

    const networkKey = `${dateIndex}|${shiftIndex}`;
    const network = networkMap.get(networkKey) || {
      date,
      shift,
      activeItems: 0,
      pausedItems: 0,
      totalItems: 0,
      pausedRevenue: 0,
    };
    network.totalItems += 1;
    if (paused) {
      network.pausedItems += 1;
      network.pausedRevenue += price;
    }
    else network.activeItems += 1;
    networkMap.set(networkKey, network);

    const unitKey = `${storeIndex}|${dateIndex}|${shiftIndex}`;
    const unit = unitMap.get(unitKey) || {
      label: store,
      date,
      shift,
      active: 0,
      paused: 0,
      total: 0,
      pausedRevenue: 0,
    };
    unit.total += 1;
    if (paused) {
      unit.paused += 1;
      unit.pausedRevenue += price;
    }
    else unit.active += 1;
    unitMap.set(unitKey, unit);
  }

  const textStream = decompressedStream(recordsEntry).pipeThrough(new TextDecoderStream());
  const reader = textStream.getReader();
  let buffer = '';
  while (true) {
    const { value, done } = await reader.read();
    buffer += value || '';
    let end = buffer.indexOf('</r>');
    while (end >= 0) {
      const start = buffer.lastIndexOf('<r>', end);
      if (start >= 0) decodeRecord(buffer.slice(start + 3, end));
      buffer = buffer.slice(end + 4);
      end = buffer.indexOf('</r>');
    }
    if (done) break;
    if (buffer.length > 1_000_000 && !buffer.includes('<r>')) buffer = buffer.slice(-256);
  }

  const networkHistory = [...networkMap.values()].map((entry) => ({
    ...entry,
    activePct: entry.totalItems ? entry.activeItems / entry.totalItems : 0,
    pausedPct: entry.totalItems ? entry.pausedItems / entry.totalItems : 0,
  }));
  const unitHistory = [...unitMap.values()].map((entry) => ({
    ...entry,
    pausedPct: entry.total ? entry.paused / entry.total : 0,
  }));

  return {
    catalogCube: { version: 1, stores, items, categories, dates, shifts, records },
    networkHistory,
    unitHistory,
    totalRecords: records.length,
    brands: [...new Set(stores.map(brandId))],
  };
}

export function decodeCatalogCube(cube, {
  from,
  to,
  shift,
  brand = 'all',
  store = 'all',
} = {}) {
  if (!cube?.records?.length) return [];
  const normalizedStore = storeKey(store);
  return cube.records.flatMap((record) => {
    const [storeIndex, itemIndex, categoryIndex, dateIndex, shiftIndex, paused, price] = record;
    const loja = cube.stores[storeIndex];
    const dia = cube.dates[dateIndex];
    const rowShift = cube.shifts[shiftIndex];
    if (from && dia < from) return [];
    if (to && dia > to) return [];
    if (shift && rowShift !== shift) return [];
    if (brand !== 'all' && brandId(loja) !== brand) return [];
    if (store !== 'all') {
      if (storeKey(loja) !== normalizedStore) return [];
    }
    return [{
      loja,
      categoria: cube.categories[categoryIndex],
      item: cube.items[itemIndex],
      dia,
      shift: rowShift,
      status: paused ? 'Pausado' : 'Ativo',
      preco: price,
      precoNum: Number(price) || 0,
    }];
  });
}
