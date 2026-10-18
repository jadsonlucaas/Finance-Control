import { hasDisallowedOperationMetadataKey } from './operationMetadata.js';

export const IDEMPOTENCY_RECEIPT_STATUS = Object.freeze({
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed'
});

const VOLATILE_FINGERPRINT_KEYS = Object.freeze([
  'requestedAt',
  'requested_at',
  'processedAt',
  'processed_at',
  'correlationId',
  'correlation_id',
  'receivedAt',
  'received_at'
]);

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  if (isPlainObject(value)) {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function canonicalizeOperationPayload(value) {
  if (Array.isArray(value)) return value.map((item) => canonicalizeOperationPayload(item));
  if (!isPlainObject(value)) return value;
  return Object.keys(value).sort().reduce((acc, key) => {
    if (VOLATILE_FINGERPRINT_KEYS.includes(key)) return acc;
    if (hasDisallowedOperationMetadataKey({ [key]: value[key] })) return acc;
    acc[key] = canonicalizeOperationPayload(value[key]);
    return acc;
  }, {});
}

export function hashStableString(value = '') {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `fnv1a32:${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

export function buildOperationFingerprint({
  ownerUid = '',
  commandName = '',
  payload = {},
  sourceChannel = 'web',
  schemaVersion = 1,
  hash = hashStableString
} = {}) {
  const canonical = stableStringify({
    ownerUid,
    commandName,
    sourceChannel,
    schemaVersion: Number(schemaVersion || 1),
    payload: canonicalizeOperationPayload(payload)
  });
  return hash(canonical);
}

export function buildRequestFingerprint(envelope = {}, authContext = {}) {
  return buildOperationFingerprint({
    ownerUid: authContext.ownerUid || authContext.actorUid || '',
    commandName: envelope.commandName,
    sourceChannel: envelope.source?.channel || 'web',
    schemaVersion: envelope.schemaVersion,
    payload: envelope.payload
  });
}

export function idempotencyLogicalKey(input = {}) {
  return [
    input.ownerUid || input.owner_uid || '',
    input.commandName || input.command_name || '',
    input.sourceChannel || input.source_channel || 'web',
    input.idempotencyKey || input.idempotency_key || ''
  ].join('|');
}

export function receiptDocumentId(input = {}) {
  return `idem_${hashStableString(idempotencyLogicalKey(input)).replace(':', '_')}`;
}

export function buildIdempotencyReceipt(input = {}, options = {}) {
  const now = options.now || (() => new Date().toISOString());
  return {
    schema_version: Number(input.schemaVersion || input.schema_version || 1),
    owner_uid: input.ownerUid || input.owner_uid || '',
    command_name: input.commandName || input.command_name || '',
    source_channel: input.sourceChannel || input.source_channel || 'web',
    idempotency_key: input.idempotencyKey || input.idempotency_key || '',
    request_fingerprint: input.requestFingerprint || input.request_fingerprint || '',
    status: input.status || IDEMPOTENCY_RECEIPT_STATUS.PROCESSING,
    entity_id: input.entityId || input.entity_id || '',
    entity_ids: Array.isArray(input.entityIds || input.entity_ids) ? input.entityIds || input.entity_ids : [],
    result_code: input.resultCode || input.result_code || '',
    correlation_id: input.correlationId || input.correlation_id || '',
    created_at: input.createdAt || input.created_at || now(),
    completed_at: input.completedAt || input.completed_at || '',
    failed_at: input.failedAt || input.failed_at || '',
    expires_at: input.expiresAt || input.expires_at || ''
  };
}

export class InMemoryIdempotencyStore {
  constructor(now = () => new Date().toISOString()) {
    this.now = now;
    this.records = new Map();
  }

  get(input = {}) {
    return this.records.get(idempotencyLogicalKey(input)) || null;
  }

  reserve(input = {}) {
    const record = {
      ...buildIdempotencyReceipt(input, { now: this.now }),
      ownerUid: input.ownerUid || '',
      commandName: input.commandName || '',
      sourceChannel: input.sourceChannel || '',
      idempotencyKey: input.idempotencyKey || '',
      requestFingerprint: input.requestFingerprint || '',
      status: input.status || 'reserved',
      resultReference: null,
      createdAt: this.now()
    };
    this.records.set(idempotencyLogicalKey(record), record);
    return record;
  }

  complete(input = {}, result = {}) {
    const key = idempotencyLogicalKey(input);
    const current = this.records.get(key) || this.reserve(input);
    const completed = {
      ...current,
      status: IDEMPOTENCY_RECEIPT_STATUS.COMPLETED,
      resultReference: result,
      result_reference: result,
      result_code: result.code || '',
      entity_id: result.entityId || '',
      entity_ids: Array.isArray(result.entityIds) ? result.entityIds : [],
      completed_at: this.now(),
      updatedAt: this.now()
    };
    this.records.set(key, completed);
    return completed;
  }

  clear(input = {}) {
    this.records.delete(idempotencyLogicalKey(input));
  }
}
