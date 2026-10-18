import { normalizeCompetenceKey } from '../../core/dates.js';
import { roundCurrency } from '../../core/money.js';
import { applyPlannerFilters } from '../selectors/plannerFilters.js';

function array(value = []) {
  return Array.isArray(value) ? value : [];
}

function text(value = '') {
  return String(value || '').trim();
}

function number(value = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function dateFromRecord(record = {}) {
  return text(record.due_date || record.date || record.occurred_date || record.paid_at || '');
}

function competenceFromDate(date = '') {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date.slice(0, 7) : normalizeCompetenceKey(date) || '';
}

function isPaid(record = {}) {
  return text(record.status).toLowerCase() === 'pago' || Boolean(record.paid_at);
}

function amountFromRecord(record = {}) {
  return roundCurrency(number(record.amount ?? record.valor ?? record.financial_total ?? record.valorTotalCalculado));
}

function macroFromRecord(record = {}) {
  return text(record.macro || record.macro_category);
}

function categoryFromRecord(record = {}) {
  return text(record.category || record.category_name || record.subcategory);
}

function titleFromRecord(record = {}) {
  return text(record.description || record.descricao || record.title || record.nome || record.person || record.type || 'Registro');
}

function statusFromRecord(record = {}) {
  return text(record.status || (record.type === 'saida' ? 'Em aberto' : ''));
}

function classifyFinancialRecord(record = {}) {
  if (record.type === 'saida') return 'expense';
  if (record.type === 'entrada') return 'income';
  return '';
}

function normalizeFinancialRecord(record = {}) {
  const date = dateFromRecord(record);
  const kind = classifyFinancialRecord(record);
  if (!record.id || !date || !kind) return null;

  const installmentSeriesId = text(record.installment_series_id || record.parent_id);
  const recurrenceSeriesId = text(record.recurrence_series_id);
  const type = record.type;
  return {
    id: String(record.id),
    eventId: `${type}:${record.id}`,
    source: 'finance_record',
    sourceRecord: record,
    sourceRecordId: String(record.id),
    type,
    kind,
    date,
    competence: text(record.competence || record.competencia) || competenceFromDate(date),
    title: titleFromRecord(record),
    description: titleFromRecord(record),
    amount: amountFromRecord(record),
    status: statusFromRecord(record),
    person: text(record.person || record.pessoa),
    macro: macroFromRecord(record),
    category: categoryFromRecord(record),
    archived: record.archived === true,
    paid: isPaid(record),
    installment: Boolean(installmentSeriesId),
    installmentSeriesId,
    installmentNumber: number(record.installment_no || record.installment_number || record.parcela_atual),
    totalInstallments: number(record.total_installments || record.installments || record.parcelas),
    recurrence: Boolean(recurrenceSeriesId || record.recurrence),
    recurrenceSeriesId,
    recurrenceSequenceNo: number(record.recurrence_sequence_no),
    actions: {
      canMarkPaid: type === 'saida' && !isPaid(record) && record.archived !== true,
      canArchive: type === 'saida' && record.archived !== true,
      canDelete: type === 'saida'
    }
  };
}

function normalizeLocalPlannerEvent(event = {}) {
  const date = text(event.date);
  if (!event.id || !date) return null;
  const type = text(event.type || 'commitment');
  return {
    id: String(event.id),
    eventId: `planner:${event.id}`,
    source: 'planner_local',
    sourceRecord: event,
    sourceRecordId: String(event.id),
    type: 'planner',
    kind: type === 'holiday' ? 'holiday' : 'commitment',
    plannerType: type,
    date,
    competence: competenceFromDate(date),
    title: text(event.title || (type === 'holiday' ? 'Feriado' : 'Compromisso')),
    description: text(event.note || event.title || ''),
    note: text(event.note || ''),
    amount: 0,
    status: '',
    person: text(event.person),
    macro: '',
    category: '',
    archived: event.archived === true,
    paid: false,
    installment: false,
    recurrence: false,
    derived: event.derived === true,
    actions: {
      canDelete: event.derived !== true
    }
  };
}

function normalizeHourRecord(record = {}) {
  const date = text(record.occurred_date || record.date);
  if (!date || record.archived === true) return null;
  const total = amountFromRecord(record);
  const kind = text(record.hour_control_type || record.tipo) === 'Banco de Horas' ? 'bank_hours' : 'hour_extra';
  const id = String(record.id || `${record.person || 'sem-pessoa'}-${date}`);
  return {
    id,
    eventId: `hour:${id}`,
    source: 'hour_record',
    sourceRecord: record,
    sourceRecordId: record.id ? String(record.id) : '',
    type: 'controle_horas',
    kind,
    date,
    competence: text(record.competence || record.competencia) || competenceFromDate(date),
    title: kind === 'bank_hours' ? 'Banco de horas' : 'Hora extra',
    description: text(record.notes || record.observacao || ''),
    amount: total,
    status: statusFromRecord(record),
    person: text(record.person || record.pessoa),
    macro: '',
    category: '',
    archived: false,
    paid: Boolean(record.paid_at),
    installment: false,
    recurrence: false,
    derived: true,
    actions: {}
  };
}

function compareEvents(a = {}, b = {}) {
  const dateCompare = String(a.date || '').localeCompare(String(b.date || ''));
  if (dateCompare) return dateCompare;
  const sourceCompare = String(a.source || '').localeCompare(String(b.source || ''));
  if (sourceCompare) return sourceCompare;
  return String(a.title || '').localeCompare(String(b.title || ''));
}

function groupBy(items = [], keyGetter = () => '') {
  return items.reduce((acc, item) => {
    const key = keyGetter(item);
    if (!key) return acc;
    acc[key] = acc[key] || [];
    acc[key].push(item);
    return acc;
  }, {});
}

function weekKey(date = '') {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return '';
  const value = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(value.getTime())) return '';
  const day = value.getUTCDay() || 7;
  value.setUTCDate(value.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(value.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((value - yearStart) / 86400000) + 1) / 7);
  return `${value.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

function buildSummary(events = []) {
  return events.reduce((summary, event) => {
    summary.count += 1;
    if (event.source === 'planner_local') summary.localEvents += 1;
    if (event.source === 'hour_record') summary.hourEvents += 1;
    if (event.installment) summary.installments += 1;
    if (event.recurrence) summary.recurrences += 1;
    if (event.archived) summary.archived += 1;
    if (event.paid) summary.paid += 1;
    if (event.kind === 'income') summary.income = roundCurrency(summary.income + event.amount);
    if (event.kind === 'expense') {
      summary.expense = roundCurrency(summary.expense + event.amount);
      if (!event.paid) summary.pendingExpense = roundCurrency(summary.pendingExpense + event.amount);
    }
    summary.balance = roundCurrency(summary.income - summary.expense);
    return summary;
  }, {
    count: 0,
    income: 0,
    expense: 0,
    balance: 0,
    pendingExpense: 0,
    paid: 0,
    archived: 0,
    installments: 0,
    recurrences: 0,
    localEvents: 0,
    hourEvents: 0
  });
}

function getUnique(events = [], field = '') {
  return [...new Set(events.map((event) => text(event[field])).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

export function buildPlannerReadModel(input = {}) {
  const filters = {
    month: normalizeCompetenceKey(input.filters?.month || input.filters?.competence || '') || '',
    start: normalizeCompetenceKey(input.filters?.start || input.filters?.competenceStart || input.filters?.month || input.filters?.competence || '') || '',
    end: normalizeCompetenceKey(input.filters?.end || input.filters?.competenceEnd || input.filters?.month || input.filters?.competence || '') || '',
    person: input.filters?.person || '',
    type: input.filters?.type || '',
    status: input.filters?.status || '',
    macro: input.filters?.macro || '',
    category: input.filters?.category || '',
    archiveMode: input.filters?.archiveMode || 'active'
  };

  const financialEvents = array(input.records)
    .map(normalizeFinancialRecord)
    .filter(Boolean);
  const localEvents = array(input.plannerEvents)
    .map(normalizeLocalPlannerEvent)
    .filter(Boolean);
  const hourEvents = array(input.records)
    .filter((record) => record?.type === 'controle_horas')
    .map(normalizeHourRecord)
    .filter(Boolean);
  const sourceEvents = [...financialEvents, ...localEvents, ...hourEvents].sort(compareEvents);
  const visibleEvents = applyPlannerFilters(sourceEvents, filters).sort(compareEvents);

  return {
    events: visibleEvents,
    allEvents: sourceEvents,
    byDay: groupBy(visibleEvents, (event) => event.date),
    byWeek: groupBy(visibleEvents, (event) => weekKey(event.date)),
    byMonth: groupBy(visibleEvents, (event) => event.competence),
    summary: buildSummary(visibleEvents),
    options: {
      people: getUnique(sourceEvents, 'person'),
      types: getUnique(sourceEvents, 'type'),
      statuses: getUnique(sourceEvents, 'status'),
      macros: getUnique(sourceEvents, 'macro'),
      categories: getUnique(sourceEvents, 'category')
    },
    getById: (id = '') => sourceEvents.find((event) => event.eventId === id || event.id === id || event.sourceRecordId === id) || null,
    metadata: {
      filters,
      sourceRecordCount: array(input.records).length,
      plannerEventCount: array(input.plannerEvents).length,
      visibleEventCount: visibleEvents.length,
      stale: input.metadata?.stale === true,
      offline: input.metadata?.offline === true
    },
    warnings: []
  };
}
