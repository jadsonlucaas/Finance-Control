import { roundCurrency } from '../../../src/core/money.js';

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export function formatBRL(value) {
  return BRL.format(roundCurrency(value)).replace(/ /g, ' ');
}

/**
 * Converte valores vindos da IA: 150, "150", "150,90", "1.234,56", "R$ 1.234,56", "150.90".
 * Retorna NaN quando ambiguo ou invalido.
 */
export function parseAmount(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? roundCurrency(value) : NaN;
  const clean = String(value ?? '').replace(/\s/g, '').replace(/R\$/gi, '');
  if (!clean) return NaN;
  if (/^\d+$/.test(clean)) return Number(clean);
  if (/^\d+\.\d{1,2}$/.test(clean)) return Number(clean);
  if (/^\d+,\d{1,2}$/.test(clean)) return Number(clean.replace(',', '.'));
  if (/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(clean)) return Number(clean.replace(/\./g, '').replace(',', '.'));
  return NaN;
}

export { roundCurrency };
