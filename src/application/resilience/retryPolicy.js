import { APPLICATION_ERROR_CATEGORIES, isApplicationError } from './applicationError.js';
import { normalizeApplicationError } from './errorNormalization.js';

export const OPERATION_TYPES = Object.freeze({
  QUERY: 'query',
  MUTATION: 'mutation',
  LAZY_LOAD: 'lazy_load'
});

const RETRYABLE_QUERY_CATEGORIES = new Set([
  APPLICATION_ERROR_CATEGORIES.NETWORK,
  APPLICATION_ERROR_CATEGORIES.TIMEOUT,
  APPLICATION_ERROR_CATEGORIES.OFFLINE
]);

const RETRYABLE_MUTATION_CATEGORIES = new Set([
  APPLICATION_ERROR_CATEGORIES.NETWORK,
  APPLICATION_ERROR_CATEGORIES.TIMEOUT
]);

export function createRetryPolicy(options = {}) {
  const maxQueryAttempts = options.maxQueryAttempts || 3;
  const maxMutationAttempts = options.maxMutationAttempts || 2;
  const maxLazyLoadAttempts = options.maxLazyLoadAttempts || 2;
  const baseDelayMs = options.baseDelayMs ?? 100;
  const maxDelayMs = options.maxDelayMs ?? 1000;
  const jitter = options.jitter || (() => 0);

  function delayFor(attempt) {
    const exponent = Math.max(0, attempt - 1);
    return Math.min(maxDelayMs, baseDelayMs * (2 ** exponent)) + Math.max(0, Number(jitter(attempt)) || 0);
  }

  return {
    evaluate(input = {}) {
      const error = isApplicationError(input.error) ? input.error : normalizeApplicationError(input.error, input.context);
      const operationType = input.operationType || OPERATION_TYPES.QUERY;
      const attempt = Math.max(1, Number(input.attempt) || 1);
      const idempotent = input.idempotent === true;
      const hasIdempotencyKey = input.hasIdempotencyKey === true;
      const maxAttempts = operationType === OPERATION_TYPES.MUTATION
        ? maxMutationAttempts
        : operationType === OPERATION_TYPES.LAZY_LOAD
          ? maxLazyLoadAttempts
          : maxQueryAttempts;

      if (attempt >= maxAttempts) {
        return { shouldRetry: false, delayMs: 0, maxAttempts, reason: 'MAX_ATTEMPTS_REACHED' };
      }
      if (operationType === OPERATION_TYPES.QUERY) {
        if (RETRYABLE_QUERY_CATEGORIES.has(error.category)) {
          return { shouldRetry: error.category !== APPLICATION_ERROR_CATEGORIES.OFFLINE, delayMs: delayFor(attempt), maxAttempts, reason: 'QUERY_TRANSIENT_ERROR' };
        }
        return { shouldRetry: false, delayMs: 0, maxAttempts, reason: 'QUERY_PERMANENT_ERROR' };
      }
      if (operationType === OPERATION_TYPES.LAZY_LOAD) {
        return error.category === APPLICATION_ERROR_CATEGORIES.LAZY_LOAD
          ? { shouldRetry: true, delayMs: delayFor(attempt), maxAttempts, reason: 'LAZY_LOAD_RETRYABLE' }
          : { shouldRetry: false, delayMs: 0, maxAttempts, reason: 'LAZY_LOAD_NOT_APPLICABLE' };
      }
      if (!idempotent || !hasIdempotencyKey) {
        return { shouldRetry: false, delayMs: 0, maxAttempts, reason: 'MUTATION_NOT_IDEMPOTENT' };
      }
      if (RETRYABLE_MUTATION_CATEGORIES.has(error.category)) {
        return { shouldRetry: true, delayMs: delayFor(attempt), maxAttempts, reason: 'MUTATION_IDEMPOTENT_TRANSIENT_ERROR' };
      }
      return { shouldRetry: false, delayMs: 0, maxAttempts, reason: 'MUTATION_PERMANENT_ERROR' };
    }
  };
}

export const defaultRetryPolicy = createRetryPolicy();
