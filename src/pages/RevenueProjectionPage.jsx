import { useMemo, useState } from 'react';
import { C } from '../constants.js';
import { Card } from '../components/ui/Card.jsx';
import { Kpi } from '../components/ui/Kpi.jsx';
import { HBar } from '../components/ui/charts/HBar.jsx';
import { brl } from '../utils/format.js';
import { rowsByStatus } from '../utils/analytics.js';

const normalize = (value) => String(value || '')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase('pt-BR').replace(/[^a-z0-9]+/g, ' ').trim();

export function RevenueProjectionPage({ rows, summaryRows = [], isAdmin = false }) {
  const [ordersPerDay, setOrdersPerDay] = useState(30);
  const [days, setDays] = useState(30);
  const [query, setQuery] = useState('');
  const term = normalize(query);
  const filteredRows = useMemo(() => (
    term ? rows.filter((row) => normalize(row.loja).includes(term)) : rows
  ), [rows, term]);
  const allStores = useMemo(() => [...new Set(rows.map((row) => row.loja).filter(Boolean))].sort(), [rows]);
  const stores = useMemo(() => [...new Set(filteredRows.map((row) => row.loja).filter(Boolean))], [filteredRows]);
  const active = useMemo(() => rowsByStatus(filteredRows, 'Ativo'), [filteredRows]);
  const paused = useMemo(() => rowsByStatus(filteredRows, 'Pausado'), [filteredRows]);
  const priced = active.filter((row) => row.precoNum > 0);
  const averageTicket = priced.length
    ? priced.reduce((sum, row) => sum + row.precoNum, 0) / priced.length
    : 0;
  const storeCount = stores.length;
  const dailyPotential = averageTicket * ordersPerDay * storeCount;
  const monthlyPotential = dailyPotential * days;
  const pausedOccurrences = paused.length;
  const totalOccurrences = filteredRows.length;
  const potentialAtRisk = averageTicket * pausedOccurrences;
  const top = [...priced].sort((a, b) => b.precoNum - a.precoNum).slice(0, 8)
    .map((row) => ({ n: row.item, v: row.precoNum }));
  const topEstimatedLosses = useMemo(() => {
    const map = new Map();
    paused.forEach((row) => {
      if (!row.item) return;
      const key = normalize(`${row.item} ${row.categoria}`);
      const item = map.get(key) || { name: row.item, category: row.categoria || 'Sem categoria', occurrences: 0, priceSum: 0, priced: 0, stores: new Set() };
      item.occurrences += 1;
      item.stores.add(row.loja);
      if (Number(row.precoNum) > 0) { item.priceSum += Number(row.precoNum); item.priced += 1; }
      map.set(key, item);
    });
    const values = [...map.values()].map((item) => ({
      ...item,
      averagePrice: item.priced ? item.priceSum / item.priced : 0,
      weight: item.occurrences * (item.priced ? item.priceSum / item.priced : averageTicket),
    }));
    const totalWeight = values.reduce((sum, item) => sum + item.weight, 0);
    return values.map((item) => ({ ...item, estimate: totalWeight ? potentialAtRisk * item.weight / totalWeight : 0 }))
      .sort((a, b) => b.estimate - a.estimate).slice(0, 10);
  }, [paused, averageTicket, potentialAtRisk]);

  return (
    <div className="projection-page">
      <div className="network-hero">
        <div>
          <span className="eyebrow">CENÁRIO COM ITENS ATIVOS</span>
          <h1>Potencial de faturamento</h1>
          <p>Estimativa baseada somente no preço médio dos itens ativos e no volume informado por você.</p>
        </div>
      </div>
      {isAdmin && (
        <div className="network-store-search">
          <input type="search" value={query} placeholder="Pesquisar uma unidade..."
            list="projection-store-options" onChange={(event) => setQuery(event.target.value)} />
          <datalist id="projection-store-options">
            {allStores.map((store) => <option key={store} value={store} />)}
          </datalist>
          {term && <span>{stores.length} unidade(s) encontrada(s)</span>}
        </div>
      )}
      <div className="network-kpis">
        <Kpi label="Itens ativos identificados" value={active.length} icon="check" accent={C.green} accentBg={C.greenL} />
        <Kpi label="Unidades no cenário" value={storeCount} icon="store" accent={C.red} accentBg={C.redL} sub={term ? 'resultado da pesquisa' : 'rede no filtro atual'} />
        <Kpi label="Ativos com preço" value={priced.length} icon="money" accent={C.blue} accentBg={C.blueL} sub={`${active.length ? Math.round(priced.length / active.length * 100) : 0}% de cobertura`} />
        <Kpi label="Ticket médio ativo estimado" value={brl(averageTicket)} icon="item" accent={C.purple} accentBg={C.purpleL} sub="média simples dos preços ativos" />
        <Kpi label="Potencial diário" value={brl(dailyPotential)} icon="money" accent={C.orange} accentBg={C.orangeL} sub={`${ordersPerDay} pedidos × ${storeCount} unidade(s)`} />
        <Kpi label="Potencial do período" value={brl(monthlyPotential)} icon="trophy" accent={C.green} accentBg={C.greenL} />
        <Kpi label="Potencial em risco estimado" value={brl(potentialAtRisk)} icon="alert" accent={C.red} accentBg={C.redL}
          sub={`${pausedOccurrences} pausas · ${totalOccurrences ? Math.round(pausedOccurrences / totalOccurrences * 100) : 0}% das observações`} />
      </div>
      <div className="network-panels">
        <Card>
          <h2>Premissas do cenário</h2>
          <label className="projection-field">Pedidos por dia
            <input type="number" min="1" max="1000" value={ordersPerDay} onChange={(event) => setOrdersPerDay(Math.max(1, Number(event.target.value) || 1))} />
          </label>
          <label className="projection-field">Dias de operação
            <input type="number" min="1" max="366" value={days} onChange={(event) => setDays(Math.max(1, Number(event.target.value) || 1))} />
          </label>
          <p className="projection-disclaimer">Cenário indicativo, não previsão contábil. Não considera quantidade por pedido, descontos, taxas, impostos ou demanda real.</p>
          <p className="projection-disclaimer">
            O ticket médio ativo é a soma dos preços dos itens ativos dividida pela quantidade de itens ativos com preço.
            Sem pedidos e quantidades vendidas no XLSX, ele é uma aproximação de preço médio, não o ticket real do iFood.
          </p>
        </Card>
        <Card><h2>Itens ativos de maior preço</h2><HBar data={top} color={C.green} fmtVal={brl} /></Card>
      </div>
      {isAdmin && (
        <Card className="estimated-loss-card">
          <div className="estimated-loss-heading">
            <div><span className="eyebrow">OPORTUNIDADE ESTIMADA</span><h2>Itens com maior potencial em risco</h2></div>
            <p>Estimativa proporcional às ocorrências pausadas, aos preços cadastrados e às premissas desta página. Não é faturamento perdido real.</p>
          </div>
          <div className="estimated-loss-list">
            {topEstimatedLosses.map((item, index) => (
              <article key={`${item.name}-${item.category}`}>
                <span className="estimated-loss-rank">#{index + 1}</span>
                <span><strong>{item.name}</strong><small>{item.category} · {item.occurrences} pausa(s) · {item.stores.size} unidade(s)</small></span>
                <span><small>Preço médio cadastrado</small><b>{item.averagePrice ? brl(item.averagePrice) : 'Sem preço'}</b></span>
                <span><small>Potencial em risco</small><b>{brl(item.estimate)} <em>estimado</em></b></span>
              </article>
            ))}
            {!topEstimatedLosses.length && <div className="empty-state">Nenhum item pausado com dados suficientes neste filtro.</div>}
          </div>
        </Card>
      )}
    </div>
  );
}
