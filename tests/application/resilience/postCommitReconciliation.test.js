import { describe, expect, it } from 'vitest';
import { createApplicationDependencies } from '../../../src/application/dependencies/createApplicationDependencies.js';
import { APPLICATION_RESULT_CODES } from '../../../src/application/gateway/applicationResult.js';
import { createDefaultApplicationGateway } from '../../../src/application/gateway/defaultApplicationGateway.js';
import { buildOperationFingerprint } from '../../../src/application/gateway/idempotency.js';
import {
  CommitImportBatch,
  IMPORT_TYPES,
  PrepareImportBatch
} from '../../../src/application/imports/importBatchUseCases.js';
import {
  createMutationAttemptContext,
  MUTATION_ATTEMPT_STATUS,
  MUTATION_OUTCOME_STATE,
  payloadMatchesMutationAttempt,
  safeAttemptForStorage
} from '../../../src/application/resilience/mutationAttemptContext.js';
import { ReconcileMutationAttempt } from '../../../src/application/resilience/reconcileMutationAttempt.js';
import { createRetryPolicy, OPERATION_TYPES } from '../../../src/application/resilience/retryPolicy.js';

const NOW = '2026-09-01T12:00:00.000Z';
const now = () => NOW;

function auth(overrides = {}) {
  return {
    actorUid: 'owner-post',
    actorType: 'user',
    role: 'user',
    accountStatus: 'active',
    ownerUid: 'owner-post',
    permissions: [],
    ...overrides
  };
}

function expensePayload(overrides = {}) {
  return {
    person: 'Jadson',
    macroCategory: 'Casa',
    categoryName: 'Energia',
    description: 'Conta de luz',
    amount: 150.25,
    status: 'Em aberto',
    paymentMethod: 'Pix',
    occurredDate: '2026-09-01',
    dueDate: '2026-09-10',
    competence: '2026-09',
    ...overrides
  };
}

function incomePayload(overrides = {}) {
  return {
    person: 'Jadson',
    amount: 1000,
    competence: '2026-09',
    occurredDate: '2026-09-05',
    earningType: 'Salario',
    ...overrides
  };
}

function hourPayload(overrides = {}) {
  return {
    person: 'Jadson',
    competence: '2026-09',
    occurredDate: '2026-09-04',
    startTime: '18:00',
    endTime: '20:00',
    hourControlType: 'Hora Extra',
    salaryBase: 5000,
    ...overrides
  };
}

function command(commandName, payload, attempt) {
  return {
    commandName,
    schemaVersion: 1,
    actor: { type: 'user', id: 'owner-post', role: 'user' },
    source: { channel: 'web', referenceId: 'post-commit-test' },
    idempotencyKey: attempt.idempotencyKey,
    correlationId: attempt.correlationId,
    requestedAt: attempt.createdAt,
    payload
  };
}

function dependencies() {
  return createApplicationDependencies({ mode: 'memory', now });
}

function gateway(deps) {
  return createDefaultApplicationGateway({
    dependencies: deps,
    now,
    authContextProvider: () => auth()
  });
}

function attemptFor(commandName, payload, context = auth()) {
  return createMutationAttemptContext({
    commandName,
    sourceChannel: 'web',
    payload,
    context,
    createdAt: NOW
  }, { now });
}

describe('MutationAttemptContext', () => {
  it('creates a valid stable attempt without storing sensitive fields', () => {
    const payload = expensePayload({ token: 'secret', phone: '559999999999' });
    const attempt = attemptFor('CreateExpenseCommand', payload);
    const samePayload = attemptFor('CreateExpenseCommand', { ...payload });
    const changedPayload = expensePayload({ amount: 151 });

    expect(attempt.status).toBe(MUTATION_ATTEMPT_STATUS.PREPARED);
    expect(attempt.idempotencyKey).toBeTruthy();
    expect(attempt.correlationId).toBeTruthy();
    expect(attempt.originalPayloadFingerprint).toBe(samePayload.originalPayloadFingerprint);
    expect(payloadMatchesMutationAttempt(attempt, {
      commandName: 'CreateExpenseCommand',
      sourceChannel: 'web',
      payload,
      context: auth()
    })).toBe(true);
    expect(payloadMatchesMutationAttempt(attempt, {
      commandName: 'CreateExpenseCommand',
      sourceChannel: 'web',
      payload: changedPayload,
      context: auth()
    })).toBe(false);
    expect(JSON.stringify(safeAttemptForStorage(attempt))).not.toMatch(/secret|559999999999|phone|token/i);
  });
});

describe('post-commit reconciliation', () => {
  it('keeps CreateExpense single after response loss, reconcile and retry with same key', async () => {
    const deps = dependencies();
    const appGateway = gateway(deps);
    const payload = expensePayload();
    const attempt = attemptFor('CreateExpenseCommand', payload);
    const responseLost = await appGateway.executeCommand(command('CreateExpenseCommand', payload, attempt), {
      authContext: auth(),
      afterMutationBeforeApplicationResult: () => {
        throw Object.assign(new Error('client timeout after receipt complete'), { code: 'deadline-exceeded' });
      }
    });
    const recordsAfterLoss = await deps.repositories.financeRecords.list({ type: 'saida' }, auth());
    const receiptsAfterLoss = await deps.repositories.idempotency.list({ commandName: 'CreateExpenseCommand' }, auth());
    const auditsAfterLoss = await deps.repositories.audit.listByCorrelationId(attempt.correlationId, auth());

    const reconciled = await ReconcileMutationAttempt({
      attempt,
      context: auth({ correlationId: attempt.correlationId }),
      repositories: {
        financeRecords: deps.repositories.financeRecords,
        idempotency: deps.repositories.idempotency,
        errorReporter: deps.services.errorReporter
      },
      payload,
      now
    });
    const retry = await appGateway.executeCommand(command('CreateExpenseCommand', payload, attempt), { authContext: auth() });
    const recordsAfterRetry = await deps.repositories.financeRecords.list({ type: 'saida' }, auth());
    const auditsAfterRetry = await deps.repositories.audit.listByCorrelationId(attempt.correlationId, auth());

    expect(responseLost.success).toBe(false);
    expect(responseLost.data.mutationOutcome).toBe(MUTATION_OUTCOME_STATE.UNCERTAIN);
    expect(recordsAfterLoss.count).toBe(1);
    expect(receiptsAfterLoss.items).toHaveLength(1);
    expect(receiptsAfterLoss.items[0]).toMatchObject({ status: 'completed', idempotency_key: attempt.idempotencyKey });
    expect(auditsAfterLoss.count).toBe(1);
    expect(reconciled.success).toBe(true);
    expect(reconciled.data.mutationOutcome).toBe(MUTATION_OUTCOME_STATE.RECONCILED_SUCCESS);
    expect(reconciled.entityId).toBe(recordsAfterLoss.items[0].id);
    expect(retry.code).toBe(APPLICATION_RESULT_CODES.IDEMPOTENT_REPLAY);
    expect(recordsAfterRetry.count).toBe(1);
    expect(auditsAfterRetry.count).toBe(1);
    expect(deps.services.errorReporter.listRecent().map((event) => event.code)).toEqual(expect.arrayContaining([
      'POST_COMMIT_RESPONSE_LOST',
      'RECONCILIATION_ATTEMPT',
      'RECONCILIATION_CONFIRMED'
    ]));
  });

  it('applies the same post-commit policy to CreateIncome and CreateHourEntry', async () => {
    const deps = dependencies();
    const appGateway = gateway(deps);
    for (const [commandName, payload, type] of [
      ['CreateIncomeCommand', incomePayload(), 'entrada'],
      ['CreateHourEntryCommand', hourPayload(), 'controle_horas']
    ]) {
      const attempt = attemptFor(commandName, payload);
      const lost = await appGateway.executeCommand(command(commandName, payload, attempt), {
        authContext: auth(),
        afterMutationBeforeApplicationResult: () => {
          throw new Error('network response lost');
        }
      });
      const reconciled = await ReconcileMutationAttempt({
        attempt,
        context: auth({ correlationId: attempt.correlationId }),
        repositories: deps.repositories,
        payload,
        now
      });
      const records = await deps.repositories.financeRecords.list({ type }, auth());

      expect(lost.data.mutationOutcome).toBe(MUTATION_OUTCOME_STATE.UNCERTAIN);
      expect(reconciled.data.mutationOutcome).toBe(MUTATION_OUTCOME_STATE.RECONCILED_SUCCESS);
      expect(records.count).toBe(1);
    }
  });

  it('preserves one key for installment and recurrence series response loss', async () => {
    const deps = dependencies();
    const appGateway = gateway(deps);
    const seriesCases = [
      ['CreateInstallmentSeriesCommand', {
        ...expensePayload({ amount: 300 }),
        installments: 3,
        totalAmount: 300,
        baseDueDate: '2026-09-10',
        parentId: 'series-installment-post'
      }, 'series-installment-post'],
      ['CreateRecurrenceSeriesCommand', {
        ...expensePayload({ amount: 80, description: 'Assinatura' }),
        recurrence: 'monthly',
        frequency: 'monthly',
        recurrence_count: 2,
        baseDueDate: '2026-09-15',
        seriesId: 'series-recurrence-post'
      }, 'series-recurrence-post']
    ];

    for (const [commandName, payload, seriesId] of seriesCases) {
      const attempt = attemptFor(commandName, payload);
      const lost = await appGateway.executeCommand(command(commandName, payload, attempt), {
        authContext: auth(),
        afterMutationBeforeApplicationResult: () => {
          throw new Error('response lost after batch');
        }
      });
      const replay = await appGateway.executeCommand(command(commandName, payload, attempt), { authContext: auth() });
      const records = await deps.repositories.financeRecords.findBySeriesId(seriesId, auth());

      expect(lost.data.mutationOutcome).toBe(MUTATION_OUTCOME_STATE.UNCERTAIN);
      expect(replay.code).toBe(APPLICATION_RESULT_CODES.IDEMPOTENT_REPLAY);
      expect(replay.entityIds).toEqual(lost.data.entityIds || replay.entityIds);
      expect(records.count).toBeGreaterThan(0);
      expect(new Set(records.items.map((record) => record.idempotency_key))).toEqual(new Set([attempt.idempotencyKey]));
    }
  });

  it('keeps import commit idempotent for the whole operation', async () => {
    const deps = dependencies();
    const context = auth({ correlationId: 'corr-import-post', sourceChannel: 'bank_import' });
    const prepared = await PrepareImportBatch({
      rows: [
        {
          type: 'saida',
          person: 'Ana',
          description: 'Banco 1',
          amount: 120,
          occurred_date: '2026-07-10',
          due_date: '2026-07-10',
          competence: '2026-07',
          status: 'Pago',
          category: 'Casa',
          source_reference_id: 'bank-1'
        },
        {
          type: 'saida',
          person: 'Ana',
          description: 'Banco 2',
          amount: 55,
          occurred_date: '2026-07-11',
          due_date: '2026-07-11',
          competence: '2026-07',
          status: 'Pago',
          category: 'Casa',
          source_reference_id: 'bank-2'
        }
      ],
      importType: IMPORT_TYPES.BANK_STATEMENT,
      originalFilename: 'extrato.csv',
      fileContent: 'bank-1;bank-2',
      context,
      repositories: deps.repositories,
      now
    });
    const first = await CommitImportBatch({
      preparedBatch: prepared.data,
      context,
      repositories: deps.repositories,
      now
    });
    const replay = await CommitImportBatch({
      preparedBatch: prepared.data,
      context,
      repositories: deps.repositories,
      now
    });
    const records = await deps.repositories.financeRecords.list({ type: 'saida' }, context);

    expect(first.success).toBe(true);
    expect(replay.code).toBe(APPLICATION_RESULT_CODES.IDEMPOTENT_REPLAY);
    expect(replay.entityIds).toEqual(first.entityIds);
    expect(records.count).toBe(2);
  });

  it('does not allow automatic retry for mutations without idempotency key', () => {
    const policy = createRetryPolicy({ baseDelayMs: 0, maxDelayMs: 0 });
    const decision = policy.evaluate({
      error: { category: 'NETWORK', retryable: true },
      operationType: OPERATION_TYPES.MUTATION,
      idempotent: false,
      hasIdempotencyKey: false,
      attempt: 1
    });

    expect(decision.shouldRetry).toBe(false);
  });

  it('detects fingerprint conflict during reconciliation without creating a new entity', async () => {
    const deps = dependencies();
    const appGateway = gateway(deps);
    const payload = expensePayload();
    const attempt = attemptFor('CreateExpenseCommand', payload);
    await appGateway.executeCommand(command('CreateExpenseCommand', payload, attempt), { authContext: auth() });
    const changedPayload = expensePayload({ amount: 999 });
    const expectedChangedFingerprint = buildOperationFingerprint({
      ownerUid: auth().ownerUid,
      commandName: 'CreateExpenseCommand',
      sourceChannel: 'web',
      payload: changedPayload
    });
    const reconciled = await ReconcileMutationAttempt({
      attempt,
      context: auth(),
      repositories: deps.repositories,
      payload: changedPayload,
      now
    });
    const records = await deps.repositories.financeRecords.list({ type: 'saida' }, auth());

    expect(expectedChangedFingerprint).not.toBe(attempt.originalPayloadFingerprint);
    expect(reconciled.code).toBe(APPLICATION_RESULT_CODES.CONFLICT);
    expect(records.count).toBe(1);
  });
});
