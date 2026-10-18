import { roundCurrency } from './money.js';

export function formatCurrency(value) {
  return `R$ ${roundCurrency(value).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
}

export function formatCompactCurrency(value) {
  const amount = Number(value) || 0;
  const abs = Math.abs(amount);
  if (abs >= 1000000) return `R$ ${(amount / 1000000).toFixed(1).replace('.', ',')} mi`;
  if (abs >= 1000) return `R$ ${(amount / 1000).toFixed(1).replace('.', ',')} mil`;
  return `R$ ${Math.round(amount).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
}
