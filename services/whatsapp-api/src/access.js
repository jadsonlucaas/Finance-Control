import { ApiError } from './errors.js';
import { normalizePhone } from './phoneLinks.js';

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

export const PHONE_MISMATCH_MESSAGE = 'Este número não é o número principal da sua assinatura Premium. '
  + 'Use o número informado no pagamento ou troque o telefone em "Gerenciar assinatura" no app do Finance Control.';

export function accessMessage(status) {
  return status === 'phone_mismatch' ? PHONE_MISMATCH_MESSAGE : ACCESS_REQUIRED_MESSAGE;
}

export function normalizeAccessMode(value) {
  const mode = String(value || '').trim().toLowerCase();
  if (!mode) return 'open';
  if (!ACCESS_MODES.includes(mode)) throw new Error(`WHATSAPP_ACCESS_MODE invalido: use ${ACCESS_MODES.join(' ou ')}.`);
  return mode;
}

/**
 * phone (opcional): numero que esta falando no WhatsApp. Na assinatura do Stripe, o telefone
 * informado no pagamento e o numero principal: outro numero vinculado a mesma conta nao usa o Premium.
 * A cortesia do admin nao depende de telefone.
 */
export function evaluateAccess({ comp = null, subscription = null } = {}, { phone = '' } = {}) {
  if (comp?.status === 'active') return { allowed: true, source: 'comp', status: 'active' };
  const status = String(subscription?.status || '');
  if (status && SUBSCRIPTION_ALLOWED_STATUSES.includes(status)) {
    const principal = normalizePhone(subscription.phone);
    const speaking = normalizePhone(phone);
    if (principal && speaking && principal !== speaking) return { allowed: false, source: 'stripe', status: 'phone_mismatch' };
    return { allowed: true, source: 'stripe', status };
  }
  return { allowed: false, source: status ? 'stripe' : 'none', status: status || 'none' };
}

export function createAccessPolicy({ store, mode = 'open' } = {}) {
  const accessMode = normalizeAccessMode(mode);

  async function check(uid, { phone = '' } = {}) {
    if (accessMode !== 'entitlement') return { allowed: true, source: 'open', status: 'open' };
    if (typeof store?.getWhatsAppAccess !== 'function') throw new Error('Store sem getWhatsAppAccess.');
    return evaluateAccess(await store.getWhatsAppAccess(uid), { phone });
  }

  async function assert(uid, options) {
    const result = await check(uid, options);
    if (!result.allowed) {
      throw new ApiError(403, 'WHATSAPP_ACCESS_REQUIRED', accessMessage(result.status), { assinatura: result.status });
    }
    return result;
  }

  return { mode: accessMode, check, assert };
}
