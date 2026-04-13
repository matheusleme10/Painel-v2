import { useMemo } from 'react';
import { C } from '../constants.js';
import { Card } from '../components/ui/Card.jsx';
import { Kpi } from '../components/ui/Kpi.jsx';
import { Pill } from '../components/ui/Pill.jsx';
import { Ic } from '../components/ui/Icon.jsx';
import { pct, brl, shortName } from '../utils/format.js';

export function AlertsPage({ today, all }) {
  const alerts = useMemo(() => {
    // Group alerts by priority
    const alerts = {
      critico: [],
      atencao: [],
      monitor: [],
    };

    // Build maps for analysis
    const lojaMap = {};
    const itemMap = {};
    const catMap = {};

    today.forEach((r) => {
      if (!lojaMap[r.loja]) {
        lojaMap[r.loja] = { t: 0, p: 0, a: 0 };
      }
      lojaMap[r.loja].t++;
      if (r.status === 'Pausado') {
        lojaMap[r.loja].p++;
      } else {
        lojaMap[r.loja].a++;
      }

      if (r.status === 'Pausado') {
        if (!itemMap[r.item]) {
          itemMap[r.item] = {
            n: r.item,
            cat: r.categoria,
            lojas: new Set(),
            risco: 0,
            pausados: 0,
          };
        }
        itemMap[r.item].lojas.add(r.loja);
        itemMap[r.item].risco += r.precoNum;
        itemMap[r.item].pausados++;

        if (!catMap[r.categoria]) {
          catMap[r.categoria] = { t: 0, p: 0, risco: 0 };
        }
        catMap[r.categoria].p++;
        catMap[r.categoria].risco += r.precoNum;
      }

      if (!catMap[r.categoria]) {
        catMap[r.categoria] = { t: 0, p: 0, risco: 0 };
      }
      catMap[r.categoria].t++;
    });

    // PRIORITY 1 - CRITICAL
    // Stores with score < 60%
    Object.entries(lojaMap).forEach(([loja, stats]) => {
      const score = pct(stats.a, stats.t);
      if (score < 60) {
        alerts.critico.push({
          type: 'store',
          loja,
          score,
          paused: stats.p,
          msg: `Franquia ${loja} com disponibilidade crítica: ${score}% — ${stats.p} itens pausados`,
        });
      }
    });

    // Items paused in 3+ franchises
    Object.values(itemMap).forEach((item) => {
      if (item.lojas.size >= 3) {
        alerts.critico.push({
          type: 'systemic',
          item: item.n,
          lojas: item.lojas.size,
          risco: item.risco,
          msg: `Item sistêmico: '${item.n}' pausado em ${item.lojas.size} franquias — risco ${brl(item.risco)}`,
        });
      }
    });

    // PRIORITY 2 - ATTENTION
    // Stores with score 60-79%
    Object.entries(lojaMap).forEach(([loja, stats]) => {
      const score = pct(stats.a, stats.t);
      if (score >= 60 && score < 80) {
        alerts.atencao.push({
          type: 'store',
          loja,
          score,
          paused: stats.p,
          msg: `Franquia ${loja} abaixo da meta: ${score}%`,
        });
      }
    });

    // Items paused in exactly 2 franchises
    Object.values(itemMap).forEach((item) => {
      if (item.lojas.size === 2) {
        alerts.atencao.push({
          type: 'item',
          item: item.n,
          lojas: item.lojas.size,
          msg: `Item '${item.n}' pausado em 2 franquias`,
        });
      }
    });

    // Categories with >50% items paused
    Object.entries(catMap).forEach(([cat, stats]) => {
      if (stats.t > 0 && pct(stats.p, stats.t) > 50) {
        alerts.atencao.push({
          type: 'category',
          cat,
          percent: pct(stats.p, stats.t),
          msg: `Categoria '${cat}' com ${pct(stats.p, stats.t)}% dos itens pausados`,
        });
      }
    });

    // PRIORITY 3 - MONITOR
    // Top 5 items by revenue at risk
    Object.values(itemMap)
      .filter((x) => x.risco > 0)
      .sort((a, b) => b.risco - a.risco)
      .slice(0, 5)
      .forEach((item) => {
        alerts.monitor.push({
          type: 'revenue',
          item: item.n,
          risco: item.risco,
          msg: `Item '${item.n}' — receita pausada: ${brl(item.risco)}`,
        });
      });

    // Stores below network average
    const networkAvg = Math.round(
      Object.values(lojaMap).reduce((sum, l) => sum + pct(l.a, l.t), 0) / Object.keys(lojaMap).length
    );
    Object.entries(lojaMap).forEach(([loja, stats]) => {
      const score = pct(stats.a, stats.t);
      if (score >= 80 && score < networkAvg) {
        alerts.monitor.push({
          type: 'below_avg',
          loja,
          score,
          avg: networkAvg,
          msg: `Franquia ${loja} abaixo da média da rede (${score}% vs ${networkAvg}%)`,
        });
      }
    });

    return alerts;
  }, [today]);

  const totalAlerts = alerts.critico.length + alerts.atencao.length + alerts.monitor.length;
  const totalRisk = useMemo(() => {
    return today
      .filter((r) => r.status === 'Pausado' && r.precoNum > 0)
      .reduce((sum, r) => sum + r.precoNum, 0);
  }, [today]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Section 1: Summary KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12 }}>
        <Kpi
          label="Total de Alertas Ativos"
          value={totalAlerts}
          icon="alert"
          accent={totalAlerts > 0 ? C.red : C.green}
          accentBg={totalAlerts > 0 ? C.redL : C.greenL}
        />
        <Kpi
          label="Alertas Críticos"
          value={alerts.critico.length}
          icon="fire"
          accent={C.red}
          accentBg={C.redL}
        />
        <Kpi
          label="Receita Total em Risco"
          value={brl(totalRisk)}
          icon="money"
          accent={C.orange}
          accentBg={C.orangeL}
          small
        />
      </div>

      {/* Section 2: Priority Alert List */}
      {alerts.critico.length > 0 && (
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                background: C.redL,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Ic n="fire" s={14} c={C.red} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 13, color: C.red }}>
                PRIORIDADE 1 — CRÍTICO
              </div>
              <div style={{ fontSize: 10, color: C.muted }}>ação imediata</div>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {alerts.critico.map((a, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  gap: 10,
                  alignItems: 'flex-start',
                  padding: '11px 13px',
                  background: C.redL,
                  borderRadius: 10,
                  border: `1px solid ${C.redM}`,
                }}
              >
                <Ic n="alert" s={14} c={C.red} style={{ marginTop: 1, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0, fontSize: 12, color: C.text }}>
                  {a.msg}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {alerts.atencao.length > 0 && (
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                background: C.amberL,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <span style={{ fontSize: 14 }}>🟡</span>
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 13, color: C.amber }}>
                PRIORIDADE 2 — ATENÇÃO
              </div>
              <div style={{ fontSize: 10, color: C.muted }}>monitorar de perto</div>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {alerts.atencao.map((a, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  gap: 10,
                  alignItems: 'flex-start',
                  padding: '11px 13px',
                  background: C.amberL,
                  borderRadius: 10,
                  border: `1px solid ${C.amberM}`,
                }}
              >
                <span style={{ fontSize: 14, marginTop: 1, flexShrink: 0 }}>⚠</span>
                <div style={{ flex: 1, minWidth: 0, fontSize: 12, color: C.text }}>
                  {a.msg}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {alerts.monitor.length > 0 && (
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                background: C.blueL,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <span style={{ fontSize: 14 }}>🔵</span>
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 13, color: C.blue }}>
                PRIORIDADE 3 — MONITORAR
              </div>
              <div style={{ fontSize: 10, color: C.muted }}>acompanhar tendências</div>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {alerts.monitor.map((a, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  gap: 10,
                  alignItems: 'flex-start',
                  padding: '11px 13px',
                  background: C.blueL,
                  borderRadius: 10,
                  border: `1px solid ${C.blueM}`,
                }}
              >
                <Ic n="alert" s={14} c={C.blue} style={{ marginTop: 1, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0, fontSize: 12, color: C.text }}>
                  {a.msg}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {totalAlerts === 0 && (
        <Card style={{ textAlign: 'center', padding: '60px 20px', color: C.green }}>
          <Ic n="check" s={48} c={C.green} />
          <div style={{ marginTop: 14, fontWeight: 600, fontSize: 15 }}>
            ✓ Nenhum alerta ativo
          </div>
          <div style={{ fontSize: 13, marginTop: 6, color: C.muted }}>
            Sua rede está funcionando dentro dos parâmetros esperados
          </div>
        </Card>
      )}

      {/* Section 3: Action Plan */}
      {totalAlerts > 0 && (
        <Card style={{ borderLeft: `4px solid ${C.blue}` }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14, color: C.blue }}>
            Plano de Ação Recomendado
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              {
                num: 1,
                title: 'Contactar fornecedores',
                desc: 'Para itens sistêmicos pausados em múltiplas franquias',
              },
              {
                num: 2,
                title: 'Ligar para franquias críticas',
                desc: 'Aquelas com disponibilidade abaixo de 60%',
              },
              {
                num: 3,
                title: 'Revisar franquias em atenção',
                desc: 'Evitar que desçam para nível crítico',
              },
              {
                num: 4,
                title: 'Monitorar itens de alto risco',
                desc: 'Com maior receita impactada',
              },
            ].map((step, i) => (
              <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    background: C.blue,
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: 12,
                    flexShrink: 0,
                  }}
                >
                  {step.num}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 12, color: C.text }}>
                    {step.title}
                  </div>
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                    {step.desc}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
