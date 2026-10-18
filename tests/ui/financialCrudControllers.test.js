import { describe, expect, it, vi } from 'vitest';
import { createExpenseFormController } from '../../src/ui/records/expenseFormController.js';
import { createIncomeFormController } from '../../src/ui/records/incomeFormController.js';
import { createMemoryMutationAttemptStore } from '../../src/ui/records/mutationAttemptStore.js';
import { createRecordMutationPresenter } from '../../src/ui/records/recordMutationPresenter.js';

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

function createGateway(result = { success: true, code: 'OK' }) {
  return {
    executeCommand: vi.fn(async () => result)
  };
}

function createAttemptStore() {
  return createMemoryMutationAttemptStore({
    now: () => '2026-09-02T00:00:00.000Z'
  });
}

describe('financial CRUD controllers', () => {
  it('delegates expense creation to CreateExpenseCommand with idempotency metadata', async () => {
    const gateway = createGateway();
    const controller = createExpenseFormController({
      gateway,
      authContextProvider: authContext,
      attemptStore: createAttemptStore(),
      presenter: createRecordMutationPresenter(),
      now: () => '2026-09-02T00:00:00.000Z'
    });

    const payload = {
      type: 'saida',
      description: 'Energia',
      amount: 180,
      competence: '2026-09',
      date: '2026-09-02',
      ownerUid: 'user-1'
    };
    await controller.createExpense(payload);

    expect(gateway.executeCommand).toHaveBeenCalledTimes(1);
    const [envelope, options] = gateway.executeCommand.mock.calls[0];
    expect(envelope.commandName).toBe('CreateExpenseCommand');
    expect(envelope.payload).toEqual(payload);
    expect(envelope.idempotencyKey).toMatch(/^idem_/);
    expect(options.authContext.ownerUid).toBe('user-1');
  });

  it('delegates expense edit, paid, archive and delete to canonical commands', async () => {
    const gateway = createGateway();
    const controller = createExpenseFormController({
      gateway,
      authContextProvider: authContext,
      attemptStore: createAttemptStore(),
      presenter: createRecordMutationPresenter(),
      now: () => '2026-09-02T00:00:00.000Z'
    });

    await controller.updateExpense({ id: 's1', fields: { amount: 220 } });
    await controller.markExpenseAsPaid({ expenseId: 's1', paidAt: '2026-09-02' });
    await controller.archiveExpense({ id: 's1' });
    await controller.deleteExpense({ id: 's1' });

    expect(gateway.executeCommand.mock.calls.map(([envelope]) => envelope.commandName)).toEqual([
      'UpdateExpenseCommand',
      'MarkExpenseAsPaidCommand',
      'ArchiveExpenseCommand',
      'DeleteExpenseCommand'
    ]);
  });

  it('delegates income creation to CreateIncomeCommand without fiscal calculation dependencies', async () => {
    const gateway = createGateway();
    const controller = createIncomeFormController({
      gateway,
      authContextProvider: authContext,
      attemptStore: createAttemptStore(),
      presenter: createRecordMutationPresenter(),
      now: () => '2026-09-02T00:00:00.000Z'
    });

    await controller.createIncome({
      type: 'entrada',
      person: 'Jadson',
      amount: 1200,
      competence: '2026-09',
      ownerUid: 'user-1'
    });

    expect(gateway.executeCommand).toHaveBeenCalledTimes(1);
    const [envelope] = gateway.executeCommand.mock.calls[0];
    expect(envelope.commandName).toBe('CreateIncomeCommand');
    expect(JSON.stringify(envelope)).not.toMatch(/calcularINSS|calcularIRRF|calcularLiquido|calcularHoraExtra|calcularDSR/);
  });

  it('preserves the attempt when gateway returns uncertain outcome and clears it after success', async () => {
    const uncertainGateway = createGateway({
      success: false,
      code: 'POST_COMMIT_RESPONSE_LOST',
      data: { mutationOutcome: 'uncertain' }
    });
    const attemptStore = createAttemptStore();
    const controller = createExpenseFormController({
      gateway: uncertainGateway,
      authContextProvider: authContext,
      attemptStore,
      presenter: createRecordMutationPresenter(),
      now: () => '2026-09-02T00:00:00.000Z'
    });

    const payload = { type: 'saida', description: 'Internet', amount: 99, ownerUid: 'user-1' };
    await controller.createExpense(payload);
    const pending = attemptStore.peek('record-form');
    expect(pending).toMatchObject({ commandName: 'CreateExpenseCommand' });
    expect(pending).not.toHaveProperty('payload');

    uncertainGateway.executeCommand.mockResolvedValueOnce({ success: true, code: 'OK' });
    await controller.createExpense(payload);
    expect(attemptStore.peek('record-form')).toBeNull();
  });

  it('uses injected fallback when the gateway is disabled for local smoke', async () => {
    const fallback = vi.fn(async () => ({ isOk: true, id: 'local-1' }));
    const controller = createExpenseFormController({
      gateway: createGateway(),
      authContextProvider: authContext,
      attemptStore: createAttemptStore(),
      presenter: createRecordMutationPresenter()
    });

    const result = await controller.createExpense({ type: 'saida' }, { useGateway: false, fallback });

    expect(result).toEqual({ isOk: true, id: 'local-1' });
    expect(fallback).toHaveBeenCalledTimes(1);
  });
});
