import { roundCurrency } from '../../core/money.js';
import { normalizeCompetenceKey } from '../../core/dates.js';
import { buildDashboardExpenseAggregations } from '../../domain/dashboard.js';
import {
  selectDashboardTotals,
  selectPersonBalances
} from '../selectors/financialSelectors.js';
import {
  applyDashboardFilters,
  getRecordCompetence,
  sortRecordsNewestFirst
} from '../selectors/dashboardFilters.js';
import {
  buildCategoryChartData,
  buildDashboardDailyExpenseTrendData,
  buildDashboardMonthlyFinancialTrendData,
  buildStatusChartData
} from './dashboardChartData.js';

function getMonthKeys(start = '', end = '') {
  const normalizedStart = normalizeCompetenceKey(start || '') || '';
  const normalizedEnd = normalizeCompetenceKey(end || normalizedStart) || normalizedStart;
  if (!normalizedStart) return [];

  const [startYear, startMonth] = normalizedStart.split('-').map(Number);
  const [endYear, endMonth] = normalizedEnd.split('-').map(Number);
  if (!startYear || !startMonth || !endYear || !endMonth) return [normalizedStart];

  const months = [];
  const cursor = new Date(startYear, startMonth - 1, 1);
  const limit = new Date(endYear, endMonth - 1, 1);
  while (cursor <= limit && months.length < 120) {
    months.push(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`);
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return months;
}

function getPeople(records = [], referenceData = {}) {
  const fromReference = Array.isArray(referenceData.people) ? referenceData.people : [];
  const source = fromReference.length ? fromReference : records.filter((record) => record?.type === 'pessoa');
  return source
    .map((record) => ({ ...record, person: record?.person || record?.name || '' }))
    .filter((record) => record.person);
}

function buildEntryKeys(records = [], filters = {}, referenceData = {}, options = {}) {
  const months = getMonthKeys(filters.start, filters.end);
  const personFilter = filters.person || '';
  const keys = new Set();
  const people = getPeople(records, referenceData);

  people.forEach((personRecord) => {
    const personName = personRecord.person || '';
    if (!personName || (personFilter && personName !== personFilter)) return;
    months.forEach((competence) => {
      const salaryInfo = typeof options.getSalaryInfo === 'function' ? options.getSalaryInfo(personName, competence) : null;
      const salary = Number(salaryInfo?.salario ?? salaryInfo?.salary_base ?? salaryInfo?.amount ?? personRecord.salary_base ?? 0);
      if (salary > 0) keys.add(`${personName}|${competence}`);
    });
  });

  records.forEach((record) => {
    if (record?.type !== 'entrada' && record?.type !== 'controle_horas') return;
    if (record.archived === true) return;
    const personName = record.person || '';
    const competence = getRecordCompetence(record);
    if (!personName || !competence) return;
    if (personFilter && personName !== personFilter) return;
    if (filters.start && competence < filters.start) return;
    if (filters.end && competence > filters.end) return;
    keys.add(`${personName}|${competence}`);
  });

  return [...keys];
}

function buildBaseEntradas(records = [], filters = {}, referenceData = {}, options = {}) {
  if (typeof options.consolidateEntry === 'function') {
    return buildEntryKeys(records, filters, referenceData, options)
      .map((key) => {
        const [personName, competence] = key.split('|');
        return options.consolidateEntry(personName, competence);
      })
      .filter((entry) => entry && (
        entry.salaryBase > 0 ||
        entry.hourExtra > 0 ||
        entry.outrosProventos > 0 ||
        entry.outrosDescontos > 0 ||
        entry.inss > 0 ||
        entry.irrf > 0
      ))
      .flatMap((entry) => {
        if (typeof options.mapEntryToCycleView !== 'function') return [entry];
        return [
          options.mapEntryToCycleView(entry, 'INICIO_MES'),
          options.mapEntryToCycleView(entry, 'QUINZENA')
        ].filter(Boolean);
      })
      .filter((entry) => !filters.cycle || entry.cycle === filters.cycle || entry.cycleView === filters.cycle);
  }

  return applyDashboardFilters(records, {
    ...filters,
    type: 'entrada',
    archiveMode: 'active'
  });
}

function buildBaseSaidas(records = [], filters = {}, referenceData = {}, options = {}) {
  const generatedExpenses = Array.isArray(referenceData.generatedPercentageExpenses)
    ? referenceData.generatedPercentageExpenses
    : [];
  const visibleExpenses = [
    ...records,
    ...generatedExpenses
  ].filter((record) => record?.type === 'saida');
  const filtered = applyDashboardFilters(visibleExpenses, {
    ...filters,
    type: 'saida',
    archiveMode: 'active'
  }).filter((record) => record.status !== 'Cancelado');
  const deorphaned = typeof options.filterOrphanPercentageExitRecords === 'function'
    ? options.filterOrphanPercentageExitRecords(filtered)
    : filtered;
  return typeof options.dedupePercentageExitRecords === 'function'
    ? options.dedupePercentageExitRecords(deorphaned)
    : deorphaned;
}

export function buildDashboardReadModel(input = {}) {
  const records = Array.isArray(input.records) ? [...input.records] : [];
  const filters = {
    start: normalizeCompetenceKey(input.filters?.start || input.filters?.competenceStart || '') || '',
    end: normalizeCompetenceKey(input.filters?.end || input.filters?.competenceEnd || input.filters?.start || '') || '',
    person: input.filters?.person || '',
    macro: input.filters?.macro || '',
    category: input.filters?.category || '',
    cycle: input.filters?.cycle || ''
  };
  const referenceData = input.referenceData || {};
  const options = input.options || {};
  const months = Array.isArray(referenceData.months) && referenceData.months.length
    ? [...referenceData.months]
    : getMonthKeys(filters.start, filters.end);
  const expenses = buildBaseSaidas(records, filters, referenceData, options);
  const incomes = buildBaseEntradas(records, filters, referenceData, options);
  const totals = selectDashboardTotals({ baseEntradas: incomes, baseSaidas: expenses });
  const personBalances = selectPersonBalances({
    baseEntradas: totals.entradasSummary.baseEntradas,
    baseSaidas: expenses
  });
  const aggregations = buildDashboardExpenseAggregations(expenses);
  const isSingleMonth = filters.start && filters.start === filters.end;
  const trend = isSingleMonth
    ? {
        mode: 'daily',
        start: filters.start,
        end: filters.end,
        months,
        daily: buildDashboardDailyExpenseTrendData(expenses, filters.start)
      }
    : {
        mode: 'monthly',
        start: filters.start,
        end: filters.end,
        months,
        monthly: buildDashboardMonthlyFinancialTrendData(
          { entradas: incomes, saidas: expenses },
          months,
          {
            formatCompetence: options.formatCompetence,
            isFinancialEntradaRecord: options.isFinancialEntradaRecord
          }
        )
      };

  return {
    summary: {
      totals,
      entradasSummary: totals.entradasSummary,
      personBalances,
      aggregations
    },
    kpis: {
      totalIncome: totals.totalEntradas,
      totalExpense: totals.totalSaidasPagas,
      balance: totals.saldoProjetado,
      paidExpense: totals.totalSaidasPagas,
      openExpense: totals.totalAberto,
      realizedBalance: totals.saldoRealizado,
      projectedBalance: totals.saldoProjetado,
      commitment: roundCurrency(totals.comprometimento)
    },
    charts: {
      trend,
      category: buildCategoryChartData(aggregations),
      status: buildStatusChartData(expenses)
    },
    expenses: sortRecordsNewestFirst(expenses),
    incomes: sortRecordsNewestFirst(incomes),
    metadata: {
      filters,
      months,
      sourceRecordCount: records.length,
      expenseCount: expenses.length,
      incomeCount: incomes.length,
      generatedExpenseCount: Array.isArray(referenceData.generatedPercentageExpenses) ? referenceData.generatedPercentageExpenses.length : 0,
      stale: input.metadata?.stale === true,
      offline: input.metadata?.offline === true
    },
    warnings: []
  };
}
