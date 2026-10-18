import { SOURCE_CHANNELS } from '../gateway/operationMetadata.js';

export const AUDIT_EVENT_SCHEMA_VERSION = 1;
export const AUDIT_EVENT_VERSION = 1;
export const AUDIT_RESULT_STATUS = Object.freeze(['success', 'failure', 'replay', 'conflict', 'skipped']);
export const AUDIT_ACTOR_TYPES = Object.freeze(['user', 'admin', 'system', 'integration']);

export const AUDIT_EVENT_TYPES = Object.freeze({
  USER_APPROVED: 'USER_APPROVED',
  USER_DEACTIVATED: 'USER_DEACTIVATED',
  USER_REACTIVATED: 'USER_REACTIVATED',
  USER_ROLE_CHANGED: 'USER_ROLE_CHANGED',
  EXPENSE_CREATED: 'EXPENSE_CREATED',
  EXPENSE_UPDATED: 'EXPENSE_UPDATED',
  EXPENSE_MARKED_PAID: 'EXPENSE_MARKED_PAID',
  EXPENSE_ARCHIVED: 'EXPENSE_ARCHIVED',
  EXPENSE_DELETED: 'EXPENSE_DELETED',
  INCOME_CREATED: 'INCOME_CREATED',
  MONTHLY_INCOME_CONSOLIDATED: 'MONTHLY_INCOME_CONSOLIDATED',
  INSTALLMENT_SERIES_CREATED: 'INSTALLMENT_SERIES_CREATED',
  RECURRENCE_SERIES_CREATED: 'RECURRENCE_SERIES_CREATED',
  HOUR_ENTRY_CREATED: 'HOUR_ENTRY_CREATED',
  HOUR_ENTRY_UPDATED: 'HOUR_ENTRY_UPDATED',
  IMPORT_COMMITTED: 'IMPORT_COMMITTED',
  IMPORT_REPLAYED: 'IMPORT_REPLAYED',
  IMPORT_FAILED: 'IMPORT_FAILED',
  PERCENTAGE_RULE_OCCURRENCE_CREATED: 'PERCENTAGE_RULE_OCCURRENCE_CREATED',
  PERCENTAGE_RULE_OCCURRENCE_ALREADY_EXISTS: 'PERCENTAGE_RULE_OCCURRENCE_ALREADY_EXISTS',
  PERCENTAGE_RULE_MATERIALIZATION_STARTED: 'PERCENTAGE_RULE_MATERIALIZATION_STARTED',
  PERCENTAGE_RULE_MATERIALIZATION_FAILED: 'PERCENTAGE_RULE_MATERIALIZATION_FAILED',
  PERCENTAGE_RULE_RECEIPT_RECONCILED: 'PERCENTAGE_RULE_RECEIPT_RECONCILED',
  IDEMPOTENCY_REPLAY: 'IDEMPOTENCY_REPLAY',
  IDEMPOTENCY_CONFLICT: 'IDEMPOTENCY_CONFLICT',
  BACKUP_CREATED: 'BACKUP_CREATED',
  BACKUP_VALIDATED: 'BACKUP_VALIDATED',
  RESTORE_PREPARED: 'RESTORE_PREPARED',
  RESTORE_COMMITTED: 'RESTORE_COMMITTED',
  RESTORE_FAILED: 'RESTORE_FAILED',
  RESTORE_ROLLBACK_PREPARED: 'RESTORE_ROLLBACK_PREPARED',
  RESTORE_ROLLBACK_COMMITTED: 'RESTORE_ROLLBACK_COMMITTED'
});

export const AUDIT_EVENT_REGISTRY = Object.freeze({
  USER_APPROVED: { category: 'admin', legacyActions: ['admin.user_approve'] },
  USER_DEACTIVATED: { category: 'admin', legacyActions: ['admin.user_deactivate'] },
  USER_REACTIVATED: { category: 'admin', legacyActions: ['admin.user_reactivate'] },
  USER_ROLE_CHANGED: { category: 'admin', legacyActions: ['admin.user_role_change'] },
  EXPENSE_CREATED: { category: 'financial', legacyActions: ['finance_record.create'] },
  EXPENSE_UPDATED: { category: 'financial', legacyActions: ['finance_record.update'] },
  EXPENSE_MARKED_PAID: { category: 'financial', legacyActions: ['finance_record.mark_paid'] },
  EXPENSE_ARCHIVED: { category: 'financial', legacyActions: ['finance_record.archive'] },
  EXPENSE_DELETED: { category: 'financial', legacyActions: ['finance_record.delete'] },
  INCOME_CREATED: { category: 'financial', legacyActions: ['finance_record.create_income'] },
  MONTHLY_INCOME_CONSOLIDATED: { category: 'financial', legacyActions: ['finance_record.consolidate_income'] },
  INSTALLMENT_SERIES_CREATED: { category: 'financial', legacyActions: ['finance_record.create_installment_series'] },
  RECURRENCE_SERIES_CREATED: { category: 'financial', legacyActions: ['finance_record.create_recurrence_series'] },
  HOUR_ENTRY_CREATED: { category: 'financial', legacyActions: ['finance_record.create_hour_entry'] },
  HOUR_ENTRY_UPDATED: { category: 'financial', legacyActions: ['finance_record.update_hour_entry'] },
  IMPORT_COMMITTED: { category: 'operational', legacyActions: ['IMPORT_COMMITTED'] },
  IMPORT_REPLAYED: { category: 'operational', legacyActions: ['IMPORT_REPLAYED'] },
  IMPORT_FAILED: { category: 'operational', legacyActions: ['IMPORT_FAILED'] },
  PERCENTAGE_RULE_OCCURRENCE_CREATED: { category: 'operational', legacyActions: ['PERCENTAGE_RULE_OCCURRENCE_CREATED'] },
  PERCENTAGE_RULE_OCCURRENCE_ALREADY_EXISTS: { category: 'operational', legacyActions: ['PERCENTAGE_RULE_OCCURRENCE_ALREADY_EXISTS'] },
  PERCENTAGE_RULE_MATERIALIZATION_STARTED: { category: 'operational', legacyActions: ['PERCENTAGE_RULE_MATERIALIZATION_STARTED'] },
  PERCENTAGE_RULE_MATERIALIZATION_FAILED: { category: 'operational', legacyActions: ['PERCENTAGE_RULE_MATERIALIZATION_FAILED'] },
  PERCENTAGE_RULE_RECEIPT_RECONCILED: { category: 'operational', legacyActions: ['PERCENTAGE_RULE_RECEIPT_RECONCILED'] },
  IDEMPOTENCY_REPLAY: { category: 'operational', legacyActions: ['IDEMPOTENCY_REPLAY'] },
  IDEMPOTENCY_CONFLICT: { category: 'operational', legacyActions: ['IDEMPOTENCY_CONFLICT'] },
  BACKUP_CREATED: { category: 'operational', legacyActions: ['BACKUP_CREATED'] },
  BACKUP_VALIDATED: { category: 'operational', legacyActions: ['BACKUP_VALIDATED'] },
  RESTORE_PREPARED: { category: 'operational', legacyActions: ['RESTORE_PREPARED'] },
  RESTORE_COMMITTED: { category: 'operational', legacyActions: ['RESTORE_COMMITTED'] },
  RESTORE_FAILED: { category: 'operational', legacyActions: ['RESTORE_FAILED'] },
  RESTORE_ROLLBACK_PREPARED: { category: 'operational', legacyActions: ['RESTORE_ROLLBACK_PREPARED'] },
  RESTORE_ROLLBACK_COMMITTED: { category: 'operational', legacyActions: ['RESTORE_ROLLBACK_COMMITTED'] }
});

const LEGACY_TO_EVENT_TYPE = Object.freeze(Object.entries(AUDIT_EVENT_REGISTRY).reduce((acc, [eventType, config]) => {
  (config.legacyActions || []).forEach((action) => { acc[action] = eventType; });
  return acc;
}, {}));

const BLOCKED_KEYS = Object.freeze([
  'password',
  'token',
  'accesstoken',
  'refreshtoken',
  'credential',
  'secret',
  'phone',
  'telefone',
  'raw_message',
  'raw_file',
  'file_bytes',
  'authorization',
  'cookies',
  'serviceaccount',
  'privatekey'
]);

const DEFAULT_ALLOWED_METADATA = Object.freeze([
  'operation',
  'import_type',
  'import_batch_id',
  'source_reference_id',
  'source_channel',
  'result_code',
  'count',
  'ids',
  'warning',
  'warnings'
]);

function keyToken(key = '') {
  return String(key || '').replace(/[^a-zA-Z0-9_]/g, '').toLowerCase();
}

function byteLength(value) {
  return new TextEncoder().encode(JSON.stringify(value ?? null)).length;
}

function primitive(value) {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return value.length > 300 ? `${value.slice(0, 300)}...` : value;
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  return String(value);
}

export function sanitizeAuditSnapshot(input, policy = {}) {
  const warnings = [];
  const maxDepth = Number(policy.maxDepth || 4);
  const maxArray = Number(policy.maxArray || 25);
  const maxBytes = Number(policy.maxBytes || 12000);
  const seen = new WeakSet();

  function visit(value, depth = 0) {
    if (depth > maxDepth) {
      warnings.push('AUDIT_SNAPSHOT_DEPTH_TRUNCATED');
      return '[truncated-depth]';
    }
    if (value === null || value === undefined || typeof value !== 'object') return primitive(value);
    if (seen.has(value)) {
      warnings.push('AUDIT_SNAPSHOT_CIRCULAR_REMOVED');
      return '[circular]';
    }
    seen.add(value);
    if (Array.isArray(value)) {
      if (value.length > maxArray) warnings.push('AUDIT_SNAPSHOT_ARRAY_TRUNCATED');
      return value.slice(0, maxArray).map((item) => visit(item, depth + 1));
    }
    return Object.entries(value).reduce((acc, [key, item]) => {
      if (BLOCKED_KEYS.includes(keyToken(key))) {
        warnings.push(`AUDIT_FIELD_REMOVED:${key}`);
        return acc;
      }
      acc[key] = visit(item, depth + 1);
      return acc;
    }, {});
  }

  let sanitized = visit(input, 0);
  if (byteLength(sanitized) > maxBytes) {
    warnings.push('AUDIT_SNAPSHOT_SIZE_TRUNCATED');
    sanitized = {
      _truncated: true,
      summary: typeof sanitized === 'object' && sanitized !== null
        ? Object.fromEntries(Object.entries(sanitized).slice(0, 20))
        : primitive(sanitized)
    };
  }
  return { value: sanitized, warnings: [...new Set(warnings)] };
}

export function sanitizeAuditMetadata(metadata = {}, policy = {}) {
  const allowed = new Set(policy.allowedKeys || DEFAULT_ALLOWED_METADATA);
  const picked = Object.entries(metadata || {}).reduce((acc, [key, value]) => {
    if (!allowed.has(key)) return acc;
    acc[key] = value;
    return acc;
  }, {});
  return sanitizeAuditSnapshot(picked, policy);
}

export function hashAuditReference(value = '') {
  const text = String(value || '');
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `fnv1a32:${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

export function resolveAuditEventType(input = {}) {
  const eventType = input.event_type || input.eventType || '';
  if (AUDIT_EVENT_REGISTRY[eventType]) return eventType;
  return LEGACY_TO_EVENT_TYPE[input.action || ''] || eventType;
}

export function validateAuditEvent(event = {}) {
  const errors = [];
  if (!event.event_id) errors.push({ field: 'event_id', code: 'EVENT_ID_REQUIRED' });
  if (!AUDIT_EVENT_REGISTRY[event.event_type]) errors.push({ field: 'event_type', code: 'EVENT_TYPE_INVALID' });
  if (!Number.isInteger(Number(event.event_version)) || Number(event.event_version) <= 0) errors.push({ field: 'event_version', code: 'EVENT_VERSION_INVALID' });
  if (!event.occurred_at) errors.push({ field: 'occurred_at', code: 'OCCURRED_AT_REQUIRED' });
  if (!event.actor_uid && event.actor_type !== 'system') errors.push({ field: 'actor_uid', code: 'ACTOR_UID_REQUIRED' });
  if (!AUDIT_ACTOR_TYPES.includes(event.actor_type)) errors.push({ field: 'actor_type', code: 'ACTOR_TYPE_INVALID' });
  if (!event.owner_uid) errors.push({ field: 'owner_uid', code: 'OWNER_UID_REQUIRED' });
  if (!SOURCE_CHANNELS.includes(event.source_channel)) errors.push({ field: 'source_channel', code: 'SOURCE_CHANNEL_INVALID' });
  if (!event.operation) errors.push({ field: 'operation', code: 'OPERATION_REQUIRED' });
  if (!event.entity_type) errors.push({ field: 'entity_type', code: 'ENTITY_TYPE_REQUIRED' });
  if (!event.correlation_id) errors.push({ field: 'correlation_id', code: 'CORRELATION_ID_REQUIRED' });
  if (!AUDIT_RESULT_STATUS.includes(event.result_status)) errors.push({ field: 'result_status', code: 'RESULT_STATUS_INVALID' });
  if (!Number.isInteger(Number(event.schema_version)) || Number(event.schema_version) <= 0) errors.push({ field: 'schema_version', code: 'SCHEMA_VERSION_INVALID' });
  return { isValid: errors.length === 0, errors };
}

export function buildAuditEvent(input = {}, options = {}) {
  const now = options.now || (() => new Date().toISOString());
  const idGenerator = options.idGenerator || (() => `audit_${hashAuditReference(`${Date.now()}:${Math.random()}`)}`);
  const context = input.context || {};
  const eventType = resolveAuditEventType(input);
  const before = sanitizeAuditSnapshot(input.before ?? null, options.snapshotPolicy || {});
  const after = sanitizeAuditSnapshot(input.after ?? null, options.snapshotPolicy || {});
  const metadata = sanitizeAuditMetadata({
    ...(input.metadata || {}),
    ...(input.details || {})
  }, options.metadataPolicy || {});
  const action = input.action || eventType;
  const category = AUDIT_EVENT_REGISTRY[eventType]?.category || 'operational';
  const event = {
    event_id: input.event_id || input.eventId || idGenerator(),
    event_type: eventType,
    category,
    event_version: Number(input.event_version || input.eventVersion || AUDIT_EVENT_VERSION),
    occurred_at: input.occurred_at || input.occurredAt || now(),
    actor_uid: input.actor_uid || input.actorUid || context.actorUid || '',
    actor_type: input.actor_type || input.actorType || context.actorType || 'user',
    actor_role: input.actor_role || input.actorRole || context.role || '',
    owner_uid: input.owner_uid || input.ownerUid || context.ownerUid || context.actorUid || '',
    source_channel: input.source_channel || input.sourceChannel || context.sourceChannel || 'web',
    operation: input.operation || input.action || action,
    entity_type: input.entity_type || input.entityType || 'finance_record',
    entity_id: input.entity_id || input.entityId || '',
    entity_ids: Array.isArray(input.entity_ids || input.entityIds) ? input.entity_ids || input.entityIds : [],
    correlation_id: input.correlation_id || input.correlationId || context.correlationId || '',
    idempotency_key_hash: input.idempotency_key_hash || (input.idempotencyKey || context.idempotencyKey ? hashAuditReference(input.idempotencyKey || context.idempotencyKey) : ''),
    command_name: input.command_name || input.commandName || '',
    result_status: input.result_status || input.resultStatus || input.status || 'success',
    result_code: input.result_code || input.resultCode || '',
    before: before.value,
    after: after.value,
    metadata: metadata.value || {},
    schema_version: Number(input.schema_version || input.schemaVersion || AUDIT_EVENT_SCHEMA_VERSION),
    action,
    created_at: input.created_at || input.createdAt || input.occurred_at || input.occurredAt || now(),
    status: input.status || input.result_status || input.resultStatus || 'success',
    source: input.source || input.source_channel || input.sourceChannel || context.sourceChannel || 'web',
    actorUid: input.actor_uid || input.actorUid || context.actorUid || '',
    ownerUid: input.owner_uid || input.ownerUid || context.ownerUid || context.actorUid || '',
    sourceChannel: input.source_channel || input.sourceChannel || context.sourceChannel || 'web',
    entityType: input.entity_type || input.entityType || 'finance_record',
    entityId: input.entity_id || input.entityId || '',
    entityIds: Array.isArray(input.entity_ids || input.entityIds) ? input.entity_ids || input.entityIds : [],
    correlationId: input.correlation_id || input.correlationId || context.correlationId || '',
    details: {
      ...(metadata.value || {}),
      correlation_id: input.correlation_id || input.correlationId || context.correlationId || '',
      source_channel: input.source_channel || input.sourceChannel || context.sourceChannel || 'web',
      entity_type: input.entity_type || input.entityType || 'finance_record',
      entity_id: input.entity_id || input.entityId || ''
    }
  };
  const warnings = [...before.warnings, ...after.warnings, ...metadata.warnings];
  const validation = validateAuditEvent(event);
  return { event, validation, warnings: [...new Set(warnings)] };
}
