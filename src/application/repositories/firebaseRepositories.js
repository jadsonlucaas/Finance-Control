import {
  cloneRepositoryData,
  legacyResultToRepositoryResult,
  mapUnknownRepositoryError,
  REPOSITORY_ERROR_CODES,
  repositoryFailure,
  repositoryOk
} from './repositoryResult.js';
import { decodePageCursor, encodePageCursor, normalizePaginationQuery, pageItems } from './pagination.js';

async function loadFirestoreFns() {
  return import('firebase/firestore');
}

function resolveSdk(sdkOrGetter) {
  if (typeof sdkOrGetter !== 'function') return sdkOrGetter;
  if (typeof sdkOrGetter.create === 'function' || typeof sdkOrGetter.getDataProvider === 'function') return sdkOrGetter;
  return sdkOrGetter();
}

function requireSdk(sdkOrGetter, label) {
  const sdk = resolveSdk(sdkOrGetter);
  if (!sdk) {
    throw new Error(`${label} is not configured.`);
  }
  return sdk;
}

function ownerUid(context = {}) {
  return context.ownerUid || context.actorUid || context.uid || '';
}

function recordMatches(record = {}, query = {}) {
  if (query.type && record.type !== query.type) return false;
  if (query.competence && record.competence !== query.competence) return false;
  if (query.person && record.person !== query.person) return false;
  if (query.sourceChannel && record.source_channel !== query.sourceChannel) return false;
  if (query.sourceReferenceId && record.source_reference_id !== query.sourceReferenceId) return false;
  return true;
}

export class FirebaseFinanceRecordRepository {
  constructor({ dataSdk, recordsProvider = () => [], subscriptionSdk = null } = {}) {
    this.dataSdk = dataSdk;
    this.recordsProvider = recordsProvider;
    this.subscriptionSdk = subscriptionSdk;
    this.adapterType = 'firebase-web';
  }

  getSdk() {
    return requireSdk(this.dataSdk, 'FirebaseFinanceRecordRepository.dataSdk');
  }

  listFromProvider(query = {}, context = {}) {
    const owner = ownerUid(context);
    const records = typeof this.recordsProvider === 'function' ? this.recordsProvider() : [];
    return (Array.isArray(records) ? records : [])
      .filter((record) => !owner || !record.owner_uid || record.owner_uid === owner || record.shared_scope === 'global')
      .filter((record) => recordMatches(record, query));
  }

  async create(record = {}, context = {}) {
    try {
      const result = await this.getSdk().create({ ...record, owner_uid: ownerUid(context) || record.owner_uid || '' });
      return legacyResultToRepositoryResult(result, { ...record, id: result?.id || record.id || '' });
    } catch (error) {
      return mapUnknownRepositoryError(error);
    }
  }

  async createIfAbsent(record = {}, context = {}) {
    try {
      const sdk = this.getSdk();
      const owner = ownerUid(context);
      if (typeof sdk.createIfAbsent === 'function') {
        return legacyResultToRepositoryResult(
          await sdk.createIfAbsent({ ...record, owner_uid: owner || record.owner_uid || '' }),
          { ...record, owner_uid: owner || record.owner_uid || '' }
        );
      }
      const id = record.id || '';
      if (id && this.listFromProvider({}, context).some((item) => item.id === id)) {
        return repositoryFailure({ code: REPOSITORY_ERROR_CODES.CONFLICT, message: 'Registro ja existe.' });
      }
      if (record.percentage_occurrence_key && this.listFromProvider({}, context).some((item) =>
        item.percentage_occurrence_key === record.percentage_occurrence_key
      )) {
        return repositoryFailure({ code: REPOSITORY_ERROR_CODES.CONFLICT, message: 'Ocorrencia percentual ja existe.' });
      }
      return this.create({ ...record, owner_uid: owner || record.owner_uid || '' }, context);
    } catch (error) {
      return mapUnknownRepositoryError(error);
    }
  }

  async createMany(records = [], context = {}) {
    try {
      const owner = ownerUid(context);
      const payloads = records.map((record) => ({ ...record, owner_uid: owner || record.owner_uid || '' }));
      return legacyResultToRepositoryResult(await this.getSdk().createMany(payloads), payloads);
    } catch (error) {
      return mapUnknownRepositoryError(error);
    }
  }

  async getById(id = '', context = {}) {
    try {
      const record = this.listFromProvider({}, context).find((item) => item.id === id);
      if (!record) return repositoryFailure({ code: REPOSITORY_ERROR_CODES.NOT_FOUND, message: 'Registro nao encontrado.' });
      return repositoryOk({ id, data: cloneRepositoryData(record) });
    } catch (error) {
      return mapUnknownRepositoryError(error);
    }
  }

  async update(id = '', patch = {}, context = {}) {
    try {
      const current = this.listFromProvider({}, context).find((item) => item.id === id) || {};
      const payload = { ...current, ...patch, id, owner_uid: current.owner_uid || ownerUid(context) || patch.owner_uid || '' };
      return legacyResultToRepositoryResult(await this.getSdk().update(payload), payload);
    } catch (error) {
      return mapUnknownRepositoryError(error);
    }
  }

  async delete(id = '', context = {}) {
    try {
      const current = this.listFromProvider({}, context).find((item) => item.id === id) || { id };
      return legacyResultToRepositoryResult(await this.getSdk().delete(current), current);
    } catch (error) {
      return mapUnknownRepositoryError(error);
    }
  }

  async list(query = {}, context = {}) {
    try {
      if (typeof this.getSdk().list === 'function') {
        const listed = await this.getSdk().list(query, context);
        if (Array.isArray(listed)) {
          const items = listed.filter((record) => recordMatches(record, query));
          return repositoryOk({ items: cloneRepositoryData(items), data: cloneRepositoryData(items), count: items.length });
        }
      }
      const items = this.listFromProvider(query, context);
      return repositoryOk({ items: cloneRepositoryData(items), data: cloneRepositoryData(items), count: items.length });
    } catch (error) {
      return mapUnknownRepositoryError(error);
    }
  }

  async findByType(type = '', query = {}, context = {}) {
    return this.list({ ...query, type }, context);
  }

  async findByCompetence(competence = '', query = {}, context = {}) {
    return this.list({ ...query, competence }, context);
  }

  async findBySeriesId(seriesId = '', context = {}) {
    const result = await this.list({}, context);
    if (!result.ok) return result;
    const items = result.items.filter((record) =>
      record.parent_id === seriesId ||
      record.recurrence_series_id === seriesId ||
      record.installment_series_id === seriesId
    );
    return repositoryOk({ items, data: items, ids: items.map((record) => record.id), count: items.length });
  }

  async findBySourceReference(sourceChannel = '', sourceReferenceId = '', context = {}) {
    return this.list({ sourceChannel, sourceReferenceId }, context);
  }

  subscribe(query = {}, listener = () => {}, context = {}) {
    if (this.subscriptionSdk?.subscribe) {
      return this.subscriptionSdk.subscribe(query, listener, context);
    }
    listener(this.listFromProvider(query, context).map((record) => cloneRepositoryData(record)));
    return () => {};
  }
}

export class FirebaseUserProfileRepository {
  constructor({ userAdminSdk, db } = {}) {
    this.userAdminSdk = userAdminSdk;
    this.db = db;
    this.adapterType = 'firebase-web';
  }

  getSdk() {
    return requireSdk(this.userAdminSdk, 'FirebaseUserProfileRepository.userAdminSdk');
  }

  getDb() {
    return typeof this.db === 'function' ? this.db() : this.db;
  }

  async getByUid(uid = '') {
    try {
      const data = await this.getSdk().getProfile(uid);
      return data ? repositoryOk({ id: uid, data }) : repositoryFailure({ code: REPOSITORY_ERROR_CODES.NOT_FOUND, message: 'Perfil nao encontrado.' });
    } catch (error) {
      return mapUnknownRepositoryError(error);
    }
  }

  async ensureProfile(input = {}) {
    try {
      const data = await this.getSdk().ensureProfile(input.user || input);
      return repositoryOk({ id: data?.uid || input.uid || '', data });
    } catch (error) {
      return mapUnknownRepositoryError(error);
    }
  }

  async listUsers(query = {}, adminContext = {}) {
    try {
      if (adminContext.accountStatus && adminContext.accountStatus !== 'active') {
        return repositoryFailure({ code: REPOSITORY_ERROR_CODES.PERMISSION_DENIED, message: 'Admin inativo nao lista usuarios.' });
      }
      const db = this.getDb();
      if (db) {
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
        const filters = query.filters || query;
        const page = normalizePaginationQuery({
          orderBy: 'email',
          direction: 'asc',
          ...query,
          limit: query.pageSize ?? query.limit
        });
        const constraints = [];
        if (filters.status) constraints.push(where('status', '==', filters.status));
        if (filters.role) constraints.push(where('role', '==', filters.role));
        constraints.push(orderBy(page.orderBy === 'uid' ? documentId() : page.orderBy, page.direction));
        if (page.orderBy !== 'uid') constraints.push(orderBy(documentId(), page.direction));
        const decoded = decodePageCursor(query.cursor);
        if (decoded?.kind === 'firestore' && Array.isArray(decoded.values) && decoded.values.length === 2) {
          constraints.push(startAfter(...decoded.values));
        }
        constraints.push(limit(page.limit + 1));
        const snapshot = await getDocs(firestoreQuery(collection(db, 'users'), ...constraints));
        const pageDocs = snapshot.docs.slice(0, page.limit);
        const items = pageDocs.map((docSnapshot) => ({ uid: docSnapshot.id, ...docSnapshot.data() }));
        const last = pageDocs.at(-1);
        const nextCursor = snapshot.docs.length > page.limit && last
          ? encodePageCursor({
            kind: 'firestore',
            collection: 'users',
            orderBy: page.orderBy,
            direction: page.direction,
            values: [last.get(page.orderBy) ?? last.id, last.id]
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
            returned: items.length,
            filters: {
              status: filters.status || '',
              role: filters.role || ''
            },
            searchMode: 'local_page'
          }
        });
      }
      const listed = await this.getSdk().listUsers(query);
      const page = pageItems(Array.isArray(listed) ? listed : [], { orderBy: 'created_at', ...query });
      const items = cloneRepositoryData(page.items);
      return repositoryOk({ ...page, items, data: items });
    } catch (error) {
      return mapUnknownRepositoryError(error);
    }
  }

  async updateStatus(uid = '', transition = {}, adminContext = {}) {
    try {
      if (adminContext.accountStatus && adminContext.accountStatus !== 'active') {
        return repositoryFailure({ code: REPOSITORY_ERROR_CODES.PERMISSION_DENIED, message: 'Admin inativo nao altera status.' });
      }
      const data = await this.getSdk().updateUser(uid, { status: transition.status || transition.nextStatus });
      return repositoryOk({ id: uid, data });
    } catch (error) {
      return mapUnknownRepositoryError(error);
    }
  }

  async updateRole(uid = '', role = '', adminContext = {}) {
    try {
      if (adminContext.accountStatus && adminContext.accountStatus !== 'active') {
        return repositoryFailure({ code: REPOSITORY_ERROR_CODES.PERMISSION_DENIED, message: 'Admin inativo nao altera role.' });
      }
      const data = await this.getSdk().updateUser(uid, { role });
      return repositoryOk({ id: uid, data });
    } catch (error) {
      return mapUnknownRepositoryError(error);
    }
  }
}

export class FirebaseSharedReferenceRepository {
  constructor({ financeRecords } = {}) {
    this.financeRecords = financeRecords;
    this.adapterType = 'firebase-web';
  }

  getFinanceRecords() {
    return requireSdk(this.financeRecords, 'FirebaseSharedReferenceRepository.financeRecords');
  }

  async listMacros(context = {}) {
    return this.getFinanceRecords().findByType('macro', {}, context);
  }

  async listCategories(context = {}) {
    return this.getFinanceRecords().findByType('categoria', {}, context);
  }

  async createGlobalReference(input = {}, adminContext = {}) {
    return this.getFinanceRecords().create({ ...input, shared_scope: 'global' }, adminContext);
  }

  async updateGlobalReference(id = '', patch = {}, adminContext = {}) {
    return this.getFinanceRecords().update(id, { ...patch, shared_scope: 'global' }, adminContext);
  }

  async deleteGlobalReference(id = '', adminContext = {}) {
    return this.getFinanceRecords().delete(id, adminContext);
  }

  async listEffectiveReferences(context = {}) {
    const result = await this.getFinanceRecords().list({}, context);
    if (!result.ok) return result;
    const items = result.items.filter((record) => record.type === 'macro' || record.type === 'categoria');
    return repositoryOk({ items, data: items, count: items.length });
  }
}

export class FirebaseLocalSettingsRepository {
  constructor({ cloudLocalStorageSync, localSettingsProvider = null } = {}) {
    this.cloudLocalStorageSync = cloudLocalStorageSync;
    this.localSettingsProvider = localSettingsProvider;
    this.adapterType = 'firebase-web';
  }

  async get(key = '') {
    try {
      const provider = resolveSdk(this.localSettingsProvider);
      if (!provider?.getItem) return repositoryFailure({ code: REPOSITORY_ERROR_CODES.NOT_FOUND, message: 'Configuracao nao encontrada.' });
      const value = provider.getItem(key);
      return value === null || value === undefined
        ? repositoryFailure({ code: REPOSITORY_ERROR_CODES.NOT_FOUND, message: 'Configuracao nao encontrada.' })
        : repositoryOk({ id: key, data: value });
    } catch (error) {
      return mapUnknownRepositoryError(error);
    }
  }

  async set(key = '', value = '') {
    try {
      const sync = requireSdk(this.cloudLocalStorageSync, 'FirebaseLocalSettingsRepository.cloudLocalStorageSync');
      await sync.set(key, value);
      return repositoryOk({ id: key, data: value });
    } catch (error) {
      return mapUnknownRepositoryError(error);
    }
  }

  async remove(key = '') {
    try {
      const sync = requireSdk(this.cloudLocalStorageSync, 'FirebaseLocalSettingsRepository.cloudLocalStorageSync');
      await sync.remove(key);
      return repositoryOk({ id: key });
    } catch (error) {
      return mapUnknownRepositoryError(error);
    }
  }

  async list(prefix = '') {
    try {
      const provider = resolveSdk(this.localSettingsProvider);
      if (!provider?.length || !provider?.key) return repositoryOk({ items: [], data: [], count: 0 });
      const items = [];
      for (let index = 0; index < provider.length; index += 1) {
        const key = provider.key(index);
        if (String(key || '').startsWith(prefix || '')) items.push({ key, value: provider.getItem(key) });
      }
      return repositoryOk({ items, data: items, count: items.length });
    } catch (error) {
      return mapUnknownRepositoryError(error);
    }
  }
}

export class FirebaseAuditRepository {
  constructor({ auditSdk, db } = {}) {
    this.auditSdk = auditSdk;
    this.db = db;
    this.adapterType = 'firebase-web';
  }

  getSdk() {
    return requireSdk(this.auditSdk, 'FirebaseAuditRepository.auditSdk');
  }

  getDb() {
    return typeof this.db === 'function' ? this.db() : this.db;
  }

  async append(event = {}, context = {}) {
    try {
      const action = event.action || event.event_type || 'application.mutation';
      return legacyResultToRepositoryResult(await this.getSdk().log(action, event, context), event);
    } catch (error) {
      return mapUnknownRepositoryError(error);
    }
  }

  async list(query = {}, context = {}) {
    try {
      const db = this.getDb();
      if (db) {
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
        const owner = ownerUid({ ...context, ownerUid: query.ownerUid || context.ownerUid });
        if (!owner && context.role !== 'admin') {
          return repositoryFailure({ code: REPOSITORY_ERROR_CODES.VALIDATION_ERROR, message: 'ownerUid obrigatorio para auditoria.' });
        }
        if (context.role !== 'admin' && query.ownerUid && ownerUid(context) && query.ownerUid !== ownerUid(context)) {
          return repositoryFailure({ code: REPOSITORY_ERROR_CODES.PERMISSION_DENIED, message: 'Consulta cruzada de auditoria exige admin.' });
        }
        const page = normalizePaginationQuery({ orderBy: 'created_at', ...query });
        const constraints = [];
        if (query.correlationId) constraints.push(where('correlation_id', '==', query.correlationId));
        if (query.entityType) constraints.push(where('entity_type', '==', query.entityType));
        if (query.entityId) constraints.push(where('entity_id', '==', query.entityId));
        if (query.eventType) constraints.push(where('event_type', '==', query.eventType));
        if (query.resultStatus) constraints.push(where('result_status', '==', query.resultStatus));
        if (query.actorUid) constraints.push(where('actor_uid', '==', query.actorUid));
        if (query.sourceChannel) constraints.push(where('source_channel', '==', query.sourceChannel));
        if (query.securityOnly) constraints.push(where('category', 'in', ['admin', 'security']));
        constraints.push(orderBy(page.orderBy, page.direction), orderBy(documentId(), page.direction));
        const decoded = decodePageCursor(query.cursor);
        if (decoded?.kind === 'firestore' && Array.isArray(decoded.values) && decoded.values.length === 2) {
          constraints.push(startAfter(...decoded.values));
        }
        constraints.push(limit(page.limit));
        const snapshot = await getDocs(firestoreQuery(collection(db, `users/${owner}/audit_logs`), ...constraints));
        const items = snapshot.docs.map((docSnapshot) => ({ id: docSnapshot.id, ...docSnapshot.data() }));
        const last = snapshot.docs.at(-1);
        const nextCursor = snapshot.docs.length === page.limit && last
          ? encodePageCursor({
            kind: 'firestore',
            collection: 'audit_logs',
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
      }
      const sdk = this.getSdk();
      if (typeof sdk.list === 'function') {
        const listed = await sdk.list(query, context);
        const page = pageItems(Array.isArray(listed) ? listed : [], query);
        const items = cloneRepositoryData(page.items);
        return repositoryOk({ ...page, items, data: items });
      }
      return repositoryFailure({
        code: REPOSITORY_ERROR_CODES.UNAVAILABLE,
        message: 'Listagem de auditoria pelo adapter web nao esta disponivel nesta etapa.'
      });
    } catch (error) {
      return mapUnknownRepositoryError(error);
    }
  }

  async getById(eventId = '', context = {}) {
    const result = await this.list({ eventId }, context);
    if (!result.ok) return result;
    const found = result.items.find((event) => event.event_id === eventId || event.id === eventId);
    return found
      ? repositoryOk({ id: eventId, data: found })
      : repositoryFailure({ code: REPOSITORY_ERROR_CODES.NOT_FOUND, message: 'Evento de auditoria nao encontrado.' });
  }

  async listByCorrelationId(correlationId = '', context = {}, query = {}) {
    return this.list({ ...query, correlationId }, context);
  }

  async listByEntity(entityType = '', entityId = '', context = {}, query = {}) {
    return this.list({ ...query, entityType, entityId }, context);
  }

  async listByOwner(query = {}, context = {}) {
    return this.list(query, context);
  }

  async listSecurityEvents(query = {}, adminContext = {}) {
    if (adminContext.role !== 'admin') {
      return repositoryFailure({
        code: REPOSITORY_ERROR_CODES.PERMISSION_DENIED,
        message: 'Consulta administrativa exige admin.'
      });
    }
    return this.list({ ...query, securityOnly: true }, adminContext);
  }

  async getByCorrelationId(correlationId = '', context = {}) {
    return this.listByCorrelationId(correlationId, context);
  }
}
