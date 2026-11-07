import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../../../services/whatsapp-api/src/app.js';
import { createMemoryStore } from '../../../services/whatsapp-api/src/memoryStore.js';
import { createPhoneResolver } from '../../../services/whatsapp-api/src/phoneLinks.js';
import { createCheckoutService, encodeStripeForm } from '../../../services/whatsapp-api/src/checkout.js';

const API_KEY = 'test-key-123';
const ALICE = 'uid-alice';
const PRICES = { brl: 'price_brl', eur: 'price_eur' };

function fakeStripe() {
  const calls = [];
  let n = 0;
  return {
    calls,
    async post(path, params, options = {}) {
      calls.push({ path, params, options });
      n += 1;
      if (path === '/customers') return { id: `cus_${n}` };
      if (path === '/checkout/sessions') return { id: `cs_${n}`, url: `https://checkout.stripe.test/${n}` };
      if (path === '/billing_portal/sessions') return { url: 'https://billing.stripe.test/session' };
      throw new Error(`unexpected ${path}`);
    }
  };
}

function setup({ onboarding = { name: 'Alice', country: 'ES', whatsapp_phone: '+34600000001' }, status = 'active', configured = true } = {}) {
  const store = createMemoryStore({}, { profiles: { [ALICE]: { uid: ALICE, email: 'alice@example.com', status } } });
  if (onboarding) store._setOnboarding(ALICE, onboarding);
  const stripe = fakeStripe();
  const verifyIdToken = vi.fn(async (token) => {
    if (token !== 'token-alice') throw new Error('invalid');
    return { uid: ALICE, email: 'alice@example.com' };
  });
  const checkout = createCheckoutService({
    store,
    stripe: configured ? stripe : null,
    verifyIdToken,
    prices: PRICES,
    appUrl: 'https://app.example.test/',
    logger: { info: vi.fn() }
  });
  const app = createApp({
    store,
    resolver: createPhoneResolver(new Map(), { store }),
    apiKey: API_KEY,
    checkout,
    logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() }
  });
  const call = (action, body, apiKey = API_KEY) => app.handle({
    method: 'POST',
    path: `/internal/billing/${action}`,
    headers: { 'x-api-key': apiKey },
    body
  });
  return { store, stripe, call };
}

describe('whatsapp-api: checkout criado pelo servidor', () => {
  it('codifica parametros aninhados no formato do Stripe', () => {
    expect(encodeStripeForm({ line_items: [{ price: 'p', quantity: 1 }], metadata: { uid: 'a b' }, skip: undefined }))
      .toBe('line_items%5B0%5D%5Bprice%5D=p&line_items%5B0%5D%5Bquantity%5D=1&metadata%5Buid%5D=a%20b');
  });

  it('cria cliente e sessao com preco do pais, uid, telefone do cadastro e 7 dias gratis', async () => {
    const { call, stripe, store } = setup();
    const result = await call('checkout', { idToken: 'token-alice' });
    expect(result).toMatchObject({ status: 200, body: { url: 'https://checkout.stripe.test/2' } });

    const [customer, session] = stripe.calls;
    expect(customer).toMatchObject({ path: '/customers', params: { email: 'alice@example.com', phone: '+34600000001', metadata: { uid: ALICE } } });
    expect(customer.options.idempotencyKey).toBe(`fc-customer-${ALICE}-34600000001`);
    expect(session.params).toMatchObject({
      mode: 'subscription',
      customer: 'cus_1',
      client_reference_id: ALICE,
      line_items: [{ price: 'price_eur', quantity: 1 }],
      subscription_data: { trial_period_days: 7, metadata: { uid: ALICE } },
      metadata: { uid: ALICE, whatsapp_phone: '+34600000001' },
      success_url: 'https://app.example.test/?assinatura=sucesso'
    });
    expect(await store.getBillingCustomer('cus_1')).toMatchObject({ uid: ALICE });
    expect(await store.getBillingSubscription(ALICE)).toMatchObject({ customer_id: 'cus_1' });
  });

  it('Brasil paga em reais; cliente existente e reaproveitado; sem teste gratis na segunda assinatura', async () => {
    const { call, stripe, store } = setup({ onboarding: { name: 'Ana', country: 'BR', whatsapp_phone: '+5511999998888' } });
    await store.mergeBillingSubscription(ALICE, { customer_id: 'cus_old', subscription_id: 'sub_old', status: 'canceled' });
    await call('checkout', { idToken: 'token-alice' });
    expect(stripe.calls).toHaveLength(1);
    expect(stripe.calls[0].params).toMatchObject({ customer: 'cus_old', line_items: [{ price: 'price_brl', quantity: 1 }] });
    expect(stripe.calls[0].params.subscription_data.trial_period_days).toBeUndefined();
  });

  it('quem ja assina nao abre outro checkout', async () => {
    const { call, stripe, store } = setup();
    await store.mergeBillingSubscription(ALICE, { customer_id: 'cus_1', subscription_id: 'sub_1', status: 'trialing' });
    expect((await call('checkout', { idToken: 'token-alice' })).body).toEqual({ jaAssinante: true });
    expect(stripe.calls).toHaveLength(0);
  });

  it('exige token valido, conta ativa e cadastro completo', async () => {
    expect((await setup().call('checkout', {})).body.erro.codigo).toBe('AUTH_REQUIRED');
    expect((await setup().call('checkout', { idToken: 'forjado' })).body.erro.codigo).toBe('AUTH_INVALID');
    expect((await setup({ status: 'inactive' }).call('checkout', { idToken: 'token-alice' })).body.erro.codigo).toBe('ACCOUNT_NOT_ACTIVE');
    expect((await setup({ onboarding: null }).call('checkout', { idToken: 'token-alice' })).body.erro.codigo).toBe('ONBOARDING_REQUIRED');
    expect((await setup().call('checkout', { idToken: 'token-alice' }, 'errada')).status).toBe(401);
    expect((await setup({ configured: false }).call('checkout', { idToken: 'token-alice' })).status).toBe(503);
  });

  it('rota unica do relay escolhe a acao pelo corpo', async () => {
    const { store, stripe } = setup();
    const app = createApp({
      store,
      resolver: createPhoneResolver(new Map(), { store }),
      apiKey: API_KEY,
      checkout: createCheckoutService({ store, stripe, verifyIdToken: async () => ({ uid: ALICE }), prices: PRICES, appUrl: 'https://app.example.test' }),
      logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() }
    });
    const call = (body) => app.handle({ method: 'POST', path: '/internal/billing', headers: { 'x-api-key': API_KEY }, body });
    expect((await call({ acao: 'checkout', idToken: 't' })).body.url).toMatch(/checkout/);
    expect((await call({ acao: 'apagar', idToken: 't' })).body.erro.codigo).toBe('INVALID_ACTION');
  });

  it('portal abre a sessao do proprio cliente', async () => {
    const { call, stripe, store } = setup();
    expect((await call('portal', { idToken: 'token-alice' })).body.erro.codigo).toBe('NO_SUBSCRIPTION');
    await store.mergeBillingSubscription(ALICE, { customer_id: 'cus_9' });
    expect((await call('portal', { idToken: 'token-alice' })).body).toEqual({ url: 'https://billing.stripe.test/session' });
    expect(stripe.calls[0].params).toEqual({ customer: 'cus_9', return_url: 'https://app.example.test/' });
  });
});
