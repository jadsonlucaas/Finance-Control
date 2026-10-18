import { describe, expect, it } from 'vitest';
import {
  addDashboardAggregationItem,
  buildDashboardEntradasSummary,
  buildDashboardExpenseAggregations,
  buildDashboardPersonBalances,
  dashboardAggregationItems
} from '../../src/domain/dashboard.js';

describe('dashboard aggregations', () => {
  it('adds aggregation values and keeps source records', () => {
    const values = {};
    const records = {};
    const record = { id: '1', amount: 10.237 };

    addDashboardAggregationItem(values, records, 'Mercado', record, record.amount);
    addDashboardAggregationItem(values, records, 'Mercado', { id: '2', amount: 5 }, 5);

    expect(values).toEqual({ Mercado: 15.24 });
    expect(records.Mercado).toHaveLength(2);
  });

  it('returns sorted dashboard aggregation items', () => {
    expect(dashboardAggregationItems(
      { Mercado: 100, Casa: 250, Vazio: 0 },
      { Mercado: [{ id: '1' }], Casa: [{ id: '2' }] }
    )).toEqual([
      { label: 'Casa', value: 250, records: [{ id: '2' }] },
      { label: 'Mercado', value: 100, records: [{ id: '1' }] }
    ]);
  });

  it('builds expense aggregations by category, subcategory and person', () => {
    const records = [
      { id: '1', amount: 100, macro_category: 'FIXO', subcategory: 'Aluguel', person: 'Ana' },
      { id: '2', amount: 50.555, macro_category: 'VARIAVEL', category_name: 'Mercado', person: 'Bruno' },
      { id: '3', amount: 10, macro_category: 'VARIAVEL', description: 'Padaria', person: '' }
    ];

    const result = buildDashboardExpenseAggregations(records);

    expect(result.total).toBe(160.56);
    expect(result.porCategoria).toEqual({
      FIXO: 100,
      VARIAVEL: 60.56
    });
    expect(result.porSubcategoria).toEqual({
      Aluguel: 100,
      Mercado: 50.56,
      Padaria: 10
    });
    expect(result.porPessoa).toEqual({
      Ana: 100,
      Bruno: 50.56,
      'Sem pessoa': 10
    });
  });

  it('builds entradas summary by person, cycle and receiving type', () => {
    const entradas = [
      { person: 'Ana', cycleView: 'INICIO_MES', receivingType: 'Mensal', cardLiquido: 1000 },
      { person: 'Ana', cycleView: 'QUINZENA', receivingType: 'Quinzenal', liquido: 400 },
      { person: 'Bruno', cycleView: 'INICIO_MES', receivingType: 'Mensal', cardLiquido: 700.555 }
    ];

    expect(buildDashboardEntradasSummary(entradas)).toMatchObject({
      totalEntradas: 2100.56,
      porPessoa: { Ana: 1400, Bruno: 700.56 },
      porCiclo: { INICIO_MES: 1700.56, QUINZENA: 400 },
      porTipoEntrada: { Mensal: 1700.56, Quinzenal: 400 }
    });
  });

  it('builds person balances from entradas and saidas', () => {
    const balances = buildDashboardPersonBalances(
      [
        { person: 'Ana', cycleView: 'INICIO_MES', cardLiquido: 1000 },
        { person: 'Ana', cycleView: 'QUINZENA', cardLiquido: 500 }
      ],
      [
        { person: 'Ana', cycle: 'INICIO_MES', status: 'Pago', amount: 300 },
        { person: 'Ana', cycle: 'QUINZENA', status: 'Em aberto', amount: 100 },
        { person: 'Bruno', cycle: 'INICIO_MES', status: 'Em aberto', amount: 50 }
      ]
    );

    expect(balances).toEqual([
      expect.objectContaining({ label: 'Bruno', receber: 0, pagar: 0, emAberto: 50, sobra: -50 }),
      expect.objectContaining({ label: 'Ana', receber: 1500, pagar: 300, emAberto: 100, sobra: 1100 })
    ]);
  });
});
