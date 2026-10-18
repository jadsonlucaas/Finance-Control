import { serializeApplicationError } from './applicationError.js';
import { normalizeApplicationError } from './errorNormalization.js';
import { defaultRetryPolicy, OPERATION_TYPES } from './retryPolicy.js';

function wait(ms, timer = globalThis.setTimeout) {
  return new Promise((resolve) => timer(resolve, ms));
}

export async function executeWithResilience(operation, options = {}) {
  if (typeof operation !== 'function') throw new Error('RESILIENT_OPERATION_REQUIRED');
  const retryPolicy = options.retryPolicy || defaultRetryPolicy;
  const sleep = options.sleep || wait;
  const operationType = options.operationType || OPERATION_TYPES.QUERY;
  const idempotencyKey = options.idempotencyKey || options.context?.idempotencyKey || '';
  const attempts = [];
  let attempt = 1;

  while (true) {
    try {
      const result = await operation({
        attempt,
        correlationId: options.correlationId || options.context?.correlationId || '',
        idempotencyKey
      });
      return {
        success: true,
        data: result,
        attempts: attempt,
        attemptLog: attempts,
        correlationId: options.correlationId || options.context?.correlationId || '',
        idempotencyKey,
        finalStatus: 'success'
      };
    } catch (error) {
      const normalized = normalizeApplicationError(error, {
        operation: options.operation,
        correlationId: options.correlationId || options.context?.correlationId || '',
        details: options.details,
        offline: options.connectivity?.isOnline?.() === false
      });
      const decision = retryPolicy.evaluate({
        error: normalized,
        operationType,
        idempotent: options.idempotent === true,
        hasIdempotencyKey: Boolean(idempotencyKey),
        attempt,
        context: options.context
      });
      attempts.push({
        attempt,
        error: serializeApplicationError(normalized),
        retry: decision
      });
      options.errorReporter?.report?.({
        error: normalized,
        operation: options.operation,
        correlationId: normalized.correlationId,
        context: options.context
      });
      if (!decision.shouldRetry) {
        return {
          success: false,
          error: serializeApplicationError(normalized),
          attempts: attempt,
          attemptLog: attempts,
          correlationId: normalized.correlationId,
          idempotencyKey,
          finalStatus: 'failed'
        };
      }
      await sleep(decision.delayMs);
      attempt += 1;
    }
  }
}
