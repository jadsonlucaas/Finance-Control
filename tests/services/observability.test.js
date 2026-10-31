import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  captureError,
  captureMessage,
  clearUserContext,
  configureObservability,
  createOpenTelemetryAdapter,
  getObservabilityState,
  pseudonymizeUserId,
  sanitizeSentryEvent,
  sanitizeTelemetryContext,
  setUserContext,
  startTrace,
  traceOperation
} from '../../src/services/observability/index.js';

function adapter() {
  return {
    name: 'test',
    captureError: vi.fn(),
    captureMessage: vi.fn(),
    setUser: vi.fn(),
    clearUser: vi.fn(),
    startSpan: vi.fn(() => ({ setAttribute: vi.fn(), finish: vi.fn() }))
  };
}

afterEach(() => configureObservability(null));

describe('observability privacy boundary', () => {
  it('redacts PII, credentials, financial values, backups and import payloads', () => {
    const sanitized = sanitizeTelemetryContext({
      email: 'person@example.com',
      password: 'unsafe',
      amount: 1234.56,
      token: 'eyJabc.def.ghi',
      backup: { records: [{ amount: 10 }] },
      import_rows: [{ person: 'Ana', value: 10 }],
      duration_ms: 42,
      record_count: 3,
      message: 'contact person@example.com with R$ 1.234,56'
    });

    expect(sanitized).toMatchObject({
      email: '[REDACTED]',
      password: '[REDACTED]',
      amount: '[REDACTED]',
      token: '[REDACTED]',
      backup: '[REDACTED]',
      import_rows: '[REDACTED]',
      duration_ms: 42,
      record_count: 3
    });
    expect(sanitized.message).not.toContain('person@example.com');
    expect(sanitized.message).not.toContain('1.234,56');
  });

  it('keeps Sentry exception structure while sanitizing messages and home paths', () => {
    const event = sanitizeSentryEvent({
      exception: {
        values: [{
          type: 'Error',
          value: 'failed for person@example.com amount 1000',
          stacktrace: { frames: [{ filename: 'C:\\Users\\alice\\project\\app.js' }] }
        }]
      }
    });
    expect(event.exception.values).toHaveLength(1);
    expect(event.exception.values[0].value).not.toContain('person@example.com');
    expect(event.exception.values[0].value).not.toContain('1000');
    expect(event.exception.values[0].stacktrace.frames[0].filename).not.toContain('alice');
  });

  it('creates stable pseudonymous user ids without retaining the source uid', () => {
    const first = pseudonymizeUserId('firebase-user-123');
    expect(first).toBe(pseudonymizeUserId('firebase-user-123'));
    expect(first).not.toContain('firebase-user-123');
  });
});

describe('observability facade', () => {
  it('delegates sanitized errors, messages, users and traces to the configured adapter', () => {
    const target = adapter();
    configureObservability(target);

    captureError(new Error('boom'), { email: 'person@example.com', operation: 'test' });
    captureMessage('hello person@example.com', { amount: 99 });
    setUserContext({ uid: 'uid-secret', email: 'person@example.com', role: 'admin' });
    const span = startTrace('critical.flow', { amount: 10, record_count: 2 });
    span.finish('ok', { duration_ms: 5 });
    clearUserContext();

    expect(target.captureError.mock.calls[0][1].email).toBe('[REDACTED]');
    expect(target.captureMessage.mock.calls[0][0]).not.toContain('person@example.com');
    expect(target.captureMessage.mock.calls[0][1].amount).toBe('[REDACTED]');
    expect(target.setUser.mock.calls[0][0].id).toMatch(/^usr_/);
    expect(target.startSpan.mock.calls[0][1].amount).toBe('[REDACTED]');
    expect(target.clearUser).toHaveBeenCalledOnce();
    expect(getObservabilityState()).toMatchObject({ initialized: true, provider: 'test' });
  });

  it('finishes failed operations and rethrows the original error', async () => {
    const target = adapter();
    configureObservability(target);
    const error = new Error('operation failed');
    await expect(traceOperation('firestore.create', { operation: 'firestore.create' }, async () => {
      throw error;
    })).rejects.toBe(error);
    expect(target.captureError).toHaveBeenCalled();
    expect(target.startSpan.mock.results[0].value.finish).toHaveBeenCalledWith('error', expect.any(Object));
  });

  it('adapts an injected OpenTelemetry tracer without a vendor exporter', () => {
    const span = { setAttribute: vi.fn(), setStatus: vi.fn(), end: vi.fn() };
    const tracer = { startSpan: vi.fn(() => span) };
    const otel = createOpenTelemetryAdapter({ tracer });
    const operation = otel.startSpan('backup.preview', { backup: { secret: true }, record_count: 2 });
    operation.finish('ok', { wrote: false });
    expect(tracer).toBeTruthy();
    expect(tracer.startSpan.mock.calls[0][1].attributes.backup).toBe('[REDACTED]');
    expect(span.end).toHaveBeenCalledOnce();
  });
});
