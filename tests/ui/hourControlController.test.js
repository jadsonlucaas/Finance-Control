import { describe, expect, it, vi } from 'vitest';
import { createHourControlController } from '../../src/ui/hours/hourControlController.js';
import { createMemoryMutationAttemptStore } from '../../src/ui/records/mutationAttemptStore.js';

function authContext() {
  return {
    actorUid: 'user-1',
    uid: 'user-1',
    role: 'user',
    accountStatus: 'active',
    ownerUid: 'user-1',
    permissions: { canManageRecords: true }
  };
}

function presenter() {
  return {
    render: vi.fn(),
    presentMutation: vi.fn()
  };
}

function createAttemptStore() {
  return createMemoryMutationAttemptStore({
    now: () => '2026-09-02T00:00:00.000Z'
  });
}

describe('hour control controller', () => {
  it('loads the read model through injected local dependencies', async () => {
    const ui = presenter();
    const controller = createHourControlController({
      readSource: {
        read: vi.fn(async () => ({
          records: [
            { id: 'h1', type: 'controle_horas', person: 'Jadson', competence: '2026-06', hour_control_type: 'Hora Extra', quantidadeHoras: 2, valorTotalCalculado: 50 }
          ]
        }))
      },
      presenter: ui
    });

    const state = await controller.load({ start: '2026-06', end: '2026-06', person: 'Jadson' });

    expect(state.status).toBe('success');
    expect(state.data.entries).toHaveLength(1);
    expect(ui.render).toHaveBeenCalledWith(expect.objectContaining({ status: 'loading' }));
    expect(ui.render).toHaveBeenCalledWith(expect.objectContaining({ status: 'success' }));
  });

  it('returns offline state without reading data when connectivity is down', async () => {
    const read = vi.fn();
    const controller = createHourControlController({
      readSource: { read },
      connectivity: { isOnline: () => false },
      presenter: presenter()
    });

    const state = await controller.load();

    expect(state.status).toBe('offline');
    expect(read).not.toHaveBeenCalled();
  });

  it('delegates creation and update to canonical hour commands with idempotency metadata', async () => {
    const gateway = { executeCommand: vi.fn(async () => ({ success: true, code: 'OK' })) };
    const controller = createHourControlController({
      gateway,
      authContextProvider: authContext,
      attemptStore: createAttemptStore(),
      presenter: presenter(),
      now: () => '2026-09-02T00:00:00.000Z'
    });

    await controller.createHourEntry({
      person: 'Jadson',
      competence: '2026-06',
      occurredDate: '2026-06-13',
      startTime: '18:00',
      endTime: '20:00',
      hourControlType: 'Hora Extra',
      overtimePercentage: 0.5
    });
    await controller.updateHourEntry({ id: 'h1', fields: { endTime: '21:00', salaryBase: 5459 } });

    expect(gateway.executeCommand.mock.calls.map(([envelope]) => envelope.commandName)).toEqual([
      'CreateHourEntryCommand',
      'UpdateHourEntryCommand'
    ]);
    const [createEnvelope, createOptions] = gateway.executeCommand.mock.calls[0];
    expect(createEnvelope.idempotencyKey).toMatch(/^idem_/);
    expect(createEnvelope.source).toEqual({ channel: 'web', referenceId: 'hour-control' });
    expect(createOptions.authContext.ownerUid).toBe('user-1');
  });

  it('prevents duplicate in-flight submissions for the same attempt key', async () => {
    let resolveGateway;
    const gateway = {
      executeCommand: vi.fn(() => new Promise((resolve) => { resolveGateway = resolve; }))
    };
    const controller = createHourControlController({
      gateway,
      authContextProvider: authContext,
      attemptStore: createAttemptStore(),
      presenter: presenter()
    });

    const first = controller.createHourEntry({ person: 'Jadson', competence: '2026-06' }, { attemptKey: 'same' });
    const second = await controller.createHourEntry({ person: 'Jadson', competence: '2026-06' }, { attemptKey: 'same' });
    resolveGateway({ success: true, code: 'OK' });
    await first;

    expect(second).toMatchObject({ success: false, code: 'CLIENT_SUBMIT_IN_PROGRESS' });
    expect(gateway.executeCommand).toHaveBeenCalledTimes(1);
  });

  it('preserves pending attempt on uncertain result and exposes reconciliation hook', async () => {
    const gateway = {
      executeCommand: vi.fn(async () => ({
        success: false,
        code: 'POST_COMMIT_RESPONSE_LOST',
        data: { mutationOutcome: 'uncertain' }
      }))
    };
    const attemptStore = createAttemptStore();
    const reconciler = { reconcile: vi.fn(async () => ({ success: true, code: 'RECONCILED' })) };
    const controller = createHourControlController({
      gateway,
      authContextProvider: authContext,
      attemptStore,
      reconciler,
      presenter: presenter()
    });

    await controller.createHourEntry({ person: 'Jadson', competence: '2026-06' }, { attemptKey: 'hour-form' });
    const attempt = attemptStore.peek('hour-form');
    const reconciled = await controller.reconcileAttempt(attempt);

    expect(attempt).toMatchObject({ commandName: 'CreateHourEntryCommand' });
    expect(attempt).not.toHaveProperty('payload');
    expect(reconciled).toMatchObject({ success: true, code: 'RECONCILED' });
    expect(reconciler.reconcile).toHaveBeenCalledWith(attempt, {});
  });

  it('cleans subscriptions on destroy', async () => {
    const unsubscribe = vi.fn();
    const controller = createHourControlController({ presenter: presenter() });

    controller.subscribe(() => unsubscribe);
    expect(controller.getSubscriptionCount()).toBe(1);
    controller.destroy();

    expect(unsubscribe).toHaveBeenCalledTimes(1);
    expect(controller.getSubscriptionCount()).toBe(0);
  });
});
