export { buildDashboardExpenseAggregations, dashboardAggregationItems } from '../domain/dashboard.js';

export function createDashboardDetailSummary(records = [], roundCurrency = (value) => value) {
  const total = roundCurrency(records.reduce((sum, item) => sum + (Number(item?.amount) || 0), 0));
  const paidCount = records.filter((item) => item?.status === 'Pago').length;
  const openCount = records.filter((item) => item?.status === 'Em aberto').length;
  return { total, paidCount, openCount };
}

export function createDashboardRenderPayload(aggregations = {}) {
  return {
    aggregations,
    ready: Boolean(aggregations && typeof aggregations === 'object')
  };
}
