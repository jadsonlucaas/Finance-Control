import { centsToMoney, moneyToCents } from '../core/money.js';
import { FINANCE_RECORD_SCHEMA_VERSION } from './records/index.js';
import { addMonthsClamped } from './installmentSeries.js';

export const RECURRENCE_LIMITS = Object.freeze({
  monthly: 120,
  yearly: 30
});

export const RECURRENCE_SCOPE_OPTIONS = Object.freeze([
  { value: 'only_this', label: 'Somente esta', enabled: true, reason: '' },
  {
    value: 'this_and_next',
    label: 'Esta e proximas',
    enabled: false,
    reason: 'Bloqueado ate existir mutacao atomica com busca completa da serie.'
  },
  {
    value: 'whole_series',
    label: 'Toda a serie',
    enabled: false,
    reason: 'Bloqueado ate existir mutacao atomica com busca completa da serie.'
  }
]);

const LEGACY_RECURRENCE_BY_FREQUENCY = Object.freeze({
  monthly: 'mensal',
  yearly: 'anual'
});

function issue(field, code, message, severity = 'error') {
  return { field, code, message, severity };
}

function nowIso(now = new Date()) {
  return now instanceof Date ? now.toISOString() : new Date(now).toISOString();
}

function isIsoDate(value = '') {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return false;
  const [year, month, day] = String(value).split('-').map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return Boolean(year && month >= 1 && month <= 12 && day >= 1 && day <= lastDay);
}

function normalizePositiveInteger(value) {
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric > 0 ? numeric : 0;
}

export function normalizeRecurrenceFrequency(value = '') {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'mensal' || normalized === 'monthly') return 'monthly';
  if (normalized === 'anual' || normalized === 'yearly') return 'yearly';
  return '';
}

function normalizeTermination(input = {}, errors = []) {
  const count = normalizePositiveInteger(input.recurrence_count ?? input.recurrenceCount ?? input.count);
  const endDate = String(input.recurrence_end_date ?? input.recurrenceEndDate ?? '').trim();
  const hasCount = count > 0;
  const hasEndDate = endDate.length > 0;

  if (hasCount && hasEndDate) {
    errors.push(issue('termination', 'RECURRENCE_TERMINATION_EXCLUSIVE', 'Informe quantidade ou data final, nao ambos.'));
  }
  if (!hasCount && !hasEndDate) {
    errors.push(issue('termination', 'RECURRENCE_TERMINATION_REQUIRED', 'Informe quantidade ou data final da recorrencia.'));
  }
  if (hasEndDate && !isIsoDate(endDate)) {
    errors.push(issue('recurrence_end_date', 'INVALID_RECURRENCE_END_DATE', 'Data final deve estar em YYYY-MM-DD.'));
  }

  return { count, endDate, hasCount, hasEndDate };
}

function addByFrequency(dateValue = '', frequency = 'monthly', index = 0) {
  const months = frequency === 'yearly' ? index * 12 : index;
  return addMonthsClamped(dateValue, months);
}

function resolveSeriesId(input = {}, idFactory = null) {
  if (input.recurrence_series_id) return String(input.recurrence_series_id);
  if (input.seriesId) return String(input.seriesId);
  const generated = typeof idFactory === 'function' ? idFactory() : '';
  return String(generated || `r_${Date.now()}`);
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

function buildRecurringSaida(input = {}) {
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
    installment_no: 0,
    total_installments: 0,
    parent_id: '',
    is_installment: false,
    purchase_name: input.purchaseName || input.purchase_name || input.description || '',
    card: input.card || '',
    earning_type: '',
    cycle: input.cycle || '',
    recurrence: input.recurrence || '',
    created_at: nowIso(input.now),
    archived: false
  };
}

export function buildRecurrenceDates(input = {}) {
  const errors = [];
  const frequency = normalizeRecurrenceFrequency(input.frequency || input.recurrence_frequency || input.recurrence);
  const firstDate = String(input.firstDate || input.firstDueDate || input.baseDueDate || input.dueDate || '').trim();
  const termination = normalizeTermination(input, errors);

  if (!frequency) {
    errors.push(issue('frequency', 'INVALID_RECURRENCE_FREQUENCY', 'Frequencia deve ser monthly ou yearly.'));
  }
  if (!isIsoDate(firstDate)) {
    errors.push(issue('firstDate', 'INVALID_RECURRENCE_FIRST_DATE', 'Primeira data deve estar em YYYY-MM-DD.'));
  }

  if (errors.length) return { isValid: false, frequency, firstDate, dates: [], errors };

  const limit = RECURRENCE_LIMITS[frequency];
  const dates = [];
  const targetCount = termination.hasCount ? termination.count : limit + 1;
  for (let index = 0; index < targetCount; index += 1) {
    const dueDate = addByFrequency(firstDate, frequency, index);
    if (termination.hasEndDate && dueDate > termination.endDate) break;
    dates.push(dueDate);
    if (dates.length > limit) break;
  }

  if (!dates.length) {
    errors.push(issue('recurrence_end_date', 'RECURRENCE_EMPTY_SERIES', 'Data final nao inclui nenhuma ocorrencia.'));
  }
  if (dates.length > limit || (termination.hasCount && termination.count > limit)) {
    errors.push(issue('recurrence_count', 'RECURRENCE_LIMIT_EXCEEDED', `Limite de recorrencia ${frequency} excedido.`));
  }

  return {
    isValid: errors.length === 0,
    frequency,
    firstDate,
    termination,
    dates: errors.length ? [] : dates,
    errors
  };
}

export function createRecurrenceSeries(input = {}, options = {}) {
  const errors = [];
  const warnings = [];
  const frequency = normalizeRecurrenceFrequency(input.frequency || input.recurrence_frequency || input.recurrence);
  let amountCents = 0;

  try {
    amountCents = moneyToCents(input.amount ?? 0);
    if (amountCents < 0) errors.push(issue('amount', 'NEGATIVE_AMOUNT', 'Valor nao pode ser negativo.'));
  } catch (error) {
    errors.push(issue('amount', 'INVALID_MONEY', error.message));
  }

  const datesResult = buildRecurrenceDates({
    ...input,
    frequency,
    firstDate: input.firstDate || input.firstDueDate || input.baseDueDate || input.dueDate
  });
  errors.push(...datesResult.errors);

  if (errors.length) {
    return {
      isValid: false,
      seriesId: '',
      frequency,
      totalOccurrences: 0,
      projectedTotalCents: 0,
      firstDate: '',
      lastDate: '',
      occurrences: [],
      preview: null,
      errors,
      warnings
    };
  }

  const seriesId = resolveSeriesId(input, options.idFactory);
  const now = options.now || input.now || new Date();
  const recurrence = LEGACY_RECURRENCE_BY_FREQUENCY[frequency];
  const metadata = sourceMetadata(input);
  const totalOccurrences = datesResult.dates.length;
  const projectedTotalCents = amountCents * totalOccurrences;
  const termination = datesResult.termination;

  const occurrences = datesResult.dates.map((dueDate, index) => {
    const isFirst = index === 0;
    const status = isFirst ? input.status || input.initialStatus || 'Em aberto' : 'Em aberto';
    return {
      ...buildRecurringSaida({
        ...input,
        amount: centsToMoney(amountCents),
        status,
        paidAt: isFirst && status === 'Pago' ? input.paidAt || input.paid_at || '' : '',
        dueDate,
        competence: dueDate.slice(0, 7),
        occurredDate: input.occurredDate || input.occurred_date || '',
        recurrence,
        now
      }),
      schema_version: FINANCE_RECORD_SCHEMA_VERSION,
      source_mode: input.source_mode || 'recurring',
      recurrence_frequency: frequency,
      recurrence_count: termination.hasCount ? totalOccurrences : 0,
      recurrence_end_date: termination.hasEndDate ? termination.endDate : '',
      recurrence_series_id: seriesId,
      recurrence_sequence_no: index + 1,
      recurrence_total_occurrences: totalOccurrences,
      ...metadata
    };
  });

  const preview = {
    frequency,
    recurrence,
    quantity: totalOccurrences,
    firstDate: datesResult.dates[0],
    lastDate: datesResult.dates[datesResult.dates.length - 1],
    projectedTotalCents,
    projectedTotal: centsToMoney(projectedTotalCents)
  };

  return {
    isValid: true,
    seriesId,
    frequency,
    totalOccurrences,
    projectedTotalCents,
    firstDate: preview.firstDate,
    lastDate: preview.lastDate,
    occurrences,
    preview,
    errors,
    warnings
  };
}

export const CreateRecurrenceSeries = createRecurrenceSeries;

function validDateOrEmpty(value = '') {
  return !value || isIsoDate(value);
}

function isRecurringRecord(record = {}) {
  return record?.type === 'saida' && (
    record.recurrence_series_id ||
    record.recurrence ||
    record.recurrence_frequency
  );
}

export function analyzeRecurrenceSeries(records = []) {
  const source = Array.isArray(records) ? records : [];
  const recurring = source.filter(isRecurringRecord);
  const groups = new Map();
  recurring.forEach((record, index) => {
    const key = String(record.recurrence_series_id || record.parent_id || `__legacy_recurrence__${index}`).trim();
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(record);
  });

  const series = [...groups.entries()].map(([seriesId, group]) => {
    const sorted = [...group].sort((a, b) => String(a.due_date || '').localeCompare(String(b.due_date || '')));
    const frequency = normalizeRecurrenceFrequency(sorted[0]?.recurrence_frequency || sorted[0]?.recurrence);
    const sequenceNumbers = sorted.map((record) => Number(record.recurrence_sequence_no || 0)).filter(Boolean);
    const dueDates = sorted.map((record) => String(record.due_date || ''));
    const duplicateDates = dueDates.filter((date, index) => date && dueDates.indexOf(date) !== index);
    const invalidDates = sorted.filter((record) => !validDateOrEmpty(record.due_date)).map((record) => record.id || '');
    const duplicates = [...new Set(duplicateDates)];
    const missingSequenceNumbers = [];
    const expectedTotal = Math.max(Number(sorted[0]?.recurrence_total_occurrences || 0), sequenceNumbers.length, group.length);
    for (let number = 1; number <= expectedTotal; number += 1) {
      if (sequenceNumbers.length && !sequenceNumbers.includes(number)) missingSequenceNumbers.push(number);
    }
    const conflictsWithInstallment = sorted
      .filter((record) => record.parent_id || Number(record.installment_no || 0) > 0 || Number(record.total_installments || 0) > 1 || record.is_installment === true)
      .map((record) => record.id || '');
    const annualTwelveOccurrences = frequency === 'yearly' && group.length === 12;
    const status = duplicates.length || invalidDates.length || missingSequenceNumbers.length ||
      conflictsWithInstallment.length || annualTwelveOccurrences
      ? 'needs_review'
      : 'ok';

    return {
      recurrence_series_id: seriesId.startsWith('__legacy_recurrence__') ? '' : seriesId,
      foundCount: group.length,
      frequency,
      firstDate: dueDates[0] || '',
      lastDate: dueDates[dueDates.length - 1] || '',
      annualTwelveOccurrences,
      duplicates,
      missingSequenceNumbers,
      invalidDates,
      conflictsWithInstallment,
      suggestion: status === 'ok' ? 'Nenhuma correcao sugerida.' : 'Auditar manualmente antes de qualquer correcao.',
      risk: status === 'ok' ? 'baixo' : 'alto',
      status
    };
  });

  return {
    totalSeries: series.length,
    totalRecords: recurring.length,
    series,
    wrote: false
  };
}

export function buildRecurrenceDryRun(records = []) {
  return analyzeRecurrenceSeries(records);
}

export function getRecurrenceMutationScopeOptions() {
  return RECURRENCE_SCOPE_OPTIONS.map((option) => ({ ...option }));
}
