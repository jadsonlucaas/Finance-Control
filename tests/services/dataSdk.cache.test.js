import { describe, expect, it } from 'vitest';
import {
  USER_RECORDS_CACHE_TTL_MS,
  clearUserRecordsCache,
  clearUserScopedLocalData,
  getUserRecordsCacheKey,
  readCachedUserRecords,
  writeCachedUserRecords
} from '../../src/services/dataSdk.js';

function createStorage(entries = []) {
  const store = new Map(entries.map(([key, value]) => [String(key), String(value)]));
  return {
    get length() {
      return store.size;
    },
    key(index) {
      return Array.from(store.keys())[index] ?? null;
    },
    getItem(key) {
      return store.has(String(key)) ? store.get(String(key)) : null;
    },
    setItem(key, value) {
      store.set(String(key), String(value));
    },
    removeItem(key) {
      store.delete(String(key));
    }
  };
}

function createTarget(entries = []) {
  const localStorage = createStorage(entries);
  return {
    localStorage,
    sessionStorage: createStorage(),
    dispatchEvent() {},
    __financeCloudMemoryStorage: {},
    __financeCloudRemoveMemoryStorage(key) {
      delete this.__financeCloudMemoryStorage[key];
    }
  };
}

describe('dataSdk cache isolation', () => {
  it('names cache keys per user', () => {
    expect(getUserRecordsCacheKey('uid-a')).not.toBe(getUserRecordsCacheKey('uid-b'));
    expect(getUserRecordsCacheKey('uid-a')).toContain('uid-a');
  });

  it('expires stale user-record cache and clears its active pointer', () => {
    const target = createTarget();
    const cacheKey = getUserRecordsCacheKey('uid-a');
    target.localStorage.setItem(cacheKey, JSON.stringify({
      saved_at: new Date(Date.now() - USER_RECORDS_CACHE_TTL_MS - 1000).toISOString(),
      records: [{ id: 'r1' }]
    }));
    target.localStorage.setItem('finance-control-user-records-cache-active-v1', cacheKey);

    const result = readCachedUserRecords(target, 'uid-a');

    expect(result.records).toEqual([]);
    expect(result.expired).toBe(true);
    expect(target.localStorage.getItem(cacheKey)).toBe(null);
    expect(target.localStorage.getItem('finance-control-user-records-cache-active-v1')).toBe(null);
  });

  it('writes cache metadata and reads valid cache back', () => {
    const target = createTarget();
    const records = [{ id: 'entrada_1' }, { id: 'saida_1' }];

    const writeResult = writeCachedUserRecords(target, 'uid-a', records);
    const readResult = readCachedUserRecords(target, 'uid-a');

    expect(writeResult.savedAt).toBeTruthy();
    expect(writeResult.expiresAt).toBeTruthy();
    expect(readResult.records).toEqual(records);
    expect(readResult.expired).toBe(false);
  });

  it('clears only the targeted user cache when requested', () => {
    const target = createTarget();
    writeCachedUserRecords(target, 'uid-a', [{ id: 'a' }]);
    writeCachedUserRecords(target, 'uid-b', [{ id: 'b' }]);

    clearUserRecordsCache(target, 'uid-a');

    expect(readCachedUserRecords(target, 'uid-a').records).toEqual([]);
    expect(readCachedUserRecords(target, 'uid-b').records).toEqual([{ id: 'b' }]);
  });

  it('removes user-scoped finance data on logout cleanup', () => {
    const target = createTarget([
      ['finance-control-tax-settings-v1', '{"x":1}'],
      ['finance-control-user-records-cache-v1-uid-a', '{"saved_at":"2026-01-01T00:00:00.000Z","records":[]}'],
      ['other-key', 'keep']
    ]);
    target.sessionStorage.setItem('finance-control-cloud-local-storage-reloaded-v1', '1');

    clearUserScopedLocalData(target);

    expect(target.localStorage.getItem('finance-control-tax-settings-v1')).toBe(null);
    expect(target.localStorage.getItem('finance-control-user-records-cache-v1-uid-a')).toBe(null);
    expect(target.localStorage.getItem('other-key')).toBe('keep');
    expect(target.sessionStorage.getItem('finance-control-cloud-local-storage-reloaded-v1')).toBe(null);
  });
});
