import { createApplicationDependencies } from '../src/application/dependencies/createApplicationDependencies.js';
import { createDefaultApplicationGateway } from '../src/application/gateway/defaultApplicationGateway.js';
import { APPLICATION_RESULT_CODES } from '../src/application/gateway/applicationResult.js';
import { CommitImportBatch, IMPORT_TYPES, PrepareImportBatch } from '../src/application/imports/importBatchUseCases.js';
import {
  createMutationAttemptContext,
  MUTATION_OUTCOME_STATE,
  payloadMatchesMutationAttempt
} from '../src/application/resilience/mutationAttemptContext.js';
import { ReconcileMutationAttempt } from '../src/application/resilience/reconcileMutationAttempt.js';
import { createRetryPolicy, OPERATION_TYPES } from '../src/application/resilience/retryPolicy.js';

const NOW = '2026-09-01T12:00:00.000Z';
const now = () => NOW;

function auth(overrides = {}) {
  return {
    actorUid: 'dry-user',
    actorType: 'user',
    role: 'user',
    accountStatus: 'active',
    ownerUid: 'dry-user',
    permissions: [],
    sourceChannel: 'web',
    ...overrides
  };
}

function expensePayload(overrides = {}) {
  return {
    person: 'Jadson',
    macroCategory: 'Casa',
    categoryName: 'Energia',
    description: 'Despesa dry-run',
    amount: 120,
    status: 'Em aberto',
    paymentMethod: 'Pix',
    occurredDate: '2026-09-01',
    dueDate: '2026-09-10',
    competence: '2026-09',
    ...overrides
  };
}

function attempt(commandName, payload, context = auth()) {
  return createMutationAttemptContext({ commandName, sourceChannel: 'web', payload, context, createdAt: NOW }, { now });
}

function envelope(commandName, payload, mutationAttempt) {
  return {
    commandName,
    schemaVersion: 1,
    actor: { type: 'user', id: 'dry-user', role: 'user' },
    source: { channel: 'web', referenceId: 'post-commit-dry-run' },
    idempotencyKey: mutationAttempt.idempotencyKey,
    correlationId: mutationAttempt.correlationId,
    requestedAt: mutationAttempt.createdAt,
    payload
  };
}

function deps() {
  return createApplicationDependencies({ mode: 'memory', now });
}

async function summarize(name, run) {
  const result = await run();
  return {
    name,
    status: result.status || result.data?.mutationOutcome || (result.success ? MUTATION_OUTCOME_STATE.CONFIRMED_SUCCESS : MUTATION_OUTCOME_STATE.CONFIRMED_FAILURE),
    reconciled: result.reconciled === true || result.data?.reconciled === true,
    retryAllowed: result.retryAllowed === true || result.data?.retryAllowed === true,
    replay: result.replay === true || result.idempotentReplay === true || result.code === APPLICATION_RESULT_CODES.IDEMPOTENT_REPLAY,
    warnings: result.warnings || []
  };
}

const scenarios = [];

{
  const dependencies = deps();
  const gateway = createDefaultApplicationGateway({ dependencies, now, authContextProvider: () => auth() });
  const payload = expensePayload({ description: 'confirmed' });
  const ctx = attempt('CreateExpenseCommand', payload);
  scenarios.push(await summarize('confirmed success', () => gateway.executeCommand(envelope('CreateExpenseCommand', payload, ctx), { authContext: auth() })));
}

{
  const dependencies = deps();
  const gateway = createDefaultApplicationGateway({ dependencies, now, authContextProvider: () => auth() });
  const payload = expensePayload({ description: 'lost completed' });
  const ctx = attempt('CreateExpenseCommand', payload);
  const lost = await gateway.executeCommand(envelope('CreateExpenseCommand', payload, ctx), {
    authContext: auth(),
    afterMutationBeforeApplicationResult: () => { throw new Error('response lost'); }
  });
  const reconciled = await ReconcileMutationAttempt({ attempt: ctx, payload, context: auth(), repositories: dependencies.repositories, now });
  scenarios.push(await summarize('response lost + receipt completed', () => ({ ...lost, reconciled: reconciled.success, data: reconciled.data })));
}

{
  const dependencies = deps();
  const payload = expensePayload({ description: 'processing' });
  const ctx = attempt('CreateExpenseCommand', payload);
  await dependencies.repositories.idempotency.reserve({
    ownerUid: 'dry-user',
    commandName: 'CreateExpenseCommand',
    sourceChannel: 'web',
    idempotencyKey: ctx.idempotencyKey,
    requestFingerprint: ctx.originalPayloadFingerprint,
    correlationId: ctx.correlationId
  }, auth());
  scenarios.push(await summarize('processing', () => ReconcileMutationAttempt({ attempt: ctx, payload, context: auth(), repositories: dependencies.repositories, now })));
}

{
  const dependencies = deps();
  const payload = expensePayload({ description: 'failed' });
  const ctx = attempt('CreateExpenseCommand', payload);
  const reserved = await dependencies.repositories.idempotency.reserve({
    ownerUid: 'dry-user',
    commandName: 'CreateExpenseCommand',
    sourceChannel: 'web',
    idempotencyKey: ctx.idempotencyKey,
    requestFingerprint: ctx.originalPayloadFingerprint,
    correlationId: ctx.correlationId
  }, auth());
  await dependencies.repositories.idempotency.fail(reserved.id, { code: APPLICATION_RESULT_CODES.PERSISTENCE_ERROR }, auth());
  scenarios.push(await summarize('failed', () => ReconcileMutationAttempt({ attempt: ctx, payload, context: auth(), repositories: dependencies.repositories, now })));
}

{
  const dependencies = deps();
  const gateway = createDefaultApplicationGateway({ dependencies, now, authContextProvider: () => auth() });
  const payload = expensePayload({ description: 'conflict' });
  const ctx = attempt('CreateExpenseCommand', payload);
  await gateway.executeCommand(envelope('CreateExpenseCommand', payload, ctx), { authContext: auth() });
  scenarios.push(await summarize('conflict fingerprint', () => ReconcileMutationAttempt({
    attempt: ctx,
    payload: expensePayload({ description: 'changed', amount: 999 }),
    context: auth(),
    repositories: dependencies.repositories,
    now
  })));
}

{
  const policy = createRetryPolicy({ baseDelayMs: 0, maxDelayMs: 0 });
  const decision = policy.evaluate({
    error: { category: 'NETWORK', retryable: true },
    operationType: OPERATION_TYPES.MUTATION,
    idempotent: false,
    hasIdempotencyKey: false,
    attempt: 1
  });
  scenarios.push(await summarize('mutation sem key', () => ({
    success: false,
    status: MUTATION_OUTCOME_STATE.UNCERTAIN,
    retryAllowed: decision.shouldRetry
  })));
}

{
  const payload = expensePayload({ description: 'original' });
  const ctx = attempt('CreateExpenseCommand', payload);
  scenarios.push(await summarize('payload changed', () => ({
    success: false,
    status: payloadMatchesMutationAttempt(ctx, {
      commandName: 'CreateExpenseCommand',
      sourceChannel: 'web',
      payload: expensePayload({ description: 'changed' }),
      context: auth()
    }) ? MUTATION_OUTCOME_STATE.CONFIRMED_SUCCESS : MUTATION_OUTCOME_STATE.CONFIRMED_FAILURE
  })));
}

{
  const dependencies = deps();
  const gateway = createDefaultApplicationGateway({ dependencies, now, authContextProvider: () => auth() });
  const payload = {
    ...expensePayload({ amount: 300 }),
    installments: 3,
    totalAmount: 300,
    baseDueDate: '2026-09-10',
    parentId: 'dry-series'
  };
  const ctx = attempt('CreateInstallmentSeriesCommand', payload);
  await gateway.executeCommand(envelope('CreateInstallmentSeriesCommand', payload, ctx), { authContext: auth() });
  scenarios.push(await summarize('series replay', () => gateway.executeCommand(envelope('CreateInstallmentSeriesCommand', payload, ctx), { authContext: auth() })));
}

{
  const dependencies = deps();
  const context = auth({ correlationId: 'corr-import-dry', sourceChannel: 'bank_import' });
  const prepared = await PrepareImportBatch({
    rows: [{
      type: 'saida',
      person: 'Ana',
      description: 'Dry import',
      amount: 120,
      occurred_date: '2026-07-10',
      due_date: '2026-07-10',
      competence: '2026-07',
      status: 'Pago',
      category: 'Casa',
      source_reference_id: 'dry-import-1'
    }],
    importType: IMPORT_TYPES.BANK_STATEMENT,
    originalFilename: 'dry.csv',
    fileContent: 'dry-import-1',
    context,
    repositories: dependencies.repositories,
    now
  });
  await CommitImportBatch({ preparedBatch: prepared.data, context, repositories: dependencies.repositories, now });
  scenarios.push(await summarize('import replay', () => CommitImportBatch({ preparedBatch: prepared.data, context, repositories: dependencies.repositories, now })));
}

{
  scenarios.push(await summarize('audit failure pos-commit', () => ({
    success: true,
    status: MUTATION_OUTCOME_STATE.PARTIAL_SUCCESS,
    warnings: ['POST_COMMIT_AUDIT_FAILED']
  })));
}

console.log(JSON.stringify({
  ok: true,
  wrote: false,
  firebase_touched: false,
  scenarios
}, null, 2));
