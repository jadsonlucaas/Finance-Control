import { SpanStatusCode, trace } from '@opentelemetry/api';
import { sanitizeTelemetryContext, sanitizeTelemetryMessage } from './sanitizer.js';

function toAttributes(context = {}) {
  return Object.fromEntries(Object.entries(sanitizeTelemetryContext(context)).map(([key, value]) => [
    key,
    value === null || ['string', 'number', 'boolean'].includes(typeof value) ? value : JSON.stringify(value)
  ]));
}

export function createOpenTelemetryAdapter({ tracer = trace.getTracer('finance-control-web') } = {}) {
  return {
    name: 'opentelemetry',
    startSpan(name, context = {}) {
      const span = tracer.startSpan(sanitizeTelemetryMessage(name), {
        attributes: toAttributes(context)
      });
      return {
        setAttribute(key, value) {
          const sanitized = toAttributes({ [key]: value });
          span.setAttribute(key, sanitized[key]);
        },
        finish(status = 'ok', details = {}) {
          Object.entries(toAttributes(details)).forEach(([key, value]) => span.setAttribute(key, value));
          span.setStatus({
            code: status === 'error' ? SpanStatusCode.ERROR : SpanStatusCode.OK
          });
          span.end();
        }
      };
    }
  };
}
