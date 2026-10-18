import { describe, expect, it } from 'vitest';
import { GLOBAL_BRIDGE_API, installGlobalBridge } from '../../src/legacy/globalBridge.js';

const REQUIRED_GLOBALS = [
  'roundCurrency',
  'parseCurrencyValue',
  'normalizeCompetenceKey',
  'parseTimeToMinutes',
  'formatHoursDecimal',
  'normalizeImportText',
  'normalizeCycleValue',
  'normalizeStatusValue',
  'parseOvertimePercent',
  'calcularHoras',
  'calcularHoraExtra',
  'calcularBancoHoras',
  'calcularINSS',
  'calcularIRRF',
  'calcularLiquido',
  'fmt',
  'fmtCompactCurrency',
  'addDashboardAggregationItem',
  'dashboardAggregationItems',
  'buildDashboardEntradasSummary',
  'buildDashboardExpenseAggregations',
  'buildDashboardPersonBalances',
  'buildHourPeriodSummary',
  'consolidateMonthlyEntry',
  'getMonthlyDiscountRecords',
  'getMonthlyEntryRecords',
  'getMonthlyHourExtraRecords',
  'calcularDSRHoraExtra',
  'getDSRCalendarFactors',
  'getFixedBrazilHolidayDates',
  'getPercentageBaseValue',
  'getPercentageCycleBaseValue',
  'getPercentageRuleAmount',
  'getPercentageRuleBaseValue',
  'isReserveOrInvestmentPercentageRule'
];

describe('global compatibility bridge', () => {
  it('defines the expected compatibility API surface', () => {
    expect(Object.keys(GLOBAL_BRIDGE_API).sort()).toEqual(REQUIRED_GLOBALS.sort());
  });

  it('installs pure core/domain helpers on the target object', () => {
    const target = {};
    const bridge = installGlobalBridge(target);

    for (const name of REQUIRED_GLOBALS) {
      expect(typeof target[name], name).toBe('function');
    }

    expect(target.calcularINSS(3000)).toBe(248.61);
    expect(target.fmt(1234.56)).toBe('R$ 1.234,56');
    expect(bridge).toBe(target.financeGlobalBridge);
    expect(bridge.api).toBe(GLOBAL_BRIDGE_API);
  });

  it('preserves financeDomain aliases used by legacy scripts', () => {
    const target = {};
    installGlobalBridge(target);

    expect(typeof target.financeDomain.consolidateMonthlyEntry).toBe('function');
    expect(typeof target.financeDomain.getMonthlyDiscountRecords).toBe('function');
    expect(typeof target.financeDomain.calcularDSRHoraExtra).toBe('function');
    expect(typeof target.financeDomain.buildDashboardEntradasSummary).toBe('function');
    expect(typeof target.financeDomain.buildHourPeriodSummary).toBe('function');
    expect(typeof target.financeDomain.getPercentageRuleAmount).toBe('function');
  });
});
