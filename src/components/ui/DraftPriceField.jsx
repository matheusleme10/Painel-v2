import { useState } from 'react';

// Campo de preço "ao vivo": sem botão de salvar, cada tecla já dispara
// onChange e os cards/KPIs recalculam na hora. Não persiste nada — some ao
// recarregar a página.
export function DraftPriceField({ itemName, category = '', stores, isAdmin = false, networkWide = false, onChange, onSave, currentPrice = 0, compact = false }) {
  const [value, setValue] = useState('');
  const [status, setStatus] = useState('idle');

  function handleChange(event) {
    const raw = event.target.value;
    setValue(raw);
    const numeric = Number(String(raw).replace(',', '.'));
    setStatus('idle');
    onChange?.({
      item: itemName,
      price: numeric > 0 ? numeric : 0,
      scope: isAdmin && networkWide ? 'network' : 'store',
      store: stores && stores.size ? [...stores][0] : undefined,
      stores,
    });
  }

  async function save() {
    const numeric = Number(String(value).replace(',', '.'));
    if (!(numeric > 0) || !onSave) return;
    const targets = stores && stores.size ? [...stores] : [];
    setStatus('saving');
    try {
      await Promise.all(targets.map((store) => onSave({ store, item: itemName, categoria: category, price: numeric })));
      setStatus('saved');
    } catch {
      setStatus('error');
    }
  }

  return (
    <span
      className={`draft-price-field${compact ? ' compact' : ''}`}
      onClick={(event) => event.stopPropagation()}
    >
      <input
        type="number" min="0" step="0.01" inputMode="decimal" placeholder="Preço R$"
        aria-label={`Novo preço de ${itemName}`} value={value} onChange={handleChange}
      />
      {onSave && <button type="button" disabled={status === 'saving' || !(Number(String(value).replace(',', '.')) > 0)} onClick={save}>
        {status === 'saving' ? '...' : status === 'saved' ? '✓' : 'Salvar'}
      </button>}
      {status === 'error' && <small>Falha ao salvar</small>}
      {!value && currentPrice > 0 && <small>Atual: R$ {Number(currentPrice).toFixed(2).replace('.', ',')}</small>}
    </span>
  );
}
