import { readFileSync } from 'node:fs';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, collectionGroup, deleteDoc, doc, getDoc, getDocs, query, setDoc, where } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

/**
 * Isolamento entre contas (Etapa 4): nenhum usuario comum le, grava ou apaga dado de outro,
 * em nenhuma colecao com dado pessoal, nem sem login. Ao criar colecao nova com dado de
 * usuario, inclua aqui.
 */
const PROJECT_ID = 'finance-control-isolation-test';
const NOW = '2026-11-14T00:00:00.000Z';
const ALICE = 'alice';
const BOB = 'bob';
const ALICE_PHONE = '+5511988887777';

const ALICE_PATHS = Object.freeze([
  `users/${ALICE}`,
  `users/${ALICE}/finance_records/r1`,
  `users/${ALICE}/budgets/total`,
  `users/${ALICE}/usage/2026-11`,
  `users/${ALICE}/local_storage/k1`,
  `users/${ALICE}/audit_logs/a1`,
  `users/${ALICE}/idempotency_receipts/i1`,
  `users/${ALICE}/whatsapp_pending_actions/p1`,
  `user_onboarding/${ALICE}`,
  `notification_settings/${ALICE}`,
  `notification_settings/${ALICE}/consent_events/c1`,
  `legal_consents/${ALICE}`,
  `legal_consents/${ALICE}/events/l1`,
  `billing_subscriptions/${ALICE}`,
  `whatsapp_comp_access/${ALICE}`,
  `whatsapp_links/${ALICE_PHONE}`,
  'whatsapp_link_codes/code1',
  `notification_state/${ALICE}`,
  'notification_deliveries/d1',
  'notification_messages/m1',
  'whatsapp_inbound_messages/x1',
  'account_deletions/h1'
]);

let testEnv;
const profile = (uid) => ({ uid, email: `${uid}@example.test`, role: 'user', status: 'active', created_at: NOW, updated_at: NOW });
const dbFor = (uid) => testEnv.authenticatedContext(uid, { email: `${uid}@example.test` }).firestore();

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({ projectId: PROJECT_ID, firestore: { rules: readFileSync(process.env.RULES_FILE || 'firestore.rules', 'utf8') } });
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, 'users', BOB), profile(BOB));
    for (const path of ALICE_PATHS) {
      await setDoc(doc(db, path), path === `users/${ALICE}` ? profile(ALICE) : { uid: ALICE, owner_uid: ALICE, telefone: ALICE_PHONE, valor: 123 });
    }
  });
});

afterAll(async () => {
  await testEnv?.cleanup();
});

describe('Isolamento entre contas', () => {
  it('outra conta nao le, nao grava e nao apaga nenhum dado da Alice', async () => {
    const bob = dbFor(BOB);
    for (const path of ALICE_PATHS) {
      await assertFails(getDoc(doc(bob, path)));
      await assertFails(setDoc(doc(bob, path), { uid: BOB, valor: 1 }));
      await assertFails(deleteDoc(doc(bob, path)));
    }
  });

  it('sem login nada e lido', async () => {
    const anon = testEnv.unauthenticatedContext().firestore();
    for (const path of ALICE_PATHS) await assertFails(getDoc(doc(anon, path)));
  });

  it('consultas amplas nao vazam dados de outra conta', async () => {
    const bob = dbFor(BOB);
    await assertFails(getDocs(collection(bob, 'users', ALICE, 'finance_records')));
    await assertFails(getDocs(collectionGroup(bob, 'finance_records')));
    await assertFails(getDocs(collectionGroup(bob, 'events')));
    await assertFails(getDocs(query(collection(bob, 'whatsapp_links'), where('uid', '==', ALICE))));
    await assertFails(getDocs(query(collection(bob, 'notification_messages'), where('uid', '==', ALICE))));
    await assertFails(getDocs(collection(bob, 'legal_consents')));
  });

  it('a propria conta continua lendo os seus dados', async () => {
    const alice = dbFor(ALICE);
    await assertSucceeds(getDoc(doc(alice, `users/${ALICE}`)));
    await assertSucceeds(getDoc(doc(alice, `users/${ALICE}/finance_records/r1`)));
    await assertSucceeds(getDoc(doc(alice, `legal_consents/${ALICE}`)));
    // Consumo: a dona le, mas so a whatsapp-api (Admin SDK) grava.
    await assertSucceeds(getDoc(doc(alice, `users/${ALICE}/usage/2026-11`)));
    await assertFails(setDoc(doc(alice, `users/${ALICE}/usage/2026-11`), { messages: 0 }));
    expect(ALICE_PATHS.length).toBeGreaterThan(15);
  });
});

describe('Consumo por cliente (Etapa 5)', () => {
  it('admin le o consumo de qualquer conta, mas ninguem grava pelo app', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'users', 'root'), { ...profile('root'), role: 'admin' });
    });
    const admin = dbFor('root');
    await assertSucceeds(getDoc(doc(admin, `users/${ALICE}/usage/2026-11`)));
    await assertFails(setDoc(doc(admin, `users/${ALICE}/usage/2026-11`), { messages: 0 }));
  });
});
