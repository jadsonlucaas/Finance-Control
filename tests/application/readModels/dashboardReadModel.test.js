import { describe, expect, it } from 'vitest';
import { buildDashboardReadModel } from '../../../src/application/readModels/dashboardReadModel.js';
import {
  applyDashboardFilters,
  filterByMacro,
  filterByPerson,
  filterByPeriod
} from '../../../src/application/selectors/dashboardFilters.js';
import {
  buildCategoryChartData,
  buildDashboardDailyExpenseTrendData,
  buildDashboardMonthlyFinancialTrendData,
  buildStatusChartData
} from '../../../src/application/readModels/dashboardChartData.js';

const records = [
  { id: 'p-ana', type: 'pessoa', person: 'Ana', salary_base: 5000 },
  { id: 'p-bruno', type: 'pessoa', person: 'Bruno', salary_base: 3000 },
  { id: 'e-ana', type: 'entrada', person: 'Ana', competence: '2026-06', amount: 1000, cardLiquido: 1000 },
  { id: 'e-bruno', type: 'entrada', person: 'Bruno', competence: '2026-06', amount: 800, cardLiquido: 800 },
  { id: 's-paid', type: 'saida', person: 'Ana', competence: '2026-06', due_date: '2026-06-10', status: 'Pago', macro_category: 'FIXO', category_name: 'Aluguel', amount: 300 },
  { id: 's-open', type: 'saida', person: 'Ana', competence: '2026-06', due_date: '2026-06-11', status: 'Em aberto', macro_category: 'VARIAVEL', category_name: 'Mercado', amount: 200 },
  { id: 's-archived', type: 'saida', person: 'Ana', competence: '2026-06', due_date: '2026-06-12', status: 'Pago', macro_category: 'FIXO', amount: 999, archived: true },
  { id: 's-cancelled', type: 'saida', person: 'Ana', competence: '2026-06', due_date: '2026-06-13', status: 'Cancelado', macro_category: 'FIXO', amount: 999 },
  { id: 's-other-month', type: 'saida', person: 'Ana', competence: '2026-05', due_date: '2026-05-10', status: 'Pago', macro_category: 'FIXO', amount: 999 },
  { id: 's-other-person', type: 'saida', person: 'Bruno', competence: '2026-06', due_date: '2026-06-09', status: 'Pago', macro_category: 'FIXO', amount: 150, source_channel: 'future-channel' }
];

function build(filters = {}, extra = {}) {
  return buildDashboardReadModel({
    records,
    filters: { start: '2026-06', end: '2026-06', ...filters },
    referenceData: {
      months: ['2026-06'],
      generatedPercentageExpenses: extra.generatedPercentageExpenses || []
    },
    options: {
      isFinancialEntradaRecord: (record) => record.type === 'entrada',
      ...extra.options
    }
  });
}

describe('dashboard read model', () => {
  it('is deterministic and does not mutate input records', () => {
    const source = structuredClone(records);
    const before = JSON.stringify(source);
    const first = buildDashboardReadModel({ records: source, filters: { start: '2026-06', end: '2026-06' } });
    const second = buildDashboardReadModel({ records: source, filters: { start: '2026-06', end: '2026-06' } });

    expect(JSON.stringify(source)).toBe(before);
    expect(second).toEqual(first);
  });

  it('keeps KPIs based on the full dataset, not on list pagination', () => {
    const model = build();
    const firstPageOnly = buildDashboardReadModel({
      records: records.filter((record) => record.id !== 'e-bruno'),
      filters: { start: '2026-06', end: '2026-06' }
    });

    expect(model.kpis.totalIncome).toBe(1800);
    expect(model.kpis.totalExpense).toBe(450);
    expect(model.kpis.openExpense).toBe(200);
    expect(model.kpis.balance).toBe(1150);
    expect(firstPageOnly.kpis.totalIncome).not.toBe(model.kpis.totalIncome);
  });

  it('preserves active, cancelled and archived expense policy', () => {
    const model = build({ person: 'Ana' });

    expect(model.expenses.map((record) => record.id).sort()).toEqual(['s-open', 's-paid']);
    expect(model.summary.aggregations.total).toBe(500);
  });

  it('keeps source_channel neutral for calculations and filters', () => {
    const base = build();
    const withoutChannel = buildDashboardReadModel({
      records: records.map(({ source_channel, ...record }) => record),
      filters: { start: '2026-06', end: '2026-06' }
    });

    expect(base.kpis).toEqual(withoutChannel.kpis);
  });

  it('builds chart models from the same read model bases', () => {
    const model = build();

    expect(model.charts.trend.mode).toBe('daily');
    expect(model.charts.trend.daily.insights.total).toBe(650);
    expect(model.charts.category.labels).toContain('FIXO');
    expect(model.charts.status.totals.Pago).toBe(450);
  });

  it('can be reused by a backend-like caller without DOM globals', () => {
    const model = build({ macro: 'FIXO' });

    expect(model.kpis.totalExpense).toBe(450);
    expect(model.expenses.every((record) => record.macro_category === 'FIXO')).toBe(true);
  });

  it('supports generated percentage expenses without changing source records', () => {
    const model = build({}, {
      generatedPercentageExpenses: [
        { id: 'virtual-1', type: 'saida', person: 'Ana', competence: '2026-06', status: 'Em aberto', macro_category: 'FIXO', amount: 50, virtual: true }
      ]
    });

    expect(model.kpis.openExpense).toBe(250);
    expect(model.metadata.generatedExpenseCount).toBe(1);
  });
});

describe('dashboard pure filters and chart builders', () => {
  it('keeps filter order semantically equivalent', () => {
    const filters = { start: '2026-06', end: '2026-06', person: 'Ana', macro: 'FIXO' };
    const centralized = applyDashboardFilters(records, filters).map((record) => record.id);
    const manual = filterByMacro(filterByPerson(filterByPeriod(records, filters), 'Ana'), 'FIXO').map((record) => record.id);

    expect(centralized).toEqual(manual);
  });

  it('creates monthly, category, status and daily chart data without a chart adapter', () => {
    const monthly = buildDashboardMonthlyFinancialTrendData({
      entradas: [{ competence: '2026-06', cardLiquido: 1000 }],
      saidas: [{ type: 'saida', competence: '2026-06', status: 'Pago', amount: 300 }]
    }, ['2026-06']);
    const daily = buildDashboardDailyExpenseTrendData([{ type: 'saida', status: 'Pago', paid_at: '2026-06-02', amount: 25 }], '2026-06');
    const category = buildCategoryChartData({
      porCategoria: { FIXO: 300 },
      registrosPorCategoria: { FIXO: [{ id: 's-paid' }] }
    });
    const status = buildStatusChartData([{ status: 'Pago', amount: 300 }, { status: 'Em aberto', amount: 20 }]);

    expect(monthly.balance).toEqual([700]);
    expect(daily.values[1]).toBe(25);
    expect(category.values).toEqual([300]);
    expect(status.totals).toEqual({ Pago: 300, 'Em aberto': 20 });
  });
});
