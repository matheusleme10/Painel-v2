import { LS_KEY } from '../constants.js';

export function saveData(rows) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(rows));
  } catch (e) {
    console.warn('localStorage write failed', e);
  }
}

export function loadData() {
  try {
    const s = localStorage.getItem(LS_KEY);
    if (s) {
      const parsed = JSON.parse(s);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('localStorage read failed', e);
  }
  return [];
}

export function clearData() {
  try {
    localStorage.removeItem(LS_KEY);
  } catch (e) {
    console.warn('localStorage clear failed', e);
  }
}
