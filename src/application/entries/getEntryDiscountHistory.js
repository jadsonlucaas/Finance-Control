import { roundCurrency } from '../../core/money.js';

export function normalizeEntryDiscountCycle(value = '') {
  return value === 'QUINZENA' ? 'QUINZENA' : 'INICIO_MES';
}

function normalizeLookupText(value = '') {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
}

export function isDeductionLikeMacro(value = '') {
  const text = normalizeLookupText(value);
  return text.includes('DEDU') || text.includes('DEDUC') || text.includes('DEDUCAO');
}

export function isEntryDiscountRecord(record = {}) {
  if (record?.entry_discount_adjustment === true) return true;
  if (isDeductionLikeMacro(record?.macro_category || '')) return true;

  const text = normalizeLookupText([
    record?.earning_type,
    record?.subcategory,
    record?.description
  ].filter(Boolean).join(' '));

  return text.includes('DESCONTO') || text.includes('INSS') || text.includes('IRRF') || text.includes('IRPF');
}

export function getEntryDiscountHistoryItems(record = {}) {
  return Array.isArray(record?.entry_discount_history) ? record.entry_discount_history : [];
}

export function getEntryDiscountHistoryTotal(record = {}) {
  return roundCurrency(getEntryDiscountHistoryItems(record).reduce((sum, item) => sum + (Number(item?.amount) || 0), 0));
}

export function getEntryDiscountRecordTotal(record = {}) {
  const historyTotal = getEntryDiscountHistoryTotal(record);
  return record?.entry_discount_adjustment === true && historyTotal > 0
    ? historyTotal
    : roundCurrency(Number(record?.amount || 0));
}

export function getEntryDiscountAdjustmentRecord(records = [], person = '', competencia = '', cycle = 'INICIO_MES') {
  const normalizedCycle = normalizeEntryDiscountCycle(cycle);
  return (Array.isArray(records) ? records : []).find((record) =>
    record?.type === 'entrada' &&
    record.person === person &&
    record.competence === competencia &&
    record.entry_discount_adjustment === true &&
    normalizeEntryDiscountCycle(record.entry_discount_cycle || record.cycle || '') === normalizedCycle
  ) || null;
}

export function getEntryPeriodDiscountRecords(records = [], person = '', competencia = '') {
  return (Array.isArray(records) ? records : [])
    .filter((record) =>
      record?.type === 'entrada' &&
      record.person === person &&
      record.competence === competencia &&
      isEntryDiscountRecord(record)
    )
    .sort((a, b) => {
      const cycleCompare = normalizeEntryDiscountCycle(a.entry_discount_cycle || a.cycle || '')
        .localeCompare(normalizeEntryDiscountCycle(b.entry_discount_cycle || b.cycle || ''));
      if (cycleCompare !== 0) return cycleCompare;
      return String(b.updated_at || b.created_at || '').localeCompare(String(a.updated_at || a.created_at || ''));
    });
}

