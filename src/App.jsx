import { useEffect, useMemo, useState } from 'react';
import { Splash } from './components/layout/Splash.jsx';
import { PortalHeader } from './components/layout/PortalHeader.jsx';
import { AnalysisFilters } from './components/ui/AnalysisFilters.jsx';
import { BrandScopeBar } from './components/ui/BrandScopeBar.jsx';
import { DashPage } from './pages/DashPage.jsx';
import { FranchPage } from './pages/FranchPage.jsx';
import { ItemsOverviewPage } from './pages/ItemsOverviewPage.jsx';
import { CatPage } from './pages/CatPage.jsx';
import { AlertsPage } from './pages/AlertsPage.jsx';
import { RankPage } from './pages/RankPage.jsx';
import { NetworkPage } from './pages/NetworkPage.jsx';
import { AutomatedNotificationPage } from './pages/AutomatedNotificationPage.jsx';
import { RevenueProjectionPage } from './pages/RevenueProjectionPage.jsx';
import { FranchiseCatalogPage } from './pages/FranchiseCatalogPage.jsx';
import { ForneriaPage } from './pages/ForneriaPage.jsx';
import { AdminPage } from './pages/AdminPage.jsx';
import { loadDataRemote } from './utils/remote-storage.js';
import { PortalLogin } from './components/PortalLogin.jsx';
import { BrandSelector } from './components/BrandSelector.jsx';
import { PotentialAccessGate } from './components/PotentialAccessGate.jsx';
import { FranchiseIdentityGate } from './components/FranchiseIdentityGate.jsx';
import { AccessLogsPage } from './pages/AccessLogsPage.jsx';
import { brandById, identifyBrand } from './utils/brands.js';
import { decodeCatalogCube } from './utils/pivot-cache.js';
import { isSameStore, resolveStoreSelection } from './utils/stores.js';

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
  }, [auth]);

  const metadata = all.find((row) => row.networkSummary || row.catalogRows) || {};
  const unitHistory = metadata.unitHistory || [];
  const catalogHistory = metadata.catalogHistory?.length
    ? metadata.catalogHistory
    : (metadata.catalogRows || []);
  const productHistory = metadata.productHistory || [];
  const sortedDates = useMemo(() => [...new Set([
    ...(metadata.networkHistory || []).map((entry) => entry.date),
    ...unitHistory.map((entry) => entry.date),
    ...catalogHistory.map((entry) => entry.dia),
    ...productHistory.map((entry) => entry.dia),
  ].filter(Boolean))].sort(), [metadata, unitHistory, catalogHistory, productHistory]);
  const lastDate = sortedDates.at(-1) || null;
  const effectiveFrom = filters.from || lastDate;
  const effectiveTo = filters.to || lastDate;
  const effectiveShift = filters.shift || metadata.dataShift || 'Jantar';
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
  const matchesShift = (shift) => !shift || shift === effectiveShift;
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
    shift: effectiveShift,
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
  const shiftHasNetworkData = (metadata.networkHistory || []).some((entry) => entry.shift === effectiveShift);

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
    return <FranchiseIdentityGate onIdentified={(identity) => setAuth((current) => ({ ...current, identified: true, identity }))} />;
  }

  if (auth.role === 'franchise' && !context) {
    return <BrandSelector rows={all} onSelect={selectFranchiseContext} />;
  }

  const activeBrand = context?.brandId ? brandById(context.brandId) : null;
  const displayShift = effectiveShift;

  return (
    <div className="app-shell" style={activeBrand ? { '--portal-accent': activeBrand.color, '--portal-accent-soft': activeBrand.soft } : undefined}>
      <PortalHeader tab={tab} onTabChange={setTab} all={pageRows} lastDate={lastDate}
        shift={displayShift} syncing={syncing} context={context} role={auth.role}
        onChangeContext={isAdmin ? null : () => { setContext(null); setTab('dash'); }} onLogout={logout} />

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
        {tab === 'network' && isAdmin && <NetworkPage all={networkRows} financialRows={exactSnapshotDates.length ? detailRows : productRows} summary={networkSnapshot} />}
        {tab === 'dash' && !isAdmin && (
          <DashPage all={detailRows} today={pageRows} systemicRows={detailRows}
            lastDate={selectedDate} periodFrom={effectiveFrom} periodTo={effectiveTo}
            historical={!isLatestSingle || Boolean(detailReferenceDate)} />
        )}
        {tab === 'franch' && isAdmin && <FranchPage today={pageRows} detailRows={detailRows} historical={!isLatestSingle} />}
        {tab === 'items' && (isAdmin ? <ItemsOverviewPage rows={exactSnapshotDates.length ? detailRows : productRows} /> : <FranchiseCatalogPage rows={detailRows} />)}
        {tab === 'cats' && <CatPage today={isAdmin && productRows.length ? productRows : detailRows} showFinancials={isAdmin} />}
        {tab === 'alerts' && isAdmin && <AlertsPage today={detailRows} all={detailRows} />}
        {tab === 'rank' && <RankPage today={isAdmin ? networkRows : rankingRows} periodFrom={effectiveFrom} periodTo={effectiveTo}
          showFinancials={isAdmin} selectedStore={isAdmin ? '' : context?.store} />}
        {tab === 'forneria' && <ForneriaPage rows={exactSnapshotDates.length ? detailRows : productRows}
          summaryRows={!metadata.catalogCube?.records?.length && effectiveShift === 'Almoço' ? forneriaSummaries : []}
          showFinancials={isAdmin} />}
        {tab === 'revenue' && (isAdmin
          ? <RevenueProjectionPage rows={detailRows} summaryRows={networkRows} isAdmin />
          : <PotentialAccessGate><RevenueProjectionPage rows={detailRows} summaryRows={networkRows} /></PotentialAccessGate>)}
        {tab === 'notify' && isAdmin && <AutomatedNotificationPage />}
        {tab === 'access' && isAdmin && <AccessLogsPage />}
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
  );
}
