/**
 * Cache curto das leituras de lancamentos e referencias.
 *
 * Uma mensagem no WhatsApp faz o agente chamar varias ferramentas em segundos, e cada uma
 * lia todos os lancamentos do usuario no Firestore. Com o cache, essas chamadas reaproveitam
 * a mesma leitura. Escritas feitas pela propria API limpam o cache do usuario; alteracoes
 * feitas no Dashboard aparecem no WhatsApp em ate ttlMs.
 */
export const DEFAULT_READ_CACHE_TTL_MS = 30_000;
const MAX_ENTRIES = 1000;

export function withReadCache(store, { ttlMs = DEFAULT_READ_CACHE_TTL_MS, nowMs = () => Date.now() } = {}) {
  if (!ttlMs || ttlMs <= 0) return store;
  const entries = new Map();

  function cached(kind, uid, load) {
    const key = `${kind}:${uid}`;
    const current = nowMs();
    const hit = entries.get(key);
    if (hit && hit.expiresAt > current) return hit.promise;
    if (entries.size >= MAX_ENTRIES) {
      for (const [k, v] of entries) if (v.expiresAt <= current) entries.delete(k);
      if (entries.size >= MAX_ENTRIES) entries.clear();
    }
    const promise = load();
    entries.set(key, { promise, expiresAt: current + ttlMs });
    // Erro nao fica no cache.
    promise.catch(() => { if (entries.get(key)?.promise === promise) entries.delete(key); });
    return promise;
  }

  // Devolve copias para ninguem alterar o que esta no cache.
  const copy = (list) => list.map((item) => ({ ...item }));
  const invalidate = (uid) => {
    entries.delete(`records:${uid}`);
    entries.delete(`references:${uid}`);
  };

  const wrapped = Object.create(store);
  wrapped.listFinanceRecords = (uid) => cached('records', uid, () => store.listFinanceRecords(uid)).then(copy);
  wrapped.listReferenceRecords = (uid) => cached('references', uid, () => store.listReferenceRecords(uid)).then(copy);
  for (const name of ['createRecord', 'updateRecord', 'purgeAccountData']) {
    if (typeof store[name] !== 'function') continue;
    wrapped[name] = async (uid, ...rest) => {
      invalidate(uid);
      try {
        return await store[name](uid, ...rest);
      } finally {
        invalidate(uid);
      }
    };
  }
  wrapped._readCacheSize = () => entries.size;
  return wrapped;
}
