import { ApiError } from './errors.js';

/**
 * Direito de uso do assistente no WhatsApp.
 *
 * Fontes:
 * - Cortesia: whatsapp_comp_access/{uid}, concedida por um admin no Dashboard.
 * - Stripe:   billing_subscriptions/{uid}, gravada so pelo servidor a partir dos webhooks.
 *
 * Modos (WHATSAPP_ACCESS_MODE):
 * - open:        nao exige direito de uso (comportamento anterior; padrao para rollout seguro).
 * - entitlement: exige cortesia ativa ou assinatura em dia.
 */
export const ACCESS_MODES = Object.freeze(['open', 'entitlement']);

// past_due: o Stripe ainda esta tentando cobrar; o acesso segue ate virar unpaid/canceled.
export const SUBSCRIPTION_ALLOWED_STATUSES = Object.freeze(['trialing', 'active', 'past_due']);

export const ACCESS_REQUIRED_MESSAGE = 'Seu acesso ao assistente do WhatsApp não está ativo. '
  + 'Assine o Premium no app do Finance Control para continuar usando por aqui.';

export function normalizeAccessMode(value) {
  const mode = String(value || '').trim().toLowerCase();
  if (!mode) return 'open';
  if (!ACCESS_MODES.includes(mode)) throw new Error(`WHATSAPP_ACCESS_MODE invalido: use ${ACCESS_MODES.join(' ou ')}.`);
  return mode;
}

export function evaluateAccess({ comp = null, subscription = null } = {}) {
  if (comp?.status === 'active') return { allowed: true, source: 'comp', status: 'active' };
  const status = String(subscription?.status || '');
  if (status && SUBSCRIPTION_ALLOWED_STATUSES.includes(status)) return { allowed: true, source: 'stripe', status };
  return { allowed: false, source: status ? 'stripe' : 'none', status: status || 'none' };
}

export function createAccessPolicy({ store, mode = 'open' } = {}) {
  const accessMode = normalizeAccessMode(mode);

  async function check(uid) {
    if (accessMode !== 'entitlement') return { allowed: true, source: 'open', status: 'open' };
    if (typeof store?.getWhatsAppAccess !== 'function') throw new Error('Store sem getWhatsAppAccess.');
    return evaluateAccess(await store.getWhatsAppAccess(uid));
  }

  async function assert(uid) {
    const result = await check(uid);
    if (!result.allowed) {
      throw new ApiError(403, 'WHATSAPP_ACCESS_REQUIRED', ACCESS_REQUIRED_MESSAGE, { assinatura: result.status });
    }
    return result;
  }

  return { mode: accessMode, check, assert };
}
