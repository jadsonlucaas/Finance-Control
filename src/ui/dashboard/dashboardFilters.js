import { normalizeCompetenceKey } from '../../core/dates.js';

export function getCurrentMonthFallback() {
  return new Date().toISOString().slice(0, 7);
}

export function getDashboardFilterMonthRange() {
  const fallback = getCurrentMonthFallback();
  const startField = document.getElementById('f-comp-start');
  const endField = document.getElementById('f-comp-end');
  const startRaw = normalizeCompetenceKey(startField?.value || fallback) || fallback;
  const endRaw = normalizeCompetenceKey(endField?.value || startRaw) || startRaw;
  const start = startRaw <= endRaw ? startRaw : endRaw;
  const end = startRaw <= endRaw ? endRaw : startRaw;
  if (startField) startField.value = start;
  if (endField) endField.value = end;
  return { start, end };
}

export function getDashboardRecordCompetence(record = {}) {
  return normalizeCompetenceKey(record.competence || record.competencia || record.due_date || record.occurred_date || '');
}

export function getDashboardMonthKeys(start = '', end = '') {
  const fallback = getCurrentMonthFallback();
  const first = normalizeCompetenceKey(start || end || fallback);
  const last = normalizeCompetenceKey(end || first);
  if (!first || !last) return [];

  const months = [];
  let [year, month] = first.split('-').map(Number);
  const [endYear, endMonth] = last.split('-').map(Number);
  let guard = 0;

  while ((year < endYear || (year === endYear && month <= endMonth)) && guard < 240) {
    months.push(`${year}-${String(month).padStart(2, '0')}`);
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
    guard += 1;
  }

  return months;
}
