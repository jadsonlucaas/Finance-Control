import { normalizeCompetenceKey } from '../../core/dates.js';
import { roundCurrency } from '../../core/money.js';
import { buildHourPeriodSummary } from '../../domain/hourPeriodSummary.js';
import { createSuccessResult } from './applicationResult.js';

export const QUERY_CONTRACTS = Object.freeze({
  GetMonthlySummaryQuery: { schemaVersion: 1, payload: ['competence optional', 'person optional'] },
  GetOpenExpensesQuery: { schemaVersion: 1, payload: ['competence optional', 'person optional'] },
  GetExpenseByIdQuery: { schemaVersion: 1, payload: ['id'] },
  GetIncomeByIdQuery: { schemaVersion: 1, payload: ['id'] },
  GetInstallmentSeriesQuery: { schemaVersion: 1, payload: ['parentId or seriesId'] },
  GetRecurrenceSeriesQuery: { schemaVersion: 1, payload: ['seriesId'] },
  GetHourSummaryQuery: { schemaVersion: 1, payload: ['start', 'end', 'person optional'] },
  GetEffectiveCategoriesQuery: { schemaVersion: 1, payload: ['ownerUid optional'] },
  GetEffectiveMacrosQuery: { schemaVersion: 1, payload: ['ownerUid optional'] }
});

async function listRecords(repository, context = {}) {
  if (typeof repository?.list === 'function') {
    const result = await repository.list({}, context);
    if (Array.isArray(result)) return result;
    if (result?.ok) return result.items || result.data || [];
    return [];
  }
  return globalThis.allRecords || [];
}

function getFinanceRecordsRepository(repository, repositories = {}) {
  return repositories.financeRecords || repository;
}

function ownOrGlobal(record = {}, authContext = {}) {
  return record.shared_scope === 'global' || !record.owner_uid || record.owner_uid === authContext.ownerUid || record.owner_uid === authContext.actorUid;
}

function matchesFilters(record = {}, payload = {}) {
  const competence = normalizeCompetenceKey(payload.competence || payload.competencia || '');
  if (competence && normalizeCompetenceKey(record.competence || record.due_date || record.occurred_date || '') !== competence) return false;
  if (payload.person && record.person !== payload.person) return false;
  return true;
}

export async function handleGetMonthlySummary({ payload, repository, repositories = {}, authContext }) {
  const financeRecords = getFinanceRecordsRepository(repository, repositories);
  const source = await financeRecords.list({}, authContext);
  const records = ((Array.isArray(source) ? source : source?.items || source?.data || [])).filter((record) => matchesFilters(record, payload));
  const expenses = records.filter((record) => record.type === 'saida');
  const incomes = records.filter((record) => record.type === 'entrada');
  const hourRecords = records.filter((record) => record.type === 'controle_horas');
  const expenseTotal = roundCurrency(expenses.reduce((sum, record) => sum + (Number(record.amount) || 0), 0));
  const incomeTotal = roundCurrency(incomes.reduce((sum, record) => sum + (Number(record.amount) || 0), 0));
  const hourTotal = roundCurrency(hourRecords.reduce((sum, record) => sum + (Number(record.financial_total ?? record.valorTotalCalculado ?? record.amount) || 0), 0));
  return createSuccessResult({
    message: 'Resumo mensal consultado.',
    data: {
      competence: normalizeCompetenceKey(payload.competence || payload.competencia || ''),
      expenseTotal,
      incomeTotal,
      hourTotal,
      balance: roundCurrency(incomeTotal + hourTotal - expenseTotal),
      recordsCount: records.length
    }
  });
}

export async function handleGetOpenExpenses({ payload, repository, repositories = {}, authContext }) {
  const financeRecords = getFinanceRecordsRepository(repository, repositories);
  const source = await financeRecords.findByType?.('saida', {}, authContext) || await financeRecords.list({}, authContext);
  const records = (Array.isArray(source) ? source : source?.items || source?.data || [])
    .filter((record) => record.type === 'saida')
    .filter((record) => record.status !== 'Pago')
    .filter((record) => matchesFilters(record, payload));
  return createSuccessResult({ message: 'Saidas abertas consultadas.', data: records });
}

export async function handleGetExpenseById({ payload, repository, repositories = {}, authContext }) {
  const financeRecords = getFinanceRecordsRepository(repository, repositories);
  const result = await financeRecords.getById?.(payload.id, authContext);
  const record = result?.ok ? result.data : (await listRecords(financeRecords)).find((item) => item.id === payload.id && item.type === 'saida') || null;
  return createSuccessResult({ message: 'Saida consultada.', entityId: record?.id || '', data: record });
}

export async function handleGetIncomeById({ payload, repository, repositories = {}, authContext }) {
  const financeRecords = getFinanceRecordsRepository(repository, repositories);
  const result = await financeRecords.getById?.(payload.id, authContext);
  const record = result?.ok ? result.data : (await listRecords(financeRecords)).find((item) => item.id === payload.id && item.type === 'entrada') || null;
  return createSuccessResult({ message: 'Entrada consultada.', entityId: record?.id || '', data: record });
}

export async function handleGetInstallmentSeries({ payload, repository, repositories = {}, authContext }) {
  const financeRecords = getFinanceRecordsRepository(repository, repositories);
  const key = payload.parentId || payload.seriesId || payload.parent_id || '';
  const source = await financeRecords.findBySeriesId?.(key, authContext) || await financeRecords.list({}, authContext);
  const records = (Array.isArray(source) ? source : source?.items || source?.data || [])
    .filter((record) => record.type === 'saida')
    .filter((record) => record.parent_id === key || record.installment_series_id === key);
  return createSuccessResult({ message: 'Parcelamento consultado.', entityIds: records.map((record) => record.id), data: records });
}

export async function handleGetRecurrenceSeries({ payload, repository, repositories = {}, authContext }) {
  const financeRecords = getFinanceRecordsRepository(repository, repositories);
  const key = payload.seriesId || payload.recurrence_series_id || '';
  const source = await financeRecords.findBySeriesId?.(key, authContext) || await financeRecords.list({}, authContext);
  const records = (Array.isArray(source) ? source : source?.items || source?.data || [])
    .filter((record) => record.type === 'saida')
    .filter((record) => record.recurrence_series_id === key || record.parent_id === key);
  return createSuccessResult({ message: 'Recorrencia consultada.', entityIds: records.map((record) => record.id), data: records });
}

export async function handleGetHourSummary({ payload, repository, repositories = {}, authContext }) {
  const financeRecords = getFinanceRecordsRepository(repository, repositories);
  return createSuccessResult({
    message: 'Resumo de horas consultado.',
    data: buildHourPeriodSummary(await listRecords(financeRecords, authContext), payload)
  });
}

export async function handleGetEffectiveCategories({ repository, repositories = {}, authContext }) {
  const financeRecords = getFinanceRecordsRepository(repository, repositories);
  const records = (await listRecords(financeRecords, authContext))
    .filter((record) => record.type === 'categoria')
    .filter((record) => ownOrGlobal(record, authContext));
  return createSuccessResult({ message: 'Categorias efetivas consultadas.', data: records });
}

export async function handleGetEffectiveMacros({ repository, repositories = {}, authContext }) {
  const financeRecords = getFinanceRecordsRepository(repository, repositories);
  const records = (await listRecords(financeRecords, authContext))
    .filter((record) => record.type === 'macro')
    .filter((record) => ownOrGlobal(record, authContext));
  return createSuccessResult({ message: 'Macros efetivas consultadas.', data: records });
}

export function createFinanceQueryHandlers() {
  return {
    GetMonthlySummaryQuery: handleGetMonthlySummary,
    GetOpenExpensesQuery: handleGetOpenExpenses,
    GetExpenseByIdQuery: handleGetExpenseById,
    GetIncomeByIdQuery: handleGetIncomeById,
    GetInstallmentSeriesQuery: handleGetInstallmentSeries,
    GetRecurrenceSeriesQuery: handleGetRecurrenceSeries,
    GetHourSummaryQuery: handleGetHourSummary,
    GetEffectiveCategoriesQuery: handleGetEffectiveCategories,
    GetEffectiveMacrosQuery: handleGetEffectiveMacros
  };
}
