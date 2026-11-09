import { describe, expect, it, vi } from 'vitest';
import { withReadCache } from '../../../services/whatsapp-api/src/readCache.js';

function fakeStore() {
  const records = { a: [{ id: 'r1', amount: 10 }], b: [{ id: 'x1', amount: 99 }] };
  return {
    listFinanceRecords: vi.fn(async (uid) => records[uid] || []),
    listReferenceRecords: vi.fn(async () => [{ id: 'c1', type: 'categoria' }]),
    createRecord: vi.fn(async (uid, data) => { records[uid].push({ id: 'n', ...data }); return 'n'; }),
    updateRecord: vi.fn(async () => {}),
    getRecord: vi.fn(async () => null)
  };
}

describe('whatsapp-api: cache curto de leituras', () => {
  it('varias chamadas seguidas fazem uma leitura so, por usuario', async () => {
    const base = fakeStore();
    let now = 0;
    const store = withReadCache(base, { ttlMs: 30_000, nowMs: () => now });
    await Promise.all([store.listFinanceRecords('a'), store.listFinanceRecords('a'), store.listFinanceRecords('a')]);
    expect(base.listFinanceRecords).toHaveBeenCalledTimes(1);
    expect(await store.listFinanceRecords('b')).toEqual([{ id: 'x1', amount: 99 }]);
    expect(base.listFinanceRecords).toHaveBeenCalledTimes(2);
    now = 31_000;
    await store.listFinanceRecords('a');
    expect(base.listFinanceRecords).toHaveBeenCalledTimes(3);
  });

  it('escrita da API limpa o cache do usuario e a copia devolvida nao altera o cache', async () => {
    const base = fakeStore();
    const store = withReadCache(base, { ttlMs: 30_000, nowMs: () => 0 });
    const first = await store.listFinanceRecords('a');
    first[0].amount = 999;
    expect((await store.listFinanceRecords('a'))[0].amount).toBe(10);
    await store.createRecord('a', { amount: 5 });
    expect(await store.listFinanceRecords('a')).toHaveLength(2);
    expect(base.listFinanceRecords).toHaveBeenCalledTimes(2);
    expect(typeof store.getRecord).toBe('function');
  });

  it('erro de leitura nao fica guardado e ttl 0 desliga', async () => {
    const base = fakeStore();
    base.listFinanceRecords.mockRejectedValueOnce(new Error('RESOURCE_EXHAUSTED'));
    const store = withReadCache(base, { ttlMs: 30_000, nowMs: () => 0 });
    await expect(store.listFinanceRecords('a')).rejects.toThrow();
    expect(await store.listFinanceRecords('a')).toHaveLength(1);
    expect(withReadCache(base, { ttlMs: 0 })).toBe(base);
  });
});
