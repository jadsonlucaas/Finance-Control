/**
 * Preferencias do usuario (pais, idioma, moeda, fuso) para as rotas do WhatsApp.
 *
 * Le user_onboarding/{uid} (o mesmo documento que o Dashboard grava em Configuracoes) e
 * completa com os padroes do pais. Cache curto por usuario, porque uma mensagem gera varias
 * chamadas seguidas. Erro de leitura nunca derruba a rota: usa o padrao (Brasil).
 */
import { resolveUserPreferences } from '../../../src/core/userPreferences.js';

export const DEFAULT_PREFERENCES_TTL_MS = 30_000;
const MAX_ENTRIES = 1000;

export function createPreferenceResolver({ store, ttlMs = DEFAULT_PREFERENCES_TTL_MS, nowMs = () => Date.now(), logger = console } = {}) {
  const entries = new Map();

  async function load(uid) {
    if (!uid || typeof store?.getOnboarding !== 'function') return resolveUserPreferences(null);
    try {
      return resolveUserPreferences(await store.getOnboarding(uid));
    } catch {
      logger.warn?.(JSON.stringify({ level: 'warn', event: 'user_preferences_read_failed' }));
      return null;
    }
  }

  return {
    async forUser(uid) {
      const current = nowMs();
      const hit = entries.get(uid);
      if (hit && hit.expiresAt > current) return hit.value;
      const value = await load(uid);
      // Falha de leitura: usa o padrao agora, sem guardar no cache.
      if (!value) return resolveUserPreferences(null);
      if (entries.size >= MAX_ENTRIES) entries.clear();
      entries.set(uid, { value, expiresAt: current + ttlMs });
      return value;
    }
  };
}
