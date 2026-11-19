import { ApiError } from './errors.js';

/**
 * Limite diario de uso do assistente por usuario (Etapa 5, item 4).
 *
 * O Gratuito ja nao usa o WhatsApp (access.js). Para quem tem Premium ou cortesia, este teto
 * limita o custo de IA por cliente num dia: protege contra loop do agente, automacao e abuso,
 * sem atrapalhar o uso normal (poucas dezenas de mensagens por dia).
 *
 * - messages:   mensagens novas recebidas no WhatsApp (= execucoes do agente no n8n).
 * - tool_calls: ferramentas chamadas pelo agente (uma mensagem costuma usar 1 a 4).
 *
 * O dia e o dia UTC, o mesmo de users/{uid}/usage/{AAAA-MM}.by_day. A contagem fica em memoria
 * (a API roda com 1 replica) e, na primeira vez que o usuario aparece no dia, parte do que ja
 * esta gravado no documento de consumo: reiniciar a API nao zera o limite.
 * Limite 0 desliga aquele contador.
 */
export const DEFAULT_DAILY_LIMITS = Object.freeze({ messages: 100, tool_calls: 400 });

export const DAILY_LIMIT_MESSAGE = 'Você atingiu o limite de uso do assistente por hoje. '
  + 'Amanhã ele volta a responder normalmente. Enquanto isso, você pode lançar e consultar tudo pelo app.';

export const DAILY_LIMIT_MESSAGE_ES = 'Has alcanzado el límite de uso del asistente por hoy. '
  + 'Mañana volverá a responder con normalidad. Mientras tanto, puedes registrar y consultar todo en la app.';

export function dailyLimitMessage(locale = '') {
  return String(locale).toLowerCase().startsWith('es') ? DAILY_LIMIT_MESSAGE_ES : DAILY_LIMIT_MESSAGE;
}

export function normalizeDailyLimit(value, fallback) {
  if (value === undefined || value === null || String(value).trim() === '') return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return Math.floor(parsed);
}

const MAX_USERS = 50_000;

export function createDailyLimiter({ store, limits = DEFAULT_DAILY_LIMITS, logger } = {}) {
  const config = {
    messages: normalizeDailyLimit(limits.messages, DEFAULT_DAILY_LIMITS.messages),
    tool_calls: normalizeDailyLimit(limits.tool_calls, DEFAULT_DAILY_LIMITS.tool_calls)
  };
  // uid -> { day: 'AAAA-MM-DD', messages, tool_calls, seeded: Promise }
  const counters = new Map();

  function dayParts(now) {
    const iso = now.toISOString();
    return { day: iso.slice(0, 10), month: iso.slice(0, 7), dd: iso.slice(8, 10) };
  }

  async function counterFor(uid, now) {
    const { day, month, dd } = dayParts(now);
    let entry = counters.get(uid);
    if (!entry || entry.day !== day) {
      if (counters.size > MAX_USERS) {
        for (const [key, value] of counters) if (value.day !== day) counters.delete(key);
      }
      entry = { day, messages: 0, tool_calls: 0, seeded: null };
      // Parte do que ja foi gravado hoje (ex.: depois de reiniciar a API). Falha na leitura nao bloqueia ninguem.
      entry.seeded = (async () => {
        if (typeof store?.getUsage !== 'function') return;
        try {
          const saved = (await store.getUsage(uid, month))?.by_day?.[dd] || {};
          entry.messages += Number(saved.messages) || 0;
          entry.tool_calls += Number(saved.tool_calls) || 0;
        } catch {
          logger?.warn?.(JSON.stringify({ level: 'warn', event: 'daily_limit_seed_failed' }));
        }
      })();
      counters.set(uid, entry);
    }
    await entry.seeded;
    return entry;
  }

  /**
   * Conta uma unidade e diz se ainda esta dentro do limite.
   * Devolve { allowed, used, limit }. Limite 0 = sem limite.
   */
  async function hit(kind, uid, now = new Date()) {
    const limit = config[kind];
    if (!uid || !limit) return { allowed: true, used: 0, limit: 0 };
    const entry = await counterFor(uid, now);
    entry[kind] += 1;
    return { allowed: entry[kind] <= limit, used: entry[kind], limit };
  }

  async function enforce(kind, uid, { now = new Date(), locale = '' } = {}) {
    const result = await hit(kind, uid, now);
    if (!result.allowed) {
      throw new ApiError(429, 'DAILY_LIMIT_REACHED', dailyLimitMessage(locale), { limite: result.limit, tipo: kind });
    }
    return result;
  }

  return { limits: config, hit, enforce };
}
