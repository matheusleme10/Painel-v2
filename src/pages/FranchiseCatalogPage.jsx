import { useMemo } from 'react';
import { StatusItemsPanel } from '../components/ui/StatusItemsPanel.jsx';
import { DailyItemsMatrix } from '../components/ui/DailyItemsMatrix.jsx';
import { PriceAdjustTable } from '../components/ui/PriceAdjustTable.jsx';

export function FranchiseCatalogPage({ rows, onSetDraft, onSavePrice }) {
  // Itens (ativos ou pausados, tanto faz) que não têm preço cadastrado em
  // nenhuma ocorrência recente — o valor digitado aqui é local (não salva)
  // e reflete na hora nas outras páginas que usam o mesmo cardápio.
  const unpricedItems = useMemo(() => {
    const map = new Map();
    rows.forEach((row) => {
      if (!row.item) return;
      const key = `${row.item}|${row.categoria}`;
      const item = map.get(key) || {
        name: row.item, category: row.categoria || 'Sem categoria',
        active: 0, paused: 0, pricedCount: 0, priceSum: 0, minPrice: 0, maxPrice: 0,
        manual: false, stores: new Set(),
      };
      if (row.status === 'Ativo') item.active += 1;
      if (row.status === 'Pausado') item.paused += 1;
      if (row.loja) item.stores.add(row.loja);
      if (Number(row.precoNum) > 0) {
        const price = Number(row.precoNum);
        item.pricedCount += 1;
        item.priceSum += price;
        item.minPrice = item.minPrice ? Math.min(item.minPrice, price) : price;
        item.maxPrice = Math.max(item.maxPrice, price);
        if (row.precoManual) item.manual = true;
      }
      map.set(key, item);
    });
    return [...map.values()]
      .sort((a, b) => (b.active + b.paused) - (a.active + a.paused));
  }, [rows]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div className="network-hero">
        <div>
          <span className="eyebrow">CATÁLOGO DA UNIDADE</span>
          <h1>Itens ativos e pausados</h1>
          <p>Pesquise o cardápio e navegue em páginas de sete itens por status.</p>
        </div>
      </div>
      <StatusItemsPanel rows={rows} title="Catálogo operacional" />
      <DailyItemsMatrix rows={rows} title="Evolução diária do cardápio" />
      {onSetDraft && unpricedItems.length > 0 && (
        <PriceAdjustTable
          items={unpricedItems}
          onSetDraft={onSetDraft}
          onSavePrice={onSavePrice}
          helpText="Digite o valor correto e clique em Salvar. O ajuste fica vinculado à sua unidade e permanece após novos uploads."
        />
      )}
    </div>
  );
}
