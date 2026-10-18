import { normalizeCompetenceKey } from '../../core/dates.js';

export function getHourEntryCompetence(record = {}) {
  return normalizeCompetenceKey(record.competence || record.competencia || record.occurred_date || record.occurredDate || '') || '';
}

export function getHourEntryDate(record = {}) {
  return String(record.occurred_date || record.occurredDate || record.date || '');
}

export function getHourEntryType(record = {}) {
  return String(record.hour_control_type || record.hourControlType || record.hour_entry_type || record.hourEntryType || '').trim();
}

export function filterHourEntriesByCompetence(records = [], competence = '') {
  const target = normalizeCompetenceKey(competence || '') || '';
  if (!target) return [...records];
  return records.filter((record) => getHourEntryCompetence(record) === target);
}

export function filterHourEntriesByPeriod(records = [], filters = {}) {
  const start = normalizeCompetenceKey(filters.start || filters.competenceStart || '') || '';
  const end = normalizeCompetenceKey(filters.end || filters.competenceEnd || '') || '';
  if (!start && !end) return [...records];
  return records.filter((record) => {
    const competence = getHourEntryCompetence(record);
    if (!competence) return false;
    if (start && competence < start) return false;
    if (end && competence > end) return false;
    return true;
  });
}

export function filterHourEntriesByPerson(records = [], person = '') {
  if (!person) return [...records];
  return records.filter((record) => record?.person === person);
}

export function filterHourEntriesByStatus(records = [], status = '') {
  if (!status) return [...records];
  return records.filter((record) => record?.status === status);
}

export function filterHourEntriesByType(records = [], type = '') {
  if (!type) return [...records];
  return records.filter((record) => getHourEntryType(record) === type);
}

export function filterHourEntriesBySearch(records = [], search = '') {
  const term = String(search || '').trim().toLowerCase();
  if (!term) return [...records];
  return records.filter((record) => [
    record?.person,
    getHourEntryCompetence(record),
    getHourEntryDate(record),
    getHourEntryType(record),
    record?.observacao,
    record?.observation,
    record?.notes
  ].some((value) => String(value || '').toLowerCase().includes(term)));
}

export function filterHourEntriesByArchiveMode(records = [], archiveMode = 'active') {
  if (archiveMode === 'all') return [...records];
  if (archiveMode === 'archived') return records.filter((record) => record?.archived === true);
  return records.filter((record) => record?.archived !== true);
}

export function applyHourControlFilters(records = [], filters = {}) {
  const safeRecords = Array.isArray(records) ? records : [];
  return filterHourEntriesBySearch(
    filterHourEntriesByType(
      filterHourEntriesByStatus(
        filterHourEntriesByPerson(
          filterHourEntriesByArchiveMode(
            filterHourEntriesByPeriod(safeRecords.filter((record) => record?.type === 'controle_horas'), filters),
            filters.archiveMode || 'active'
          ),
          filters.person || ''
        ),
        filters.status || ''
      ),
      filters.hourControlType || filters.type || ''
    ),
    filters.search || ''
  );
}

export function sortHourEntriesNewestFirst(records = []) {
  return [...records].sort((a, b) =>
    String(getHourEntryDate(b) || getHourEntryCompetence(b) || '')
      .localeCompare(String(getHourEntryDate(a) || getHourEntryCompetence(a) || ''))
  );
}
