import { createHash } from 'node:crypto';
import { ApiError } from './errors.js';

/**
 * Limite de requisicoes em memoria (janela fixa por chave).
 *
 * A API roda com 1 replica, entao um contador no processo basta. Se escalar para mais
 * replicas, cada uma conta separado (o limite efetivo multiplica), o que ainda protege
 * contra loop do agente e abuso de um unico telefone/usuario.
 *
 * Todas as chamadas chegam pelo n8n (mesmo IP), por isso as chaves sao telefone, uid e
 * token do Dashboard, nunca IP.
 */
export const DEFAULT_RATE_LIMITS = Object.freeze({
  // Qualquer rota do WhatsApp, por telefone (o agente pode chamar varias ferramentas por mensagem).
  phone: { limit: 30, windowMs: 60_000 },
  // Leituras + escritas por usuario resolvido (soma de todos os telefones dele).
  user: { limit: 60, windowMs: 60_000 },
  // Preparar/confirmar/cancelar lancamentos, por usuario.
  userWrite: { limit: 20, windowMs: 60_000 },
  // Tentativas de codigo de vinculo por telefone (alem do bloqueio de 5 erros/hora no Firestore).
  linkConfirm: { limit: 10, windowMs: 10 * 60_000 },
  // Checkout/portal/exclusao pelo Dashboard, por ID token.
  billingToken: { limit: 10, windowMs: 60_000 },
  // Teto geral das rotas de cobranca (cada chamada pode bater no Stripe).
  billingGlobal: { limit: 120, windowMs: 60_000 }
});

const MAX_KEYS = 50_000;

export function hashKey(value) {
  return createHash('sha256').update(String(value)).digest('hex').slice(0, 32);
}

export function createRateLimiter({ limits = DEFAULT_RATE_LIMITS, nowMs = () => Date.now() } = {}) {
  const buckets = new Map();
  let calls = 0;

  function sweep(current) {
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt <= current) buckets.delete(key);
    }
  }

  /** Conta uma chamada. Devolve { allowed, retryAfterSeconds }. Chave vazia nao e limitada. */
  function hit(policyName, key) {
    const policy = limits[policyName];
    if (!policy || !key) return { allowed: true, retryAfterSeconds: 0 };
    const current = nowMs();
    if (++calls % 1000 === 0 || buckets.size > MAX_KEYS) sweep(current);
    const bucketKey = `${policyName}:${key}`;
    let bucket = buckets.get(bucketKey);
    if (!bucket || bucket.resetAt <= current) {
      bucket = { count: 0, resetAt: current + policy.windowMs };
      buckets.set(bucketKey, bucket);
    }
    bucket.count += 1;
    if (bucket.count > policy.limit) {
      return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - current) / 1000)) };
    }
    return { allowed: true, retryAfterSeconds: 0 };
  }

  /** Igual a hit, mas lanca 429 quando passa do limite. */
  function enforce(policyName, key) {
    const result = hit(policyName, key);
    if (!result.allowed) {
      throw new ApiError(429, 'RATE_LIMITED', 'Muitas solicitacoes em pouco tempo. Aguarde um pouco e tente de novo.', {
        limite: policyName,
        tente_em_segundos: result.retryAfterSeconds
      });
    }
  }

  return { hit, enforce, size: () => buckets.size };
}
