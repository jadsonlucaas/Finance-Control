import { normalizeCompetenceKey } from '../core/dates.js';
import { roundCurrency } from '../core/money.js';
import {
  calcularDSRHoraExtra,
  getDSRCalendarFactors,
  getFixedBrazilHolidayDates
} from './dsr.js';

export const WORK_SESSION_CALCULATION_VERSION = 1;
export const DEFAULT_MONTHLY_HOURS = 220;
export const DEFAULT_MAX_SESSION_MINUTES = 24 * 60;
export const HOUR_CONTROL_TYPE = Object.freeze({
  OVERTIME: 'Hora Extra',
  BANK: 'Banco de Horas',
  ADJUSTMENT: 'Ajuste',
  TIME_OFF: 'Folga'
});

function issue(code, message, field = '') {
  return { code, message, field };
}

function toInteger(value) {
  const numeric = Number(value);
  return Number.isInteger(numeric) ? numeric : null;
}

export function parseClockToMinutes(value) {
  if (typeof value !== 'string' || value.trim() === '') {
    return { isValid: false, minutes: null, errors: [issue('TIME_REQUIRED', 'Hora obrigatoria.')] };
  }

  const normalized = value.trim();
  const match = /^(\d{2}):(\d{2})$/.exec(normalized);
  if (!match) {
    return { isValid: false, minutes: null, errors: [issue('INVALID_TIME_FORMAT', 'Use o formato HH:MM.')] };
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23) {
    return { isValid: false, minutes: null, errors: [issue('INVALID_HOUR', 'Hora deve estar entre 00 e 23.')] };
  }
  if (minutes < 0 || minutes > 59) {
    return { isValid: false, minutes: null, errors: [issue('INVALID_MINUTE', 'Minuto deve estar entre 00 e 59.')] };
  }

  return { isValid: true, minutes: (hours * 60) + minutes, errors: [] };
}

export function parseTimeToMinutes(value) {
  const parsed = parseClockToMinutes(value);
  return parsed.isValid ? parsed.minutes : null;
}

export function formatMinutesToClock(minutes = 0) {
  const total = toInteger(minutes);
  if (total === null || total < 0) return '00:00';
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  return `${String(hours).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
}

export function formatHoursDecimal(hoursDecimal) {
  return formatMinutesToClock(Math.round((Number(hoursDecimal) || 0) * 60));
}

export function parseOvertimePercent(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return 0;
  return numeric > 1 ? numeric / 100 : numeric;
}

function parsePercentage(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) return null;
  return numeric > 1 ? numeric / 100 : numeric;
}

export function calculateElapsedMinutes(startMinutes, endMinutes, allowCrossMidnight = false, maxSessionMinutes = DEFAULT_MAX_SESSION_MINUTES) {
  const start = toInteger(startMinutes);
  const end = toInteger(endMinutes);
  const limit = toInteger(maxSessionMinutes) || DEFAULT_MAX_SESSION_MINUTES;
  const errors = [];

  if (start === null || end === null || start < 0 || start > 1439 || end < 0 || end > 1439) {
    return { isValid: false, minutes: 0, crossesMidnight: false, errors: [issue('INVALID_TIME', 'Horario fora da faixa permitida.')] };
  }
  if (start === end) {
    return { isValid: false, minutes: 0, crossesMidnight: false, errors: [issue('ZERO_DURATION', 'Hora inicial e final nao podem ser iguais.')] };
  }

  const crossesMidnight = end < start;
  if (crossesMidnight && !allowCrossMidnight) {
    return { isValid: false, minutes: 0, crossesMidnight: true, errors: [issue('CROSS_MIDNIGHT_NOT_ALLOWED', 'Jornada atravessando meia-noite nao permitida para esta operacao.')] };
  }

  const minutes = crossesMidnight ? (1440 - start) + end : end - start;
  if (minutes <= 0) errors.push(issue('NEGATIVE_DURATION', 'Duracao invalida.'));
  if (minutes > limit) errors.push(issue('SESSION_LIMIT_EXCEEDED', 'Duracao acima do limite configurado.'));

  return {
    isValid: errors.length === 0,
    minutes: errors.length ? 0 : minutes,
    crossesMidnight,
    errors
  };
}

function normalizeTimeWithinSession(minutes, sessionStart, crossesMidnight) {
  if (minutes < sessionStart && crossesMidnight) return minutes + 1440;
  return minutes;
}

export function normalizeInterval({
  startMinutes = 0,
  endMinutes = 0,
  crossesMidnight = false,
  breakStartMinutes = null,
  breakEndMinutes = null,
  breakMinutes = null
} = {}) {
  const errors = [];
  const hasDurationBreak = breakMinutes !== null && breakMinutes !== undefined && breakMinutes !== '';
  const hasExplicitBreak = breakStartMinutes !== null && breakStartMinutes !== undefined && breakEndMinutes !== null && breakEndMinutes !== undefined;
  const grossMinutes = crossesMidnight ? (1440 - startMinutes) + endMinutes : endMinutes - startMinutes;

  if (hasDurationBreak && hasExplicitBreak) {
    return { isValid: false, breakMinutes: 0, errors: [issue('BREAK_MODE_CONFLICT', 'Informe intervalo por horario ou por duracao, nao ambos.')] };
  }

  if (hasDurationBreak) {
    const duration = toInteger(breakMinutes);
    if (duration === null || duration < 0) errors.push(issue('INVALID_BREAK_DURATION', 'Intervalo deve ser inteiro e nao negativo.', 'breakMinutes'));
    if (duration > grossMinutes) errors.push(issue('BREAK_EXCEEDS_SESSION', 'Intervalo nao pode exceder a jornada.', 'breakMinutes'));
    return { isValid: errors.length === 0, breakMinutes: errors.length ? 0 : duration, errors };
  }

  if (!hasExplicitBreak) return { isValid: true, breakMinutes: 0, errors: [] };

  let breakStart = normalizeTimeWithinSession(breakStartMinutes, startMinutes, crossesMidnight);
  let breakEnd = normalizeTimeWithinSession(breakEndMinutes, startMinutes, crossesMidnight);
  const sessionStart = startMinutes;
  const sessionEnd = sessionStart + grossMinutes;

  if (breakEnd < breakStart && crossesMidnight) breakEnd += 1440;
  if (breakEnd < breakStart) errors.push(issue('NEGATIVE_BREAK', 'Fim do intervalo deve ser maior que o inicio.', 'breakEndTime'));
  if (breakStart < sessionStart || breakEnd > sessionEnd) {
    errors.push(issue('BREAK_OUTSIDE_SESSION', 'Intervalo deve estar contido na jornada.', 'breakStartTime'));
  }

  const duration = breakEnd - breakStart;
  if (duration < 0) errors.push(issue('NEGATIVE_BREAK', 'Intervalo negativo rejeitado.', 'breakMinutes'));
  if (duration > grossMinutes) errors.push(issue('BREAK_EXCEEDS_SESSION', 'Intervalo nao pode exceder a jornada.', 'breakMinutes'));

  return { isValid: errors.length === 0, breakMinutes: errors.length ? 0 : duration, errors };
}

export function validateWorkInterval(input = {}) {
  return CalculateWorkSession(input);
}

function normalizeBankNature(value = '') {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized.startsWith('d')) return 'debito';
  if (normalized.startsWith('c')) return 'credito';
  if (normalized === 'neutro' || normalized === '') return 'neutro';
  return '';
}

export function calculateBaseHourlyRateCents({ salaryCents = 0, salaryBase = 0, monthlyHours = DEFAULT_MONTHLY_HOURS } = {}) {
  const divisor = Number(monthlyHours) || DEFAULT_MONTHLY_HOURS;
  const cents = Number.isInteger(salaryCents) && salaryCents > 0 ? salaryCents : Math.round((Number(salaryBase) || 0) * 100);
  if (cents <= 0 || divisor <= 0) return 0;
  return Math.round(cents / divisor);
}

export function CalculateWorkSession(input = {}) {
  const errors = [];
  const warnings = [];
  const start = parseClockToMinutes(input.startTime ?? input.horaInicial ?? '');
  const end = parseClockToMinutes(input.endTime ?? input.horaFinal ?? '');

  if (!start.isValid) errors.push(...start.errors.map((item) => ({ ...item, field: 'startTime' })));
  if (!end.isValid) errors.push(...end.errors.map((item) => ({ ...item, field: 'endTime' })));
  if (errors.length) return createInvalidWorkSession(errors, warnings);

  const elapsed = calculateElapsedMinutes(
    start.minutes,
    end.minutes,
    input.allowCrossMidnight === true,
    input.maxSessionMinutes || DEFAULT_MAX_SESSION_MINUTES
  );
  if (!elapsed.isValid) return createInvalidWorkSession(elapsed.errors, warnings, elapsed.crossesMidnight);

  let explicitBreakStart = null;
  let explicitBreakEnd = null;
  if (input.breakStartTime) {
    const parsed = parseClockToMinutes(input.breakStartTime);
    if (!parsed.isValid) errors.push(...parsed.errors.map((item) => ({ ...item, field: 'breakStartTime' })));
    explicitBreakStart = parsed.minutes;
  }
  if (input.breakEndTime) {
    const parsed = parseClockToMinutes(input.breakEndTime);
    if (!parsed.isValid) errors.push(...parsed.errors.map((item) => ({ ...item, field: 'breakEndTime' })));
    explicitBreakEnd = parsed.minutes;
  }
  if ((input.breakStartTime && !input.breakEndTime) || (!input.breakStartTime && input.breakEndTime)) {
    errors.push(issue('BREAK_PAIR_REQUIRED', 'Inicio e fim do intervalo devem ser informados juntos.', 'breakStartTime'));
  }
  if (errors.length) return createInvalidWorkSession(errors, warnings, elapsed.crossesMidnight);

  const interval = normalizeInterval({
    startMinutes: start.minutes,
    endMinutes: end.minutes,
    crossesMidnight: elapsed.crossesMidnight,
    breakStartMinutes: explicitBreakStart,
    breakEndMinutes: explicitBreakEnd,
    breakMinutes: input.breakMinutes
  });
  if (!interval.isValid) return createInvalidWorkSession(interval.errors, warnings, elapsed.crossesMidnight);

  const grossMinutes = elapsed.minutes;
  const netMinutes = grossMinutes - interval.breakMinutes;
  if (netMinutes < 0) {
    return createInvalidWorkSession([issue('NEGATIVE_NET_DURATION', 'Duracao liquida nao pode ser negativa.')], warnings, elapsed.crossesMidnight);
  }

  const hourControlType = input.hourControlType || input.hour_control_type || input.hourEntryType || '';
  const percentage = parsePercentage(input.overtimePercentage ?? input.percentual ?? input.percentage ?? 0);
  if (percentage === null) {
    return createInvalidWorkSession([issue('INVALID_PERCENTAGE', 'Percentual de hora extra invalido.', 'overtimePercentage')], warnings, elapsed.crossesMidnight);
  }

  const baseHourlyRateCents = Number.isInteger(input.baseHourlyRateCents)
    ? input.baseHourlyRateCents
    : calculateBaseHourlyRateCents({
      salaryBase: input.salaryBase,
      salaryCents: input.salaryCents,
      monthlyHours: input.monthlyHours || input.monthly_hours_reference || DEFAULT_MONTHLY_HOURS
    });
  const isOvertime = String(hourControlType).trim() === HOUR_CONTROL_TYPE.OVERTIME;
  const isBank = String(hourControlType).trim() === HOUR_CONTROL_TYPE.BANK;
  let overtimeMinutes = 0;
  let bankMinutes = 0;
  let calculatedValueCents = 0;

  if (isOvertime) {
    overtimeMinutes = netMinutes;
    calculatedValueCents = Math.round((baseHourlyRateCents * (1 + percentage) * netMinutes) / 60);
  } else if (isBank) {
    const nature = normalizeBankNature(input.bankNature ?? input.bank_nature ?? 'debito');
    if (!nature || nature === 'neutro') {
      return createInvalidWorkSession([issue('INVALID_BANK_NATURE', 'Natureza do banco de horas invalida.', 'bankNature')], warnings, elapsed.crossesMidnight);
    }
    bankMinutes = nature === 'debito' ? netMinutes : -netMinutes;
  }

  return {
    isValid: true,
    grossMinutes,
    breakMinutes: interval.breakMinutes,
    netMinutes,
    regularMinutes: isOvertime || isBank ? 0 : netMinutes,
    overtimeMinutes,
    bankMinutes,
    crossesMidnight: elapsed.crossesMidnight,
    calculatedValueCents,
    baseHourlyRateCents,
    overtimePercentage: percentage,
    endedDate: deriveEndedDate(input.occurredDate, elapsed.crossesMidnight),
    warnings,
    errors: [],
    calculationVersion: WORK_SESSION_CALCULATION_VERSION
  };
}

function createInvalidWorkSession(errors = [], warnings = [], crossesMidnight = false) {
  return {
    isValid: false,
    grossMinutes: 0,
    breakMinutes: 0,
    netMinutes: 0,
    regularMinutes: 0,
    overtimeMinutes: 0,
    bankMinutes: 0,
    crossesMidnight,
    calculatedValueCents: 0,
    baseHourlyRateCents: 0,
    overtimePercentage: 0,
    warnings,
    errors,
    calculationVersion: WORK_SESSION_CALCULATION_VERSION
  };
}

function deriveEndedDate(occurredDate = '', crossesMidnight = false) {
  if (!crossesMidnight || !/^\d{4}-\d{2}-\d{2}$/.test(occurredDate)) return occurredDate || '';
  const date = new Date(`${occurredDate}T00:00:00`);
  date.setDate(date.getDate() + 1);
  return date.toISOString().slice(0, 10);
}

export function calcularHoras(horaInicial = '', horaFinal = '', options = {}) {
  const session = CalculateWorkSession({
    startTime: horaInicial,
    endTime: horaFinal,
    allowCrossMidnight: options.allowCrossMidnight === true,
    breakMinutes: options.breakMinutes,
    breakStartTime: options.breakStartTime,
    breakEndTime: options.breakEndTime,
    maxSessionMinutes: options.maxSessionMinutes
  });
  if (!session.isValid) {
    return { quantidade: 0, quantidadeFormatada: '00:00', minutos: 0, errors: session.errors };
  }
  return {
    quantidade: roundCurrency(session.netMinutes / 60),
    quantidadeFormatada: formatMinutesToClock(session.netMinutes),
    minutos: session.netMinutes,
    grossMinutes: session.grossMinutes,
    breakMinutes: session.breakMinutes,
    crossesMidnight: session.crossesMidnight
  };
}

export function calcularHoraExtra(input = {}) {
  const quantityHours = Number(input.quantityHours ?? input.horas ?? 0) || 0;
  const netMinutes = Number.isInteger(input.netMinutes) ? input.netMinutes : Math.round(quantityHours * 60);
  const salaryBase = Number(input.salaryBase ?? input.salarioBase ?? 0) || 0;
  const percentage = parseOvertimePercent(input.percentage ?? input.percentual ?? input.overtimePercentage ?? 0);
  const baseHourlyRateCents = Number.isInteger(input.baseHourlyRateCents)
    ? input.baseHourlyRateCents
    : calculateBaseHourlyRateCents({ salaryBase, monthlyHours: input.monthlyHours || DEFAULT_MONTHLY_HOURS });
  const valorHoraNormal = roundCurrency(baseHourlyRateCents / 100);
  const adicional = roundCurrency(valorHoraNormal * percentage);
  const valorHoraExtra = roundCurrency(valorHoraNormal + adicional);
  const calculatedValueCents = Math.round((baseHourlyRateCents * (1 + percentage) * netMinutes) / 60);
  const totalHoraExtra = roundCurrency(calculatedValueCents / 100);

  const result = {
    valorHoraNormal,
    percentualAplicado: percentage,
    adicional,
    valorHoraExtra,
    totalHoraExtra
  };
  Object.defineProperties(result, {
    baseHourlyRateCents: { value: baseHourlyRateCents, enumerable: false },
    calculatedValueCents: { value: calculatedValueCents, enumerable: false },
    netMinutes: { value: netMinutes, enumerable: false }
  });
  return result;
}

export function calcularBancoHoras({ quantityHours = 0, horas = undefined, netMinutes = undefined, natureza = 'Debito' } = {}) {
  const minutes = Number.isInteger(netMinutes) ? netMinutes : Math.round((Number(horas ?? quantityHours) || 0) * 60);
  const hours = roundCurrency(minutes / 60);
  const isDebito = normalizeBankNature(natureza) === 'debito';
  const result = {
    debito: isDebito ? hours : 0,
    credito: isDebito ? 0 : hours,
    saldo: roundCurrency(isDebito ? hours : -hours)
  };
  Object.defineProperty(result, 'minutes', { value: isDebito ? minutes : -minutes, enumerable: false });
  return result;
}

function normalizeSalaryDate(value = '') {
  const raw = String(value || '').trim();
  if (/^\d{4}-\d{2}$/.test(raw)) return raw;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw.slice(0, 7);
  return '';
}

export function ResolveEffectiveSalary({ person = '', competence = '', date = '', salaryHistory = [], personRecord = null } = {}) {
  const target = normalizeCompetenceKey(competence || date);
  const name = String(person || '').trim();
  const warnings = [];
  if (!name) {
    return { isValid: false, salary: 0, salaryCents: 0, sourceRecordId: '', validFrom: '', warnings, errors: [issue('PERSON_REQUIRED', 'Pessoa obrigatoria.')] };
  }
  if (!target) {
    return { isValid: false, salary: 0, salaryCents: 0, sourceRecordId: '', validFrom: '', warnings, errors: [issue('COMPETENCE_REQUIRED', 'Competencia obrigatoria.')] };
  }

  const history = (Array.isArray(salaryHistory) ? salaryHistory : [])
    .filter((record) => record?.type === 'salario_historico' && String(record.person || '').trim() === name)
    .map((record) => {
      const start = normalizeSalaryDate(record.vigencia_inicio || record.start_date || record.competence || '');
      const end = normalizeSalaryDate(record.vigencia_fim || record.end_date || '');
      return { record, start, end, salary: Number(record.salary_base ?? record.amount ?? 0) || 0 };
    })
    .filter((item) => item.salary > 0 && item.start && item.start <= target && (!item.end || item.end >= target))
    .sort((a, b) => b.start.localeCompare(a.start));

  const match = history[0];
  if (match) {
    return {
      isValid: true,
      salary: roundCurrency(match.salary),
      salaryCents: Math.round(match.salary * 100),
      sourceRecordId: match.record.id || '',
      validFrom: match.start,
      validTo: match.end,
      warnings,
      errors: []
    };
  }

  const fallbackSalary = Number(personRecord?.salary_base ?? personRecord?.amount ?? 0) || 0;
  if (fallbackSalary > 0) {
    warnings.push(issue('SALARY_HISTORY_MISSING', 'Historico salarial ausente; usando salario da pessoa.', 'salaryHistory'));
    return {
      isValid: true,
      salary: roundCurrency(fallbackSalary),
      salaryCents: Math.round(fallbackSalary * 100),
      sourceRecordId: personRecord?.id || '',
      validFrom: '',
      validTo: '',
      warnings,
      errors: []
    };
  }

  return {
    isValid: false,
    salary: 0,
    salaryCents: 0,
    sourceRecordId: '',
    validFrom: '',
    warnings,
    errors: [issue('SALARY_NOT_FOUND', 'Salario vigente nao encontrado.', 'salaryHistory')]
  };
}

export function CalculateDSR(input = {}) {
  const result = calcularDSRHoraExtra({
    competencia: input.competence ?? input.competencia ?? '',
    totalHoraExtra: input.overtimeBase ?? input.totalHoraExtra ?? 0,
    incluirLancamentoAtual: input.includeCurrentAmount ?? input.incluirLancamentoAtual ?? 0,
    holidayDates: input.holidayDates ?? []
  });
  return {
    isValid: true,
    dsrValue: result.dsr,
    dsrValueCents: Math.round(result.dsr * 100),
    breakdown: {
      competence: result.competenciaCalendario,
      workedDays: result.diasUteis,
      restDays: result.diasDescanso,
      overtimeBase: result.totalHoraExtra
    },
    warnings: [],
    errors: [],
    calculationVersion: WORK_SESSION_CALCULATION_VERSION
  };
}

export function createWorkSessionEngine() {
  return {
    WORK_SESSION_CALCULATION_VERSION,
    DEFAULT_MONTHLY_HOURS,
    DEFAULT_MAX_SESSION_MINUTES,
    HOUR_CONTROL_TYPE,
    parseClockToMinutes,
    parseTimeToMinutes,
    formatMinutesToClock,
    formatHoursDecimal,
    normalizeInterval,
    calculateElapsedMinutes,
    validateWorkInterval,
    CalculateWorkSession,
    CalculateDSR,
    getDSRCalendarFactors,
    getFixedBrazilHolidayDates,
    calcularDSRHoraExtra,
    parseOvertimePercent,
    calcularHoras,
    calcularHoraExtra,
    calcularBancoHoras,
    calculateBaseHourlyRateCents,
    ResolveEffectiveSalary
  };
}
