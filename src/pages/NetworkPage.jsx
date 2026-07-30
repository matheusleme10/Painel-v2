import { useMemo, useState } from 'react';
import { C } from '../constants.js';
import { Card } from '../components/ui/Card.jsx';
import { Kpi } from '../components/ui/Kpi.jsx';
import { Gauge } from '../components/ui/charts/Gauge.jsx';
import { HBar } from '../components/ui/charts/HBar.jsx';
import { brl, formatDateRangeBR } from '../utils/format.js';

export function NetworkPage({ all, financialRows = all, summary: selectedSummary }) {
  const [query, setQuery] = useState('');
  const term = query.trim().toLocaleLowerCase('pt-BR');
  const visibleRows = useMemo(() => (
    term ? all.filter((row) => row.loja.toLocaleLowerCase('pt-BR').includes(term)) : all
  ), [all, term]);
  const summary = term
    ? visibleRows.reduce((result, row) => ({
      activeItems: result.activeItems + (Number(row.unitActive) || 0),
      pausedItems: result.pausedItems + (Number(row.unitPaused) || 0),
      totalItems: result.totalItems + (Number(row.unitTotal) || 0),
      totalStores: result.totalStores + 1,
      updatedAt: selectedSummary?.updatedAt,
    }), { activeItems: 0, pausedItems: 0, totalItems: 0, totalStores: 0 })
    : (selectedSummary || all.find((row) => row.networkSummary)?.networkSummary || {});
  const active = summary.activeItems || 0;
  const paused = summary.pausedItems || all.filter((row) => row.status === 'Pausado').length;
  const total = summary.totalItems || active + paused;
  const availability = total ? Math.round(active / total * 100) : 0;
  const pausedPct = total ? Math.round(paused / total * 100) : 0;
  const stores = [...new Set(visibleRows.map((row) => row.loja))];
  const risk = financialRows
    .filter((row) => !term || row.loja.toLocaleLowerCase('pt-BR').includes(term))
    .reduce((sum, row) => sum + (row.status === 'Pausado' ? row.precoNum : 0), 0);

  const topItems = useMemo(() => {
    return [...visibleRows]
      .sort((a, b) => (b.unitPaused || 0) - (a.unitPaused || 0))
      .slice(0, 10)
      .map((row) => ({ n: row.loja, v: row.unitPaused || 0 }));
  }, [visibleRows]);

  return (
    <div className="network-page">
      <div className="network-hero">
        <div><span className="eyebrow">VISÃO CONSOLIDADA</span><h1>Geral da Rede</h1>
          <p>Disponibilidade e itens pausados no período, turno e marca selecionados.</p></div>
        <div className="network-date">Período <strong>{formatDateRangeBR(summary.updatedAt) || 'última carga'}</strong></div>
      </div>
      <div className="network-store-search">
        <input type="search" value={query} placeholder="Pesquisar uma unidade..."
          onChange={(event) => setQuery(event.target.value)} />
        {term && <span>{stores.length} unidade(s) encontrada(s)</span>}
      </div>
      <div className="network-kpis">
        <Kpi label="Itens ativos" value={active.toLocaleString('pt-BR')} icon="check" accent={C.green} accentBg={C.greenL} sub={`${availability}% da rede`} />
        <Kpi label="Itens pausados" value={paused.toLocaleString('pt-BR')} icon="pause" accent={C.red} accentBg={C.redL} sub={`${pausedPct}% da rede`} />
        <Kpi label="Itens monitorados" value={total.toLocaleString('pt-BR')} icon="item" accent={C.blue} accentBg={C.blueL} sub="ativos + pausados" />
        <Kpi label="Unidades na carga" value={stores.length} icon="store" accent={C.purple} accentBg={C.purpleL} sub={`${summary.totalStores || stores.length} no resumo do Excel`} />
        <Kpi label="Valor pausado" value={brl(risk)} icon="money" accent={C.orange} accentBg={C.orangeL} sub="soma dos preços recuperados" small />
      </div>
      <div className="network-panels">
        <Card><h2>Saúde geral</h2><Gauge value={availability} />
          <p className="panel-note">{active.toLocaleString('pt-BR')} ativos de {total.toLocaleString('pt-BR')} itens monitorados.</p></Card>
        <Card><h2>Unidades com mais itens pausados</h2><HBar data={topItems} maxItems={10} color={C.red} /></Card>
      </div>
    </div>
  );
}
