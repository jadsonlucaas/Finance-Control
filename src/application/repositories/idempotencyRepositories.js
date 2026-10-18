import {
  buildIdempotencyReceipt,
  IDEMPOTENCY_RECEIPT_STATUS,
  idempotencyLogicalKey,
  receiptDocumentId
} from '../gateway/idempotency.js';
import {
  cloneRepositoryData,
  mapUnknownRepositoryError,
  REPOSITORY_ERROR_CODES,
  repositoryFailure,
  repositoryOk
} from './repositoryResult.js';
import { decodePageCursor, encodePageCursor, normalizePaginationQuery, pageItems } from './pagination.js';

async function loadFirestoreFns() {
  return import('firebase/firestore');
}

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

function resolveDb(dbOrGetter) {
  return typeof dbOrGetter === 'function' ? dbOrGetter() : dbOrGetter;
}

export class FirebaseWebIdempotencyRepository {
  constructor({ db, now = () => new Date().toISOString() } = {}) {
    this.db = db;
    this.now = now;
    this.adapterType = 'firebase-web';
  }

  getDb() {
    const db = resolveDb(this.db);
    if (!db) throw new Error('FirebaseWebIdempotencyRepository.db is not configured.');
    return db;
  }

  async ref(input = {}, context = {}) {
    const { doc } = await loadFirestoreFns();
    const prepared = inputFrom(input, context, this.now);
    return {
      id: receiptDocumentId(prepared),
      prepared,
      ref: doc(this.getDb(), `users/${prepared.ownerUid}/idempotency_receipts/${receiptDocumentId(prepared)}`)
    };
  }

  async reserve(input = {}, context = {}) {
    try {
      const { runTransaction } = await loadFirestoreFns();
      const { id, prepared, ref } = await this.ref(input, context);
      const invalid = validateInput(prepared);
      if (invalid) return invalid;
      const txResult = await runTransaction(this.getDb(), async (transaction) => {
        const snapshot = await transaction.get(ref);
        if (!snapshot.exists()) {
          const receipt = buildIdempotencyReceipt({ ...prepared, status: IDEMPOTENCY_RECEIPT_STATUS.PROCESSING }, { now: this.now });
          transaction.set(ref, receipt);
          return { receipt, reservationStatus: 'reserved' };
        }
        const existing = snapshot.data();
        if (existing.request_fingerprint !== prepared.requestFingerprint) return { conflict: 'Idempotency key reutilizada com payload diferente.' };
        if (existing.status === IDEMPOTENCY_RECEIPT_STATUS.COMPLETED) return { receipt: existing, reservationStatus: 'replay' };
        if (existing.status === IDEMPOTENCY_RECEIPT_STATUS.PROCESSING) return { conflict: 'Operacao idempotente ja esta em processamento.' };
        const retry = {
          ...existing,
          status: IDEMPOTENCY_RECEIPT_STATUS.PROCESSING,
          failed_at: '',
          result_code: '',
          created_at: this.now()
        };
        transaction.set(ref, retry);
        return { receipt: retry, reservationStatus: 'retry' };
      });
      if (txResult.conflict) return conflict(txResult.conflict);
      return receiptResult(id, txResult.receipt, txResult.reservationStatus);
    } catch (error) {
      return mapUnknownRepositoryError(error);
    }
  }

  async complete(reservationId = '', result = {}, context = {}) {
    try {
      const { doc, runTransaction } = await loadFirestoreFns();
      const owner = ownerFrom({}, context);
      const ref = doc(this.getDb(), `users/${owner}/idempotency_receipts/${reservationId}`);
      const txResult = await runTransaction(this.getDb(), async (transaction) => {
        const snapshot = await transaction.get(ref);
        if (!snapshot.exists()) return { notFound: true };
        const current = snapshot.data();
        if (current.status !== IDEMPOTENCY_RECEIPT_STATUS.PROCESSING) return { conflict: 'Receipt nao esta em processamento.' };
        const completed = {
          ...current,
          status: IDEMPOTENCY_RECEIPT_STATUS.COMPLETED,
          entity_id: result.entityId || result.id || '',
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
        transaction.set(ref, completed);
        return { receipt: completed };
      });
      if (txResult.notFound) return repositoryFailure({ code: REPOSITORY_ERROR_CODES.NOT_FOUND, message: 'Receipt nao encontrado.' });
      if (txResult.conflict) return conflict(txResult.conflict);
      return receiptResult(reservationId, txResult.receipt, 'completed');
    } catch (error) {
      return mapUnknownRepositoryError(error);
    }
  }

  async fail(reservationId = '', error = {}, context = {}) {
    try {
      const { doc, runTransaction } = await loadFirestoreFns();
      const owner = ownerFrom({}, context);
      const ref = doc(this.getDb(), `users/${owner}/idempotency_receipts/${reservationId}`);
      const txResult = await runTransaction(this.getDb(), async (transaction) => {
        const snapshot = await transaction.get(ref);
        if (!snapshot.exists()) return { notFound: true };
        const current = snapshot.data();
        if (current.status !== IDEMPOTENCY_RECEIPT_STATUS.PROCESSING) return { conflict: 'Receipt nao esta em processamento.' };
        const failed = {
          ...current,
          status: IDEMPOTENCY_RECEIPT_STATUS.FAILED,
          result_code: error.code || '',
          correlation_id: error.correlationId || current.correlation_id || context.correlationId || '',
          failed_at: this.now()
        };
        transaction.set(ref, failed);
        return { receipt: failed };
      });
      if (txResult.notFound) return repositoryFailure({ code: REPOSITORY_ERROR_CODES.NOT_FOUND, message: 'Receipt nao encontrado.' });
      if (txResult.conflict) return conflict(txResult.conflict);
      return receiptResult(reservationId, txResult.receipt, 'failed');
    } catch (error) {
      return mapUnknownRepositoryError(error);
    }
  }

  async find(input = {}, context = {}) {
    try {
      const { getDoc } = await loadFirestoreFns();
      const { id, ref } = await this.ref(input, context);
      const snapshot = await getDoc(ref);
      if (!snapshot.exists()) return repositoryFailure({ code: REPOSITORY_ERROR_CODES.NOT_FOUND, message: 'Receipt nao encontrado.' });
      return receiptResult(id, snapshot.data(), 'found');
    } catch (error) {
      return mapUnknownRepositoryError(error);
    }
  }

  async getById(id = '', context = {}) {
    try {
      const { doc, getDoc } = await loadFirestoreFns();
      const owner = ownerFrom({}, context);
      const snapshot = await getDoc(doc(this.getDb(), `users/${owner}/idempotency_receipts/${id}`));
      if (!snapshot.exists()) return repositoryFailure({ code: REPOSITORY_ERROR_CODES.NOT_FOUND, message: 'Receipt nao encontrado.' });
      return receiptResult(id, snapshot.data(), 'found');
    } catch (error) {
      return mapUnknownRepositoryError(error);
    }
  }

  async cleanupExpired() {
    return repositoryOk({ count: 0, data: { wrote: false } });
  }

  async list(query = {}, context = {}) {
    try {
      const owner = ownerFrom(query, context);
      if (!owner) {
        return repositoryFailure({ code: REPOSITORY_ERROR_CODES.VALIDATION_ERROR, message: 'ownerUid obrigatorio para receipts.' });
      }
      if (context.role !== 'admin' && context.ownerUid && owner !== context.ownerUid) {
        return repositoryFailure({ code: REPOSITORY_ERROR_CODES.PERMISSION_DENIED, message: 'Consulta cruzada de receipts exige admin.' });
      }
      const {
        collection,
        documentId,
        getDocs,
        limit,
        orderBy,
        query: firestoreQuery,
        startAfter,
        where
      } = await loadFirestoreFns();
      const page = normalizePaginationQuery({ orderBy: 'created_at', ...query });
      const constraints = [];
      if (query.commandName) constraints.push(where('command_name', '==', query.commandName));
      if (query.sourceChannel) constraints.push(where('source_channel', '==', query.sourceChannel));
      if (query.status) constraints.push(where('status', '==', query.status));
      const orderField = page.orderBy === 'id' ? documentId() : page.orderBy;
      constraints.push(orderBy(orderField, page.direction));
      if (page.orderBy !== 'id') constraints.push(orderBy(documentId(), page.direction));
      const decoded = decodePageCursor(query.cursor);
      if (decoded?.kind === 'firestore' && Array.isArray(decoded.values) && decoded.values.length === 2) {
        constraints.push(startAfter(...decoded.values));
      }
      constraints.push(limit(page.limit));
      const snapshot = await getDocs(firestoreQuery(collection(this.getDb(), `users/${owner}/idempotency_receipts`), ...constraints));
      const items = snapshot.docs.map((docSnapshot) => ({ id: docSnapshot.id, ...docSnapshot.data() }));
      const last = snapshot.docs.at(-1);
      const nextCursor = snapshot.docs.length === page.limit && last
        ? encodePageCursor({
          kind: 'firestore',
          collection: 'idempotency_receipts',
          orderBy: page.orderBy,
          direction: page.direction,
          values: [last.get(page.orderBy) ?? '', last.id]
        })
        : '';
      return repositoryOk({
        items: cloneRepositoryData(items),
        data: cloneRepositoryData(items),
        count: items.length,
        nextCursor,
        hasMore: Boolean(nextCursor),
        pageInfo: {
          ...page,
          source: 'firestore',
          requestedLimit: page.limit,
          returned: items.length
        }
      });
    } catch (error) {
      return mapUnknownRepositoryError(error);
    }
  }
}
