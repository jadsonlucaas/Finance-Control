import { createRequire } from 'node:module';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFirestoreStore } from '../../services/whatsapp-api/src/firestoreStore.js';
import { createActionService } from '../../services/whatsapp-api/src/actions.js';
import { createBillingService } from '../../services/whatsapp-api/src/billing.js';

/**
 * Item 5 da seguranca, contra o Firestore de verdade (emulador): transacoes e create()
 * concorrentes do adaptador usado em producao pela whatsapp-api.
 */
const requireFromApi = createRequire(new URL('../../services/whatsapp-api/package.json', import.meta.url));
const { initializeApp, deleteApp } = requireFromApi('firebase-admin/app');
const { getFirestore } = requireFromApi('firebase-admin/firestore');

const PROJECT_ID = 'finance-control-whatsapp-api-concurrency';
const UID = 'uid-alice';
let app;
let db;
let store;

async function clearEmulator() {
  const host = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
  await fetch(`http://${host}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`, { method: 'DELETE' });
}

beforeAll(() => {
  process.env.FIRESTORE_EMULATOR_HOST ||= '127.0.0.1:8080';
  app = initializeApp({ projectId: PROJECT_ID }, 'whatsapp-api-concurrency');
  db = getFirestore(app);
  store = createFirestoreStore(db);
});
afterAll(async () => { await deleteApp(app); });
beforeEach(clearEmulator);

describe('whatsapp-api no Firestore: concorrencia e retomada', () => {
  it('10 confirmacoes simultaneas gravam um unico lancamento', async () => {
    let clock = Date.parse('2026-11-09T15:00:00Z');
    let n = 0;
    const actions = createActionService({ store, now: () => new Date(clock), newId: () => `p${++n}`, logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } });
    const prepared = await actions.prepare(UID, { duas_etapas: true, acao: 'registrar_receita', dados: { descricao: 'Bonus', valor: 300 } });
    const results = await Promise.allSettled(Array.from({ length: 10 }, () => actions.confirm(UID, { confirmation_id: prepared.confirmation_id })));
    const ok = results.filter((r) => r.status === 'fulfilled');
    expect(ok.filter((r) => r.value.status === 'executado')).toHaveLength(1);
    results.filter((r) => r.status === 'rejected').forEach((r) => expect(r.reason.code).toBe('ACTION_IN_PROGRESS'));
    const records = await db.collection(`users/${UID}/finance_records`).get();
    expect(records.size).toBe(1);
    clock += 1000;
    expect((await actions.confirm(UID, { confirmation_id: prepared.confirmation_id })).status).toBe('ja_executado');
  });

  it('reserva parada em processing: so uma de varias retomadas simultaneas assume', async () => {
    await store.reserveReceipt(UID, 'whatsapp_x', { status: 'processing', created_at: '2026-11-09T15:00:00.000Z' });
    const fresh = await store.reserveReceipt(UID, 'whatsapp_x', { status: 'processing', created_at: '2026-11-09T15:00:30.000Z' }, { staleBeforeIso: '2026-11-09T14:58:30.000Z' });
    expect(fresh.created).toBe(false);
    const attempts = await Promise.all(Array.from({ length: 5 }, () =>
      store.reserveReceipt(UID, 'whatsapp_x', { status: 'processing', created_at: '2026-11-09T15:05:00.000Z' }, { staleBeforeIso: '2026-11-09T15:03:00.000Z' })));
    expect(attempts.filter((a) => a.reclaimed)).toHaveLength(1);
  });

  it('createRecord com id fixo nao duplica', async () => {
    const [a, b] = await Promise.all([
      store.createRecord(UID, { description: 'X' }, { id: 'whatsapp_p1' }),
      store.createRecord(UID, { description: 'X' }, { id: 'whatsapp_p1' })
    ]);
    expect(a).toBe('whatsapp_p1');
    expect(b).toBe('whatsapp_p1');
    expect((await db.collection(`users/${UID}/finance_records`).get()).size).toBe(1);
  });

  it('mesmo codigo de vinculo usado por dois telefones ao mesmo tempo: um vence', async () => {
    const nowMs = Date.parse('2026-11-09T15:00:00Z');
    await db.doc('whatsapp_link_codes/code1').set({ owner_uid: UID, status: 'pending', expires_at: new Date(nowMs + 600_000).toISOString() });
    const base = { codeId: 'code1', uid: UID, chatwootAccountId: '3', nowIso: new Date(nowMs).toISOString(), nowMs };
    const outcomes = await Promise.all([
      store.completeLink({ ...base, phone: '+34600000001' }),
      store.completeLink({ ...base, phone: '+34600000002' })
    ]);
    expect(outcomes.filter((o) => o === 'linked')).toHaveLength(1);
    const active = await db.collection('whatsapp_links').where('status', '==', 'active').get();
    expect(active.size).toBe(1);
  });

  it('evento do Stripe entregue 5 vezes ao mesmo tempo e aplicado uma vez', async () => {
    await db.doc('billing_customers/cus_1').set({ uid: UID });
    const merge = vi.spyOn(store, 'mergeBillingSubscription');
    const billing = createBillingService({ store, now: () => new Date('2026-11-09T15:00:00Z'), logger: { warn: vi.fn() } });
    const evt = { id: 'evt_1', type: 'customer.updated', data: { object: { id: 'cus_1', phone: '+34600000001' } } };
    const results = await Promise.allSettled(Array.from({ length: 5 }, () => billing.handleEvent(evt)));
    expect(results.filter((r) => r.status === 'fulfilled' && r.value.resultado === 'phone_updated')).toHaveLength(1);
    results.filter((r) => r.status === 'rejected').forEach((r) => expect(r.reason.code).toBe('EVENT_IN_PROGRESS'));
    expect(merge).toHaveBeenCalledTimes(1);
    expect((await db.doc('billing_webhook_events/evt_1').get()).data()).toMatchObject({ status: 'done' });
  });
});
