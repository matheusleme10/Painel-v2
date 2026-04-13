import { useState, useMemo } from 'react';
import { C } from '../constants.js';
import { Card } from '../components/ui/Card.jsx';
import { Kpi } from '../components/ui/Kpi.jsx';
import { Pill } from '../components/ui/Pill.jsx';
import { Ic } from '../components/ui/Icon.jsx';
import { HBar } from '../components/ui/charts/HBar.jsx';
import { Donut } from '../components/ui/charts/Donut.jsx';
import { pct, brl, shortName } from '../utils/format.js';

function Empty() {
  return (
    <div style={{ textAlign: 'center', padding: '60px 20px', color: C.muted }}>
      <Ic n="upload" s={48} c={C.border} />
      <div style={{ marginTop: 14, fontWeight: 600, fontSize: 15 }}>
        Nenhum dado carregado
      </div>
      <div style={{ fontSize: 13, marginTop: 6 }}>
        Vá para Admin e importe seu arquivo CSV ou XLSX
      </div>
    </div>
  );
}

export function CatPage({ today }) {
  const [sel, setSel] = useState(null);

  const cats = useMemo(() => {
    const map = {};
    today.forEach((r) => {
      if (!map[r.categoria])
        map[r.categoria] = {
          cat: r.categoria,
          t: 0,
          p: 0,
          a: 0,
          itens: [],
          risco: 0,
        };
      const m = map[r.categoria];
      m.t++;
      if (r.status === 'Pausado') {
        m.p++;
        m.risco += r.precoNum;
        m.itens.push(r);
      } else m.a++;
    });
    return Object.values(map)
      .map((m) => ({ ...m, score: pct(m.a, m.t) }))
      .sort((a, b) => b.p - a.p);
  }, [today]);

  if (!today.length) return <Empty />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 12 }}>
        <Kpi
          label="Total de Categorias"
          value={cats.length}
          icon="cat"
          accent={C.blue}
          accentBg={C.blueL}
        />
        <Kpi
          label="Mais Afetada"
          value={cats[0]?.cat.split(' ').slice(0, 2).join(' ') || '—'}
          icon="fire"
          accent={C.red}
          accentBg={C.redL}
          sub={`${cats[0]?.p || 0} itens pausados`}
          small
        />
        <Kpi
          label="Receita em Risco"
          value={brl(cats.reduce((s, c) => s + c.risco, 0))}
          icon="money"
          accent={C.orange}
          accentBg={C.orangeL}
          small
        />
        <Kpi
          label="Cats > 50% pausado"
          value={cats.filter((c) => pct(c.p, c.t) > 50).length}
          icon="alert"
          accent={C.red}
          accentBg={C.redL}
          sub="categorias críticas"
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(270px,1fr))', gap: 16 }}>
        <Card>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>
            Categorias por Itens Pausados
          </div>
          <HBar
            data={cats.slice(0, 8).map((c) => ({ n: c.cat, v: c.p }))}
            maxItems={8}
            color={(d) => {
              const c = cats.find((x) => x.cat === d.n);
              return c && pct(c.p, c.t) > 50 ? C.red : C.amber;
            }}
          />
        </Card>

        <Card>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>
            Share de Pausados por Categoria
          </div>
          <Donut data={cats.slice(0, 7).map((c) => ({ n: c.cat, v: c.p }))} />
        </Card>
      </div>

      <Card>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>
          Detalhes por Categoria
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {cats.map((c) => {
            const on = sel?.cat === c.cat;
            const sc = c.score;
            const scColor = sc >= 80 ? C.green : sc >= 60 ? C.amber : C.red;
            return (
              <div key={c.cat}>
                <div
                  onClick={() => setSel(on ? null : c)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '11px 14px',
                    borderRadius: on ? '12px 12px 0 0' : 12,
                    cursor: 'pointer',
                    background: on ? C.red : C.bg,
                    transition: 'all .15s',
                  }}
                >
                  <Ic n="cat" s={14} c={on ? 'white' : C.muted} />
                  <div style={{ flex: 1, fontWeight: 600, fontSize: 13, color: on ? 'white' : C.text }}>
                    {c.cat}
                  </div>
                  <div style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
                    {c.risco > 0 && (
                      <Pill
                        color={on ? 'white' : C.orange}
                        bg={on ? 'rgba(255,255,255,.2)' : C.orangeL}
                        s={10}
                      >
                        {brl(c.risco)}
                      </Pill>
                    )}
                    <span
                      style={{
                        fontSize: 11,
                        color: on ? 'rgba(255,255,255,.7)' : C.muted,
                      }}
                    >
                      {c.p}/{c.t}
                    </span>
                    <Pill
                      color={on ? 'white' : scColor}
                      bg={on ? 'rgba(255,255,255,.2)' : scColor + '1A'}
                      s={10}
                    >
                      {sc}%
                    </Pill>
                  </div>
                </div>
                {on && (
                  <div
                    style={{
                      background: C.redL,
                      borderRadius: '0 0 12px 12px',
                      padding: '12px 14px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                      <div
                        style={{
                          flex: 1,
                          height: 10,
                          background: 'white',
                          borderRadius: 5,
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            width: `${pct(c.p, c.t)}%`,
                            height: '100%',
                            background: C.red,
                            borderRadius: 5,
                          }}
                        />
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 700, color: C.red }}>
                        {pct(c.p, c.t)}% pausado
                      </span>
                    </div>
                    <div style={{ maxHeight: 220, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 5 }}>
                      {c.itens
                        .sort((a, b) => b.precoNum - a.precoNum)
                        .map((r, i) => (
                          <div
                            key={i}
                            style={{
                              display: 'flex',
                              gap: 7,
                              alignItems: 'center',
                              padding: '6px 10px',
                              background: 'white',
                              borderRadius: 8,
                            }}
                          >
                            <Ic n="pause" s={11} c={C.red} />
                            <div
                              style={{
                                flex: 1,
                                fontSize: 12,
                                color: C.text,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {r.item}
                            </div>
                            <div style={{ fontSize: 10, color: C.muted, flexShrink: 0 }}>
                              {shortName(r.loja) || r.loja}
                            </div>
                            {r.precoNum > 0 && (
                              <div
                                style={{
                                  fontSize: 11,
                                  fontWeight: 700,
                                  color: C.orange,
                                  flexShrink: 0,
                                }}
                              >
                                {brl(r.precoNum)}
                              </div>
                            )}
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
