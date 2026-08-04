import { useMemo } from 'react';
import { C } from '../constants.js';
import { Card } from '../components/ui/Card.jsx';
import { Kpi } from '../components/ui/Kpi.jsx';
import { Pill } from '../components/ui/Pill.jsx';
import { pct, brl, clamp, formatDateBR } from '../utils/format.js';
import { parseDate } from '../utils/date.js';
import { StatusItemsPanel } from '../components/ui/StatusItemsPanel.jsx';
import { displayStoreName } from '../utils/stores.js';

export function DashPage({ all, today, systemicRows = today, lastDate, periodFrom, periodTo, historical = false, showPausedRevenue = false }) {
  const unitSummary = today.find((r) => r.unitTotal > 0);
  const total = unitSummary?.unitTotal || today.length;
  const pausados = unitSummary?.unitPaused ?? today.filter((r) => r.status === 'Pausado').length;
  const ativos = unitSummary?.unitActive ?? total - pausados;
  const disponib = pct(ativos, total);
  const lojas = [...new Set(today.map((r) => r.loja))];
  const activePrices = all.filter((row) => row.status === 'Ativo' && Number(row.precoNum) > 0).map((row) => Number(row.precoNum));
  const averageActivePrice = activePrices.length ? activePrices.reduce((sum, price) => sum + price, 0) / activePrices.length : 0;
  const risco = today
    .filter((r) => r.status === 'Pausado' && r.precoNum > 0)
    .reduce((s, r) => s + r.precoNum, 0);
  const latestDetailedDate = [...new Set(all.map((row) => row.dia).filter(Boolean))].sort().at(-1);
  const menuRows = latestDetailedDate ? all.filter((row) => row.dia === latestDetailedDate) : all;
  const pauseFrequency = useMemo(() => {
    const map = new Map();
    all.filter((row) => row.status === 'Pausado' && row.item).forEach((row) => {
      const key = `${row.categoria}|${row.item}`;
      const current = map.get(key) || { item: row.item, category: row.categoria, count: 0 };
      current.count += 1;
      map.set(key, current);
    });
    return [...map.values()].sort((a, b) => b.count - a.count).slice(0, 10);
  }, [all]);

  const { itemMap, dias } = useMemo(() => {
    const itemMap = {};
    systemicRows
      .filter((r) => r.status === 'Pausado')
      .forEach((r) => {
        if (!itemMap[r.item])
          itemMap[r.item] = { n: r.item, v: 0, risco: 0, lojas: new Set(), cat: r.categoria };
        itemMap[r.item].v++;
        itemMap[r.item].risco += r.precoNum;
        itemMap[r.item].lojas.add(r.loja);
      });
    const diaMap = {};
    all.filter((r) => r.status === 'Pausado').forEach((r) => {
      if (r.dia) diaMap[r.dia] = (diaMap[r.dia] || 0) + 1;
    });
    const dias = Object.entries(diaMap).sort((a, b) => {
      const da = parseDate(a[0]);
      const db = parseDate(b[0]);
      return !da || !db ? 0 : da - db;
    });

    return { itemMap, dias };
  }, [all, systemicRows]);

  const topRisco = Object.values(itemMap)
    .filter((x) => x.risco > 0)
    .sort((a, b) => b.risco - a.risco)
    .slice(0, 5);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div className="unit-hero">
        <div>
          <span className="eyebrow">VISÃO OPERACIONAL DA UNIDADE</span>
          <h1>{displayStoreName(lojas[0]) || 'Minha Unidade'}</h1>
          <p>
            {periodFrom && periodTo && periodFrom !== periodTo
              ? <>Período de <b>{formatDateBR(periodFrom)}</b> até <b>{formatDateBR(periodTo)}</b></>
              : <>Posição do cardápio em <b>{formatDateBR(lastDate)}</b></>
            }
          </p>
        </div>
      </div>

      {historical && (
        <div style={{ padding: '10px 13px', borderRadius: 10, background: C.amberL, color: C.amber, fontSize: 12, fontWeight: 600 }}>
          Histórico resumido: ativos, pausados e ranking são desta data. Os nomes e preços pertencem à última carga detalhada.
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12 }}>
        <Kpi
          label="Disponibilidade da Unidade"
          value={`${disponib}%`}
          icon="check"
          accent={disponib >= 80 ? C.green : disponib >= 60 ? C.amber : C.red}
          accentBg={disponib >= 80 ? C.greenL : disponib >= 60 ? C.amberL : C.redL}
          sub={`${ativos} de ${total} itens disponíveis`}
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
        label="Itens Ativos"
        value={ativos}
        icon="check"
        accent={C.green}
        accentBg={C.greenL}
        sub={`${pct(ativos, total)}% do catálogo`}
      />
        {showPausedRevenue && (
          <Kpi
            label="Receita em Risco"
            value={brl(risco)}
            icon="money"
            accent={C.orange}
            accentBg={C.orangeL}
            sub="soma dos preços pausados"
            small
          />
        )}
        <Kpi
          label="Preço Médio dos Ativos"
          value={brl(averageActivePrice)}
          icon="money"
          accent={C.blue}
          accentBg={C.blueL}
          sub={`${activePrices.length} itens ativos com preço`}
          small
        />
      </div>

    <StatusItemsPanel rows={menuRows} title="Ativos e pausados da sua unidade" />

    <Card>
      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>
        Frequência de pausas no período
      </div>
      <div className="pause-frequency-list">
        {pauseFrequency.map((entry) => (
          <div key={`${entry.category}-${entry.item}`}>
            <span>
              <strong>{entry.item}</strong>
              <small>{entry.category || 'Sem categoria'}</small>
            </span>
            <Pill color={C.red} bg={C.redL}>{entry.count}× pausado</Pill>
          </div>
        ))}
        {!pauseFrequency.length && <p>Nenhuma pausa detalhada encontrada no período selecionado.</p>}
      </div>
    </Card>

      {showPausedRevenue && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(270px,1fr))', gap: 16 }}>
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
      </div>}

      {dias.length > 1 && (
        <Card>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>
            Histórico — Itens Pausados por Dia
          </div>
          <div style={{ display: 'flex', gap: 7, alignItems: 'flex-end', height: 112, overflowX: 'auto', padding: '0 2px 5px' }}>
            {dias.map(([d, v], i) => {
              const maxV = Math.max(...dias.map((x) => x[1]));
              const h = clamp(Math.round((v / maxV) * 76), 4, 76);
              const isLast = d === lastDate;
              return (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, minWidth: 68 }}>
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
                    {formatDateBR(d)}
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
