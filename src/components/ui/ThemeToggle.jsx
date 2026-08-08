import { useTheme } from '../../hooks/useTheme.js';
import { Ic } from './Icon.jsx';

export function ThemeToggle({ className = 'theme-toggle-btn' }) {
  const [dark, setDark] = useTheme();
  return (
    <button
      type="button"
      className={className}
      onClick={() => setDark((current) => !current)}
      title={dark ? 'Modo claro' : 'Modo escuro'}
      aria-label={dark ? 'Ativar modo claro' : 'Ativar modo escuro'}
    >
      <Ic n={dark ? 'sun' : 'moon'} s={14} c="currentColor" />
    </button>
  );
}
