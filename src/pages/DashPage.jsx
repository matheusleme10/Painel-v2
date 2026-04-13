import { useMemo } from 'react';
import { C } from '../constants.js';
import { Card } from '../components/ui/Card.jsx';
import { Kpi } from '../components/ui/Kpi.jsx';
import { Pill } from '../components/ui/Pill.jsx';
import { Ic } from '../components/ui/Icon.jsx';
import { Ring } from '../components/ui/charts/Ring.jsx';
import { Gauge } from '../components/ui/charts/Gauge.jsx';
import { HBar } from '../components/ui/charts/HBar.jsx';
import { AlertBanner } from '../components/ui/AlertBanner.jsx';
import { pct, brl, clamp } from '../utils/format.js';
import { parseDate } from '../utils/date.js';

export function DashPage({ all, today, lastDate }) {
  const total = today.length;
  const pausados = today.filter((r) => r.status === 'Pausado').length;
  const ativos = total - pausados;
  const disponib = pct(ativos, total);
  const lojas = [...new Set(today.map((r) => r.loja))];
  const risco = today
    .filter((r) => r.status === 'Pausado' && r.precoNum > 0)
    .reduce((s, r) => s + r.precoNum, 0);

  const { lojaStats, mediaRede, criticas, itemMap, sistematicos, dias } = useMemo(() => {
    const lojaMap = {};
    today.forEach((r) => {
      if (!lojaMap[r.loja]) lojaMap[r.loja] = { t: 0, p: 0 };
      lojaMap[r.loja].t++;
      if (r.status === 'Pausado') lojaMap[r.loja].p++;
    });
    const lojaStats = Object.entries(lojaMap).map(([n, v]) => ({
      n,
      score: pct(v.t - v.p, v.t),
      p: v.p,
    }));
    const mediaRede = Math.round(lojaStats.reduce((s, l) => s + l.score, 0) / (lojaStats.length || 1));
    const criticas = lojaStats.filter((l) => l.score < 60).length;

    const itemMap = {};
    today
      .filter((r) => r.status === 'Pausado')
      .forEach((r) => {
        if (!itemMap[r.item])
          itemMap[r.item] = { n: r.item, v: 0, risco: 0, lojas: new Set(), cat: r.categoria };
        itemMap[r.item].v++;
        itemMap[r.item].risco += r.precoNum;
        itemMap[r.item].lojas.add(r.loja);
      });
    const sistematicos = Object.values(itemMap)
      .filter((x) => x.lojas.size > 1)
      .sort((a, b) => b.lojas.size - a.lojas.size);

    const diaMap = {};
    all.filter((r) => r.status === 'Pausado').forEach((r) => {
      if (r.dia) diaMap[r.dia] = (diaMap[r.dia] || 0) + 1;
    });
    const dias = Object.entries(diaMap).sort((a, b) => {
      const da = parseDate(a[0]);
      const db = parseDate(b[0]);
      return !da || !db ? 0 : da - db;
    });

    return { lojaStats, mediaRede, criticas, itemMap, sistematicos, dias };
  }, [all, today]);

  const topRisco = Object.values(itemMap)
    .filter((x) => x.risco > 0)
    .sort((a, b) => b.risco - a.risco)
    .slice(0, 5);

  const alerts = [];
  if (criticas > 0)
    alerts.push({
      lvl: 'crit',
      msg: `${criticas} franquia${criticas > 1 ? 's' : ''} com disponibilidade abaixo de 60%`,
    });
  if (pct(pausados, total) > 30)
    alerts.push({
      lvl: 'crit',
      msg: `${pct(pausados, total)}% dos itens pausados — acima do limite recomendado de 30%`,
    });
  if (sistematicos.length > 0)
    alerts.push({
      lvl: 'warn',
      msg: `"${sistematicos[0].n}" pausado em ${sistematicos[0].lojas.size} franquias — possível problema de fornecedor`,
    });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '7px 13px',
          background: C.blueL,
          borderRadius: 10,
          border: `1px solid ${C.blueM}`,
          fontSize: 12,
          color: C.blue,
          fontWeight: 600,
          alignSelf: 'flex-start',
        }}
      >
        <Ic n="network" s={13} c={C.blue} />
        Dados de: <b>{lastDate || 'todos'}</b> &nbsp;·&nbsp; {lojas.length} franquias &nbsp;·&nbsp;
        {total} itens
      </div>

      <AlertBanner items={alerts} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12 }}>
        <Kpi
          label="Disponibilidade da Rede"
          value={`${disponib}%`}
          icon="check"
          accent={disponib >= 80 ? C.green : disponib >= 60 ? C.amber : C.red}
          accentBg={disponib >= 80 ? C.greenL : disponib >= 60 ? C.amberL : C.redL}
          sub={`Média: ${mediaRede}% entre ${lojas.length} franquias`}
        />
        <Kpi
          label="Itens Pausados"
          value={pausados}
          icon="pause"
          accent={C.red}
          accentBg={C.redL}
          sub={`${pct(pausados, total)}% do catálogo`}
        />
        <Kpi
          label="Receita em Risco"
          value={brl(risco)}
          icon="money"
          accent={C.orange}
          accentBg={C.orangeL}
          sub="soma dos preços pausados"
          small
        />
        <Kpi
          label="Franquias Críticas"
          value={criticas}
          icon="alert"
          accent={criticas > 0 ? C.red : C.green}
          accentBg={criticas > 0 ? C.redL : C.greenL}
          sub="< 60% de disponibilidade"
        />
        <Kpi
          label="Itens Sistêmicos"
          value={sistematicos.length}
          icon="fire"
          accent={C.purple}
          accentBg={C.purpleL}
          sub="pausados em 2+ franquias"
        />
        <Kpi
          label="Itens Únicos Pausados"
          value={Object.keys(itemMap).length}
          icon="item"
          accent={C.blue}
          accentBg={C.blueL}
          sub={`de ${[...new Set(today.map((r) => r.item))].length} itens totais`}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(270px,1fr))', gap: 16 }}>
        <Card>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>
            Saúde Geral da Rede
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
            <Gauge value={disponib} />
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            {[
              ['Ótimo', '≥80%', C.green, C.greenL],
              [' Atenção', '60-79%', C.amber, C.amberL],
              ['Crítico', '<60%', C.red, C.redL],
            ].map(([l, r, c, bg]) => (
              <div key={l} style={{ flex: 1, background: bg, borderRadius: 8, padding: '7px 10px', textAlign: 'center' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: c }}>{l}</div>
                <div style={{ fontSize: 10, color: C.muted }}>{r}</div>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>
            🔥 Top Itens por Receita em Risco
          </div>
          {topRisco.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {topRisco.map((d, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '9px 11px',
                    background: i === 0 ? C.orangeL : C.bg,
                    borderRadius: 9,
                    border: i === 0 ? `1px solid ${C.orangeM}` : 'none',
                  }}
                >
                  <div
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: '50%',
                      background: i === 0 ? C.orange : C.muted,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <span style={{ fontSize: 10, fontWeight: 900, color: 'white' }}>{i + 1}</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: C.text,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {d.n}
                    </div>
                    <div style={{ fontSize: 10, color: C.muted }}>
                      {d.cat} · {d.lojas.size} franquia{d.lojas.size > 1 ? 's' : ''}
                    </div>
                  </div>
                  <Pill color={C.orange} bg={C.orangeL} s={11}>
                    {brl(d.risco)}
                  </Pill>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ color: C.muted, fontSize: 12, textAlign: 'center', padding: 20 }}>
              Nenhum preço disponível nos dados
            </div>
          )}
        </Card>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(270px,1fr))', gap: 16 }}>
        <Card>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>
            Top Itens Pausados na Rede
          </div>
          <HBar
            data={Object.values(itemMap)
              .sort((a, b) => b.v - a.v)
              .slice(0, 8)
              .map((x) => ({ n: x.n, v: x.v }))}
            maxItems={8}
            color={(d, i) => {
              const colors = [C.red, C.blue, C.amber, C.green, C.purple, C.orange, C.teal, '#BE185D'];
              return colors[i % colors.length];
            }}
          />
        </Card>
        <Card>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>⚠ Itens Sistêmicos</div>
          <div style={{ fontSize: 11, color: C.muted, marginBottom: 12 }}>
            Pausados em múltiplas franquias — indicam problema de fornecedor ou operação
          </div>
          {sistematicos.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {sistematicos.slice(0, 7).map((d, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 9,
                    padding: '8px 11px',
                    background: d.lojas.size >= 3 ? C.redL : C.amberL,
                    borderRadius: 9,
                  }}
                >
                  <Ic n="alert" s={14} c={d.lojas.size >= 3 ? C.red : C.amber} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: C.text,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {d.n}
                    </div>
                    <div style={{ fontSize: 10, color: C.muted }}>{d.cat}</div>
                  </div>
                  <Pill color={d.lojas.size >= 3 ? C.red : C.amber} bg={d.lojas.size >= 3 ? C.redM : 'transparent'} s={10}>
                    {d.lojas.size} lojas
                  </Pill>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: 'center', color: C.green, padding: 20, fontWeight: 600 }}>
              ✓ Nenhum item sistêmico hoje
            </div>
          )}
        </Card>
      </div>

      {dias.length > 1 && (
        <Card>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>
            Histórico — Itens Pausados por Dia
          </div>
          <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', height: 96, overflowX: 'auto', paddingBottom: 4 }}>
            {dias.map(([d, v], i) => {
              const maxV = Math.max(...dias.map((x) => x[1]));
              const h = clamp(Math.round((v / maxV) * 76), 4, 76);
              const isLast = d === lastDate;
              return (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, minWidth: 44 }}>
                  <div style={{ fontSize: 9, color: isLast ? C.red : C.muted, fontWeight: isLast ? 900 : 400 }}>
                    {v}
                  </div>
                  <div
                    style={{
                      width: 32,
                      height: h,
                      background: isLast ? C.red : C.blueM,
                      borderRadius: '4px 4px 0 0',
                      border: isLast ? `2px solid ${C.red2}` : 'none',
                    }}
                  />
                  <div style={{ fontSize: 8, color: isLast ? C.red : C.muted, textAlign: 'center', whiteSpace: 'nowrap', fontWeight: isLast ? 700 : 400 }}>
                    {d.slice(0, 6)}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
