import {
  InMemoryAuditRepository,
  InMemoryFinanceRecordRepository,
  InMemoryFinanceRecordSubscriptionRepository,
  InMemoryLocalSettingsRepository,
  InMemorySharedReferenceRepository,
  InMemoryUserProfileRepository
} from '../repositories/inMemoryRepositories.js';
import { InMemoryIdempotencyRepository } from '../repositories/inMemoryIdempotencyRepository.js';
import { InMemoryErrorReporter } from '../resilience/errorReporter.js';
import { BrowserConnectivityService, InMemoryConnectivityService } from '../../services/connectivity/connectivityService.js';

function defaultIdGenerator(prefix = 'id') {
  let sequence = 1;
  return () => `${prefix}_${sequence++}`;
}

function lazySubscribe(load) {
  return (...args) => {
    let active = true;
    let unsubscribe = () => {};
    load().then((repository) => {
      const close = repository.subscribe?.(...args);
      if (typeof close !== 'function') return;
      if (!active) {
        close();
        return;
      }
      unsubscribe = close;
    });
    return () => {
      active = false;
      unsubscribe();
    };
  };
}

function lazyRepository(factory, methods = [], syncMethodFactories = {}, metadata = {}) {
  let repositoryPromise = null;
  const load = () => {
    repositoryPromise ||= factory();
    return repositoryPromise;
  };
  return {
    ...metadata,
    ...Object.fromEntries(methods.map((method) => [
    method,
    syncMethodFactories[method]
      ? syncMethodFactories[method](load)
      : async (...args) => {
        const repository = await load();
        return repository[method](...args);
      }
    ]))
  };
}

export function createApplicationDependencies(options = {}) {
  const mode = options.mode || 'web';
  const clock = options.clock || { now: options.now || (() => new Date().toISOString()) };
  const idGenerator = options.idGenerator || defaultIdGenerator('app');
  const errorReporter = options.errorReporter || new InMemoryErrorReporter({ now: clock.now });

  if (options.repositories) {
    return {
      repositories: options.repositories,
      services: { errorReporter, ...(options.services || {}) },
      clock,
      idGenerator
    };
  }

  if (mode === 'memory' || mode === 'test') {
    const financeRecords = new InMemoryFinanceRecordRepository({
      records: options.records || [],
      idGenerator: options.financeRecordIdGenerator || defaultIdGenerator('record'),
      now: clock.now
    });
    return {
      repositories: {
        financeRecords,
        userProfiles: new InMemoryUserProfileRepository({ users: options.users || [], now: clock.now }),
        sharedReferences: new InMemorySharedReferenceRepository({ records: options.sharedReferences || [], idGenerator: defaultIdGenerator('ref') }),
        localSettings: new InMemoryLocalSettingsRepository({ settings: options.settings || {} }),
        audit: new InMemoryAuditRepository({ events: options.auditEvents || [], idGenerator: defaultIdGenerator('audit') }),
        idempotency: new InMemoryIdempotencyRepository({ now: clock.now }),
        financeRecordSubscriptions: new InMemoryFinanceRecordSubscriptionRepository(financeRecords)
      },
      services: {
        errorReporter,
        connectivity: options.connectivity || new InMemoryConnectivityService(),
        ...(options.services || {})
      },
      clock,
      idGenerator
    };
  }

  if (!options.financeRecordDataSdk) {
    throw new Error('createApplicationDependencies web mode requires financeRecordDataSdk.');
  }

  const target = options.target || globalThis;
  const financeRecords = lazyRepository(async () => {
    const { FirebaseFinanceRecordRepository } = await import('../repositories/firebaseRepositories.js');
    return new FirebaseFinanceRecordRepository({
      dataSdk: options.financeRecordDataSdk,
      recordsProvider: options.recordsProvider || (() => target.allRecords || []),
      subscriptionSdk: options.subscriptionSdk || null
    });
  }, ['create', 'createMany', 'createIfAbsent', 'getById', 'update', 'delete', 'list', 'findByType', 'findByCompetence', 'findBySeriesId', 'findBySourceReference', 'subscribe'], {
    subscribe: lazySubscribe
  }, { adapterType: 'firebase-web' });

  return {
    repositories: {
      financeRecords,
      userProfiles: lazyRepository(async () => {
        const { FirebaseUserProfileRepository } = await import('../repositories/firebaseRepositories.js');
        return new FirebaseUserProfileRepository({
          userAdminSdk: options.userAdminSdk || (() => target.userAdminSdk),
          db: options.db || (() => target.__financeFirestoreDb)
        });
      }, ['getByUid', 'ensureProfile', 'listUsers', 'updateStatus', 'updateRole']),
      sharedReferences: lazyRepository(async () => {
        const { FirebaseSharedReferenceRepository } = await import('../repositories/firebaseRepositories.js');
        return new FirebaseSharedReferenceRepository({ financeRecords });
      }, ['listMacros', 'listCategories', 'createGlobalReference', 'updateGlobalReference', 'deleteGlobalReference', 'listEffectiveReferences']),
      localSettings: lazyRepository(async () => {
        const { FirebaseLocalSettingsRepository } = await import('../repositories/firebaseRepositories.js');
        return new FirebaseLocalSettingsRepository({
          cloudLocalStorageSync: options.cloudLocalStorageSync || (() => target.cloudLocalStorageSync),
          localSettingsProvider: options.localSettingsProvider || (() => target.localStorage)
        });
      }, ['get', 'set', 'remove', 'list']),
      audit: lazyRepository(async () => {
        const { FirebaseAuditRepository } = await import('../repositories/firebaseRepositories.js');
        return new FirebaseAuditRepository({
          auditSdk: options.auditSdk || (() => target.auditSdk),
          db: options.db || (() => target.__financeFirestoreDb)
        });
      }, ['append', 'list', 'getById', 'getByCorrelationId', 'listByCorrelationId', 'listByEntity', 'listByOwner', 'listSecurityEvents']),
      idempotency: lazyRepository(async () => {
        const { FirebaseWebIdempotencyRepository } = await import('../repositories/idempotencyRepositories.js');
        return new FirebaseWebIdempotencyRepository({
          db: options.db || (() => target.__financeFirestoreDb),
          now: clock.now
        });
      }, ['reserve', 'complete', 'fail', 'find', 'getById', 'cleanupExpired', 'list']),
      financeRecordSubscriptions: financeRecords
    },
    services: {
      errorReporter,
      connectivity: options.connectivity || new BrowserConnectivityService(target),
      ...(options.services || {})
    },
    clock,
    idGenerator
  };
}
