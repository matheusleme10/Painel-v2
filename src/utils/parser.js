import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { sanitize } from './security.js';
import { parsePrice } from './format.js';

const PRICE_KEY_DIACRITICS = new RegExp('[' + String.fromCharCode(0x0300) + '-' + String.fromCharCode(0x036f) + ']', 'g');

// Chave usada para casar o nome de um item entre abas diferentes (cache de
// pivot, "produtos pausados", abas por marca). Precisa ignorar acento —
// "Tiramisu" e "Tiramisù" apareciam em abas diferentes com grafia diferente,
// e uma comparação só com toLocaleLowerCase não casava as duas, fazendo o
// preço de "produtos pausados" nunca completar esse item.
export function priceKey(value) {
  return String(value || '')
    .normalize('NFD').replace(PRICE_KEY_DIACRITICS, '')
    .toLocaleLowerCase('pt-BR')
    .trim();
}

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
    shift: sanitize(get('shift', 'turno', 'Horario', 'Horário')),
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
  const wb = XLSX.read(ab, { type: 'array', cellDates: true });
  const cell = (sheet, address) => wb.Sheets[sheet]?.[address]?.v;
  const currentYear = new Date().getFullYear();
  const isoDate = (value) => {
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, '0')}-${String(value.getUTCDate()).padStart(2, '0')}`;
    }
    const match = String(value || '').match(/^(\d{1,2})\/(\d{1,2})/);
    if (!match) return '';
    return `${currentYear}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
  };
  // As abas "produtos pausados"/marcas têm duas seções de colunas a partir
  // da linha 7: "Status" (uma data por coluna, com uma contagem — não A/P)
  // e, logo depois, "Price" com as MESMAS datas repetidas. A largura da
  // seção Status varia conforme quantos dias o Excel acumulou, então
  // descobrimos o deslocamento certo contando quantas datas aparecem antes
  // de uma se repetir, em vez de assumir uma largura fixa. O código antigo
  // assumia sempre col+13 (e, nos blocos abaixo, a coluna 16 fixa) — isso
  // lia a ÚLTIMA coluna de Status (uma contagem de lojas) como se fosse
  // preço, por isso itens com preço real na planilha apareciam sem preço
  // (ou com um número errado) no app.
  function priceSectionOffset(headerRow) {
    const seen = new Set();
    let count = 0;
    for (let col = 3; col < headerRow.length; col += 1) {
      const date = isoDate(headerRow[col]);
      if (!date || seen.has(date)) break;
      seen.add(date);
      count += 1;
    }
    return count;
  }
  const priceMaps = {};
  for (const sheetName of ['Fast Food - Caipira', 'City Burger', 'Green']) {
    const sheet = wb.Sheets[sheetName];
    if (!sheet) continue;
    const matrix = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: '',
      range: `A1:AC${XLSX.utils.decode_range(sheet['!ref']).e.r + 1}`,
    });
    const firstPriceCol = 3 + priceSectionOffset(matrix[6] || []);
    const prices = new Map();
    for (const row of matrix.slice(7)) {
      const item = priceKey(row[2]);
      const price = Number(row[firstPriceCol]);
      if (item && Number.isFinite(price) && price > 0) prices.set(item, price);
    }
    priceMaps[sheetName] = prices;
  }
  const sharedPrices = new Map(
    Object.values(priceMaps).flatMap((prices) => [...prices.entries()])
  );
  const unifiedProductsSheet = wb.Sheets['produtos pausados'];
  if (unifiedProductsSheet) {
    const unifiedMatrix = XLSX.utils.sheet_to_json(unifiedProductsSheet, {
      header: 1,
      defval: '',
      raw: false,
      range: `A1:AC${XLSX.utils.decode_range(unifiedProductsSheet['!ref']).e.r + 1}`,
    });
    const firstPriceCol = 3 + priceSectionOffset(unifiedMatrix[6] || []);
    for (const row of unifiedMatrix.slice(7)) {
      const item = priceKey(row[2]);
      const latestPrice = parsePrice(row[firstPriceCol]);
      if (item && Number.isFinite(latestPrice) && latestPrice > 0) {
        sharedPrices.set(item, latestPrice);
      }
    }
  }
  const priceMapForStore = (store) => {
    const name = String(store).toLocaleLowerCase('pt-BR');
    if (name.includes('city') || name.includes('burger')) return priceMaps['City Burger'] || sharedPrices;
    if (name.includes('green')) return priceMaps.Green || sharedPrices;
    return priceMaps['Fast Food - Caipira'] || sharedPrices;
  };
  const currentShift = String(cell('din', 'B8') || 'Não informado').trim();
  const productHistory = [];
  const brandHistorySheets = [
    { sheet: 'produtos pausados', brandId: 'ital', brandName: 'Ital in House' },
    { sheet: 'Fast Food - Caipira', brandId: 'caipira', brandName: 'Fast Food Caipira' },
    { sheet: 'City Burger', brandId: 'city', brandName: 'City Burger' },
    { sheet: 'Green', brandId: 'green', brandName: 'Green' },
  ];
  for (const source of brandHistorySheets) {
    const sheet = wb.Sheets[source.sheet];
    if (!sheet) continue;
    const matrix = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: '',
      raw: false,
      range: `A1:AC${XLSX.utils.decode_range(sheet['!ref']).e.r + 1}`,
    });
    const headers = matrix[6] || [];
    const offset = priceSectionOffset(headers);
    const dateColumns = [];
    for (let col = 3; col < 3 + offset; col += 1) {
      const date = isoDate(headers[col]);
      if (date) dateColumns.push({ col, date, priceCol: col + offset });
    }
    let category = 'Sem categoria';
    for (const row of matrix.slice(7)) {
      const label = String(row[2] || '').trim();
      if (!label) continue;
      const hasStatus = dateColumns.some(({ col }) => /^[AP]$/i.test(String(row[col] || '').trim()));
      if (!hasStatus) {
        category = label;
        continue;
      }
      for (const { col, date, priceCol } of dateColumns) {
        const code = String(row[col] || '').trim().toUpperCase();
        if (code !== 'A' && code !== 'P') continue;
        const parsed = normalizeRow({
          lojasSimpleName: source.brandName,
          categoriesName: category,
          rowsName: label,
          data: date,
          shift: currentShift,
          status: code === 'A' ? 'Ativo' : 'Pausado',
          priceValue: row[priceCol],
        });
        parsed.brandId = source.brandId;
        parsed.aggregateLevel = 'brand';
        productHistory.push(parsed);
      }
    }
  }
  const forneriaSummaryHistory = [];
  const forneriaHistorySheets = [
    { sheet: 'Loja Item - Cannoli', family: 'cannoli', item: 'Cannoli' },
    { sheet: 'Loja Item - Crostini', family: 'crostini', item: 'Crostini' },
    { sheet: 'Loja Item - Palha', family: 'palha', item: 'Palha Italiana' },
  ];
  for (const source of forneriaHistorySheets) {
    const sheet = wb.Sheets[source.sheet];
    if (!sheet) continue;
    const matrix = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: '',
      range: `A1:AB${XLSX.utils.decode_range(sheet['!ref']).e.r + 1}`,
    });
    const dates = matrix[7] || [];
    const shifts = matrix[8] || [];
    const pausedTotals = matrix[9] || [];
    let date = '';
    for (let col = 2; col < Math.max(dates.length, shifts.length); col += 1) {
      date = isoDate(dates[col]) || date;
      const shift = String(shifts[col] || '').trim();
      const paused = Number(pausedTotals[col]);
      if (!date || !shift || !Number.isFinite(paused)) continue;
      forneriaSummaryHistory.push({
        brandId: 'ital',
        family: source.family,
        item: source.item,
        date,
        shift,
        paused,
        active: 0,
        total: 0,
      });
    }
  }
  const shiftByDate = new Map();
  const storeView = wb.Sheets['Vista por Loja'];
  if (storeView) {
    const matrix = XLSX.utils.sheet_to_json(storeView, { header: 1, defval: '' });
    const dates = matrix[5] || [];
    const shifts = matrix[6] || [];
    for (let col = 1; col < dates.length; col += 1) {
      const date = isoDate(dates[col]);
      const shift = String(shifts[col] || currentShift).trim();
      if (date) shiftByDate.set(date, shift || currentShift);
    }
  }
  const networkSummary = {
    activeItems: Number(cell('din', 'B3')) || 0,
    pausedItems: Number(cell('din', 'B4')) || 0,
    totalItems: Number(cell('din', 'B5')) || 0,
    activePct: Number(cell('din', 'C3')) || 0,
    pausedPct: Number(cell('din', 'C4')) || 0,
    totalStores: Number(cell('din', 'B11')) || 0,
    updatedAt: cell('din', 'B6') || '',
    shift: currentShift,
  };
  const networkHistory = [];
  const din = wb.Sheets.din;
  if (din) {
    const headerRow = 21;
    const valueRow = 22;
    const range = XLSX.utils.decode_range(din['!ref']);
    let section = '';
    const byDate = new Map();
    for (let col = 1; col <= range.e.c; col += 1) {
      const sectionValue = String(din[XLSX.utils.encode_cell({ r: 19, c: col })]?.v || '').trim();
      if (/ativo/i.test(sectionValue) && !/pausado/i.test(sectionValue)) section = 'active';
      if (/pausado/i.test(sectionValue)) section = 'paused';
      const date = isoDate(din[XLSX.utils.encode_cell({ r: headerRow - 1, c: col })]?.v);
      const value = Number(din[XLSX.utils.encode_cell({ r: valueRow - 1, c: col })]?.v);
      if (!date || !Number.isFinite(value) || !section) continue;
      const entry = byDate.get(date) || {
        date,
        activeItems: 0,
        pausedItems: 0,
        shift: shiftByDate.get(date) || currentShift,
      };
      entry[section === 'active' ? 'activeItems' : 'pausedItems'] = value;
      byDate.set(date, entry);
    }
    for (const entry of byDate.values()) {
      entry.totalItems = entry.activeItems + entry.pausedItems;
      entry.activePct = entry.totalItems ? entry.activeItems / entry.totalItems : 0;
      entry.pausedPct = entry.totalItems ? entry.pausedItems / entry.totalItems : 0;
      networkHistory.push(entry);
    }
  }
  const unitStats = [];
  const unitHistory = [];
  const alerts = wb.Sheets.alertas;
  if (alerts) {
    const endRow = XLSX.utils.decode_range(alerts['!ref']).e.r + 1;
    const alertDates = [];
    const alertEndCol = XLSX.utils.decode_range(alerts['!ref']).e.c;
    for (let col = 1; col <= alertEndCol; col += 1) {
      const date = isoDate(alerts[XLSX.utils.encode_cell({ r: 4, c: col })]?.v);
      if (date) alertDates.push({ col, date });
    }
    for (let row = 1; row <= endRow - 3; row += 1) {
      const label = String(alerts[`B${row}`]?.v || '').trim();
      const pausedLabel = String(alerts[`B${row + 1}`]?.v || '');
      if (!label || !pausedLabel.toLowerCase().includes('pausados')) continue;
      const paused = Number(alerts[`C${row + 1}`]?.v);
      const total = Number(alerts[`C${row + 2}`]?.v);
      const pausedPct = Number(alerts[`C${row + 3}`]?.v);
      if (
        !Number.isInteger(paused)
        || !Number.isInteger(total)
        || total < 15
        || paused < 0
        || paused > total
        || !Number.isFinite(pausedPct)
        || pausedPct < 0
        || pausedPct > 1
        || /qtde produtos|alertas|\(%\)|receita|total/i.test(label)
      ) continue;
      unitStats.push({
        label,
        paused,
        total,
        active: Math.max(0, total - paused),
        pausedPct: Number.isFinite(pausedPct) ? pausedPct : paused / total,
      });
      for (const { col, date } of alertDates) {
        const historicalPaused = Number(alerts[XLSX.utils.encode_cell({ r: row, c: col })]?.v);
        const historicalTotal = Number(alerts[XLSX.utils.encode_cell({ r: row + 1, c: col })]?.v);
        if (
          Number.isInteger(historicalPaused)
          && Number.isInteger(historicalTotal)
          && historicalTotal >= 15
          && historicalPaused >= 0
          && historicalPaused <= historicalTotal
        ) {
          unitHistory.push({
            label,
            date,
            shift: shiftByDate.get(date) || currentShift,
            paused: historicalPaused,
            total: historicalTotal,
            active: historicalTotal - historicalPaused,
            pausedPct: historicalPaused / historicalTotal,
          });
        }
      }
    }
  }
  // Alguns arquivos exportados (ex: pastas de trabalho com tabelas dinâmicas)
  // têm várias abas e a aba de dados nem sempre é a primeira. Testamos todas
  // as abas e usamos a que produzir mais linhas válidas.
  let best = [];
  for (const name of wb.SheetNames) {
    const rows = XLSX.utils
      .sheet_to_json(wb.Sheets[name], { defval: '' })
      .map(normalizeRow)
      .filter((r) => r.loja);
    if (rows.length > best.length) best = rows;
  }
  if (!best.length && wb.Sheets.email) {
    const matrix = XLSX.utils.sheet_to_json(wb.Sheets.email, { header: 1, defval: '' });
    const dateCell = wb.Sheets['Fast Food - Caipira']?.D7
      || wb.Sheets['City Burger']?.D7
      || wb.Sheets.Green?.D7;
    const latestDate = dateCell?.v instanceof Date
      ? dateCell.v.toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10);
    best = matrix.slice(1)
      .filter((row) => row[2] && row[4])
      .map((row) => {
        const itemKey = priceKey(row[4]);
        const price = sharedPrices.get(itemKey) ?? priceMapForStore(row[2]).get(itemKey);
        return normalizeRow({
          lojasSimpleName: row[2],
          categoriesName: row[3],
          rowsName: row[4],
          data: latestDate,
          status: 'Pausado',
          priceValue: Number.isFinite(price) ? price : '',
        });
      });
  }
  const normalized = (value) => String(value || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const brandOf = (value) => {
    const name = normalized(value);
    if (name.includes('city') || name.includes('burger')) return 'city';
    if (name.includes('green')) return 'green';
    if (name.includes('caipira') || name.includes('boiadeir')) return 'caipira';
    return 'ital';
  };
  const emailMatrix = wb.Sheets.email
    ? XLSX.utils.sheet_to_json(wb.Sheets.email, { header: 1, defval: '' })
    : [];
  const fullStoreNames = [...new Set(emailMatrix.slice(1).map((row) => String(row[2] || '').trim()).filter(Boolean))];
  const categoryByItem = new Map(
    emailMatrix.slice(1)
      .filter((row) => row[3] && row[4])
      .map((row) => [normalized(row[4]), String(row[3]).trim()])
  );
  const knownCategories = new Set(
    emailMatrix.slice(1).map((row) => normalized(row[3])).filter(Boolean)
  );
  const resolveStore = (shortName) => {
    const key = normalized(shortName);
    return fullStoreNames.find((name) => {
      const fullKey = normalized(name);
      return fullKey.includes(key) || key.includes(fullKey);
    }) || shortName;
  };
  let catalogRows = [];
  const catalogSnapshots = new Map();
  const catalogSheetNames = wb.SheetNames.filter((name) => /^Vista Loja x Produtos(?: \(\d+\))?$/.test(name));
  for (const catalogSheetName of catalogSheetNames) {
    const catalogSheet = wb.Sheets[catalogSheetName];
    const matrix = XLSX.utils.sheet_to_json(catalogSheet, { header: 1, defval: '' });
    const stores = matrix[6] || [];
    // As abas numeradas são continuações do catálogo atual. Algumas tabelas
    // dinâmicas mantêm um cabeçalho de data antigo, portanto a data autoritativa
    // do snapshot é a última data consolidada da carga.
    const snapshotDate = [...networkHistory].map((entry) => entry.date).sort().at(-1)
      || isoDate(matrix[1]?.[1])
      || best[0]?.dia
      || new Date().toISOString().slice(0, 10);
    const snapshotShift = shiftByDate.get(snapshotDate) || currentShift;
    if (!catalogSnapshots.has(snapshotDate)) catalogSnapshots.set(snapshotDate, new Map());
    const snapshot = catalogSnapshots.get(snapshotDate);
    for (const row of matrix.slice(7)) {
      const item = String(row[0] || '').trim();
      if (!item || knownCategories.has(normalized(item))) continue;
      const category = categoryByItem.get(normalized(item)) || '';
      for (let col = 2; col < stores.length; col += 1) {
        const rawStatus = row[col];
        const statusCode = rawStatus === 0 ? 'A' : rawStatus === 1 ? 'P' : String(rawStatus || '').trim().toUpperCase();
        if (statusCode !== 'A' && statusCode !== 'P') continue;
        const store = resolveStore(stores[col]);
        const price = sharedPrices.get(priceKey(item))
          ?? priceMapForStore(store).get(priceKey(item));
        const parsed = normalizeRow({
          lojasSimpleName: store,
          categoriesName: category || 'Sem categoria',
          rowsName: item,
          data: snapshotDate,
          status: statusCode === 'A' ? 'Ativo' : 'Pausado',
          priceValue: Number.isFinite(price) ? price : '',
        });
        parsed.shift = snapshotShift;
        snapshot.set(`${normalized(store)}|${normalized(item)}`, parsed);
      }
    }
  }
  const catalogHistory = [...catalogSnapshots.values()].flatMap((snapshot) => [...snapshot.values()]);
  const latestCatalogDate = [...catalogSnapshots.keys()].sort().at(-1);
  catalogRows = latestCatalogDate ? [...catalogSnapshots.get(latestCatalogDate).values()] : [];
  const findUnit = (store) => {
    const storeKey = normalized(store);
    const brand = brandOf(store);
    return unitStats
      .filter((stat) => brandOf(stat.label) === brand)
      .sort((a, b) => normalized(b.label).length - normalized(a.label).length)
      .find((stat) => {
        const labelKey = normalized(stat.label);
        return labelKey.length >= 3 && (storeKey.includes(labelKey) || labelKey.includes(storeKey));
      });
  };
  const usedUnitStats = new Map();
  for (const row of best) {
    const stat = findUnit(row.loja);
    if (stat) {
      usedUnitStats.set(stat.label, stat);
      row.unitTotal = stat.total;
      row.unitActive = stat.active;
      row.unitPaused = stat.paused;
      row.unitPausedPct = stat.pausedPct;
    }
  }
  const pausedGroups = new Map();
  for (const row of best.filter((entry) => entry.status === 'Pausado')) {
    if (!pausedGroups.has(row.loja)) pausedGroups.set(row.loja, []);
    pausedGroups.get(row.loja).push(row);
  }
  // Antes isto cortava a lista de pausados de cada loja no total informado
  // pela aba "alertas" (row.unitPaused). Quando esse total vinha desatualizado
  // ou menor que a contagem real (planilhas divergentes, loja não encontrada
  // em "alertas", etc.), itens pausados de verdade eram descartados em silêncio.
  // Agora só removemos duplicatas exatas (mesma loja + mesmo item), preservando
  // todo item pausado distinto.
  const authoritativePaused = [];
  for (const rows of pausedGroups.values()) {
    const seen = new Set();
    for (const row of rows) {
      const itemKey = normalized(row.item);
      if (seen.has(itemKey)) continue;
      seen.add(itemKey);
      authoritativePaused.push(row);
    }
  }
  const currentPausedKeys = new Set(
    authoritativePaused.map((row) => `${normalized(row.loja)}|${normalized(row.item)}`)
  );
  catalogRows = catalogRows.filter((row) => {
    const key = `${normalized(row.loja)}|${normalized(row.item)}`;
    return row.status === 'Ativo' ? !currentPausedKeys.has(key) : currentPausedKeys.has(key);
  });
  const catalogKeys = new Set(catalogRows.map((row) => `${normalized(row.loja)}|${normalized(row.item)}`));
  for (const row of authoritativePaused) {
    const key = `${normalized(row.loja)}|${normalized(row.item)}`;
    if (!catalogKeys.has(key)) {
      catalogRows.push({ ...row });
      catalogKeys.add(key);
    }
  }
  for (const row of best) {
    if (!row.shift) row.shift = currentShift;
  }
  const uniqueProductHistory = [...new Map(productHistory.map((row) => [
    `${row.brandId}|${String(row.item).toLocaleLowerCase('pt-BR')}|${row.dia}|${row.shift}`,
    row,
  ])).values()];
  const forneriaFamily = (item) => {
    const key = normalized(item);
    if (key.startsWith('cannoli')) return 'cannoli';
    if (key.startsWith('crostini')) return 'crostini';
    if (key.startsWith('palha')) return 'palha';
    return '';
  };
  const familyTotals = new Map();
  for (const row of catalogRows) {
    if (brandOf(row.loja) !== 'ital') continue;
    const family = forneriaFamily(row.item);
    if (family) familyTotals.set(family, (familyTotals.get(family) || 0) + 1);
  }
  for (const entry of forneriaSummaryHistory) {
    entry.total = familyTotals.get(entry.family) || entry.paused;
    entry.active = Math.max(0, entry.total - entry.paused);
  }
  if (best.length) {
    best[0].networkSummary = networkSummary;
    best[0].networkHistory = networkHistory;
    best[0].unitStats = [...usedUnitStats.values()];
    best[0].unitHistory = unitHistory;
    best[0].dataShift = currentShift;
    best[0].catalogRows = catalogRows;
    best[0].catalogHistory = catalogHistory;
    best[0].productHistory = uniqueProductHistory;
    best[0].forneriaSummaryHistory = forneriaSummaryHistory;
    // sharedPrices já prioriza a aba "produtos pausados" (ela sobrescreve os
    // preços das abas por marca — ver acima). O catálogo em cube (pivot
    // cache) não passa por essa aba, então expomos esse mapa aqui pra
    // AdminPage.jsx poder completar os preços que o cache trouxe zerados.
    best[0].catalogPriceLookup = Object.fromEntries(sharedPrices);
  }
  return best;
}
