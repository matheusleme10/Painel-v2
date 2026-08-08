import { StatusItemsPanel } from '../components/ui/StatusItemsPanel.jsx';
import { DailyItemsMatrix } from '../components/ui/DailyItemsMatrix.jsx';

export function FranchiseCatalogPage({ rows, priceDraftsApi }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div className="network-hero">
        <div>
          <span className="eyebrow">CATÁLOGO DA UNIDADE</span>
          <h1>Itens ativos e pausados</h1>
          <p>Pesquise o cardápio e navegue em páginas de sete itens por status.</p>
        </div>
      </div>
      <StatusItemsPanel rows={rows} title="Catálogo operacional" priceDraftsApi={priceDraftsApi} />
      <DailyItemsMatrix rows={rows} title="Evolução diária do cardápio" />
    </div>
  );
}
