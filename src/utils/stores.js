export function displayStoreName(value) {
  return String(value || '').replace(/\s+-\s+\d+\s*$/, '').trim();
}
