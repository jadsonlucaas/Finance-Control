/**
 * Cache curto das leituras de lancamentos e referencias.
 *
 * Uma mensagem no WhatsApp faz o agente chamar varias ferramentas em segundos, e cada uma
 * lia todos os lancamentos do usuario no Firestore. Com o cache, essas chamadas reaproveitam
 * a mesma leitura. Escritas feitas pela propria API limpam o cache do usuario; alteracoes
 * feitas no Dashboard aparecem no WhatsApp em ate ttlMs.
 *
 * Se o Firestore cair (cota, rede, prazo), devolve a ultima leitura boa do mesmo pedido,
 * se tiver no maximo staleMs (Etapa 5, item 6). Escritas nunca usam isso.
 */
import { classifyDependencyError } from './errors.js';

export const DEFAULT_READ_CACHE_TTL_MS = 30_000;
export const DEFAULT_STALE_MS = 10 * 60_000;
const MAX_ENTRIES = 1000;

export function withReadCache(store, { ttlMs = DEFAULT_READ_CACHE_TTL_MS, staleMs = DEFAULT_STALE_MS, nowMs = () => Date.now(), onStale = null } = {}) {
  if (!ttlMs || ttlMs <= 0) return store;
  const entries = new Map();
  // Ultima leitura boa de cada pedido, para quando o banco cair.
  const lastGood = new Map();

  function cached(kind, uid, load) {
    const key = `${kind}:${uid}`;
    const current = nowMs();
    const hit = entries.get(key);
    if (hit && hit.expiresAt > current) return hit.promise;
    if (entries.size >= MAX_ENTRIES) {
      for (const [k, v] of entries) if (v.expiresAt <= current) entries.delete(k);
      if (entries.size >= MAX_ENTRIES) entries.clear();
    }
    const promise = Promise.resolve().then(load).then((value) => {
      if (lastGood.size >= MAX_ENTRIES) lastGood.clear();
      lastGood.set(key, { value, at: nowMs() });
      return value;
    }, (error) => {
      const good = lastGood.get(key);
      const motivo = classifyDependencyError(error);
      if (motivo && good && nowMs() - good.at <= staleMs) {
        onStale?.({ kind, motivo, ageMs: nowMs() - good.at });
        return good.value;
      }
      throw error;
    });
    entries.set(key, { promise, expiresAt: current + ttlMs });
    // Erro nao fica no cache.
    promise.catch(() => { if (entries.get(key)?.promise === promise) entries.delete(key); });
    return promise;
  }

  // Devolve copias para ninguem alterar o que esta no cache.
  const copy = (list) => list.map((item) => ({ ...item }));
  const invalidate = (uid) => {
    for (const map of [entries, lastGood]) {
      for (const key of [...map.keys()]) {
        if (key === `references:${uid}` || key.startsWith(`records:${uid}:`)) map.delete(key);
      }
    }
  };

  const wrapped = Object.create(store);
  // Uma entrada por mes inicial (`from`); sem `from` = historico inteiro.
  wrapped.listFinanceRecords = (uid, options = {}) => {
    const from = options?.from || '';
    return cached('records', `${uid}:${from || 'all'}`, () => store.listFinanceRecords(uid, from ? { from } : {})).then(copy);
  };
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
