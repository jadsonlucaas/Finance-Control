import { normalizeCompetenceKey } from '../../core/dates.js';
import { roundCurrency } from '../../core/money.js';
import { buildHourPeriodSummary } from '../../domain/hourPeriodSummary.js';
import { ResolveEffectiveSalary, formatMinutesToClock } from '../../domain/workSession.js';
import {
  applyHourControlFilters,
  getHourEntryCompetence,
  getHourEntryDate,
  getHourEntryType,
  sortHourEntriesNewestFirst
} from '../selectors/hourControlFilters.js';

function number(value = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function minutesFromRecord(record = {}) {
  if (Number.isInteger(record.net_minutes)) return record.net_minutes;
  if (Number.isInteger(record.netMinutes)) return record.netMinutes;
  return Math.round(number(record.quantidadeHoras ?? record.hours_quantity ?? record.hoursQuantity) * 60);
}

function amountFromRecord(record = {}) {
  return roundCurrency(number(record.valorTotalCalculado ?? record.financial_total ?? record.amount));
}

function bankNature(record = {}) {
  const raw = String(record.bank_nature || record.bankNature || 'Debito').trim();
  return raw || 'Debito';
}

function buildEntryView(record = {}) {
  const netMinutes = minutesFromRecord(record);
  const hoursQuantity = roundCurrency(netMinutes / 60);
  return {
    id: record.id || '',
    type: record.type || '',
    person: record.person || '',
    competence: getHourEntryCompetence(record),
    occurredDate: getHourEntryDate(record),
    hourControlType: getHourEntryType(record),
    startTime: record.start_time || record.startTime || record.horaInicial || '',
    endTime: record.end_time || record.endTime || record.horaFinal || '',
    grossMinutes: Number.isInteger(record.gross_minutes) ? record.gross_minutes : Number(record.grossMinutes || 0),
    breakMinutes: Number.isInteger(record.break_minutes) ? record.break_minutes : Number(record.breakMinutes || 0),
    netMinutes,
    hoursQuantity,
    hoursFormatted: formatMinutesToClock(Math.abs(netMinutes)),
    bankMinutes: Number.isInteger(record.bank_minutes) ? record.bank_minutes : Number(record.bankMinutes || 0),
    bankNature: bankNature(record),
    overtimePercentage: number(record.overtime_percentage ?? record.overtimePercentage ?? record.percentual),
    financialTotal: amountFromRecord(record),
    status: record.status || '',
    archived: record.archived === true,
    sourceRecord: record
  };
}

function getPeople(records = [], referenceData = {}) {
  const people = Array.isArray(referenceData.people)
    ? referenceData.people
    : records.filter((record) => record?.type === 'pessoa');
  return people.map((record) => ({ ...record, person: record?.person || record?.name || '' }));
}

function findPersonRecord(records = [], referenceData = {}, person = '') {
  return getPeople(records, referenceData).find((record) => record.person === person) || null;
}

function buildMonthlyTotals(entries = []) {
  const byCompetence = new Map();
  entries.forEach((entry) => {
    if (!entry.competence) return;
    if (!byCompetence.has(entry.competence)) {
      byCompetence.set(entry.competence, {
        competence: entry.competence,
        overtimeHours: 0,
        overtimeAmount: 0,
        bankDebitHours: 0,
        bankCreditHours: 0,
        recordsCount: 0
      });
    }
    const bucket = byCompetence.get(entry.competence);
    bucket.recordsCount += 1;
    if (entry.hourControlType === 'Hora Extra') {
      bucket.overtimeHours += entry.hoursQuantity;
      bucket.overtimeAmount += entry.financialTotal;
    }
    if (entry.hourControlType === 'Banco de Horas') {
      const isDebit = entry.bankNature.toLowerCase().startsWith('d');
      if (isDebit) bucket.bankDebitHours += entry.hoursQuantity;
      else bucket.bankCreditHours += entry.hoursQuantity;
    }
  });

  return [...byCompetence.values()]
    .map((item) => ({
      ...item,
      overtimeHours: roundCurrency(item.overtimeHours),
      overtimeAmount: roundCurrency(item.overtimeAmount),
      bankDebitHours: roundCurrency(item.bankDebitHours),
      bankCreditHours: roundCurrency(item.bankCreditHours)
    }))
    .sort((a, b) => a.competence.localeCompare(b.competence));
}

export function buildHourControlReadModel(input = {}) {
  const records = Array.isArray(input.records) ? [...input.records] : [];
  const hourEntries = Array.isArray(input.hourEntries) ? [...input.hourEntries] : records.filter((record) => record?.type === 'controle_horas');
  const salaryHistory = Array.isArray(input.salaryHistory) ? input.salaryHistory : records.filter((record) => record?.type === 'salario_historico');
  const filters = {
    start: normalizeCompetenceKey(input.filters?.start || input.filters?.competenceStart || input.filters?.competence || '') || '',
    end: normalizeCompetenceKey(input.filters?.end || input.filters?.competenceEnd || input.filters?.start || input.filters?.competence || '') || '',
    person: input.filters?.person || '',
    status: input.filters?.status || '',
    hourControlType: input.filters?.hourControlType || '',
    search: input.filters?.search || '',
    archiveMode: input.filters?.archiveMode || 'active'
  };
  const referenceData = input.referenceData || {};
  const filteredSource = applyHourControlFilters(hourEntries, filters);
  const entries = sortHourEntriesNewestFirst(filteredSource).map(buildEntryView);
  const summarySource = hourEntries.filter((record) => record?.archived !== true);
  const summary = buildHourPeriodSummary(summarySource, filters);
  const effectiveSalary = filters.person
    ? ResolveEffectiveSalary({
        person: filters.person,
        competence: filters.start || filters.end || '',
        salaryHistory,
        personRecord: findPersonRecord(records, referenceData, filters.person)
      })
    : null;

  return {
    entries,
    summary,
    overtime: {
      hours: summary.overtimeHours,
      amount: summary.overtimeAmount,
      entriesCount: entries.filter((entry) => entry.hourControlType === 'Hora Extra').length
    },
    bank: {
      openingHours: summary.openingBankHours,
      debitHours: summary.bankDebitHours,
      creditHours: summary.bankCreditHours,
      periodNetHours: summary.bankPeriodNetHours,
      netHours: summary.bankNetHours
    },
    monthlyTotals: buildMonthlyTotals(entries),
    effectiveSalary,
    metadata: {
      filters,
      sourceRecordCount: records.length,
      hourEntryCount: hourEntries.length,
      visibleEntryCount: entries.length,
      stale: input.metadata?.stale === true,
      offline: input.metadata?.offline === true
    },
    warnings: []
  };
}
