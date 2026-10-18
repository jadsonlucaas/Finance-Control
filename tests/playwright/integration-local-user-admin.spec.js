import { expect, test } from '@playwright/test';
import {
  assertFails,
  initializeTestEnvironment
} from '@firebase/rules-unit-testing';
import { initializeApp, deleteApp } from 'firebase/app';
import {
  connectAuthEmulator,
  createUserWithEmailAndPassword,
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
import { readFileSync } from 'node:fs';

const PROJECT_ID = 'demo-finance-control-local-e2e';
const AUTH_EMULATOR_URL = 'http://127.0.0.1:9099';
const FIRESTORE_HOST = '127.0.0.1';
const FIRESTORE_PORT = 8080;
const PASSWORD = 'Senha-forte-123';
const NOW = '2026-09-19T00:00:00.000Z';
const SECRET_FINANCIAL_DESCRIPTION = `Financeiro privado admin ${Date.now()}`;

let testEnv;
let setupApp;
let setupAuth;

function emailFor(label) {
  return `${label}-${Date.now()}-${Math.random().toString(16).slice(2)}@example.test`;
}

function profile(account, overrides = {}) {
  return {
    uid: account.uid,
    email: account.email,
    name: account.name || account.email.split('@')[0],
    role: 'user',
    status: 'active',
    created_at: NOW,
    updated_at: NOW,
    last_login_at: NOW,
    ...overrides
  };
}

function syntheticProfile(index, overrides = {}) {
  const uid = `admin-e2e-user-${String(index).padStart(3, '0')}`;
  return {
    uid,
    email: `${uid}@example.test`,
    name: `Usuario Admin E2E ${String(index).padStart(3, '0')}`,
    role: index % 9 === 0 ? 'admin' : index % 13 === 0 ? 'owner' : 'user',
    status: ['active', 'pending', 'inactive', 'active'][index % 4],
    created_at: NOW,
    updated_at: NOW,
    last_login_at: NOW,
    ...overrides
  };
}

function privateFinanceRecord(account) {
  return {
    type: 'saida',
    person: 'Pessoa Privada',
    description: SECRET_FINANCIAL_DESCRIPTION,
    amount: 321.45,
    status: 'Em aberto',
    competence: '2026-09',
    owner_uid: account.uid,
    owner_email: account.email,
    created_at: NOW,
    updated_at: NOW,
    schema_version: 1
  };
}

async function clearAuthEmulator() {
  await fetch(`${AUTH_EMULATOR_URL}/emulator/v1/projects/${PROJECT_ID}/accounts`, {
    method: 'DELETE'
  }).catch(() => {});
}

async function createAccount(label, overrides = {}) {
  const email = emailFor(label);
  const credential = await createUserWithEmailAndPassword(setupAuth, email, PASSWORD);
  const account = { uid: credential.user.uid, email, password: PASSWORD };
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'users', account.uid), profile(account, overrides));
  });
  return account;
}

async function seedProfile(record) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'users', record.uid), record);
  });
  return record;
}

async function seedAdminDataset({ targetForFinancialLeak } = {}) {
  const profiles = [];
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    for (let index = 0; index < 68; index += 1) {
      const record = syntheticProfile(index);
      profiles.push(record);
      await setDoc(doc(db, 'users', record.uid), record);
    }
    if (targetForFinancialLeak) {
      await setDoc(
        doc(db, 'users', targetForFinancialLeak.uid, 'finance_records', 'private-financial-record'),
        privateFinanceRecord(targetForFinancialLeak)
      );
    }
  });
  return profiles;
}

async function readUserProfile(uid) {
  let output = null;
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const snapshot = await getDoc(doc(context.firestore(), 'users', uid));
    output = snapshot.exists() ? { uid: snapshot.id, ...snapshot.data() } : null;
  });
  return output;
}

function dbFor(uid) {
  return testEnv.authenticatedContext(uid, { email: `${uid}@example.test` }).firestore();
}

async function signIn(page, account) {
  await page.locator('#auth-email').fill(account.email);
  await page.locator('#auth-password').fill(account.password);
  await page.locator('#auth-submit').click();
  await expect(page.locator('#app')).toBeVisible();
  await expect(page.locator('#auth-screen')).toBeHidden();
}

async function signInBlocked(page, account, statusLabel) {
  await page.locator('#auth-email').fill(account.email);
  await page.locator('#auth-password').fill(account.password);
  await page.locator('#auth-submit').click();
  await expect(page.locator('#app')).toBeHidden();
  await expect(page.locator('#auth-screen')).toBeVisible();
  await expect(page.locator('#account-access-notice')).toBeVisible();
  await expect(page.locator('#account-access-title')).toContainText(statusLabel);
}

async function signOutUi(page) {
  await page.locator('#btn-logout').click();
  await expect(page.locator('#auth-screen')).toBeVisible();
  await expect(page.locator('#app')).toBeHidden();
}

async function forceSignOut(page) {
  await page.evaluate(() => window.authSdk?.signOut?.());
  await expect(page.locator('#auth-screen')).toBeVisible();
  await expect(page.locator('#app')).toBeHidden();
}

async function openSettings(page) {
  await page.evaluate(async () => {
    window.switchTab('configuracoes');
    document.getElementById('view-configuracoes')?.classList.remove('hidden');
  });
  await page.waitForFunction(() => window.renderConfiguracoes?.__financeModernSettings === true);
  await page.evaluate(() => window.renderConfiguracoes());
  await expect(page.locator('#view-configuracoes')).toBeVisible();
}

async function openSettingsAsAdmin(page) {
  await openSettings(page);
  await page.waitForFunction(() => window.refreshManagedUsers?.__financeModernUserAdmin === true);
  await page.evaluate(() => window.refreshManagedUsers());
  await expect(page.locator('#admin-users-panel')).toBeVisible();
  await expect(page.locator('[data-admin-user-row]').first()).toBeVisible();
}

async function rowIds(page) {
  return page.locator('[data-admin-user-row]').evaluateAll((rows) =>
    rows.map((row) => row.getAttribute('data-admin-user-row')).filter(Boolean)
  );
}

async function currentUserAdminState(page) {
  return page.evaluate(() => {
    const model = window.financeApp?.settingsActiveUi?.userAdmin?.controller?.getState?.()?.model
      || window.financeApp?.settingsActiveUi?.controller?.getState?.()?.model
      || null;
    return {
      isCurrentUserAdmin: window.isCurrentUserAdmin?.() === true,
      claims: window.financeApp?.authContext?.claims || {},
      hasCustomClaimsSetter: Object.keys(window).some((key) => /custom.*claim|setCustomUserClaims/i.test(key)),
      adminPanelVisible: !document.getElementById('admin-users-panel')?.classList.contains('hidden'),
      visibleRows: document.querySelectorAll('[data-admin-user-row]').length,
      canReadModel: model?.canRead === true
    };
  });
}

async function attemptedUserAdminUpdate(page, uid, payload) {
  return page.evaluate(async ({ targetUid, patch }) => {
    try {
      await window.userAdminSdk.updateUser(targetUid, patch);
      return { ok: true };
    } catch (error) {
      return { ok: false, message: String(error?.message || error) };
    }
  }, { targetUid: uid, patch: payload });
}

test.beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync('firestore.rules', 'utf8'),
      host: FIRESTORE_HOST,
      port: FIRESTORE_PORT
    }
  });
});

test.beforeEach(async () => {
  await testEnv.clearFirestore();
  await clearAuthEmulator();
  setupApp = initializeApp({
    apiKey: 'demo-key',
    authDomain: `${PROJECT_ID}.firebaseapp.com`,
    projectId: PROJECT_ID
  }, `e2e-local-user-admin-${Date.now()}-${Math.random()}`);
  setupAuth = getAuth(setupApp);
  connectAuthEmulator(setupAuth, AUTH_EMULATOR_URL, { disableWarnings: true });
  const setupDb = getFirestore(setupApp);
  connectFirestoreEmulator(setupDb, FIRESTORE_HOST, FIRESTORE_PORT);
});

test.afterEach(async () => {
  await signOut(setupAuth).catch(() => {});
  await deleteApp(setupApp).catch(() => {});
  await clearAuthEmulator();
});

test.afterAll(async () => {
  await testEnv.cleanup();
});

test('common, pending and inactive users cannot reach user administration or escalate privilege', async ({ page }) => {
  const common = await createAccount('admin-common');
  const pending = await createAccount('admin-pending', { status: 'pending' });
  const inactive = await createAccount('admin-inactive', { status: 'inactive' });
  const target = await seedProfile(syntheticProfile(901, { status: 'pending', role: 'user' }));
  const targetBefore = await readUserProfile(target.uid);

  await page.goto('/', { waitUntil: 'load' });
  await page.waitForFunction(() => window.__financeFirestoreDb && window.authSdk && window.userAdminSdk);

  await signIn(page, common);
  await openSettings(page);
  await expect(page.locator('#admin-users-panel')).toBeHidden();
  expect(await currentUserAdminState(page)).toMatchObject({
    isCurrentUserAdmin: false,
    claims: {},
    hasCustomClaimsSetter: false,
    adminPanelVisible: false,
    visibleRows: 0
  });

  const commonList = await page.evaluate(async () => {
    try {
      await window.userAdminSdk.listUsers({ pageSize: 50, filters: {} });
      return { ok: true };
    } catch (error) {
      return { ok: false, message: String(error?.message || error) };
    }
  });
  expect(commonList.ok).toBe(false);
  expect(await attemptedUserAdminUpdate(page, target.uid, { role: 'admin' })).toMatchObject({ ok: false });
  await assertFails(getDocs(collection(dbFor(common.uid), 'users')));
  await assertFails(updateDoc(doc(dbFor(common.uid), 'users', target.uid), {
    role: 'admin',
    status: 'active',
    updated_at: NOW
  }));

  await signOutUi(page);
  await signInBlocked(page, pending, /Aguardando aprovacao/i);
  expect(await currentUserAdminState(page)).toMatchObject({
    isCurrentUserAdmin: false,
    claims: {},
    hasCustomClaimsSetter: false
  });
  expect(await attemptedUserAdminUpdate(page, target.uid, { status: 'active' })).toMatchObject({ ok: false });
  await assertFails(getDocs(collection(dbFor(pending.uid), 'users')));
  await forceSignOut(page);

  await signInBlocked(page, inactive, /desativado|inativo/i);
  expect(await currentUserAdminState(page)).toMatchObject({
    isCurrentUserAdmin: false,
    claims: {},
    hasCustomClaimsSetter: false
  });
  expect(await attemptedUserAdminUpdate(page, target.uid, { status: 'active' })).toMatchObject({ ok: false });
  await assertFails(getDocs(collection(dbFor(inactive.uid), 'users')));

  expect(await readUserProfile(target.uid)).toMatchObject(targetBefore);
});

test('authorized admin profile lists users with pagination, filters and page-local search without financial leakage', async ({ page }) => {
  const admin = await createAccount('admin-profile', { role: 'admin', status: 'active' });
  const privateTarget = await createAccount('admin-private-target', { role: 'user', status: 'active' });
  const seeded = await seedAdminDataset({ targetForFinancialLeak: privateTarget });
  const profileByUid = new Map([
    ...seeded.map((item) => [item.uid, item]),
    [admin.uid, profile(admin, { role: 'admin', status: 'active' })],
    [privateTarget.uid, profile(privateTarget, { role: 'user', status: 'active' })]
  ]);

  await page.goto('/', { waitUntil: 'load' });
  await page.waitForFunction(() => window.__financeFirestoreDb && window.authSdk && window.userAdminSdk);
  await signIn(page, admin);
  await openSettingsAsAdmin(page);

  const runtime = await currentUserAdminState(page);
  expect(runtime).toMatchObject({
    isCurrentUserAdmin: true,
    claims: {},
    hasCustomClaimsSetter: false,
    adminPanelVisible: true
  });

  const firstPage = await rowIds(page);
  expect(firstPage).toHaveLength(50);
  expect(new Set(firstPage).size).toBe(firstPage.length);
  await expect(page.locator('#admin-users-next')).toBeEnabled();
  await expect(page.locator('#admin-users-prev')).toBeDisabled();

  const selfAdminButton = page.locator(`[data-admin-user-row="${admin.uid}"] [data-managed-user-role="admin"]`);
  if (await selfAdminButton.count()) await expect(selfAdminButton).toBeDisabled();

  await page.locator('#admin-users-next').click();
  await page.waitForFunction((previousFirst) =>
    document.querySelector('[data-admin-user-row]')?.getAttribute('data-admin-user-row') !== previousFirst,
  firstPage[0]);
  const secondPage = await rowIds(page);
  expect(secondPage.length).toBeGreaterThan(0);
  expect(secondPage.some((uid) => firstPage.includes(uid))).toBe(false);
  await expect(page.locator('#admin-users-next')).toBeDisabled();
  await expect(page.locator('#admin-users-prev')).toBeEnabled();

  await page.locator('#admin-users-prev').click();
  await page.waitForFunction((expectedFirst) =>
    document.querySelector('[data-admin-user-row]')?.getAttribute('data-admin-user-row') === expectedFirst,
  firstPage[0]);
  expect(await rowIds(page)).toEqual(firstPage);

  await page.locator('#admin-user-status-filter').selectOption('pending');
  await expect(page.locator('#admin-user-status-filter')).toHaveValue('pending');
  await expect.poll(async () => {
    const ids = await rowIds(page);
    return ids.length > 0 && ids.every((uid) => profileByUid.get(uid)?.status === 'pending');
  }, { timeout: 15000 }).toBe(true);
  const pendingRows = await rowIds(page);
  expect(pendingRows.length).toBeGreaterThan(0);
  expect(pendingRows.every((uid) => profileByUid.get(uid)?.status === 'pending')).toBe(true);
  await expect(page.locator('#admin-users-prev')).toBeDisabled();

  await page.locator('#admin-user-role-filter').selectOption('admin');
  await expect(page.locator('#admin-user-role-filter')).toHaveValue('admin');
  await expect.poll(async () => {
    const ids = await rowIds(page);
    return ids.every((uid) => {
      const item = profileByUid.get(uid);
      return item?.status === 'pending' && item?.role === 'admin';
    });
  }, { timeout: 15000 }).toBe(true);
  const pendingAdminRows = await rowIds(page);
  expect(pendingAdminRows.every((uid) => {
    const item = profileByUid.get(uid);
    return item?.status === 'pending' && item?.role === 'admin';
  })).toBe(true);

  await page.locator('#admin-user-status-filter').selectOption('');
  await page.locator('#admin-user-role-filter').selectOption('');
  await expect(page.locator('#admin-user-status-filter')).toHaveValue('');
  await expect(page.locator('#admin-user-role-filter')).toHaveValue('');
  await expect.poll(async () => (await rowIds(page)).length, { timeout: 15000 }).toBe(50);
  const resetPage = await rowIds(page);
  expect(resetPage).toHaveLength(50);

  const visibleUid = resetPage.find((uid) => profileByUid.get(uid)?.email);
  const hiddenUid = secondPage.find((uid) => profileByUid.get(uid)?.email && !resetPage.includes(uid));
  expect(visibleUid).toBeTruthy();
  expect(hiddenUid).toBeTruthy();
  await page.locator('#admin-user-search').fill(profileByUid.get(visibleUid).email);
  await page.waitForFunction((uid) => {
    const rows = [...document.querySelectorAll('[data-admin-user-row]')].map((row) => row.getAttribute('data-admin-user-row'));
    return rows.length === 1 && rows[0] === uid;
  }, visibleUid);
  await expect(page.locator('#admin-user-search')).toHaveAttribute('title', /página/i);

  await page.locator('#admin-user-search').fill(profileByUid.get(hiddenUid).email);
  await expect(page.locator('[data-admin-user-row]')).toHaveCount(0);
  await expect(page.locator('#admin-users-empty')).toBeVisible();

  await expect(page.locator('body')).not.toContainText(SECRET_FINANCIAL_DESCRIPTION);
  const loadedFinancialOwners = await page.evaluate(() =>
    (window.allRecords || [])
      .filter((record) => record.type === 'saida' && record.description)
      .map((record) => ({ owner_uid: record.owner_uid, description: record.description }))
  );
  expect(loadedFinancialOwners.some((record) => record.owner_uid === privateTarget.uid)).toBe(false);
  expect(loadedFinancialOwners.some((record) => record.description === SECRET_FINANCIAL_DESCRIPTION)).toBe(false);

  const claimsAfterAdminFlow = await page.evaluate(async () => ({
    claims: window.financeApp?.authContext?.claims || {},
    tokenClaims: await window.authSdk.getClaims(true),
    hasCustomClaimsSetter: Object.keys(window).some((key) => /custom.*claim|setCustomUserClaims/i.test(key)),
    importsAdminSdk: [...document.scripts].some((script) => /firebase-admin/i.test(script.src || script.textContent || ''))
  }));
  expect(claimsAfterAdminFlow.hasCustomClaimsSetter).toBe(false);
  expect(claimsAfterAdminFlow.importsAdminSdk).toBe(false);
  expect(claimsAfterAdminFlow.claims).not.toHaveProperty('admin');
  expect(claimsAfterAdminFlow.claims).not.toHaveProperty('role');
  expect(claimsAfterAdminFlow.claims).not.toHaveProperty('status');
  expect(claimsAfterAdminFlow.tokenClaims).not.toHaveProperty('admin');
  expect(claimsAfterAdminFlow.tokenClaims).not.toHaveProperty('role');
  expect(claimsAfterAdminFlow.tokenClaims).not.toHaveProperty('status');
  expect(claimsAfterAdminFlow.tokenClaims.email).toBe(admin.email);
});
