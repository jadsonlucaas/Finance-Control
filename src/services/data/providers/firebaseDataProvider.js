import { captureError, traceOperation } from '../../observability/index.js';

function assertProviderMethod(provider, methodName) {
  if (typeof provider?.[methodName] !== 'function') {
    throw new Error(`Firebase data provider requires ${methodName}().`);
  }
}

async function observeFirestoreOperation(operation, callback) {
  return traceOperation(`firestore.${operation}`, { operation: `firestore.${operation}` }, async () => {
    const result = await callback();
    if (result?.isOk === false || result?.success === false) {
      captureError(new Error(result.error || result.code || 'FIRESTORE_OPERATION_FAILED'), {
        operation: `firestore.${operation}`,
        error_code: result.error || result.code || 'FIRESTORE_OPERATION_FAILED'
      });
    }
    return result;
  });
}

export function createFirebaseDataProvider(dataSdk) {
  assertProviderMethod(dataSdk, 'create');
  assertProviderMethod(dataSdk, 'update');
  assertProviderMethod(dataSdk, 'upsert');
  assertProviderMethod(dataSdk, 'delete');

  return {
    auditHandled: true,
    init: (dataHandler) => observeFirestoreOperation('subscribe', () => (
      dataSdk.init?.(dataHandler) ?? Promise.resolve({ isOk: true })
    )),
    create: (record) => observeFirestoreOperation('create', () => dataSdk.create(record)),
    createMany: (records) => observeFirestoreOperation('create_many', () => dataSdk.createMany(records)),
    update: (record) => observeFirestoreOperation('update', () => dataSdk.update(record)),
    upsert: (record) => observeFirestoreOperation('upsert', () => dataSdk.upsert(record)),
    delete: (record) => observeFirestoreOperation('delete', () => dataSdk.delete(record))
  };
}
