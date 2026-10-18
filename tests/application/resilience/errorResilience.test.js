import { describe, expect, it, vi } from 'vitest';
import {
  APPLICATION_ERROR_CATEGORIES,
  APPLICATION_ERROR_CODES,
  createApplicationError,
  isApplicationError,
  serializeApplicationError
} from '../../../src/application/resilience/applicationError.js';
import {
  normalizeApplicationError,
  normalizeFirebaseError,
  normalizeLazyLoadError,
  normalizeNetworkError,
  normalizeRepositoryError,
  userMessageForError
} from '../../../src/application/resilience/errorNormalization.js';
import { createRetryPolicy, OPERATION_TYPES } from '../../../src/application/resilience/retryPolicy.js';
import { executeWithResilience } from '../../../src/application/resilience/executeWithResilience.js';
import { createAsyncViewState, toErrorState, toLoadingState, toOfflineState, toSuccessState } from '../../../src/application/resilience/asyncViewState.js';
import { InMemoryConnectivityService, CONNECTIVITY_STATUS } from '../../../src/services/connectivity/connectivityService.js';
import { InMemoryErrorReporter } from '../../../src/application/resilience/errorReporter.js';
import { REPOSITORY_ERROR_CODES } from '../../../src/application/repositories/repositoryResult.js';

const now = () => '2026-08-30T12:00:00.000Z';

describe('ApplicationError contract', () => {
  it('creates a valid serializable ApplicationError', () => {
    const error = createApplicationError({
      code: APPLICATION_ERROR_CODES.NETWORK_UNAVAILABLE,
      category: APPLICATION_ERROR_CATEGORIES.NETWORK,
      severity: 'warning',
      message: 'fetch failed',
      userMessage: 'Falha de conexao.',
      correlationId: 'corr-1',
      occurredAt: now()
    });
    expect(isApplicationError(error)).toBe(true);
    expect(JSON.parse(JSON.stringify(error))).toMatchObject({ code: APPLICATION_ERROR_CODES.NETWORK_UNAVAILABLE, correlationId: 'corr-1' });
  });

  it('rejects invalid category, invalid severity and missing code', () => {
    expect(() => createApplicationError({ code: 'X', category: 'BAD' })).toThrow('APPLICATION_ERROR_CATEGORY_INVALID');
    expect(() => createApplicationError({ code: 'X', severity: 'panic' })).toThrow('APPLICATION_ERROR_SEVERITY_INVALID');
    expect(() => createApplicationError({ category: APPLICATION_ERROR_CATEGORIES.UNKNOWN })).toThrow('APPLICATION_ERROR_CODE_REQUIRED');
  });

  it('sanitizes details and keeps cause non-enumerable', () => {
    const cause = Object.assign(new Error('raw'), { code: 'permission-denied' });
    const error = createApplicationError({
      code: 'SAFE',
      category: APPLICATION_ERROR_CATEGORIES.UNKNOWN,
      cause,
      details: { password: 'secret', token: 'abc', telefone: '999', amount: 10 }
    });
    expect(error.details).toEqual({ amount: 10 });
    expect(error.cause).toBe(cause);
    expect(JSON.stringify(error)).not.toContain('secret');
  });
});

describe('error normalization', () => {
  it.each([
    ['permission-denied', APPLICATION_ERROR_CATEGORIES.AUTHORIZATION, APPLICATION_ERROR_CODES.AUTHORIZATION_DENIED],
    ['unauthenticated', APPLICATION_ERROR_CATEGORIES.AUTHENTICATION, APPLICATION_ERROR_CODES.AUTHENTICATION_REQUIRED],
    ['unavailable', APPLICATION_ERROR_CATEGORIES.NETWORK, APPLICATION_ERROR_CODES.NETWORK_UNAVAILABLE],
    ['deadline-exceeded', APPLICATION_ERROR_CATEGORIES.TIMEOUT, APPLICATION_ERROR_CODES.OPERATION_TIMEOUT],
    ['already-exists', APPLICATION_ERROR_CATEGORIES.CONFLICT, APPLICATION_ERROR_CODES.CONFLICT_DETECTED],
    ['not-found', APPLICATION_ERROR_CATEGORIES.NOT_FOUND, APPLICATION_ERROR_CODES.RESOURCE_NOT_FOUND],
    ['aborted', APPLICATION_ERROR_CATEGORIES.PERSISTENCE, APPLICATION_ERROR_CODES.PERSISTENCE_FAILED],
    ['resource-exhausted', APPLICATION_ERROR_CATEGORIES.PERSISTENCE, APPLICATION_ERROR_CODES.PERSISTENCE_FAILED],
    ['failed-precondition', APPLICATION_ERROR_CATEGORIES.BUSINESS_RULE, APPLICATION_ERROR_CODES.BUSINESS_RULE_BLOCKED]
  ])('maps Firebase %s', (code, category, appCode) => {
    const normalized = normalizeFirebaseError({ code, message: `FirebaseError: ${code}` }, { operation: 'test', correlationId: 'c1' });
    expect(normalized).toMatchObject({ category, code: appCode, operation: 'test', correlationId: 'c1' });
    expect(normalized.userMessage).not.toContain('FirebaseError');
  });

  it.each([
    [REPOSITORY_ERROR_CODES.NOT_FOUND, APPLICATION_ERROR_CATEGORIES.NOT_FOUND],
    [REPOSITORY_ERROR_CODES.PERMISSION_DENIED, APPLICATION_ERROR_CATEGORIES.AUTHORIZATION],
    [REPOSITORY_ERROR_CODES.CONFLICT, APPLICATION_ERROR_CATEGORIES.CONFLICT],
    [REPOSITORY_ERROR_CODES.VALIDATION_ERROR, APPLICATION_ERROR_CATEGORIES.VALIDATION],
    [REPOSITORY_ERROR_CODES.UNAVAILABLE, APPLICATION_ERROR_CATEGORIES.NETWORK],
    [REPOSITORY_ERROR_CODES.TIMEOUT, APPLICATION_ERROR_CATEGORIES.TIMEOUT],
    [REPOSITORY_ERROR_CODES.UNKNOWN_ERROR, APPLICATION_ERROR_CATEGORIES.UNKNOWN]
  ])('maps repository %s', (code, category) => {
    expect(normalizeRepositoryError({ code, message: 'repo' }).category).toBe(category);
  });

  it('normalizes generic, network, timeout, offline and lazy-load failures', () => {
    expect(normalizeApplicationError(new Error('FINANCE_RECORD_CONTRACT_INVALID')).category).toBe(APPLICATION_ERROR_CATEGORIES.VALIDATION);
    expect(normalizeNetworkError(new Error('fetch failed')).category).toBe(APPLICATION_ERROR_CATEGORIES.NETWORK);
    expect(normalizeNetworkError(new Error('deadline timeout')).category).toBe(APPLICATION_ERROR_CATEGORIES.TIMEOUT);
    expect(normalizeNetworkError(new Error('offline'), { offline: true }).category).toBe(APPLICATION_ERROR_CATEGORIES.OFFLINE);
    expect(normalizeLazyLoadError(new Error('Failed to fetch dynamically imported module')).category).toBe(APPLICATION_ERROR_CATEGORIES.LAZY_LOAD);
  });

  it('prevents raw technical objects from becoming UI messages', () => {
    const normalized = normalizeFirebaseError({ code: 'permission-denied', message: 'FirebaseError: permission-denied stack' });
    expect(userMessageForError(normalized)).toBe('Voce nao tem permissao para executar esta acao.');
  });
});

describe('RetryPolicy', () => {
  const policy = createRetryPolicy({ baseDelayMs: 10, maxDelayMs: 40, jitter: () => 0 });

  it.each([
    [OPERATION_TYPES.QUERY, APPLICATION_ERROR_CATEGORIES.NETWORK, true],
    [OPERATION_TYPES.QUERY, APPLICATION_ERROR_CATEGORIES.TIMEOUT, true],
    [OPERATION_TYPES.QUERY, APPLICATION_ERROR_CATEGORIES.VALIDATION, false],
    [OPERATION_TYPES.QUERY, APPLICATION_ERROR_CATEGORIES.AUTHORIZATION, false],
    [OPERATION_TYPES.MUTATION, APPLICATION_ERROR_CATEGORIES.NETWORK, false],
    [OPERATION_TYPES.MUTATION, APPLICATION_ERROR_CATEGORIES.CONFLICT, false],
    [OPERATION_TYPES.MUTATION, APPLICATION_ERROR_CATEGORIES.VALIDATION, false],
    [OPERATION_TYPES.LAZY_LOAD, APPLICATION_ERROR_CATEGORIES.LAZY_LOAD, true]
  ])('evaluates retry for %s %s', (operationType, category, expected) => {
    const error = createApplicationError({ code: `E_${category}`, category });
    const decision = policy.evaluate({ error, operationType, attempt: 1 });
    expect(decision.shouldRetry).toBe(expected);
  });

  it('allows idempotent mutation retry only with the same idempotency key and respects max attempts', async () => {
    let seenKey = '';
    let calls = 0;
    const result = await executeWithResilience(({ idempotencyKey }) => {
      calls += 1;
      seenKey = idempotencyKey;
      if (calls < 2) throw normalizeNetworkError(new Error('network'));
      return { ok: true };
    }, {
      operationType: OPERATION_TYPES.MUTATION,
      idempotent: true,
      idempotencyKey: 'idem-1',
      retryPolicy: createRetryPolicy({ baseDelayMs: 0, maxDelayMs: 0 }),
      sleep: async () => {}
    });
    expect(result.success).toBe(true);
    expect(result.attempts).toBe(2);
    expect(seenKey).toBe('idem-1');

    const blocked = await executeWithResilience(() => {
      throw normalizeNetworkError(new Error('network'));
    }, {
      operationType: OPERATION_TYPES.MUTATION,
      retryPolicy: createRetryPolicy({ baseDelayMs: 0, maxDelayMs: 0 }),
      sleep: async () => {}
    });
    expect(blocked.attempts).toBe(1);
    expect(blocked.attemptLog[0].retry.reason).toBe('MUTATION_NOT_IDEMPOTENT');
  });

  it('does not loop forever', async () => {
    const result = await executeWithResilience(() => {
      throw normalizeNetworkError(new Error('network'));
    }, {
      operationType: OPERATION_TYPES.QUERY,
      retryPolicy: createRetryPolicy({ maxQueryAttempts: 2, baseDelayMs: 0, maxDelayMs: 0 }),
      sleep: async () => {}
    });
    expect(result.success).toBe(false);
    expect(result.attempts).toBe(2);
    expect(result.attemptLog.at(-1).retry.reason).toBe('MAX_ATTEMPTS_REACHED');
  });
});

describe('ConnectivityService', () => {
  it('tracks online/offline status, subscriptions and cleanup', () => {
    const service = new InMemoryConnectivityService();
    const listener = vi.fn();
    const unsubscribe = service.subscribe(listener);
    expect(service.isOnline()).toBe(true);
    service.setStatus(CONNECTIVITY_STATUS.OFFLINE);
    expect(service.isOnline()).toBe(false);
    expect(listener).toHaveBeenLastCalledWith(CONNECTIVITY_STATUS.OFFLINE);
    unsubscribe();
    expect(service.activeCount()).toBe(0);
  });
});

describe('AsyncViewState', () => {
  it('models loading, success, empty, error, stale, offline and retry availability', () => {
    expect(toLoadingState().status).toBe('loading');
    expect(toSuccessState([{ id: 1 }], now).status).toBe('success');
    expect(toSuccessState([], now).status).toBe('empty');
    const errorState = toErrorState(normalizeNetworkError(new Error('network')));
    expect(errorState.status).toBe('error');
    expect(errorState.retryAvailable).toBe(true);
    const stale = toErrorState(normalizeNetworkError(new Error('network')), toSuccessState([{ id: 1 }], now));
    expect(stale.status).toBe('stale');
    expect(toOfflineState(stale).status).toBe('offline');
    expect(createAsyncViewState({ status: 'idle' }).status).toBe('idle');
  });
});

describe('ErrorReporter and post-commit failures', () => {
  it('stores sanitized bounded diagnostics and clears locally', () => {
    const reporter = new InMemoryErrorReporter({ limit: 2, now });
    reporter.report({ error: normalizeNetworkError(new Error('network')), context: { token: 'secret', amount: 10, whatsapp: 'no' } });
    reporter.report({ error: normalizeApplicationError(new Error('unknown')) });
    reporter.report({ error: normalizeLazyLoadError(new Error('chunk')) });
    const events = reporter.listRecent();
    expect(events).toHaveLength(2);
    expect(JSON.stringify(events)).not.toContain('secret');
    expect(JSON.stringify(events)).not.toContain('whatsapp');
    expect(reporter.clearLocal()).toEqual({ ok: true, cleared: true });
    expect(reporter.listRecent()).toHaveLength(0);
  });

  it('represents audit failure after commit as observable warning, not saved failure', () => {
    const error = createApplicationError({
      code: APPLICATION_ERROR_CODES.POST_COMMIT_AUDIT_FAILED,
      category: APPLICATION_ERROR_CATEGORIES.PERSISTENCE,
      severity: 'warning',
      message: 'Audit failed after commit.',
      userMessage: 'Operacao principal concluida, mas a auditoria falhou.'
    });
    expect(error.severity).toBe('warning');
    expect(error.userMessage).toContain('principal concluida');
  });
});

describe('future backend compatibility', () => {
  it('keeps error contract serializable and DOM independent', async () => {
    const result = await executeWithResilience(() => ({ accepted: true }), {
      operationType: OPERATION_TYPES.QUERY,
      correlationId: 'backend-corr'
    });
    expect(result.correlationId).toBe('backend-corr');
    expect(JSON.stringify(serializeApplicationError(normalizeApplicationError(new Error('opaque'))))).not.toContain('window');
  });
});
