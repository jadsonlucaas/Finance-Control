import { AuditTrailService } from '../src/application/audit/AuditTrailService.js';
import {
  buildAuditEvent,
  sanitizeAuditSnapshot,
  validateAuditEvent
} from '../src/application/audit/auditEvents.js';
import { InMemoryAuditRepository } from '../src/application/repositories/inMemoryRepositories.js';

const NOW = '2026-08-22T12:00:00.000Z';
const context = {
  actorUid: 'dry-user',
  actorType: 'user',
  role: 'user',
  ownerUid: 'dry-user',
  sourceChannel: 'web',
  correlationId: 'audit-dry-run'
};

const fixtures = [
  { action: 'finance_record.create', entityId: 'expense-1', after: { type: 'saida', amount: 10, status: 'Em aberto' } },
  { action: 'finance_record.update', entityId: 'expense-1', before: { amount: 10 }, after: { amount: 15 } },
  { event_type: 'IDEMPOTENCY_REPLAY', action: 'IDEMPOTENCY_REPLAY', entityType: 'idempotency_receipt', entityId: 'idem-1', result_status: 'replay' },
  { action: 'IMPORT_COMMITTED', entityType: 'import_batch', entityId: 'batch-1', after: { count: 2 } },
  { action: 'PERCENTAGE_RULE_OCCURRENCE_CREATED', entityId: 'pct-1', after: { amount: 50 } },
  { action: 'admin.user_role_change', entityType: 'user', entityId: 'user-2', actorType: 'admin', after: { role: 'admin' } },
  { action: 'finance_record.create', entityId: 'bad-secret', after: { amount: 1, password: 'nope', token: 'nope', telefone: '5599' } },
  { action: 'finance_record.update', entityId: 'big', after: { notes: 'x'.repeat(20000), amount: 1 } },
  { action: 'finance_record.create', entityId: 'missing-corr', context: { ...context, correlationId: '' } },
  { action: 'finance_record.create', entityId: 'bad-source', context: { ...context, sourceChannel: 'whatsapp' } }
];

const repository = new InMemoryAuditRepository({ idGenerator: (() => {
  let index = 1;
  return () => `audit_dry_${index++}`;
})() });
const service = new AuditTrailService({
  auditRepository: repository,
  clock: { now: () => NOW },
  idGenerator: (() => {
    let index = 1;
    return () => `event_dry_${index++}`;
  })()
});

const results = [];
for (const fixture of fixtures) {
  const fixtureContext = fixture.context || {
    ...context,
    actorType: fixture.actorType || context.actorType,
    role: fixture.actorType === 'admin' ? 'admin' : context.role
  };
  const built = buildAuditEvent({ ...fixture, context: fixtureContext }, {
    now: () => NOW,
    idGenerator: () => `preview_${results.length + 1}`
  });
  let persisted = null;
  if (built.validation.isValid) {
    if (built.event.result_status === 'replay') {
      persisted = await service.recordReplay({ ...fixture, context: fixtureContext }, fixtureContext);
    } else if (built.event.result_status === 'failure') {
      persisted = await service.recordFailure({ ...fixture, context: fixtureContext }, fixtureContext);
    } else if (built.event.result_status === 'conflict') {
      persisted = await service.recordConflict({ ...fixture, context: fixtureContext }, fixtureContext);
    } else {
      persisted = await service.recordSuccess({ ...fixture, context: fixtureContext }, fixtureContext);
    }
  }
  const snapshot = sanitizeAuditSnapshot({ before: fixture.before, after: fixture.after }, { maxBytes: 100 });
  results.push({
    fixture: fixture.action || fixture.event_type,
    valid: built.validation.isValid,
    invalid: !built.validation.isValid,
    sanitized: snapshot.warnings.some((warning) => warning.includes('REMOVED')),
    truncated: snapshot.warnings.includes('AUDIT_SNAPSHOT_SIZE_TRUNCATED'),
    errors: built.validation.errors,
    warnings: [...new Set([...built.warnings, ...snapshot.warnings])],
    wrote: false,
    persistedInMemory: Boolean(persisted?.ok)
  });
}

const summary = {
  ok: results.every((item) => item.wrote === false),
  wrote: false,
  valid: results.filter((item) => item.valid).length,
  invalid: results.filter((item) => item.invalid).length,
  sanitized: results.filter((item) => item.sanitized).length,
  truncated: results.filter((item) => item.truncated).length,
  results
};

console.log(JSON.stringify(summary, null, 2));
