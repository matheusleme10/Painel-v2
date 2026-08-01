export function storeKey(value) {
  return String(value || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export function isSameStore(left, right) {
  const leftKey = storeKey(left);
  const rightKey = storeKey(right);
  return Boolean(leftKey && rightKey && leftKey === rightKey);
}

export function displayStoreName(value) {
  return String(value || '').replace(/\s+-\s+\d+\s*$/, '').trim();
}
