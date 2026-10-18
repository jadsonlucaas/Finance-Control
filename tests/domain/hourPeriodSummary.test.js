import { describe, expect, it } from 'vitest';
import { buildHourPeriodSummary } from '../../src/domain/hourPeriodSummary.js';

describe('hour period summary', () => {
  it('summarizes overtime and bank hours inside the selected period', () => {
    const summary = buildHourPeriodSummary([
      {
        type: 'controle_horas',
        person: 'Jadson',
        competence: '2026-03',
        hour_control_type: 'Banco de Horas',
        bank_nature: 'Debito',
        quantidadeHoras: 2
      },
      {
        type: 'controle_horas',
        person: 'Jadson',
        competence: '2026-04',
        hour_control_type: 'Hora Extra',
        quantidadeHoras: 2.5,
        valorTotalCalculado: 120
      },
      {
        type: 'controle_horas',
        person: 'Jadson',
        competence: '2026-04',
        hour_control_type: 'Banco de Horas',
        bank_nature: 'Debito',
        quantidadeHoras: 1.25
      },
      {
        type: 'controle_horas',
        person: 'Luana',
        competence: '2026-04',
        hour_control_type: 'Banco de Horas',
        bank_nature: 'Credito',
        quantidadeHoras: 0.5
      },
      {
        type: 'controle_horas',
        person: 'Luana',
        competence: '2026-03',
        hour_control_type: 'Banco de Horas',
        bank_nature: 'Credito',
        quantidadeHoras: 0.25
      },
      {
        type: 'controle_horas',
        person: 'Jadson',
        competence: '2026-05',
        hour_control_type: 'Hora Extra',
        quantidadeHoras: 10,
        valorTotalCalculado: 999
      }
    ], {
      start: '2026-04',
      end: '2026-04'
    });

    expect(summary).toMatchObject({
      overtimeHours: 2.5,
      overtimeAmount: 120,
      openingBankHours: 1.75,
      bankDebitHours: 1.25,
      bankCreditHours: 0.5,
      bankPeriodNetHours: 0.75,
      bankNetHours: 2.5,
      recordsCount: 3,
      peopleCount: 2
    });
    expect(summary.byPerson).toEqual([
      expect.objectContaining({
        person: 'Jadson',
        overtimeHours: 2.5,
        openingBankHours: 2,
        bankDebitHours: 1.25,
        bankCreditHours: 0,
        bankPeriodNetHours: 1.25,
        bankNetHours: 3.25
      }),
      expect.objectContaining({
        person: 'Luana',
        overtimeHours: 0,
        openingBankHours: -0.25,
        bankDebitHours: 0,
        bankCreditHours: 0.5,
        bankPeriodNetHours: -0.5,
        bankNetHours: -0.75
      })
    ]);
  });

  it('respects the selected person filter', () => {
    const summary = buildHourPeriodSummary([
      { type: 'controle_horas', person: 'Jadson', competence: '2026-04', hour_control_type: 'Hora Extra', quantidadeHoras: 2 },
      { type: 'controle_horas', person: 'Luana', competence: '2026-04', hour_control_type: 'Hora Extra', quantidadeHoras: 5 }
    ], {
      start: '2026-04',
      end: '2026-04',
      person: 'Luana'
    });

    expect(summary.overtimeHours).toBe(5);
    expect(summary.peopleCount).toBe(1);
    expect(summary.byPerson[0].person).toBe('Luana');
  });
});
