import { normalizeImportText } from '../domain/imports.js';
import { queryFinanceRecordsForTarget } from '../state/financeRecordIndex.js';

const TRANSACTION_TYPES = new Set(['entrada', 'saida']);
const MAX_TRANSACTION_RECORDS = 20000;

function getRecords(target = window) {
  return Array.isArray(target.allRecords) ? target.allRecords : [];
}

export function isTransactionRecord(record) {
  return TRANSACTION_TYPES.has(record?.type);
}

export function isArchivedRecord(record) {
  return Boolean(record?.archived);
}

export function isReferenceSalaryRecord(record) {
  return record?.type === 'entrada' && record?.macro_category === 'Referência Salarial';
}

export function isFinancialEntradaRecord(record) {
  return record?.type === 'entrada' && !isReferenceSalaryRecord(record);
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function normalizePaymentFilterValue(value) {
  const raw = normalizeImportText(value);
  if (!raw) return '';

  const normalized = raw.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[-_/]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const hasCreditContext = normalized.includes('credito') || normalized.includes('cartao');
  const hasWords = (...terms) => terms.every((term) => normalized.includes(term));

  if (normalized.includes('pix')) return 'Pix';

  if (hasWords('inter') && hasCreditContext) return 'Crédito inter - Global';
  if (hasWords('nubank') && hasCreditContext) return 'Crédito Nubank';
  if (hasWords('bradesco') && hasCreditContext) return 'Crédito Bradesco';
  if (hasWords('carrefour') && hasCreditContext) return 'Crédito Carrefour';
  if (hasWords('mercado', 'pago') && hasCreditContext) return 'Crédito Mercado Pago';

  if (normalized.includes('nubank')) return 'Nubank';
  if (normalized.includes('inter')) return 'Inter';
  if (normalized.includes('bradesco')) return 'Bradesco';
  if (normalized.includes('carrefour')) return 'Carrefour';
  if (hasWords('mercado', 'pago')) return 'Mercado Pago';

  return raw;
}

export function getTransactionRecords(options = {}, target = window) {
  const {
    type,
    archiveMode = 'active',
    competence,
    competenceStart,
    competenceEnd,
    person,
    macro,
    cycle,
    status
  } = options;

  return queryFinanceRecordsForTarget({
    transactionOnly: true,
    type,
    archiveMode,
    competence,
    competenceStart,
    competenceEnd,
    person,
    macro,
    cycle,
    status
  }, target).filter((record) => {
    if (!isTransactionRecord(record)) return false;
    return true;
  });
}

export function getTransactionCount(target = window) {
  return getTransactionRecords({ archiveMode: 'active' }, target).length;
}

export function countRecordsByType(type, target = window) {
  return queryFinanceRecordsForTarget({ type }, target).length;
}

export function getArchiveCounts(type, target = window) {
  const total = getTransactionRecords({ type, archiveMode: 'all' }, target).length;
  const archived = getTransactionRecords({ type, archiveMode: 'archived' }, target).length;
  return { total, archived, active: total - archived };
}

export function getRemainingTransactionSlots(target = window) {
  return Math.max(0, MAX_TRANSACTION_RECORDS - getTransactionCount(target));
}

export function hasTransactionCapacity(required = 1, target = window) {
  return getRemainingTransactionSlots(target) >= required;
}

export function installRecordHelperGlobals(target = window) {
  Object.assign(target, {
    countRecordsByType: (type) => countRecordsByType(type, target),
    escapeHtml,
    getArchiveCounts: (type) => getArchiveCounts(type, target),
    getRemainingTransactionSlots: () => getRemainingTransactionSlots(target),
    getTransactionCount: () => getTransactionCount(target),
    getTransactionRecords: (options = {}) => getTransactionRecords(options, target),
    hasTransactionCapacity: (required = 1) => hasTransactionCapacity(required, target),
    isArchivedRecord,
    isFinancialEntradaRecord,
    isReferenceSalaryRecord,
    isTransactionRecord,
    normalizePaymentFilterValue
  });
}
