import { useMemo, useState } from 'react';
import { Card } from '../components/ui/Card.jsx';
import { C } from '../constants.js';
import { brl } from '../utils/format.js';

const FAMILIES = [
  { id: 'cannoli', label: 'Cannoli', terms: ['cannoli'] },
  { id: 'crostini', label: 'Crostini', terms: ['crostini'] },
  { id: 'palha', label: 'Palha Italiana', terms: ['palha', 'palha italiana'] },
  { id: 'brownie', label: 'Brownie', terms: ['brownie'] },
  { id: 'tiramisu', label: 'Tiramisu', terms: ['tiramisu', 'tiramisù'] },
];

const normalize = (value) => String(value || '')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase('pt-BR');

function familyOf(item) {
  const name = normalize(item);
  return FAMILIES.find((family) => family.terms.some((term) => name.startsWith(normalize(term))))?.id || null;
}

export function ForneriaPage({ rows, summaryRows = [], showFinancials }) {
  const [selectedFamilies, setSelectedFamilies] = useState(() => FAMILIES.map((entry) => entry.id));
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);

  const forneriaRows = useMemo(() => {
    const unique = new Map();
    rows.filter((row) => familyOf(row.item)).forEach((row) => {
      unique.set(`${normalize(row.loja)}|${normalize(row.item)}|${row.dia || ''}|${row.shift || ''}`, row);
    });
    return [...unique.values()];
  }, [rows]);
  const visible = useMemo(() => {
    const term = normalize(query.trim());
    return forneriaRows.filter((row) => {
      const matchesFamily = selectedFamilies.includes(familyOf(row.item));
      const matchesQuery = !term || normalize(`${row.item} ${row.loja} ${row.categoria}`).includes(term);
      return matchesFamily && matchesQuery;
    });
  }, [forneriaRows, selectedFamilies, query]);

  const summaryVisible = summaryRows.filter((entry) => selectedFamilies.includes(entry.family));
  const active = summaryVisible.length
    ? summaryVisible.reduce((sum, entry) => sum + entry.active, 0)
    : visible.filter((row) => row.status === 'Ativo').length;
  const paused = summaryVisible.length
    ? summaryVisible.reduce((sum, entry) => sum + entry.paused, 0)
    : visible.filter((row) => row.status === 'Pausado').length;
  const total = active + paused;
  const aggregateView = summaryVisible.length > 0 || visible.some((row) => row.aggregateLevel === 'brand');
  const availability = total ? Math.round(active / total * 100) : 0;
  const stores = summaryVisible.length
    ? new Set(summaryVisible.map((row) => row.brandId)).size
    : new Set(visible.map((row) => normalize(row.loja))).size;
  const productTypes = summaryVisible.length
    ? new Set(summaryVisible.map((row) => row.family)).size
    : new Set(visible.map((row) => familyOf(row.item))).size;
  const fullyActiveStores = Object.values(visible.reduce((groups, row) => {
    (groups[row.loja] ||= []).push(row);
    return groups;
  }, {})).filter((storeRows) => storeRows.every((row) => row.status === 'Ativo')).length;
  const pageSize = 7;
  const pages = Math.max(1, Math.ceil(visible.length / pageSize));
  const currentPage = Math.min(page, pages);
  const paginated = visible.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  function toggleFamily(next) {
    setSelectedFamilies((current) => current.includes(next)
      ? current.filter((entry) => entry !== next)
      : [...current, next]);
    setPage(1);
  }

  return (
    <section className="forneria-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">ACOMPANHAMENTO DE PRODUTOS</span>
          <h1>Forneria</h1>
          <p>Cannoli, Crostini, Palha Italiana, Brownie e Tiramisu no período selecionado.</p>
        </div>
      </div>

      <div className="forneria-kpis">
        <Card><small>Disponibilidade ativa</small><strong style={{ color: availability === 100 ? C.green : C.amber }}>{availability}%</strong></Card>
        <Card><small>Ativos</small><strong style={{ color: C.green }}>{active}</strong></Card>
        <Card><small>Pausados</small><strong style={{ color: C.red }}>{paused}</strong></Card>
        <Card><small>Tipos encontrados</small><strong>{productTypes} de {FAMILIES.length}</strong></Card>
        <Card><small>{aggregateView ? 'Marcas encontradas' : 'Unidades encontradas'}</small><strong>{stores}</strong></Card>
        <Card><small>{aggregateView ? 'Marcas 100% ativas' : 'Unidades 100% ativas'}</small><strong style={{ color: C.green }}>{fullyActiveStores}</strong></Card>
      </div>

      <Card>
        <div className="forneria-toolbar">
          <button type="button" className="forneria-all"
            onClick={() => { setSelectedFamilies(FAMILIES.map((entry) => entry.id)); setPage(1); }}>
            Ver todos os produtos
          </button>
          <input type="search" value={query} placeholder="Pesquisar unidade ou produto..."
            onChange={(event) => { setQuery(event.target.value); setPage(1); }} />
        </div>

        <div className="forneria-family-grid">
          {FAMILIES.map((entry) => {
            const term = normalize(query.trim());
            const familyRows = forneriaRows.filter((row) => (
              familyOf(row.item) === entry.id
              && (!term || normalize(`${row.item} ${row.loja} ${row.categoria}`).includes(term))
            ));
            const familySummary = summaryRows.filter((row) => row.family === entry.id);
            const familyActive = familySummary.length
              ? familySummary.reduce((sum, row) => sum + row.active, 0)
              : familyRows.filter((row) => row.status === 'Ativo').length;
            const familyPaused = familySummary.length
              ? familySummary.reduce((sum, row) => sum + row.paused, 0)
              : familyRows.length - familyActive;
            const familyTotal = familyActive + familyPaused;
            const familyAvailability = familyTotal ? Math.round(familyActive / familyTotal * 100) : 0;
            return (
              <button
                type="button"
                key={entry.id}
                className={selectedFamilies.includes(entry.id) ? 'active' : ''}
                aria-pressed={selectedFamilies.includes(entry.id)}
                onClick={() => toggleFamily(entry.id)}
              >
                <small>{entry.label}</small>
                <strong>{familyAvailability}% ativos</strong>
                <span><b>{familyActive}</b> ativos · <b>{familyPaused}</b> pausados</span>
                <i>{selectedFamilies.includes(entry.id) ? 'Incluído no filtro' : 'Clique para incluir'}</i>
              </button>
            );
          })}
        </div>

        <div className="forneria-list">
          {paginated.map((row, index) => (
            <article key={`${row.loja}-${row.item}-${index}`} className="forneria-item">
              <span className={`status-dot ${row.status === 'Pausado' ? 'paused' : 'active'}`} />
              <div>
                <strong>{row.item}</strong>
                <small>{row.loja} · {row.categoria || 'Sem categoria'}</small>
              </div>
              <span className={`status-pill ${row.status === 'Pausado' ? 'paused' : 'active'}`}>{row.status}</span>
              {showFinancials && <b>{Number(row.precoNum) > 0 ? brl(row.precoNum) : '—'}</b>}
            </article>
          ))}
          {!paginated.length && (
            <div className="empty-state">
              {summaryRows.length
                ? 'O XLSX possui o consolidado deste turno, mas não lista todas as unidades ativas individualmente.'
                : 'Nenhum produto da Forneria encontrado neste recorte.'}
            </div>
          )}
        </div>

        {pages > 1 && (
          <div className="forneria-pagination">
            <button type="button" disabled={currentPage === 1} onClick={() => setPage((value) => value - 1)}>Anterior</button>
            <span>{currentPage} de {pages}</span>
            <button type="button" disabled={currentPage === pages} onClick={() => setPage((value) => value + 1)}>Próxima</button>
          </div>
        )}
      </Card>
    </section>
  );
}
