import { describe, expect, it } from 'vitest';
import {
  getMonthlyDetailEntradaLabel,
  getMonthlyDetailEntradaValue,
  selectMonthlyDetail
} from '../../../src/application/selectors/monthlyDetailSelectors.js';

describe('monthly detail selectors', () => {
  it('builds monthly detail totals from consolidated entries and expenses', () => {
    const model = selectMonthlyDetail({
      competence: '2026-05',
      consolidatedEntradas: [
        { person: 'Jadson', cardLiquido: 3000, cycleView: 'INICIO_MES' },
        { person: 'Jadson', cardLiquido: 1200, cycleView: 'QUINZENA' },
        { person: 'Luana', liquido: 2000, cycleView: 'INICIO_MES' }
      ],
      records: [
        { type: 'saida', person: 'Jadson', status: 'Pago', macro_category: 'FIXO', amount: 500 },
        { type: 'saida', person: 'Jadson', status: 'Em aberto', macro_category: 'VARIAVEL', amount: 300 },
        { type: 'saida', person: 'Luana', status: 'Pago', macro_category: 'FIXO', amount: 700 },
        { type: 'saida', person: 'Luana', status: 'Cancelado', macro_category: 'FIXO', amount: 999 }
      ]
    });

    expect(model.totals.totalEntradas).toBe(6200);
    expect(model.totals.totalSaidas).toBe(1200);
    expect(model.totals.totalAberto).toBe(300);
    expect(model.totals.sobra).toBe(5000);
    expect(model.totals.saldoProjetado).toBe(4700);
    expect(model.statusTone.text).toBe('Positivo');
    expect(model.topCategories).toEqual([{ label: 'FIXO', value: 1200 }]);
    expect(model.personFinancialSummary).toEqual([
      expect.objectContaining({ label: 'Jadson', receber: 4200, pagar: 800, sobra: 3400 }),
      expect.objectContaining({ label: 'Luana', receber: 2000, pagar: 700, sobra: 1300 })
    ]);
  });

  it('reads entry value and label from consolidated dashboard shapes', () => {
    expect(getMonthlyDetailEntradaValue({ cardLiquido: 123.456 })).toBe(123.46);
    expect(getMonthlyDetailEntradaValue({ liquido: 99.994 })).toBe(99.99);
    expect(getMonthlyDetailEntradaLabel({ receivingType: 'quinzenal', person: 'Jadson' })).toBe('quinzenal');
  });
});
