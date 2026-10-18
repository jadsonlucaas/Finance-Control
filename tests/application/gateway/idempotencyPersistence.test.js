import { describe, expect, it, vi } from 'vitest';
import { createApplicationDependencies } from '../../../src/application/dependencies/createApplicationDependencies.js';
import { createDefaultApplicationGateway } from '../../../src/application/gateway/defaultApplicationGateway.js';
import {
  buildOperationFingerprint,
  receiptDocumentId
} from '../../../src/application/gateway/idempotency.js';
import {
  normalizeOperationMetadata,
  validateOperationMetadata
} from '../../../src/application/gateway/operationMetadata.js';
import { APPLICATION_RESULT_CODES } from '../../../src/application/gateway/applicationResult.js';
import { InMemoryIdempotencyRepository } from '../../../src/application/repositories/inMemoryIdempotencyRepository.js';

const NOW = '2026-08-22T12:00:00.000Z';
const now = () => NOW;

function auth(overrides = {}) {
  return {
    actorUid: 'owner-1',
    actorType: 'user',
    role: 'user',
    accountStatus: 'active',
    ownerUid: 'owner-1',
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
    occurredDate: '2026-08-10',
    dueDate: '2026-08-20',
    competence: '2026-08',
    ...overrides
  };
}

function command(payload = {}, overrides = {}) {
  return {
    commandName: 'CreateExpenseCommand',
    schemaVersion: 1,
    actor: { type: 'user', id: 'owner-1', role: 'user' },
    source: { channel: 'web', referenceId: 'screen-submit-1' },
    correlationId: 'corr-1',
    requestedAt: NOW,
    payload: expensePayload(payload),
    ...overrides
  };
}

describe('operation metadata contract', () => {
  it('normalizes valid metadata without using source as authorization', () => {
    const metadata = normalizeOperationMetadata({
      sourceChannel: 'future_integration',
      sourceReferenceId: 'external-message-id',
      idempotencyKey: 'idem-1',
      correlationId: 'corr-1'
    }, auth({ ownerUid: 'owner-1', actorUid: 'actor-1', actorType: 'integration' }));
    expect(metadata).toMatchObject({
      schema_version: 1,
      source_channel: 'future_integration',
      source_reference_id: 'external-message-id',
      idempotency_key: 'idem-1',
      correlation_id: 'corr-1',
      created_by_type: 'integration',
      created_by_id: 'actor-1'
    });
    expect(metadata.owner_uid).toBeUndefined();
  });

  it('rejects invalid channels, empty text and disallowed provider fields', () => {
    expect(validateOperationMetadata({ source_channel: 'messenger' }).errors[0].code).toBe('SOURCE_CHANNEL_INVALID');
    expect(validateOperationMetadata({ idempotency_key: '' }).errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: 'idempotency_key' })
    ]));
    expect(validateOperationMetadata({ correlation_id: '' }).errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: 'correlation_id' })
    ]));
    expect(validateOperationMetadata({ phone: '559999999999' }).errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'DISALLOWED_TECHNICAL_FIELD' })
    ]));
  });
});

describe('operation fingerprint', () => {
  it('is deterministic, ignores volatile fields and changes with financial data', () => {
    const base = {
      ownerUid: 'owner-1',
      commandName: 'CreateExpenseCommand',
      sourceChannel: 'web',
      payload: { amount: 10, category: 'Casa', requestedAt: 'a', correlationId: 'corr-a' }
    };
    const reordered = {
      ...base,
      payload: { correlationId: 'corr-b', category: 'Casa', requestedAt: 'b', amount: 10 }
    };
    const changed = { ...base, payload: { amount: 11, category: 'Casa' } };
    expect(buildOperationFingerprint(base)).toBe(buildOperationFingerprint(reordered));
    expect(buildOperationFingerprint(base)).not.toBe(buildOperationFingerprint(changed));
    expect(buildOperationFingerprint(base)).toBe(buildOperationFingerprint(base));
  });
});

describe('in-memory idempotency repository', () => {
  it('reserves, replays completed receipts and isolates owner, command and source', async () => {
    const repository = new InMemoryIdempotencyRepository({ now });
    const input = {
      ownerUid: 'owner-1',
      commandName: 'CreateExpenseCommand',
      sourceChannel: 'web',
      idempotencyKey: 'idem-1',
      requestFingerprint: 'fp-1',
      correlationId: 'corr-1'
    };
    const first = await repository.reserve(input, auth());
    await repository.complete(first.id, { success: true, code: 'OK', entityId: 'expense-1', entityIds: ['expense-1'] }, auth());
    const replay = await repository.reserve(input, auth());
    const otherOwner = await repository.reserve({ ...input, ownerUid: 'owner-2' }, auth({ ownerUid: 'owner-2' }));
    const otherCommand = await repository.reserve({ ...input, commandName: 'CreateIncomeCommand' }, auth());
    const otherSource = await repository.reserve({ ...input, sourceChannel: 'bank_import' }, auth());

    expect(first.data.reservation_status).toBe('reserved');
    expect(replay.data.reservation_status).toBe('replay');
    expect(replay.data.entity_id).toBe('expense-1');
    expect(otherOwner.ok).toBe(true);
    expect(otherCommand.ok).toBe(true);
    expect(otherSource.ok).toBe(true);
  });

  it('conflicts on processing or different fingerprint and permits retry after failed', async () => {
    const repository = new InMemoryIdempotencyRepository({ now });
    const input = {
      ownerUid: 'owner-1',
      commandName: 'CreateExpenseCommand',
      sourceChannel: 'web',
      idempotencyKey: 'idem-1',
      requestFingerprint: 'fp-1'
    };
    const first = await repository.reserve(input, auth());
    const processing = await repository.reserve(input, auth());
    const conflict = await repository.reserve({ ...input, requestFingerprint: 'fp-2' }, auth());
    await repository.fail(first.id, { code: 'PERSISTENCE_ERROR' }, auth());
    const retry = await repository.reserve(input, auth());
    retry.data.status = 'tampered';
    const stored = await repository.getById(first.id, auth());

    expect(processing.ok).toBe(false);
    expect(conflict.ok).toBe(false);
    expect(retry.data.reservation_status).toBe('retry');
    expect(stored.data.status).toBe('processing');
    expect(receiptDocumentId(input)).toBe(first.id);
  });
});

describe('gateway persistent idempotency pilot', () => {
  it('keeps commands without key working and queries without receipts', async () => {
    const dependencies = createApplicationDependencies({ mode: 'memory', now });
    const spy = vi.spyOn(dependencies.repositories.idempotency, 'reserve');
    const gateway = createDefaultApplicationGateway({
      dependencies,
      now,
      authContextProvider: () => auth()
    });
    const result = await gateway.executeCommand(command(), { authContext: auth() });
    const query = await gateway.executeQuery({
      queryName: 'GetMonthlySummaryQuery',
      payload: { competence: '2026-08' },
      actor: { type: 'user', id: 'owner-1' },
      source: { channel: 'web', referenceId: 'q' },
      requestedAt: NOW,
      correlationId: 'corr-q'
    }, { authContext: auth() });
    expect(result.success).toBe(true);
    expect(query.success).toBe(true);
    expect(spy).not.toHaveBeenCalled();
  });

  it('creates CreateExpense once, replays without handler side effects and preserves correlation', async () => {
    const dependencies = createApplicationDependencies({ mode: 'memory', now });
    const gateway = createDefaultApplicationGateway({
      dependencies,
      now,
      authContextProvider: () => auth()
    });
    const first = await gateway.executeCommand(command({}, { idempotencyKey: 'idem-create-1' }), { authContext: auth() });
    const replay = await gateway.executeCommand(command({}, { idempotencyKey: 'idem-create-1' }), { authContext: auth() });
    const listed = await dependencies.repositories.financeRecords.list({}, auth());
    const audit = await dependencies.repositories.audit.getByCorrelationId('corr-1');

    expect(first).toMatchObject({ success: true, code: APPLICATION_RESULT_CODES.OK, correlationId: 'corr-1' });
    expect(replay).toMatchObject({ success: true, code: APPLICATION_RESULT_CODES.IDEMPOTENT_REPLAY, idempotentReplay: true, correlationId: 'corr-1' });
    expect(listed.count).toBe(1);
    expect(audit.count).toBe(1);
  });

  it('conflicts different payloads and keeps same key isolated by owner and command', async () => {
    const dependencies = createApplicationDependencies({ mode: 'memory', now });
    const gateway = createDefaultApplicationGateway({
      dependencies,
      now,
      authContextProvider: () => auth()
    });
    const first = await gateway.executeCommand(command({}, { idempotencyKey: 'idem-shared' }), { authContext: auth() });
    const conflict = await gateway.executeCommand(command({ amount: 999 }, { idempotencyKey: 'idem-shared' }), { authContext: auth() });
    const otherOwner = await gateway.executeCommand(command({}, {
      idempotencyKey: 'idem-shared',
      actor: { type: 'user', id: 'owner-2', role: 'user' }
    }), { authContext: auth({ actorUid: 'owner-2', ownerUid: 'owner-2' }) });
    const otherCommand = await gateway.executeCommand({
      ...command({}, { idempotencyKey: 'idem-shared' }),
      commandName: 'CreateIncomeCommand',
      payload: {
        person: 'Jadson',
        amount: 1000,
        competence: '2026-08',
        occurredDate: '2026-08-05',
        earningType: 'Salario'
      }
    }, { authContext: auth() });

    expect(first.success).toBe(true);
    expect(conflict).toMatchObject({ success: false, code: APPLICATION_RESULT_CODES.CONFLICT });
    expect(otherOwner.success).toBe(true);
    expect(otherCommand.success).toBe(true);
  });

  it('uses one key for an installment series and preserves entity ids on replay', async () => {
    const dependencies = createApplicationDependencies({ mode: 'memory', now });
    const gateway = createDefaultApplicationGateway({
      dependencies,
      now,
      authContextProvider: () => auth()
    });
    const seriesCommand = {
      ...command({}, {
        commandName: 'CreateInstallmentSeriesCommand',
        idempotencyKey: 'idem-series-1'
      }),
      payload: {
        ...expensePayload({ amount: 300 }),
        installments: 3,
        totalAmount: 300,
        baseDueDate: '2026-08-10',
        parentId: 'series-1'
      }
    };
    const first = await gateway.executeCommand(seriesCommand, { authContext: auth() });
    const replay = await gateway.executeCommand(seriesCommand, { authContext: auth() });
    const listed = await dependencies.repositories.financeRecords.list({}, auth());

    expect(first.entityIds).toHaveLength(3);
    expect(replay).toMatchObject({
      code: APPLICATION_RESULT_CODES.IDEMPOTENT_REPLAY,
      entityIds: first.entityIds
    });
    expect(listed.count).toBe(3);
    expect(listed.items.every((item) => item.idempotency_key === 'idem-series-1')).toBe(true);
    expect(listed.items.every((item) => item.parent_id === 'series-1')).toBe(true);
  });
});
