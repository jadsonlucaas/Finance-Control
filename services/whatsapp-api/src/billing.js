import { createHmac, timingSafeEqual } from 'node:crypto';
import { ApiError } from './errors.js';
import { normalizePhone } from './phoneLinks.js';

/**
 * Assinatura Premium pelo Stripe.
 *
 * O Stripe chama um webhook publico do n8n, que repassa o corpo cru e o cabecalho
 * stripe-signature para POST /internal/stripe/webhook (com a x-api-key interna).
 * Aqui a assinatura do Stripe e conferida de novo: o n8n e so o carteiro.
 *
 * Colecoes (todas gravadas so pelo servidor):
 * - billing_webhook_events/{eventId}: idempotencia (o Stripe reenvia eventos).
 * - billing_customers/{customerId}: cliente Stripe -> uid (vem do client_reference_id do checkout).
 * - billing_stripe_subscriptions/{subscriptionId}: ultimo estado conhecido, mesmo antes de saber o uid.
 * - billing_subscriptions/{uid}: o que o Dashboard e a whatsapp-api leem (status, telefone principal...).
 */
export const SIGNATURE_TOLERANCE_SECONDS = 300;
export const HANDLED_EVENT_TYPES = Object.freeze([
  'checkout.session.completed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'customer.updated'
]);

function invalidSignature(message) {
  return new ApiError(400, 'INVALID_SIGNATURE', message);
}

export function parseSignatureHeader(header) {
  const parsed = { timestamp: NaN, signatures: [] };
  String(header || '').split(',').forEach((part) => {
    const index = part.indexOf('=');
    if (index < 0) return;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (key === 't') parsed.timestamp = Number(value);
    if (key === 'v1' && value) parsed.signatures.push(value);
  });
  return parsed;
}

export function computeSignature(payload, timestamp, secret) {
  return createHmac('sha256', secret).update(`${timestamp}.${payload}`, 'utf8').digest('hex');
}

/** Mesmo algoritmo da biblioteca oficial do Stripe (esquema v1, HMAC-SHA256, tolerancia de 5 min). */
export function verifyStripeSignature(payload, header, secret, { nowSeconds = Math.floor(Date.now() / 1000), tolerance = SIGNATURE_TOLERANCE_SECONDS } = {}) {
  if (!secret) throw new ApiError(503, 'BILLING_NOT_CONFIGURED', 'Webhook do Stripe nao configurado.');
  if (typeof payload !== 'string' || !payload) throw invalidSignature('Corpo cru ausente.');
  const { timestamp, signatures } = parseSignatureHeader(header);
  if (!Number.isFinite(timestamp) || !signatures.length) throw invalidSignature('Cabecalho stripe-signature invalido.');
  if (Math.abs(nowSeconds - timestamp) > tolerance) throw invalidSignature('Assinatura fora da janela de tempo.');
  const expected = Buffer.from(computeSignature(payload, timestamp, secret), 'hex');
  const matches = signatures.some((candidate) => {
    const provided = Buffer.from(candidate, 'hex');
    return provided.length === expected.length && timingSafeEqual(provided, expected);
  });
  if (!matches) throw invalidSignature('Assinatura nao confere.');
  return true;
}

const idOf = (value) => (value && typeof value === 'object' ? String(value.id || '') : String(value || ''));
const toIso = (seconds) => (Number.isFinite(Number(seconds)) && Number(seconds) > 0 ? new Date(Number(seconds) * 1000).toISOString() : null);

function subscriptionSnapshot(subscription) {
  const item = subscription.items?.data?.[0] || {};
  const price = item.price || {};
  return {
    subscription_id: String(subscription.id || ''),
    customer_id: idOf(subscription.customer),
    status: String(subscription.status || ''),
    cancel_at_period_end: Boolean(subscription.cancel_at_period_end),
    current_period_end: toIso(item.current_period_end ?? subscription.current_period_end),
    trial_end: toIso(subscription.trial_end),
    price_id: String(price.id || ''),
    currency: String(price.currency || subscription.currency || ''),
    livemode: Boolean(subscription.livemode)
  };
}

export function createBillingService({ store, now = () => new Date(), logger = console }) {
  const required = [
    'reserveBillingEvent', 'releaseBillingEvent', 'getBillingCustomer', 'setBillingCustomer',
    'getStripeSubscription', 'saveStripeSubscription', 'getBillingSubscription', 'mergeBillingSubscription', 'getUserProfile'
  ];
  const missing = required.filter((name) => typeof store?.[name] !== 'function');
  if (missing.length) throw new Error(`Store sem suporte a cobranca: ${missing.join(', ')}.`);

  // Grava no documento do usuario so se for a assinatura atual dele (ou se a nova estiver valendo).
  async function applySubscriptionToUser(uid, snapshot, nowIso) {
    const current = await store.getBillingSubscription(uid);
    const sameSubscription = !current?.subscription_id || current.subscription_id === snapshot.subscription_id;
    const replacesOld = ['trialing', 'active', 'past_due'].includes(snapshot.status);
    if (!sameSubscription && !replacesOld) return 'stale';
    await store.mergeBillingSubscription(uid, { ...snapshot, uid, source: 'stripe', updated_at: nowIso });
    return 'applied';
  }

  const handlers = {
    async 'checkout.session.completed'(session, nowIso) {
      if (session.mode !== 'subscription') return 'ignored_mode';
      const uid = String(session.client_reference_id || '').trim();
      const customerId = idOf(session.customer);
      const subscriptionId = idOf(session.subscription);
      if (!uid || !customerId || !subscriptionId) return 'missing_reference';
      const profile = await store.getUserProfile(uid);
      if (!profile) return 'unknown_user';

      await store.setBillingCustomer(customerId, { uid, updated_at: nowIso });
      // Telefone do checkout; se o checkout nao pediu, o do cadastro (metadados da sessao criada pelo servidor).
      const phone = normalizePhone(session.customer_details?.phone) || normalizePhone(session.metadata?.whatsapp_phone);
      const patch = {
        uid,
        source: 'stripe',
        customer_id: customerId,
        subscription_id: subscriptionId,
        phone: phone || null,
        checkout_session_id: String(session.id || ''),
        livemode: Boolean(session.livemode),
        updated_at: nowIso
      };
      // O evento da assinatura pode ter chegado antes do checkout: usa o estado ja guardado.
      const known = await store.getStripeSubscription(subscriptionId);
      if (known) {
        Object.assign(patch, known, { subscription_id: subscriptionId, customer_id: customerId, updated_at: nowIso });
      } else {
        const current = await store.getBillingSubscription(uid);
        if (!current?.status || current.subscription_id !== subscriptionId) patch.status = 'incomplete';
      }
      await store.mergeBillingSubscription(uid, patch);
      return 'linked';
    },
    async 'customer.subscription.created'(subscription, nowIso) {
      const snapshot = subscriptionSnapshot(subscription);
      if (!snapshot.subscription_id) return 'missing_reference';
      await store.saveStripeSubscription(snapshot.subscription_id, { ...snapshot, updated_at: nowIso });
      const mapping = snapshot.customer_id ? await store.getBillingCustomer(snapshot.customer_id) : null;
      if (!mapping?.uid) return 'pending_checkout';
      return applySubscriptionToUser(mapping.uid, snapshot, nowIso);
    },
    async 'customer.updated'(customer, nowIso) {
      const mapping = await store.getBillingCustomer(String(customer.id || ''));
      if (!mapping?.uid) return 'unknown_customer';
      const phone = normalizePhone(customer.phone);
      if (!phone) return 'no_phone';
      const current = await store.getBillingSubscription(mapping.uid);
      if (current?.phone === phone) return 'unchanged';
      await store.mergeBillingSubscription(mapping.uid, { phone, updated_at: nowIso });
      return 'phone_updated';
    }
  };
  handlers['customer.subscription.updated'] = handlers['customer.subscription.created'];
  handlers['customer.subscription.deleted'] = handlers['customer.subscription.created'];

  async function handleEvent(event) {
    const id = String(event?.id || '');
    const type = String(event?.type || '');
    const object = event?.data?.object;
    if (!id || !type || !object || typeof object !== 'object') throw new ApiError(400, 'INVALID_EVENT', 'Evento do Stripe invalido.');
    if (!handlers[type]) return { recebido: true, resultado: 'ignored_type' };

    const nowIso = now().toISOString();
    const reservation = await store.reserveBillingEvent(id, { type, received_at: nowIso, livemode: Boolean(event.livemode) });
    if (!reservation.created) return { recebido: true, resultado: 'duplicate' };
    try {
      const outcome = await handlers[type](object, nowIso);
      if (['unknown_user', 'missing_reference', 'unknown_customer'].includes(outcome)) {
        logger.warn(JSON.stringify({ level: 'warn', event: 'billing_event_unmatched', stripe_event: id, type, outcome }));
      }
      return { recebido: true, resultado: outcome };
    } catch (error) {
      // Libera a reserva para o reenvio do Stripe processar de novo.
      await store.releaseBillingEvent(id).catch(() => {});
      throw error;
    }
  }

  return { handleEvent };
}
