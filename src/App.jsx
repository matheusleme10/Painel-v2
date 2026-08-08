import { useEffect, useMemo, useState } from 'react';
import { Splash } from './components/layout/Splash.jsx';
import { PortalHeader } from './components/layout/PortalHeader.jsx';
import { AnalysisFilters } from './components/ui/AnalysisFilters.jsx';
import { BrandScopeBar } from './components/ui/BrandScopeBar.jsx';
import { DashPage } from './pages/DashPage.jsx';
import { FranchPage } from './pages/FranchPage.jsx';
import { ItemsOverviewPage } from './pages/ItemsOverviewPage.jsx';
import { CatPage } from './pages/CatPage.jsx';
import { RankPage } from './pages/RankPage.jsx';
import { NetworkPage } from './pages/NetworkPage.jsx';
import { AutomatedNotificationPage } from './pages/AutomatedNotificationPage.jsx';
import { PotentialPageV2 } from './pages/PotentialPageV2.jsx';
import { FranchiseCatalogPage } from './pages/FranchiseCatalogPage.jsx';
import { ForneriaPage } from './pages/ForneriaPage.jsx';
import { AdminPage } from './pages/AdminPage.jsx';
import { loadDataRemote } from './utils/remote-storage.js';
import { PortalLogin } from './components/PortalLogin.jsx';
import { BrandSelector } from './components/BrandSelector.jsx';
import { PotentialAccessGate } from './components/PotentialAccessGate.jsx';
import { FranchiseIdentityGate } from './components/FranchiseIdentityGate.jsx';
import { ManagementPage } from './pages/ManagementPage.jsx';
import { FranchiseFeedbackPage } from './pages/FranchiseFeedbackPage.jsx';
import { AlertsPage } from './pages/AlertsPage.jsx';
import { FranchiseAlertsPage } from './pages/FranchiseAlertsPage.jsx';
import { brandById, identifyBrand } from './utils/brands.js';
import { decodeCatalogCube } from './utils/pivot-cache.js';
import { isSameStore, resolveStoreSelection } from './utils/stores.js';
import { applyPriceDrafts, emptyDrafts, withPriceDraft } from './utils/price-drafts.js';
import { collapseShiftRows } from './utils/analytics.js';

function summarizeUnits(entries, effectiveTo, effectiveShift) {
  const range = new Map();
  entries.forEach((entry) => {
    const current = range.get(entry.label) || {
      ...entry, total: 0, active: 0, paused: 0, pausedRevenue: 0, observations: 0,
    };
    current.total += entry.total;
    current.active += entry.active;
    current.paused += entry.paused;
    current.pausedRevenue += Number(entry.pausedRevenue) || 0;
    current.observations += 1;
    current.pausedPct = current.total ? current.paused / current.total : 0;
    range.set(entry.label, current);
  });
  return [...range.values()].map((entry) => ({
    loja: entry.label,
    categoria: '',
    item: '',
    dia: effectiveTo,
    shift: effectiveShift,
    status: 'Resumo',
    precoNum: 0,
    unitTotal: entry.total,
    unitActive: entry.active,
    unitPaused: entry.paused,
    unitPausedPct: entry.pausedPct,
    unitPausedRevenue: entry.pausedRevenue,
    observations: entry.observations,
    summaryOnly: true,
  }));
}

export function App() {
  const [splash, setSplash] = useState(true);
  const [auth, setAuth] = useState(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [context, setContext] = useState(null);
  const [tab, setTab] = useState('network');
  const [all, setAll] = useState([]);
  const [syncing, setSyncing] = useState(false);
  // Ajustes de preço locais (não salvos) para itens sem preço cadastrado —
  // ver src/utils/price-drafts.js. Fica no App porque precisa refletir em
  // todas as páginas que usam detailRows/productRows, não só na de Potencial.
  const [priceDrafts, setPriceDrafts] = useState(emptyDrafts());
  const setPriceDraft = (info) => setPriceDrafts((current) => withPriceDraft(current, info));
  const [filters, setFilters] = useState({
    from: null,
    to: null,
    shift: null,
    brandId: 'all',
  });

  useEffect(() => {
    localStorage.removeItem('italinhouse_v6');
    fetch('/api/session', { credentials: 'same-origin', cache: 'no-store' })
      .then((response) => response.ok ? response.json() : null)
      .then((session) => setAuth(session?.authenticated ? {
        role: session.role, identified: session.identified, identity: session.identity,
      } : null))
      .finally(() => setSessionReady(true));
  }, []);

  useEffect(() => {
    if (!auth?.role || (auth.role === 'franchise' && !auth.identified)) return;
    setSyncing(true);
    setAll([]);
    loadDataRemote()
      .then((rows) => {
        if (rows?.length) {
          setAll(rows);
          setFilters({ from: null, to: null, shift: null, brandId: 'all' });
        }
      })
      .finally(() => setSyncing(false));
  }, [auth, context?.store]);

  const metadata = all.find((row) => row.networkSummary || row.catalogRows) || {};
  const unitHistory = metadata.unitHistory || [];
  const catalogHistory = metadata.catalogHistory?.length
    ? metadata.catalogHistory
    : (metadata.catalogRows || []);
  const productHistory = metadata.productHistory || [];
  const networkHistoryList = metadata.networkHistory || [];
  const sortedDates = useMemo(() => [...new Set([
    ...networkHistoryList.map((entry) => entry.date),
    ...unitHistory.map((entry) => entry.date),
    ...catalogHistory.map((entry) => entry.dia),
    ...productHistory.map((entry) => entry.dia),
  ].filter(Boolean))].sort(), [metadata, unitHistory, catalogHistory, productHistory]);
  const lastDate = sortedDates.at(-1) || null;
  // Nem toda carga enviada traz o catálogo completo (a de Jantar às vezes só
  // tem o consolidado da Forneria). Por isso a data/turno padrão seguem a
  // última carga que realmente tem catálogo completo (networkHistory), e não
  // o rótulo do último arquivo importado — senão a tela abre "vazia" mesmo
  // com dados completos já salvos na nuvem.
  const latestFullLoad = useMemo(() => {
    // No perfil franqueado o backend remove o consolidado da rede por
    // segurança. Nesse caso, a unitHistory da própria loja passa a ser a
    // fonte para descobrir a última data/turno disponível.
    const availableLoads = networkHistoryList.length ? networkHistoryList : unitHistory;
    if (!availableLoads.length) return null;
    return [...availableLoads].sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? -1 : 1;
      if (a.shift === metadata.dataShift) return 1;
      if (b.shift === metadata.dataShift) return -1;
      return 0;
    }).at(-1);
  }, [networkHistoryList, unitHistory, metadata.dataShift]);
  const defaultDate = latestFullLoad?.date || lastDate;
  const defaultShift = latestFullLoad?.shift
    || (['Almoço', 'Jantar', 'Ambos'].includes(metadata.dataShift) ? metadata.dataShift : null)
    || 'Jantar';
  const effectiveFrom = filters.from || defaultDate;
  const effectiveTo = filters.to || defaultDate;
  const effectiveShift = filters.shift || defaultShift;
  const selectedDate = effectiveTo;
  const isAdmin = auth?.role === 'admin';
  const scopeBrand = isAdmin ? filters.brandId : (context?.brandId || 'all');
  const franchiseStoreCandidates = useMemo(() => [...new Set(unitHistory
    .map((entry) => entry.label)
    .filter((label) => label && (scopeBrand === 'all' || identifyBrand(label) === scopeBrand)))], [unitHistory, scopeBrand]);
  const resolvedFranchiseStore = useMemo(() => (
    resolveStoreSelection(context?.store, franchiseStoreCandidates)
  ), [context?.store, franchiseStoreCandidates]);
  const scopeStore = isAdmin ? 'all' : (resolvedFranchiseStore || context?.store || 'all');
  const matchesScope = (store) => (
    (scopeBrand === 'all' || identifyBrand(store) === scopeBrand)
    && (scopeStore === 'all' || isSameStore(store, scopeStore))
  );
  // 'Ambos' combina Almoço e Jantar em vez de filtrar por um turno só — útil
  // porque um item pode pausar em turnos diferentes (ou no mesmo) e cada
  // pausa é uma perda de receita separada; olhando só um turno por vez isso
  // fica subestimado.
  const matchesShift = (shift) => effectiveShift === 'Ambos' || !shift || shift === effectiveShift;
  const unitEntries = unitHistory.filter((entry) => (
    entry.date >= effectiveFrom
    && entry.date <= effectiveTo
    && matchesShift(entry.shift)
    && matchesScope(entry.label)
  ));
  const networkRows = summarizeUnits(unitEntries, effectiveTo, effectiveShift);
  const rankingEntries = unitHistory.filter((entry) => (
    entry.date >= effectiveFrom
    && entry.date <= effectiveTo
    && matchesShift(entry.shift)
    && (scopeBrand === 'all' || identifyBrand(entry.label) === scopeBrand)
  ));
  const rankingRows = summarizeUnits(rankingEntries, effectiveTo, effectiveShift);
  const scopedSnapshot = networkRows.reduce((summary, row) => ({
    activeItems: summary.activeItems + row.unitActive,
    pausedItems: summary.pausedItems + row.unitPaused,
    totalItems: summary.totalItems + row.unitTotal,
    shift: effectiveShift,
    updatedAt: `${effectiveFrom}${effectiveFrom !== effectiveTo ? ` a ${effectiveTo}` : ''}`,
  }), { activeItems: 0, pausedItems: 0, totalItems: 0 });
  const networkHistoryEntries = (metadata.networkHistory || []).filter((entry) => (
    entry.date >= effectiveFrom
    && entry.date <= effectiveTo
    && matchesShift(entry.shift)
  ));
  const networkSnapshot = scopeBrand === 'all' && scopeStore === 'all' && networkHistoryEntries.length
    ? networkHistoryEntries.reduce((summary, entry) => ({
      activeItems: summary.activeItems + entry.activeItems,
      pausedItems: summary.pausedItems + entry.pausedItems,
      totalItems: summary.totalItems + entry.totalItems,
      shift: effectiveShift,
      updatedAt: `${effectiveFrom}${effectiveFrom !== effectiveTo ? ` a ${effectiveTo}` : ''}`,
    }), { activeItems: 0, pausedItems: 0, totalItems: 0 })
    : scopedSnapshot;
  const cubeRows = useMemo(() => decodeCatalogCube(metadata.catalogCube, {
    from: effectiveFrom,
    to: effectiveTo,
    shift: effectiveShift === 'Ambos' ? null : effectiveShift,
    brand: scopeBrand,
    store: scopeStore,
  }), [metadata.catalogCube, effectiveFrom, effectiveTo, effectiveShift, scopeBrand, scopeStore]);
  const snapshotDates = metadata.catalogCube?.dates?.length
    ? [...metadata.catalogCube.dates].sort()
    : [...new Set(catalogHistory.map((row) => row.dia).filter(Boolean))].sort();
  const exactSnapshotDates = snapshotDates.filter((date) => date >= effectiveFrom && date <= effectiveTo);
  const detailReferenceDate = metadata.catalogCube?.records?.length || exactSnapshotDates.length
    ? null
    : [...snapshotDates].sort((a, b) => Math.abs(new Date(a) - new Date(effectiveTo)) - Math.abs(new Date(b) - new Date(effectiveTo)))[0];
  const detailDates = exactSnapshotDates.length ? new Set(exactSnapshotDates) : new Set(detailReferenceDate ? [detailReferenceDate] : []);
  const fallbackDetailRows = catalogHistory.filter((row) => (
    detailDates.has(row.dia)
    && matchesShift(row.shift || metadata.dataShift)
    && matchesScope(row.loja)
  )).map((row) => detailReferenceDate ? { ...row, snapshotReference: true } : row);
  const detailRows = metadata.catalogCube?.records?.length ? cubeRows : fallbackDetailRows;
  const productRows = productHistory.filter((row) => (
    row.dia >= effectiveFrom
    && row.dia <= effectiveTo
    && matchesShift(row.shift)
    && (scopeBrand === 'all' || row.brandId === scopeBrand || identifyBrand(row.loja) === scopeBrand)
  ));
  const forneriaSummaries = (metadata.forneriaSummaryHistory || []).filter((entry) => (
    entry.date >= effectiveFrom
    && entry.date <= effectiveTo
    && entry.shift === effectiveShift
    && (scopeBrand === 'all' || entry.brandId === scopeBrand)
  ));
  const brandStores = [...new Set(unitHistory.map((entry) => entry.label).filter(Boolean))];
  const isLatestSingle = effectiveFrom === lastDate && effectiveTo === lastDate;
  const pageRows = networkRows;
  // Com "Ambos" selecionado, um item pode aparecer 1x por turno no mesmo
  // dia — sem isso, contagens de pausados/ativos ficavam infladas (somando
  // turnos em vez de olhar itens distintos). Ver collapseShiftRows.
  const shiftCollapsedDetailRows = useMemo(() => (
    effectiveShift === 'Ambos' ? collapseShiftRows(detailRows) : detailRows
  ), [detailRows, effectiveShift]);
  const shiftCollapsedProductRows = useMemo(() => (
    effectiveShift === 'Ambos' ? collapseShiftRows(productRows) : productRows
  ), [productRows, effectiveShift]);
  // Aplica os ajustes locais de preço por cima das linhas reais de item —
  // um único ponto central, então qualquer página que use draftedDetailRows
  // ou draftedProductRows já reflete o valor digitado, sem precisar mexer
  // em cada página separadamente.
  const draftedDetailRows = useMemo(() => applyPriceDrafts(shiftCollapsedDetailRows, priceDrafts), [shiftCollapsedDetailRows, priceDrafts]);
  const draftedProductRows = useMemo(() => applyPriceDrafts(shiftCollapsedProductRows, priceDrafts), [shiftCollapsedProductRows, priceDrafts]);
  const shiftHasNetworkData = effectiveShift === 'Ambos'
    || (metadata.networkHistory || []).some((entry) => entry.shift === effectiveShift)
    || unitHistory.some((entry) => entry.shift === effectiveShift);

  function authenticated(next) {
    setAuth(next);
    if (next.role === 'admin') {
      setContext({ role: 'admin' });
      setTab('network');
    } else {
      setContext(null);
      setTab('dash');
    }
  }

  async function logout() {
    await fetch('/api/session', { method: 'DELETE', credentials: 'same-origin' }).catch(() => {});
    setAuth(null);
    setAll([]);
    setContext(null);
    setTab('network');
  }

  async function selectFranchiseContext(next) {
    await fetch('/api/access/context', {
      method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(next),
    }).catch(() => {});
    setContext({ ...next, role: 'franchise' });
    setTab('dash');
  }

  if (splash || !sessionReady) return <Splash onDone={() => setSplash(false)} />;

  if (!auth?.role) {
    return <PortalLogin onAuthenticated={authenticated} />;
  }

  if (auth.role === 'franchise' && !auth.identified) {
    return <FranchiseIdentityGate onCancel={logout}
      onIdentified={(identity) => setAuth((current) => ({ ...current, identified: true, identity }))} />;
  }

  if (auth.role === 'franchise' && !context) {
    return <BrandSelector rows={all} onSelect={selectFranchiseContext} />;
  }

  const activeBrand = context?.brandId ? brandById(context.brandId) : null;
  const displayShift = effectiveShift;

  return (
    <div className="app-shell has-sidebar" style={activeBrand ? { '--portal-accent': activeBrand.color, '--portal-accent-soft': activeBrand.soft } : undefined}>
      <PortalHeader tab={tab} onTabChange={setTab} all={pageRows} lastDate={lastDate}
        shift={displayShift} syncing={syncing} context={context} role={auth.role}
        onChangeContext={isAdmin ? null : () => { setContext(null); setTab('dash'); }} onLogout={logout} />

      <div className="app-content">
        {all.length > 0 && !['notify', 'update', 'access'].includes(tab) && (
          <AnalysisFilters
            dates={sortedDates}
            value={{ from: effectiveFrom, to: effectiveTo, shift: effectiveShift }}
            onChange={(next) => setFilters((current) => ({ ...current, ...next }))}
            dataShift={metadata.dataShift}
          />
        )}
        {all.length > 0 && isAdmin && !['notify', 'update', 'access'].includes(tab) && (
          <BrandScopeBar
            value={scopeBrand}
            stores={brandStores}
            onChange={(brandId) => setFilters((current) => ({ ...current, brandId }))}
          />
        )}
        {all.length > 0 && !['notify', 'update', 'access'].includes(tab) && !shiftHasNetworkData && (
          <div className="shift-data-notice">
            A carga geral deste XLSX foi exportada para {metadata.dataShift || 'outro turno'}.
            Para {effectiveShift}, este arquivo possui consolidado específico somente de Cannoli, Crostini e Palha na Forneria.
          </div>
        )}

        <main className="app-main">
          {tab === 'network' && isAdmin && <NetworkPage all={networkRows} financialRows={exactSnapshotDates.length ? draftedDetailRows : draftedProductRows} summary={networkSnapshot} />}
          {tab === 'dash' && !isAdmin && (
            <DashPage all={draftedDetailRows} today={pageRows} systemicRows={draftedDetailRows}
              lastDate={selectedDate} periodFrom={effectiveFrom} periodTo={effectiveTo}
              historical={!isLatestSingle || Boolean(detailReferenceDate)} />
          )}
          {tab === 'franch' && isAdmin && <FranchPage today={pageRows} detailRows={draftedDetailRows} historical={!isLatestSingle} />}
          {tab === 'items' && (isAdmin
            ? <ItemsOverviewPage rows={exactSnapshotDates.length ? draftedDetailRows : draftedProductRows} onSetDraft={setPriceDraft} />
            : <FranchiseCatalogPage rows={draftedDetailRows} onSetDraft={setPriceDraft} />)}
          {tab === 'cats' && <CatPage today={isAdmin && productRows.length ? draftedProductRows : draftedDetailRows} showFinancials={isAdmin} />}
          {tab === 'rank' && <RankPage today={isAdmin ? networkRows : rankingRows} periodFrom={effectiveFrom} periodTo={effectiveTo}
            showFinancials={isAdmin} selectedStore={isAdmin ? '' : context?.store} />}
          {tab === 'forneria' && <ForneriaPage rows={exactSnapshotDates.length ? draftedDetailRows : draftedProductRows}
            summaryRows={!metadata.catalogCube?.records?.length && effectiveShift === 'Almoço' ? forneriaSummaries : []}
            showFinancials={isAdmin} />}
          {tab === 'revenue' && (isAdmin
            ? <PotentialPageV2 rows={draftedDetailRows} isAdmin onSetDraft={setPriceDraft} />
            : <PotentialAccessGate><PotentialPageV2 rows={draftedDetailRows} onSetDraft={setPriceDraft} /></PotentialAccessGate>)}
          {tab === 'alerts' && isAdmin && <AlertsPage today={exactSnapshotDates.length ? draftedDetailRows : draftedProductRows} />}
          {tab === 'alerts' && !isAdmin && <FranchiseAlertsPage all={draftedDetailRows} />}
          {tab === 'notify' && isAdmin && <AutomatedNotificationPage />}
          {tab === 'access' && isAdmin && <ManagementPage />}
          {tab === 'feedback' && !isAdmin && <FranchiseFeedbackPage />}
          {tab === 'update' && isAdmin && (
            <AdminPage all={all} initialAuth
              onUpdate={(rows) => {
                setAll(rows);
                setFilters({ from: null, to: null, shift: null, brandId: 'all' });
              }}
              onClear={() => setAll([])} />
          )}
        </main>
      </div>
    </div>
  );
}
