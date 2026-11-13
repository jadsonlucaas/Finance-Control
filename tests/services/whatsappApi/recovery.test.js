import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../../../services/whatsapp-api/src/app.js';
import { createMemoryStore } from '../../../services/whatsapp-api/src/memoryStore.js';
import { createPhoneResolver, parsePhoneLinks } from '../../../services/whatsapp-api/src/phoneLinks.js';
import { computeSignature } from '../../../services/whatsapp-api/src/billing.js';

/**
 * Item 5 da seguranca: queda no meio da operacao e chamadas simultaneas.
 * "Queda" = o processo morre entre a reserva e a conclusao (nada do catch roda),
 * entao o teste monta esse estado direto no store e depois chama de novo.
 */
const API_KEY = 'test-key-123';
const SECRET = 'whsec_test_fake_secret';
const PHONE = '+34 637 210 215';
const UID = 'user-a';
const START = Date.parse('2026-11-09T15:00:00Z');

function setup() {
  const clock = { ms: START };
  const store = createMemoryStore({
    [UID]: [{ id: 'r2', type: 'saida', description: 'Internet', amount: 120.5, status: 'Em aberto', competence: '2026-11', due_date: '2026-11-03', updated_at: '2026-11-01T10:00:00.000Z' }]
  }, { profiles: { [UID]: { uid: UID, status: 'active' } } });
  const resolver = createPhoneResolver(parsePhoneLinks(JSON.stringify([{ telefone: PHONE, uid: UID, chatwootAccountId: '3' }])));
  let counter = 0;
  const app = createApp({
    store,
    resolver,
    apiKey: API_KEY,
    stripeWebhookSecret: SECRET,
    now: () => new Date(clock.ms),
    logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
    newId: () => `id-${++counter}`
  });
  const call = (route, body) => app.handle({ method: 'POST', path: `/internal/whatsapp/${route}`, headers: { 'x-api-key': API_KEY }, body: { telefone: PHONE, accountId: 3, ...body } });
  const deliver = (event) => {
    const rawBody = JSON.stringify(event);
    const t = Math.floor(clock.ms / 1000);
    return app.handle({
      method: 'POST',
      path: '/internal/stripe/webhook',
      headers: { 'x-api-key': API_KEY, 'stripe-signature': `t=${t},v1=${computeSignature(rawBody, t, SECRET)}` },
      body: event,
      rawBody
    });
  };
  return { clock, store, call, deliver };
}

// Simula o processo morrendo logo depois de gravar: recibo fica 'processing' e a pendencia 'pending'.
async function crashAfterWrite(store, pendingId, write) {
  const pending = await store.getPendingAction(UID, pendingId);
  const receiptId = `whatsapp_${pending.id}`;
  await store.reserveReceipt(UID, receiptId, { status: 'processing', created_at: new Date(START).toISOString(), correlation_id: pending.correlation_id });
  await write(pending, receiptId);
}

describe('whatsapp-api: confirmacoes simultaneas e retomada depois de queda', () => {
  it('5 confirmacoes ao mesmo tempo criam um unico lancamento', async () => {
    const { call, store } = setup();
    const prepared = await call('acoes/preparar', { duas_etapas: true, acao: 'registrar_receita', dados: { descricao: 'Farmacia', valor: 50 } });
    const results = await Promise.all(Array.from({ length: 5 }, () => call('acoes/confirmar', { confirmation_id: prepared.body.confirmation_id })));
    expect(results.filter((r) => r.body.status === 'executado')).toHaveLength(1);
    results.forEach((r) => expect([200, 409]).toContain(r.status));
    expect(store._dump(UID).records.filter((r) => r.description === 'Farmacia')).toHaveLength(1);
  });

  it('queda depois de criar: logo em seguida responde "em andamento"; depois de 2 min retoma sem duplicar', async () => {
    const { call, store, clock } = setup();
    const prepared = await call('acoes/preparar', { duas_etapas: true, acao: 'registrar_receita', dados: { descricao: 'Farmacia', valor: 50 } });
    await crashAfterWrite(store, prepared.body.confirmation_id, (pending, receiptId) =>
      store.createRecord(UID, { ...pending.record, correlation_id: pending.correlation_id }, { id: receiptId }));

    clock.ms += 30_000;
    const early = await call('acoes/confirmar', { confirmation_id: prepared.body.confirmation_id });
    expect(early.status).toBe(409);
    expect(early.body.erro.codigo).toBe('ACTION_IN_PROGRESS');

    clock.ms += 3 * 60_000;
    const resumed = await call('acoes/confirmar', { confirmation_id: prepared.body.confirmation_id });
    expect(resumed.status).toBe(200);
    expect(resumed.body.status).toBe('executado');
    expect(store._dump(UID).records.filter((r) => r.description === 'Farmacia')).toHaveLength(1);
    const again = await call('acoes/confirmar', { confirmation_id: prepared.body.confirmation_id });
    expect(again.body.status).toBe('ja_executado');
  });

  it('queda antes de criar: a retomada cria o lancamento uma vez', async () => {
    const { call, store, clock } = setup();
    const prepared = await call('acoes/preparar', { duas_etapas: true, acao: 'registrar_receita', dados: { descricao: 'Bonus', valor: 300 } });
    await crashAfterWrite(store, prepared.body.confirmation_id, async () => {});
    clock.ms += 3 * 60_000;
    expect((await call('acoes/confirmar', { confirmation_id: prepared.body.confirmation_id })).body.status).toBe('executado');
    expect(store._dump(UID).records.filter((r) => r.description === 'Bonus')).toHaveLength(1);
  });

  it('queda depois de alterar: a retomada reconhece a alteracao ja gravada (sem "lancamento mudou")', async () => {
    const { call, store, clock } = setup();
    const prepared = await call('acoes/preparar', { acao: 'marcar_pago', dados: { lancamento_id: 'r2' } });
    await crashAfterWrite(store, prepared.body.confirmation_id, (pending) =>
      store.updateRecord(UID, 'r2', { ...pending.patch, updated_at: new Date(START).toISOString(), correlation_id: pending.correlation_id }));
    clock.ms += 3 * 60_000;
    const resumed = await call('acoes/confirmar', { confirmation_id: prepared.body.confirmation_id });
    expect(resumed.status).toBe(200);
    expect(resumed.body.status).toBe('executado');
    expect(await store.getRecord(UID, 'r2')).toMatchObject({ status: 'Pago' });
  });

  it('sem queda, alteracao feita por outro canal continua bloqueada', async () => {
    const { call, store } = setup();
    const prepared = await call('acoes/preparar', { acao: 'marcar_pago', dados: { lancamento_id: 'r2' } });
    await store.updateRecord(UID, 'r2', { amount: 999, updated_at: '2026-11-09T15:00:01.000Z' });
    const res = await call('acoes/confirmar', { confirmation_id: prepared.body.confirmation_id });
    expect(res.status).toBe(409);
    expect(res.body.erro.codigo).toBe('RECORD_CHANGED');
  });
});

describe('whatsapp-api: eventos do Stripe repetidos, simultaneos e interrompidos', () => {
  const event = (id) => ({ id, type: 'customer.updated', livemode: false, data: { object: { id: 'cus_1', phone: '+34600000001' } } });

  it('o mesmo evento 3 vezes ao mesmo tempo e processado uma vez; os outros pedem reenvio', async () => {
    const { deliver, store } = setup();
    const results = await Promise.all([deliver(event('evt_a')), deliver(event('evt_a')), deliver(event('evt_a'))]);
    expect(results.filter((r) => r.status === 200 && r.body.resultado !== 'duplicate')).toHaveLength(1);
    results.filter((r) => r.status !== 200).forEach((r) => expect(r.body.erro.codigo).toBe('EVENT_IN_PROGRESS'));
    expect(store._getBillingEvent('evt_a')).toMatchObject({ status: 'done' });
    expect((await deliver(event('evt_a'))).body.resultado).toBe('duplicate');
  });

  it('queda no meio: reenvio cedo pede nova tentativa; depois de 2 min o reenvio processa', async () => {
    const { deliver, store, clock } = setup();
    await store.reserveBillingEvent('evt_b', { type: 'customer.updated', status: 'processing', received_at: new Date(START).toISOString() });
    clock.ms += 30_000;
    const early = await deliver(event('evt_b'));
    expect(early.status).toBe(409);
    clock.ms += 3 * 60_000;
    const resumed = await deliver(event('evt_b'));
    expect(resumed.status).toBe(200);
    expect(resumed.body.resultado).not.toBe('duplicate');
    expect(store._getBillingEvent('evt_b')).toMatchObject({ status: 'done', attempts: 2 });
  });

  it('erro no processamento libera o evento para o reenvio; registro antigo sem status conta como feito', async () => {
    const { deliver, store } = setup();
    const original = store.getBillingCustomer;
    store.getBillingCustomer = async () => { throw new Error('Firestore fora do ar'); };
    expect((await deliver(event('evt_c'))).status).toBe(500);
    expect(store._getBillingEvent('evt_c')).toBeNull();
    store.getBillingCustomer = original;
    expect((await deliver(event('evt_c'))).status).toBe(200);

    await store.reserveBillingEvent('evt_old', { type: 'customer.updated', received_at: new Date(START - 3600_000).toISOString() });
    expect((await deliver(event('evt_old'))).body.resultado).toBe('duplicate');
  });
});
