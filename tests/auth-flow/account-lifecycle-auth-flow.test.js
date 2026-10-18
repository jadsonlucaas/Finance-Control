import { readFileSync } from 'node:fs';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment
} from '@firebase/rules-unit-testing';
import { initializeApp, deleteApp } from 'firebase/app';
import {
  createUserWithEmailAndPassword,
  connectAuthEmulator,
  getAuth,
  signOut
} from 'firebase/auth';
import {
  collection,
  connectFirestoreEmulator,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  setDoc,
  updateDoc
} from 'firebase/firestore';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { getUserAccessState } from '../../src/domain/accountLifecycle.js';
import { createUserAdminService } from '../../src/services/userAdmin.js';

const PROJECT_ID = 'finance-control-auth-flow-test';
const AUTH_EMULATOR_URL = 'http://127.0.0.1:9099';
const NOW = '2026-07-18T00:00:00.000Z';

let testEnv;
let app;
let auth;
let db;

function uniqueId(label) {
  return `${label}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function emailFor(uid) {
  return `${uid}@example.test`;
}

function profile(uid, overrides = {}) {
  return {
    uid,
    email: emailFor(uid),
    role: 'user',
    status: 'active',
    created_at: NOW,
    updated_at: NOW,
    last_login_at: NOW,
    ...overrides
  };
}

function initialProfile(uid, overrides = {}) {
  return profile(uid, {
    status: 'pending',
    ...overrides
  });
}

function financeRecord(uid) {
  return {
    type: 'saida',
    person: 'Pessoa Teste',
    description: 'Despesa auth flow',
    amount: 90,
    status: 'Em aberto',
    competence: '2026-07',
    owner_uid: uid,
    owner_email: emailFor(uid)
  };
}

function ruleDbFor(uid, token = {}) {
  return testEnv.authenticatedContext(uid, {
    email: emailFor(uid),
    ...token
  }).firestore();
}

async function clearAuthEmulator() {
  await fetch(`${AUTH_EMULATOR_URL}/emulator/v1/projects/${PROJECT_ID}/accounts`, {
    method: 'DELETE'
  }).catch(() => {});
}

async function createAuthUser(label = 'user') {
  const uid = uniqueId(label);
  const credential = await createUserWithEmailAndPassword(auth, emailFor(uid), 'Senha-forte-123');
  return {
    uid: credential.user.uid,
    email: credential.user.email,
    user: credential.user
  };
}

async function seed(path, data) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), path), data);
  });
}

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync('firestore.rules', 'utf8'),
      host: '127.0.0.1',
      port: 8080
    }
  });
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await clearAuthEmulator();
  app = initializeApp({
    apiKey: 'demo-key',
    authDomain: `${PROJECT_ID}.firebaseapp.com`,
    projectId: PROJECT_ID
  }, `auth-flow-${Date.now()}-${Math.random()}`);
  auth = getAuth(app);
  connectAuthEmulator(auth, AUTH_EMULATOR_URL, { disableWarnings: true });
  db = getFirestore(app);
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
});

afterEach(async () => {
  await signOut(auth).catch(() => {});
  await deleteApp(app);
});

afterAll(async () => {
  await testEnv.cleanup();
  await clearAuthEmulator();
});

describe('Auth + Firestore Emulator - ciclo de aprovacao de contas', () => {
  it('01 signup cria usuario no Auth Emulator', async () => {
    const created = await createAuthUser('signup');

    expect(created.uid).toBeTruthy();
    expect(created.email).toContain('@example.test');
  });

  it('02 cria perfil inicial user pending', async () => {
    const created = await createAuthUser('initial-profile');
    const service = createUserAdminService(db, { logLater: vi.fn() });

    const createdProfile = await service.ensureProfile(created.user);

    expect(createdProfile).toMatchObject({
      uid: created.uid,
      email: created.email,
      role: 'user',
      status: 'pending'
    });
  });

  it('03 cliente nao consegue criar perfil active', async () => {
    const created = await createAuthUser('no-active');

    await assertFails(setDoc(doc(db, 'users', created.uid), profile(created.uid, {
      email: created.email,
      status: 'active'
    })));
  });

  it('04 cliente nao consegue criar perfil admin', async () => {
    const created = await createAuthUser('no-admin');

    await assertFails(setDoc(doc(db, 'users', created.uid), initialProfile(created.uid, {
      email: created.email,
      role: 'admin'
    })));
  });

  it('05 cliente nao consegue criar perfil owner', async () => {
    const created = await createAuthUser('no-owner');

    await assertFails(setDoc(doc(db, 'users', created.uid), initialProfile(created.uid, {
      email: created.email,
      role: 'owner'
    })));
  });

  it('06 conta active existente permanece active apos ensureProfile', async () => {
    const created = await createAuthUser('existing-active');
    await seed(`users/${created.uid}`, profile(created.uid, {
      email: created.email,
      status: 'active'
    }));
    const service = createUserAdminService(db, { logLater: vi.fn() });

    const existing = await service.ensureProfile(created.user);

    expect(existing.status).toBe('active');
  });

  it('07 usuario autenticado sem perfil recebe estado de acesso pending', async () => {
    const created = await createAuthUser('no-profile');
    const service = createUserAdminService(db, { logLater: vi.fn() });

    expect(await service.getProfile(created.uid)).toBeNull();
    expect(getUserAccessState(null)).toMatchObject({
      status: 'pending',
      canAccessFinancialData: false
    });
  });

  it('08 pending nao acessa finance_records', async () => {
    const created = await createAuthUser('pending-blocked');
    await seed(`users/${created.uid}`, initialProfile(created.uid, { email: created.email }));
    await seed(`users/${created.uid}/finance_records/private-record`, financeRecord(created.uid));

    await assertFails(getDoc(doc(db, `users/${created.uid}/finance_records/private-record`)));
  });

  it('09 admin por claim aprova pending', async () => {
    const target = uniqueId('pending-target');
    await seed(`users/${target}`, initialProfile(target));
    const adminDb = ruleDbFor(uniqueId('claim-admin'), { admin: true });

    await assertSucceeds(updateDoc(doc(adminDb, 'users', target), {
      role: 'user',
      status: 'active',
      updated_at: '2026-07-18T01:00:00.000Z'
    }));
  });

  it('10 aprovacao mantem role user', async () => {
    const target = uniqueId('approval-role');
    await seed(`users/${target}`, initialProfile(target));
    const adminDb = ruleDbFor(uniqueId('claim-admin'), { admin: true });

    await updateDoc(doc(adminDb, 'users', target), {
      role: 'user',
      status: 'active',
      updated_at: '2026-07-18T01:00:00.000Z'
    });
    const snapshot = await getDoc(doc(adminDb, 'users', target));

    expect(snapshot.data().role).toBe('user');
  });

  it('11 usuario aprovado acessa finance_records', async () => {
    const created = await createAuthUser('approved-access');
    await seed(`users/${created.uid}`, profile(created.uid, { email: created.email }));

    await assertSucceeds(setDoc(doc(db, `users/${created.uid}/finance_records/new-record`), financeRecord(created.uid)));
  });

  it('12 admin desativa active', async () => {
    const target = uniqueId('active-target');
    await seed(`users/${target}`, profile(target));
    const adminDb = ruleDbFor(uniqueId('claim-admin'), { admin: true });

    await assertSucceeds(updateDoc(doc(adminDb, 'users', target), {
      role: 'user',
      status: 'inactive',
      updated_at: '2026-07-18T01:00:00.000Z'
    }));
  });

  it('13 inactive perde acesso imediatamente', async () => {
    const created = await createAuthUser('inactive-now');
    await seed(`users/${created.uid}`, profile(created.uid, {
      email: created.email,
      status: 'inactive'
    }));
    await seed(`users/${created.uid}/finance_records/private-record`, financeRecord(created.uid));

    await assertFails(getDoc(doc(db, `users/${created.uid}/finance_records/private-record`)));
  });

  it('14 admin reativa inactive', async () => {
    const target = uniqueId('inactive-target');
    await seed(`users/${target}`, profile(target, { status: 'inactive' }));
    const adminDb = ruleDbFor(uniqueId('claim-admin'), { admin: true });

    await assertSucceeds(updateDoc(doc(adminDb, 'users', target), {
      role: 'user',
      status: 'active',
      updated_at: '2026-07-18T01:00:00.000Z'
    }));
  });

  it('15 reativado recupera acesso', async () => {
    const created = await createAuthUser('reactivated-access');
    await seed(`users/${created.uid}`, profile(created.uid, {
      email: created.email,
      status: 'active'
    }));

    await assertSucceeds(setDoc(doc(db, `users/${created.uid}/finance_records/restored-record`), financeRecord(created.uid)));
  });

  it('16 usuario comum nao altera status', async () => {
    const created = await createAuthUser('no-status-change');
    await seed(`users/${created.uid}`, profile(created.uid, { email: created.email }));

    await assertFails(updateDoc(doc(db, 'users', created.uid), {
      ...profile(created.uid, { email: created.email }),
      status: 'inactive',
      updated_at: '2026-07-18T01:00:00.000Z'
    }));
  });

  it('17 usuario comum nao altera role', async () => {
    const created = await createAuthUser('no-role-change');
    await seed(`users/${created.uid}`, profile(created.uid, { email: created.email }));

    await assertFails(updateDoc(doc(db, 'users', created.uid), {
      ...profile(created.uid, { email: created.email }),
      role: 'admin',
      updated_at: '2026-07-18T01:00:00.000Z'
    }));
  });

  it('18 admin por claim sem perfil aprova e recupera conta', async () => {
    const target = uniqueId('claim-recovery-target');
    await seed(`users/${target}`, profile(target, { status: 'inactive' }));
    const adminDb = ruleDbFor(uniqueId('claim-admin-no-profile'), { admin: true });

    await assertSucceeds(getDocs(collection(adminDb, 'users')));
    await assertSucceeds(updateDoc(doc(adminDb, 'users', target), {
      role: 'user',
      status: 'active',
      updated_at: '2026-07-18T01:00:00.000Z'
    }));
  });

  it('19 role admin active administra', async () => {
    const adminUid = uniqueId('profile-admin');
    const target = uniqueId('profile-admin-target');
    await seed(`users/${adminUid}`, profile(adminUid, { role: 'admin' }));
    await seed(`users/${target}`, initialProfile(target));
    const adminDb = ruleDbFor(adminUid);

    await assertSucceeds(updateDoc(doc(adminDb, 'users', target), {
      role: 'user',
      status: 'active',
      updated_at: '2026-07-18T01:00:00.000Z'
    }));
  });

  it('20 role admin inactive nao administra', async () => {
    const adminUid = uniqueId('inactive-profile-admin');
    const target = uniqueId('inactive-profile-admin-target');
    await seed(`users/${adminUid}`, profile(adminUid, { role: 'admin', status: 'inactive' }));
    await seed(`users/${target}`, initialProfile(target));
    const adminDb = ruleDbFor(adminUid);

    await assertFails(updateDoc(doc(adminDb, 'users', target), {
      role: 'user',
      status: 'active',
      updated_at: '2026-07-18T01:00:00.000Z'
    }));
  });
});
