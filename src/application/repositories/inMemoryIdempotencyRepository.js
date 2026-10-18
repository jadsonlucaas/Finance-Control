import {
  buildIdempotencyReceipt,
  IDEMPOTENCY_RECEIPT_STATUS,
  idempotencyLogicalKey,
  receiptDocumentId
} from '../gateway/idempotency.js';
import {
  cloneRepositoryData,
  REPOSITORY_ERROR_CODES,
  repositoryFailure,
  repositoryOk
} from './repositoryResult.js';
import { pageItems } from './pagination.js';

function ownerFrom(input = {}, context = {}) {
  return input.ownerUid || input.owner_uid || context.ownerUid || context.actorUid || context.uid || '';
}

function inputFrom(input = {}, context = {}, now) {
  return {
    ...input,
    ownerUid: ownerFrom(input, context),
    commandName: input.commandName || input.command_name || '',
    sourceChannel: input.sourceChannel || input.source_channel || 'web',
    idempotencyKey: input.idempotencyKey || input.idempotency_key || '',
    requestFingerprint: input.requestFingerprint || input.request_fingerprint || '',
    correlationId: input.correlationId || input.correlation_id || context.correlationId || '',
    createdAt: input.createdAt || input.created_at || now()
  };
}

function receiptResult(id, receipt, reservationStatus) {
  return repositoryOk({
    id,
    data: {
      ...cloneRepositoryData(receipt),
      reservation_status: reservationStatus
    }
  });
}

function conflict(message = 'Operacao idempotente em conflito.') {
  return repositoryFailure({ code: REPOSITORY_ERROR_CODES.CONFLICT, message });
}

function validateInput(input = {}) {
  if (!input.ownerUid || !input.commandName || !input.sourceChannel || !input.idempotencyKey || !input.requestFingerprint) {
    return repositoryFailure({
      code: REPOSITORY_ERROR_CODES.VALIDATION_ERROR,
      message: 'Receipt de idempotencia exige owner, comando, origem, chave e fingerprint.'
    });
  }
  return null;
}

export class InMemoryIdempotencyRepository {
  constructor(options = {}) {
    this.now = options.now || (() => new Date().toISOString());
    this.records = new Map();
    this.recordsById = new Map();
  }

  async reserve(input = {}, context = {}) {
    const prepared = inputFrom(input, context, this.now);
    const invalid = validateInput(prepared);
    if (invalid) return invalid;
    const key = idempotencyLogicalKey(prepared);
    const id = receiptDocumentId(prepared);
    const existing = this.records.get(key);
    if (!existing) {
      const receipt = buildIdempotencyReceipt({ ...prepared, status: IDEMPOTENCY_RECEIPT_STATUS.PROCESSING }, { now: this.now });
      this.records.set(key, cloneRepositoryData(receipt));
      this.recordsById.set(id, key);
      return receiptResult(id, receipt, 'reserved');
    }
    if (existing.request_fingerprint !== prepared.requestFingerprint) {
      return conflict('Idempotency key reutilizada com payload diferente.');
    }
    if (existing.status === IDEMPOTENCY_RECEIPT_STATUS.COMPLETED) {
      return receiptResult(id, existing, 'replay');
    }
    if (existing.status === IDEMPOTENCY_RECEIPT_STATUS.PROCESSING) {
      return conflict('Operacao idempotente ja esta em processamento.');
    }
    const retry = {
      ...existing,
      status: IDEMPOTENCY_RECEIPT_STATUS.PROCESSING,
      failed_at: '',
      result_code: '',
      created_at: this.now()
    };
    this.records.set(key, cloneRepositoryData(retry));
    return receiptResult(id, retry, 'retry');
  }

  async complete(reservationId = '', result = {}, context = {}) {
    const key = this.recordsById.get(reservationId);
    const current = key ? this.records.get(key) : null;
    if (!current) return repositoryFailure({ code: REPOSITORY_ERROR_CODES.NOT_FOUND, message: 'Receipt nao encontrado.' });
    if (current.status !== IDEMPOTENCY_RECEIPT_STATUS.PROCESSING) return conflict('Receipt nao esta em processamento.');
    const completed = {
      ...current,
      status: IDEMPOTENCY_RECEIPT_STATUS.COMPLETED,
      entity_id: result.entityId || result.id || current.entity_id || '',
      entity_ids: Array.isArray(result.entityIds || result.ids) ? result.entityIds || result.ids : [],
      result_code: result.code || '',
      correlation_id: result.correlationId || current.correlation_id || context.correlationId || '',
      completed_at: this.now(),
      result_reference: {
        success: result.success === true,
        code: result.code || '',
        entityId: result.entityId || '',
        entityIds: Array.isArray(result.entityIds) ? result.entityIds : [],
        message: result.message || ''
      }
    };
    this.records.set(key, cloneRepositoryData(completed));
    return receiptResult(reservationId, completed, 'completed');
  }

  async fail(reservationId = '', error = {}, context = {}) {
    const key = this.recordsById.get(reservationId);
    const current = key ? this.records.get(key) : null;
    if (!current) return repositoryFailure({ code: REPOSITORY_ERROR_CODES.NOT_FOUND, message: 'Receipt nao encontrado.' });
    if (current.status !== IDEMPOTENCY_RECEIPT_STATUS.PROCESSING) return conflict('Receipt nao esta em processamento.');
    const failed = {
      ...current,
      status: IDEMPOTENCY_RECEIPT_STATUS.FAILED,
      result_code: error.code || '',
      correlation_id: error.correlationId || current.correlation_id || context.correlationId || '',
      failed_at: this.now()
    };
    this.records.set(key, cloneRepositoryData(failed));
    return receiptResult(reservationId, failed, 'failed');
  }

  async find(input = {}, context = {}) {
    const prepared = inputFrom(input, context, this.now);
    const key = idempotencyLogicalKey(prepared);
    const receipt = this.records.get(key);
    if (!receipt) return repositoryFailure({ code: REPOSITORY_ERROR_CODES.NOT_FOUND, message: 'Receipt nao encontrado.' });
    return receiptResult(receiptDocumentId(prepared), receipt, 'found');
  }

  async getById(id = '') {
    const key = this.recordsById.get(id);
    const receipt = key ? this.records.get(key) : null;
    if (!receipt) return repositoryFailure({ code: REPOSITORY_ERROR_CODES.NOT_FOUND, message: 'Receipt nao encontrado.' });
    return receiptResult(id, receipt, 'found');
  }

  async cleanupExpired() {
    return repositoryOk({ count: 0, data: { wrote: false } });
  }

  async list(query = {}, context = {}) {
    const owner = ownerFrom(query, context);
    const items = [...this.records.values()]
      .filter((receipt) => !owner || receipt.owner_uid === owner)
      .filter((receipt) => !query.commandName || receipt.command_name === query.commandName)
      .filter((receipt) => !query.sourceChannel || receipt.source_channel === query.sourceChannel)
      .filter((receipt) => !query.status || receipt.status === query.status);
    const page = pageItems(items, { orderBy: 'created_at', ...query });
    const paged = cloneRepositoryData(page.items);
    return repositoryOk({ ...page, items: paged, data: paged });
  }
}
