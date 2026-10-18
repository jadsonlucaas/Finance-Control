const FINANCE_STORAGE_PREFIX = 'finance-control-';
const USER_RECORDS_CACHE_PREFIX = 'finance-control-user-records-cache-v1-';
const USER_RECORDS_ACTIVE_CACHE_KEY = 'finance-control-user-records-cache-active-v1';

export function shouldHandleFinanceStorageKey(key) {
  return typeof key === 'string'
    && key.startsWith(FINANCE_STORAGE_PREFIX)
    && !key.startsWith(USER_RECORDS_CACHE_PREFIX)
    && key !== USER_RECORDS_ACTIVE_CACHE_KEY;
}

function getStoragePrototype(target) {
  if (target?.Storage?.prototype) return target.Storage.prototype;
  if (target?.localStorage) return Object.getPrototypeOf(target.localStorage);
  return null;
}

export function installCloudMemoryStorage(target = globalThis) {
  if (!target?.localStorage) return false;

  const storagePrototype = getStoragePrototype(target);
  if (!storagePrototype) return false;

  const nativeStorage = target.__financeCloudNativeStorage || {
    getItem: storagePrototype.getItem,
    setItem: storagePrototype.setItem,
    removeItem: storagePrototype.removeItem,
    key: storagePrototype.key
  };
  target.__financeCloudNativeStorage = nativeStorage;

  const memory = target.__financeCloudMemoryStorage || {};

  for (let index = 0; index < target.localStorage.length; index += 1) {
    const key = nativeStorage.key.call(target.localStorage, index);
    if (shouldHandleFinanceStorageKey(key) && !(key in memory)) {
      memory[key] = nativeStorage.getItem.call(target.localStorage, key) || '';
    }
  }

  Object.keys(memory).forEach((key) => {
    if (shouldHandleFinanceStorageKey(key)) {
      nativeStorage.removeItem.call(target.localStorage, key);
    }
  });

  target.__financeCloudMemoryStorage = memory;
  target.__financeCloudLocalKeys = () => Object.keys(memory).filter(shouldHandleFinanceStorageKey);
  target.__financeCloudLocalEntries = () => target.__financeCloudLocalKeys().map((key) => [key, memory[key] || '']);
  target.__financeCloudSetMemoryStorage = (key, value) => {
    if (shouldHandleFinanceStorageKey(key)) memory[key] = String(value ?? '');
  };
  target.__financeCloudRemoveMemoryStorage = (key) => {
    if (shouldHandleFinanceStorageKey(key)) delete memory[key];
  };

  if (target.__cloudLocalStorageVirtualInstalled) return true;

  target.__cloudLocalStorageVirtualInstalled = true;

  storagePrototype.getItem = function getItem(key) {
    const normalizedKey = String(key);
    if (this === target.localStorage && shouldHandleFinanceStorageKey(normalizedKey)) {
      return Object.prototype.hasOwnProperty.call(memory, normalizedKey) ? memory[normalizedKey] : null;
    }
    return nativeStorage.getItem.call(this, key);
  };

  storagePrototype.setItem = function setItem(key, value) {
    const normalizedKey = String(key);
    if (this === target.localStorage && shouldHandleFinanceStorageKey(normalizedKey)) {
      memory[normalizedKey] = String(value ?? '');
      if (!target.__cloudLocalStorageApplying) {
        target.cloudLocalStorageSync?.set?.(normalizedKey, memory[normalizedKey]);
      }
      return;
    }
    nativeStorage.setItem.call(this, key, value);
  };

  storagePrototype.removeItem = function removeItem(key) {
    const normalizedKey = String(key);
    if (this === target.localStorage && shouldHandleFinanceStorageKey(normalizedKey)) {
      delete memory[normalizedKey];
      if (!target.__cloudLocalStorageApplying) {
        target.cloudLocalStorageSync?.remove?.(normalizedKey);
      }
      return;
    }
    nativeStorage.removeItem.call(this, key);
  };

  return true;
}
