import { buildAuditEvent as buildCanonicalAuditEvent } from '../audit/auditEvents.js';
import { AuditTrailService } from '../audit/AuditTrailService.js';

export function buildAuditEvent({
  action = '',
  context = {},
  entityType = 'finance_record',
  entityId = '',
  before = null,
  after = null,
  status = 'success',
  occurredAt = ''
} = {}) {
  return {
    action,
    event_type: '',
    actorUid: context.actorUid || '',
    actorType: context.actorType || '',
    actorRole: context.role || '',
    sourceChannel: context.sourceChannel || '',
    ownerUid: context.ownerUid || '',
    entityType,
    entityId,
    correlationId: context.correlationId || '',
    before,
    after,
    status,
    occurredAt: occurredAt || context.processedAt || context.requestedAt || ''
  };
}

export async function appendAuditEvent(auditRepository, event = {}, context = {}) {
  const service = new AuditTrailService({
    auditRepository,
    clock: { now: () => event.occurredAt || event.occurred_at || context.processedAt || context.requestedAt || new Date().toISOString() },
    idGenerator: () => event.event_id || event.id || `audit_${Date.now()}_${Math.random().toString(16).slice(2)}`
  });
  const status = event.status === 'failure'
    ? 'recordFailure'
    : event.status === 'replay'
      ? 'recordReplay'
      : event.status === 'conflict'
        ? 'recordConflict'
        : 'recordSuccess';
  const result = await service[status]({
    ...event,
    event_type: event.event_type || event.eventType || '',
    eventId: event.event_id || event.id || '',
    actorUid: event.actorUid || event.actor_uid || context.actorUid || '',
    actorType: event.actorType || event.actor_type || context.actorType || '',
    actorRole: event.actorRole || event.actor_role || context.role || '',
    ownerUid: event.ownerUid || event.owner_uid || context.ownerUid || context.actorUid || '',
    sourceChannel: event.sourceChannel || event.source_channel || context.sourceChannel || 'web',
    entityType: event.entityType || event.entity_type || 'finance_record',
    entityId: event.entityId || event.entity_id || '',
    correlationId: event.correlationId || event.correlation_id || context.correlationId || '',
    operation: event.operation || event.action || '',
    before: event.before,
    after: event.after,
    metadata: event.details || event.metadata || {},
    resultCode: event.resultCode || event.result_code || ''
  }, context);
  if (result?.ok) return null;
  return {
    field: 'audit',
    code: result?.code || 'AUDIT_WRITE_FAILED',
    message: result?.message || 'Falha ao registrar auditoria.',
    severity: 'warning'
  };
}

export function normalizeAuditEventForTests(event = {}, context = {}) {
  return buildCanonicalAuditEvent({ ...event, context }).event;
}
