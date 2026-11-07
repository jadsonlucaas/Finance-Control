import { readFileSync } from 'node:fs';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment
} from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

// Campos protegidos do perfil users/{uid}: o dono so altera metadados de login.

const PROJECT_ID = 'finance-control-profile-rules-test';
const NOW = '2026-11-06T12:00:00.000Z';

let testEnv;

function profile(uid, overrides = {}) {
  return {
    uid,
    email: `${uid}@example.test`,
    role: 'user',
    status: 'active',
    created_at: NOW,
    updated_at: NOW,
    last_login_at: NOW,
    ...overrides
  };
}

function dbFor(uid, token = {}) {
  return testEnv.authenticatedContext(uid, { email: `${uid}@example.test`, ...token }).firestore();
}

async function seed(path, data) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), path), data);
  });
}

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: readFileSync('firestore.rules', 'utf8') }
  });
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await seed('users/active-user', profile('active-user'));
  await seed('users/pending-user', profile('pending-user', { status: 'pending' }));
  await seed('users/admin-user', profile('admin-user', { role: 'admin' }));
});

afterAll(async () => {
  await testEnv.cleanup();
});

describe('Perfil: criacao', () => {
  it('cria perfil inicial com email igual ao token Auth', async () => {
    await assertSucceeds(setDoc(doc(dbFor('new-user'), 'users/new-user'), profile('new-user', { status: 'active' })));
  });

  it('recusa email divergente do token ou com HTML', async () => {
    const db = dbFor('new-user');
    await assertFails(setDoc(doc(db, 'users/new-user'), profile('new-user', { status: 'active', email: 'outra@example.test' })));
    await assertFails(setDoc(doc(db, 'users/new-user'), profile('new-user', {
      status: 'active',
      email: '<img src=x onerror=alert(1)>'
    })));
  });

  it('recusa criacao quando o token nao tem email', async () => {
    const db = testEnv.authenticatedContext('no-email-user', {}).firestore();
    await assertFails(setDoc(doc(db, 'users/no-email-user'), profile('no-email-user', { status: 'active' })));
  });
});

describe('Perfil: atualizacao pelo dono', () => {
  it('atualiza metadados de login como o app faz hoje', async () => {
    const db = dbFor('active-user');
    await assertSucceeds(setDoc(doc(db, 'users/active-user'), { last_login_at: NOW }, { merge: true }));
    await assertSucceeds(updateDoc(doc(db, 'users/active-user'), { updated_at: NOW, last_login_at: NOW }));
  });

  it('nao grava campos de plano, assinatura ou vinculo', async () => {
    const db = dbFor('active-user');
    for (const field of [
      { plan: 'premium' },
      { subscription_status: 'active' },
      { stripe_customer_id: 'cus_123' },
      { whatsapp: { verificado: true, ativo: true } }
    ]) {
      await assertFails(updateDoc(doc(db, 'users/active-user'), { ...field, updated_at: NOW }));
    }
  });

  it('nao altera papel, status, email nem uid', async () => {
    const db = dbFor('active-user');
    await assertFails(updateDoc(doc(db, 'users/active-user'), { role: 'admin', updated_at: NOW }));
    await assertFails(updateDoc(doc(db, 'users/active-user'), { status: 'inactive', updated_at: NOW }));
    await assertFails(updateDoc(doc(db, 'users/active-user'), { email: 'novo@example.test', updated_at: NOW }));
    await assertFails(updateDoc(doc(db, 'users/active-user'), { uid: 'outro', updated_at: NOW }));
  });

  it('conta pending tambem nao se promove', async () => {
    const db = dbFor('pending-user');
    await assertFails(updateDoc(doc(db, 'users/pending-user'), { status: 'active', updated_at: NOW }));
    await assertFails(updateDoc(doc(db, 'users/pending-user'), { plan: 'premium', updated_at: NOW }));
  });

  it('nao altera perfil de outro usuario', async () => {
    await assertFails(updateDoc(doc(dbFor('active-user'), 'users/pending-user'), { last_login_at: NOW, updated_at: NOW }));
  });
});

describe('Perfil: administracao preservada', () => {
  it('admin continua aprovando conta pending', async () => {
    await assertSucceeds(updateDoc(doc(dbFor('admin-user'), 'users/pending-user'), { status: 'active', updated_at: NOW }));
  });
});
