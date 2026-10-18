export const FINANCE_RECORD_REPOSITORY_METHODS = Object.freeze([
  'create',
  'createMany',
  'createIfAbsent',
  'getById',
  'update',
  'delete',
  'list',
  'findByType',
  'findByCompetence',
  'findBySeriesId',
  'findBySourceReference'
]);

export const USER_PROFILE_REPOSITORY_METHODS = Object.freeze([
  'getByUid',
  'ensureProfile',
  'listUsers',
  'updateStatus',
  'updateRole'
]);

export const SHARED_REFERENCE_REPOSITORY_METHODS = Object.freeze([
  'listMacros',
  'listCategories',
  'createGlobalReference',
  'updateGlobalReference',
  'deleteGlobalReference',
  'listEffectiveReferences'
]);

export const LOCAL_SETTINGS_REPOSITORY_METHODS = Object.freeze([
  'get',
  'set',
  'remove',
  'list'
]);

export const AUDIT_REPOSITORY_METHODS = Object.freeze([
  'append',
  'list',
  'getById',
  'getByCorrelationId',
  'listByCorrelationId',
  'listByEntity',
  'listByOwner',
  'listSecurityEvents'
]);

export const IDEMPOTENCY_REPOSITORY_METHODS = Object.freeze([
  'reserve',
  'complete',
  'fail',
  'find',
  'getById',
  'cleanupExpired'
]);

export const SUBSCRIPTION_REPOSITORY_METHODS = Object.freeze([
  'subscribe'
]);

export function assertRepositoryMethods(repository = {}, methods = [], label = 'Repository') {
  const missing = methods.filter((method) => typeof repository?.[method] !== 'function');
  if (missing.length) {
    throw new Error(`${label} missing methods: ${missing.join(', ')}`);
  }
  return true;
}
