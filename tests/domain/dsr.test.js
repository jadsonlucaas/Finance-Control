import { describe, expect, it } from 'vitest';
import { calcularDSRHoraExtra, getDSRCalendarFactors, getFixedBrazilHolidayDates } from '../../src/domain/dsr.js';

describe('DSR calculations', () => {
  it('returns fixed Brazil holiday dates for a year', () => {
    expect(getFixedBrazilHolidayDates(2026)).toContain('2026-01-01');
    expect(getFixedBrazilHolidayDates(2026)).toContain('2026-12-25');
  });

  it('calculates business and rest days for a competence', () => {
    expect(getDSRCalendarFactors('2026-04')).toEqual({
      competenciaCalendario: '2026-04',
      diasUteis: 25,
      diasDescanso: 5
    });
  });

  it('calculates DSR value from overtime total', () => {
    expect(calcularDSRHoraExtra({
      competencia: '2026-04',
      totalHoraExtra: 1000,
      incluirLancamentoAtual: 250
    })).toEqual({
      competenciaCalendario: '2026-04',
      diasUteis: 25,
      diasDescanso: 5,
      totalHoraExtra: 1250,
      dsr: 250
    });
  });
});
