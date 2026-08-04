import { useState, useMemo } from 'react';
import { C } from '../constants.js';
import { Card } from '../components/ui/Card.jsx';
import { Ic } from '../components/ui/Icon.jsx';
import { Pill } from '../components/ui/Pill.jsx';
import { brl, formatDateBR } from '../utils/format.js';
import { buildStoreMetrics } from '../utils/analytics.js';
import { isSameStore } from '../utils/stores.js';

// ─── helpers ─────────────────────────────────────────────────────────────────

function medalColor(rank) {
  if (rank === 1) return { bg: '#FFF8DC', color: '#B8860B', border: '#F0C040' }; // ouro
  if (rank === 2) return { bg: '#F5F5F5', color: '#808080', border: '#C0C0C0' }; // prata
  if (rank === 3) return { bg: '#FFF0E8', color: '#CD7F32', border: '#CD7F32' }; // bronze
  return { bg: C.bg, color: C.muted, border: C.border };
}

function SortIcon({ col, sortCol, sortDir }) {
  if (sortCol !== col)
    return <span style={{ color: C.border, fontSize: 10 }}>⇅</span>;
  return <span style={{ color: C.red, fontSize: 10 }}>{sortDir === 'asc' ? '▲' : '▼'}</span>;
}

function Th({ col, label, sortCol, sortDir, onSort, right = false }) {
  return (
    <th
      onClick={() => onSort(col)}
      style={{
        padding: '10px 12px',
        textAlign: right ? 'right' : 'left',
        color: sortCol === col ? C.red : C.muted,
        fontWeight: 700,
        fontSize: 11,
        whiteSpace: 'nowrap',
        cursor: 'pointer',
        userSelect: 'none',
        background: C.bg,
        borderBottom: `2px solid ${sortCol === col ? C.red : C.border}`,
        position: 'sticky',
        top: 0,
        zIndex: 3,
      }}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        {label}
        <SortIcon col={col} sortCol={sortCol} sortDir={sortDir} />
      </span>
    </th>
  );
}

// ─── Empty ────────────────────────────────────────────────────────────────────

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

// ─── Main ─────────────────────────────────────────────────────────────────────

export function RankPage({ today, periodFrom, periodTo, showFinancials = false, selectedStore = '' }) {
  const [search,  setSearch]  = useState('');
  const [sortCol, setSortCol] = useState('rank');
  const [sortDir, setSortDir] = useState('asc');
  const [filter,  setFilter]  = useState('todos'); // todos | critico | atencao | ok | abaixo

  // ── Calcular estatísticas por franquia ──────────────────────────────────────
  const { rows, mediaRede } = useMemo(() => {
    const entries = buildStoreMetrics(today);

    const mediaRede = Math.round(
      entries.reduce((s, e) => s + e.disponib, 0) / (entries.length || 1)
    );

    // Atribui ranking: 1 = melhor disponibilidade
    const sorted = [...entries].sort((a, b) => b.disponib - a.disponib);
    sorted.forEach((e, i) => { e.rank = i + 1; });

    return { rows: entries, mediaRede };
  }, [today]);

  // ── Filtrar por busca + status ──────────────────────────────────────────────
  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (!r.loja.toLowerCase().includes(search.toLowerCase())) return false;
      if (filter === 'critico') return r.disponib < 60;
      if (filter === 'atencao') return r.disponib >= 60 && r.disponib < 80;
      if (filter === 'ok')      return r.disponib >= 80;
      if (filter === 'abaixo')  return r.disponib < mediaRede;
      return true;
    });
  }, [rows, search, filter, mediaRede]);

  // ── Ordenar ─────────────────────────────────────────────────────────────────
  const sorted = useMemo(() => {
    const mult = sortDir === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const av = a[sortCol], bv = b[sortCol];
      if (typeof av === 'number') return (av - bv) * mult;
      return String(av).localeCompare(String(bv)) * mult;
    });
  }, [filtered, sortCol, sortDir]);

  function toggleSort(col) {
    if (sortCol === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortCol(col);
      // Ordenação padrão: ranking e disponib = asc, valores = desc
      setSortDir(['rank', 'loja'].includes(col) ? 'asc' : 'desc');
    }
  }

  // ── KPIs de resumo ──────────────────────────────────────────────────────────
  const totalRisco    = rows.reduce((s, r) => s + r.risco, 0);
  const abaixoMedia   = rows.filter((r) => r.disponib < mediaRede).length;
  const criticas      = rows.filter((r) => r.disponib < 60).length;
  const selectedMetric = rows.find((row) => isSameStore(row.loja, selectedStore));
  const visibleRows = sorted;

  const chipStyle = (active) => ({
    padding: '5px 11px',
    borderRadius: 20,
    border: 'none',
    cursor: 'pointer',
    fontSize: 11,
    fontWeight: 700,
    fontFamily: 'inherit',
    background: active ? C.red : C.bg,
    color: active ? 'white' : C.muted,
    whiteSpace: 'nowrap',
  });

  if (!today.length) return <Empty />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Cabeçalho + período */}
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
          flexWrap: 'wrap',
        }}
      >
        <Ic n="trophy" s={13} c={C.blue} />
        Ranking de Franquias
        {periodFrom && periodTo && periodFrom !== periodTo
          ? <><b>&nbsp;·&nbsp;{formatDateBR(periodFrom)}</b> até <b>{formatDateBR(periodTo)}</b></>
          : <>&nbsp;·&nbsp;Dados de: <b>{periodTo || 'todos'}</b></>
        }
        &nbsp;·&nbsp; {rows.length} franquias
      </div>

      {/* KPIs rápidos */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 10 }}>
        {[
          ['Média da Rede', `${mediaRede}%`,    C.blue,   C.blueL],
          ['Franquias',      rows.length,         C.teal,   C.tealL],
          ['Abaixo da Média', abaixoMedia,        C.amber,  C.amberL],
          ['Críticas (<60%)', criticas,           C.red,    C.redL],
          ...(showFinancials ? [['Receita Pausada', brl(totalRisco), C.orange, C.orangeL]] : []),
        ].map(([l, v, c, bg]) => (
          <div key={l} style={{ background: bg, borderRadius: 10, padding: '10px 13px' }}>
            <div style={{ fontSize: String(v).length > 9 ? 13 : 20, fontWeight: 900, color: c }}>
              {v}
            </div>
            <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>{l}</div>
          </div>
        ))}
      </div>

      {selectedMetric && (
        <div className="ranking-own-position">
          <span className="ranking-own-rank">#{selectedMetric.rank}</span>
          <span>
            <small>Sua posição entre {rows.length} unidades da mesma marca</small>
            <strong>{selectedMetric.loja}</strong>
          </span>
          <b>{selectedMetric.disponib}% disponível</b>
        </div>
      )}

      {/* Tabela */}
      <Card style={{ padding: 0, overflow: 'hidden' }}>

        {/* Barra de busca + filtros */}
        <div
          style={{
            display: 'flex',
            gap: 8,
            padding: '12px 14px',
            flexWrap: 'wrap',
            alignItems: 'center',
            borderBottom: `1px solid ${C.border}`,
          }}
        >
          {/* Search */}
          <div style={{ position: 'relative', flex: '1 1 180px' }}>
            <div style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)' }}>
              <Ic n="search" s={13} c={C.muted} />
            </div>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar franquia..."
              style={{
                width: '100%',
                padding: '7px 10px 7px 28px',
                borderRadius: 8,
                border: `1px solid ${C.border}`,
                fontSize: 12,
                outline: 'none',
                fontFamily: 'inherit',
              }}
            />
          </div>

          {/* Filtros rápidos */}
          {[
            ['todos',   'Todas'],
            ['ok',      '✓ OK'],
            ['atencao', '🟡 Atenção'],
            ['critico', '⚠ Crítico'],
            ['abaixo',  '↓ Abaixo da Média'],
          ].map(([v, l]) => (
            <button key={v} style={chipStyle(filter === v)} onClick={() => setFilter(v)}>
              {l}
            </button>
          ))}

          <span style={{ fontSize: 11, color: C.muted, marginLeft: 'auto' }}>
            {sorted.length} de {rows.length} franquias
          </span>
        </div>

        {/* Tabela propriamente dita */}
        <div className="ranking-table-scroll">
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <Th col="rank"     label="Ranking"          sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} />
                <Th col="loja"     label="Franquia"         sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} />
                <Th col="disponib" label="Disponibilidade"  sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} right />
                <Th col="a"        label="Ativos"           sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} right />
                <Th col="p"        label="Pausados"         sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} right />
                {showFinancials && <Th col="risco" label="Receita Pausada" sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} right />}
                <th style={{ padding: '10px 12px', textAlign: 'center', color: C.muted, fontWeight: 700, fontSize: 11, whiteSpace: 'nowrap', background: C.bg, borderBottom: `2px solid ${C.border}`, position: 'sticky', top: 0, zIndex: 3 }}>
                  vs. Média da Rede
                </th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((r) => {
                const medal    = medalColor(r.rank);
                const vsRede   = r.disponib - mediaRede;
                const abaixo   = vsRede < 0;
                const dispColor = r.disponib >= 80 ? C.green : r.disponib >= 60 ? C.amber : C.red;
                const dispBg    = r.disponib >= 80 ? C.greenL : r.disponib >= 60 ? C.amberL : C.redL;
                const isSelected = selectedMetric && isSameStore(selectedMetric.loja, r.loja);

                return (
                  <tr
                    key={r.loja}
                    className={isSelected ? 'ranking-row-selected' : ''}
                    style={{
                      borderTop: `1px solid ${C.border}`,
                      transition: 'background .1s',
                    }}
                    onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = C.bg; }}
                    onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = 'white'; }}
                  >
                    {/* Ranking */}
                    <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                      <div
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: 30,
                          height: 30,
                          borderRadius: 8,
                          background: medal.bg,
                          border: `1.5px solid ${medal.border}`,
                          fontWeight: 900,
                          fontSize: 13,
                          color: medal.color,
                        }}
                      >
                        {r.rank <= 3 ? ['🥇','🥈','🥉'][r.rank - 1] : `#${r.rank}`}
                      </div>
                    </td>

                    {/* Franquia */}
                    <td style={{ padding: '10px 12px', fontWeight: 600, fontSize: 13, color: C.text, minWidth: 160 }}>
                      {r.loja} {isSelected && <Pill color={C.red} bg={C.redL} s={9}>Sua unidade</Pill>}
                    </td>

                    {/* Disponibilidade */}
                    <td style={{ padding: '10px 12px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '3px 10px',
                          borderRadius: 20,
                          background: dispBg,
                          color: dispColor,
                          fontWeight: 900,
                          fontSize: 13,
                          minWidth: 52,
                          textAlign: 'center',
                        }}
                      >
                        {r.disponib}%
                      </span>
                    </td>

                    {/* Ativos */}
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: C.green, fontWeight: 700, fontSize: 13 }}>
                      {r.a}
                    </td>

                    {/* Pausados */}
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: r.p > 0 ? C.red : C.muted, fontWeight: 700, fontSize: 13 }}>
                      {r.p}
                    </td>

                    {/* Receita Pausada */}
                    {showFinancials && <td style={{ padding: '10px 12px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {r.risco > 0 ? (
                        <span style={{ color: C.orange, fontWeight: 700, fontSize: 12 }}>
                          {brl(r.risco)}
                        </span>
                      ) : (
                        <span style={{ color: C.muted, fontSize: 12 }}>—</span>
                      )}
                    </td>}

                    {/* vs. Média da Rede */}
                    <td style={{ padding: '10px 12px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 3,
                            padding: '3px 9px',
                            borderRadius: 20,
                            background: abaixo ? C.redL : C.greenL,
                            color: abaixo ? C.red : C.green,
                            fontWeight: 700,
                            fontSize: 11,
                          }}
                        >
                          {abaixo ? '▼' : '▲'}
                          {Math.abs(vsRede)}%
                        </span>
                        {abaixo && (
                          <Pill color={C.red} bg={C.redL} s={10}>Abaixo</Pill>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {sorted.length === 0 && (
                <tr>
                  <td
                    colSpan={showFinancials ? 7 : 6}
                    style={{ textAlign: 'center', padding: '32px 20px', color: C.muted, fontSize: 13 }}
                  >
                    Nenhuma franquia encontrada com os filtros selecionados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Legenda */}
        <div
          style={{
            display: 'flex',
            gap: 16,
            padding: '10px 14px',
            borderTop: `1px solid ${C.border}`,
            background: C.bg,
            flexWrap: 'wrap',
          }}
        >
          <span style={{ fontSize: 10, color: C.muted }}>
            Média da rede: <b style={{ color: C.blue }}>{mediaRede}%</b>
          </span>
          {[
            [C.green, '≥ 80% — OK'],
            [C.amber,  '60–79% — Atenção'],
            [C.red,    '< 60% — Crítico'],
          ].map(([c, l]) => (
            <span key={l} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: C.muted }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: c, display: 'inline-block' }} />
              {l}
            </span>
          ))}
          <span style={{ fontSize: 10, color: C.muted, marginLeft: 'auto' }}>
            Clique nos cabeçalhos para ordenar
          </span>
        </div>
      </Card>
    </div>
  );
}
