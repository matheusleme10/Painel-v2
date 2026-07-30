import { useMemo, useState } from 'react';
import { C } from '../constants.js';
import { Card } from '../components/ui/Card.jsx';
import { Kpi } from '../components/ui/Kpi.jsx';
import { HBar } from '../components/ui/charts/HBar.jsx';
import { brl } from '../utils/format.js';
import { rowsByStatus } from '../utils/analytics.js';

export function RevenueProjectionPage({ rows, summaryRows = [] }) {
  const [ordersPerDay, setOrdersPerDay] = useState(30);
  const [days, setDays] = useState(30);
  const active = useMemo(() => rowsByStatus(rows, 'Ativo'), [rows]);
  const priced = active.filter((row) => row.precoNum > 0);
  const averageTicket = priced.length
    ? priced.reduce((sum, row) => sum + row.precoNum, 0) / priced.length
    : 0;
  const dailyPotential = averageTicket * ordersPerDay;
  const monthlyPotential = dailyPotential * days;
  const pausedOccurrences = summaryRows.reduce((sum, row) => sum + (Number(row.unitPaused) || 0), 0);
  const totalOccurrences = summaryRows.reduce((sum, row) => sum + (Number(row.unitTotal) || 0), 0);
  const potentialAtRisk = averageTicket * pausedOccurrences;
  const top = [...priced].sort((a, b) => b.precoNum - a.precoNum).slice(0, 8)
    .map((row) => ({ n: row.item, v: row.precoNum }));

  return (
    <div className="projection-page">
      <div className="network-hero">
        <div>
          <span className="eyebrow">CENÁRIO COM ITENS ATIVOS</span>
          <h1>Potencial de faturamento</h1>
          <p>Estimativa baseada somente no preço médio dos itens ativos e no volume informado por você.</p>
        </div>
      </div>
      <div className="network-kpis">
        <Kpi label="Itens ativos identificados" value={active.length} icon="check" accent={C.green} accentBg={C.greenL} />
        <Kpi label="Ativos com preço" value={priced.length} icon="money" accent={C.blue} accentBg={C.blueL} sub={`${active.length ? Math.round(priced.length / active.length * 100) : 0}% de cobertura`} />
        <Kpi label="Ticket médio ativo estimado" value={brl(averageTicket)} icon="item" accent={C.purple} accentBg={C.purpleL} sub="média simples dos preços ativos" />
        <Kpi label="Potencial diário" value={brl(dailyPotential)} icon="money" accent={C.orange} accentBg={C.orangeL} />
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
    </div>
  );
}
