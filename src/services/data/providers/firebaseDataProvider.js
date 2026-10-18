function assertProviderMethod(provider, methodName) {
  if (typeof provider?.[methodName] !== 'function') {
    throw new Error(`Firebase data provider requires ${methodName}().`);
  }
}

export function createFirebaseDataProvider(dataSdk) {
  assertProviderMethod(dataSdk, 'create');
  assertProviderMethod(dataSdk, 'update');
  assertProviderMethod(dataSdk, 'upsert');
  assertProviderMethod(dataSdk, 'delete');

  return {
    auditHandled: true,
    init: (dataHandler) => dataSdk.init?.(dataHandler) ?? Promise.resolve({ isOk: true }),
    create: (record) => dataSdk.create(record),
    createMany: (records) => dataSdk.createMany(records),
    update: (record) => dataSdk.update(record),
    upsert: (record) => dataSdk.upsert(record),
    delete: (record) => dataSdk.delete(record)
  };
}
