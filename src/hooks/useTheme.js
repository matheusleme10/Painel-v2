import { useEffect, useState } from 'react';

const THEME_KEY = 'ih-theme';

// Tema compartilhado por todo o app — inclusive as telas antes do login
// (senha, identificação do franqueado, seleção de marca). O valor escolhido
// em qualquer uma dessas telas fica salvo e já entra valendo assim que a
// pessoa acessa o portal autenticado.
export function useTheme() {
  const [dark, setDark] = useState(() => {
    try { return localStorage.getItem(THEME_KEY) === 'dark'; } catch { return false; }
  });
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    try { localStorage.setItem(THEME_KEY, dark ? 'dark' : 'light'); } catch { /* ignora */ }
  }, [dark]);
  return [dark, setDark];
}
