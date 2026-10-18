import {
  centsToMoney,
  moneyToCents,
  splitAmountIntoInstallments,
  validateInstallmentSplit
} from '../core/money.js';
import { FINANCE_RECORD_SCHEMA_VERSION } from './records/index.js';

function issue(field, code, message, severity = 'error') {
  return { field, code, message, severity };
}

function pad2(value) {
  return String(value).padStart(2, '0');
}

function parseIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return null;
  const [year, month, day] = String(value).split('-').map(Number);
  if (!year || !month || !day) return null;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (day > lastDay) return null;
  return { year, month, day };
}

export function addMonthsClamped(dateValue = '', monthsToAdd = 0) {
  const parsed = parseIsoDate(dateValue);
  if (!parsed) throw new Error('Data de vencimento invalida.');
  const monthIndex = parsed.month - 1 + monthsToAdd;
  const targetYear = parsed.year + Math.floor(monthIndex / 12);
  const targetMonthIndex = ((monthIndex % 12) + 12) % 12;
  const targetMonth = targetMonthIndex + 1;
  const lastDay = new Date(Date.UTC(targetYear, targetMonth, 0)).getUTCDate();
  const targetDay = Math.min(parsed.day, lastDay);
  return `${targetYear}-${pad2(targetMonth)}-${pad2(targetDay)}`;
}

function normalizePositiveInteger(value, field, errors) {
  const numeric = Number(value);
  if (!Number.isInteger(numeric) || numeric <= 0) {
    errors.push(issue(field, 'INVALID_INSTALLMENT_COUNT', 'Quantidade de parcelas deve ser inteiro positivo.'));
    return 0;
  }
  return numeric;
}

function resolveSeriesId(input = {}, idFactory = null) {
  if (input.parentId) return String(input.parentId);
  if (input.seriesId) return String(input.seriesId);
  const generated = typeof idFactory === 'function' ? idFactory() : '';
  return String(generated || `p_${Date.now()}`);
}

function sourceMetadata(input = {}) {
  return Object.fromEntries([
    'source_channel',
    'source_reference_id',
    'created_by_type',
    'created_by_id',
    'idempotency_key',
    'correlation_id',
    'received_at',
    'processed_at'
  ].filter((field) => input[field] !== undefined).map((field) => [field, input[field]]));
}

function nowIso(now = new Date()) {
  return now instanceof Date ? now.toISOString() : new Date(now).toISOString();
}

function buildSeriesSaidaPayload(input = {}) {
  return {
    type: 'saida',
    person: input.person || '',
    macro_category: input.macro || input.macro_category || '',
    macro_id: input.macro_id || '',
    category_id: input.category_id || '',
    category_name: input.category_name || '',
    category_color: input.category_color || '',
    category_icon: input.category_icon || '',
    category_snapshot: input.category_snapshot || undefined,
    subcategory: input.subcategory || input.category || '',
    description: input.description || '',
    amount: input.amount ?? 0,
    status: input.status || 'Em aberto',
    payment_method: input.paymentMethod || input.payment_method || '',
    occurred_date: input.occurredDate || input.occurred_date || '',
    due_date: input.dueDate || input.due_date || '',
    competence: input.competence || '',
    paid_at: input.status === 'Pago' ? input.paidAt || input.paid_at || '' : '',
    installment_no: input.installmentNo || 0,
    total_installments: input.totalInstallments || 0,
    parent_id: input.parentId || '',
    is_installment: true,
    purchase_name: input.purchaseName || input.purchase_name || input.description || '',
    card: input.card || '',
    earning_type: '',
    cycle: input.cycle || '',
    recurrence: '',
    created_at: nowIso(input.now),
    archived: false
  };
}

export function createInstallmentSeries(input = {}, options = {}) {
  const errors = [];
  const warnings = [];
  const totalInstallments = normalizePositiveInteger(input.totalInstallments ?? input.installments, 'totalInstallments', errors);
  const firstDueDate = input.firstDueDate || input.baseDueDate || input.dueDate || '';
  let totalCents = 0;

  try {
    totalCents = moneyToCents(input.totalAmount ?? input.amount ?? 0);
    if (totalCents < 0) errors.push(issue('totalAmount', 'NEGATIVE_TOTAL', 'Total nao pode ser negativo.'));
  } catch (error) {
    errors.push(issue('totalAmount', 'INVALID_MONEY', error.message));
  }

  if (!parseIsoDate(firstDueDate)) {
    errors.push(issue('firstDueDate', 'INVALID_DUE_DATE', 'Primeiro vencimento deve estar em YYYY-MM-DD.'));
  }

  if (errors.length) {
    return {
      isValid: false,
      seriesId: '',
      totalCents,
      totalInstallments,
      installments: [],
      errors,
      warnings
    };
  }

  const split = splitAmountIntoInstallments(totalCents, totalInstallments, {
    residueTarget: options.residueTarget || input.residueTarget || 'last'
  });
  const splitValidation = validateInstallmentSplit(split, totalCents);
  if (!splitValidation.isValid) {
    errors.push(issue('installments', 'INVALID_SPLIT', 'Soma das parcelas nao reconcilia com o total.'));
  }

  const seriesId = resolveSeriesId(input, options.idFactory);
  const now = options.now || input.now || new Date();
  const initialStatus = input.initialStatus || input.status || 'Em aberto';
  const paidAt = input.paidAt || input.paid_at || '';
  const metadata = sourceMetadata(input);
  const installments = split.installments.map((amountCents, index) => {
    const dueDate = addMonthsClamped(firstDueDate, index);
    const isFirst = index === 0;
    const status = isFirst ? initialStatus : 'Em aberto';
    return {
      ...buildSeriesSaidaPayload({
        ...input,
        amount: centsToMoney(amountCents),
        status,
        paidAt: isFirst && status === 'Pago' ? paidAt : '',
        dueDate,
        competence: dueDate.slice(0, 7),
        occurredDate: input.occurredDate || input.occurred_date || '',
        paymentMethod: input.paymentMethod || input.payment_method || '',
        installmentNo: index + 1,
        totalInstallments,
        parentId: seriesId,
        isInstallment: true,
        purchaseName: input.purchaseName || input.description || '',
        recurrence: '',
        description: `${input.description || ''} (${index + 1}/${totalInstallments})`,
        now
      }),
      schema_version: FINANCE_RECORD_SCHEMA_VERSION,
      source_mode: input.source_mode || 'installment',
      ...metadata
    };
  });

  return {
    isValid: errors.length === 0,
    seriesId,
    totalCents,
    totalInstallments,
    installments,
    errors,
    warnings,
    split
  };
}

function centsFromRecordAmount(record = {}) {
  try {
    return moneyToCents(record.amount ?? 0);
  } catch {
    return Number.NaN;
  }
}

export function analyzeInstallmentSeries(records = [], options = {}) {
  const source = Array.isArray(records) ? records : [];
  const installments = source.filter((record) => record?.type === 'saida' && (
    record.is_installment === true ||
    Number(record.installment_no || 0) > 0 ||
    Number(record.total_installments || 0) > 1 ||
    record.parent_id
  ));
  const groups = new Map();
  installments.forEach((record, index) => {
    const parentId = String(record.parent_id || '').trim() || `__missing_parent__${index}`;
    if (!groups.has(parentId)) groups.set(parentId, []);
    groups.get(parentId).push(record);
  });

  const series = [...groups.entries()].map(([parentId, group]) => {
    const numbers = group.map((record) => Number(record.installment_no || 0));
    const totals = group.map((record) => Number(record.total_installments || 0));
    const expectedTotalInstallments = Math.max(...totals, group.length);
    const duplicateNumbers = numbers.filter((number, index) => number > 0 && numbers.indexOf(number) !== index);
    const missingInstallmentNumbers = [];
    for (let number = 1; number <= expectedTotalInstallments; number += 1) {
      if (!numbers.includes(number)) missingInstallmentNumbers.push(number);
    }
    const invalidAmounts = group.filter((record) => !Number.isInteger(centsFromRecordAmount(record))).map((record) => record.id || '');
    const sumCents = group.reduce((sum, record) => {
      const cents = centsFromRecordAmount(record);
      return Number.isInteger(cents) ? sum + cents : sum;
    }, 0);
    const expectedTotalCents = options.expectedTotalsByParentId?.[parentId] ?? null;
    const differenceCents = Number.isInteger(expectedTotalCents) ? sumCents - expectedTotalCents : null;
    const inconsistentTotals = [...new Set(totals)].filter((value) => value !== expectedTotalInstallments);
    const invalidParentIds = group.filter((record) => !record.parent_id).map((record) => record.id || '');
    const invalidInstallmentNumbers = group
      .filter((record) => !Number.isInteger(Number(record.installment_no)) || Number(record.installment_no) <= 0)
      .map((record) => record.id || '');

    const status = duplicateNumbers.length || missingInstallmentNumbers.length || invalidParentIds.length ||
      inconsistentTotals.length || invalidAmounts.length || invalidInstallmentNumbers.length ||
      (differenceCents !== null && differenceCents !== 0)
      ? 'needs_review'
      : 'ok';

    return {
      parent_id: parentId.startsWith('__missing_parent__') ? '' : parentId,
      foundCount: group.length,
      totalOriginalKnown: Number.isInteger(expectedTotalCents),
      sumCents,
      expectedTotalCents,
      differenceCents,
      duplicates: [...new Set(duplicateNumbers)],
      missingInstallmentNumbers,
      invalidParentIds,
      inconsistentTotals,
      invalidInstallmentNumbers,
      invalidAmounts,
      dateIssues: [],
      suggestion: status === 'ok' ? 'Nenhuma correcao sugerida.' : 'Auditar manualmente antes de qualquer correcao.',
      risk: status === 'ok' ? 'baixo' : 'medio',
      status
    };
  });

  return {
    totalSeries: series.length,
    totalRecords: installments.length,
    series,
    wrote: false
  };
}

export function buildInstallmentReconciliationDryRun(records = [], options = {}) {
  return analyzeInstallmentSeries(records, options);
}
