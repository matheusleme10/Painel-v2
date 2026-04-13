export const MONTHS = {
  jan: 0, fev: 1, mar: 2, abr: 3, mai: 4, jun: 5,
  jul: 6, ago: 7, set: 8, out: 9, nov: 10, dez: 11
};

export function parseDate(s) {
  if (!s) return null;
  const p = String(s).toLowerCase().split('-');
  if (p.length === 3) {
    const mo = MONTHS[p[1]];
    if (mo !== undefined) {
      const y = parseInt(p[2]) + (parseInt(p[2]) < 100 ? 2000 : 0);
      return new Date(y, mo, parseInt(p[0]));
    }
  }
  const d = new Date(s);
  return isNaN(d) ? null : d;
}

export function getLastDate(data) {
  const dates = [...new Set(data.map(r => r.dia).filter(Boolean))];
  if (!dates.length) return null;
  return dates.sort((a, b) => {
    const da = parseDate(a);
    const db = parseDate(b);
    return (!da || !db) ? 0 : da - db;
  })[dates.length - 1];
}
