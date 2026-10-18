import { describe, expect, it } from 'vitest';
import { buildExpenseListReadModel } from '../../../src/application/readModels/expenseListReadModel.js';
import { buildIncomeListReadModel } from '../../../src/application/readModels/incomeListReadModel.js';

const records = [
  { id: 'a1', ownerId: 'user-a', type: 'saida', person: 'Ana', competence: '2026-06', due_date: '2026-06-10', status: 'Pago', macro_category: 'FIXO', amount: 300 },
  { id: 'a2', ownerId: 'user-a', type: 'saida', person: 'Ana', competence: '2026-06', due_date: '2026-06-12', status: 'Em aberto', macro_category: 'VARIAVEL', amount: 120 },
  { id: 'a3', ownerId: 'user-a', type: 'entrada', person: 'Ana', competence: '2026-06', occurred_date: '2026-06-05', amount: 900 },
  { id: 'b1', ownerId: 'user-b', type: 'saida', person: 'Bruno', competence: '2026-06', due_date: '2026-06-11', status: 'Pago', macro_category: 'FIXO', amount: 999 }
];

describe('financial list read models', () => {
  it('filters, sorts and paginates expenses without changing KPI universes elsewhere', () => {
    const model = buildExpenseListReadModel({
      records,
      filters: { start: '2026-06', end: '2026-06', person: 'Ana' },
      pagination: { page: 1, pageSize: 1 }
    });

    expect(model.pagination.total).toBe(2);
    expect(model.items).toHaveLength(1);
    expect(model.items[0].id).toBe('a2');
    expect(model.allItems.map((record) => record.id)).toEqual(['a2', 'a1']);
    expect(model.getById('a1')?.amount).toBe(300);
  });

  it('filters income records and opens detail by entity id', () => {
    const model = buildIncomeListReadModel({
      records,
      filters: { person: 'Ana', start: '2026-06', end: '2026-06' }
    });

    expect(model.items.map((record) => record.id)).toEqual(['a3']);
    expect(model.getById('a3')?.type).toBe('entrada');
  });

  it('keeps owner isolation when caller passes an owner-scoped dataset', () => {
    const userARecords = records.filter((record) => record.ownerId === 'user-a');
    const model = buildExpenseListReadModel({ records: userARecords, filters: { start: '2026-06', end: '2026-06' } });

    expect(model.allItems.every((record) => record.ownerId === 'user-a')).toBe(true);
    expect(model.getById('b1')).toBeNull();
  });
});
