import { useMemo, useState } from 'react';
import { C } from '../constants.js';
import { Card } from '../components/ui/Card.jsx';
import { Kpi } from '../components/ui/Kpi.jsx';
import { HBar } from '../components/ui/charts/HBar.jsx';
import { DraftPriceField } from '../components/ui/DraftPriceField.jsx';
import { brl } from '../utils/format.js';
import { rowsByStatus } from '../utils/analytics.js';
import { forneriaFamilyOf, FORNERIA_FAMILIES } from '../utils/forneria.js';

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

export function PotentialPageV2({ rows, shift = 'Jantar', isAdmin = false, onSetDraft }) {
  const [ordersPerDay, setOrdersPerDay] = useState(30);
  const [storeQuery, setStoreQuery] = useState('');
  const [itemQuery, setItemQuery] = useState('');
  const [showOnlyPriced, setShowOnlyPriced] = useState(false);
  const [applyNetworkWide, setApplyNetworkWide] = useState(false);

  const storeTerm = normalize(storeQuery);
  const filteredRows = useMemo(() => storeTerm ? rows.filter((row) => normalize(row.loja).includes(storeTerm)) : rows, [rows, storeTerm]);
  const allStores = useMemo(() => [...new Set(rows.map((row) => row.loja).filter(Boolean))].sort(), [rows]);
  const stores = useMemo(() => [...new Set(filteredRows.map((row) => row.loja).filter(Boolean))], [filteredRows]);
  const dates = useMemo(() => [...new Set(filteredRows.map((row) => row.dia).filter(Boolean))].sort(), [filteredRows]);
  const active = useMemo(() => rowsByStatus(filteredRows, 'Ativo'), [filteredRows]);
  const paused = useMemo(() => rowsByStatus(filteredRows, 'Pausado'), [filteredRows]);
  const pricedActive = active.filter((row) => Number(row.precoNum) > 0);
  const pricedPaused = paused.filter((row) => Number(row.precoNum) > 0);
  // Métricas cadastrais usam um item uma vez por unidade. Sem essa
  // deduplicação, selecionar 14 dias multiplicava artificialmente tanto a
  // contagem quanto a soma dos preços por 14.
  const activeCatalog = new Map();
  pricedActive.forEach((row) => {
    const key = `${normalize(row.loja)}|${normalize(row.item)}|${normalize(row.categoria)}`;
    const entry = activeCatalog.get(key) || { sum: 0, count: 0 };
    entry.sum += Number(row.precoNum);
    entry.count += 1;
    activeCatalog.set(key, entry);
  });
  const activeCatalogPrices = [...activeCatalog.values()].map((entry) => entry.sum / entry.count);
  const uniqueActiveItems = new Set(active.map((row) => normalize(`${row.item}|${row.categoria}`))).size;
  const averageActiveTicket = activeCatalogPrices.length ? activeCatalogPrices.reduce((sum, price) => sum + price, 0) / activeCatalogPrices.length : 0;
  const averagePausedTicket = pricedPaused.length ? pricedPaused.reduce((sum, row) => sum + Number(row.precoNum), 0) / pricedPaused.length : 0;
  const activePriceSum = activeCatalogPrices.reduce((sum, price) => sum + price, 0);
  const pausedPriceSum = pricedPaused.reduce((sum, row) => sum + Number(row.precoNum), 0);
  const storeCount = stores.length;
  const analysisDays = Math.max(1, dates.length);
  const scenarioShifts = shift === 'Ambos' ? ['Almoço', 'Jantar'] : [shift];
  const potentialByShift = scenarioShifts.map((scenarioShift) => {
    const shiftRows = pricedActive.filter((row) => row.shift === scenarioShift || (!row.shift && scenarioShifts.length === 1));
    const catalog = new Map();
    shiftRows.forEach((row) => {
      const key = `${normalize(row.loja)}|${normalize(row.item)}|${normalize(row.categoria)}`;
      const entry = catalog.get(key) || { sum: 0, count: 0 };
      entry.sum += Number(row.precoNum);
      entry.count += 1;
      catalog.set(key, entry);
    });
    const prices = [...catalog.values()].map((entry) => entry.sum / entry.count);
    const average = prices.length ? prices.reduce((sum, price) => sum + price, 0) / prices.length : 0;
    const units = new Set(shiftRows.map((row) => row.loja).filter(Boolean)).size;
    return { shift: scenarioShift, value: average * ordersPerDay * units };
  });
  const dailyPotential = potentialByShift.reduce((sum, entry) => sum + entry.value, 0);
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
      const name = String(row.item || '').trim();
      if (!name) return;
      const key = normalize(name);
      const entry = map.get(key) || { name, sum: 0, count: 0 };
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
      // ajustado localmente). Sem preço, não inventamos um número — fica
      // marcado como "sem preço" até alguém informar um valor.
      const estimate = item.priced ? averagePrice * item.occurrences : 0;
      return { ...item, averagePrice, estimate };
    }).filter((item) => matchesTerm(item.name) || matchesTerm(item.category))
      .sort((a, b) => b.occurrences - a.occurrences || b.estimate - a.estimate);
  }, [paused, term]);

  const visiblePausedItems = showOnlyPriced ? pausedItems.filter((item) => item.priced) : pausedItems;
  const hiddenByPricedFilter = pausedItems.length - visiblePausedItems.length;

  const leader = pausedItems[0];
  const runnerUp = pausedItems[1];
  const hasCriticalOutlier = Boolean(leader && leader.occurrences >= 10 && leader.occurrences > (runnerUp?.occurrences || 0) && leader.occurrences >= (runnerUp?.occurrences || 1) * 1.5);
  const latestDate = dates.at(-1);
  const pausedOnLatestDate = new Set(paused.filter((row) => row.dia === latestDate).map((row) => normalize(`${row.item}|${row.categoria}`))).size;
  const actions = [
    hasCriticalOutlier && { level: 'critical', title: `Prioridade imediata: ${leader.name}`, text: `${leader.occurrences} pausas no período, bem acima dos demais itens. Valide estoque, cadastro e operação.` },
    pausedOnLatestDate > 0 && { level: 'attention', title: 'Revisar a carga mais recente', text: `${pausedOnLatestDate} item(ns) continuam pausados na última data selecionada.` },
    missingPausedPrices > 0 && { level: 'attention', title: 'Completar preços ausentes', text: `${missingPausedPrices} ocorrência(s) pausada(s) sem preço reduzem a precisão da estimativa. Você pode informar o preço direto na lista abaixo.` },
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
      const price = Number(row.precoNum) || 0;
      sum.total += 1;
      sum.items.add(normalize(row.item));
      if (row.status === 'Ativo') { sum.active += 1; sum.activeSum += price; if (price > 0) sum.pricedActive += 1; }
      if (row.status === 'Pausado') { sum.paused += 1; sum.pausedSum += price; if (price > 0) sum.pricedPaused += 1; }
      if (!(price > 0)) sum.missingPrice += 1;
      return sum;
    }, { total: 0, active: 0, paused: 0, activeSum: 0, pausedSum: 0, pricedActive: 0, pricedPaused: 0, missingPrice: 0, items: new Set() });
    totals.pauseRate = totals.total ? Math.round(totals.paused / totals.total * 100) : 0;
    totals.averageActive = totals.pricedActive ? totals.activeSum / totals.pricedActive : 0;
    totals.averagePaused = totals.pricedPaused ? totals.pausedSum / totals.pricedPaused : 0;
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
        <Kpi label="Itens ativos distintos" value={uniqueActiveItems} icon="check" accent={C.green} accentBg={C.greenL} sub={`${active.length} observações no período`} />
        <Kpi label="Unidades no cenário" value={storeCount} icon="store" accent={C.red} accentBg={C.redL} sub={storeTerm ? 'resultado da pesquisa' : 'escopo atual'} />
        <Kpi label="Preço médio do cardápio ativo" value={brl(averageActiveTicket)} icon="item" accent={C.purple} accentBg={C.purpleL} sub={`${activeCatalogPrices.length} item(ns)-unidade com preço`} />
        <Kpi label="Valor cadastral ativo" value={brl(activePriceSum)} icon="money" accent={C.teal} accentBg={C.tealL} sub="cada item contado uma vez por unidade" small />
        <Kpi label="Cenário diário (1 item/pedido)" value={brl(dailyPotential)} icon="money" accent={C.orange} accentBg={C.orangeL} sub={shift === 'Ambos' ? `Almoço ${brl(potentialByShift[0]?.value || 0)} + Jantar ${brl(potentialByShift[1]?.value || 0)}` : `${ordersPerDay} pedidos × ${storeCount} unidade(s) · ${shift}`} />
        <Kpi label="Cenário do período" value={brl(periodPotential)} icon="trophy" accent={C.green} accentBg={C.greenL} sub={`${analysisDays} dia(s) selecionado(s)`} />
      </div>
      <div className="network-panels"><Card><h2>Premissa ajustável</h2><label className="projection-field">Pedidos por dia por turno<input type="number" min="1" max="1000" value={ordersPerDay} onChange={(event) => setOrdersPerDay(Math.max(1, Number(event.target.value) || 1))} /></label><p className="projection-disclaimer">O período usa automaticamente {analysisDays} data(s) do filtro global. Em "Ambos", o cenário soma Almoço + Jantar. O cálculo assume 1 item por pedido e o mesmo volume informado em cada turno.</p></Card><Card><h2>Itens ativos de maior preço</h2><HBar data={topActive} color={C.green} fmtVal={brl} />{!topActive.length && <div className="empty-state">Nenhum item ativo com preço encontrado.</div>}</Card></div>
    </section>

    <section className="projection-zone projection-loss-zone">
      <div className="projection-zone-heading"><span>02</span><div><small>IMPACTO DAS PAUSAS</small><h2>Onde o desempenho pode estar sendo prejudicado</h2><p>Frequência, abrangência e preços dentro das datas selecionadas.</p></div></div>
      <div className="network-kpis">
        <Kpi label="Ocorrências pausadas" value={paused.length} icon="pause" accent={C.red} accentBg={C.redL} sub={`${uniquePausedItems} item(ns) diferente(s)`} />
        <Kpi label="Taxa de pausas" value={`${pauseRate}%`} icon="alert" accent={pauseRate >= 20 ? C.red : C.amber} accentBg={pauseRate >= 20 ? C.redL : C.amberL} sub="sobre as observações do período" />
        <Kpi label="Preço médio dos pausados" value={brl(averagePausedTicket)} icon="item" accent={C.orange} accentBg={C.orangeL} sub={`${pricedPaused.length} pausas com preço`} />
        <Kpi label="Potencial em risco estimado" value={brl(potentialAtRisk)} icon="alert" accent={C.red} accentBg={C.redL} sub="soma do preço real de cada item pausado" />
        <Kpi label="Pausados sem preço" value={missingPausedPrices} icon="pause" accent={C.amber} accentBg={C.amberL} sub="informe o preço na lista abaixo" small />
      </div>
      <div className="paused-impact-grid">
        <Card className="paused-ranking-card">
          <div className="paused-card-heading"><div><span className="eyebrow">MAIS RECORRENTES</span><h2>Itens que mais pausaram</h2></div>{hasCriticalOutlier && <b>Fora do padrão</b>}</div>
          <div className="draft-price-toolbar">
            <label className="draft-price-toggle">
              <input type="checkbox" checked={showOnlyPriced} onChange={(event) => setShowOnlyPriced(event.target.checked)} />
              Mostrar só os itens com preço
            </label>
            {isAdmin && (
              <label className="draft-price-toggle">
                <input type="checkbox" checked={applyNetworkWide} onChange={(event) => setApplyNetworkWide(event.target.checked)} />
                Aplicar preço em todas as unidades
              </label>
            )}
          </div>
          {(showOnlyPriced ? hiddenByPricedFilter > 0 : missingPausedPrices > 0) && (
            <p className="draft-price-note">
              {showOnlyPriced
                ? `${hiddenByPricedFilter} item(ns) sem preço estão ocultos da lista abaixo.`
                : `${missingPausedPrices} ocorrência(s) sem preço não entram nas somas e médias — marque "mostrar só os itens com preço" pra ver a lista sem elas.`}
            </p>
          )}
          <div className="paused-item-cards">
            {visiblePausedItems.slice(0, 8).map((item, index) => {
              const critical = hasCriticalOutlier && pausedItems[0] === item;
              const needsInput = !item.priced || item.manual;
              return (
                <article key={`${item.name}-${item.category}`} className={critical ? 'is-critical' : ''}>
                  <span className="paused-item-position">#{index + 1}</span>
                  <span><strong>{item.name}</strong><small>{item.category} · {item.dates.size} dia(s) · {item.stores.size} unidade(s)</small></span>
                  <span><b>{item.occurrences}×</b><small>pausado</small></span>
                  {item.priced
                    ? <span className={item.manual ? 'paused-item-manual' : ''}>
                        <b>{brl(item.estimate)}</b>
                        <small>{item.manual ? 'valor local (não salvo)' : 'impacto estimado'}</small>
                        {needsInput && <DraftPriceField itemName={item.name} stores={item.stores} isAdmin={isAdmin} networkWide={applyNetworkWide} onChange={onSetDraft} compact />}
                      </span>
                    : <span className="paused-item-noprice">
                        <b>Sem preço</b>
                        <DraftPriceField itemName={item.name} stores={item.stores} isAdmin={isAdmin} networkWide={applyNetworkWide} onChange={onSetDraft} compact />
                      </span>}
                </article>
              );
            })}
            {!visiblePausedItems.length && <div className="empty-state">Nenhum item pausado no período selecionado.</div>}
          </div>
        </Card>
        <Card className="action-plan-card"><span className="eyebrow">PLANO DE AÇÃO</span><h2>O que fazer agora</h2><div className="action-plan-list">{actions.map((action) => <article key={action.title} className={action.level}><i /><span><strong>{action.title}</strong><small>{action.text}</small></span></article>)}</div></Card>
      </div>
      <div className="projection-loss-disclaimer"><strong>Importante:</strong> Cenário indicativo, não previsão contábil. Não considera quantidade por pedido, descontos, taxas, impostos ou demanda real. Os valores servem para priorização operacional e não comprovam receita efetivamente perdida.</div>
    </section>

    <section className="projection-zone">
      <div className="projection-zone-heading"><span>03</span><div><small>POR CATEGORIA</small><h2>Onde focar dentro do cardápio</h2><p>Quanto cada categoria pode estar faturando (itens ativos) e perdendo (itens pausados), pelo preço cadastrado.</p></div></div>
      <div className="category-potential-table">
        <div className="category-potential-row category-potential-head"><span>Categoria</span><span>Ativos</span><span>Soma ativa observada</span><span>Pausados</span><span>Soma pausada observada</span></div>
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
      <div className="projection-zone-heading"><span>04</span><div><small>FORNERIA</small><h2>Exposição cadastral da Forneria</h2><p>Cannoli, Crostini, Palha Italiana, Brownie e Tiramisu no escopo selecionado.</p></div></div>
      <div className="network-kpis">
        <Kpi label="Produtos distintos da Forneria" value={forneriaBreakdown.totals.items.size} icon="bakery" accent={C.purple} accentBg={C.purpleL} />
        <Kpi label="Ocorrências ativas" value={forneriaBreakdown.totals.active} icon="check" accent={C.green} accentBg={C.greenL} />
        <Kpi label="Ocorrências pausadas" value={forneriaBreakdown.totals.paused} icon="pause" accent={C.red} accentBg={C.redL} />
        <Kpi label="Taxa de pausa da Forneria" value={`${forneriaBreakdown.totals.pauseRate}%`} icon="alert" accent={forneriaBreakdown.totals.pauseRate >= 20 ? C.red : C.amber} accentBg={forneriaBreakdown.totals.pauseRate >= 20 ? C.redL : C.amberL} sub="pausas ÷ observações" />
        <Kpi label="Preço médio ativo" value={brl(forneriaBreakdown.totals.averageActive)} icon="item" accent={C.green} accentBg={C.greenL} sub={`${forneriaBreakdown.totals.pricedActive} observações com preço`} />
        <Kpi label="Preço médio pausado" value={brl(forneriaBreakdown.totals.averagePaused)} icon="item" accent={C.orange} accentBg={C.orangeL} sub={`${forneriaBreakdown.totals.pricedPaused} observações com preço`} />
        <Kpi label="Ocorrências sem preço" value={forneriaBreakdown.totals.missingPrice} icon="alert" accent={C.amber} accentBg={C.amberL} sub="revisar cadastro" />
        <Kpi label="Soma ativa observada" value={brl(forneriaBreakdown.totals.activeSum)} icon="bakery" accent={C.green} accentBg={C.greenL} sub="não representa faturamento realizado" />
        <Kpi label="Soma pausada observada" value={brl(forneriaBreakdown.totals.pausedSum)} icon="bakery" accent={C.red} accentBg={C.redL} sub="não representa venda perdida" />
      </div>
      <div className="category-potential-table">
        <div className="category-potential-row category-potential-head"><span>Produto</span><span>Ativos</span><span>Soma ativa</span><span>Pausados</span><span>Soma pausada</span></div>
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
