import { useEffect, useMemo, useState } from 'react';
import { C } from '../constants.js';
import { Card } from '../components/ui/Card.jsx';
import { Kpi } from '../components/ui/Kpi.jsx';
import { HBar } from '../components/ui/charts/HBar.jsx';
import { brl } from '../utils/format.js';
import { rowsByStatus } from '../utils/analytics.js';
import { forneriaFamilyOf, FORNERIA_FAMILIES } from '../utils/forneria.js';
import { applyPriceOverrides, fetchPriceOverrides, savePriceOverride } from '../utils/price-overrides.js';

const DIACRITICS = new RegExp('[' + String.fromCharCode(0x0300) + '-' + String.fromCharCode(0x036f) + ']', 'g');
const normalize = (value) => String(value || '').normalize('NFD').replace(DIACRITICS, '').toLocaleLowerCase('pt-BR').replace(/[^a-z0-9]+/g, ' ').trim();

function groupByKey(rows, keyOf, labelOf) {
  const map = new Map();
  rows.forEach((row) => {
    const key = keyOf(row);
    if (!key) return;
    const entry = map.get(key) || { key, label: labelOf(row), active: 0, paused: 0, activeSum: 0, pausedSum: 0, total: 0 };
    entry.total += 1;
    if (row.status === 'Ativo') { entry.active += 1; entry.activeSum += Number(row.precoNum) || 0; }
    if (row.status === 'Pausado') { entry.paused += 1; entry.pausedSum += Number(row.precoNum) || 0; }
    map.set(key, entry);
  });
  return [...map.values()];
}

function PriceEditor({ item, isAdmin, onSaved }) {
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (isAdmin || item.priced) return null;
  const store = [...item.stores][0];
  if (!store) return null;

  async function submit(event) {
    event.preventDefault();
    const price = Number(String(draft).replace(',', '.'));
    if (!(price > 0)) { setError('Informe um preço válido.'); return; }
    setBusy(true);
    setError('');
    try {
      await savePriceOverride({ store, item: item.name, categoria: item.category, price });
      setDraft('');
      onSaved();
    } catch (reason) {
      setError(reason.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="price-editor" onClick={(event) => event.stopPropagation()}>
      <input
        type="number" min="0.01" step="0.01" inputMode="decimal" placeholder="Preço R$"
        value={draft} onChange={(event) => setDraft(event.target.value)}
      />
      <button type="submit" disabled={busy}>{busy ? '...' : 'Salvar'}</button>
      {error && <small className="price-editor-error">{error}</small>}
    </form>
  );
}

export function PotentialPageV2({ rows, isAdmin = false }) {
  const [ordersPerDay, setOrdersPerDay] = useState(30);
  const [storeQuery, setStoreQuery] = useState('');
  const [itemQuery, setItemQuery] = useState('');
  const [overrides, setOverrides] = useState({});

  useEffect(() => {
    let active = true;
    fetchPriceOverrides().then((next) => { if (active) setOverrides(next); });
    return () => { active = false; };
  }, []);

  const reloadOverrides = () => fetchPriceOverrides().then(setOverrides);

  const effectiveRows = useMemo(() => applyPriceOverrides(rows, overrides), [rows, overrides]);

  const storeTerm = normalize(storeQuery);
  const filteredRows = useMemo(() => storeTerm ? effectiveRows.filter((row) => normalize(row.loja).includes(storeTerm)) : effectiveRows, [effectiveRows, storeTerm]);
  const allStores = useMemo(() => [...new Set(effectiveRows.map((row) => row.loja).filter(Boolean))].sort(), [effectiveRows]);
  const stores = useMemo(() => [...new Set(filteredRows.map((row) => row.loja).filter(Boolean))], [filteredRows]);
  const dates = useMemo(() => [...new Set(filteredRows.map((row) => row.dia).filter(Boolean))].sort(), [filteredRows]);
  const active = useMemo(() => rowsByStatus(filteredRows, 'Ativo'), [filteredRows]);
  const paused = useMemo(() => rowsByStatus(filteredRows, 'Pausado'), [filteredRows]);
  const pricedActive = active.filter((row) => Number(row.precoNum) > 0);
  const pricedPaused = paused.filter((row) => Number(row.precoNum) > 0);
  const averageActiveTicket = pricedActive.length ? pricedActive.reduce((sum, row) => sum + Number(row.precoNum), 0) / pricedActive.length : 0;
  const averagePausedTicket = pricedPaused.length ? pricedPaused.reduce((sum, row) => sum + Number(row.precoNum), 0) / pricedPaused.length : 0;
  const activePriceSum = pricedActive.reduce((sum, row) => sum + Number(row.precoNum), 0);
  const pausedPriceSum = pricedPaused.reduce((sum, row) => sum + Number(row.precoNum), 0);
  const storeCount = stores.length;
  const analysisDays = Math.max(1, dates.length);
  const dailyPotential = averageActiveTicket * ordersPerDay * storeCount;
  const periodPotential = dailyPotential * analysisDays;
  // Importante: o valor em risco é a SOMA do preço real de cada item pausado
  // (não uma média multiplicada pela contagem) — senão itens bem diferentes
  // acabam mostrando exatamente o mesmo "impacto estimado", o que não faz
  // sentido e foi justamente o problema relatado.
  const potentialAtRisk = pausedPriceSum;
  const pauseRate = filteredRows.length ? Math.round(paused.length / filteredRows.length * 100) : 0;
  const uniquePausedItems = new Set(paused.map((row) => normalize(`${row.item}|${row.categoria}`))).size;
  const missingPausedPrices = paused.length - pricedPaused.length;

  const term = normalize(itemQuery);
  const matchesTerm = (label) => !term || normalize(label).includes(term);

  const topActive = useMemo(() => {
    const map = new Map();
    pricedActive.forEach((row) => {
      const key = normalize(row.item);
      const entry = map.get(key) || { name: row.item, sum: 0, count: 0 };
      entry.sum += Number(row.precoNum);
      entry.count += 1;
      map.set(key, entry);
    });
    return [...map.values()]
      .map((entry) => ({ n: entry.name, v: entry.sum / entry.count }))
      .filter((entry) => matchesTerm(entry.n))
      .sort((a, b) => b.v - a.v)
      .slice(0, 8);
  }, [pricedActive, term]);

  const pausedItems = useMemo(() => {
    const map = new Map();
    paused.forEach((row) => {
      if (!row.item) return;
      const key = normalize(`${row.item}|${row.categoria}`);
      const item = map.get(key) || {
        name: row.item, category: row.categoria || 'Sem categoria', occurrences: 0,
        priceSum: 0, priced: 0, manual: false, stores: new Set(), dates: new Set(),
      };
      item.occurrences += 1; item.stores.add(row.loja); if (row.dia) item.dates.add(row.dia);
      if (Number(row.precoNum) > 0) {
        item.priceSum += Number(row.precoNum);
        item.priced += 1;
        if (row.precoManual) item.manual = true;
      }
      map.set(key, item);
    });
    return [...map.values()].map((item) => {
      const averagePrice = item.priced ? item.priceSum / item.priced : 0;
      // Impacto estimado usa o preço real do próprio item (cadastrado ou
      // ajustado manualmente). Sem preço, não inventamos um número — fica
      // marcado como "sem preço" até alguém informar um valor real.
      const estimate = item.priced ? averagePrice * item.occurrences : 0;
      return { ...item, averagePrice, estimate };
    }).filter((item) => matchesTerm(item.name) || matchesTerm(item.category))
      .sort((a, b) => b.occurrences - a.occurrences || b.estimate - a.estimate);
  }, [paused, term]);

  const leader = pausedItems[0];
  const runnerUp = pausedItems[1];
  const hasCriticalOutlier = Boolean(leader && leader.occurrences >= 10 && leader.occurrences > (runnerUp?.occurrences || 0) && leader.occurrences >= (runnerUp?.occurrences || 1) * 1.5);
  const latestDate = dates.at(-1);
  const pausedOnLatestDate = new Set(paused.filter((row) => row.dia === latestDate).map((row) => normalize(`${row.item}|${row.categoria}`))).size;
  const actions = [
    hasCriticalOutlier && { level: 'critical', title: `Prioridade imediata: ${leader.name}`, text: `${leader.occurrences} pausas no período, bem acima dos demais itens. Valide estoque, cadastro e operação.` },
    pausedOnLatestDate > 0 && { level: 'attention', title: 'Revisar a carga mais recente', text: `${pausedOnLatestDate} item(ns) continuam pausados na última data selecionada.` },
    missingPausedPrices > 0 && { level: 'attention', title: 'Completar preços ausentes', text: `${missingPausedPrices} ocorrência(s) pausada(s) sem preço reduzem a precisão da estimativa.${!isAdmin ? ' Você pode informar o preço direto na lista abaixo.' : ''}` },
    pauseRate >= 20 && { level: 'critical', title: 'Plano de recuperação do cardápio', text: `${pauseRate}% das observações do período estão pausadas. Priorize os itens mais recorrentes.` },
    { level: 'ok', title: 'Acompanhar após a correção', text: 'Após reativar os itens, compare a próxima carga para confirmar que o status voltou a Ativo.' },
  ].filter(Boolean).slice(0, 4);

  const categoryBreakdown = useMemo(() => groupByKey(
    filteredRows.filter((row) => row.categoria),
    (row) => row.categoria,
    (row) => row.categoria,
  ).filter((entry) => matchesTerm(entry.label)).sort((a, b) => b.pausedSum - a.pausedSum), [filteredRows, term]);

  const forneriaBreakdown = useMemo(() => {
    const forneriaRows = filteredRows.filter((row) => forneriaFamilyOf(row.item));
    const byFamily = groupByKey(
      forneriaRows,
      (row) => forneriaFamilyOf(row.item),
      (row) => FORNERIA_FAMILIES.find((family) => family.id === forneriaFamilyOf(row.item))?.label || row.item,
    ).sort((a, b) => b.pausedSum - a.pausedSum);
    const totals = forneriaRows.reduce((sum, row) => {
      if (row.status === 'Ativo') sum.activeSum += Number(row.precoNum) || 0;
      if (row.status === 'Pausado') sum.pausedSum += Number(row.precoNum) || 0;
      return sum;
    }, { activeSum: 0, pausedSum: 0 });
    return { byFamily, totals, hasData: forneriaRows.length > 0 };
  }, [filteredRows]);

  return <div className="projection-page">
    <div className="network-hero"><div><span className="eyebrow">CENÁRIO OPERACIONAL ESTIMADO</span><h1>Potencial da operação</h1><p>Leitura do potencial de ganho e do impacto dos itens pausados no período selecionado.</p></div></div>

    <div className="projection-filters">
      {isAdmin && <div className="network-store-search"><input type="search" value={storeQuery} placeholder="Pesquisar uma unidade..." list="projection-store-options" onChange={(event) => setStoreQuery(event.target.value)} /><datalist id="projection-store-options">{allStores.map((store) => <option key={store} value={store} />)}</datalist>{storeTerm && <span>{stores.length} unidade(s) encontrada(s)</span>}</div>}
      <div className="network-store-search"><input type="search" value={itemQuery} placeholder="Pesquisar item ou categoria..." onChange={(event) => setItemQuery(event.target.value)} />{term && <span>filtrando itens, categorias e Forneria abaixo</span>}</div>
    </div>

    <div className="projection-warning"><strong>Estimativa, não faturamento real</strong><span>Cenário indicativo, não previsão contábil. Não considera quantidade por pedido, descontos, taxas, impostos ou demanda real.</span></div>

    <section className="projection-zone projection-gain-zone">
      <div className="projection-zone-heading"><span>01</span><div><small>POTENCIAL DE GANHO</small><h2>O que a operação pode capturar</h2><p>Itens ativos, preço médio cadastrado, unidades e datas selecionadas.</p></div></div>
      <div className="network-kpis">
        <Kpi label="Itens ativos identificados" value={active.length} icon="check" accent={C.green} accentBg={C.greenL} />
        <Kpi label="Unidades no cenário" value={storeCount} icon="store" accent={C.red} accentBg={C.redL} sub={storeTerm ? 'resultado da pesquisa' : 'escopo atual'} />
        <Kpi label="Preço médio dos ativos" value={brl(averageActiveTicket)} icon="item" accent={C.purple} accentBg={C.purpleL} sub={`${pricedActive.length} observações com preço`} />
        <Kpi label="Soma dos preços dos ativos" value={brl(activePriceSum)} icon="money" accent={C.teal} accentBg={C.tealL} sub="valor cadastral do cardápio ativo" small />
        <Kpi label="Potencial diário" value={brl(dailyPotential)} icon="money" accent={C.orange} accentBg={C.orangeL} sub={`${ordersPerDay} pedidos × ${storeCount} unidade(s)`} />
        <Kpi label="Potencial do período" value={brl(periodPotential)} icon="trophy" accent={C.green} accentBg={C.greenL} sub={`${analysisDays} dia(s) selecionado(s)`} />
      </div>
      <div className="network-panels"><Card><h2>Premissa ajustável</h2><label className="projection-field">Pedidos por dia<input type="number" min="1" max="1000" value={ordersPerDay} onChange={(event) => setOrdersPerDay(Math.max(1, Number(event.target.value) || 1))} /></label><p className="projection-disclaimer">O período usa automaticamente {analysisDays} data(s) do filtro global. "Potencial diário" estima receita por volume de pedidos; "Soma dos preços dos ativos" é o valor cadastral do cardápio hoje — são leituras diferentes de propósito.</p></Card><Card><h2>Itens ativos de maior preço</h2><HBar data={topActive} color={C.green} fmtVal={brl} />{!topActive.length && <div className="empty-state">Nenhum item ativo com preço encontrado.</div>}</Card></div>
    </section>

    <section className="projection-zone projection-loss-zone">
      <div className="projection-zone-heading"><span>02</span><div><small>IMPACTO DAS PAUSAS</small><h2>Onde o desempenho pode estar sendo prejudicado</h2><p>Frequência, abrangência e preços dentro das datas selecionadas.</p></div></div>
      <div className="network-kpis">
        <Kpi label="Ocorrências pausadas" value={paused.length} icon="pause" accent={C.red} accentBg={C.redL} sub={`${uniquePausedItems} item(ns) diferente(s)`} />
        <Kpi label="Taxa de pausas" value={`${pauseRate}%`} icon="alert" accent={pauseRate >= 20 ? C.red : C.amber} accentBg={pauseRate >= 20 ? C.redL : C.amberL} sub="sobre as observações do período" />
        <Kpi label="Preço médio dos pausados" value={brl(averagePausedTicket)} icon="item" accent={C.orange} accentBg={C.orangeL} sub={`${pricedPaused.length} pausas com preço`} />
        <Kpi label="Potencial em risco estimado" value={brl(potentialAtRisk)} icon="alert" accent={C.red} accentBg={C.redL} sub="soma do preço real de cada item pausado" />
        <Kpi label="Pausados sem preço" value={missingPausedPrices} icon="pause" accent={C.amber} accentBg={C.amberL} sub={!isAdmin ? 'informe o preço na lista abaixo' : 'reduz a precisão da estimativa'} small />
      </div>
      <div className="paused-impact-grid">
        <Card className="paused-ranking-card"><div className="paused-card-heading"><div><span className="eyebrow">MAIS RECORRENTES</span><h2>Itens que mais pausaram</h2></div>{hasCriticalOutlier && <b>Fora do padrão</b>}</div><div className="paused-item-cards">{pausedItems.slice(0, 8).map((item, index) => { const critical = hasCriticalOutlier && index === 0; return <article key={`${item.name}-${item.category}`} className={critical ? 'is-critical' : ''}><span className="paused-item-position">#{index + 1}</span><span><strong>{item.name}</strong><small>{item.category} · {item.dates.size} dia(s) · {item.stores.size} unidade(s)</small></span><span><b>{item.occurrences}×</b><small>pausado</small></span>{item.priced ? <span><b>{brl(item.estimate)}</b><small>{item.manual ? 'inclui preço ajustado' : 'impacto estimado'}</small></span> : <span className="paused-item-noprice"><b>Sem preço</b><PriceEditor item={item} isAdmin={isAdmin} onSaved={reloadOverrides} /></span>}</article>; })}{!pausedItems.length && <div className="empty-state">Nenhum item pausado no período selecionado.</div>}</div></Card>
        <Card className="action-plan-card"><span className="eyebrow">PLANO DE AÇÃO</span><h2>O que fazer agora</h2><div className="action-plan-list">{actions.map((action) => <article key={action.title} className={action.level}><i /><span><strong>{action.title}</strong><small>{action.text}</small></span></article>)}</div></Card>
      </div>
      <div className="projection-loss-disclaimer"><strong>Importante:</strong> Cenário indicativo, não previsão contábil. Não considera quantidade por pedido, descontos, taxas, impostos ou demanda real. Os valores servem para priorização operacional e não comprovam receita efetivamente perdida.</div>
    </section>

    <section className="projection-zone">
      <div className="projection-zone-heading"><span>03</span><div><small>POR CATEGORIA</small><h2>Onde focar dentro do cardápio</h2><p>Quanto cada categoria pode estar faturando (itens ativos) e perdendo (itens pausados), pelo preço cadastrado.</p></div></div>
      <div className="category-potential-table">
        <div className="category-potential-row category-potential-head"><span>Categoria</span><span>Ativos</span><span>Pode faturar</span><span>Pausados</span><span>Pode perder</span></div>
        {categoryBreakdown.slice(0, 12).map((entry) => (
          <div key={entry.key} className="category-potential-row">
            <span className="category-potential-name">{entry.label}</span>
            <span>{entry.active}</span>
            <span className="is-gain">{brl(entry.activeSum)}</span>
            <span>{entry.paused}</span>
            <span className="is-loss">{brl(entry.pausedSum)}</span>
          </div>
        ))}
        {!categoryBreakdown.length && <div className="empty-state">Nenhuma categoria encontrada neste filtro.</div>}
      </div>
    </section>

    {forneriaBreakdown.hasData && <section className="projection-zone">
      <div className="projection-zone-heading"><span>04</span><div><small>FORNERIA</small><h2>Quanto a Forneria pode faturar e perder</h2><p>Cannoli, Crostini, Palha Italiana, Brownie e Tiramisu no escopo selecionado.</p></div></div>
      <div className="network-kpis">
        <Kpi label="Forneria pode faturar" value={brl(forneriaBreakdown.totals.activeSum)} icon="bakery" accent={C.green} accentBg={C.greenL} sub="soma dos preços dos itens ativos" />
        <Kpi label="Forneria pode estar perdendo" value={brl(forneriaBreakdown.totals.pausedSum)} icon="bakery" accent={C.red} accentBg={C.redL} sub="soma dos preços dos itens pausados" />
      </div>
      <div className="category-potential-table">
        <div className="category-potential-row category-potential-head"><span>Produto</span><span>Ativos</span><span>Pode faturar</span><span>Pausados</span><span>Pode perder</span></div>
        {forneriaBreakdown.byFamily.map((entry) => (
          <div key={entry.key} className="category-potential-row">
            <span className="category-potential-name">{entry.label}</span>
            <span>{entry.active}</span>
            <span className="is-gain">{brl(entry.activeSum)}</span>
            <span>{entry.paused}</span>
            <span className="is-loss">{brl(entry.pausedSum)}</span>
          </div>
        ))}
      </div>
    </section>}
  </div>;
}
