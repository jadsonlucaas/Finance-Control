import { describe, expect, it } from 'vitest';
import { installCloudMemoryStorage, shouldHandleFinanceStorageKey } from '../../src/legacy/storageSync.js';

function createStorageTarget(initialEntries = []) {
  class TestStorage {
    constructor(entries) {
      this.store = new Map(entries);
    }

    get length() {
      return this.store.size;
    }

    key(index) {
      return Array.from(this.store.keys())[index] ?? null;
    }

    getItem(key) {
      return this.store.has(String(key)) ? this.store.get(String(key)) : null;
    }

    setItem(key, value) {
      this.store.set(String(key), String(value));
    }

    removeItem(key) {
      this.store.delete(String(key));
    }
  }

  return {
    Storage: TestStorage,
    localStorage: new TestStorage(initialEntries),
    synced: [],
    removed: [],
    cloudLocalStorageSync: {
      set(key, value) {
        this.target.synced.push([key, value]);
      },
      remove(key) {
        this.target.removed.push(key);
      }
    }
  };
}

describe('storageSync', () => {
  it('detects finance storage keys', () => {
    expect(shouldHandleFinanceStorageKey('finance-control-records')).toBe(true);
    expect(shouldHandleFinanceStorageKey('other-records')).toBe(false);
    expect(shouldHandleFinanceStorageKey('finance-control-user-records-cache-v1-uid-a')).toBe(false);
    expect(shouldHandleFinanceStorageKey('finance-control-user-records-cache-active-v1')).toBe(false);
  });

  it('moves finance localStorage keys into memory and keeps legacy helpers', () => {
    const target = createStorageTarget([
      ['finance-control-records', '[]'],
      ['external-key', 'keep']
    ]);
    target.cloudLocalStorageSync.target = target;

    expect(installCloudMemoryStorage(target)).toBe(true);

    expect(target.localStorage.getItem('finance-control-records')).toBe('[]');
    expect(target.__financeCloudLocalEntries()).toEqual([['finance-control-records', '[]']]);
    expect(target.__financeCloudLocalKeys()).toEqual(['finance-control-records']);
    expect(target.__financeCloudMemoryStorage).toEqual({ 'finance-control-records': '[]' });
    expect(target.__financeCloudNativeStorage.getItem.call(target.localStorage, 'finance-control-records')).toBe(null);
    expect(target.localStorage.getItem('external-key')).toBe('keep');
  });

  it('syncs virtual finance storage writes and removals', () => {
    const target = createStorageTarget();
    target.cloudLocalStorageSync.target = target;

    installCloudMemoryStorage(target);
    target.localStorage.setItem('finance-control-user', 'Jadson');
    target.localStorage.removeItem('finance-control-user');

    expect(target.synced).toEqual([['finance-control-user', 'Jadson']]);
    expect(target.removed).toEqual(['finance-control-user']);
    expect(target.localStorage.getItem('finance-control-user')).toBe(null);
  });
});
