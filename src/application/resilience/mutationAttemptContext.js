import { buildOperationFingerprint, hashStableString } from '../gateway/idempotency.js';
import { sanitizeErrorDetails } from './applicationError.js';

export const MUTATION_ATTEMPT_STATUS = Object.freeze({
  PREPARED: 'prepared',
  SUBMITTING: 'submitting',
  CONFIRMED: 'confirmed',
  UNCERTAIN: 'uncertain',
  FAILED: 'failed',
  RECONCILED: 'reconciled'
});

export const MUTATION_OUTCOME_STATE = Object.freeze({
  CONFIRMED_SUCCESS: 'confirmed_success',
  CONFIRMED_FAILURE: 'confirmed_failure',
  UNCERTAIN: 'uncertain',
  RECONCILED_SUCCESS: 'reconciled_success',
  PARTIAL_SUCCESS: 'partial_success'
});

const SENSITIVE_KEY_PATTERN = /(password|senha|token|secret|authorization|auth|credential|phone|telefone|whatsapp|raw|file|payloadCompleto|arquivo)/i;

function nowIso(now = () => new Date().toISOString()) {
  return typeof now === 'function' ? now() : new Date().toISOString();
}

function ownerFrom(context = {}) {
  return context.ownerUid || context.actorUid || context.uid || context.actor?.id || '';
}

function sourceChannelFrom(input = {}) {
  return input.sourceChannel || input.source_channel || input.source?.channel || 'web';
}

function commandNameFrom(input = {}) {
  return input.commandName || input.command_name || '';
}

function fingerprintFor(input = {}) {
  return input.originalPayloadFingerprint || buildOperationFingerprint({
    ownerUid: ownerFrom(input.context || {}),
    commandName: commandNameFrom(input),
    sourceChannel: sourceChannelFrom(input),
    schemaVersion: input.schemaVersion || input.schema_version || 1,
    payload: input.payload || {}
  });
}

function generatedId(prefix, value = '') {
  return `${prefix}_${hashStableString(value).replace(':', '_')}`;
}

export function sanitizeAttemptDetails(value) {
  const sanitized = sanitizeErrorDetails(value);
  if (!sanitized || typeof sanitized !== 'object' || Array.isArray(sanitized)) return sanitized;
  return Object.fromEntries(Object.entries(sanitized).filter(([key]) => !SENSITIVE_KEY_PATTERN.test(key)));
}

export function createMutationAttemptContext(input = {}, options = {}) {
  const now = options.now || input.now || (() => new Date().toISOString());
  const createdAt = input.createdAt || input.created_at || nowIso(now);
  const commandName = commandNameFrom(input);
  const originalPayloadFingerprint = fingerprintFor(input);
  const correlationSeed = `${commandName}|${originalPayloadFingerprint}|${createdAt}`;
  const attemptId = input.attemptId || input.attempt_id || generatedId('attempt', correlationSeed);
  return {
    schemaVersion: 1,
    attemptId,
    idempotencyKey: input.idempotencyKey || input.idempotency_key || generatedId('idem', attemptId),
    correlationId: input.correlationId || input.correlation_id || generatedId('corr', attemptId),
    commandName,
    sourceChannel: sourceChannelFrom(input),
    createdAt,
    status: input.status || MUTATION_ATTEMPT_STATUS.PREPARED,
    retryCount: Number(input.retryCount || input.retry_count || 0),
    lastErrorCode: input.lastErrorCode || input.last_error_code || '',
    originalPayloadFingerprint,
    details: sanitizeAttemptDetails(input.details || {})
  };
}

export function payloadMatchesMutationAttempt(attempt = {}, input = {}) {
  return Boolean(attempt?.originalPayloadFingerprint) && attempt.originalPayloadFingerprint === fingerprintFor(input);
}

export function updateMutationAttemptStatus(attempt = {}, patch = {}) {
  return {
    ...attempt,
    status: patch.status || attempt.status || MUTATION_ATTEMPT_STATUS.PREPARED,
    retryCount: Number(patch.retryCount ?? patch.retry_count ?? attempt.retryCount ?? 0),
    lastErrorCode: patch.lastErrorCode || patch.last_error_code || attempt.lastErrorCode || ''
  };
}

export function mutationOutcomeFromResult(result = {}) {
  if (result.mutationOutcome) return result.mutationOutcome;
  if (result.success === true && result.idempotentReplay === true) return MUTATION_OUTCOME_STATE.RECONCILED_SUCCESS;
  if (result.success === true && Array.isArray(result.warnings) && result.warnings.length) return MUTATION_OUTCOME_STATE.PARTIAL_SUCCESS;
  if (result.success === true) return MUTATION_OUTCOME_STATE.CONFIRMED_SUCCESS;
  if (result.data?.mutationOutcome === MUTATION_OUTCOME_STATE.UNCERTAIN) return MUTATION_OUTCOME_STATE.UNCERTAIN;
  return MUTATION_OUTCOME_STATE.CONFIRMED_FAILURE;
}

export function safeAttemptForStorage(attempt = {}) {
  const {
    attemptId,
    idempotencyKey,
    correlationId,
    commandName,
    sourceChannel,
    createdAt,
    status,
    retryCount,
    lastErrorCode,
    originalPayloadFingerprint,
    schemaVersion
  } = attempt;
  return {
    schemaVersion: schemaVersion || 1,
    attemptId,
    idempotencyKey,
    correlationId,
    commandName,
    sourceChannel,
    createdAt,
    status,
    retryCount: Number(retryCount || 0),
    lastErrorCode: lastErrorCode || '',
    originalPayloadFingerprint
  };
}

