import { describe, expect, it } from 'vitest';
import { selectDashboardTotals } from '../../../src/application/selectors/financialSelectors.js';

function records(size) {
  return Array.from({ length: size }, (_, index) => ({
    id: `record-${index}`,
    type: index % 3 === 0 ? 'entrada' : 'saida',
    person: index % 2 === 0 ? 'Ana' : 'Bruno',
    amount: (index % 17) + 10,
    competence: index % 2 === 0 ? '2026-08' : '2026-07',
    status: index % 5 === 0 ? 'Pago' : 'Em aberto',
    liquido: index % 3 === 0 ? (index % 17) + 10 : 0,
    cardLiquido: index % 3 === 0 ? (index % 17) + 10 : 0
  }));
}

function dashboardInput(source = []) {
  return {
    baseEntradas: source.filter((record) => record.type === 'entrada' && record.competence === '2026-08'),
    baseSaidas: source.filter((record) => record.type === 'saida' && record.competence === '2026-08')
  };
}

describe('dashboard dataset integrity under performance optimizations', () => {
  it.each([100, 1000, 5000])('keeps KPIs based on the full dataset for %s records', (size) => {
    const source = records(size);
    const full = selectDashboardTotals(dashboardInput(source));
    const optimized = selectDashboardTotals(dashboardInput([...source]));
    const firstPageOnly = selectDashboardTotals(dashboardInput(source.slice(0, 50)));

    expect(optimized).toEqual(full);
    expect(firstPageOnly.totalEntradas).not.toBe(full.totalEntradas);
    expect(firstPageOnly.totalSaidasPagas).not.toBe(full.totalSaidasPagas);
  });
});
