import { normalizeCompetenceKey } from '../../core/dates.js';

function list(records = []) {
  return Array.isArray(records) ? records : [];
}

function text(value = '') {
  return String(value || '').trim();
}

function lower(value = '') {
  return text(value).toLowerCase();
}

export function getPlannerItemCompetence(item = {}) {
  return normalizeCompetenceKey(item.competence || item.competencia || item.date || item.due_date || item.occurred_date || '') || '';
}

export function filterPlannerByPeriod(records = [], filters = {}) {
  const start = normalizeCompetenceKey(filters.start || filters.competenceStart || filters.month || filters.competence || '') || '';
  const end = normalizeCompetenceKey(filters.end || filters.competenceEnd || filters.month || filters.competence || '') || '';
  if (!start && !end) return [...list(records)];

  return list(records).filter((record) => {
    const competence = getPlannerItemCompetence(record);
    if (!competence) return false;
    if (start && competence < start) return false;
    if (end && competence > end) return false;
    return true;
  });
}

export function filterPlannerByPerson(records = [], person = '') {
  const expected = lower(person);
  if (!expected) return [...list(records)];
  return list(records).filter((record) => lower(record.person || record.pessoa) === expected);
}

export function filterPlannerByType(records = [], type = '') {
  const expected = lower(type);
  if (!expected || expected === 'todos') return [...list(records)];
  return list(records).filter((record) => lower(record.type || record.eventType || record.plannerType) === expected);
}

export function filterPlannerByStatus(records = [], status = '') {
  const expected = lower(status);
  if (!expected || expected === 'todos') return [...list(records)];
  return list(records).filter((record) => lower(record.status || record.paymentStatus) === expected);
}

export function filterPlannerByMacro(records = [], macro = '') {
  const expected = lower(macro);
  if (!expected || expected === 'todos') return [...list(records)];
  return list(records).filter((record) => lower(record.macro || record.macro_category) === expected);
}

export function filterPlannerByCategory(records = [], category = '') {
  const expected = lower(category);
  if (!expected || expected === 'todos') return [...list(records)];
  return list(records).filter((record) =>
    [record.category, record.category_name, record.subcategory]
      .map(lower)
      .includes(expected)
  );
}

export function filterPlannerArchived(records = [], archiveMode = 'active') {
  const mode = lower(archiveMode || 'active');
  if (mode === 'all' || mode === 'todos') return [...list(records)];
  if (mode === 'archived' || mode === 'arquivados') return list(records).filter((record) => record.archived === true);
  return list(records).filter((record) => record.archived !== true);
}

export function applyPlannerFilters(records = [], filters = {}) {
  return filterPlannerByCategory(
    filterPlannerByMacro(
      filterPlannerByStatus(
        filterPlannerByType(
          filterPlannerByPerson(
            filterPlannerArchived(
              filterPlannerByPeriod(records, filters),
              filters.archiveMode || 'active'
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
  );
}
