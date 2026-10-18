import { roundCurrency } from '../../core/money.js';
import { normalizeCompetenceKey } from '../../core/dates.js';
import { queryFinanceRecordsForTarget } from '../../state/financeRecordIndex.js';
import { buildDashboardReadModel } from '../../application/readModels/dashboardReadModel.js';
import {
  buildDashboardDailyExpenseTrendData,
  buildDashboardMonthlyFinancialTrendData
} from '../../application/readModels/dashboardChartData.js';
import {
  getCurrentMonthFallback,
  getDashboardFilterMonthRange,
  getDashboardMonthKeys
} from './dashboardFilters.js';

const dashboardComputationCache = {
  readModel: { key: '', value: null }
};

function getDashboardDataVersion() {
  return window.__financeDataVersion || 0;
}

function getWindowFunction(name) {
  const candidate = window[name];
  return typeof candidate === 'function' ? candidate : null;
}

function getDashboardPercentageRules() {
  try {
    const getRules = getWindowFunction('getSyncedPercentageExitRules');
    const rules = getRules
      ? getRules()
      : [];
    return Array.isArray(rules) ? rules.filter((rule) =>
      rule &&
      rule.active !== false &&
      Number(rule.percentage || 0) > 0
    ) : [];
  } catch {
    return [];
  }
}

function getDashboardRulesSignature() {
  return getDashboardPercentageRules()
    .map((rule) => [
      rule.id || '',
      rule.person || '',
      rule.macro || '',
      rule.category || '',
      rule.percentage || '',
      rule.base || '',
      rule.cycle || '',
      rule.status || '',
      rule.active !== false ? '1' : '0',
      rule.startCompetence || ''
    ].join(':'))
    .join('|');
}

function getDashboardSettingsSignature() {
  return [
    localStorage.getItem('finance-control-tax-settings-v1') || '',
    localStorage.getItem('finance-control-overtime-types-v1') || '',
    localStorage.getItem('finance-control-custom-holidays-v1') || '',
    localStorage.getItem('finance-control-planner-events-v1') || ''
  ].join('|');
}

function setDashboardCache(bucket, key, factory) {
  const entry = dashboardComputationCache[bucket];
  if (entry && entry.key === key && entry.value) return entry.value;
  const value = factory();
  if (entry) {
    entry.key = key;
    entry.value = value;
  }
  return value;
}

function readDashboardFilterState() {
  const { start, end } = getDashboardFilterMonthRange();
  return {
    start,
    end,
    person: document.getElementById('f-person')?.value || '',
    macro: document.getElementById('f-macro')?.value || '',
    cycle: document.getElementById('f-cycle')?.value || ''
  };
}

function getDashboardPercentageBaseAmount(consolidated = {}, base = 'liquido', cycle = 'INICIO_MES', rule = null) {
  const getPercentageRuleBaseValue = getWindowFunction('getPercentageRuleBaseValue');
  const getPercentageCycleBaseValue = getWindowFunction('getPercentageCycleBaseValue');
  if (rule && getPercentageRuleBaseValue) {
    return getPercentageRuleBaseValue(consolidated, rule);
  }
  if (getPercentageCycleBaseValue) {
    return getPercentageCycleBaseValue(consolidated, base, cycle);
  }
  if (base === 'base_total') return Number(consolidated.baseTotal || 0);
  if (base === 'extra') {
    return cycle === 'QUINZENA'
      ? 0
      : roundCurrency((Number(consolidated.hourExtra || 0)) + (Number(consolidated.outrosProventos || 0)));
  }
  if (cycle === 'QUINZENA') return Number(consolidated.adiantamentoQuinzena || 0);
  if (base === 'bruta') return Number(consolidated.baseTotal || 0);
  if (base === 'salario') return Number(consolidated.salaryBase || consolidated.salarioBase || 0);
  return Number(consolidated.liquido || consolidated.liquidoFinal || 0);
}

function getDashboardGeneratedPercentageSaidas(start = '', end = '') {
  const consolidarEntradaMensal = getWindowFunction('consolidarEntradaMensal');
  const getPeopleRecords = getWindowFunction('getPeopleRecords');
  const hasPersistedPercentageExitRecord = getWindowFunction('hasPersistedPercentageExitRecord');
  const buildPercentageExitRecord = getWindowFunction('buildPercentageExitRecord');
  if (!consolidarEntradaMensal || !getPeopleRecords) return [];

  const months = getDashboardMonthKeys(start, end);
  const people = getPeopleRecords();
  const records = [];

  getDashboardPercentageRules().forEach((rule) => {
    const ruleStart = normalizeCompetenceKey(rule.startCompetence || getCurrentMonthFallback()) || getCurrentMonthFallback();
    const targetPeople = rule.person
      ? people.filter((personRecord) => personRecord.person === rule.person)
      : people;

    targetPeople.forEach((personRecord) => {
      const personName = personRecord.person || '';
      if (!personName) return;

      months.forEach((competence) => {
        if (ruleStart && competence < ruleStart) return;
        if (hasPersistedPercentageExitRecord && hasPersistedPercentageExitRecord(rule, personName, competence)) return;
        if (buildPercentageExitRecord) {
          const record = buildPercentageExitRecord(rule, personName, competence, { virtual: true });
          if (record) records.push(record);
          return;
        }

        const consolidated = consolidarEntradaMensal(personName, competence);
        const baseAmount = getDashboardPercentageBaseAmount(consolidated, rule.base, rule.cycle, rule);
        const amount = roundCurrency(baseAmount * ((Number(rule.percentage) || 0) / 100));
        if (amount > 0) records.push({ ...rule, type: 'saida', person: personName, competence, amount, virtual: true });
      });
    });
  });

  return records;
}

function buildDashboardReadModelFromLegacyAdapters() {
  const filters = readDashboardFilterState();
  const months = getDashboardMonthKeys(filters.start, filters.end);
  const cacheKey = JSON.stringify({
    v: getDashboardDataVersion(),
    ...filters,
    months: months.join('|'),
    rules: getDashboardRulesSignature(),
    settings: getDashboardSettingsSignature()
  });

  return setDashboardCache('readModel', cacheKey, () => buildDashboardReadModel({
    records: queryFinanceRecordsForTarget({}, window),
    filters,
    referenceData: {
      months,
      people: getWindowFunction('getPeopleRecords') ? getWindowFunction('getPeopleRecords')() : [],
      generatedPercentageExpenses: getDashboardGeneratedPercentageSaidas(filters.start, filters.end)
    },
    options: {
      consolidateEntry: getWindowFunction('consolidarEntradaMensal'),
      mapEntryToCycleView: getWindowFunction('mapEntradaToCycleView'),
      getSalaryInfo: getWindowFunction('getSalarioVigente'),
      isFinancialEntradaRecord: getWindowFunction('isFinancialEntradaRecord')
        ? getWindowFunction('isFinancialEntradaRecord')
        : (record) => record?.type === 'entrada',
      formatCompetence: getWindowFunction('formatCompetence')
        ? getWindowFunction('formatCompetence')
        : (value) => value,
      filterOrphanPercentageExitRecords: getWindowFunction('filterOrphanPercentageExitRecords'),
      dedupePercentageExitRecords: getWindowFunction('dedupePercentageExitRecords')
    }
  }));
}

export function getDashboardBaseSaidas() {
  return buildDashboardReadModelFromLegacyAdapters().expenses;
}

export function getDashboardBaseEntradas() {
  return buildDashboardReadModelFromLegacyAdapters().incomes;
}

export function getDashboardEntradasSummary() {
  return buildDashboardReadModelFromLegacyAdapters().summary.entradasSummary;
}

export function getDashboardTotals() {
  return buildDashboardReadModelFromLegacyAdapters().summary.totals;
}

export function getDashboardPersonBalances() {
  return buildDashboardReadModelFromLegacyAdapters().summary.personBalances;
}

export function getDashboardAggregations() {
  return buildDashboardReadModelFromLegacyAdapters().summary.aggregations;
}

export function buildDashboardDailyExpenseTrend(records = [], month = '') {
  return buildDashboardDailyExpenseTrendData(records, month);
}

export function buildDashboardMonthlyFinancialTrend(source = [], months = []) {
  return buildDashboardMonthlyFinancialTrendData(source, months, {
    formatCompetence: typeof window !== 'undefined' && typeof window.formatCompetence === 'function'
      ? (value) => window.formatCompetence(value)
      : (value) => value,
    isFinancialEntradaRecord: typeof window !== 'undefined' && typeof window.isFinancialEntradaRecord === 'function'
      ? (record) => window.isFinancialEntradaRecord(record)
      : (record) => record?.type === 'entrada'
  });
}

export function getDashboardTrendData() {
  return buildDashboardReadModelFromLegacyAdapters().charts.trend;
}

export function installDashboardDataGlobals(target = window) {
  Object.assign(target, {
    getDashboardBaseSaidas,
    getDashboardBaseEntradas,
    getDashboardTotals,
    getDashboardEntradasSummary,
    getDashboardPersonBalances,
    getDashboardAggregations,
    buildDashboardDailyExpenseTrend,
    buildDashboardMonthlyFinancialTrend,
    getDashboardTrendData
  });
}
