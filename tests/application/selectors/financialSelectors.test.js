import { describe, expect, it } from 'vitest';
import {
  selectDashboardTotals,
  selectEntryConsolidation,
  selectPdfFinancialReport,
  selectPersonBalances
} from '../../../src/application/selectors/financialSelectors.js';

describe('financial selectors', () => {
  const baseEntradas = [
    { person: 'Jadson', cardLiquido: 3000, cycleView: 'INICIO_MES' },
    { person: 'Luana', cardLiquido: 2000, cycleView: 'INICIO_MES' }
  ];

  const baseSaidas = [
    { type: 'saida', person: 'Jadson', status: 'Pago', amount: 900, cycle: 'INICIO_MES' },
    { type: 'saida', person: 'Jadson', status: 'Em aberto', amount: 300, cycle: 'INICIO_MES' },
    { type: 'saida', person: 'Luana', status: 'Pago', amount: 700, cycle: 'INICIO_MES' },
    { type: 'saida', person: 'Luana', status: 'Cancelado', amount: 999, cycle: 'INICIO_MES' }
  ];

  it('selects official dashboard totals from consolidated entries and filtered expenses', () => {
    const totals = selectDashboardTotals({ baseEntradas, baseSaidas });

    expect(totals.totalEntradas).toBe(5000);
    expect(totals.totalSaidasPagas).toBe(1600);
    expect(totals.totalAberto).toBe(300);
    expect(totals.saldoRealizado).toBe(3400);
    expect(totals.saldoProjetado).toBe(3100);
    expect(totals.aliases).toEqual(expect.objectContaining({
      receitas: 5000,
      despesas: 1600,
      emAberto: 300,
      saldoLiquido: 3100
    }));
  });

  it('selects person balances using the same bases', () => {
    const balances = selectPersonBalances({ baseEntradas, baseSaidas });

    expect(balances).toEqual([
      expect.objectContaining({ label: 'Luana', receber: 2000, pagar: 700, emAberto: 0, sobra: 1300 }),
      expect.objectContaining({ label: 'Jadson', receber: 3000, pagar: 900, emAberto: 300, sobra: 1800 })
    ]);
  });

  it('selects PDF report data with the same official totals', () => {
    const report = selectPdfFinancialReport({
      dashboardEntradas: baseEntradas,
      saidas: baseSaidas,
      focusedDashboardCard: ''
    });

    expect(report.financialEntradas).toBe(baseEntradas);
    expect(report.saidas).toBe(baseSaidas);
    expect(report.totals).toEqual(expect.objectContaining({
      receitas: 5000,
      despesas: 1600,
      emAberto: 300,
      saldoRealizado: 3400,
      saldoProjetado: 3100
    }));
  });

  it('selects entry consolidation with injected legacy-compatible adapters', () => {
    const result = selectEntryConsolidation({
      person: 'Jadson',
      competence: '2026-05',
      consolidate: (person, competence) => ({ person, competencia: competence, liquido: 3000 }),
      mapCycleView: (entry, cycle) => cycle === 'QUINZENA' ? null : ({ ...entry, cycleView: cycle, cardLiquido: entry.liquido })
    });

    expect(result.consolidated).toEqual({ person: 'Jadson', competencia: '2026-05', liquido: 3000 });
    expect(result.cycleViews).toEqual([{ person: 'Jadson', competencia: '2026-05', liquido: 3000, cycleView: 'INICIO_MES', cardLiquido: 3000 }]);
  });
});
