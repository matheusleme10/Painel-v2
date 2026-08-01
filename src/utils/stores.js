function normalizedStoreName(value) {
  return String(value || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export function storeId(value) {
  return String(value || '').trim().match(/(?:^|\D)(\d{5,})\s*$/)?.[1] || '';
}

export function storeKey(value) {
  const id = storeId(value);
  return id ? `id:${id}` : `name:${normalizedStoreName(value)}`;
}

export function isSameStore(left, right) {
  const leftKey = storeKey(left);
  const rightKey = storeKey(right);
  return Boolean(leftKey && rightKey && leftKey === rightKey);
}

export function displayStoreName(value) {
  return String(value || '').replace(/\s+-\s+\d+\s*$/, '').trim();
}

export function resolveStoreSelection(selected, candidates = []) {
  if (!selected) return '';

  const exact = candidates.find((candidate) => isSameStore(candidate, selected));
  if (exact) return exact;

  // Compatibilidade com seleções antigas, que eram salvas sem o ID da unidade.
  // A migração só ocorre quando há exatamente uma candidata para não misturar homônimas.
  const selectedName = normalizedStoreName(displayStoreName(selected));
  const matches = candidates.filter((candidate) => (
    normalizedStoreName(displayStoreName(candidate)) === selectedName
  ));
  return matches.length === 1 ? matches[0] : '';
}
