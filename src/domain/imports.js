import { parseCurrencyValue } from '../core/money.js';

export function normalizeImportText(value) {
  return String(value ?? '').trim();
}

export function normalizeCycleValue(value) {
  const base = normalizeImportText(value).toUpperCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (!base) return '';
  if (base.includes('QUINZENA')) return 'QUINZENA';
  if (base.includes('INICIO')) return 'INICIO_MES';
  return '';
}

export function normalizeStatusValue(value) {
  const base = normalizeImportText(value).toLowerCase();
  if (!base) return 'Em aberto';
  if (base.includes('cancel')) return 'Cancelado';
  if (base.includes('pago')) return 'Pago';
  return 'Em aberto';
}

export { parseCurrencyValue };
