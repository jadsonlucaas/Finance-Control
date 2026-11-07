import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../../../services/whatsapp-api/src/app.js';
import { createMemoryStore } from '../../../services/whatsapp-api/src/memoryStore.js';
import { createPhoneResolver, parsePhoneLinks } from '../../../services/whatsapp-api/src/phoneLinks.js';
import { evaluateAccess, normalizeAccessMode } from '../../../services/whatsapp-api/src/access.js';

const API_KEY = 'test-key-123';
const ALICE = 'uid-alice';
const BOB = 'uid-bob';
const PHONE_A = '+34600000001';
const PHONE_B = '+5511900000002';

function setup({ accessMode = 'entitlement' } = {}) {
  const store = createMemoryStore({
    [ALICE]: [{ id: 'a1', type: 'saida', description: 'Mercado Alice', amount: 100, status: 'Pago', competence: '2026-11' }],
    [BOB]: [{ id: 'b1', type: 'saida', description: 'Segredo Bob', amount: 999, status: 'Pago', competence: '2026-11' }]
  }, {
    profiles: { [ALICE]: { uid: ALICE, status: 'active' }, [BOB]: { uid: BOB, status: 'active' } }
  });
  const links = parsePhoneLinks(JSON.stringify([
    { telefone: PHONE_A, uid: ALICE, accountId: 3 },
    { telefone: PHONE_B, uid: BOB, accountId: 3 }
  ]));
  const app = createApp({
    store,
    resolver: createPhoneResolver(links, { store }),
    apiKey: API_KEY,
    accessMode,
    now: () => new Date('2026-11-07T10:00:00Z'),
    logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() }
  });
  const call = (route, telefone, body = {}) => app.handle({
    method: 'POST',
    path: `/internal/whatsapp/${route}`,
    headers: { 'x-api-key': API_KEY },
    body: { accountId: 3, telefone, competencia: '2026-11', ...body }
  });
  return { store, call };
}

describe('whatsapp-api: direito de uso (assinatura ou cortesia)', () => {
  it('modo invalido falha na subida; vazio vira open', () => {
    expect(normalizeAccessMode('')).toBe('open');
    expect(normalizeAccessMode('ENTITLEMENT')).toBe('entitlement');
    expect(() => normalizeAccessMode('pago')).toThrow(/WHATSAPP_ACCESS_MODE/);
  });

  it('avalia cortesia e status do Stripe', () => {
    expect(evaluateAccess({ comp: { status: 'active' } })).toMatchObject({ allowed: true, source: 'comp' });
    expect(evaluateAccess({ comp: { status: 'revoked' } })).toMatchObject({ allowed: false, source: 'none' });
    for (const status of ['trialing', 'active', 'past_due']) {
      expect(evaluateAccess({ subscription: { status } })).toMatchObject({ allowed: true, source: 'stripe', status });
    }
    for (const status of ['canceled', 'unpaid', 'incomplete', 'incomplete_expired', 'paused']) {
      expect(evaluateAccess({ subscription: { status } })).toMatchObject({ allowed: false, status });
    }
  });

  it('modo open mantem o comportamento anterior', async () => {
    const { call } = setup({ accessMode: 'open' });
    expect((await call('resumo', PHONE_A)).status).toBe(200);
    expect((await call('vinculo/status', PHONE_A)).body).toEqual({ vinculado: true, acesso: 'open' });
  });

  it('sem cortesia nem assinatura: status explica e as rotas sao bloqueadas', async () => {
    const { call } = setup();
    const status = await call('vinculo/status', PHONE_A);
    expect(status.body).toMatchObject({ vinculado: false, motivo: 'WHATSAPP_ACCESS_REQUIRED', assinatura: 'none' });
    expect(status.body.mensagem).toMatch(/Premium/);
    for (const route of ['resumo', 'lancamentos', 'opcoes', 'acoes/preparar']) {
      const response = await call(route, PHONE_A, { acao: 'registrar_despesa' });
      expect(response.status).toBe(403);
      expect(response.body.erro.codigo).toBe('WHATSAPP_ACCESS_REQUIRED');
      expect(JSON.stringify(response.body)).not.toContain('Mercado Alice');
    }
  });

  it('cortesia ativa libera; revogada bloqueia na hora', async () => {
    const { store, call } = setup();
    store._setComp(ALICE, { uid: ALICE, status: 'active' });
    expect((await call('vinculo/status', PHONE_A)).body).toEqual({ vinculado: true, acesso: 'comp' });
    expect((await call('resumo', PHONE_A)).status).toBe(200);
    store._setComp(ALICE, { uid: ALICE, status: 'revoked' });
    expect((await call('resumo', PHONE_A)).status).toBe(403);
  });

  it('assinatura em teste gratis libera; cancelada bloqueia', async () => {
    const { store, call } = setup();
    store._setSubscription(ALICE, { uid: ALICE, status: 'trialing' });
    expect((await call('vinculo/status', PHONE_A)).body).toEqual({ vinculado: true, acesso: 'stripe' });
    store._setSubscription(ALICE, { uid: ALICE, status: 'canceled' });
    const blocked = await call('vinculo/status', PHONE_A);
    expect(blocked.body).toMatchObject({ vinculado: false, assinatura: 'canceled' });
  });

  it('o direito de uso de uma conta nao libera outra', async () => {
    const { store, call } = setup();
    store._setComp(ALICE, { uid: ALICE, status: 'active' });
    store._setSubscription(ALICE, { uid: ALICE, status: 'active' });
    const bob = await call('lancamentos', PHONE_B);
    expect(bob.status).toBe(403);
    expect(JSON.stringify(bob.body)).not.toContain('Segredo Bob');
    expect((await call('vinculo/status', PHONE_B)).body).toMatchObject({ vinculado: false, motivo: 'WHATSAPP_ACCESS_REQUIRED' });
  });

  it('telefone desconhecido continua PHONE_NOT_LINKED (nao revela nada sobre assinatura)', async () => {
    const { call } = setup();
    expect((await call('vinculo/status', '+34999999999')).body).toEqual({ vinculado: false, motivo: 'PHONE_NOT_LINKED' });
  });
});
