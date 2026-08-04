import { useMemo, useState } from 'react';
import { C } from '../constants.js';
import { Card } from '../components/ui/Card.jsx';
import { Kpi } from '../components/ui/Kpi.jsx';
import { HBar } from '../components/ui/charts/HBar.jsx';
import { brl } from '../utils/format.js';
import { rowsByStatus } from '../utils/analytics.js';

const normalize = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').replace(/[^a-z0-9]+/g, ' ').trim();

export function PotentialPageV2({ rows, isAdmin = false }) {
  const [ordersPerDay, setOrdersPerDay] = useState(30);
  const [query, setQuery] = useState('');
  const term = normalize(query);
  const filteredRows = useMemo(() => term ? rows.filter((row) => normalize(row.loja).includes(term)) : rows, [rows, term]);
  const allStores = useMemo(() => [...new Set(rows.map((row) => row.loja).filter(Boolean))].sort(), [rows]);
  const stores = useMemo(() => [...new Set(filteredRows.map((row) => row.loja).filter(Boolean))], [filteredRows]);
  const dates = useMemo(() => [...new Set(filteredRows.map((row) => row.dia).filter(Boolean))].sort(), [filteredRows]);
  const active = useMemo(() => rowsByStatus(filteredRows, 'Ativo'), [filteredRows]);
  const paused = useMemo(() => rowsByStatus(filteredRows, 'Pausado'), [filteredRows]);
  const pricedActive = active.filter((row) => Number(row.precoNum) > 0);
  const pricedPaused = paused.filter((row) => Number(row.precoNum) > 0);
  const averageActiveTicket = pricedActive.length ? pricedActive.reduce((sum, row) => sum + Number(row.precoNum), 0) / pricedActive.length : 0;
  const averagePausedTicket = pricedPaused.length ? pricedPaused.reduce((sum, row) => sum + Number(row.precoNum), 0) / pricedPaused.length : 0;
  const pausedPriceSum = pricedPaused.reduce((sum, row) => sum + Number(row.precoNum), 0);
  const storeCount = stores.length;
  const analysisDays = Math.max(1, dates.length);
  const dailyPotential = averageActiveTicket * ordersPerDay * storeCount;
  const periodPotential = dailyPotential * analysisDays;
  const potentialAtRisk = averageActiveTicket * paused.length;
  const pauseRate = filteredRows.length ? Math.round(paused.length / filteredRows.length * 100) : 0;
  const uniquePausedItems = new Set(paused.map((row) => normalize(`${row.item}|${row.categoria}`))).size;
  const missingPausedPrices = paused.length - pricedPaused.length;
  const topActive = [...pricedActive].sort((a, b) => b.precoNum - a.precoNum).slice(0, 8).map((row) => ({ n: row.item, v: row.precoNum }));

  const pausedItems = useMemo(() => {
    const map = new Map();
    paused.forEach((row) => {
      if (!row.item) return;
      const key = normalize(`${row.item}|${row.categoria}`);
      const item = map.get(key) || { name: row.item, category: row.categoria || 'Sem categoria', occurrences: 0, priceSum: 0, priced: 0, stores: new Set(), dates: new Set() };
      item.occurrences += 1; item.stores.add(row.loja); if (row.dia) item.dates.add(row.dia);
      if (Number(row.precoNum) > 0) { item.priceSum += Number(row.precoNum); item.priced += 1; }
      map.set(key, item);
    });
    const values = [...map.values()].map((item) => ({ ...item, averagePrice: item.priced ? item.priceSum / item.priced : 0, weight: item.occurrences * (item.priced ? item.priceSum / item.priced : averageActiveTicket) }));
    const totalWeight = values.reduce((sum, item) => sum + item.weight, 0);
    return values.map((item) => ({ ...item, estimate: totalWeight ? potentialAtRisk * item.weight / totalWeight : 0 })).sort((a, b) => b.occurrences - a.occurrences || b.estimate - a.estimate);
  }, [paused, averageActiveTicket, potentialAtRisk]);

  const leader = pausedItems[0];
  const runnerUp = pausedItems[1];
  const hasCriticalOutlier = Boolean(leader && leader.occurrences >= 10 && leader.occurrences > (runnerUp?.occurrences || 0) && leader.occurrences >= (runnerUp?.occurrences || 1) * 1.5);
  const latestDate = dates.at(-1);
  const pausedOnLatestDate = new Set(paused.filter((row) => row.dia === latestDate).map((row) => normalize(`${row.item}|${row.categoria}`))).size;
  const actions = [
    hasCriticalOutlier && { level: 'critical', title: `Prioridade imediata: ${leader.name}`, text: `${leader.occurrences} pausas no período, bem acima dos demais itens. Valide estoque, cadastro e operação.` },
    pausedOnLatestDate > 0 && { level: 'attention', title: 'Revisar a carga mais recente', text: `${pausedOnLatestDate} item(ns) continuam pausados na última data selecionada.` },
    missingPausedPrices > 0 && { level: 'attention', title: 'Completar preços ausentes', text: `${missingPausedPrices} ocorrência(s) pausada(s) sem preço reduzem a precisão da estimativa.` },
    pauseRate >= 20 && { level: 'critical', title: 'Plano de recuperação do cardápio', text: `${pauseRate}% das observações do período estão pausadas. Priorize os itens mais recorrentes.` },
    { level: 'ok', title: 'Acompanhar após a correção', text: 'Após reativar os itens, compare a próxima carga para confirmar que o status voltou a Ativo.' },
  ].filter(Boolean).slice(0, 4);

  return <div className="projection-page">
    <div className="network-hero"><div><span className="eyebrow">CENÁRIO OPERACIONAL ESTIMADO</span><h1>Potencial da operação</h1><p>Leitura do potencial de ganho e do impacto dos itens pausados no período selecionado.</p></div></div>
    {isAdmin && <div className="network-store-search"><input type="search" value={query} placeholder="Pesquisar uma unidade..." list="projection-store-options" onChange={(event) => setQuery(event.target.value)} /><datalist id="projection-store-options">{allStores.map((store) => <option key={store} value={store} />)}</datalist>{term && <span>{stores.length} unidade(s) encontrada(s)</span>}</div>}
    <div className="projection-warning"><strong>Estimativa, não faturamento real</strong><span>Cenário indicativo, não previsão contábil. Não considera quantidade por pedido, descontos, taxas, impostos ou demanda real.</span></div>

    <section className="projection-zone projection-gain-zone">
      <div className="projection-zone-heading"><span>01</span><div><small>POTENCIAL DE GANHO</small><h2>O que a operação pode capturar</h2><p>Itens ativos, preço médio cadastrado, unidades e datas selecionadas.</p></div></div>
      <div className="network-kpis">
        <Kpi label="Itens ativos identificados" value={active.length} icon="check" accent={C.green} accentBg={C.greenL} />
        <Kpi label="Unidades no cenário" value={storeCount} icon="store" accent={C.red} accentBg={C.redL} sub={term ? 'resultado da pesquisa' : 'escopo atual'} />
        <Kpi label="Preço médio dos ativos" value={brl(averageActiveTicket)} icon="item" accent={C.purple} accentBg={C.purpleL} sub={`${pricedActive.length} observações com preço`} />
        <Kpi label="Potencial diário" value={brl(dailyPotential)} icon="money" accent={C.orange} accentBg={C.orangeL} sub={`${ordersPerDay} pedidos × ${storeCount} unidade(s)`} />
        <Kpi label="Potencial do período" value={brl(periodPotential)} icon="trophy" accent={C.green} accentBg={C.greenL} sub={`${analysisDays} dia(s) selecionado(s)`} />
      </div>
      <div className="network-panels"><Card><h2>Premissa ajustável</h2><label className="projection-field">Pedidos por dia<input type="number" min="1" max="1000" value={ordersPerDay} onChange={(event) => setOrdersPerDay(Math.max(1, Number(event.target.value) || 1))} /></label><p className="projection-disclaimer">O período usa automaticamente {analysisDays} data(s) do filtro global. O preço médio é uma aproximação, não o ticket real do iFood.</p></Card><Card><h2>Itens ativos de maior preço</h2><HBar data={topActive} color={C.green} fmtVal={brl} /></Card></div>
    </section>

    <section className="projection-zone projection-loss-zone">
      <div className="projection-zone-heading"><span>02</span><div><small>IMPACTO DAS PAUSAS</small><h2>Onde o desempenho pode estar sendo prejudicado</h2><p>Frequência, abrangência e preços dentro das datas selecionadas.</p></div></div>
      <div className="network-kpis">
        <Kpi label="Ocorrências pausadas" value={paused.length} icon="pause" accent={C.red} accentBg={C.redL} sub={`${uniquePausedItems} item(ns) diferente(s)`} />
        <Kpi label="Taxa de pausas" value={`${pauseRate}%`} icon="alert" accent={pauseRate >= 20 ? C.red : C.amber} accentBg={pauseRate >= 20 ? C.redL : C.amberL} sub="sobre as observações do período" />
        <Kpi label="Preço médio dos pausados" value={brl(averagePausedTicket)} icon="item" accent={C.orange} accentBg={C.orangeL} sub={`${pricedPaused.length} pausas com preço`} />
        <Kpi label="Soma dos preços pausados" value={brl(pausedPriceSum)} icon="money" accent={C.orange} accentBg={C.orangeL} sub="soma cadastral, não venda perdida" />
        <Kpi label="Potencial em risco estimado" value={brl(potentialAtRisk)} icon="alert" accent={C.red} accentBg={C.redL} sub={`${paused.length} ocorrências no período`} />
      </div>
      <div className="paused-impact-grid">
        <Card className="paused-ranking-card"><div className="paused-card-heading"><div><span className="eyebrow">MAIS RECORRENTES</span><h2>Itens que mais pausaram</h2></div>{hasCriticalOutlier && <b>Fora do padrão</b>}</div><div className="paused-item-cards">{pausedItems.slice(0, 8).map((item, index) => { const critical = hasCriticalOutlier && index === 0; return <article key={`${item.name}-${item.category}`} className={critical ? 'is-critical' : ''}><span className="paused-item-position">#{index + 1}</span><span><strong>{item.name}</strong><small>{item.category} · {item.dates.size} dia(s) · {item.stores.size} unidade(s)</small></span><span><b>{item.occurrences}×</b><small>pausado</small></span><span><b>{brl(item.estimate)}</b><small>impacto estimado</small></span></article>; })}{!pausedItems.length && <div className="empty-state">Nenhum item pausado no período selecionado.</div>}</div></Card>
        <Card className="action-plan-card"><span className="eyebrow">PLANO DE AÇÃO</span><h2>O que fazer agora</h2><div className="action-plan-list">{actions.map((action) => <article key={action.title} className={action.level}><i /><span><strong>{action.title}</strong><small>{action.text}</small></span></article>)}</div></Card>
      </div>
      <div className="projection-loss-disclaimer"><strong>Importante:</strong> Cenário indicativo, não previsão contábil. Não considera quantidade por pedido, descontos, taxas, impostos ou demanda real. Os valores servem para priorização operacional e não comprovam receita efetivamente perdida.</div>
    </section>
  </div>;
}
