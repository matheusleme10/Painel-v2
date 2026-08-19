// Classificação de preço usada na tela "Ajuste de Preços" (admin e
// franqueado). Centralizado aqui de propósito — se precisar mudar a régua
// (por exemplo, o limite do que é "preço suspeito"), mexe só neste arquivo;
// nenhum componente deve reimplementar essa lógica por conta própria.
//
// Limitação conhecida: o parser (src/utils/parser.js e
// src/utils/pivot-cache.js, via parsePrice) converte tanto uma célula de
// preço vazia quanto um preço explicitamente "0"/"0,00" para o mesmo número
// 0 — não existe, em nenhum ponto do pipeline atual, um sinal que diferencie
// "preço não veio" de "preço veio e era exatamente zero". Por isso as duas
// situações caem na mesma categoria abaixo ("Sem preço"). Separar de verdade
// exigiria alterar o parser para preservar essa distinção lá na origem, o
// que é uma mudança maior e não foi feita aqui.

export const SUSPICIOUS_PRICE_THRESHOLD = 1; // preços entre R$0,01 e R$0,99 viram "Verificar preço"

export const PRICE_STATUS = {
  missing: { key: 'missing', label: 'Sem preço', badgeClass: 'missing' },
  suspicious: { key: 'suspicious', label: 'Verificar preço', badgeClass: 'suspicious' },
  ok: { key: 'ok', label: 'Preço OK', badgeClass: 'ok' },
};

// item = { pricedCount, averagePrice }
// pricedCount: quantas ocorrências desse item tinham preço > 0.
// averagePrice: preço médio dessas ocorrências (0 se pricedCount for 0).
export function classifyPriceStatus({ pricedCount, averagePrice }) {
  if (!pricedCount) return PRICE_STATUS.missing;
  if (averagePrice > 0 && averagePrice < SUSPICIOUS_PRICE_THRESHOLD) return PRICE_STATUS.suspicious;
  return PRICE_STATUS.ok;
}
