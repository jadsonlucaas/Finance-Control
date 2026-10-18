export const APPLICATION_ERROR_SCHEMA_VERSION = 1;

export const APPLICATION_ERROR_CATEGORIES = Object.freeze({
  VALIDATION: 'VALIDATION',
  BUSINESS_RULE: 'BUSINESS_RULE',
  AUTHENTICATION: 'AUTHENTICATION',
  AUTHORIZATION: 'AUTHORIZATION',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  IDEMPOTENCY: 'IDEMPOTENCY',
  NETWORK: 'NETWORK',
  TIMEOUT: 'TIMEOUT',
  OFFLINE: 'OFFLINE',
  PERSISTENCE: 'PERSISTENCE',
  CONFIGURATION: 'CONFIGURATION',
  LAZY_LOAD: 'LAZY_LOAD',
  UNKNOWN: 'UNKNOWN'
});

export const APPLICATION_ERROR_SEVERITIES = Object.freeze({
  INFO: 'info',
  WARNING: 'warning',
  ERROR: 'error',
  CRITICAL: 'critical'
});

export const APPLICATION_ERROR_CODES = Object.freeze({
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  BUSINESS_RULE_BLOCKED: 'BUSINESS_RULE_BLOCKED',
  AUTHENTICATION_REQUIRED: 'AUTHENTICATION_REQUIRED',
  AUTHORIZATION_DENIED: 'AUTHORIZATION_DENIED',
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  CONFLICT_DETECTED: 'CONFLICT_DETECTED',
  IDEMPOTENCY_CONFLICT: 'IDEMPOTENCY_CONFLICT',
  NETWORK_UNAVAILABLE: 'NETWORK_UNAVAILABLE',
  OPERATION_TIMEOUT: 'OPERATION_TIMEOUT',
  CLIENT_OFFLINE: 'CLIENT_OFFLINE',
  PERSISTENCE_FAILED: 'PERSISTENCE_FAILED',
  CONFIGURATION_INVALID: 'CONFIGURATION_INVALID',
  LAZY_LOAD_FAILED: 'LAZY_LOAD_FAILED',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
  POST_COMMIT_AUDIT_FAILED: 'POST_COMMIT_AUDIT_FAILED',
  POST_COMMIT_RESPONSE_LOST: 'POST_COMMIT_RESPONSE_LOST',
  POST_COMMIT_CONFIRMATION_LOST: 'POST_COMMIT_CONFIRMATION_LOST',
  RECONCILIATION_ATTEMPT: 'RECONCILIATION_ATTEMPT',
  RECONCILIATION_CONFIRMED: 'RECONCILIATION_CONFIRMED'
});

const SENSITIVE_KEY_PATTERN = /(password|senha|token|secret|authorization|auth|credential|phone|telefone|whatsapp|raw|file|payloadCompleto|arquivo)/i;
const MAX_STRING_LENGTH = 240;
const MAX_ARRAY_LENGTH = 12;
const MAX_DEPTH = 4;

export function isValidApplicationErrorCategory(category = '') {
  return Object.values(APPLICATION_ERROR_CATEGORIES).includes(category);
}

export function isValidApplicationErrorSeverity(severity = '') {
  return Object.values(APPLICATION_ERROR_SEVERITIES).includes(severity);
}

export function sanitizeErrorDetails(value, depth = 0) {
  if (value === null || value === undefined) return value;
  if (depth > MAX_DEPTH) return '[truncated]';
  if (typeof value === 'string') return value.length > MAX_STRING_LENGTH ? `${value.slice(0, MAX_STRING_LENGTH)}...` : value;
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (value instanceof Error) {
    return {
      name: value.name || 'Error',
      code: String(value.code || ''),
      message: sanitizeErrorDetails(value.message || '', depth + 1)
    };
  }
  if (Array.isArray(value)) return value.slice(0, MAX_ARRAY_LENGTH).map((item) => sanitizeErrorDetails(item, depth + 1));
  if (typeof value === 'object') {
    return Object.fromEntries(Object.entries(value)
      .filter(([key]) => !SENSITIVE_KEY_PATTERN.test(key))
      .map(([key, item]) => [key, sanitizeErrorDetails(item, depth + 1)]));
  }
  return String(value);
}

export function createApplicationError(input = {}) {
  const category = input.category || APPLICATION_ERROR_CATEGORIES.UNKNOWN;
  const severity = input.severity || APPLICATION_ERROR_SEVERITIES.ERROR;
  if (!input.code) throw new Error('APPLICATION_ERROR_CODE_REQUIRED');
  if (!isValidApplicationErrorCategory(category)) throw new Error(`APPLICATION_ERROR_CATEGORY_INVALID:${category}`);
  if (!isValidApplicationErrorSeverity(severity)) throw new Error(`APPLICATION_ERROR_SEVERITY_INVALID:${severity}`);

  const error = {
    code: String(input.code),
    category,
    severity,
    message: String(input.message || input.code),
    userMessage: String(input.userMessage || 'Nao foi possivel concluir a operacao.'),
    retryable: input.retryable === true,
    operation: String(input.operation || ''),
    correlationId: String(input.correlationId || ''),
    causeCode: String(input.causeCode || ''),
    details: sanitizeErrorDetails(input.details || {}),
    occurredAt: input.occurredAt || new Date().toISOString(),
    schemaVersion: APPLICATION_ERROR_SCHEMA_VERSION
  };

  if (input.cause) {
    Object.defineProperty(error, 'cause', {
      value: input.cause,
      enumerable: false
    });
  }

  return error;
}

export function isApplicationError(error) {
  return Boolean(
    error &&
    typeof error === 'object' &&
    typeof error.code === 'string' &&
    isValidApplicationErrorCategory(error.category) &&
    isValidApplicationErrorSeverity(error.severity) &&
    error.schemaVersion === APPLICATION_ERROR_SCHEMA_VERSION
  );
}

export function serializeApplicationError(error) {
  const normalized = isApplicationError(error)
    ? error
    : createApplicationError({ code: APPLICATION_ERROR_CODES.UNKNOWN_ERROR, details: { error } });
  return JSON.parse(JSON.stringify(normalized));
}
