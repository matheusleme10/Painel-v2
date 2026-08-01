import { ADMIN_TABS, C, FRANCHISE_TABS } from '../../constants.js';
import { Ic } from '../ui/Icon.jsx';
import { formatDateBR } from '../../utils/format.js';

export function PortalHeader({ tab, onTabChange, all, lastDate, shift, syncing, context, role, onChangeContext, onLogout }) {
  const tabs = role === 'admin' ? ADMIN_TABS : FRANCHISE_TABS;
  return (
    <header className="portal-header">
      <div className="portal-header-inner">
        <button className="brand-lockup" onClick={() => onTabChange(role === 'admin' ? 'network' : 'dash')} aria-label="Ir ao dashboard">
          <span className="brand-mark">IH</span>
          <span><strong>Ital in House</strong><small>{role === 'admin' ? 'Control Center' : 'Portal do Franqueado'}</small></span>
        </button>
        <nav className="portal-nav" aria-label="Navegação principal">
          {tabs.map(({ id, label, icon }) => {
            const active = tab === id;
            return (
              <button key={id} className={active ? 'nav-item active' : 'nav-item'} onClick={() => onTabChange(id)}>
                <Ic n={icon} s={14} c={active ? C.red : C.muted} /><span>{label}</span>
              </button>
            );
          })}
        </nav>
        <div className="data-status">
          <span className={`status-orb ${syncing ? 'syncing' : all.length ? 'ready' : ''}`} />
          <span>
            <strong>{syncing ? 'Sincronizando' : all.length ? `Atualizado até ${shift}` : 'Aguardando dados'}</strong>
            <small>{all.length ? `${formatDateBR(lastDate)} · ${role === 'admin' ? 'Administrador' : 'Franqueado'}` : 'Aguardando a próxima carga'}</small>
          </span>
        </div>
        <div className="header-actions">
          {onChangeContext && context?.store && <button onClick={onChangeContext} title="Trocar marca ou unidade">Trocar unidade</button>}
          <button onClick={onLogout}>Sair</button>
        </div>
      </div>
    </header>
  );
}
