import { ApiError } from './errors.js';
import { SUBSCRIPTION_ALLOWED_STATUSES } from './access.js';
import { normalizePhone } from './phoneLinks.js';

/**
 * Checkout e portal do Stripe criados pelo servidor.
 *
 * O Dashboard nunca escolhe preco nem uid: manda so o ID token do Firebase. Aqui o token e
 * conferido, o preco sai do pais do cadastro (BR -> BRL; demais -> EUR) e o uid vai no
 * client_reference_id e nos metadados da assinatura. O telefone do cadastro vai no cliente
 * Stripe e nos metadados da sessao, e vira o numero principal quando o checkout conclui.
 */
export const TRIAL_DAYS = 7;
const STRIPE_API = 'https://api.stripe.com/v1';

// Codifica objetos aninhados no formato do Stripe: a[b][0][c]=valor.
export function encodeStripeForm(params, prefix = '') {
  const parts = [];
  for (const [key, value] of Object.entries(params || {})) {
    if (value === undefined || value === null) continue;
    const name = prefix ? `${prefix}[${key}]` : key;
    if (Array.isArray(value)) {
      value.forEach((item, index) => {
        if (item && typeof item === 'object') parts.push(encodeStripeForm(item, `${name}[${index}]`));
        else parts.push(`${encodeURIComponent(`${name}[${index}]`)}=${encodeURIComponent(String(item))}`);
      });
    } else if (typeof value === 'object') {
      parts.push(encodeStripeForm(value, name));
    } else {
      parts.push(`${encodeURIComponent(name)}=${encodeURIComponent(String(value))}`);
    }
  }
  return parts.filter(Boolean).join('&');
}

export function createStripeClient({ secretKey, fetchImpl = globalThis.fetch } = {}) {
  if (!secretKey) return null;
  async function post(path, params, { idempotencyKey } = {}) {
    const headers = {
      authorization: `Bearer ${secretKey}`,
      'content-type': 'application/x-www-form-urlencoded'
    };
    if (idempotencyKey) headers['idempotency-key'] = idempotencyKey;
    const response = await fetchImpl(`${STRIPE_API}${path}`, { method: 'POST', headers, body: encodeStripeForm(params) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(`Stripe ${path}: ${data?.error?.code || response.status}`);
      error.stripe = { status: response.status, code: data?.error?.code || '', type: data?.error?.type || '' };
      throw error;
    }
    return data;
  }
  // DELETE /customers/{id}: cancela as assinaturas na hora e remove o cliente (faturas ficam no Stripe).
  async function del(path) {
    const response = await fetchImpl(`${STRIPE_API}${path}`, { method: 'DELETE', headers: { authorization: `Bearer ${secretKey}` } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(`Stripe DELETE ${path}: ${data?.error?.code || response.status}`);
      error.stripe = { status: response.status, code: data?.error?.code || '', type: data?.error?.type || '' };
      throw error;
    }
    return data;
  }
  return { post, del };
}

export function priceForCountry(country, prices) {
  return country === 'BR' ? prices.brl : prices.eur;
}

export function createCheckoutService({ store, stripe, verifyIdToken, prices = {}, appUrl = '', logger = console }) {
  const configured = Boolean(stripe && verifyIdToken && prices.brl && prices.eur && appUrl);
  const baseUrl = String(appUrl || '').replace(/\/+$/, '');

  async function authenticate(body) {
    if (!configured) throw new ApiError(503, 'BILLING_NOT_CONFIGURED', 'Assinatura indisponivel no momento.');
    const token = String(body?.idToken || '');
    if (!token) throw new ApiError(401, 'AUTH_REQUIRED', 'Entre na sua conta para assinar.');
    let decoded;
    try {
      decoded = await verifyIdToken(token);
    } catch {
      throw new ApiError(401, 'AUTH_INVALID', 'Sessao expirada. Entre de novo.');
    }
    const uid = String(decoded?.uid || '');
    const profile = uid ? await store.getUserProfile(uid) : null;
    if (!profile || profile.status !== 'active') throw new ApiError(403, 'ACCOUNT_NOT_ACTIVE', 'Sua conta nao esta ativa.');
    return { uid, email: String(decoded.email || profile.email || '') };
  }

  async function ensureCustomer({ uid, email, phone, name }, current) {
    if (current?.customer_id) return current.customer_id;
    const customer = await stripe.post('/customers', {
      email: email || undefined,
      name: name || undefined,
      phone: phone || undefined,
      metadata: { uid, app: 'finance-control' }
    }, { idempotencyKey: `fc-customer-${uid}-${String(phone || '').replace(/\D/g, '')}` });
    await store.setBillingCustomer(customer.id, { uid, updated_at: new Date().toISOString() });
    await store.mergeBillingSubscription(uid, { uid, customer_id: customer.id, source: 'stripe' });
    return customer.id;
  }

  async function createCheckout(body) {
    const account = await authenticate(body);
    const [details, current] = await Promise.all([store.getOnboarding(account.uid), store.getBillingSubscription(account.uid)]);
    if (current?.subscription_id && SUBSCRIPTION_ALLOWED_STATUSES.includes(current.status)) {
      return { jaAssinante: true };
    }
    const phone = normalizePhone(details?.whatsapp_phone);
    if (!details?.country || !phone) {
      throw new ApiError(409, 'ONBOARDING_REQUIRED', 'Complete país e WhatsApp antes de assinar.');
    }
    const customerId = await ensureCustomer({ ...account, phone, name: details.name }, current);
    // Teste gratis so na primeira assinatura da conta.
    const trial = current?.subscription_id ? undefined : TRIAL_DAYS;
    const session = await stripe.post('/checkout/sessions', {
      mode: 'subscription',
      customer: customerId,
      client_reference_id: account.uid,
      line_items: [{ price: priceForCountry(details.country, prices), quantity: 1 }],
      subscription_data: { trial_period_days: trial, metadata: { uid: account.uid, app: 'finance-control' } },
      metadata: { uid: account.uid, whatsapp_phone: phone },
      allow_promotion_codes: 'true',
      success_url: `${baseUrl}/?assinatura=sucesso`,
      cancel_url: `${baseUrl}/?assinatura=cancelada`
    });
    logger.info?.(JSON.stringify({ level: 'info', event: 'billing_checkout_created', country: details.country, trial: Boolean(trial) }));
    return { url: session.url };
  }

  async function createPortal(body) {
    const account = await authenticate(body);
    const current = await store.getBillingSubscription(account.uid);
    if (!current?.customer_id) throw new ApiError(409, 'NO_SUBSCRIPTION', 'Voce ainda nao tem assinatura.');
    const session = await stripe.post('/billing_portal/sessions', { customer: current.customer_id, return_url: `${baseUrl}/` });
    return { url: session.url };
  }

  return { configured, createCheckout, createPortal };
}
