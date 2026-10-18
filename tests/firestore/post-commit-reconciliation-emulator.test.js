import { readFileSync } from 'node:fs';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import {
  doc,
  setDoc
} from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createDefaultApplicationGateway } from '../../src/application/gateway/defaultApplicationGateway.js';
import { APPLICATION_RESULT_CODES } from '../../src/application/gateway/applicationResult.js';
import { FirebaseWebIdempotencyRepository } from '../../src/application/repositories/idempotencyRepositories.js';
import { InMemoryAuditRepository, InMemoryFinanceRecordRepository } from '../../src/application/repositories/inMemoryRepositories.js';
import { InMemoryErrorReporter } from '../../src/application/resilience/errorReporter.js';
import {
  createMutationAttemptContext,
  MUTATION_OUTCOME_STATE
} from '../../src/application/resilience/mutationAttemptContext.js';
import { ReconcileMutationAttempt } from '../../src/application/resilience/reconcileMutationAttempt.js';

const PROJECT_ID = 'finance-control-post-commit-test';
const NOW = '2026-09-01T12:00:00.000Z';

let testEnv;

function auth(overrides = {}) {
  return {
    actorUid: 'post-user',
    actorType: 'user',
    role: 'user',
    accountStatus: 'active',
    ownerUid: 'post-user',
    permissions: [],
    correlationId: 'corr-post',
    sourceChannel: 'web',
    ...overrides
  };
}

function profile(uid, status = 'active') {
  return {
    uid,
    email: `${uid}@example.test`,
    role: 'user',
    status,
    created_at: NOW,
    updated_at: NOW,
    last_login_at: NOW
  };
}

function dbFor(uid = 'post-user') {
  return testEnv.authenticatedContext(uid, { email: `${uid}@example.test` }).firestore();
}

async function seedProfile(uid = 'post-user') {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), `users/${uid}`), profile(uid));
  });
}

function expensePayload(overrides = {}) {
  return {
    person: 'Jadson',
    macroCategory: 'Casa',
    categoryName: 'Energia',
    description: 'Despesa post commit',
    amount: 90,
    status: 'Em aberto',
    paymentMethod: 'Pix',
    occurredDate: '2026-09-01',
    dueDate: '2026-09-10',
    competence: '2026-09',
    ...overrides
  };
}

function command(commandName, payload, attempt) {
  return {
    commandName,
    schemaVersion: 1,
    actor: { type: 'user', id: 'post-user', role: 'user' },
    source: { channel: 'web', referenceId: 'post-commit-emulator' },
    idempotencyKey: attempt.idempotencyKey,
    correlationId: attempt.correlationId,
    requestedAt: attempt.createdAt,
    payload
  };
}

function dependencies(db) {
  const financeRecords = new InMemoryFinanceRecordRepository({
    idGenerator: (() => {
      let index = 1;
      return () => `emulator-record-${index++}`;
    })(),
    now: () => NOW
  });
  const audit = new InMemoryAuditRepository({
    idGenerator: (() => {
      let index = 1;
      return () => `emulator-audit-${index++}`;
    })()
  });
  const idempotency = new FirebaseWebIdempotencyRepository({ db, now: () => NOW });
  const errorReporter = new InMemoryErrorReporter({ now: () => NOW });
  return {
    repositories: { financeRecords, audit, idempotency },
    services: { errorReporter },
    clock: { now: () => NOW },
    idGenerator: () => 'post-id'
  };
}

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync('firestore.rules', 'utf8')
    }
  });
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await seedProfile();
});

afterAll(async () => {
  await testEnv.cleanup();
});

describe('post-commit reconciliation with Firestore Emulator', () => {
  it('reconciles CreateExpense response loss without duplicate expense, receipt or audit', async () => {
    const db = dbFor();
    const deps = dependencies(db);
    const gateway = createDefaultApplicationGateway({ dependencies: deps, now: () => NOW, authContextProvider: () => auth() });
    const payload = expensePayload();
    const attempt = createMutationAttemptContext({
      commandName: 'CreateExpenseCommand',
      sourceChannel: 'web',
      payload,
      context: auth(),
      createdAt: NOW
    });
    const lost = await gateway.executeCommand(command('CreateExpenseCommand', payload, attempt), {
      authContext: auth(),
      afterMutationBeforeApplicationResult: () => {
        throw Object.assign(new Error('lost after completed receipt'), { code: 'deadline-exceeded' });
      }
    });
    const expensesAfterLoss = await deps.repositories.financeRecords.list({ type: 'saida' }, auth());
    const auditsAfterLoss = await deps.repositories.audit.listByCorrelationId(attempt.correlationId, auth());
    const receiptsAfterLoss = await deps.repositories.idempotency.list({ commandName: 'CreateExpenseCommand' }, auth());
    const reconciled = await ReconcileMutationAttempt({
      attempt,
      payload,
      context: auth({ correlationId: attempt.correlationId }),
      repositories: deps.repositories,
      now: () => NOW
    });
    const replay = await gateway.executeCommand(command('CreateExpenseCommand', payload, attempt), { authContext: auth() });
    const expensesAfterReplay = await deps.repositories.financeRecords.list({ type: 'saida' }, auth());
    const auditsAfterReplay = await deps.repositories.audit.listByCorrelationId(attempt.correlationId, auth());

    expect(lost.success).toBe(false);
    expect(lost.data.mutationOutcome).toBe(MUTATION_OUTCOME_STATE.UNCERTAIN);
    expect(expensesAfterLoss.count).toBe(1);
    expect(receiptsAfterLoss.items).toHaveLength(1);
    expect(receiptsAfterLoss.items[0].status).toBe('completed');
    expect(auditsAfterLoss.count).toBe(1);
    expect(reconciled.data.mutationOutcome).toBe(MUTATION_OUTCOME_STATE.RECONCILED_SUCCESS);
    expect(reconciled.entityId).toBe(expensesAfterLoss.items[0].id);
    expect(replay.code).toBe(APPLICATION_RESULT_CODES.IDEMPOTENT_REPLAY);
    expect(expensesAfterReplay.count).toBe(1);
    expect(auditsAfterReplay.count).toBe(1);
  });

  it('keeps one batch receipt and one installment series after response loss', async () => {
    const db = dbFor();
    const deps = dependencies(db);
    const gateway = createDefaultApplicationGateway({ dependencies: deps, now: () => NOW, authContextProvider: () => auth() });
    const payload = {
      ...expensePayload({ amount: 200 }),
      installments: 2,
      totalAmount: 200,
      baseDueDate: '2026-09-15',
      parentId: 'series-emulator-post'
    };
    const attempt = createMutationAttemptContext({
      commandName: 'CreateInstallmentSeriesCommand',
      sourceChannel: 'web',
      payload,
      context: auth(),
      createdAt: NOW
    });
    const lost = await gateway.executeCommand(command('CreateInstallmentSeriesCommand', payload, attempt), {
      authContext: auth(),
      afterMutationBeforeApplicationResult: () => {
        throw new Error('lost after batch completed');
      }
    });
    const replay = await gateway.executeCommand(command('CreateInstallmentSeriesCommand', payload, attempt), { authContext: auth() });
    const records = await deps.repositories.financeRecords.findBySeriesId('series-emulator-post', auth());
    const receipts = await deps.repositories.idempotency.list({ commandName: 'CreateInstallmentSeriesCommand' }, auth());
    const audits = await deps.repositories.audit.listByCorrelationId(attempt.correlationId, auth());

    expect(lost.data.mutationOutcome).toBe(MUTATION_OUTCOME_STATE.UNCERTAIN);
    expect(replay.code).toBe(APPLICATION_RESULT_CODES.IDEMPOTENT_REPLAY);
    expect(records.count).toBe(2);
    expect(receipts.items).toHaveLength(1);
    expect(audits.count).toBe(1);
  });
});
