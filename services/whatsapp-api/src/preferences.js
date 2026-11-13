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

  // linkedPhone = numero da conversa, ja resolvido em whatsapp_links: e o numero vinculado e define o idioma.
  async function load(uid, linkedPhone) {
    if (!uid || typeof store?.getOnboarding !== 'function') return resolveUserPreferences(null, { linkedPhone });
    try {
      return resolveUserPreferences(await store.getOnboarding(uid), { linkedPhone });
    } catch {
      logger.warn?.(JSON.stringify({ level: 'warn', event: 'user_preferences_read_failed' }));
      return null;
    }
  }

  return {
    async forUser(uid, linkedPhone = '') {
      const current = nowMs();
      const key = `${uid}|${linkedPhone}`;
      const hit = entries.get(key);
      if (hit && hit.expiresAt > current) return hit.value;
      const value = await load(uid, linkedPhone);
      // Falha de leitura: usa o padrao agora, sem guardar no cache.
      if (!value) return resolveUserPreferences(null, { linkedPhone });
      if (entries.size >= MAX_ENTRIES) entries.clear();
      entries.set(key, { value, expiresAt: current + ttlMs });
      return value;
    }
  };
}
