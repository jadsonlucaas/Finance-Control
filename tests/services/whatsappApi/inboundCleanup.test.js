import { describe, expect, it, vi } from 'vitest';
import { createMemoryStore } from '../../../services/whatsapp-api/src/memoryStore.js';
import { createFirestoreStore } from '../../../services/whatsapp-api/src/firestoreStore.js';
import { withReadCache } from '../../../services/whatsapp-api/src/readCache.js';
import {
  INBOUND_MESSAGE_TTL_MS,
  purgeExpiredInboundMessages,
  startInboundCleanup
} from '../../../services/whatsapp-api/src/inboundMessages.js';

const NOW = new Date('2026-11-11T12:00:00Z');
const ago = (ms) => new Date(NOW.getTime() - ms);

async function seed(store, count, expiresAt) {
  for (let i = 0; i < count; i += 1) {
    await store.reserveInboundMessage(`${expiresAt.getTime()}-${i}`, { phone_hash: 'h', chatwoot_account_id: '3', received_at: '', expires_at: expiresAt });
  }
}

describe('whatsapp-api: limpeza de whatsapp_inbound_messages', () => {
  it('apaga so os vencidos e mantem os validos', async () => {
    const store = createMemoryStore({});
    await seed(store, 3, ago(1000));
    await seed(store, 2, new Date(NOW.getTime() + INBOUND_MESSAGE_TTL_MS));
    expect(await purgeExpiredInboundMessages({ store, now: () => NOW })).toBe(3);
    expect(await purgeExpiredInboundMessages({ store, now: () => NOW })).toBe(0);
    expect(store._getInboundMessage(`${new Date(NOW.getTime() + INBOUND_MESSAGE_TTL_MS).getTime()}-0`)).not.toBeNull();
  });

  it('trabalha em lotes e para no limite de lotes por rodada', async () => {
    const store = createMemoryStore({});
    await seed(store, 25, ago(1000));
    const spy = vi.spyOn(store, 'purgeExpiredInboundMessages');
    expect(await purgeExpiredInboundMessages({ store, now: () => NOW, batch: 10, maxBatches: 2 })).toBe(20);
    expect(spy).toHaveBeenCalledTimes(2);
    expect(await purgeExpiredInboundMessages({ store, now: () => NOW, batch: 10, maxBatches: 2 })).toBe(5);
  });

  it('passa pelo cache de leitura sem perder o metodo', async () => {
    const store = withReadCache(createMemoryStore({}), { ttlMs: 30_000 });
    await seed(store, 2, ago(1000));
    expect(await purgeExpiredInboundMessages({ store, now: () => NOW })).toBe(2);
  });

  it('store sem suporte nao quebra', async () => {
    expect(await purgeExpiredInboundMessages({ store: {}, now: () => NOW })).toBe(0);
    const cleanup = startInboundCleanup({ store: {} });
    expect(await cleanup.run()).toBe(0);
    cleanup.stop();
  });

  it('agenda a primeira rodada depois de subir e repete no intervalo', async () => {
    vi.useFakeTimers();
    try {
      const store = createMemoryStore({});
      await seed(store, 4, ago(1000));
      const logger = { info: vi.fn(), error: vi.fn() };
      const cleanup = startInboundCleanup({ store, now: () => NOW, logger, intervalMs: 1000, firstDelayMs: 500 });
      await vi.advanceTimersByTimeAsync(499);
      expect(store._getInboundMessage(`${ago(1000).getTime()}-0`)).not.toBeNull();
      await vi.advanceTimersByTimeAsync(1);
      expect(store._getInboundMessage(`${ago(1000).getTime()}-0`)).toBeNull();
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('"deleted":4'));
      await seed(store, 1, ago(1000));
      await vi.advanceTimersByTimeAsync(1000);
      expect(store._getInboundMessage(`${ago(1000).getTime()}-0`)).toBeNull();
      cleanup.stop();
    } finally {
      vi.useRealTimers();
    }
  });

  it('erro vai para o log sem derrubar o processo', async () => {
    const store = { purgeExpiredInboundMessages: vi.fn().mockRejectedValue(Object.assign(new Error('quota detail'), { code: 8 })) };
    const logger = { info: vi.fn(), error: vi.fn() };
    const cleanup = startInboundCleanup({ store, logger, firstDelayMs: 1e9 });
    expect(await cleanup.run()).toBe(0);
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('inbound_cleanup_failed'));
    expect(logger.error.mock.calls[0][0]).not.toContain('quota detail');
    cleanup.stop();
  });

  it('intervalo 0 desliga', async () => {
    const store = createMemoryStore({});
    const timers = { setTimeout: vi.fn(), clearTimeout: vi.fn(), setInterval: vi.fn(), clearInterval: vi.fn() };
    startInboundCleanup({ store, intervalMs: 0, timers });
    expect(timers.setTimeout).not.toHaveBeenCalled();
  });

  it('firestore: consulta so os vencidos com limite e apaga em lote', async () => {
    const deleted = [];
    const calls = [];
    const doc = (id) => ({ ref: { id } });
    const query = {
      where(field, op, value) { calls.push(['where', field, op, value]); return query; },
      limit(n) { calls.push(['limit', n]); return query; },
      async get() { return { empty: false, docs: [doc('a'), doc('b')] }; }
    };
    const db = {
      collection: () => ({ doc: () => ({ collection: () => ({}) }), where: (...args) => query.where(...args) }),
      batch: () => ({ delete: (ref) => deleted.push(ref.id), commit: async () => {} }),
      runTransaction: async () => {}
    };
    const store = createFirestoreStore(db);
    expect(await store.purgeExpiredInboundMessages({ before: NOW, limit: 200 })).toBe(2);
    expect(calls).toEqual([['where', 'expires_at', '<', NOW], ['limit', 200]]);
    expect(deleted).toEqual(['a', 'b']);
  });
});
