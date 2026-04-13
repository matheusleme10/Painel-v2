import { useState, useMemo } from 'react';
import { C } from '../constants.js';
import { Card } from '../components/ui/Card.jsx';
import { Ic } from '../components/ui/Icon.jsx';
import { Ring } from '../components/ui/charts/Ring.jsx';
import { Pill } from '../components/ui/Pill.jsx';
import { pct, brl } from '../utils/format.js';

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

export function FranchPage({ today }) {
  const [search, setSearch] = useState('');
  const [sel, setSel] = useState(null);
  const [itemTab, setItemTab] = useState('pausados');
  const [filter, setFilter] = useState('todos');

  const lojas = useMemo(() => {
    const map = {};
    today.forEach((r) => {
      if (!map[r.loja])
        map[r.loja] = { loja: r.loja, t: 0, p: 0, a: 0, cats: new Set(), risco: 0 };
      const m = map[r.loja];
      m.t++;
      if (r.status === 'Pausado') {
        m.p++;
        m.risco += r.precoNum;
      } else m.a++;
      m.cats.add(r.categoria);
    });
    const allScores = Object.values(map).map((m) => pct(m.a, m.t));
    const mediaRede = Math.round(
      allScores.reduce((s, x) => s + x, 0) / (allScores.length || 1)
    );
    const sorted = Object.values(map)
      .map((m) => {
        const score = pct(m.a, m.t);
        const rank = Object.values(map).filter((x) => pct(x.a, x.t) < score).length + 1;
        return {
          ...m,
          cats: m.cats.size,
          score,
          rank,
          total: Object.values(map).length,
          mediaRede,
          vsRede: score - mediaRede,
        };
      })
      .sort((a, b) => a.score - b.score);
    return sorted;
  }, [today]);

  const filtered = useMemo(
    () =>
      lojas.filter((l) => {
        if (!l.loja.toLowerCase().includes(search.toLowerCase())) return false;
        if (filter === 'critico') return l.score < 60;
        if (filter === 'atencao') return l.score >= 60 && l.score < 80;
        if (filter === 'ok') return l.score >= 80;
        return true;
      }),
    [lojas, search, filter]
  );

  const selItems = sel ? today.filter((r) => r.loja === sel.loja) : [];
  const selPausados = selItems.filter((r) => r.status === 'Pausado').sort((a, b) => b.precoNum - a.precoNum);
  const selAtivos = selItems.filter((r) => r.status === 'Ativo').sort((a, b) => b.precoNum - a.precoNum);

  const catBreak = useMemo(() => {
    if (!sel) return [];
    const map = {};
    selPausados.forEach((r) => {
      if (!map[r.categoria]) map[r.categoria] = { n: r.categoria, p: 0, risco: 0 };
      map[r.categoria].p++;
      map[r.categoria].risco += r.precoNum;
    });
    return Object.values(map).sort((a, b) => b.p - a.p);
  }, [sel, selPausados]);

  if (!today.length) return <Empty />;

  return (
    <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
      <div style={{ flex: '0 0 auto', width: '100%', maxWidth: 390 }}>
        <div style={{ position: 'relative', marginBottom: 9 }}>
          <div style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)' }}>
            <Ic n="search" s={13} c={C.muted} />
          </div>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar franquia..."
            style={{
              width: '100%',
              padding: '9px 12px 9px 30px',
              borderRadius: 10,
              border: `1px solid ${C.border}`,
              fontSize: 13,
              outline: 'none',
              fontFamily: 'inherit',
            }}
          />
        </div>
        <div style={{ display: 'flex', gap: 5, marginBottom: 10, flexWrap: 'wrap' }}>
          {[
            ['todos', 'Todas'],
            ['critico', '⚠ Crítico'],
            ['atencao', '🟡 Atenção'],
            ['ok', '✓ OK'],
          ].map(([v, l]) => (
            <button
              key={v}
              onClick={() => setFilter(v)}
              style={{
                padding: '5px 11px',
                borderRadius: 20,
                border: 'none',
                cursor: 'pointer',
                fontSize: 11,
                fontWeight: 700,
                fontFamily: 'inherit',
                background: filter === v ? C.red : C.bg,
                color: filter === v ? 'white' : C.muted,
              }}
            >
              {l}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 7, marginBottom: 10 }}>
          {[
            [lojas.filter((l) => l.score < 60).length, 'Críticas', C.red, C.redL, 'critico'],
            [lojas.filter((l) => l.score >= 60 && l.score < 80).length, 'Atenção', C.amber, C.amberL, 'atencao'],
            [lojas.filter((l) => l.score >= 80).length, 'OK', C.green, C.greenL, 'ok'],
          ].map(([v, l, c, bg, f]) => (
            <div
              key={l}
              onClick={() => setFilter(f)}
              style={{
                flex: 1,
                background: bg,
                borderRadius: 10,
                padding: '8px 10px',
                cursor: 'pointer',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: 20, fontWeight: 900, color: c }}>{v}</div>
              <div style={{ fontSize: 10, color: C.muted }}>{l}</div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 560, overflowY: 'auto' }}>
          {filtered.map((l) => {
            const on = sel?.loja === l.loja;
            const sc = l.score;
            return (
              <div
                key={l.loja}
                onClick={() => {
                  setSel(on ? null : l);
                  setItemTab('pausados');
                }}
                style={{
                  padding: '10px 12px',
                  borderRadius: 12,
                  cursor: 'pointer',
                  border: `1.5px solid ${on ? C.red : C.border}`,
                  background: on ? C.redL : C.card,
                  transition: 'all .15s',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                  <Ring v={sc} size={48} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontWeight: 700,
                        fontSize: 12,
                        color: C.text,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {l.loja}
                    </div>
                    <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>
                      <span style={{ color: C.green, fontWeight: 700 }}>{l.a} ativos</span>
                      {' · '}
                      <span style={{ color: C.red, fontWeight: 700 }}>{l.p} pausados</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
                    {l.risco > 0 && (
                      <Pill color={C.orange} bg={C.orangeL} s={10}>
                        {brl(l.risco)}
                      </Pill>
                    )}
                    <div style={{ fontSize: 10, fontWeight: 700, color: l.vsRede >= 0 ? C.green : C.red }}>
                      {l.vsRede >= 0 ? '▲' : '▼'}
                      {Math.abs(l.vsRede)}% vs rede
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div style={{ textAlign: 'center', color: C.muted, padding: 28, fontSize: 13 }}>
              Nenhuma franquia encontrada
            </div>
          )}
        </div>
      </div>

      {sel ? (
        <div style={{ flex: 1, minWidth: 270, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 15 }}>{sel.loja}</div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                  {sel.t} itens no cardápio hoje
                </div>
              </div>
              <button
                onClick={() => setSel(null)}
                style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 4 }}
              >
                <Ic n="close" s={17} c={C.muted} />
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(100px,1fr))', gap: 8, marginBottom: 12 }}>
              {[
                [
                  'Disponibilidade',
                  `${sel.score}%`,
                  sel.score >= 80 ? C.green : sel.score >= 60 ? C.amber : C.red,
                  sel.score >= 80 ? C.greenL : sel.score >= 60 ? C.amberL : C.redL,
                ],
                ['Ativos', sel.a, C.green, C.greenL],
                ['Pausados', sel.p, C.red, C.redL],
                ['Receita Pausada', brl(sel.risco), C.orange, C.orangeL],
              ].map(([l, v, c, bg]) => (
                <div key={l} style={{ background: bg, borderRadius: 9, padding: '9px 11px' }}>
                  <div style={{ fontSize: String(v).length > 8 ? 13 : 18, fontWeight: 900, color: c }}>
                    {v}
                  </div>
                  <div style={{ fontSize: 10, color: C.muted, marginTop: 1 }}>{l}</div>
                </div>
              ))}
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 9,
                padding: '9px 12px',
                background: sel.vsRede >= 0 ? C.greenL : C.redL,
                borderRadius: 9,
              }}
            >
              <Ic n={sel.vsRede >= 0 ? 'trophy' : 'alert'} s={15} c={sel.vsRede >= 0 ? C.green : C.red} />
              <div style={{ fontSize: 12 }}>
                <b style={{ color: sel.vsRede >= 0 ? C.green : C.red }}>
                  {sel.vsRede >= 0 ? `${sel.vsRede}% acima` : `${Math.abs(sel.vsRede)}% abaixo`}
                </b>{' '}
                da média da rede ({sel.mediaRede}%)
                {' · '}Ranking: <b>#{sel.total - sel.rank + 1}</b> de {sel.total}
              </div>
            </div>
          </Card>

          {catBreak.length > 0 && (
            <Card>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 9 }}>
                Pausados por Categoria
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {catBreak.map((c, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '6px 11px',
                      background: C.bg,
                      borderRadius: 8,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Ic n="cat" s={12} c={C.muted} />
                      <span style={{ fontSize: 12, fontWeight: 600, color: C.text }}>
                        {c.n}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <Pill color={C.red} bg={C.redL} s={10}>
                        {c.p} pausados
                      </Pill>
                      {c.risco > 0 && (
                        <Pill color={C.orange} bg={C.orangeL} s={10}>
                          {brl(c.risco)}
                        </Pill>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <Card>
            <div style={{ display: 'flex', gap: 3, background: C.bg, borderRadius: 9, padding: 3, marginBottom: 12 }}>
              {[
                ['pausados', `Pausados (${selPausados.length})`, 'pause', C.red],
                ['ativos', `Ativos (${selAtivos.length})`, 'check', C.green],
              ].map(([v, l, ic, c]) => (
                <button
                  key={v}
                  onClick={() => setItemTab(v)}
                  style={{
                    flex: 1,
                    padding: '7px 10px',
                    borderRadius: 7,
                    border: 'none',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    fontSize: 12,
                    fontWeight: 700,
                    background: itemTab === v ? 'white' : 'transparent',
                    color: itemTab === v ? c : C.muted,
                    boxShadow: itemTab === v ? '0 1px 4px rgba(0,0,0,.08)' : 'none',
                  }}
                >
                  {l}
                </button>
              ))}
            </div>
            {itemTab === 'pausados' && sel.risco > 0 && (
              <div
                style={{
                  display: 'flex',
                  gap: 7,
                  alignItems: 'center',
                  padding: '7px 11px',
                  background: C.orangeL,
                  borderRadius: 8,
                  marginBottom: 9,
                  border: `1px solid ${C.orangeM}`,
                }}
              >
                <Ic n="money" s={13} c={C.orange} />
                <span style={{ fontSize: 12, color: C.orange, fontWeight: 700 }}>
                  Receita travada estimada: {brl(sel.risco)}
                </span>
              </div>
            )}
            <div style={{ maxHeight: 360, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 5 }}>
              {(itemTab === 'pausados' ? selPausados : selAtivos).map((r, i) => (
                <div key={i} style={{ display: 'flex', gap: 7, alignItems: 'center', padding: '7px 10px', background: C.bg, borderRadius: 8 }}>
                  <Ic n={itemTab === 'pausados' ? 'pause' : 'check'} s={12} c={itemTab === 'pausados' ? C.red : C.green} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: C.text,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {r.item}
                    </div>
                    <div style={{ fontSize: 10, color: C.muted }}>{r.categoria}</div>
                  </div>
                  {r.precoNum > 0 && (
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: itemTab === 'pausados' ? C.orange : C.green,
                        flexShrink: 0,
                      }}
                    >
                      {brl(r.precoNum)}
                    </div>
                  )}
                </div>
              ))}
              {(itemTab === 'pausados' ? selPausados : selAtivos).length === 0 && (
                <div style={{ textAlign: 'center', padding: 24, color: C.muted, fontSize: 13 }}>
                  {itemTab === 'pausados' ? '✅ Nenhum item pausado!' : 'Nenhum item ativo'}
                </div>
              )}
            </div>
          </Card>
        </div>
      ) : (
        <div style={{ flex: 1, minWidth: 240 }}>
          <Card style={{ textAlign: 'center', padding: '48px 24px', color: C.muted }}>
            <Ic n="store" s={48} c={C.border} />
            <div style={{ marginTop: 14, fontWeight: 600, fontSize: 14 }}>
              Selecione uma franquia
            </div>
            <div style={{ fontSize: 12, marginTop: 6 }}>
              Veja disponibilidade, itens ativos,
              <br />
              pausados e receita em risco
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
