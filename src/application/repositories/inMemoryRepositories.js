import { normalizeFinanceRecord } from '../../domain/records/index.js';
import {
  cloneRepositoryData,
  REPOSITORY_ERROR_CODES,
  repositoryFailure,
  repositoryOk
} from './repositoryResult.js';
import { pageItems } from './pagination.js';

function defaultIdGenerator(prefix = 'mem') {
  let sequence = 1;
  return () => `${prefix}_${sequence++}`;
}

function ownerFrom(context = {}) {
  return context.ownerUid || context.actorUid || context.uid || '';
}

function canSee(record = {}, context = {}) {
  const ownerUid = ownerFrom(context);
  return !record.owner_uid || record.owner_uid === ownerUid || record.shared_scope === 'global';
}

function matchesQuery(record = {}, query = {}) {
  if (query.type && record.type !== query.type) return false;
  if (query.competence && record.competence !== query.competence) return false;
  if (query.person && record.person !== query.person) return false;
  if (query.sourceChannel && record.source_channel !== query.sourceChannel) return false;
  if (query.sourceReferenceId && record.source_reference_id !== query.sourceReferenceId) return false;
  return true;
}

export class InMemoryFinanceRecordRepository {
  constructor(options = {}) {
    const records = Array.isArray(options) ? options : options.records || [];
    this.records = records.map((record) => cloneRepositoryData(record));
    this.idGenerator = options.idGenerator || defaultIdGenerator('record');
    this.now = options.now || (() => new Date().toISOString());
    this.failures = new Map(Object.entries(options.failures || {}));
  }

  failNext(method, code = REPOSITORY_ERROR_CODES.UNKNOWN_ERROR) {
    this.failures.set(method, code);
  }

  maybeFail(method) {
    if (!this.failures.has(method)) return null;
    const code = this.failures.get(method);
    this.failures.delete(method);
    return repositoryFailure({ code, message: `Falha injetada em ${method}.` });
  }

  async create(record = {}, context = {}) {
    const failure = this.maybeFail('create');
    if (failure) return failure;
    const ownerUid = ownerFrom(context);
    const id = record.id || this.idGenerator();
    const normalized = normalizeFinanceRecord({
      ...record,
      id,
      owner_uid: ownerUid || record.owner_uid || ''
    });
    this.records.push(cloneRepositoryData(normalized));
    return repositoryOk({ id, data: cloneRepositoryData(normalized) });
  }

  async createIfAbsent(record = {}, context = {}) {
    const failure = this.maybeFail('createIfAbsent');
    if (failure) return failure;
    const ownerUid = ownerFrom(context);
    const id = record.id || this.idGenerator();
    const existing = this.records.find((item) => item.id === id && canSee(item, context));
    if (existing) {
      return repositoryFailure({
        code: REPOSITORY_ERROR_CODES.CONFLICT,
        message: 'Registro ja existe.',
        data: cloneRepositoryData(existing)
      });
    }
    const occurrenceKey = String(record.percentage_occurrence_key || '').trim();
    if (occurrenceKey) {
      const existingByKey = this.records.find((item) =>
        item.percentage_occurrence_key === occurrenceKey && canSee(item, context)
      );
      if (existingByKey) {
        return repositoryFailure({
          code: REPOSITORY_ERROR_CODES.CONFLICT,
          message: 'Ocorrencia percentual ja existe.',
          data: cloneRepositoryData(existingByKey)
        });
      }
    }
    const normalized = normalizeFinanceRecord({
      ...record,
      id,
      owner_uid: ownerUid || record.owner_uid || ''
    });
    this.records.push(cloneRepositoryData(normalized));
    return repositoryOk({ id, data: cloneRepositoryData(normalized) });
  }

  async createMany(records = [], context = {}) {
    const failure = this.maybeFail('createMany');
    if (failure) return failure;
    if (!Array.isArray(records) || !records.length) {
      return repositoryFailure({
        code: REPOSITORY_ERROR_CODES.VALIDATION_ERROR,
        message: 'createMany exige lista nao vazia.'
      });
    }
    const ownerUid = ownerFrom(context);
    const prepared = records.map((record) => normalizeFinanceRecord({
      ...record,
      id: record.id || this.idGenerator(),
      owner_uid: ownerUid || record.owner_uid || ''
    }));
    this.records.push(...prepared.map((record) => cloneRepositoryData(record)));
    return repositoryOk({
      ids: prepared.map((record) => record.id),
      count: prepared.length,
      items: cloneRepositoryData(prepared),
      data: cloneRepositoryData(prepared)
    });
  }

  async getById(id = '', context = {}) {
    const failure = this.maybeFail('getById');
    if (failure) return failure;
    const record = this.records.find((item) => item.id === id && canSee(item, context));
    if (!record) return repositoryFailure({ code: REPOSITORY_ERROR_CODES.NOT_FOUND, message: 'Registro nao encontrado.' });
    return repositoryOk({ id: record.id, data: cloneRepositoryData(record) });
  }

  async update(id = '', patch = {}, context = {}) {
    const failure = this.maybeFail('update');
    if (failure) return failure;
    const index = this.records.findIndex((item) => item.id === id && canSee(item, context));
    if (index < 0) return repositoryFailure({ code: REPOSITORY_ERROR_CODES.NOT_FOUND, message: 'Registro nao encontrado.' });
    const current = this.records[index];
    const ownerUid = ownerFrom(context);
    const updated = normalizeFinanceRecord({
      ...current,
      ...patch,
      id,
      owner_uid: current.owner_uid || ownerUid || patch.owner_uid || '',
      updated_at: patch.updated_at || this.now()
    });
    this.records[index] = cloneRepositoryData(updated);
    return repositoryOk({ id, data: cloneRepositoryData(updated) });
  }

  async delete(id = '', context = {}) {
    const failure = this.maybeFail('delete');
    if (failure) return failure;
    const index = this.records.findIndex((item) => item.id === id && canSee(item, context));
    if (index < 0) return repositoryFailure({ code: REPOSITORY_ERROR_CODES.NOT_FOUND, message: 'Registro nao encontrado.' });
    const [removed] = this.records.splice(index, 1);
    return repositoryOk({ id, data: cloneRepositoryData(removed) });
  }

  async list(query = {}, context = {}) {
    const failure = this.maybeFail('list');
    if (failure) return failure;
    const items = this.records.filter((record) => canSee(record, context)).filter((record) => matchesQuery(record, query));
    return repositoryOk({ items: cloneRepositoryData(items), data: cloneRepositoryData(items), count: items.length });
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
    return repositoryOk({ items, data: items, count: items.length, ids: items.map((record) => record.id) });
  }

  async findBySourceReference(sourceChannel = '', sourceReferenceId = '', context = {}) {
    return this.list({ sourceChannel, sourceReferenceId }, context);
  }
}

export class InMemoryUserProfileRepository {
  constructor(options = {}) {
    this.users = new Map((options.users || []).map((user) => [user.uid, cloneRepositoryData(user)]));
    this.now = options.now || (() => new Date().toISOString());
  }

  async getByUid(uid = '') {
    const user = this.users.get(uid);
    return user ? repositoryOk({ id: uid, data: cloneRepositoryData(user) }) : repositoryFailure({ code: REPOSITORY_ERROR_CODES.NOT_FOUND, message: 'Perfil nao encontrado.' });
  }

  async ensureProfile(input = {}) {
    const uid = input.uid || input.user?.uid || '';
    if (!uid) return repositoryFailure({ code: REPOSITORY_ERROR_CODES.VALIDATION_ERROR, message: 'uid obrigatorio.' });
    if (!this.users.has(uid)) {
      this.users.set(uid, {
        uid,
        email: input.email || input.user?.email || '',
        role: 'user',
        status: 'pending',
        created_at: this.now(),
        updated_at: this.now()
      });
    }
    return repositoryOk({ id: uid, data: cloneRepositoryData(this.users.get(uid)) });
  }

  async listUsers(query = {}) {
    const page = pageItems([...this.users.values()], { orderBy: 'created_at', ...query });
    const items = cloneRepositoryData(page.items);
    return repositoryOk({ ...page, items, data: items });
  }

  async updateStatus(uid = '', transition = {}) {
    const current = this.users.get(uid);
    if (!current) return repositoryFailure({ code: REPOSITORY_ERROR_CODES.NOT_FOUND, message: 'Perfil nao encontrado.' });
    const updated = { ...current, status: transition.status || transition.nextStatus || current.status, updated_at: this.now() };
    this.users.set(uid, updated);
    return repositoryOk({ id: uid, data: cloneRepositoryData(updated) });
  }

  async updateRole(uid = '', role = '') {
    const current = this.users.get(uid);
    if (!current) return repositoryFailure({ code: REPOSITORY_ERROR_CODES.NOT_FOUND, message: 'Perfil nao encontrado.' });
    const updated = { ...current, role, updated_at: this.now() };
    this.users.set(uid, updated);
    return repositoryOk({ id: uid, data: cloneRepositoryData(updated) });
  }
}

export class InMemorySharedReferenceRepository {
  constructor(options = {}) {
    this.records = (options.records || []).map((record) => cloneRepositoryData(record));
    this.idGenerator = options.idGenerator || defaultIdGenerator('ref');
  }

  async listMacros(context = {}) {
    const items = this.records.filter((record) => record.type === 'macro' && canSee(record, context));
    return repositoryOk({ items: cloneRepositoryData(items), data: cloneRepositoryData(items), count: items.length });
  }

  async listCategories(context = {}) {
    const items = this.records.filter((record) => record.type === 'categoria' && canSee(record, context));
    return repositoryOk({ items: cloneRepositoryData(items), data: cloneRepositoryData(items), count: items.length });
  }

  async createGlobalReference(input = {}, adminContext = {}) {
    const id = input.id || this.idGenerator();
    const record = { ...input, id, shared_scope: 'global', owner_uid: ownerFrom(adminContext) || input.owner_uid || '' };
    this.records.push(cloneRepositoryData(record));
    return repositoryOk({ id, data: cloneRepositoryData(record) });
  }

  async updateGlobalReference(id = '', patch = {}) {
    const index = this.records.findIndex((record) => record.id === id && record.shared_scope === 'global');
    if (index < 0) return repositoryFailure({ code: REPOSITORY_ERROR_CODES.NOT_FOUND, message: 'Referencia nao encontrada.' });
    this.records[index] = { ...this.records[index], ...patch, id, shared_scope: 'global' };
    return repositoryOk({ id, data: cloneRepositoryData(this.records[index]) });
  }

  async deleteGlobalReference(id = '') {
    const index = this.records.findIndex((record) => record.id === id && record.shared_scope === 'global');
    if (index < 0) return repositoryFailure({ code: REPOSITORY_ERROR_CODES.NOT_FOUND, message: 'Referencia nao encontrada.' });
    const [removed] = this.records.splice(index, 1);
    return repositoryOk({ id, data: cloneRepositoryData(removed) });
  }

  async listEffectiveReferences(context = {}) {
    const items = this.records.filter((record) => canSee(record, context));
    return repositoryOk({ items: cloneRepositoryData(items), data: cloneRepositoryData(items), count: items.length });
  }
}

export class InMemoryLocalSettingsRepository {
  constructor(options = {}) {
    this.settings = new Map(Object.entries(options.settings || {}));
  }

  key(context = {}, key = '') {
    return `${ownerFrom(context)}|${key}`;
  }

  async get(key = '', context = {}) {
    const value = this.settings.get(this.key(context, key));
    return value === undefined ? repositoryFailure({ code: REPOSITORY_ERROR_CODES.NOT_FOUND, message: 'Configuracao nao encontrada.' }) : repositoryOk({ id: key, data: cloneRepositoryData(value) });
  }

  async set(key = '', value = null, context = {}) {
    this.settings.set(this.key(context, key), cloneRepositoryData(value));
    return repositoryOk({ id: key, data: cloneRepositoryData(value) });
  }

  async remove(key = '', context = {}) {
    this.settings.delete(this.key(context, key));
    return repositoryOk({ id: key });
  }

  async list(prefix = '', context = {}) {
    const ownerPrefix = `${ownerFrom(context)}|`;
    const items = [...this.settings.entries()]
      .filter(([key]) => key.startsWith(ownerPrefix) && key.slice(ownerPrefix.length).startsWith(prefix || ''))
      .map(([key, value]) => ({ key: key.slice(ownerPrefix.length), value: cloneRepositoryData(value) }));
    return repositoryOk({ items, data: items, count: items.length });
  }
}

export class InMemoryAuditRepository {
  constructor(options = {}) {
    this.events = (options.events || []).map((event) => cloneRepositoryData(event));
    this.idGenerator = options.idGenerator || defaultIdGenerator('audit');
    this.failures = new Map(Object.entries(options.failures || {}));
  }

  failNext(method, code = REPOSITORY_ERROR_CODES.UNKNOWN_ERROR) {
    this.failures.set(method, code);
  }

  maybeFail(method) {
    if (!this.failures.has(method)) return null;
    const code = this.failures.get(method);
    this.failures.delete(method);
    return repositoryFailure({ code, message: `Falha injetada em ${method}.` });
  }

  async append(event = {}, context = {}) {
    const failure = this.maybeFail('append');
    if (failure) return failure;
    const id = event.event_id || event.id || this.idGenerator();
    const entry = {
      ...event,
      id,
      event_id: event.event_id || id,
      actor_uid: context.actorUid || event.actor_uid || event.actorUid || '',
      owner_uid: event.owner_uid || event.ownerUid || context.ownerUid || context.actorUid || '',
      correlation_id: event.correlation_id || event.correlationId || context.correlationId || ''
    };
    this.events.push(cloneRepositoryData(entry));
    return repositoryOk({ id, data: cloneRepositoryData(entry) });
  }

  matches(event = {}, query = {}) {
    if (query.correlationId && event.correlation_id !== query.correlationId && event.correlationId !== query.correlationId) return false;
    if (query.entityType && event.entity_type !== query.entityType && event.entityType !== query.entityType) return false;
    if (query.entityId && event.entity_id !== query.entityId && event.entityId !== query.entityId) return false;
    if (query.ownerUid && event.owner_uid !== query.ownerUid && event.ownerUid !== query.ownerUid) return false;
    if (query.eventType && event.event_type !== query.eventType) return false;
    if (query.resultStatus && event.result_status !== query.resultStatus) return false;
    if (query.actorUid && event.actor_uid !== query.actorUid) return false;
    if (query.sourceChannel && event.source_channel !== query.sourceChannel) return false;
    return true;
  }

  page(items = [], query = {}) {
    const page = pageItems(items, { preserveOrder: !query.orderBy, ...query });
    const paged = cloneRepositoryData(page.items);
    return repositoryOk({ ...page, items: paged, data: paged });
  }

  async list(query = {}) {
    return this.page(this.events.filter((event) => this.matches(event, query)), query);
  }

  async getById(eventId = '', context = {}) {
    const owner = context.ownerUid || context.actorUid || '';
    const event = this.events.find((item) =>
      (item.event_id === eventId || item.id === eventId) &&
      (!owner || !item.owner_uid || item.owner_uid === owner || context.role === 'admin')
    );
    if (!event) return repositoryFailure({ code: REPOSITORY_ERROR_CODES.NOT_FOUND, message: 'Evento de auditoria nao encontrado.' });
    return repositoryOk({ id: eventId, data: cloneRepositoryData(event) });
  }

  async listByCorrelationId(correlationId = '', context = {}, query = {}) {
    const owner = context.ownerUid || context.actorUid || '';
    const items = this.events.filter((event) =>
      this.matches(event, { ...query, correlationId }) &&
      (!owner || !event.owner_uid || event.owner_uid === owner || context.role === 'admin')
    );
    return this.page(items, query);
  }

  async listByEntity(entityType = '', entityId = '', context = {}, query = {}) {
    const owner = context.ownerUid || context.actorUid || '';
    const items = this.events.filter((event) =>
      this.matches(event, { ...query, entityType, entityId }) &&
      (!owner || !event.owner_uid || event.owner_uid === owner || context.role === 'admin')
    );
    return this.page(items, query);
  }

  async listByOwner(query = {}, context = {}) {
    const ownerUid = query.ownerUid || context.ownerUid || context.actorUid || '';
    if (!ownerUid) return repositoryFailure({ code: REPOSITORY_ERROR_CODES.VALIDATION_ERROR, message: 'ownerUid obrigatorio.' });
    const requesterOwner = context.ownerUid || context.actorUid || '';
    if (context.role !== 'admin' && requesterOwner && ownerUid !== requesterOwner) {
      return repositoryFailure({ code: REPOSITORY_ERROR_CODES.PERMISSION_DENIED, message: 'Consulta cruzada de auditoria exige admin.' });
    }
    return this.page(this.events.filter((event) => this.matches(event, { ...query, ownerUid })), query);
  }

  async listSecurityEvents(query = {}, adminContext = {}) {
    if (adminContext.role !== 'admin') {
      return repositoryFailure({ code: REPOSITORY_ERROR_CODES.PERMISSION_DENIED, message: 'Consulta administrativa exige admin.' });
    }
    const items = this.events.filter((event) => ['admin', 'security'].includes(event.category || '') || String(event.event_type || '').startsWith('USER_'));
    return this.page(items, query);
  }

  async getByCorrelationId(correlationId = '') {
    return this.listByCorrelationId(correlationId);
  }
}

export class InMemoryFinanceRecordSubscriptionRepository {
  constructor(financeRecordsRepository) {
    this.financeRecordsRepository = financeRecordsRepository;
    this.subscriptions = new Set();
  }

  subscribe(query = {}, listener = () => {}, context = {}) {
    let active = true;
    const subscription = { query, listener, context, active };
    this.subscriptions.add(subscription);
    this.financeRecordsRepository.list(query, context).then((result) => {
      if (active && result.ok) listener(result.items);
    });
    return () => {
      active = false;
      subscription.active = false;
      this.subscriptions.delete(subscription);
    };
  }

  activeCount() {
    return [...this.subscriptions].filter((subscription) => subscription.active).length;
  }

  unsubscribeAll(predicate = () => true) {
    let closed = 0;
    [...this.subscriptions].forEach((subscription) => {
      if (!predicate(subscription)) return;
      subscription.active = false;
      this.subscriptions.delete(subscription);
      closed += 1;
    });
    return closed;
  }
}
