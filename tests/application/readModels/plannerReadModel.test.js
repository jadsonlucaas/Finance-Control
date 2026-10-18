import { describe, expect, it } from 'vitest';
import { buildPlannerReadModel } from '../../../src/application/readModels/plannerReadModel.js';
import {
  applyPlannerFilters,
  filterPlannerArchived,
  filterPlannerByCategory,
  filterPlannerByMacro,
  filterPlannerByPeriod,
  filterPlannerByPerson,
  filterPlannerByStatus,
  filterPlannerByType
} from '../../../src/application/selectors/plannerFilters.js';

const records = [
  {
    id: 'saida-1',
    type: 'saida',
    description: 'Energia',
    amount: 120,
    due_date: '2026-06-10',
    competence: '2026-06',
    person: 'Jadson',
    status: 'Em aberto',
    macro_category: 'FIXO',
    subcategory: 'Casa',
    installment_series_id: 'series-parcela',
    installment_no: 1,
    total_installments: 3
  },
  {
    id: 'saida-2',
    type: 'saida',
    description: 'Assinatura',
    amount: 50,
    due_date: '2026-06-15',
    competence: '2026-06',
    person: 'Luana',
    status: 'Pago',
    paid_at: '2026-06-15',
    macro_category: 'VARIAVEL',
    category_name: 'Streaming',
    recurrence_series_id: 'rec-1',
    recurrence_sequence_no: 2
  },
  {
    id: 'entrada-1',
    type: 'entrada',
    description: 'Freela',
    amount: 300,
    date: '2026-06-20',
    competence: '2026-06',
    person: 'Jadson',
    macro_category: 'RENDA',
    category_name: 'Extra'
  },
  {
    id: 'hora-1',
    type: 'controle_horas',
    person: 'Jadson',
    occurred_date: '2026-06-13',
    hour_control_type: 'Hora Extra',
    financial_total: 80
  },
  {
    id: 'arquivada',
    type: 'saida',
    description: 'Antiga',
    amount: 99,
    due_date: '2026-06-05',
    competence: '2026-06',
    archived: true
  }
];

const plannerEvents = [
  { id: 'planner-1', date: '2026-06-12', type: 'holiday', title: 'Feriado local' },
  { id: 'planner-2', date: '2026-07-01', type: 'commitment', title: 'Fora do mes' }
];

describe('planner filters', () => {
  it('filters by period, person, type, status, macro, category and archive mode', () => {
    expect(filterPlannerByPeriod(records, { start: '2026-06', end: '2026-06' })).toHaveLength(5);
    expect(filterPlannerByPerson(records, 'Jadson').map((item) => item.id)).toEqual(['saida-1', 'entrada-1', 'hora-1']);
    expect(filterPlannerByType(records, 'saida').map((item) => item.id)).toEqual(['saida-1', 'saida-2', 'arquivada']);
    expect(filterPlannerByStatus(records, 'Pago').map((item) => item.id)).toEqual(['saida-2']);
    expect(filterPlannerByMacro(records, 'FIXO').map((item) => item.id)).toEqual(['saida-1']);
    expect(filterPlannerByCategory(records, 'Streaming').map((item) => item.id)).toEqual(['saida-2']);
    expect(filterPlannerArchived(records, 'archived').map((item) => item.id)).toEqual(['arquivada']);
  });

  it('applies filters in one pure pipeline', () => {
    const filtered = applyPlannerFilters(records, {
      start: '2026-06',
      end: '2026-06',
      person: 'Jadson',
      type: 'saida',
      status: 'Em aberto',
      macro: 'FIXO',
      category: 'Casa',
      archiveMode: 'active'
    });

    expect(filtered.map((item) => item.id)).toEqual(['saida-1']);
  });
});

describe('planner read model', () => {
  it('normalizes persisted expenses, incomes, local events and hour entries without recalculating series', () => {
    const model = buildPlannerReadModel({ records, plannerEvents, filters: { month: '2026-06' } });

    expect(model.events.map((event) => event.eventId)).toEqual([
      'saida:saida-1',
      'planner:planner-1',
      'hour:hora-1',
      'saida:saida-2',
      'entrada:entrada-1'
    ]);
    expect(model.getById('saida:saida-1')).toMatchObject({
      sourceRecordId: 'saida-1',
      installment: true,
      installmentSeriesId: 'series-parcela',
      totalInstallments: 3
    });
    expect(model.getById('saida:saida-2')).toMatchObject({
      recurrence: true,
      recurrenceSeriesId: 'rec-1',
      recurrenceSequenceNo: 2
    });
  });

  it('groups by day, week and month for presentation-only views', () => {
    const model = buildPlannerReadModel({ records, plannerEvents, filters: { month: '2026-06' } });

    expect(model.byDay['2026-06-10'].map((event) => event.eventId)).toEqual(['saida:saida-1']);
    expect(Object.keys(model.byWeek)).toContain('2026-W24');
    expect(model.byMonth['2026-06']).toHaveLength(5);
  });

  it('summarizes persisted values without adding archived records by default', () => {
    const model = buildPlannerReadModel({ records, plannerEvents, filters: { month: '2026-06' } });

    expect(model.summary).toMatchObject({
      count: 5,
      income: 300,
      expense: 170,
      balance: 130,
      pendingExpense: 120,
      paid: 1,
      installments: 1,
      recurrences: 1,
      localEvents: 1,
      hourEvents: 1
    });
  });

  it('uses real ids for detail lookup instead of description, date and amount matching', () => {
    const duplicateRecords = [
      { id: 'a', type: 'saida', description: 'Internet', amount: 100, due_date: '2026-06-10', competence: '2026-06' },
      { id: 'b', type: 'saida', description: 'Internet', amount: 100, due_date: '2026-06-10', competence: '2026-06' }
    ];
    const model = buildPlannerReadModel({ records: duplicateRecords, filters: { month: '2026-06' } });

    expect(model.getById('saida:b').sourceRecordId).toBe('b');
    expect(model.byDay['2026-06-10'].map((event) => event.sourceRecordId)).toEqual(['a', 'b']);
  });

  it('exposes filter options from the complete local source set', () => {
    const model = buildPlannerReadModel({ records, plannerEvents, filters: { month: '2026-06' } });

    expect(model.options.people).toEqual(['Jadson', 'Luana']);
    expect(model.options.types).toEqual(['controle_horas', 'entrada', 'planner', 'saida']);
    expect(model.options.macros).toContain('FIXO');
    expect(model.metadata).toMatchObject({
      sourceRecordCount: 5,
      plannerEventCount: 2,
      visibleEventCount: 5
    });
  });
});
