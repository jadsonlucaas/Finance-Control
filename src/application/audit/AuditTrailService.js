import { buildAuditEvent } from './auditEvents.js';
import { repositoryFailure, repositoryOk, REPOSITORY_ERROR_CODES } from '../repositories/repositoryResult.js';

function resultStatus(method = 'recordSuccess') {
  if (method === 'recordFailure') return 'failure';
  if (method === 'recordReplay') return 'replay';
  if (method === 'recordConflict') return 'conflict';
  return 'success';
}

export class AuditTrailService {
  constructor({
    auditRepository,
    clock = { now: () => new Date().toISOString() },
    idGenerator = null,
    sanitizerPolicy = {}
  } = {}) {
    this.auditRepository = auditRepository;
    this.clock = clock;
    this.idGenerator = idGenerator;
    this.sanitizerPolicy = sanitizerPolicy;
  }

  buildEvent(input = {}) {
    return buildAuditEvent(input, {
      now: this.clock.now,
      idGenerator: this.idGenerator,
      snapshotPolicy: this.sanitizerPolicy,
      metadataPolicy: this.sanitizerPolicy
    });
  }

  async record(input = {}, status = 'success', context = {}) {
    const built = this.buildEvent({ ...input, result_status: status, status });
    if (!built.validation.isValid) {
      return repositoryFailure({
        code: REPOSITORY_ERROR_CODES.VALIDATION_ERROR,
        message: 'Evento de auditoria invalido.',
        validationErrors: built.validation.errors,
        data: { warnings: built.warnings }
      });
    }
    if (typeof this.auditRepository?.append !== 'function') {
      return repositoryFailure({
        code: REPOSITORY_ERROR_CODES.UNAVAILABLE,
        message: 'AuditRepository indisponivel.',
        data: { warnings: built.warnings }
      });
    }
    const result = await this.auditRepository.append(built.event, context);
    if (!result?.ok) return result;
    return repositoryOk({
      id: result.id || built.event.event_id,
      data: { ...built.event, audit_warnings: built.warnings }
    });
  }

  recordSuccess(input = {}, context = {}) {
    return this.record(input, resultStatus('recordSuccess'), context);
  }

  recordFailure(input = {}, context = {}) {
    return this.record(input, resultStatus('recordFailure'), context);
  }

  recordReplay(input = {}, context = {}) {
    return this.record(input, resultStatus('recordReplay'), context);
  }

  recordConflict(input = {}, context = {}) {
    return this.record(input, resultStatus('recordConflict'), context);
  }
}
