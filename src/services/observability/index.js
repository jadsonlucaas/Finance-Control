import {
  pseudonymizeUserId,
  sanitizeTelemetryContext,
  sanitizeTelemetryMessage
} from './sanitizer.js';

const noopSpan = Object.freeze({ setAttribute() {}, finish() {} });
const noopAdapter = Object.freeze({
  name: 'noop',
  captureError() {},
  captureMessage() {},
  setUser() {},
  clearUser() {},
  startSpan() { return noopSpan; }
});

let adapter = noopAdapter;
let initialization = null;
let initialized = false;
let initializationComplete = false;
const pendingEvents = [];

function safeAdapterCall(method, ...args) {
  try {
    return adapter?.[method]?.(...args);
  } catch {
    return undefined;
  }
}

function enqueue(type, args) {
  pendingEvents.push({ type, args });
  if (pendingEvents.length > 25) pendingEvents.shift();
}

function flushPendingEvents() {
  pendingEvents.splice(0).forEach(({ type, args }) => safeAdapterCall(type, ...args));
}

export function configureObservability(nextAdapter = noopAdapter) {
  adapter = nextAdapter || noopAdapter;
  initialized = adapter !== noopAdapter;
  initializationComplete = true;
  if (initialized) flushPendingEvents();
  return adapter;
}

export function initializeObservability(options = {}) {
  if (initialization) return initialization;
  const env = options.env || import.meta.env || {};
  const dsn = String(options.dsn || env.VITE_SENTRY_DSN || '').trim();
  if (!dsn) {
    initializationComplete = true;
    initialization = Promise.resolve({ enabled: false, provider: 'noop', reason: 'SENTRY_DSN_NOT_CONFIGURED' });
    return initialization;
  }
  initialization = import('./sentryAdapter.js')
    .then(({ createSentryAdapter }) => {
      const sentryAdapter = createSentryAdapter({
        dsn,
        environment: options.environment || env.VITE_FINANCE_ENV || env.MODE || 'unknown',
        release: options.release || env.VITE_APP_RELEASE || '',
        tracesSampleRate: options.tracesSampleRate ?? env.VITE_SENTRY_TRACES_SAMPLE_RATE ?? 0.05
      });
      configureObservability(sentryAdapter);
      return { enabled: true, provider: sentryAdapter.name };
    })
    .catch(() => {
      initializationComplete = true;
      return { enabled: false, provider: 'noop', reason: 'SENTRY_INITIALIZATION_FAILED' };
    });
  return initialization;
}

export function captureError(error, context = {}) {
  const safeContext = sanitizeTelemetryContext(context);
  if (!initialized && !initializationComplete) {
    enqueue('captureError', [error, safeContext]);
    return undefined;
  }
  return safeAdapterCall('captureError', error, safeContext);
}

export function captureMessage(message, context = {}) {
  const safeMessage = sanitizeTelemetryMessage(message);
  const safeContext = sanitizeTelemetryContext(context);
  if (!initialized && !initializationComplete) {
    enqueue('captureMessage', [safeMessage, safeContext]);
    return undefined;
  }
  return safeAdapterCall('captureMessage', safeMessage, safeContext);
}

export function setUserContext(user = {}) {
  return safeAdapterCall('setUser', {
    id: pseudonymizeUserId(user.uid || user.id || ''),
    role: sanitizeTelemetryMessage(user.role || 'user'),
    status: sanitizeTelemetryMessage(user.status || '')
  });
}

export function clearUserContext() {
  return safeAdapterCall('clearUser');
}

export function startTrace(name, context = {}) {
  const safeName = sanitizeTelemetryMessage(name);
  const safeContext = sanitizeTelemetryContext(context);
  const startedAt = globalThis.performance?.now?.() || Date.now();
  const providerSpan = safeAdapterCall('startSpan', safeName, safeContext) || noopSpan;
  let finished = false;
  return {
    setAttribute(key, value) {
      if (!finished) providerSpan.setAttribute?.(key, value);
    },
    finish(status = 'ok', details = {}) {
      if (finished) return;
      finished = true;
      const endedAt = globalThis.performance?.now?.() || Date.now();
      providerSpan.finish?.(status, {
        ...sanitizeTelemetryContext(details),
        duration_ms: Math.max(0, Math.round((endedAt - startedAt) * 100) / 100)
      });
    }
  };
}

export async function traceOperation(name, context, operation) {
  const span = startTrace(name, context);
  try {
    const result = await operation();
    span.finish('ok');
    return result;
  } catch (error) {
    span.finish('error', { error_code: error?.code || error?.name || 'UNEXPECTED_ERROR' });
    captureError(error, { ...context, operation: name });
    throw error;
  }
}

export function getObservabilityState() {
  return Object.freeze({ initialized, initializationComplete, provider: adapter.name || 'noop', pendingEvents: pendingEvents.length });
}

export { createOpenTelemetryAdapter } from './openTelemetryAdapter.js';
export * from './sanitizer.js';
