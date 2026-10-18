export const SOURCE_CHANNELS = Object.freeze([
  'web',
  'bank_import',
  'spreadsheet_import',
  'system',
  'migration',
  'future_integration'
]);

export const CREATED_BY_TYPES = Object.freeze(['user', 'admin', 'system', 'integration']);
export const ACTOR_TYPES = CREATED_BY_TYPES;

const DISALLOWED_METADATA_KEYS = Object.freeze([
  'phone',
  'phone_number',
  'telefone',
  'whatsapp',
  'whatsapp_phone',
  'provider',
  'webhook',
  'message',
  'raw_message',
  'password',
  'token',
  'secret',
  'credential'
]);

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function present(value) {
  return value !== undefined && value !== null && value !== '';
}

function issue(field, code, message) {
  return { field, code, message };
}

export function hasDisallowedOperationMetadataKey(input = {}) {
  return Object.keys(input || {}).some((key) => DISALLOWED_METADATA_KEYS.includes(String(key).toLowerCase()));
}

export function normalizeOperationMetadata(input = {}, context = {}) {
  const source = input.source || context.source || {};
  const actor = input.actor || context.actor || {};
  const metadata = {
    schema_version: Number(input.schema_version || input.schemaVersion || context.schema_version || context.schemaVersion || 1),
    source_channel: text(input.source_channel || input.sourceChannel || context.source_channel || context.sourceChannel || source.channel || 'web'),
    source_reference_id: text(input.source_reference_id || input.sourceReferenceId || context.source_reference_id || context.sourceReferenceId || source.referenceId || ''),
    created_by_type: text(input.created_by_type || input.createdByType || context.created_by_type || context.actorType || actor.type || 'user'),
    created_by_id: text(input.created_by_id || input.createdById || context.created_by_id || context.actorUid || actor.id || ''),
    correlation_id: text(input.correlation_id || input.correlationId || context.correlation_id || context.correlationId || ''),
    idempotency_key: text(input.idempotency_key || input.idempotencyKey || context.idempotency_key || context.idempotencyKey || ''),
    received_at: text(input.received_at || input.receivedAt || context.received_at || context.requestedAt || ''),
    processed_at: text(input.processed_at || input.processedAt || context.processed_at || context.processedAt || '')
  };

  return Object.fromEntries(Object.entries(metadata).filter(([key, value]) => key === 'schema_version' || value !== ''));
}

export function validateOperationMetadata(metadata = {}) {
  const normalized = normalizeOperationMetadata(metadata);
  const errors = [];

  if (!Number.isInteger(Number(normalized.schema_version)) || Number(normalized.schema_version) <= 0) {
    errors.push(issue('schema_version', 'SCHEMA_VERSION_INVALID', 'schema_version deve ser positivo.'));
  }
  if (present(normalized.source_channel) && !SOURCE_CHANNELS.includes(normalized.source_channel)) {
    errors.push(issue('source_channel', 'SOURCE_CHANNEL_INVALID', 'Canal de origem invalido.'));
  }
  if (present(normalized.created_by_type) && !CREATED_BY_TYPES.includes(normalized.created_by_type)) {
    errors.push(issue('created_by_type', 'CREATED_BY_TYPE_INVALID', 'Tipo de autoria invalido.'));
  }
  ['source_reference_id', 'idempotency_key', 'correlation_id', 'created_by_id'].forEach((field) => {
    if (field in metadata && !text(metadata[field])) {
      errors.push(issue(field, 'EMPTY_TEXT', `${field} nao pode ser vazio quando presente.`));
    }
  });
  if (hasDisallowedOperationMetadataKey(metadata)) {
    errors.push(issue('metadata', 'DISALLOWED_TECHNICAL_FIELD', 'Metadata operacional nao aceita campos sensiveis ou de provedor.'));
  }

  return { isValid: errors.length === 0, errors, normalized };
}
