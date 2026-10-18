import { beforeEach, describe, expect, it } from 'vitest';
import {
  buildDashboardDailyExpenseTrend,
  buildDashboardMonthlyFinancialTrend
} from '../../src/ui/dashboard/dashboardData.js';

describe('dashboard chart data', () => {
  beforeEach(() => {
    globalThis.window = {
      formatCompetence: (value) => value,
      isFinancialEntradaRecord: (record) => record.type === 'entrada'
    };
  });

  it('builds monthly trend from the same consolidated bases used by dashboard cards', () => {
    const result = buildDashboardMonthlyFinancialTrend({
      entradas: [
        { person: 'Ana', competencia: '2026-05', cardLiquido: 1000 },
        { person: 'Ana', competencia: '2026-05', cardLiquido: 132.13 },
        { person: 'Ana', competencia: '2026-06', cardLiquido: 17857.1 }
      ],
      saidas: [
        { type: 'saida', competence: '2026-05', status: 'Pago', amount: 0 },
        { type: 'saida', competence: '2026-05', status: 'Em aberto', amount: 8129.42 },
        { type: 'saida', competence: '2026-06', status: 'Pago', amount: 0 },
        { type: 'saida', competence: '2026-06', status: 'Em aberto', amount: 14576.42 },
        { type: 'saida', competence: '2026-06', status: 'Cancelado', amount: 999 }
      ]
    }, ['2026-05', '2026-06']);

    expect(result.entradas).toEqual([1132.13, 17857.1]);
    expect(result.saidas).toEqual([8129.42, 14576.42]);
    expect(result.balance).toEqual([-6997.29, 3280.68]);
    expect(result.insights.currentValue).toBe(3280.68);
  });

  it('builds daily expenses from paid and open expenses in the selected month', () => {
    const result = buildDashboardDailyExpenseTrend([
      { type: 'saida', status: 'Pago', paid_at: '2026-04-15', due_date: '2026-04-10', amount: 700 },
      { type: 'saida', status: 'Em aberto', due_date: '2026-04-15', amount: 300 },
      { type: 'saida', status: 'Cancelado', due_date: '2026-04-15', amount: 999 },
      { type: 'saida', status: 'Pago', paid_at: '2026-05-15', due_date: '2026-05-15', amount: 999 }
    ], '2026-04');

    expect(result.values[14]).toBe(1000);
    expect(result.recordsByDate['2026-04-15']).toHaveLength(2);
    expect(result.insights.total).toBe(1000);
  });
});
