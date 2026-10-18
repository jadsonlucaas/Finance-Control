import { normalizeCompetenceKey } from '../core/dates.js';
import { roundCurrency } from '../core/money.js';

function getRecordHours(record = {}) {
  if (Number.isInteger(record.net_minutes)) return roundCurrency(record.net_minutes / 60);
  return Number(record.quantidadeHoras ?? record.hours_quantity ?? 0) || 0;
}

function getRecordAmount(record = {}) {
  return Number(record.valorTotalCalculado ?? record.financial_total ?? record.amount ?? 0) || 0;
}

function isDebitNature(record = {}) {
  return String(record.bank_nature || 'Debito').trim().toLowerCase().startsWith('d');
}

function matchesPeriod(record = {}, filters = {}) {
  const competence = normalizeCompetenceKey(record.competence || record.occurred_date || '');
  if (!competence) return false;
  if (filters.start && competence < filters.start) return false;
  if (filters.end && competence > filters.end) return false;
  if (filters.person && record.person !== filters.person) return false;
  return true;
}

function createPersonBucket(person = '') {
  return {
    person: person || 'Sem pessoa',
    overtimeHours: 0,
    overtimeAmount: 0,
    openingBankHours: 0,
    bankDebitHours: 0,
    bankCreditHours: 0,
    bankPeriodNetHours: 0,
    bankNetHours: 0,
    recordsCount: 0
  };
}

export function buildHourPeriodSummary(records = [], filters = {}) {
  const safeRecords = Array.isArray(records) ? records : [];
  const start = normalizeCompetenceKey(filters.start || '');
  const end = normalizeCompetenceKey(filters.end || '');
  const personFilter = filters.person || '';
  const byPerson = new Map();

  const summary = {
    start,
    end,
    person: personFilter,
    overtimeHours: 0,
    overtimeAmount: 0,
    openingBankHours: 0,
    bankDebitHours: 0,
    bankCreditHours: 0,
    bankPeriodNetHours: 0,
    bankNetHours: 0,
    recordsCount: 0,
    peopleCount: 0,
    byPerson: []
  };

  safeRecords
    .filter((record) => record?.type === 'controle_horas')
    .filter((record) => {
      if (personFilter && record?.person !== personFilter) return false;
      const competence = normalizeCompetenceKey(record?.competence || record?.occurred_date || '');
      if (!competence) return false;
      if (end && competence > end) return false;
      return true;
    })
    .forEach((record) => {
      const person = record.person || 'Sem pessoa';
      if (!byPerson.has(person)) byPerson.set(person, createPersonBucket(person));
      const bucket = byPerson.get(person);
      const hours = getRecordHours(record);
      const type = String(record.hour_control_type || record.hour_entry_type || '').trim();
      const movement = isDebitNature(record) ? hours : -hours;
      const competence = normalizeCompetenceKey(record.competence || record.occurred_date || '');

      if (type === 'Hora Extra' && matchesPeriod(record, { start, end, person: personFilter })) {
        summary.recordsCount += 1;
        bucket.recordsCount += 1;
        const amount = getRecordAmount(record);
        summary.overtimeHours += hours;
        summary.overtimeAmount += amount;
        bucket.overtimeHours += hours;
        bucket.overtimeAmount += amount;
        return;
      }

      if (type === 'Banco de Horas') {
        const isBeforeRange = start && competence && competence < start;
        const isInsideRange = matchesPeriod(record, { start, end, person: personFilter });

        if (isBeforeRange) {
          summary.openingBankHours += movement;
          bucket.openingBankHours += movement;
          return;
        }

        if (!isInsideRange) return;

        summary.recordsCount += 1;
        bucket.recordsCount += 1;

        if (isDebitNature(record)) {
          summary.bankDebitHours += hours;
          bucket.bankDebitHours += hours;
        } else {
          summary.bankCreditHours += hours;
          bucket.bankCreditHours += hours;
        }

        summary.bankPeriodNetHours += movement;
        bucket.bankPeriodNetHours += movement;
      }
    });

  summary.overtimeHours = roundCurrency(summary.overtimeHours);
  summary.overtimeAmount = roundCurrency(summary.overtimeAmount);
  summary.openingBankHours = roundCurrency(summary.openingBankHours);
  summary.bankDebitHours = roundCurrency(summary.bankDebitHours);
  summary.bankCreditHours = roundCurrency(summary.bankCreditHours);
  summary.bankPeriodNetHours = roundCurrency(summary.bankPeriodNetHours);
  summary.bankNetHours = roundCurrency(summary.openingBankHours + summary.bankPeriodNetHours);
  summary.byPerson = [...byPerson.values()]
    .map((bucket) => ({
      ...bucket,
      overtimeHours: roundCurrency(bucket.overtimeHours),
      overtimeAmount: roundCurrency(bucket.overtimeAmount),
      openingBankHours: roundCurrency(bucket.openingBankHours),
      bankDebitHours: roundCurrency(bucket.bankDebitHours),
      bankCreditHours: roundCurrency(bucket.bankCreditHours),
      bankPeriodNetHours: roundCurrency(bucket.bankPeriodNetHours),
      bankNetHours: roundCurrency(bucket.openingBankHours + bucket.bankPeriodNetHours)
    }))
    .filter((bucket) => (
      bucket.recordsCount > 0 ||
      bucket.openingBankHours !== 0 ||
      bucket.bankNetHours !== 0
    ))
    .sort((a, b) => a.person.localeCompare(b.person, 'pt-BR'));
  summary.peopleCount = summary.byPerson.length;

  return summary;
}
