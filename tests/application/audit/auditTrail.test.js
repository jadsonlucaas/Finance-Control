import { describe, expect, it } from 'vitest';
import { AuditTrailService } from '../../../src/application/audit/AuditTrailService.js';
import {
  AUDIT_EVENT_REGISTRY,
  buildAuditEvent,
  sanitizeAuditSnapshot,
  validateAuditEvent
} from '../../../src/application/audit/auditEvents.js';
import { InMemoryAuditRepository } from '../../../src/application/repositories/inMemoryRepositories.js';
import { repositoryFailure, repositoryOk, REPOSITORY_ERROR_CODES } from '../../../src/application/repositories/repositoryResult.js';

const NOW = '2026-08-22T12:00:00.000Z';
const context = {
  actorUid: 'owner-1',
  actorType: 'user',
  role: 'user',
  ownerUid: 'owner-1',
  sourceChannel: 'web',
  correlationId: 'corr-audit'
};

function validInput(overrides = {}) {
  return {
    action: 'finance_record.create',
    entityType: 'finance_record',
    entityId: 'expense-1',
    after: { type: 'saida', amount: 100, status: 'Em aberto', competence: '2026-08' },
    context,
    ...overrides
  };
}

class IdentityAwareAuditRepository {
  constructor() {
    this.events = new Map();
  }

  async append(event = {}) {
    const id = event.event_id || event.id || '';
    const existing = this.events.get(id);
    if (existing) {
      const sameSemanticEvent = existing.event_type === event.event_type &&
        existing.owner_uid === event.owner_uid &&
        existing.entity_type === event.entity_type &&
        existing.entity_id === event.entity_id &&
        existing.correlation_id === event.correlation_id &&
        JSON.stringify(existing.after ?? null) === JSON.stringify(event.after ?? null);
      if (!sameSemanticEvent) {
        return repositoryFailure({
          code: REPOSITORY_ERROR_CODES.CONFLICT,
          message: 'Evento de auditoria ja existe com identidade incompativel.',
          data: { existing }
        });
      }
      return repositoryOk({ id, data: existing });
    }
    const entry = { ...event, id, event_id: id };
    this.events.set(id, entry);
    return repositoryOk({ id, data: entry });
  }

  async list() {
    const items = [...this.events.values()];
    return repositoryOk({ items, data: items, count: items.length });
  }
}

describe('AuditEvent contract', () => {
  it('builds a valid canonical event while preserving legacy aliases', () => {
    const { event, validation } = buildAuditEvent(validInput(), {
      now: () => NOW,
      idGenerator: () => 'audit-1'
    });

    expect(validation.isValid).toBe(true);
    expect(event).toMatchObject({
      event_id: 'audit-1',
      event_type: 'EXPENSE_CREATED',
      event_version: 1,
      occurred_at: NOW,
      actor_uid: 'owner-1',
      actor_type: 'user',
      owner_uid: 'owner-1',
      source_channel: 'web',
      operation: 'finance_record.create',
      entity_type: 'finance_record',
      entity_id: 'expense-1',
      correlation_id: 'corr-audit',
      result_status: 'success',
      schema_version: 1,
      action: 'finance_record.create',
      status: 'success',
      source: 'web'
    });
  });

  it('rejects invalid event_type, missing correlation, invalid source/status, missing owner and schema', () => {
    const { event } = buildAuditEvent(validInput({
      event_type: 'NOPE',
      action: 'unknown.audit_action',
      context: { ...context, correlationId: '', sourceChannel: 'whatsapp', ownerUid: '' },
      result_status: 'done'
    }), { now: () => NOW, idGenerator: () => 'audit-invalid' });
    event.owner_uid = '';
    event.schema_version = 0;
    const validation = validateAuditEvent(event);
    expect(validation.errors.map((error) => error.code)).toEqual(expect.arrayContaining([
      'EVENT_TYPE_INVALID',
      'CORRELATION_ID_REQUIRED',
      'SOURCE_CHANNEL_INVALID',
      'RESULT_STATUS_INVALID',
      'OWNER_UID_REQUIRED',
      'SCHEMA_VERSION_INVALID'
    ]));
  });

  it('keeps an explicit registry with event categories', () => {
    expect(AUDIT_EVENT_REGISTRY.USER_ROLE_CHANGED.category).toBe('admin');
    expect(AUDIT_EVENT_REGISTRY.IMPORT_COMMITTED.category).toBe('operational');
    expect(AUDIT_EVENT_REGISTRY.EXPENSE_CREATED.category).toBe('financial');
  });
});

describe('audit sanitization', () => {
  it('removes forbidden fields, truncates large snapshots and does not mutate input', () => {
    const input = {
      amount: 10,
      status: 'Pago',
      category: 'Casa',
      password: 'secret',
      token: 'secret',
      telefone: '559999',
      nested: { refreshToken: 'secret', raw_file: 'bytes', competence: '2026-08' },
      notes: 'x'.repeat(20000)
    };
    const original = JSON.parse(JSON.stringify(input));
    const result = sanitizeAuditSnapshot(input, { maxBytes: 100 });

    expect(JSON.stringify(result.value)).not.toMatch(/secret|559999|bytes/);
    expect(result.warnings).toEqual(expect.arrayContaining([
      'AUDIT_FIELD_REMOVED:password',
      'AUDIT_FIELD_REMOVED:token',
      'AUDIT_FIELD_REMOVED:telefone',
      'AUDIT_FIELD_REMOVED:refreshToken',
      'AUDIT_FIELD_REMOVED:raw_file',
      'AUDIT_SNAPSHOT_SIZE_TRUNCATED'
    ]));
    expect(input).toEqual(original);
  });

  it('supports circular data and useful financial fields', () => {
    const input = { amount: 20, status: 'Em aberto', competence: '2026-08' };
    input.self = input;
    const result = sanitizeAuditSnapshot(input);
    expect(result.value).toMatchObject({ amount: 20, status: 'Em aberto', competence: '2026-08', self: '[circular]' });
  });
});

describe('AuditTrailService and repository contract', () => {
  it('records success, failure, replay and conflict with preserved correlation', async () => {
    const repository = new InMemoryAuditRepository({ idGenerator: () => 'repo-audit' });
    const service = new AuditTrailService({
      auditRepository: repository,
      clock: { now: () => NOW },
      idGenerator: (() => {
        let index = 1;
        return () => `event-${index++}`;
      })()
    });

    await service.recordSuccess(validInput(), context);
    await service.recordFailure(validInput({ action: 'IMPORT_FAILED', entityType: 'import_batch', entityId: 'batch-1' }), context);
    await service.recordReplay(validInput({ action: 'IDEMPOTENCY_REPLAY', entityType: 'idempotency_receipt', entityId: 'idem-1' }), context);
    await service.recordConflict(validInput({ action: 'IDEMPOTENCY_CONFLICT', entityType: 'idempotency_receipt', entityId: 'idem-2' }), context);
    const byCorrelation = await repository.listByCorrelationId('corr-audit', context);

    expect(byCorrelation.count).toBe(4);
    expect(byCorrelation.items.map((event) => event.result_status)).toEqual(['success', 'failure', 'replay', 'conflict']);
    expect(byCorrelation.items.every((event) => event.correlation_id === 'corr-audit')).toBe(true);
  });

  it('makes repository failures observable and exposes append-only query methods', async () => {
    const repository = new InMemoryAuditRepository();
    repository.failNext('append');
    const service = new AuditTrailService({ auditRepository: repository, clock: { now: () => NOW }, idGenerator: () => 'event-fail' });
    const failed = await service.recordSuccess(validInput(), context);

    expect(failed.ok).toBe(false);
    expect(typeof repository.update).toBe('undefined');
    expect(typeof repository.delete).toBe('undefined');

    const ok = await service.recordSuccess(validInput({ entityId: 'expense-2' }), context);
    expect(ok.ok).toBe(true);
    await service.recordSuccess(validInput({ entityId: 'other', context: { ...context, actorUid: 'owner-2', ownerUid: 'owner-2' } }), { ...context, actorUid: 'owner-2', ownerUid: 'owner-2' });

    expect((await repository.getById(ok.id, context)).ok).toBe(true);
    expect((await repository.listByEntity('finance_record', 'expense-2', context)).count).toBe(1);
    expect((await repository.listByOwner({ ownerUid: 'owner-1' }, context)).count).toBe(1);
    expect((await repository.listByOwner({ ownerUid: 'owner-2' }, { ...context, actorUid: 'owner-2', ownerUid: 'owner-2' })).count).toBe(1);
    expect((await repository.list({ limit: 1 })).count).toBe(1);
  });

  it('runs without DOM or window and supports future integration actors', async () => {
    const repository = new InMemoryAuditRepository();
    const service = new AuditTrailService({ auditRepository: repository, clock: { now: () => NOW }, idGenerator: () => 'event-integration' });
    const integrationContext = {
      actorUid: 'integration-worker',
      actorType: 'integration',
      role: 'integration',
      ownerUid: 'owner-1',
      sourceChannel: 'future_integration',
      correlationId: 'corr-future'
    };
    const result = await service.recordSuccess(validInput({
      context: integrationContext,
      action: 'finance_record.create_income',
      entityType: 'finance_record',
      entityId: 'income-1'
    }), integrationContext);

    expect(result.ok).toBe(true);
    expect(result.data).toMatchObject({
      actor_type: 'integration',
      source_channel: 'future_integration',
      event_type: 'INCOME_CREATED'
    });
    expect(globalThis.window).toBeUndefined();
  });

  it('keeps distinct hour operations separated even with the same controlled clock', async () => {
    const repository = new InMemoryAuditRepository();
    const ids = ['hour-audit-create', 'hour-audit-update'];
    const service = new AuditTrailService({
      auditRepository: repository,
      clock: { now: () => NOW },
      idGenerator: () => ids.shift()
    });

    await service.recordSuccess(validInput({
      action: 'finance_record.create_hour_entry',
      entityType: 'finance_record',
      entityId: 'hour-1',
      after: { type: 'controle_horas', net_minutes: 480 }
    }), context);
    await service.recordSuccess(validInput({
      action: 'finance_record.update_hour_entry',
      entityType: 'finance_record',
      entityId: 'hour-1',
      before: { type: 'controle_horas', net_minutes: 480 },
      after: { type: 'controle_horas', net_minutes: 540 }
    }), context);

    const events = (await repository.list()).items;
    expect(events.map((event) => event.event_type)).toEqual(['HOUR_ENTRY_CREATED', 'HOUR_ENTRY_UPDATED']);
    expect(events.map((event) => event.event_id)).toEqual(['hour-audit-create', 'hour-audit-update']);
    expect(new Set(events.map((event) => event.event_id))).toHaveLength(2);
    expect(events.every((event) => event.occurred_at === NOW && event.entity_id === 'hour-1')).toBe(true);
  });

  it('treats the same event identity and compatible content as replay without appending again', async () => {
    const repository = new IdentityAwareAuditRepository();
    const service = new AuditTrailService({
      auditRepository: repository,
      clock: { now: () => NOW },
      idGenerator: () => 'hour-audit-replay'
    });
    const input = validInput({
      action: 'finance_record.create_hour_entry',
      entityType: 'finance_record',
      entityId: 'hour-replay',
      after: { type: 'controle_horas', net_minutes: 480 }
    });

    const first = await service.recordSuccess(input, context);
    const replay = await service.recordSuccess(input, context);
    const events = await repository.list();

    expect(first.ok).toBe(true);
    expect(replay.ok).toBe(true);
    expect(events.count).toBe(1);
    expect(events.items[0]).toMatchObject({ event_id: 'hour-audit-replay', event_type: 'HOUR_ENTRY_CREATED' });
  });

  it('preserves the original audit event when the same identity has incompatible content', async () => {
    const repository = new IdentityAwareAuditRepository();
    const service = new AuditTrailService({
      auditRepository: repository,
      clock: { now: () => NOW },
      idGenerator: () => 'hour-audit-conflict'
    });

    const first = await service.recordSuccess(validInput({
      action: 'finance_record.create_hour_entry',
      entityType: 'finance_record',
      entityId: 'hour-original',
      after: { type: 'controle_horas', net_minutes: 480 }
    }), context);
    const conflict = await service.recordSuccess(validInput({
      action: 'finance_record.update_hour_entry',
      entityType: 'finance_record',
      entityId: 'hour-other',
      after: { type: 'controle_horas', net_minutes: 540 }
    }), context);
    const events = await repository.list();

    expect(first.ok).toBe(true);
    expect(conflict).toMatchObject({
      ok: false,
      code: REPOSITORY_ERROR_CODES.CONFLICT,
      message: 'Evento de auditoria ja existe com identidade incompativel.'
    });
    expect(events.count).toBe(1);
    expect(events.items[0]).toMatchObject({ event_id: 'hour-audit-conflict', entity_id: 'hour-original' });
  });
});
