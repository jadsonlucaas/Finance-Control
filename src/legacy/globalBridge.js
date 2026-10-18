import { normalizeCompetenceKey } from '../core/dates.js';
import { formatCompactCurrency, formatCurrency } from '../core/formatters.js';
import { parseCurrencyValue, roundCurrency } from '../core/money.js';
import {
  calcularBancoHoras,
  calcularHoraExtra,
  calcularHoras,
  formatHoursDecimal,
  parseOvertimePercent,
  parseTimeToMinutes
} from '../domain/hours.js';
import { buildHourPeriodSummary } from '../domain/hourPeriodSummary.js';
import { calcularINSS, calcularIRRF, calcularLiquido } from '../domain/taxes.js';
import { normalizeCycleValue, normalizeImportText, normalizeStatusValue } from '../domain/imports.js';
import {
  addDashboardAggregationItem,
  buildDashboardEntradasSummary,
  buildDashboardExpenseAggregations,
  buildDashboardPersonBalances,
  dashboardAggregationItems
} from '../domain/dashboard.js';
import {
  consolidateMonthlyEntry,
  getMonthlyDiscountRecords,
  getMonthlyEntryRecords,
  getMonthlyHourExtraRecords
} from '../domain/entries.js';
import {
  calcularDSRHoraExtra,
  getDSRCalendarFactors,
  getFixedBrazilHolidayDates
} from '../domain/dsr.js';
import {
  getPercentageBaseValue,
  getPercentageCycleBaseValue,
  getPercentageRuleAmount,
  getPercentageRuleBaseValue,
  isReserveOrInvestmentPercentageRule
} from '../domain/percentage-rules.js';
import { defineLegacyGlobalBridge, getLegacyGlobalBridgeRegistry } from './bridgeRegistry.js';

export const GLOBAL_BRIDGE_API = {
  roundCurrency,
  parseCurrencyValue,
  normalizeCompetenceKey,
  parseTimeToMinutes,
  formatHoursDecimal,
  normalizeImportText,
  normalizeCycleValue,
  normalizeStatusValue,
  parseOvertimePercent,
  calcularHoras,
  calcularHoraExtra,
  calcularBancoHoras,
  calcularINSS,
  calcularIRRF,
  calcularLiquido,
  fmt: formatCurrency,
  fmtCompactCurrency: formatCompactCurrency,
  addDashboardAggregationItem,
  dashboardAggregationItems,
  buildDashboardEntradasSummary,
  buildDashboardExpenseAggregations,
  buildDashboardPersonBalances,
  buildHourPeriodSummary,
  consolidateMonthlyEntry,
  getMonthlyDiscountRecords,
  getMonthlyEntryRecords,
  getMonthlyHourExtraRecords,
  calcularDSRHoraExtra,
  getDSRCalendarFactors,
  getFixedBrazilHolidayDates,
  getPercentageBaseValue,
  getPercentageCycleBaseValue,
  getPercentageRuleAmount,
  getPercentageRuleBaseValue,
  isReserveOrInvestmentPercentageRule
};

export function createFinanceDomainApi() {
  return {
    consolidateMonthlyEntry,
    getMonthlyDiscountRecords,
    getMonthlyEntryRecords,
    getMonthlyHourExtraRecords,
    calcularDSRHoraExtra,
    getDSRCalendarFactors,
    getFixedBrazilHolidayDates,
    buildDashboardEntradasSummary,
    buildDashboardExpenseAggregations,
    buildDashboardPersonBalances,
    buildHourPeriodSummary,
    getPercentageBaseValue,
    getPercentageCycleBaseValue,
    getPercentageRuleAmount,
    getPercentageRuleBaseValue,
    isReserveOrInvestmentPercentageRule
  };
}

export function installGlobalBridge(target = globalThis) {
  Object.entries(GLOBAL_BRIDGE_API).forEach(([name, value]) => {
    defineLegacyGlobalBridge(target, name, value, { canonical: `src/domain or src/core:${name}` });
  });

  defineLegacyGlobalBridge(target, 'financeDomain', target.financeDomain || createFinanceDomainApi(), {
    canonical: 'src/legacy/globalBridge.js:createFinanceDomainApi'
  });

  target.financeGlobalBridge = {
    installGlobalBridge,
    api: GLOBAL_BRIDGE_API,
    financeDomain: target.financeDomain,
    registry: getLegacyGlobalBridgeRegistry(target)
  };

  return target.financeGlobalBridge;
}
