import { APPLICATION_RESULT_CODES, createErrorResult } from './applicationResult.js';

export class CommandHandlerRegistry {
  constructor(initialHandlers = {}) {
    this.handlers = new Map();
    Object.entries(initialHandlers).forEach(([name, handler]) => this.register(name, handler));
  }

  register(name, handler) {
    if (!name || typeof handler !== 'function') {
      throw new Error('COMMAND_HANDLER_INVALID');
    }
    this.handlers.set(name, handler);
    return this;
  }

  resolve(name) {
    return this.handlers.get(name) || null;
  }

  unknown(name = '') {
    return createErrorResult({
      code: APPLICATION_RESULT_CODES.NOT_FOUND,
      message: `Comando nao registrado: ${name}.`
    });
  }
}

export class QueryHandlerRegistry {
  constructor(initialHandlers = {}) {
    this.handlers = new Map();
    Object.entries(initialHandlers).forEach(([name, handler]) => this.register(name, handler));
  }

  register(name, handler) {
    if (!name || typeof handler !== 'function') {
      throw new Error('QUERY_HANDLER_INVALID');
    }
    this.handlers.set(name, handler);
    return this;
  }

  resolve(name) {
    return this.handlers.get(name) || null;
  }

  unknown(name = '') {
    return createErrorResult({
      code: APPLICATION_RESULT_CODES.NOT_FOUND,
      message: `Consulta nao registrada: ${name}.`
    });
  }
}
