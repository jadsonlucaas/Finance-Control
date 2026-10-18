import { createApplicationError, APPLICATION_ERROR_CATEGORIES, APPLICATION_ERROR_CODES } from '../src/application/resilience/applicationError.js';
import {
  normalizeApplicationError,
  normalizeFirebaseError,
  normalizeLazyLoadError,
  normalizeNetworkError,
  normalizeRepositoryError
} from '../src/application/resilience/errorNormalization.js';
import { executeWithResilience } from '../src/application/resilience/executeWithResilience.js';
import { createRetryPolicy, OPERATION_TYPES } from '../src/application/resilience/retryPolicy.js';
import { InMemoryConnectivityService, CONNECTIVITY_STATUS } from '../src/services/connectivity/connectivityService.js';
import { InMemoryErrorReporter } from '../src/application/resilience/errorReporter.js';
import { REPOSITORY_ERROR_CODES } from '../src/application/repositories/repositoryResult.js';

const retryPolicy = createRetryPolicy({ baseDelayMs: 0, maxDelayMs: 0 });
const reporter = new InMemoryErrorReporter({ now: () => '2026-08-30T12:00:00.000Z' });
const connectivity = new InMemoryConnectivityService(CONNECTIVITY_STATUS.ONLINE);

async function scenario(name, run) {
  const result = await run();
  const policyRetryable = Array.isArray(result.attemptLog)
    ? result.attemptLog.some((attempt) => attempt.retry?.shouldRetry)
    : Boolean(result.error?.retryable || result.normalized?.retryable);
  return {
    name,
    normalized: result.error?.code || result.normalized?.code || '',
    retryable: policyRetryable,
    attempts: result.attempts || 0,
    finalStatus: result.finalStatus || (result.success ? 'success' : 'failed'),
    warnings: result.warnings || []
  };
}

const fixtures = [
  await scenario('validation', async () => ({ normalized: normalizeApplicationError(new Error('FINANCE_RECORD_CONTRACT_INVALID'), { operation: 'validation' }) })),
  await scenario('authorization', async () => ({ normalized: normalizeFirebaseError({ code: 'permission-denied', message: 'raw permission' }, { operation: 'admin' }) })),
  await scenario('network query', async () => executeWithResilience(
    (() => {
      let calls = 0;
      return () => {
        calls += 1;
        if (calls < 2) throw normalizeNetworkError(new Error('fetch failed'), { operation: 'query' });
        return { ok: true };
      };
    })(),
    { operationType: OPERATION_TYPES.QUERY, operation: 'query', retryPolicy, sleep: async () => {}, errorReporter: reporter }
  )),
  await scenario('timeout query', async () => executeWithResilience(
    () => { throw normalizeFirebaseError({ code: 'deadline-exceeded' }, { operation: 'query_timeout' }); },
    { operationType: OPERATION_TYPES.QUERY, operation: 'query_timeout', retryPolicy, sleep: async () => {}, errorReporter: reporter }
  )),
  await scenario('mutation sem idempotencyKey', async () => executeWithResilience(
    () => { throw normalizeNetworkError(new Error('network down'), { operation: 'mutation' }); },
    { operationType: OPERATION_TYPES.MUTATION, operation: 'mutation', retryPolicy, sleep: async () => {}, errorReporter: reporter }
  )),
  await scenario('mutation com idempotencyKey', async () => executeWithResilience(
    (() => {
      let calls = 0;
      return () => {
        calls += 1;
        if (calls < 2) throw normalizeNetworkError(new Error('network down'), { operation: 'mutation_idempotent' });
        return { ok: true };
      };
    })(),
    {
      operationType: OPERATION_TYPES.MUTATION,
      operation: 'mutation_idempotent',
      idempotent: true,
      idempotencyKey: 'idem-dry-run',
      retryPolicy,
      sleep: async () => {},
      errorReporter: reporter
    }
  )),
  await scenario('lazy-load failure', async () => ({ normalized: normalizeLazyLoadError(new Error('Failed to fetch dynamically imported module'), { operation: 'lazy' }) })),
  await scenario('offline', async () => {
    connectivity.setStatus(CONNECTIVITY_STATUS.OFFLINE);
    return { normalized: normalizeNetworkError(new Error('offline'), { operation: 'offline', offline: !connectivity.isOnline() }) };
  }),
  await scenario('audit failure pos-commit', async () => ({
    normalized: createApplicationError({
      code: APPLICATION_ERROR_CODES.POST_COMMIT_AUDIT_FAILED,
      category: APPLICATION_ERROR_CATEGORIES.PERSISTENCE,
      severity: 'warning',
      message: 'Audit failed after commit.',
      userMessage: 'Operacao principal concluida, mas a auditoria falhou.',
      operation: 'post_commit_audit'
    }),
    warnings: ['PRIMARY_OPERATION_COMMITTED']
  })),
  await scenario('unknown', async () => ({ normalized: normalizeRepositoryError({ code: REPOSITORY_ERROR_CODES.UNKNOWN_ERROR, message: 'opaque' }, { operation: 'unknown' }) }))
];

console.log(JSON.stringify({
  ok: true,
  wrote: false,
  firebase_touched: false,
  scenarios: fixtures,
  reporterEvents: reporter.listRecent().length
}, null, 2));
