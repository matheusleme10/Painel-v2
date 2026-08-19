import { useMemo, useState } from 'react';
import { Card } from '../components/ui/Card.jsx';
import { StatusItemsPanel } from '../components/ui/StatusItemsPanel.jsx';
import { DailyItemsMatrix } from '../components/ui/DailyItemsMatrix.jsx';
import { DraftPriceField } from '../components/ui/DraftPriceField.jsx';

const PAGE_SIZE = 10;

const DIACRITICS = new RegExp('[' + String.fromCharCode(0x0300) + '-' + String.fromCharCode(0x036f) + ']', 'g');
const normalize = (value) => String(value || '')
  .normalize('NFD').replace(DIACRITICS, '')
  .toLocaleLowerCase('pt-BR');

export function FranchiseCatalogPage({ rows, onSetDraft, onSavePrice }) {
  const [priceQuery, setPriceQuery] = useState('');
  const [priceCategory, setPriceCategory] = useState('all');
  const [pricePage, setPricePage] = useState(0);

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
        active: 0, paused: 0, priced: 0, priceSum: 0, manual: false, stores: new Set(),
      };
      if (row.status === 'Ativo') item.active += 1;
      if (row.status === 'Pausado') item.paused += 1;
      if (row.loja) item.stores.add(row.loja);
      if (Number(row.precoNum) > 0) {
        item.priced += 1;
        item.priceSum += Number(row.precoNum);
        if (row.precoManual) item.manual = true;
      }
      map.set(key, item);
    });
    return [...map.values()]
      .sort((a, b) => (b.active + b.paused) - (a.active + a.paused));
  }, [rows]);

  const priceCategories = useMemo(() => (
    [...new Set(unpricedItems.map((item) => item.category || 'Sem categoria'))].sort((a, b) => a.localeCompare(b, 'pt-BR'))
  ), [unpricedItems]);

  const filteredUnpricedItems = useMemo(() => {
    const term = normalize(priceQuery);
    return unpricedItems.filter((item) => {
      const matchesText = !term || normalize(`${item.name} ${item.category || ''}`).includes(term);
      const matchesCategory = priceCategory === 'all' || (item.category || 'Sem categoria') === priceCategory;
      return matchesText && matchesCategory;
    });
  }, [unpricedItems, priceQuery, priceCategory]);

  const pricePages = Math.max(1, Math.ceil(filteredUnpricedItems.length / PAGE_SIZE));
  const currentPricePage = Math.min(pricePage, pricePages - 1);
  const paginatedUnpricedItems = filteredUnpricedItems.slice(currentPricePage * PAGE_SIZE, currentPricePage * PAGE_SIZE + PAGE_SIZE);

  function changePriceFilter(action) {
    action();
    setPricePage(0);
  }

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
        <Card className="unpriced-items-card">
          <div className="paused-card-heading">
            <div><span className="eyebrow">AJUSTE DE PREÇOS</span><h2>Corrigir preço dos itens</h2></div>
          </div>
          <p className="draft-price-note">
            Digite o valor correto e clique em Salvar. O ajuste fica vinculado à sua unidade e permanece após novos uploads.
          </p>
          <div className="items-toolbar price-adjust-toolbar">
            <input
              type="search"
              value={priceQuery}
              placeholder="Pesquisar produto ou categoria..."
              onChange={(event) => changePriceFilter(() => setPriceQuery(event.target.value))}
            />
            <select value={priceCategory} onChange={(event) => changePriceFilter(() => setPriceCategory(event.target.value))} aria-label="Filtrar por categoria">
              <option value="all">Todas as categorias</option>
              {priceCategories.map((category) => <option key={category} value={category}>{category}</option>)}
            </select>
          </div>
          <div className="unpriced-items-list">
            {paginatedUnpricedItems.map((item) => (
              <article key={item.name} className="unpriced-item-row">
                <span><strong>{item.name}</strong><small>{item.category} · {item.active}× ativo · {item.paused}× pausado</small></span>
                <span><b>{item.priced ? `R$ ${(item.priceSum / item.priced).toFixed(2).replace('.', ',')}` : 'sem preço'}</b><small>{item.manual ? 'valor ajustado' : 'valor atual'}</small></span>
                <DraftPriceField itemName={item.name} category={item.category} stores={item.stores} onChange={onSetDraft} onSave={onSavePrice} currentPrice={item.priced ? item.priceSum / item.priced : 0} compact />
              </article>
            ))}
            {!paginatedUnpricedItems.length && <div className="empty-state">Nenhum item encontrado neste filtro.</div>}
          </div>
          {pricePages > 1 && (
            <div className="forneria-pagination">
              <button disabled={currentPricePage === 0} onClick={() => setPricePage((value) => value - 1)}>Anterior</button>
              <span>{currentPricePage + 1} de {pricePages}</span>
              <button disabled={currentPricePage + 1 >= pricePages} onClick={() => setPricePage((value) => value + 1)}>Próxima</button>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
