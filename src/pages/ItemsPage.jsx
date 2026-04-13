import { useState, useMemo } from 'react';
import { C, PAL } from '../constants.js';
import { Card } from '../components/ui/Card.jsx';
import { Kpi } from '../components/ui/Kpi.jsx';
import { Pill } from '../components/ui/Pill.jsx';
import { Ic } from '../components/ui/Icon.jsx';
import { HBar } from '../components/ui/charts/HBar.jsx';
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

export function ItemsPage({ today }) {
  const [search, setSearch] = useState('');
  const [view, setView] = useState('ranking');
  const [selItem, setSelItem] = useState(null);

  const itemMap = useMemo(() => {
    const m = {};
    today
      .filter((r) => r.status === 'Pausado')
      .forEach((r) => {
        if (!m[r.item])
          m[r.item] = { n: r.item, v: 0, risco: 0, lojas: new Set(), cats: new Set(), registros: [] };
        m[r.item].v++;
        m[r.item].risco += r.precoNum;
        m[r.item].lojas.add(r.loja);
        m[r.item].cats.add(r.categoria);
        m[r.item].registros.push(r);
      });
    return m;
  }, [today]);

  const ativosMap = useMemo(() => {
    const m = {};
    today
      .filter((r) => r.status === 'Ativo')
      .forEach((r) => {
        if (!m[r.item])
          m[r.item] = { n: r.item, v: 0, risco: 0, lojas: new Set() };
        m[r.item].v++;
        m[r.item].risco += r.precoNum;
        m[r.item].lojas.add(r.loja);
      });
    return m;
  }, [today]);

  const allItems = Object.values(itemMap);
  const byCount = [...allItems].sort((a, b) => b.v - a.v);
  const byRisco = [...allItems].filter((x) => x.risco > 0).sort((a, b) => b.risco - a.risco);
  const sistematicos = [...allItems].filter((x) => x.lojas.size > 1).sort((a, b) => b.lojas.size - a.lojas.size);
  const totalRisco = allItems.reduce((s, x) => s + x.risco, 0);

  const searchResults = useMemo(() => {
    if (!search || search.length < 2) return [];
    const q = search.toLowerCase();
    return [
      ...new Set([
        ...Object.values(itemMap).filter((x) => x.n.toLowerCase().includes(q)),
        ...Object.values(ativosMap).filter((x) => x.n.toLowerCase().includes(q)),
      ]),
    ].slice(0, 20);
  }, [search, itemMap, ativosMap]);

  const selectedItemData = selItem
    ? {
        pausado: itemMap[selItem],
        ativo: ativosMap[selItem],
      }
    : null;

  if (!today.length) return <Empty />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 12 }}>
        <Kpi
          label="Itens Únicos Pausados"
          value={allItems.length}
          icon="pause"
          accent={C.red}
          accentBg={C.redL}
          sub={`${[...new Set(today.map((r) => r.item))].length} itens no total`}
        />
        <Kpi
          label="Receita Total em Risco"
          value={brl(totalRisco)}
          icon="money"
          accent={C.orange}
          accentBg={C.orangeL}
          small
        />
        <Kpi
          label="Item com Maior Risco"
          value={byRisco[0]?.n.split(' ').slice(0, 2).join(' ') || '—'}
          icon="fire"
          accent={C.red}
          accentBg={C.redL}
          sub={byRisco[0] ? `${brl(byRisco[0].risco)} em risco` : 'Sem preços'}
          small
        />
        <Kpi
          label="Itens Sistêmicos"
          value={sistematicos.length}
          icon="alert"
          accent={sistematicos.length > 0 ? C.purple : C.green}
          accentBg={sistematicos.length > 0 ? C.purpleL : C.greenL}
          sub="pausados em 2+ franquias"
        />
        <Kpi
          label="Itens Ativos na Rede"
          value={Object.keys(ativosMap).length}
          icon="check"
          accent={C.green}
          accentBg={C.greenL}
          sub="produtos disponíveis"
        />
        <Kpi
          label="Mais Pausado"
          value={byCount[0]?.n.split(' ').slice(0, 3).join(' ') || '—'}
          icon="spread"
          accent={C.blue}
          accentBg={C.blueL}
          sub={byCount[0] ? `${byCount[0].v}× pausado hoje` : '—'}
          small
        />
      </div>

      <div style={{ display: 'flex', gap: 4, background: C.bg, borderRadius: 12, padding: 4, flexWrap: 'wrap' }}>
        {[
          ['ranking', '🏆 Ranking'],
          ['sistematico', '⚠ Sistêmicos'],
          ['busca', '🔍 Buscar Item'],
        ].map(([v, l]) => (
          <button
            key={v}
            onClick={() => setView(v)}
            style={{
              flex: '1 1 auto',
              padding: '8px 14px',
              borderRadius: 9,
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontSize: 12,
              fontWeight: 700,
              transition: 'all .15s',
              background: view === v ? 'white' : 'transparent',
              color: view === v ? C.red : C.muted,
              boxShadow: view === v ? '0 1px 5px rgba(0,0,0,.1)' : 'none',
            }}
          >
            {l}
          </button>
        ))}
      </div>

      {view === 'ranking' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 16 }}>
          <Card>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>
              Top Itens por Nº de Ocorrências
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {byCount.slice(0, 10).map((d, i) => (
                <div
                  key={i}
                  onClick={() => setSelItem(selItem === d.n ? null : d.n)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 9,
                    padding: '9px 11px',
                    borderRadius: 9,
                    cursor: 'pointer',
                    background: selItem === d.n ? C.redL : C.bg,
                    border: selItem === d.n ? `1px solid ${C.redM}` : '1px solid transparent',
                    transition: 'all .15s',
                  }}
                >
                  <div
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: '50%',
                      flexShrink: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: i < 3 ? PAL[i] : '#E5E7EB',
                    }}
                  >
                    <span style={{ fontSize: 10, fontWeight: 900, color: i < 3 ? 'white' : C.muted }}>
                      {i + 1}
                    </span>
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
                      {[...d.cats][0]} · {d.lojas.size} franquia{d.lojas.size > 1 ? 's' : ''}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
                    <Pill color={C.red} bg={C.redM} s={11}>
                      {d.v}×
                    </Pill>
                    {d.risco > 0 && (
                      <Pill color={C.orange} bg={C.orangeL} s={10}>
                        {brl(d.risco)}
                      </Pill>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>
              🔥 Top Itens por Receita em Risco
            </div>
            {byRisco.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {byRisco.slice(0, 10).map((d, i) => (
                  <div
                    key={i}
                    onClick={() => setSelItem(selItem === d.n ? null : d.n)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 9,
                      padding: '9px 11px',
                      borderRadius: 9,
                      cursor: 'pointer',
                      background: selItem === d.n ? C.orangeL : C.bg,
                      border: selItem === d.n ? `1px solid ${C.orangeM}` : '1px solid transparent',
                      transition: 'all .15s',
                    }}
                  >
                    <div
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: '50%',
                        flexShrink: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: i === 0 ? C.orange : i === 1 ? C.amber : C.border,
                      }}
                    >
                      <span style={{ fontSize: 10, fontWeight: 900, color: i < 2 ? 'white' : C.muted }}>
                        {i + 1}
                      </span>
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
                        {[...d.cats][0]} · {d.v} pausamentos
                      </div>
                    </div>
                    <Pill color={C.orange} bg={i === 0 ? C.orangeM : C.orangeL} s={11}>
                      {brl(d.risco)}
                    </Pill>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: 'center', color: C.muted, padding: 32 }}>
                <Ic n="money" s={36} c={C.border} />
                <div style={{ marginTop: 10, fontSize: 13 }}>
                  Nenhum preço disponível nos dados
                </div>
                <div style={{ fontSize: 11, marginTop: 4 }}>
                  Verifique se a coluna priceValue está preenchida
                </div>
              </div>
            )}
          </Card>

          {selItem && selectedItemData && (
            <Card style={{ gridColumn: '1/-1', background: C.redL, border: `1px solid ${C.redM}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ fontWeight: 800, fontSize: 15, color: C.text }}>{selItem}</div>
                <button onClick={() => setSelItem(null)} style={{ border: 'none', background: 'none', cursor: 'pointer' }}>
                  <Ic n="close" s={16} c={C.muted} />
                </button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(110px,1fr))', gap: 10, marginBottom: 14 }}>
                {[
                  ['Pausamentos', selectedItemData.pausado?.v || 0, C.red, C.redM],
                  ['Franquias c/ Pausado', selectedItemData.pausado?.lojas.size || 0, C.purple, C.purpleM],
                  ['Receita em Risco', brl(selectedItemData.pausado?.risco || 0), C.orange, C.orangeM],
                  ['Franquias c/ Ativo', selectedItemData.ativo?.lojas.size || 0, C.green, C.greenM],
                ].map(([l, v, c, bg]) => (
                  <div key={l} style={{ background: 'white', borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
                    <div style={{ fontSize: String(v).length > 8 ? 13 : 22, fontWeight: 900, color: c }}>
                      {v}
                    </div>
                    <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>{l}</div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}

      {view === 'sistematico' && (
        <Card>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>⚠ Itens Sistêmicos</div>
          <div style={{ fontSize: 11, color: C.muted, marginBottom: 12 }}>
            Pausados em múltiplas franquias — indicam problema de fornecedor ou operação
          </div>
          {sistematicos.length > 0 ? (
            <HBar
              data={sistematicos.slice(0, 10).map((x) => ({ n: x.n, v: x.lojas.size }))}
              maxItems={10}
              color={(d) => {
                const item = sistematicos.find((x) => x.n === d.n);
                return item && item.lojas.size >= 3 ? C.red : C.amber;
              }}
            />
          ) : (
            <div style={{ textAlign: 'center', color: C.green, padding: 32, fontWeight: 600 }}>
              ✓ Nenhum item sistêmico hoje
            </div>
          )}
        </Card>
      )}

      {view === 'busca' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ position: 'relative' }}>
            <div style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)' }}>
              <Ic n="search" s={13} c={C.muted} />
            </div>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Digite o nome do item..."
              style={{
                width: '100%',
                padding: '11px 12px 11px 30px',
                borderRadius: 10,
                border: `1px solid ${C.border}`,
                fontSize: 14,
                outline: 'none',
                fontFamily: 'inherit',
              }}
            />
          </div>
          {searchResults.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {searchResults.map((item, i) => (
                <Card key={i} onClick={() => setSelItem(selItem === item.n ? null : item.n)} style={{ cursor: 'pointer', background: selItem === item.n ? C.redL : C.card }}>
                  <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8, color: C.text }}>
                    {item.n}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(100px,1fr))', gap: 8 }}>
                    {[
                      ['Pausados', item.pausado?.v || 0, C.red],
                      ['Lojas', item.pausado?.lojas.size || 0, C.purple],
                      ['Risco', brl(item.pausado?.risco || 0), C.orange],
                    ].map(([l, v, c]) => (
                      <div key={l} style={{ background: C.bg, borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: c }}>{v}</div>
                        <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>{l}</div>
                      </div>
                    ))}
                  </div>
                </Card>
              ))}
            </div>
          ) : search.length < 2 ? (
            <Card style={{ textAlign: 'center', padding: '40px 24px', color: C.muted }}>
              <Ic n="search" s={48} c={C.border} />
              <div style={{ marginTop: 14, fontWeight: 600, fontSize: 14 }}>
                Buscar qualquer item
              </div>
              <div style={{ fontSize: 12, marginTop: 6 }}>
                Digite ao menos 2 caracteres para ver pausamentos e disponibilidade por franquia
              </div>
            </Card>
          ) : (
            <Card style={{ textAlign: 'center', padding: '40px 24px', color: C.muted }}>
              <Ic n="search" s={48} c={C.border} />
              <div style={{ marginTop: 14, fontWeight: 600, fontSize: 14 }}>
                Nenhum item encontrado
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
