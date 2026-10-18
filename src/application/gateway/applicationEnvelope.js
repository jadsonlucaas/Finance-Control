import { ACTOR_TYPES, SOURCE_CHANNELS } from './operationMetadata.js';

export { ACTOR_TYPES, SOURCE_CHANNELS };

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function requiredText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function issue(field, code, message) {
  return { field, code, message };
}

export function createApplicationEnvelope(input = {}, options = {}) {
  const now = options.now || (() => new Date().toISOString());
  return {
    commandName: input.commandName || '',
    queryName: input.queryName || '',
    schemaVersion: Number(input.schemaVersion || 1),
    actor: {
      type: input.actor?.type || 'user',
      id: input.actor?.id || '',
      role: input.actor?.role || ''
    },
    source: {
      channel: input.source?.channel || 'web',
      referenceId: input.source?.referenceId || ''
    },
    idempotencyKey: input.idempotencyKey || '',
    correlationId: input.correlationId || '',
    requestedAt: input.requestedAt || now(),
    payload: isPlainObject(input.payload) ? input.payload : {}
  };
}

export function validateApplicationEnvelope(envelope = {}, kind = 'command') {
  const errors = [];
  const nameField = kind === 'query' ? 'queryName' : 'commandName';
  if (!requiredText(envelope?.[nameField])) {
    errors.push(issue(nameField, 'NAME_REQUIRED', `${nameField} obrigatorio.`));
  }
  if (!Number.isInteger(Number(envelope?.schemaVersion)) || Number(envelope.schemaVersion) <= 0) {
    errors.push(issue('schemaVersion', 'SCHEMA_VERSION_INVALID', 'schemaVersion deve ser positivo.'));
  }
  if (!ACTOR_TYPES.includes(envelope?.actor?.type)) {
    errors.push(issue('actor.type', 'ACTOR_TYPE_INVALID', 'Tipo de ator invalido.'));
  }
  if (envelope?.actor?.id !== undefined && envelope.actor.id !== '' && !requiredText(envelope.actor.id)) {
    errors.push(issue('actor.id', 'ACTOR_ID_INVALID', 'actor.id deve ser texto nao vazio quando informado.'));
  }
  if (!SOURCE_CHANNELS.includes(envelope?.source?.channel)) {
    errors.push(issue('source.channel', 'SOURCE_CHANNEL_INVALID', 'Canal de origem invalido.'));
  }
  if (envelope?.source?.referenceId !== undefined && envelope.source.referenceId !== '' && !requiredText(envelope.source.referenceId)) {
    errors.push(issue('source.referenceId', 'SOURCE_REFERENCE_INVALID', 'source.referenceId deve ser texto nao vazio quando informado.'));
  }
  if (envelope?.idempotencyKey !== undefined && envelope.idempotencyKey !== '' && !requiredText(envelope.idempotencyKey)) {
    errors.push(issue('idempotencyKey', 'IDEMPOTENCY_KEY_INVALID', 'idempotencyKey deve ser texto nao vazio quando informado.'));
  }
  if (envelope?.correlationId !== undefined && envelope.correlationId !== '' && !requiredText(envelope.correlationId)) {
    errors.push(issue('correlationId', 'CORRELATION_ID_INVALID', 'correlationId deve ser texto nao vazio quando informado.'));
  }
  if (!requiredText(envelope?.requestedAt)) {
    errors.push(issue('requestedAt', 'REQUESTED_AT_REQUIRED', 'requestedAt obrigatorio.'));
  }
  if (!isPlainObject(envelope?.payload)) {
    errors.push(issue('payload', 'PAYLOAD_INVALID', 'payload deve ser objeto.'));
  }
  return { isValid: errors.length === 0, errors };
}

export function normalizeCommandEnvelope(input = {}, options = {}) {
  const envelope = createApplicationEnvelope(input, options);
  envelope.commandName = input.commandName || '';
  delete envelope.queryName;
  return envelope;
}

export function normalizeQueryEnvelope(input = {}, options = {}) {
  const envelope = createApplicationEnvelope(input, options);
  envelope.queryName = input.queryName || '';
  delete envelope.commandName;
  delete envelope.idempotencyKey;
  return envelope;
}
