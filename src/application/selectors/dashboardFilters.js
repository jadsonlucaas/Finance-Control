import { normalizeCompetenceKey } from '../../core/dates.js';

export function getRecordCompetence(record = {}) {
  return normalizeCompetenceKey(record.competence || record.competencia || record.due_date || record.occurred_date || '') || '';
}

export function filterByCompetence(records = [], competence = '') {
  const target = normalizeCompetenceKey(competence || '') || '';
  if (!target) return [...records];
  return records.filter((record) => getRecordCompetence(record) === target);
}

export function filterByPeriod(records = [], filters = {}) {
  const start = normalizeCompetenceKey(filters.start || filters.competenceStart || '') || '';
  const end = normalizeCompetenceKey(filters.end || filters.competenceEnd || '') || '';
  if (!start && !end) return [...records];
  return records.filter((record) => {
    const competence = getRecordCompetence(record);
    if (!competence) return false;
    if (start && competence < start) return false;
    if (end && competence > end) return false;
    return true;
  });
}

export function filterByPerson(records = [], person = '') {
  if (!person) return [...records];
  return records.filter((record) => record?.person === person);
}

export function filterByType(records = [], type = '') {
  if (!type) return [...records];
  return records.filter((record) => record?.type === type);
}

export function filterByStatus(records = [], status = '') {
  if (!status) return [...records];
  return records.filter((record) => record?.status === status);
}

export function filterByMacro(records = [], macro = '') {
  if (!macro) return [...records];
  return records.filter((record) => record?.macro_category === macro);
}

export function filterByCategory(records = [], category = '') {
  if (!category) return [...records];
  return records.filter((record) => record?.category_name === category || record?.subcategory === category);
}

export function filterByCycle(records = [], cycle = '') {
  if (!cycle) return [...records];
  return records.filter((record) => (record?.cycle || record?.cycleView) === cycle);
}

export function filterByArchiveMode(records = [], archiveMode = 'active') {
  if (archiveMode === 'all') return [...records];
  if (archiveMode === 'archived') return records.filter((record) => record?.archived === true);
  return records.filter((record) => record?.archived !== true);
}

export function applyDashboardFilters(records = [], filters = {}) {
  const safeRecords = Array.isArray(records) ? records : [];
  return filterByCycle(
    filterByCategory(
      filterByMacro(
        filterByStatus(
          filterByType(
            filterByPerson(
              filterByArchiveMode(
                filterByPeriod(safeRecords, filters),
                filters.archiveMode || 'all'
              ),
              filters.person || ''
            ),
            filters.type || ''
          ),
          filters.status || ''
        ),
        filters.macro || ''
      ),
      filters.category || ''
    ),
    filters.cycle || ''
  );
}

export function sortRecordsNewestFirst(records = []) {
  return [...records].sort((a, b) =>
    String(b?.paid_at || b?.due_date || b?.occurred_date || b?.competence || b?.competencia || '')
      .localeCompare(String(a?.paid_at || a?.due_date || a?.occurred_date || a?.competence || a?.competencia || ''))
  );
}

export function paginateRecords(records = [], pagination = {}) {
  const pageSize = Number(pagination.pageSize || records.length || 0);
  const page = Math.max(Number(pagination.page || 1), 1);
  if (!pageSize) return { records: [...records], page: 1, pageSize: 0, total: records.length, totalPages: 1 };
  const start = (page - 1) * pageSize;
  return {
    records: records.slice(start, start + pageSize),
    page,
    pageSize,
    total: records.length,
    totalPages: Math.max(Math.ceil(records.length / pageSize), 1)
  };
}
