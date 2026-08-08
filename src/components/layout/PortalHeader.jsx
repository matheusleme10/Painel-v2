import { useEffect, useState } from 'react';
import { ADMIN_TABS, C, FRANCHISE_TABS } from '../../constants.js';
import { Ic } from '../ui/Icon.jsx';
import { formatDateBR } from '../../utils/format.js';
import { IHMonogram } from '../ui/IHMonogram.jsx';

const THEME_KEY = 'ih-theme';

function useTheme() {
  const [dark, setDark] = useState(() => {
    try { return localStorage.getItem(THEME_KEY) === 'dark'; } catch { return false; }
  });
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    try { localStorage.setItem(THEME_KEY, dark ? 'dark' : 'light'); } catch { /* ignora */ }
  }, [dark]);
  return [dark, setDark];
}

export function PortalHeader({ tab, onTabChange, all, lastDate, shift, syncing, context, role, onChangeContext, onLogout }) {
  const tabs = role === 'admin' ? ADMIN_TABS : FRANCHISE_TABS;
  const [dark, setDark] = useTheme();
  return (
    <aside className="portal-sidebar">
      <button className="brand-lockup" onClick={() => onTabChange(role === 'admin' ? 'network' : 'dash')} aria-label="Ir ao dashboard">
        <span className="brand-mark"><IHMonogram /></span>
        <span className="brand-context"><strong>Operação</strong><small>Portal de Itens Pausados x Ativos</small></span>
      </button>

      <nav className="sidebar-nav" aria-label="Navegação principal">
        {tabs.map(({ id, label, icon }) => {
          const active = tab === id;
          return (
            <button key={id} className={active ? 'sidebar-nav-item active' : 'sidebar-nav-item'} onClick={() => onTabChange(id)} title={label}>
              <Ic n={icon} s={16} c={active ? C.red : C.muted} />
              <span>{label}</span>
            </button>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <div className="data-status">
          <span className={`status-orb ${syncing ? 'syncing' : all.length ? 'ready' : ''}`} />
          <span>
            <strong>{syncing ? 'Sincronizando' : all.length ? `Atualizado até ${shift}` : 'Aguardando dados'}</strong>
            <small>{all.length ? `${formatDateBR(lastDate)} · ${role === 'admin' ? 'Administrador' : 'Franqueado'}` : 'Aguardando a próxima carga'}</small>
          </span>
        </div>
        <div className="header-actions">
          <button className="theme-toggle-btn" onClick={() => setDark((current) => !current)} title={dark ? 'Modo claro' : 'Modo escuro'} aria-label={dark ? 'Ativar modo claro' : 'Ativar modo escuro'}>
            <Ic n={dark ? 'sun' : 'moon'} s={14} c={C.muted} />
          </button>
          {onChangeContext && context?.store && <button onClick={onChangeContext} title="Trocar marca ou unidade">Trocar unidade</button>}
          <button onClick={onLogout}>Sair</button>
        </div>
      </div>
    </aside>
  );
}
