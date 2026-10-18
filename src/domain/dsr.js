import { normalizeCompetenceKey } from '../core/dates.js';
import { roundCurrency } from '../core/money.js';

export function getFixedBrazilHolidayDates(year) {
  return [
    `${year}-01-01`,
    `${year}-04-21`,
    `${year}-05-01`,
    `${year}-09-07`,
    `${year}-10-12`,
    `${year}-11-02`,
    `${year}-11-15`,
    `${year}-12-25`
  ];
}

export function getDSRCalendarFactors(competencia = '', holidayDates = []) {
  const normalized = normalizeCompetenceKey(competencia);
  if (!normalized) {
    return {
      competenciaCalendario: '',
      diasUteis: 0,
      diasDescanso: 0
    };
  }

  const [year, month] = normalized.split('-').map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  const holidays = new Set([
    ...getFixedBrazilHolidayDates(year),
    ...holidayDates
  ]);
  let diasUteis = 0;
  let diasDescanso = 0;

  for (let day = 1; day <= lastDay; day += 1) {
    const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const weekDay = new Date(`${date}T00:00:00`).getDay();
    if (weekDay === 0 || holidays.has(date)) {
      diasDescanso += 1;
    } else {
      diasUteis += 1;
    }
  }

  return {
    competenciaCalendario: normalized,
    diasUteis,
    diasDescanso
  };
}

export function calcularDSRHoraExtra({
  competencia = '',
  totalHoraExtra = 0,
  incluirLancamentoAtual = 0,
  holidayDates = []
} = {}) {
  const dsrInfo = getDSRCalendarFactors(competencia, holidayDates);
  const total = roundCurrency((Number(totalHoraExtra) || 0) + (Number(incluirLancamentoAtual) || 0));
  const dsr = dsrInfo.diasUteis > 0
    ? roundCurrency((total / dsrInfo.diasUteis) * dsrInfo.diasDescanso)
    : 0;

  return {
    ...dsrInfo,
    totalHoraExtra: total,
    dsr
  };
}
