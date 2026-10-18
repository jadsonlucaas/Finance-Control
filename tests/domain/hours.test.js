import { describe, expect, it } from 'vitest';
import {
  CalculateDSR,
  CalculateWorkSession,
  ResolveEffectiveSalary,
  calculateBaseHourlyRateCents,
  calculateElapsedMinutes,
  calcularBancoHoras,
  calcularHoraExtra,
  calcularHoras,
  formatHoursDecimal,
  formatMinutesToClock,
  normalizeInterval,
  parseClockToMinutes,
  parseOvertimePercent,
  parseTimeToMinutes
} from '../../src/domain/hours.js';

describe('hour calculations', () => {
  it('parses and formats time values', () => {
    expect(parseTimeToMinutes('08:30')).toBe(510);
    expect(parseTimeToMinutes('invalid')).toBeNull();
    expect(parseTimeToMinutes('99:99')).toBeNull();
    expect(parseClockToMinutes('08:00')).toMatchObject({ isValid: true, minutes: 480 });
    expect(parseClockToMinutes('23:59')).toMatchObject({ isValid: true, minutes: 1439 });
    expect(parseClockToMinutes('')).toMatchObject({ isValid: false });
    expect(parseClockToMinutes('12:60')).toMatchObject({ isValid: false });
    expect(formatHoursDecimal(1.5)).toBe('01:30');
    expect(formatHoursDecimal(2.25)).toBe('02:15');
    expect(formatMinutesToClock(1500)).toBe('25:00');
  });

  it('calculates worked hours between valid times', () => {
    expect(calcularHoras('08:00', '17:30')).toMatchObject({
      quantidade: 9.5,
      quantidadeFormatada: '09:30',
      minutos: 570
    });
  });

  it('returns zeroed hours for invalid legacy ranges unless cross-midnight is enabled', () => {
    expect(calcularHoras('17:00', '08:00')).toMatchObject({
      quantidade: 0,
      quantidadeFormatada: '00:00',
      minutos: 0
    });
    expect(calcularHoras('22:00', '06:00', { allowCrossMidnight: true })).toMatchObject({
      quantidade: 8,
      quantidadeFormatada: '08:00',
      minutos: 480,
      crossesMidnight: true
    });
  });

  it('normalizes overtime percentages', () => {
    expect(parseOvertimePercent(50)).toBe(0.5);
    expect(parseOvertimePercent(0.5)).toBe(0.5);
    expect(parseOvertimePercent(-10)).toBe(0);
  });

  it('calculates overtime financial values with legacy-compatible wrappers', () => {
    expect(calcularHoraExtra({ salaryBase: 2200, quantityHours: 2, percentage: 50 })).toMatchObject({
      valorHoraNormal: 10,
      percentualAplicado: 0.5,
      adicional: 5,
      valorHoraExtra: 15,
      totalHoraExtra: 30,
      calculatedValueCents: 3000,
      netMinutes: 120
    });
    expect(calcularHoraExtra({ salaryBase: 4400, horas: 2.5, percentual: 50 })).toMatchObject({
      valorHoraNormal: 20,
      totalHoraExtra: 75
    });
  });

  it('calculates time bank debit and credit movements', () => {
    expect(calcularBancoHoras({ quantityHours: 2.5, natureza: 'Debito' })).toMatchObject({
      debito: 2.5,
      credito: 0,
      saldo: 2.5,
      minutes: 150
    });
    expect(calcularBancoHoras({ quantityHours: 1.25, natureza: 'Credito' })).toMatchObject({
      debito: 0,
      credito: 1.25,
      saldo: -1.25,
      minutes: -75
    });
  });

  it('validates normal sessions and break duration using integer minutes', () => {
    const session = CalculateWorkSession({
      occurredDate: '2026-08-21',
      startTime: '08:00',
      endTime: '17:00',
      breakMinutes: 60,
      hourControlType: 'Hora Extra',
      overtimePercentage: 50,
      salaryBase: 4400
    });
    expect(session).toMatchObject({
      isValid: true,
      grossMinutes: 540,
      breakMinutes: 60,
      netMinutes: 480,
      overtimeMinutes: 480,
      calculatedValueCents: 24000
    });
  });

  it('rejects equal times and sessions above configured limit', () => {
    expect(CalculateWorkSession({ startTime: '08:00', endTime: '08:00' })).toMatchObject({ isValid: false });
    expect(CalculateWorkSession({
      startTime: '08:00',
      endTime: '20:01',
      maxSessionMinutes: 720
    })).toMatchObject({ isValid: false });
  });

  it('supports cross-midnight sessions and derives endedDate across month and year', () => {
    expect(CalculateWorkSession({
      occurredDate: '2026-08-31',
      startTime: '22:00',
      endTime: '06:00',
      allowCrossMidnight: true
    })).toMatchObject({ isValid: true, netMinutes: 480, crossesMidnight: true, endedDate: '2026-09-01' });
    expect(CalculateWorkSession({
      occurredDate: '2026-12-31',
      startTime: '23:30',
      endTime: '01:30',
      allowCrossMidnight: true
    })).toMatchObject({ isValid: true, netMinutes: 120, endedDate: '2027-01-01' });
    expect(calculateElapsedMinutes(23 * 60, 60, false)).toMatchObject({ isValid: false, crossesMidnight: true });
    expect(calculateElapsedMinutes(23 * 60, 60, true)).toMatchObject({ isValid: true, minutes: 120 });
  });

  it('validates explicit breaks inside and outside a cross-midnight session', () => {
    expect(normalizeInterval({
      startMinutes: 20 * 60,
      endMinutes: 5 * 60,
      crossesMidnight: true,
      breakStartMinutes: 23 * 60,
      breakEndMinutes: 30
    })).toMatchObject({ isValid: true, breakMinutes: 90 });
    expect(normalizeInterval({
      startMinutes: 8 * 60,
      endMinutes: 17 * 60,
      breakStartMinutes: 7 * 60,
      breakEndMinutes: 8 * 60
    })).toMatchObject({ isValid: false });
    expect(normalizeInterval({
      startMinutes: 8 * 60,
      endMinutes: 10 * 60,
      breakMinutes: 180
    })).toMatchObject({ isValid: false });
    expect(normalizeInterval({
      startMinutes: 8 * 60,
      endMinutes: 10 * 60,
      breakMinutes: -1
    })).toMatchObject({ isValid: false });
    expect(normalizeInterval({
      startMinutes: 8 * 60,
      endMinutes: 10 * 60,
      breakMinutes: 15,
      breakStartMinutes: 8 * 60,
      breakEndMinutes: 8 * 60 + 15
    })).toMatchObject({ isValid: false });
  });

  it('handles bank nature and invalid percentages in the canonical engine', () => {
    expect(CalculateWorkSession({
      startTime: '08:00',
      endTime: '10:00',
      hourControlType: 'Banco de Horas',
      bankNature: 'credito'
    })).toMatchObject({ isValid: true, bankMinutes: -120 });
    expect(CalculateWorkSession({
      startTime: '08:00',
      endTime: '10:00',
      hourControlType: 'Banco de Horas',
      bankNature: 'debito'
    })).toMatchObject({ isValid: true, bankMinutes: 120 });
    expect(CalculateWorkSession({
      startTime: '08:00',
      endTime: '10:00',
      hourControlType: 'Banco de Horas',
      bankNature: 'outro'
    })).toMatchObject({ isValid: false });
    expect(CalculateWorkSession({
      startTime: '08:00',
      endTime: '10:00',
      hourControlType: 'Hora Extra',
      overtimePercentage: -1,
      salaryBase: 4400
    })).toMatchObject({ isValid: false });
  });

  it('resolves effective salary by competence without using current salary silently', () => {
    const salaryHistory = [
      { id: 'old', type: 'salario_historico', person: 'Ana', salary_base: 4000, vigencia_inicio: '2026-01', vigencia_fim: '2026-06' },
      { id: 'new', type: 'salario_historico', person: 'Ana', salary_base: 5000, vigencia_inicio: '2026-07' }
    ];
    expect(ResolveEffectiveSalary({ person: 'Ana', competence: '2026-05', salaryHistory })).toMatchObject({
      isValid: true,
      salary: 4000,
      sourceRecordId: 'old'
    });
    expect(ResolveEffectiveSalary({ person: 'Ana', competence: '2026-08', salaryHistory })).toMatchObject({
      isValid: true,
      salary: 5000,
      sourceRecordId: 'new'
    });
    expect(ResolveEffectiveSalary({ person: 'Ana', competence: '2025-12', salaryHistory })).toMatchObject({
      isValid: false
    });
    expect(calculateBaseHourlyRateCents({ salaryBase: 4400 })).toBe(2000);
  });

  it('calculates DSR without duplicating a holiday that falls on Sunday', () => {
    const noOvertime = CalculateDSR({ competence: '2026-04', overtimeBase: 0 });
    expect(noOvertime).toMatchObject({ isValid: true, dsrValue: 0 });
    const withHoliday = CalculateDSR({ competence: '2026-04', overtimeBase: 100, holidayDates: ['2026-04-21', '2026-04-21'] });
    expect(withHoliday.breakdown.restDays).toBe(5);
    expect(withHoliday.dsrValue).toBe(20);
    const octoberBase = CalculateDSR({ competence: '2026-10', overtimeBase: 100 });
    const sundayHoliday = CalculateDSR({ competence: '2026-10', overtimeBase: 100, holidayDates: ['2026-10-04', '2026-10-04'] });
    expect(sundayHoliday.breakdown.restDays).toBe(octoberBase.breakdown.restDays);
  });

  it('does not depend on DOM, window or source_channel', () => {
    const base = {
      startTime: '22:00',
      endTime: '06:00',
      allowCrossMidnight: true,
      hourControlType: 'Hora Extra',
      overtimePercentage: 50,
      salaryBase: 4400
    };
    expect(CalculateWorkSession(base)).toEqual(CalculateWorkSession({ ...base, source_channel: 'future_integration' }));
  });
});
