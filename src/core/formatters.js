import { roundCurrency } from './money.js';

/**
 * Moeda de exibicao do usuario (preferencia em Configuracoes). So muda a forma de mostrar:
 * nenhum valor e convertido. Comeca em BRL e volta para BRL ao sair da conta.
 *
 * BRL: "R$ 1.234,56"   EUR: "1.234,56 €"  (mesmos separadores do pt-BR e do es-ES)
 */
export const DISPLAY_CURRENCIES = Object.freeze(['BRL', 'EUR']);
let displayCurrency = 'BRL';

export function setDisplayCurrency(currency) {
  displayCurrency = DISPLAY_CURRENCIES.includes(currency) ? currency : 'BRL';
  return displayCurrency;
}

export function getDisplayCurrency() {
  return displayCurrency;
}

function groupThousands(digits) {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function withSymbol(text, currency) {
  return currency === 'EUR' ? `${text} €` : `R$ ${text}`;
}

export function formatCurrency(value, { currency = displayCurrency } = {}) {
  const text = groupThousands(roundCurrency(value).toFixed(2).replace('.', ','));
  return withSymbol(text, currency);
}

export function formatCompactCurrency(value, { currency = displayCurrency } = {}) {
  const amount = Number(value) || 0;
  const abs = Math.abs(amount);
  const million = currency === 'EUR' ? 'M' : 'mi';
  if (abs >= 1000000) return withSymbol(`${(amount / 1000000).toFixed(1).replace('.', ',')} ${million}`, currency);
  if (abs >= 1000) return withSymbol(`${(amount / 1000).toFixed(1).replace('.', ',')} mil`, currency);
  return withSymbol(groupThousands(Math.round(amount).toString()), currency);
}

// Simbolo da moeda de exibicao, para rotulos como "Valor (R$)".
export function currencySymbol(currency = displayCurrency) {
  return currency === 'EUR' ? '€' : 'R$';
}
