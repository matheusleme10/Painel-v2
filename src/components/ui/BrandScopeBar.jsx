import { BRANDS, identifyBrand } from '../../utils/brands.js';

export function BrandScopeBar({ value = 'all', stores = [], onChange }) {
  return (
    <section className="brand-scope-wrap" aria-label="Filtrar todas as páginas por marca">
      <div className="brand-scope">
        <button
          type="button"
          className={value === 'all' ? 'active' : ''}
          onClick={() => onChange('all')}
        >
          <span className="brand-filter-mark">★</span>
          <span><strong>Todas</strong><small>Visão da rede</small></span>
        </button>
        {BRANDS.map((brand) => {
          const count = new Set(stores.filter((store) => identifyBrand(store) === brand.id)).size;
          return (
            <button
              key={brand.id}
              type="button"
              className={value === brand.id ? 'active' : ''}
              style={{ '--brand-color': brand.color, '--brand-soft': brand.soft }}
              onClick={() => onChange(brand.id)}
            >
              <span className="brand-filter-mark">{brand.short.charAt(0)}</span>
              <span><strong>{brand.name}</strong><small>{count} unidades</small></span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
