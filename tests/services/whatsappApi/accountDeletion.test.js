import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../../../services/whatsapp-api/src/app.js';
import { createMemoryStore } from '../../../services/whatsapp-api/src/memoryStore.js';
import { createPhoneResolver, hashPhone } from '../../../services/whatsapp-api/src/phoneLinks.js';
import { createAccountDeletionService, hashUid } from '../../../services/whatsapp-api/src/accountDeletion.js';

const API_KEY = 'test-key-123';
const NOW = new Date('2026-11-07T12:00:00Z');
const NOW_S = Math.floor(NOW.getTime() / 1000);
const PHONE = '+5511988887777';

const PROFILES = {
  'uid-alice': { uid: 'uid-alice', email: 'alice@example.com', role: 'user', status: 'active' },
  'uid-admin': { uid: 'uid-admin', email: 'admin@example.com', role: 'admin', status: 'active' },
  'uid-admin2': { uid: 'uid-admin2', email: 'admin2@example.com', role: 'admin', status: 'active' },
  'uid-owner': { uid: 'uid-owner', email: 'owner@example.com', role: 'owner', status: 'active' }
};
const TOKENS = {
  'token-alice': { uid: 'uid-alice', email: 'alice@example.com', auth_time: NOW_S - 60 },
  'token-alice-old': { uid: 'uid-alice', email: 'alice@example.com', auth_time: NOW_S - 3600 },
  'token-admin': { uid: 'uid-admin', email: 'admin@example.com', auth_time: NOW_S - 3600 },
  'token-owner': { uid: 'uid-owner', email: 'owner@example.com', auth_time: NOW_S - 3600 }
};

function setup({ stripeConfigured = true } = {}) {
  const store = createMemoryStore(
    { 'uid-alice': [{ id: 'r1', type: 'saida', amount: 10 }, { id: 'r2', type: 'entrada', amount: 20 }] },
    { profiles: structuredClone(PROFILES) }
  );
  store._setOnboarding('uid-alice', { uid: 'uid-alice', name: 'Alice', country: 'BR', whatsapp_phone: PHONE });
  store._setComp('uid-alice', { uid: 'uid-alice', status: 'active' });
  store._setSubscription('uid-alice', { uid: 'uid-alice', customer_id: 'cus_1', subscription_id: 'sub_1', status: 'active', phone: PHONE });
  store.setBillingCustomer('cus_1', { uid: 'uid-alice' });
  store.saveStripeSubscription('sub_1', { subscription_id: 'sub_1', customer_id: 'cus_1', status: 'active' });
  store._putLink(PHONE, { uid: 'uid-alice', telefone: PHONE, status: 'active' });
  store._putLinkCode('code1', { owner_uid: 'uid-alice', status: 'pending' });
  store._putLinkAttempts(hashPhone(PHONE), { failures: 1 });
  store.writeAudit('uid-alice', { action: 'x' });
  store.savePendingAction('uid-alice', 'p1', { status: 'pending' });

  const authUsers = new Map(Object.values(PROFILES).map((p) => [p.uid, { uid: p.uid, email: p.email }]));
  const notFound = () => Object.assign(new Error('nf'), { code: 'auth/user-not-found' });
  const auth = {
    getUser: vi.fn(async (uid) => { if (!authUsers.has(uid)) throw notFound(); return authUsers.get(uid); }),
    deleteUser: vi.fn(async (uid) => { if (!authUsers.delete(uid)) throw notFound(); }),
    revokeRefreshTokens: vi.fn(async () => {})
  };
  const stripe = { del: vi.fn(async () => ({ deleted: true })) };
  const verifyIdToken = vi.fn(async (token) => {
    if (!TOKENS[token]) throw new Error('invalid');
    return TOKENS[token];
  });
  const accountDeletion = createAccountDeletionService({
    store, verifyIdToken, auth, stripe: stripeConfigured ? stripe : null, now: () => NOW, logger: { info() {}, error() {} }
  });
  const app = createApp({
    store, resolver: createPhoneResolver(new Map(), { store }), apiKey: API_KEY, accountDeletion, logger: { info() {}, error() {} }
  });
  const call = (body) => app.handle({ method: 'POST', path: '/internal/billing', headers: { authorization: `Bearer ${API_KEY}` }, body });
  return { store, auth, authUsers, stripe, call };
}

async function expectAliceGone({ store, authUsers }) {
  expect(await store.getUserProfile('uid-alice')).toBeNull();
  expect(await store.findAccountLeftovers('uid-alice', { customerIds: ['cus_1'], phoneKeys: [hashPhone(PHONE)] })).toEqual([]);
  expect(store._hasUserData('uid-alice')).toBe(false);
  expect(store._links()).toEqual([]);
  expect(store._linkCode('code1')).toBeNull();
  expect(await store.getLinkAttempts(hashPhone(PHONE))).toBeNull();
  expect(await store.getStripeSubscription('sub_1')).toBeNull();
  expect(await store.getBillingCustomer('cus_1')).toBeNull();
  expect(authUsers.has('uid-alice')).toBe(false);
}

describe('exclusao de conta (whatsapp-api)', () => {
  it('usuario exclui a propria conta: Stripe, Firestore e Auth sem sobras', async () => {
    const ctx = setup();
    const res = await ctx.call({ acao: 'excluir_conta', idToken: 'token-alice', confirmacao: ' Alice@Example.com ' });
    expect(res.status).toBe(200);
    expect(res.body.excluido).toBe(true);
    expect(ctx.stripe.del).toHaveBeenCalledWith('/customers/cus_1');
    expect(ctx.auth.revokeRefreshTokens).toHaveBeenCalledWith('uid-alice');
    await expectAliceGone(ctx);
    const record = ctx.store._accountDeletion(hashUid('uid-alice'));
    expect(record).toMatchObject({ mode: 'self', actor: 'self', stripe_customers_deleted: 1 });
    expect(JSON.stringify(record)).not.toMatch(/alice|uid-alice|5511/i);
    // Outras contas intactas.
    expect(await ctx.store.getUserProfile('uid-admin')).not.toBeNull();
  });

  it('exige senha digitada de novo (login recente) e o e-mail como confirmacao', async () => {
    const ctx = setup();
    expect((await ctx.call({ acao: 'excluir_conta', idToken: 'token-alice-old', confirmacao: 'alice@example.com' })).body.erro.codigo).toBe('REAUTH_REQUIRED');
    expect((await ctx.call({ acao: 'excluir_conta', idToken: 'token-alice', confirmacao: 'outra@example.com' })).body.erro.codigo).toBe('CONFIRMATION_MISMATCH');
    expect((await ctx.call({ acao: 'excluir_conta', idToken: 'invalido', confirmacao: 'alice@example.com' })).status).toBe(401);
    expect(await ctx.store.getUserProfile('uid-alice')).toMatchObject({ status: 'active' });
    expect(ctx.stripe.del).not.toHaveBeenCalled();
  });

  it('admin nao se exclui pela porta do usuario', async () => {
    const ctx = setup();
    const res = await ctx.call({ acao: 'excluir_conta', idToken: 'token-admin', confirmacao: 'admin@example.com' });
    expect(res.body.erro.codigo).toBe('REAUTH_REQUIRED');
    TOKENS['token-admin-fresh'] = { ...TOKENS['token-admin'], auth_time: NOW_S };
    const fresh = await ctx.call({ acao: 'excluir_conta', idToken: 'token-admin-fresh', confirmacao: 'admin@example.com' });
    expect(fresh.body.erro.codigo).toBe('ADMIN_SELF_DELETE_BLOCKED');
  });

  it('admin exclui um usuario confirmando o e-mail dele', async () => {
    const ctx = setup();
    const wrong = await ctx.call({ acao: 'excluir_usuario', idToken: 'token-admin', uid: 'uid-alice', confirmacao: 'admin@example.com' });
    expect(wrong.body.erro.codigo).toBe('CONFIRMATION_MISMATCH');
    const res = await ctx.call({ acao: 'excluir_usuario', idToken: 'token-admin', uid: 'uid-alice', confirmacao: 'alice@example.com' });
    expect(res.status).toBe(200);
    await expectAliceGone(ctx);
    expect(ctx.store._accountDeletion(hashUid('uid-alice'))).toMatchObject({ mode: 'admin', actor: 'uid-admin' });
  });

  it('protege owner, admins, a propria conta e quem nao e admin', async () => {
    const ctx = setup();
    const codes = async (body) => (await ctx.call({ acao: 'excluir_usuario', ...body })).body.erro?.codigo;
    expect(await codes({ idToken: 'token-admin', uid: 'uid-owner', confirmacao: 'owner@example.com' })).toBe('OWNER_DELETE_BLOCKED');
    expect(await codes({ idToken: 'token-admin', uid: 'uid-admin2', confirmacao: 'admin2@example.com' })).toBe('OWNER_REQUIRED');
    expect(await codes({ idToken: 'token-admin', uid: 'uid-admin', confirmacao: 'admin@example.com' })).toBe('ADMIN_SELF_DELETE_BLOCKED');
    expect(await codes({ idToken: 'token-alice', uid: 'uid-admin', confirmacao: 'admin@example.com' })).toBe('ADMIN_REQUIRED');
    expect(await codes({ idToken: 'token-admin', uid: 'uid-inexistente', confirmacao: 'x@example.com' })).toBe('USER_NOT_FOUND');
    expect(await codes({ idToken: 'token-admin', uid: '../users', confirmacao: 'x@example.com' })).toBe('INVALID_UID');
    // Owner exclui admin.
    const res = await ctx.call({ acao: 'excluir_usuario', idToken: 'token-owner', uid: 'uid-admin2', confirmacao: 'admin2@example.com' });
    expect(res.status).toBe(200);
    expect(await ctx.store.getUserProfile('uid-admin2')).toBeNull();
  });

  it('com assinatura e sem Stripe configurado: bloqueia a conta e nao apaga nada', async () => {
    const ctx = setup({ stripeConfigured: false });
    const res = await ctx.call({ acao: 'excluir_conta', idToken: 'token-alice', confirmacao: 'alice@example.com' });
    expect(res.status).toBe(503);
    expect(res.body.erro.codigo).toBe('STRIPE_REQUIRED');
    expect(await ctx.store.getUserProfile('uid-alice')).toMatchObject({ status: 'inactive' });
    expect(await ctx.store.getOnboarding('uid-alice')).not.toBeNull();
    expect(ctx.authUsers.has('uid-alice')).toBe(true);
  });

  it('repetir depois de uma falha no meio termina a exclusao', async () => {
    const ctx = setup();
    ctx.auth.deleteUser.mockRejectedValueOnce(new Error('rede'));
    const first = await ctx.call({ acao: 'excluir_usuario', idToken: 'token-admin', uid: 'uid-alice', confirmacao: 'alice@example.com' });
    expect(first.status).toBe(500);
    // Perfil ja apagado: a confirmacao usa o e-mail do Auth.
    const second = await ctx.call({ acao: 'excluir_usuario', idToken: 'token-admin', uid: 'uid-alice', confirmacao: 'alice@example.com' });
    expect(second.status).toBe(200);
    await expectAliceGone(ctx);
  });

  it('Stripe 404 (cliente ja apagado) nao impede a exclusao', async () => {
    const ctx = setup();
    ctx.stripe.del.mockRejectedValueOnce(Object.assign(new Error('missing'), { stripe: { status: 404 } }));
    const res = await ctx.call({ acao: 'excluir_conta', idToken: 'token-alice', confirmacao: 'alice@example.com' });
    expect(res.status).toBe(200);
  });

  it('sem servico configurado responde 503', async () => {
    const store = createMemoryStore();
    const app = createApp({ store, resolver: createPhoneResolver(new Map(), { store }), apiKey: API_KEY, logger: { info() {}, error() {} } });
    const res = await app.handle({ method: 'POST', path: '/internal/billing', headers: { authorization: `Bearer ${API_KEY}` }, body: { acao: 'excluir_conta', idToken: 't' } });
    expect(res.status).toBe(503);
    expect(res.body.erro.codigo).toBe('ACCOUNT_DELETION_NOT_CONFIGURED');
  });
});
