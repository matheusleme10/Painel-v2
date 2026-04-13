import { useState, useMemo } from 'react';
import { C } from './constants.js';
import { Splash } from './components/layout/Splash.jsx';
import { Header } from './components/layout/Header.jsx';
import { DashPage } from './pages/DashPage.jsx';
import { FranchPage } from './pages/FranchPage.jsx';
import { ItemsPage } from './pages/ItemsPage.jsx';
import { CatPage } from './pages/CatPage.jsx';
import { AlertsPage } from './pages/AlertsPage.jsx';
import { AdminPage } from './pages/AdminPage.jsx';
import { loadData, saveData, clearData } from './utils/storage.js';
import { getLastDate } from './utils/date.js';

export function App({ correctHash }) {
  const [splash, setSplash] = useState(true);
  const [tab, setTab] = useState('dash');
  const [all, setAll] = useState(loadData);

  function update(rows) {
    setAll(rows);
    saveData(rows);
  }

  function clearHistory() {
    setAll([]);
    clearData();
    setTab('dash');
  }

  const lastDate = useMemo(() => getLastDate(all), [all]);
  const today = useMemo(() => (lastDate ? all.filter((r) => r.dia === lastDate) : all), [all, lastDate]);

  return (
    <>
      {splash && <Splash onDone={() => setSplash(false)} />}
      <div style={{ minHeight: '100vh', background: C.bg }}>
        <Header tab={tab} onTabChange={setTab} all={all} lastDate={lastDate} />
        <main style={{ maxWidth: 1380, margin: '0 auto', padding: '22px 18px 60px' }}>
          {tab === 'dash' && <DashPage all={all} today={today} lastDate={lastDate} />}
          {tab === 'franch' && <FranchPage today={today} />}
          {tab === 'items' && <ItemsPage today={today} />}
          {tab === 'cats' && <CatPage today={today} />}
          {tab === 'alerts' && <AlertsPage today={today} all={all} />}
          {tab === 'admin' && <AdminPage all={all} onUpdate={update} onClear={clearHistory} correctHash={correctHash} />}
        </main>
      </div>
    </>
  );
}
