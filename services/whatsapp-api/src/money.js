import { AsyncLocalStorage } from 'node:async_hooks';
import { roundCurrency } from '../../../src/core/money.js';

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
// Euro no padrao espanhol/portugues: "1.234,56 €" (sempre com separador de milhar).
const EUR_NUMBER = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Moeda de exibicao do usuario da requisicao atual (preferencia escolhida no Dashboard).
const currencyContext = new AsyncLocalStorage();

/** Executa fn com a moeda do usuario: tudo que formatMoney formatar dentro dela usa essa moeda. */
export function runWithCurrency(currency, fn) {
  return currencyContext.run(currency === 'EUR' ? 'EUR' : 'BRL', fn);
}

export function currentCurrency() {
  return currencyContext.getStore() || 'BRL';
}

export function formatBRL(value) {
  return BRL.format(roundCurrency(value)).replace(/\u00a0/g, ' ');
}

export function formatEUR(value) {
  return `${EUR_NUMBER.format(roundCurrency(value))} €`;
}

/** Formata na moeda do usuario (BRL "R$ 1.234,56" ou EUR "1.234,56 €"). Nao converte valores. */
export function formatMoney(value, currency = currentCurrency()) {
  return currency === 'EUR' ? formatEUR(value) : formatBRL(value);
}

/**
 * Converte valores vindos da IA: 150, "150", "150,90", "1.234,56", "R$ 1.234,56", "1.234,56 €", "150.90".
 * Retorna NaN quando ambiguo ou invalido.
 */
export function parseAmount(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? roundCurrency(value) : NaN;
  const clean = String(value ?? '').replace(/\s/g, '').replace(/R\$/gi, '').replace(/€|EUR/gi, '');
  if (!clean) return NaN;
  if (/^\d+$/.test(clean)) return Number(clean);
  if (/^\d+\.\d{1,2}$/.test(clean)) return Number(clean);
  if (/^\d+,\d{1,2}$/.test(clean)) return Number(clean.replace(',', '.'));
  if (/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(clean)) return Number(clean.replace(/\./g, '').replace(',', '.'));
  return NaN;
}

export { roundCurrency };
