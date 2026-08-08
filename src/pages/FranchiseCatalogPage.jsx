import { useMemo } from 'react';
import { Card } from '../components/ui/Card.jsx';
import { StatusItemsPanel } from '../components/ui/StatusItemsPanel.jsx';
import { DailyItemsMatrix } from '../components/ui/DailyItemsMatrix.jsx';
import { DraftPriceField } from '../components/ui/DraftPriceField.jsx';

export function FranchiseCatalogPage({ rows, onSetDraft }) {
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
        active: 0, paused: 0, priced: 0, manual: false, stores: new Set(),
      };
      if (row.status === 'Ativo') item.active += 1;
      if (row.status === 'Pausado') item.paused += 1;
      if (row.loja) item.stores.add(row.loja);
      if (Number(row.precoNum) > 0) {
        item.priced += 1;
        if (row.precoManual) item.manual = true;
      }
      map.set(key, item);
    });
    return [...map.values()]
      .filter((item) => item.priced === 0 || item.manual)
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
      {onSetDraft && unpricedItems.length > 0 && (
        <Card className="unpriced-items-card">
          <div className="paused-card-heading">
            <div><span className="eyebrow">SEM PREÇO CADASTRADO</span><h2>Itens sem preço (ativos ou pausados)</h2></div>
          </div>
          <p className="draft-price-note">
            Valor digitado aqui é local (não é salvo) e atualiza os cards e KPIs desta e de outras páginas enquanto a sessão estiver aberta.
          </p>
          <div className="unpriced-items-list">
            {unpricedItems.slice(0, 20).map((item) => (
              <article key={item.name} className="unpriced-item-row">
                <span><strong>{item.name}</strong><small>{item.category} · {item.active}× ativo · {item.paused}× pausado</small></span>
                <span><b>{item.manual ? 'valor local' : 'sem preço'}</b><small>&nbsp;</small></span>
                <DraftPriceField itemName={item.name} stores={item.stores} onChange={onSetDraft} compact />
              </article>
            ))}
          </div>
        </Card>
      )}
      <DailyItemsMatrix rows={rows} title="Evolução diária do cardápio" />
    </div>
  );
}
