import { readFileSync } from 'node:fs';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { deleteDoc, doc, setDoc, updateDoc } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

// Etapa 5, item 4: recursos do Premium tambem barrados no servidor (regras), nao so na tela.
const PROJECT_ID = 'finance-control-plan-limits-test';
const NOW = '2026-11-16T00:00:00.000Z';

let testEnv;

const email = (uid) => `${uid}@example.test`;
const profile = (uid, role = 'user') => ({ uid, email: email(uid), role, status: 'active', created_at: NOW, updated_at: NOW });
const dbFor = (uid) => testEnv.authenticatedContext(uid, { email: email(uid) }).firestore();
const seed = (fn) => testEnv.withSecurityRulesDisabled(async (context) => fn(context.firestore()));

function record(uid, overrides = {}) {
  return {
    type: 'saida',
    person: 'Pessoa Teste',
    description: 'Despesa teste',
    amount: 50,
    status: 'Em aberto',
    competence: '2026-11',
    owner_uid: uid,
    owner_email: email(uid),
    ...overrides
  };
}
const hours = (uid, overrides = {}) => record(uid, { type: 'controle_horas', hour_control_type: 'Hora Extra', quantidadeHoras: 2, ...overrides });
const imported = (uid) => record(uid, { import_batch_id: 'batch_1', import_source: 'spreadsheet_import' });
const recordRef = (db, uid, id) => doc(db, `users/${uid}/finance_records/${id}`);

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({ projectId: PROJECT_ID, firestore: { rules: readFileSync('firestore.rules', 'utf8') } });
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await seed(async (db) => {
    for (const uid of ['free', 'comp', 'trial', 'pastdue', 'canceled', 'revoked']) await setDoc(doc(db, 'users', uid), profile(uid));
    await setDoc(doc(db, 'users', 'admin'), profile('admin', 'admin'));
    await setDoc(doc(db, 'whatsapp_comp_access', 'comp'), { uid: 'comp', status: 'active', granted_by: 'admin', granted_at: NOW });
    await setDoc(doc(db, 'whatsapp_comp_access', 'revoked'), { uid: 'revoked', status: 'revoked', granted_by: 'admin', granted_at: NOW });
    await setDoc(doc(db, 'billing_subscriptions', 'trial'), { uid: 'trial', status: 'trialing' });
    await setDoc(doc(db, 'billing_subscriptions', 'pastdue'), { uid: 'pastdue', status: 'past_due' });
    await setDoc(doc(db, 'billing_subscriptions', 'canceled'), { uid: 'canceled', status: 'canceled' });
  });
});

afterAll(async () => {
  await testEnv?.cleanup();
});

describe('Firestore Rules - limites do plano Gratuito', () => {
  it('Gratuito segue lancando entradas e saidas normalmente', async () => {
    await assertSucceeds(setDoc(recordRef(dbFor('free'), 'free', 'r1'), record('free')));
    await assertSucceeds(setDoc(recordRef(dbFor('free'), 'free', 'r2'), record('free', { type: 'entrada', status: 'Pago' })));
  });

  it('Gratuito, assinatura cancelada e cortesia revogada nao criam controle de horas nem lancamento importado', async () => {
    for (const uid of ['free', 'canceled', 'revoked']) {
      await assertFails(setDoc(recordRef(dbFor(uid), uid, 'h1'), hours(uid)));
      await assertFails(setDoc(recordRef(dbFor(uid), uid, 'i1'), imported(uid)));
    }
  });

  it('Premium (cortesia, teste gratis, pagamento pendente) e admin criam os dois', async () => {
    for (const uid of ['comp', 'trial', 'pastdue', 'admin']) {
      await assertSucceeds(setDoc(recordRef(dbFor(uid), uid, 'h1'), hours(uid)));
      await assertSucceeds(setDoc(recordRef(dbFor(uid), uid, 'i1'), imported(uid)));
    }
  });

  it('quem voltou ao Gratuito ainda edita e apaga o que criou no Premium', async () => {
    await seed(async (db) => {
      await setDoc(recordRef(db, 'canceled', 'h_old'), hours('canceled'));
      await setDoc(recordRef(db, 'canceled', 'i_old'), imported('canceled'));
    });
    const db = dbFor('canceled');
    await assertSucceeds(updateDoc(recordRef(db, 'canceled', 'h_old'), { quantidadeHoras: 3 }));
    await assertSucceeds(updateDoc(recordRef(db, 'canceled', 'i_old'), { status: 'Pago' }));
    await assertSucceeds(deleteDoc(recordRef(db, 'canceled', 'h_old')));
  });

  it('usuario nao se da Premium gravando a propria assinatura ou cortesia', async () => {
    const db = dbFor('free');
    await assertFails(setDoc(doc(db, 'billing_subscriptions', 'free'), { uid: 'free', status: 'active' }));
    await assertFails(setDoc(doc(db, 'whatsapp_comp_access', 'free'), { uid: 'free', status: 'active', granted_by: 'free', granted_at: NOW }));
  });
});
