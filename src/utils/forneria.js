// Classificação dos itens da Forneria, compartilhada entre a página da
// Forneria e a página de Potencial (que precisa saber quanto da receita
// ativa/pausada pertence a essa família de produtos).
export const FORNERIA_FAMILIES = [
  { id: 'cannoli', label: 'Cannoli', terms: ['cannoli'] },
  { id: 'crostini', label: 'Crostini', terms: ['crostini'] },
  { id: 'palha', label: 'Palha Italiana', terms: ['palha', 'palha italiana'] },
  { id: 'brownie', label: 'Brownie', terms: ['brownie'] },
  { id: 'tiramisu', label: 'Tiramisu', terms: ['tiramisu', 'tiramisù'] },
];

const DIACRITICS = new RegExp('[' + String.fromCharCode(0x0300) + '-' + String.fromCharCode(0x036f) + ']', 'g');

const normalize = (value) => String(value || '')
  .normalize('NFD').replace(DIACRITICS, '')
  .toLocaleLowerCase('pt-BR');

export function forneriaFamilyOf(item) {
  const name = normalize(item);
  return FORNERIA_FAMILIES.find((family) => family.terms.some((term) => name.startsWith(normalize(term))))?.id || null;
}
