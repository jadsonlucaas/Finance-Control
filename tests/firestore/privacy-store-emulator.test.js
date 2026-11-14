import { createRequire } from 'node:module';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createFirestoreStore } from '../../services/whatsapp-api/src/firestoreStore.js';

/**
 * Direitos do titular contra o Firestore de verdade (emulador): a exportacao traz tudo da
 * conta e nada de outra; a exclusao apaga tambem aceites de termos e deixa a outra conta intacta.
 */
const requireFromApi = createRequire(new URL('../../services/whatsapp-api/package.json', import.meta.url));
const { initializeApp, deleteApp } = requireFromApi('firebase-admin/app');
const { getFirestore, Timestamp } = requireFromApi('firebase-admin/firestore');

const PROJECT_ID = 'finance-control-privacy-store';
let app;
let db;
let store;

async function seed(uid, phone) {
  await db.collection('users').doc(uid).set({ uid, email: `${uid}@example.test`, role: 'user', status: 'active' });
  await db.collection('users').doc(uid).collection('finance_records').doc(`${uid}-r1`).set({ type: 'saida', amount: 10, description: `gasto de ${uid}` });
  await db.collection('users').doc(uid).collection('budgets').doc('total').set({ limits: { '2026-11': 500 } });
  await db.collection('user_onboarding').doc(uid).set({ uid, name: uid, whatsapp_phone: phone });
  await db.collection('notification_settings').doc(uid).set({ uid, whatsapp_consent: 'granted' });
  await db.collection('notification_settings').doc(uid).collection('consent_events').doc('e1').set({ uid, action: 'granted', at: Timestamp.now() });
  await db.collection('legal_consents').doc(uid).set({ uid, terms_version: 'termos-2026-11-v1', privacy_version: 'privacidade-2026-11-v1', accepted_at: Timestamp.now(), last_event_id: 'l1' });
  await db.collection('legal_consents').doc(uid).collection('events').doc('l1').set({ uid, terms_version: 'termos-2026-11-v1', at: Timestamp.now() });
  await db.collection('whatsapp_links').doc(phone).set({ uid, telefone: phone, status: 'active' });
  await db.collection('notification_messages').doc(`${uid}-m1`).set({ uid, texto: `alerta de ${uid}` });
}

beforeAll(() => {
  process.env.FIRESTORE_EMULATOR_HOST ||= '127.0.0.1:8080';
  app = initializeApp({ projectId: PROJECT_ID }, 'privacy-store');
  db = getFirestore(app);
  store = createFirestoreStore(db);
});
afterAll(async () => { await deleteApp(app); });
beforeEach(async () => {
  const host = process.env.FIRESTORE_EMULATOR_HOST;
  await fetch(`http://${host}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`, { method: 'DELETE' });
  await seed('alice', '+5511988887777');
  await seed('bob', '+34600111222');
});

describe('whatsapp-api no Firestore: privacidade', () => {
  it('exporta todas as secoes da conta e nada da outra', async () => {
    const data = await store.exportAccountData('alice');
    expect(data.perfil.email).toBe('alice@example.test');
    expect(data.dados_da_conta.finance_records.map((r) => r.id)).toEqual(['alice-r1']);
    expect(data.dados_da_conta.budgets.map((r) => r.id)).toEqual(['total']);
    expect(data.cadastro.whatsapp_phone).toBe('+5511988887777');
    expect(data.preferencias_de_notificacao.historico).toHaveLength(1);
    expect(data.aceites_de_termos.atual.terms_version).toBe('termos-2026-11-v1');
    expect(data.aceites_de_termos.historico).toHaveLength(1);
    expect(data.alertas.mensagens.map((m) => m.id)).toEqual(['alice-m1']);
    expect(data.whatsapp.vinculos.map((l) => l.id)).toEqual(['+5511988887777']);
    expect(JSON.stringify(data)).not.toMatch(/bob|34600111222/);
  });

  it('exclusao apaga aceites de termos e nao toca a outra conta', async () => {
    const footprint = await store.getAccountFootprint('alice');
    const counts = await store.purgeAccountData('alice', { customerIds: footprint.customerIds, phoneKeys: [] });
    expect(counts).toMatchObject({ legal_consents: 1, legal_consent_events: 1 });
    expect(await store.findAccountLeftovers('alice', {})).toEqual([]);
    expect((await db.collection('legal_consents').doc('alice').get()).exists).toBe(false);
    const bob = await store.exportAccountData('bob');
    expect(bob.dados_da_conta.finance_records).toHaveLength(1);
    expect(bob.aceites_de_termos.historico).toHaveLength(1);
    expect(bob.whatsapp.vinculos).toHaveLength(1);
  });
});
