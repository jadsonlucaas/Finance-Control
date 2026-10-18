import { roundCurrency } from '../core/money.js';
import {
  CalculateWorkSession,
  formatMinutesToClock,
  parseOvertimePercent
} from './workSession.js';

function addIssue(issues, code, message, field = '') {
  issues.push({ code, message, field, severity: 'warning' });
}

function formattedHoursToMinutes(value = '') {
  const raw = String(value || '').trim();
  const match = /^(\d{1,3}):(\d{2})$/.exec(raw);
  if (!match) return null;
  const minutes = Number(match[2]);
  if (minutes > 59) return null;
  return (Number(match[1]) * 60) + minutes;
}

function getLegacyQuantityMinutes(record = {}) {
  if (Number.isInteger(record.net_minutes)) return record.net_minutes;
  const formatted = formattedHoursToMinutes(record.quantidadeHorasFormatada || record.hours_formatted || '');
  if (formatted !== null) return formatted;
  const decimal = Number(record.quantidadeHoras ?? record.hours_quantity ?? 0);
  return Number.isFinite(decimal) ? Math.round(decimal * 60) : 0;
}

function getRecordTotal(record = {}) {
  return Number(record.financial_total ?? record.valorTotalCalculado ?? record.amount ?? 0) || 0;
}

export function classifyHourControlRecord(record = {}) {
  const issues = [];
  if (record?.type !== 'controle_horas') {
    return { id: record?.id || '', type: record?.type || '', classification: 'ignored', issues, wrote: false };
  }

  const startTime = record.start_time || record.horaInicial || '';
  const endTime = record.end_time || record.horaFinal || '';
  const allowCrossMidnight = Boolean(record.crosses_midnight || (startTime && endTime && endTime < startTime));
  const session = startTime && endTime
    ? CalculateWorkSession({
      occurredDate: record.occurred_date,
      startTime,
      endTime,
      breakMinutes: record.break_minutes,
      allowCrossMidnight,
      hourControlType: record.hour_control_type || record.hour_entry_type || '',
      bankNature: record.bank_nature,
      overtimePercentage: record.overtime_percentage ?? record.percentualUsado ?? 0,
      salaryBase: record.salary_base_snapshot ?? record.salary_base_reference ?? 0
    })
    : null;

  if (!record.calculation_version) addIssue(issues, 'LEGACY_FIELDS', 'Registro sem versao de calculo canonica.', 'calculation_version');
  if (startTime && endTime && endTime < startTime && !record.crosses_midnight) {
    addIssue(issues, 'POSSIBLE_NIGHT_SHIFT', 'Hora final menor que inicial indica possivel jornada noturna antiga.', 'end_time');
  }
  if (session && !session.isValid) {
    session.errors.forEach((error) => addIssue(issues, error.code, error.message, error.field));
  }
  if (session?.isValid) {
    const legacyMinutes = getLegacyQuantityMinutes(record);
    if (legacyMinutes !== session.netMinutes) {
      addIssue(issues, 'HOUR_QUANTITY_DIVERGENCE', `Quantidade persistida ${formatMinutesToClock(legacyMinutes)} diverge do calculo ${formatMinutesToClock(session.netMinutes)}.`, 'net_minutes');
    }
    const formatted = formattedHoursToMinutes(record.quantidadeHorasFormatada || record.hours_formatted || '');
    if (formatted !== null && formatted !== legacyMinutes) {
      addIssue(issues, 'HOUR_FORMAT_DIVERGENCE', 'Quantidade formatada diverge da quantidade numerica.', 'quantidadeHorasFormatada');
    }
    const type = String(record.hour_control_type || record.hour_entry_type || '');
    if (type === 'Hora Extra') {
      const baseHour = Number(record.hour_value_base ?? record.valorBaseHora ?? 0) || 0;
      const percentage = parseOvertimePercent(record.overtime_percentage ?? record.percentualUsado ?? 0);
      const expected = roundCurrency((baseHour * (1 + percentage)) * (session.netMinutes / 60));
      const persisted = roundCurrency(getRecordTotal(record));
      if (Math.abs(expected - persisted) > 0.01) {
        addIssue(issues, 'VALUE_DIVERGENCE', `Valor persistido ${persisted} diverge do esperado ${expected}.`, 'financial_total');
      }
      if ((record.overtime_percentage ?? record.percentualUsado) === undefined) {
        addIssue(issues, 'MISSING_PERCENTAGE', 'Percentual de hora extra ausente.', 'overtime_percentage');
      }
    }
  }
  if (String(record.observation || record.description || '').toUpperCase().includes('DSR')) {
    addIssue(issues, 'POSSIBLE_DSR_DUPLICATE', 'Registro pode representar DSR e exige revisao manual.', 'observation');
  }

  return {
    id: record.id || '',
    type: record.type,
    classification: issues.length ? 'review_required' : 'current',
    issues,
    wrote: false
  };
}

export function buildHourControlDryRun(records = []) {
  const source = Array.isArray(records) ? records : [];
  const analyzed = source
    .filter((record) => record?.type === 'controle_horas')
    .map(classifyHourControlRecord);
  const byClassification = analyzed.reduce((acc, item) => {
    acc[item.classification] = (acc[item.classification] || 0) + 1;
    return acc;
  }, {});

  return {
    total: analyzed.length,
    byClassification,
    analyzed,
    wrote: false
  };
}
