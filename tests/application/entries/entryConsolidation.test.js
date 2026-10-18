import { describe, expect, it } from 'vitest';
import {
  consolidatePersonMonthlyEntry,
  getConsolidatedMonthlyEntries,
  getEntryCycleViews,
  getEntryDiscountRecordTotal,
  mapEntryToCycleView
} from '../../../src/application/entries/index.js';

const records = [
  { id: 'person', type: 'pessoa', person: 'Jadson', receiving_type: 'quinzenal', salary_base: 5300 },
  { id: 'bonus', type: 'entrada', person: 'Jadson', competence: '2026-04', macro_category: 'Receita', subcategory: 'Bônus', amount: 200 },
  {
    id: 'manual-discount',
    type: 'entrada',
    person: 'Jadson',
    competence: '2026-04',
    macro_category: 'Dedução',
    entry_discount_adjustment: true,
    entry_discount_cycle: 'INICIO_MES',
    amount: 396,
    entry_discount_history: [
      { amount: 300, observation: 'falta', saved_at: '2026-04-18T15:51:00.000Z' },
      { amount: 96, observation: 'Drogaria', saved_at: '2026-04-18T15:54:00.000Z' }
    ]
  },
  {
    id: 'quinzena-discount',
    type: 'entrada',
    person: 'Jadson',
    competence: '2026-04',
    macro_category: 'Dedução',
    entry_discount_adjustment: true,
    entry_discount_cycle: 'QUINZENA',
    amount: 50
  },
  { id: 'hour-extra', type: 'controle_horas', person: 'Jadson', competence: '2026-04', hour_entry_type: 'Hora Extra', financial_total: 900.59 }
];

describe('entry application consolidation', () => {
  it('consolidates salary, overtime, DSR, taxes, quinzenal advance and discount history from one official source', () => {
    const consolidated = consolidatePersonMonthlyEntry('Jadson', '2026-04', {
      records,
      salaryInfo: { salario: 5300 },
      banco: { saldoAtual: 0 },
      receivingType: 'quinzenal',
      dsrInfo: { dsr: 173.19, diasUteis: 26, diasDescanso: 5, totalHoraExtra: 900.59, competenciaCalendario: '2026-03' },
      calculateInss: () => 757.68,
      calculateIrrf: () => 691.8
    });

    expect(getEntryDiscountRecordTotal(records[2])).toBe(396);
    expect(consolidated).toMatchObject({
      person: 'Jadson',
      competencia: '2026-04',
      salaryBase: 5300,
      hourExtra: 900.59,
      dsrHoraExtra: 173.19,
      outrosProventos: 200,
      baseTotal: 6573.78,
      inss: 757.68,
      irrf: 691.8,
      outrosDescontosManuais: 446,
      adiantamentoQuinzena: 2120,
      outrosDescontos: 2566,
      receivingType: 'quinzenal'
    });
    expect(consolidated.liquido).toBe(2558.3);
  });

  it('maps entry cycle views using the same discount history totals', () => {
    const consolidated = {
      person: 'Jadson',
      competencia: '2026-04',
      receivingType: 'quinzenal',
      salaryBase: 5300,
      hourExtra: 900.59,
      outrosProventos: 200,
      liquido: 3458.3,
      outrosDescontos: 2566,
      inss: 757.68,
      irrf: 691.8,
      adiantamentoQuinzena: 2120
    };

    expect(mapEntryToCycleView(consolidated, 'INICIO_MES', { records })).toMatchObject({
      cycle: 'INICIO_MES',
      cycleView: 'INICIO_MES',
      cardOutrosProventos: 200,
      cardDescontos: 2566,
      cycleDiscountValue: 396
    });
    expect(mapEntryToCycleView(consolidated, 'QUINZENA', { records })).toMatchObject({
      cycle: 'QUINZENA',
      cycleView: 'QUINZENA',
      cardSalaryBase: 2120,
      cardOutrosProventos: 0,
      cardLiquido: 2070,
      cardDescontos: 50
    });
    expect(getEntryCycleViews(consolidated, { records })).toHaveLength(2);
  });

  it('keeps entries that only have other revenues visible', () => {
    const entries = getConsolidatedMonthlyEntries({
      records: [
        { id: 'only-other-income', type: 'entrada', person: 'Luana', competence: '2026-04', macro_category: 'Receita', subcategory: 'Freelance', amount: 100 }
      ],
      target: { thisMonth: '2026-04' }
    });

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      person: 'Luana',
      competencia: '2026-04',
      salaryBase: 0,
      hourExtra: 0,
      outrosProventos: 100
    });
  });
});
