import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../../../services/whatsapp-api/src/app.js';
import { createMemoryStore } from '../../../services/whatsapp-api/src/memoryStore.js';
import { createPhoneResolver, parsePhoneLinks } from '../../../services/whatsapp-api/src/phoneLinks.js';
import { evaluateAccess } from '../../../services/whatsapp-api/src/access.js';
import { computeSignature, verifyStripeSignature } from '../../../services/whatsapp-api/src/billing.js';

const API_KEY = 'test-key-123';
const SECRET = 'whsec_test_fake_secret';
const ALICE = 'uid-alice';
const PHONE_A = '+34600000001';
const PHONE_OTHER = '+34600000099';
const NOW = new Date('2026-11-07T10:00:00Z');
const NOW_S = Math.floor(NOW.getTime() / 1000);

function setup({ secret = SECRET, links = [{ telefone: PHONE_A, uid: ALICE, accountId: 3 }] } = {}) {
  const store = createMemoryStore({
    [ALICE]: [{ id: 'a1', type: 'saida', description: 'Mercado', amount: 100, status: 'Pago', competence: '2026-11' }]
  }, { profiles: { [ALICE]: { uid: ALICE, status: 'active' } } });
  const logger = { info: vi.fn(), error: vi.fn(), warn: vi.fn() };
  const app = createApp({
    store,
    resolver: createPhoneResolver(parsePhoneLinks(JSON.stringify(links)), { store }),
    apiKey: API_KEY,
    accessMode: 'entitlement',
    stripeWebhookSecret: secret,
    now: () => NOW,
    logger
  });
  const deliver = (event, { signWith = SECRET, timestamp = NOW_S, apiKey = API_KEY, tamper = false } = {}) => {
    const rawBody = JSON.stringify(event);
    const signature = computeSignature(rawBody, timestamp, signWith);
    return app.handle({
      method: 'POST',
      path: '/internal/stripe/webhook',
      headers: { 'x-api-key': apiKey, 'stripe-signature': `t=${timestamp},v1=${signature}` },
      body: event,
      rawBody: tamper ? rawBody.replace('}', ',"x":1}') : rawBody
    });
  };
  const ask = (route, telefone) => app.handle({
    method: 'POST',
    path: `/internal/whatsapp/${route}`,
    headers: { 'x-api-key': API_KEY },
    body: { accountId: 3, telefone, competencia: '2026-11' }
  });
  return { store, deliver, ask, logger };
}

let counter = 0;
const event = (type, object) => ({ id: `evt_${++counter}`, type, livemode: false, data: { object } });
const checkout = (overrides = {}) => event('checkout.session.completed', {
  id: 'cs_1', mode: 'subscription', client_reference_id: ALICE, customer: 'cus_1', subscription: 'sub_1',
  customer_details: { phone: '+34 600 000 001', email: 'alice@example.com' }, livemode: false, ...overrides
});
const subscription = (type, status, overrides = {}) => event(type, {
  id: 'sub_1', customer: 'cus_1', status, cancel_at_period_end: false, trial_end: NOW_S + 7 * 86400,
  items: { data: [{ current_period_end: NOW_S + 7 * 86400, price: { id: 'price_eur', currency: 'eur' } }] },
  livemode: false, ...overrides
});

describe('whatsapp-api: assinatura do webhook do Stripe', () => {
  it('confere HMAC, janela de tempo e varias assinaturas v1', () => {
    const raw = '{"id":"evt"}';
    const good = computeSignature(raw, NOW_S, SECRET);
    expect(verifyStripeSignature(raw, `t=${NOW_S},v1=deadbeef,v1=${good}`, SECRET, { nowSeconds: NOW_S })).toBe(true);
    expect(() => verifyStripeSignature(raw, `t=${NOW_S},v1=${good}`, 'whsec_outro', { nowSeconds: NOW_S })).toThrow(/nao confere/);
    expect(() => verifyStripeSignature(raw, `t=${NOW_S - 301},v1=${computeSignature(raw, NOW_S - 301, SECRET)}`, SECRET, { nowSeconds: NOW_S })).toThrow(/janela/);
    expect(() => verifyStripeSignature(raw, 'lixo', SECRET, { nowSeconds: NOW_S })).toThrow(/invalido/);
    expect(() => verifyStripeSignature('', `t=${NOW_S},v1=${good}`, SECRET, { nowSeconds: NOW_S })).toThrow(/cru/);
  });

  it('recusa corpo alterado, segredo errado e chamada sem a chave interna', async () => {
    const { deliver, store } = setup();
    expect((await deliver(checkout(), { tamper: true })).body.erro.codigo).toBe('INVALID_SIGNATURE');
    expect((await deliver(subscription('customer.subscription.created', 'trialing'), { tamper: true })).status).toBe(400);
    expect((await deliver(checkout(), { signWith: 'whsec_errado' })).status).toBe(400);
    expect((await deliver(checkout(), { apiKey: 'errada' })).status).toBe(401);
    expect(await store.getBillingSubscription(ALICE)).toBeNull();
  });

  it('sem segredo configurado a rota responde 503 e nao grava nada', async () => {
    const { deliver, store } = setup({ secret: '' });
    const result = await deliver(checkout());
    expect(result.status).toBe(503);
    expect(await store.getBillingSubscription(ALICE)).toBeNull();
  });
});

describe('whatsapp-api: eventos do Stripe gravam a assinatura', () => {
  it('checkout + assinatura em teste liberam o WhatsApp no numero principal', async () => {
    const { deliver, ask, store } = setup();
    expect((await deliver(checkout())).body.resultado).toBe('linked');
    expect((await store.getBillingSubscription(ALICE)).status).toBe('incomplete');
    expect((await ask('vinculo/status', PHONE_A)).body.vinculado).toBe(false);

    expect((await deliver(subscription('customer.subscription.created', 'trialing'))).body.resultado).toBe('applied');
    const saved = await store.getBillingSubscription(ALICE);
    expect(saved).toMatchObject({ uid: ALICE, status: 'trialing', phone: PHONE_A, customer_id: 'cus_1', subscription_id: 'sub_1', currency: 'eur', source: 'stripe' });
    expect((await ask('vinculo/status', PHONE_A)).body).toEqual({ vinculado: true, acesso: 'stripe' });
    expect((await ask('resumo', PHONE_A)).status).toBe(200);
  });

  it('assinatura que chega antes do checkout e aplicada quando o checkout chega', async () => {
    const { deliver, store } = setup();
    expect((await deliver(subscription('customer.subscription.created', 'trialing'))).body.resultado).toBe('pending_checkout');
    expect(await store.getBillingSubscription(ALICE)).toBeNull();
    await deliver(checkout());
    expect(await store.getBillingSubscription(ALICE)).toMatchObject({ status: 'trialing', phone: PHONE_A });
  });

  it('checkout criado pelo servidor sem telefone usa o WhatsApp do cadastro (metadados)', async () => {
    const { deliver, store } = setup();
    await deliver(checkout({ customer_details: { email: 'alice@example.com', phone: null }, metadata: { uid: ALICE, whatsapp_phone: PHONE_A } }));
    expect((await store.getBillingSubscription(ALICE)).phone).toBe(PHONE_A);
  });

  it('evento repetido e ignorado (idempotencia)', async () => {
    const { deliver, store } = setup();
    const first = checkout();
    await deliver(first);
    await store.mergeBillingSubscription(ALICE, { phone: '+5511999999999' });
    expect((await deliver(first)).body.resultado).toBe('duplicate');
    expect((await store.getBillingSubscription(ALICE)).phone).toBe('+5511999999999');
  });

  it('cancelamento corta o acesso; pagamento atrasado ainda mantem', async () => {
    const { deliver, ask } = setup();
    await deliver(checkout());
    await deliver(subscription('customer.subscription.created', 'active'));
    await deliver(subscription('customer.subscription.updated', 'past_due'));
    expect((await ask('resumo', PHONE_A)).status).toBe(200);
    await deliver(subscription('customer.subscription.deleted', 'canceled'));
    const blocked = await ask('resumo', PHONE_A);
    expect(blocked.status).toBe(403);
    expect(blocked.body.erro).toMatchObject({ codigo: 'WHATSAPP_ACCESS_REQUIRED', detalhes: { assinatura: 'canceled' } });
  });

  it('evento atrasado de assinatura antiga nao derruba a nova', async () => {
    const { deliver, store } = setup();
    await deliver(checkout());
    await deliver(subscription('customer.subscription.created', 'active'));
    await deliver(checkout({ id: 'cs_2', subscription: 'sub_2' }));
    await deliver(subscription('customer.subscription.created', 'active', { id: 'sub_2' }));
    expect((await deliver(subscription('customer.subscription.deleted', 'canceled'))).body.resultado).toBe('stale');
    expect(await store.getBillingSubscription(ALICE)).toMatchObject({ subscription_id: 'sub_2', status: 'active' });
  });

  it('outro numero vinculado a conta nao usa o Premium; trocar o telefone no Stripe libera', async () => {
    const { deliver, ask } = setup({ links: [{ telefone: PHONE_OTHER, uid: ALICE, accountId: 3 }] });
    await deliver(checkout());
    await deliver(subscription('customer.subscription.created', 'trialing'));
    const status = await ask('vinculo/status', PHONE_OTHER);
    expect(status.body).toMatchObject({ vinculado: false, motivo: 'WHATSAPP_ACCESS_REQUIRED', assinatura: 'phone_mismatch' });
    expect(status.body.mensagem).toMatch(/número principal/);
    expect((await ask('resumo', PHONE_OTHER)).status).toBe(403);

    expect((await deliver(event('customer.updated', { id: 'cus_1', phone: PHONE_OTHER }))).body.resultado).toBe('phone_updated');
    expect((await ask('vinculo/status', PHONE_OTHER)).body).toEqual({ vinculado: true, acesso: 'stripe' });
  });

  it('cortesia do admin nao depende do telefone', () => {
    expect(evaluateAccess({ comp: { status: 'active' }, subscription: { status: 'active', phone: PHONE_A } }, { phone: PHONE_OTHER }))
      .toMatchObject({ allowed: true, source: 'comp' });
  });

  it('checkout sem usuario conhecido ou fora de assinatura nao grava nada', async () => {
    const { deliver, store, logger } = setup();
    expect((await deliver(checkout({ client_reference_id: 'uid-desconhecido' }))).body.resultado).toBe('unknown_user');
    expect((await deliver(checkout({ client_reference_id: null }))).body.resultado).toBe('missing_reference');
    expect((await deliver(checkout({ mode: 'payment' }))).body.resultado).toBe('ignored_mode');
    expect((await deliver(event('invoice.paid', { id: 'in_1' }))).body.resultado).toBe('ignored_type');
    expect(await store.getBillingSubscription(ALICE)).toBeNull();
    expect(logger.warn).toHaveBeenCalled();
  });

  it('falha ao gravar libera o evento para o reenvio do Stripe', async () => {
    const { deliver, store } = setup();
    const original = store.setBillingCustomer;
    store.setBillingCustomer = async () => { throw new Error('firestore fora'); };
    const first = checkout();
    expect((await deliver(first)).status).toBe(500);
    store.setBillingCustomer = original;
    expect((await deliver(first)).body.resultado).toBe('linked');
  });
});
