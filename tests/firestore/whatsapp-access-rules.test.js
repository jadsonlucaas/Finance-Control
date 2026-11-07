import { readFileSync } from 'node:fs';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createWhatsAppAccessService } from '../../src/services/whatsappAccess.js';

const PROJECT_ID = 'finance-control-whatsapp-access-test';
const NOW = '2026-11-07T00:00:00.000Z';
const OWNER = 'jadson';
const ADMIN_INACTIVE = 'old-admin';
const ALICE = 'alice';
const BOB = 'bob';

let testEnv;

function profile(uid, { role = 'user', status = 'active' } = {}) {
  return { uid, email: `${uid}@example.test`, role, status, created_at: NOW, updated_at: NOW };
}

const dbFor = (uid) => testEnv.authenticatedContext(uid, { email: `${uid}@example.test` }).firestore();
const seed = (fn) => testEnv.withSecurityRulesDisabled(async (context) => fn(context.firestore()));
const grant = (by, uid, extra = {}) => ({ uid, status: 'active', granted_by: by, granted_at: serverTimestamp(), ...extra });

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({ projectId: PROJECT_ID, firestore: { rules: readFileSync('firestore.rules', 'utf8') } });
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await seed(async (db) => {
    await setDoc(doc(db, 'users', OWNER), profile(OWNER, { role: 'owner' }));
    await setDoc(doc(db, 'users', ADMIN_INACTIVE), profile(ADMIN_INACTIVE, { role: 'admin', status: 'inactive' }));
    await setDoc(doc(db, 'users', ALICE), profile(ALICE));
    await setDoc(doc(db, 'users', BOB), profile(BOB));
  });
});

afterAll(async () => {
  await testEnv?.cleanup();
});

describe('Firestore Rules - acesso cortesia ao WhatsApp', () => {
  it('admin ativo concede, lista e revoga pelo servico do Dashboard (inclusive para si mesmo)', async () => {
    const service = createWhatsAppAccessService(dbFor(OWNER));
    await service.grantComp(OWNER, OWNER);
    await service.grantComp(OWNER, ALICE, { note: 'socio' });
    const grants = await service.listCompGrants();
    expect(Object.keys(grants).sort()).toEqual([ALICE, OWNER]);
    expect(grants[ALICE]).toMatchObject({ status: 'active', granted_by: OWNER, note: 'socio' });

    await service.revokeComp(OWNER, ALICE);
    expect((await service.listCompGrants())[ALICE]).toMatchObject({ status: 'revoked', revoked_by: OWNER });
    // Conceder de novo sobrescreve a revogacao.
    await service.grantComp(OWNER, ALICE);
    expect((await service.listCompGrants())[ALICE].status).toBe('active');
  });

  it('usuario comum nao concede cortesia nem para si nem para outro', async () => {
    await assertFails(setDoc(doc(dbFor(ALICE), 'whatsapp_comp_access', ALICE), grant(ALICE, ALICE)));
    await assertFails(setDoc(doc(dbFor(ALICE), 'whatsapp_comp_access', BOB), grant(ALICE, BOB)));
  });

  it('admin inativo ou sem login nao concede', async () => {
    await assertFails(setDoc(doc(dbFor(ADMIN_INACTIVE), 'whatsapp_comp_access', ALICE), grant(ADMIN_INACTIVE, ALICE)));
    await assertFails(setDoc(doc(testEnv.unauthenticatedContext().firestore(), 'whatsapp_comp_access', ALICE), grant(OWNER, ALICE)));
  });

  it('admin nao forja autor, horario, campos extras nem conta inexistente', async () => {
    const db = dbFor(OWNER);
    await assertFails(setDoc(doc(db, 'whatsapp_comp_access', ALICE), grant(BOB, ALICE)));
    await assertFails(setDoc(doc(db, 'whatsapp_comp_access', ALICE), { ...grant(OWNER, ALICE), granted_at: NOW }));
    await assertFails(setDoc(doc(db, 'whatsapp_comp_access', ALICE), grant(OWNER, ALICE, { plano: 'vitalicio' })));
    await assertFails(setDoc(doc(db, 'whatsapp_comp_access', ALICE), grant(OWNER, BOB)));
    await assertFails(setDoc(doc(db, 'whatsapp_comp_access', 'ghost'), grant(OWNER, 'ghost')));
    await assertFails(setDoc(doc(db, 'whatsapp_comp_access', ALICE), grant(OWNER, ALICE, { note: 'x'.repeat(201) })));
  });

  it('usuario le so a propria cortesia, nao lista nem altera', async () => {
    await seed((db) => Promise.all([
      setDoc(doc(db, 'whatsapp_comp_access', ALICE), { uid: ALICE, status: 'active', granted_by: OWNER, granted_at: NOW }),
      setDoc(doc(db, 'whatsapp_comp_access', BOB), { uid: BOB, status: 'active', granted_by: OWNER, granted_at: NOW })
    ]));
    await assertSucceeds(getDoc(doc(dbFor(ALICE), 'whatsapp_comp_access', ALICE)));
    await assertFails(getDoc(doc(dbFor(ALICE), 'whatsapp_comp_access', BOB)));
    await assertFails(getDocs(collection(dbFor(ALICE), 'whatsapp_comp_access')));
    await assertFails(updateDoc(doc(dbFor(ALICE), 'whatsapp_comp_access', ALICE), { status: 'revoked', revoked_by: ALICE, revoked_at: serverTimestamp() }));
    await assertFails(deleteDoc(doc(dbFor(ALICE), 'whatsapp_comp_access', ALICE)));
    await assertFails(deleteDoc(doc(dbFor(OWNER), 'whatsapp_comp_access', ALICE)));
  });
});

describe('Firestore Rules - assinatura (Stripe)', () => {
  it('so o servidor grava; o usuario le apenas a propria', async () => {
    await seed((db) => Promise.all([
      setDoc(doc(db, 'billing_subscriptions', ALICE), { uid: ALICE, status: 'trialing' }),
      setDoc(doc(db, 'billing_subscriptions', BOB), { uid: BOB, status: 'active' })
    ]));
    const access = await createWhatsAppAccessService(dbFor(ALICE)).getMyAccess(ALICE);
    expect(access).toMatchObject({ allowed: true, source: 'stripe', status: 'trialing' });
    await assertFails(getDoc(doc(dbFor(ALICE), 'billing_subscriptions', BOB)));
    await assertFails(setDoc(doc(dbFor(ALICE), 'billing_subscriptions', ALICE), { uid: ALICE, status: 'active' }));
    await assertFails(setDoc(doc(dbFor(OWNER), 'billing_subscriptions', BOB), { uid: BOB, status: 'active' }));
    await assertFails(getDocs(collection(dbFor(OWNER), 'billing_subscriptions')));
  });

  it('sem cortesia e sem assinatura o Dashboard mostra sem acesso', async () => {
    const access = await createWhatsAppAccessService(dbFor(BOB)).getMyAccess(BOB);
    expect(access).toMatchObject({ allowed: false, source: 'none' });
  });
});
