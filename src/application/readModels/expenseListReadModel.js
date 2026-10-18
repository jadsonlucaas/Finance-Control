import { applyDashboardFilters, paginateRecords, sortRecordsNewestFirst } from '../selectors/dashboardFilters.js';

export function buildExpenseListReadModel(input = {}) {
  const records = Array.isArray(input.records) ? input.records : [];
  const filters = input.filters || {};
  const filtered = applyDashboardFilters(records, {
    ...filters,
    type: 'saida',
    archiveMode: filters.archiveMode || 'active'
  });
  const sorted = sortRecordsNewestFirst(filtered);
  const page = paginateRecords(sorted, input.pagination || {});
  return {
    items: page.records,
    allItems: sorted,
    pagination: {
      page: page.page,
      pageSize: page.pageSize,
      total: page.total,
      totalPages: page.totalPages
    },
    getById: (id) => sorted.find((record) => record.id === id) || null
  };
}
