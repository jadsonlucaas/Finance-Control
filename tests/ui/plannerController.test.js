import { describe, expect, it, vi } from 'vitest';
import {
  customHolidaysStorageKey,
  plannerEventsStorageKey
} from '../../src/application/planner/plannerLocalEventStore.js';
import { createPlannerController } from '../../src/ui/planner/plannerController.js';
import { installPlannerActiveUi } from '../../src/ui/planner/plannerActiveUi.js';

function storage(seed = {}) {
  const values = new Map(Object.entries(seed));
  return {
    getItem: vi.fn((key) => values.get(key) || null),
    setItem: vi.fn((key, value) => values.set(key, value)),
    dump: () => Object.fromEntries(values.entries())
  };
}

function element(value = '') {
  return {
    value,
    dataset: {},
    classList: { add: vi.fn(), remove: vi.fn() },
    querySelector: vi.fn(),
    addEventListener: vi.fn()
  };
}

function documentStub() {
  const elements = new Map([
    ['planner-month', element('2026-06')],
    ['planner-date', element('2026-06-12')],
    ['planner-type', element('holiday')],
    ['planner-title', element('Feriado')],
    ['planner-note', element('Municipal')]
  ]);
  return {
    documentElement: { dataset: {} },
    getElementById: vi.fn((id) => elements.get(id) || null),
    addEventListener: vi.fn(),
    __elements: elements
  };
}

function presenter() {
  return {
    ensureModal: vi.fn(),
    show: vi.fn(),
    hide: vi.fn(),
    render: vi.fn()
  };
}

describe('planner controller', () => {
  it('shows an error toast when a Planner expense action fails', async () => {
    const toast = vi.fn();
    const controller = createPlannerController({
      document: documentStub(),
      storage: storage(),
      ownerProvider: () => 'owner-a',
      presenter: presenter(),
      toast,
      financialActions: { archiveExpense: vi.fn(async () => ({ success: false, code: 'GATEWAY_UNAVAILABLE' })) },
      readSource: { read: async () => ({ records: [{ id: 's9', type: 'saida', description: 'Luz', amount: 50, due_date: '2026-06-05', competence: '2026-06', status: 'Em aberto' }] }), subscribe: null }
    });
    await controller.open();
    const result = await controller.delegateExpenseAction('archive', 'saida:s9');
    expect(result.success).toBe(false);
    expect(toast).toHaveBeenLastCalledWith(expect.stringContaining('Não foi possível'), true);
  });

  it('uses the Dashboard month totals for the summary and falls back when they fail', async () => {
    const ui = presenter();
    const monthSummary = vi.fn(async (month) => ({ income: 5000, expense: 1200, balance: 3800, month }));
    const controller = createPlannerController({
      document: documentStub(),
      storage: storage(),
      ownerProvider: () => 'owner-a',
      presenter: ui,
      monthSummary,
      readSource: { read: async () => ({ records: [] }), subscribe: null }
    });
    await controller.open();
    expect(monthSummary).toHaveBeenCalledWith('2026-06');
    expect(ui.render.mock.calls.at(-1)[0].summary).toEqual({ income: 5000, expense: 1200, balance: 3800, month: '2026-06' });

    const failing = presenter();
    const broken = createPlannerController({
      document: documentStub(),
      storage: storage(),
      ownerProvider: () => 'owner-a',
      presenter: failing,
      monthSummary: async () => { throw new Error('sem dados'); },
      readSource: { read: async () => ({ records: [] }), subscribe: null }
    });
    await broken.open();
    expect(failing.render.mock.calls.at(-1)[0].summary).toBeNull();
  });

  it('loads records through a local read source and renders the planner read model', async () => {
    const ui = presenter();
    const controller = createPlannerController({
      document: documentStub(),
      storage: storage(),
      ownerProvider: () => 'owner-a',
      presenter: ui,
      readSource: {
        read: vi.fn(async () => ({
          records: [{ id: 's1', type: 'saida', description: 'Conta', amount: 90, due_date: '2026-06-10', competence: '2026-06' }]
        }))
      }
    });

    const model = await controller.load();

    expect(model.events.map((event) => event.eventId)).toEqual(['saida:s1']);
    expect(ui.render).toHaveBeenCalledWith(expect.objectContaining({
      model: expect.objectContaining({ summary: expect.objectContaining({ expense: 90 }) })
    }));
  });

  it('saves and deletes local planner events without touching remote services', async () => {
    const store = storage();
    const ui = presenter();
    const controller = createPlannerController({
      document: documentStub(),
      storage: store,
      ownerProvider: () => 'owner-a',
      presenter: ui,
      readSource: { read: vi.fn(async () => ({ records: [] })) },
      now: () => '2026-09-03T00:00:00.000Z'
    });

    const saved = await controller.saveLocalEvent();
    await controller.deleteLocalEvent(saved.data.id);

    expect(saved).toMatchObject({ success: true });
    expect(store.setItem).toHaveBeenCalledWith(plannerEventsStorageKey({ ownerUid: 'owner-a' }), expect.stringContaining('Feriado'));
    expect(store.setItem).toHaveBeenCalledWith(customHolidaysStorageKey({ ownerUid: 'owner-a' }), expect.stringContaining('2026-06-12'));
    expect(JSON.parse(store.dump()[plannerEventsStorageKey({ ownerUid: 'owner-a' })])).toEqual([]);
    expect(store.dump()['finance-control-planner-events-v1']).toBeUndefined();
  });

  it('delegates expense mutations through injected financial actions by real id', async () => {
    const financialActions = {
      markExpenseAsPaid: vi.fn(async () => ({ success: true })),
      archiveExpense: vi.fn(async () => ({ success: true })),
      deleteExpense: vi.fn(async () => ({ success: true }))
    };
    const controller = createPlannerController({
      target: { allRecords: [] },
      document: documentStub(),
      storage: storage(),
      ownerProvider: () => 'owner-a',
      financialActions,
      presenter: presenter(),
      readSource: {
        read: vi.fn(async () => ({
          records: [{ id: 's1', type: 'saida', description: 'Conta', amount: 90, due_date: '2026-06-10', competence: '2026-06', status: 'Em aberto' }]
        }))
      }
    });

    await controller.load();
    await controller.delegateExpenseAction('mark-paid', 'saida:s1');
    await controller.delegateExpenseAction('archive', 'saida:s1');
    await controller.delegateExpenseAction('delete', 'saida:s1');

    expect(financialActions.markExpenseAsPaid).toHaveBeenCalledWith({ expenseId: 's1', id: 's1' }, expect.objectContaining({ sourceReferenceId: 'planner', record: expect.objectContaining({ id: 's1', type: 'saida' }) }));
    expect(financialActions.archiveExpense).toHaveBeenCalledWith({ expenseId: 's1', id: 's1' }, expect.objectContaining({ sourceReferenceId: 'planner', record: expect.objectContaining({ id: 's1', type: 'saida' }) }));
    expect(financialActions.deleteExpense).toHaveBeenCalledWith({ expenseId: 's1', id: 's1' }, expect.objectContaining({ sourceReferenceId: 'planner', record: expect.objectContaining({ id: 's1', type: 'saida' }) }));
  });

  it('cleans subscriptions explicitly', () => {
    const unsubscribe = vi.fn();
    const controller = createPlannerController({
      document: documentStub(),
      storage: storage(),
      ownerProvider: () => 'owner-a',
      presenter: presenter(),
      readSource: {
        read: vi.fn(async () => ({ records: [] })),
        subscribe: vi.fn(() => unsubscribe)
      }
    });

    controller.subscribe();
    expect(controller.getSubscriptionCount()).toBe(1);
    controller.destroy();

    expect(unsubscribe).toHaveBeenCalledOnce();
    expect(controller.getSubscriptionCount()).toBe(0);
  });
});

describe('planner active UI bridge', () => {
  it('preserves existing global names as modern bridges without adding new public APIs', () => {
    const target = {
      document: {
        documentElement: { dataset: {} },
        addEventListener: vi.fn()
      },
      localStorage: storage(),
      allRecords: []
    };
    const controller = {
      open: vi.fn(),
      close: vi.fn(),
      render: vi.fn(),
      saveLocalEvent: vi.fn(),
      deleteLocalEvent: vi.fn(),
      shiftMonth: vi.fn(),
      selectDate: vi.fn(),
      delegateExpenseAction: vi.fn(),
      destroy: vi.fn()
    };

    const result = installPlannerActiveUi(target, { controller });

    expect(target.openPlannerModal.__financeModernPlanner).toBe(true);
    expect(target.renderPlannerModal.__financeModernPlanner).toBe(true);
    target.deletePlannerEvent('planner-1');
    expect(controller.deleteLocalEvent).toHaveBeenCalledWith('planner-1');
    expect(result.controller).toBe(controller);
  });
});
