import * as Sentry from '@sentry/browser';
import {
  pseudonymizeUserId,
  sanitizeSentryEvent,
  sanitizeTelemetryContext,
  sanitizeTelemetryMessage
} from './sanitizer.js';

export function createSentryAdapter({
  dsn,
  environment = 'unknown',
  release = '',
  tracesSampleRate = 0.05
} = {}) {
  Sentry.init({
    dsn,
    environment: sanitizeTelemetryMessage(environment),
    release: release ? sanitizeTelemetryMessage(release) : undefined,
    sendDefaultPii: false,
    tracesSampleRate: Math.max(0, Math.min(1, Number(tracesSampleRate) || 0)),
    integrations: [Sentry.browserTracingIntegration({ tracePropagationTargets: [] })],
    beforeSend: (event) => sanitizeSentryEvent(event),
    beforeSendTransaction: (event) => sanitizeSentryEvent(event),
    beforeBreadcrumb: (breadcrumb) => sanitizeSentryEvent(breadcrumb)
  });

  return {
    name: 'sentry',
    captureError(error, context = {}) {
      return Sentry.withScope((scope) => {
        scope.setContext('operation', sanitizeTelemetryContext(context));
        return Sentry.captureException(error instanceof Error ? error : new Error(sanitizeTelemetryMessage(error)));
      });
    },
    captureMessage(message, context = {}) {
      return Sentry.withScope((scope) => {
        scope.setContext('operation', sanitizeTelemetryContext(context));
        return Sentry.captureMessage(sanitizeTelemetryMessage(message));
      });
    },
    setUser(user = {}) {
      const rawId = user.uid || user.id || '';
      const id = String(rawId).startsWith('usr_') ? rawId : pseudonymizeUserId(rawId);
      Sentry.setUser(id ? {
        id,
        role: sanitizeTelemetryMessage(user.role || 'user'),
        status: sanitizeTelemetryMessage(user.status || '')
      } : null);
    },
    clearUser() {
      Sentry.setUser(null);
    },
    startSpan(name, context = {}) {
      const span = Sentry.startInactiveSpan({
        name: sanitizeTelemetryMessage(name),
        op: sanitizeTelemetryMessage(context.operation || 'app.operation'),
        attributes: sanitizeTelemetryContext(context)
      });
      return {
        setAttribute(key, value) {
          const sanitized = sanitizeTelemetryContext({ [key]: value });
          span.setAttribute(key, sanitized[key]);
        },
        finish(status = 'ok', details = {}) {
          Object.entries(sanitizeTelemetryContext(details)).forEach(([key, value]) => span.setAttribute(key, value));
          span.setStatus({ code: status === 'error' ? 2 : 1 });
          span.end();
        }
      };
    }
  };
}
