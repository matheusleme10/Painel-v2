import { useState } from 'react';

// Campo de preço "ao vivo": sem botão de salvar, cada tecla já dispara
// onChange e os cards/KPIs recalculam na hora. Não persiste nada — some ao
// recarregar a página.
export function DraftPriceField({ itemName, stores, isAdmin = false, networkWide = false, onChange, compact = false }) {
  const [value, setValue] = useState('');

  function handleChange(event) {
    const raw = event.target.value;
    setValue(raw);
    const numeric = Number(String(raw).replace(',', '.'));
    onChange({
      item: itemName,
      price: numeric > 0 ? numeric : 0,
      scope: isAdmin && networkWide ? 'network' : 'store',
      store: stores && stores.size ? [...stores][0] : undefined,
      stores,
    });
  }

  return (
    <span
      className={`draft-price-field${compact ? ' compact' : ''}`}
      onClick={(event) => event.stopPropagation()}
    >
      <input
        type="number" min="0" step="0.01" inputMode="decimal" placeholder="Preço R$"
        value={value} onChange={handleChange}
      />
    </span>
  );
}
