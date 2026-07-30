import { useMemo, useState } from 'react';
import { BRANDS, identifyBrand } from '../utils/brands.js';

export function BrandSelector({ rows, onSelect }) {
  const [brandId, setBrandId] = useState('');
  const [store, setStore] = useState('');
  const [query, setQuery] = useState('');
  const stores = useMemo(() => [...new Set(rows
    .filter((row) => identifyBrand(row.loja) === brandId)
    .map((row) => row.loja))].sort((a, b) => a.localeCompare(b, 'pt-BR')), [rows, brandId]);
  const suggestions = stores.filter((name) =>
    name.toLocaleLowerCase('pt-BR').includes(query.toLocaleLowerCase('pt-BR'))
  ).slice(0, 8);

  return (
    <main className="selector-shell">
      <header className="selector-heading">
        <span className="eyebrow">ESCOLHA SEU PAINEL</span>
        <h1>Qual operação vamos acompanhar hoje?</h1>
        <p>Selecione a marca e depois a sua unidade. Os indicadores serão isolados para esse contexto.</p>
      </header>
      <section className="brand-grid">
        {BRANDS.map((brand) => (
          <button key={brand.id} className={`brand-card ${brandId === brand.id ? 'selected' : ''}`}
            style={{ '--brand-color': brand.color, '--brand-soft': brand.soft }}
            onClick={() => { setBrandId(brand.id); setStore(''); setQuery(''); }}>
            <span className="brand-monogram">{brand.short.charAt(0)}</span>
            <strong>{brand.name}</strong>
            <small>{brand.description}</small>
            <span className="brand-count">{new Set(rows.filter((row) => identifyBrand(row.loja) === brand.id).map((row) => row.loja)).size} unidades</span>
          </button>
        ))}
      </section>
      {brandId && (
        <section className="unit-picker">
          <label htmlFor="unit-search">Pesquise sua unidade</label>
          <input id="unit-search" value={query} autoComplete="off"
            placeholder="Digite cidade, bairro ou nome da loja…"
            onChange={(event) => { setQuery(event.target.value); setStore(''); }} />
          {query && !store && <div className="unit-suggestions">
            {suggestions.map((name) => (
              <button key={name} type="button" onClick={() => { setStore(name); setQuery(name); }}>{name}</button>
            ))}
            {!suggestions.length && <span>Nenhuma unidade encontrada.</span>}
          </div>}
          {!stores.length && <p>Nenhuma unidade dessa marca foi encontrada na última base.</p>}
          <button disabled={!store} onClick={() => onSelect({ brandId, store })}>Abrir dashboard da unidade</button>
        </section>
      )}
    </main>
  );
}
