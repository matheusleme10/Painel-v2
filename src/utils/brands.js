export const BRANDS = [
  {
    id: 'ital',
    name: 'Ital in House',
    short: 'Ital',
    description: 'A maior rede da casa, agora em tempo real.',
    color: '#C8102E',
    soft: '#FFF0F2',
    match: ['italin house', 'ital in house'],
  },
  {
    id: 'caipira',
    name: 'Fast Food Caipira',
    short: 'Caipira',
    description: 'Sabor de casa, operação afiada.',
    color: '#E76F19',
    soft: '#FFF3E8',
    match: ['caipira', 'boiadeir'],
  },
  {
    id: 'city',
    name: 'City Burger',
    short: 'City',
    description: 'Burgers urbanos, dados no ponto.',
    color: '#1769E0',
    soft: '#EAF2FF',
    match: ['city', 'burger'],
  },
  {
    id: 'green',
    name: 'Green',
    short: 'Green',
    description: 'Leve, fresco e sempre disponível.',
    color: '#16845B',
    soft: '#E9F8F1',
    match: ['green', 'salad', 'salada'],
  },
];

export function identifyBrand(storeName = '') {
  const name = String(storeName).toLocaleLowerCase('pt-BR');
  if (name.includes('city') || name.includes('burger')) return 'city';
  if (name.includes('green') || name.includes('salad') || name.includes('salada')) return 'green';
  if (name.includes('caipira') || name.includes('boiadeir')) return 'caipira';
  return 'ital';
}

export function brandById(id) {
  return BRANDS.find((brand) => brand.id === id) || BRANDS[0];
}
