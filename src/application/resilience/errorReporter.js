import { serializeApplicationError } from './applicationError.js';
import { normalizeApplicationError } from './errorNormalization.js';

const SENSITIVE_CONTEXT_KEYS = /(password|senha|token|secret|authorization|credential|phone|telefone|whatsapp|payload|file|raw)/i;

function sanitizeContext(context = {}) {
  return Object.fromEntries(Object.entries(context || {})
    .filter(([key]) => !SENSITIVE_CONTEXT_KEYS.test(key))
    .map(([key, value]) => [
      key,
      typeof value === 'string' && value.length > 160 ? `${value.slice(0, 160)}...` : value
    ]));
}

export class InMemoryErrorReporter {
  constructor(options = {}) {
    this.limit = options.limit || 50;
    this.now = options.now || (() => new Date().toISOString());
    this.onReport = typeof options.onReport === 'function' ? options.onReport : null;
    this.events = [];
  }

  report(errorEvent = {}) {
    const error = serializeApplicationError(errorEvent.error || normalizeApplicationError(errorEvent.cause || errorEvent));
    const event = {
      code: error.code,
      category: error.category,
      severity: error.severity,
      operation: errorEvent.operation || error.operation || '',
      correlationId: errorEvent.correlationId || error.correlationId || '',
      timestamp: errorEvent.timestamp || this.now(),
      error,
      context: sanitizeContext(errorEvent.context || {})
    };
    this.events.push(event);
    if (this.events.length > this.limit) this.events.splice(0, this.events.length - this.limit);
    try {
      this.onReport?.(event);
    } catch {
      // Observability must never change the application error path.
    }
    return event;
  }

  listRecent() {
    return this.events.map((event) => JSON.parse(JSON.stringify(event)));
  }

  clearLocal() {
    this.events = [];
    return { ok: true, cleared: true };
  }
}
