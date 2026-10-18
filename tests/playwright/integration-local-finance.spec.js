import { expect, test } from '@playwright/test';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
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
  getDocs,
  getFirestore,
  setDoc
} from 'firebase/firestore';
import { readFileSync } from 'node:fs';

const PROJECT_ID = 'demo-finance-control-local-e2e';
const AUTH_EMULATOR_URL = 'http://127.0.0.1:9099';
const FIRESTORE_HOST = '127.0.0.1';
const FIRESTORE_PORT = 8080;
const PASSWORD = 'Senha-forte-123';
const COMPETENCE = '2026-09';
const DUE_DATE = '2026-09-10';
const PERSON = 'Jadson';
const DESCRIPTION = `E2E saida emulator ${Date.now()}`;
const AMOUNT = 123.45;

let testEnv;
let setupApp;
let setupAuth;

function emailFor(label) {
  return `${label}-${Date.now()}-${Math.random().toString(16).slice(2)}@example.test`;
}

async function clearAuthEmulator() {
  await fetch(`${AUTH_EMULATOR_URL}/emulator/v1/projects/${PROJECT_ID}/accounts`, {
    method: 'DELETE'
  }).catch(() => {});
}

async function createActiveAccount(label) {
  const email = emailFor(label);
  const credential = await createUserWithEmailAndPassword(setupAuth, email, PASSWORD);
  const profile = {
    uid: credential.user.uid,
    email,
    role: 'user',
    status: 'active',
    created_at: '2026-09-12T00:00:00.000Z',
    updated_at: '2026-09-12T00:00:00.000Z',
    last_login_at: '2026-09-12T00:00:00.000Z'
  };
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'users', credential.user.uid), profile);
    const recordsPath = ['users', credential.user.uid, 'finance_records'];
    await setDoc(doc(context.firestore(), ...recordsPath, 'reference-person-jadson'), {
      type: 'pessoa',
      person: PERSON,
      salary_base: 5000,
      receiving_type: 'mensal',
      created_at: '2026-09-12T00:00:00.000Z',
      owner_uid: credential.user.uid,
      owner_email: email
    });
    await setDoc(doc(context.firestore(), ...recordsPath, 'reference-macro-fixo'), {
      type: 'macro',
      macro_category: 'FIXO',
      shared_scope: 'personal',
      created_at: '2026-09-12T00:00:00.000Z',
      owner_uid: credential.user.uid,
      owner_email: email
    });
    await setDoc(doc(context.firestore(), ...recordsPath, 'reference-category-moradia'), {
      type: 'categoria',
      macro_category: 'FIXO',
      category_name: 'Moradia E2E',
      category_color: '#38bdf8',
      category_icon: 'home',
      shared_scope: 'personal',
      created_at: '2026-09-12T00:00:00.000Z',
      owner_uid: credential.user.uid,
      owner_email: email
    });
  });
  return { uid: credential.user.uid, email, password: PASSWORD };
}

async function signIn(page, account) {
  await page.locator('#auth-email').fill(account.email);
  await page.locator('#auth-password').fill(account.password);
  await page.locator('#auth-submit').click();
  await expect(page.locator('#app')).toBeVisible();
  await expect(page.locator('#auth-screen')).toBeHidden();
}

async function signOutUi(page) {
  await page.locator('#btn-logout').click();
  await expect(page.locator('#auth-screen')).toBeVisible();
  await expect(page.locator('#app')).toBeHidden();
}

async function currentRecords(page) {
  return page.evaluate(() => (window.allRecords || []).map((record) => ({
    id: record.id,
    type: record.type,
    person: record.person,
    description: record.description,
    amount: record.amount,
    competence: record.competence,
    owner_uid: record.owner_uid,
    owner_email: record.owner_email,
    macro_category: record.macro_category,
    subcategory: record.subcategory,
    status: record.status
  })));
}

async function setDashboardFilter(page) {
  await page.locator('#f-comp-start').fill(COMPETENCE);
  await page.locator('#f-comp-end').fill(COMPETENCE);
  await page.locator('#btn-advanced-filters').click();
  await page.locator('#f-person').selectOption(PERSON);
}

async function countPersistedExpenses(uid) {
  let records = [];
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const snapshot = await getDocs(collection(context.firestore(), 'users', uid, 'finance_records'));
    records = snapshot.docs.map((recordDoc) => ({ id: recordDoc.id, ...recordDoc.data() }));
  });
  return records.filter((record) => record.type === 'saida' && record.description === DESCRIPTION);
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
  }, `e2e-local-${Date.now()}-${Math.random()}`);
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

test('active users keep expense persistence isolated across A -> B -> A in one browser context', async ({ page }) => {
  const userA = await createActiveAccount('user-a');
  const userB = await createActiveAccount('user-b');

  await page.clock.setFixedTime(new Date('2026-09-20T12:00:00.000Z'));
  await page.goto('/', { waitUntil: 'load' });
  await page.waitForFunction(() => window.__financeFirestoreDb && window.authSdk && window.userAdminSdk);
  const runtime = await page.evaluate(() => ({
    projectId: window.__financeFirestoreDb?.app?.options?.projectId,
    hasFinanceUiGlobal: Object.prototype.hasOwnProperty.call(window, 'financeUI')
  }));
  expect(runtime.projectId).toBe(PROJECT_ID);
  expect(runtime.hasFinanceUiGlobal).toBe(false);

  await signIn(page, userA);
  await page.waitForFunction(() => window.__financeCacheState?.uid && window.__financeCacheState.source === 'firebase');

  await page.locator('#btn-new-record-header').click();
  await expect(page.locator('#view-novo')).toBeVisible();
  await page.locator('#form-person').selectOption(PERSON);
  await page.locator('#form-macro').selectOption('FIXO');
  await page.locator('#form-category').fill('Moradia E2E');
  await page.locator('#form-desc').fill(DESCRIPTION);
  await page.locator('#form-amount').fill(String(AMOUNT));
  await page.locator('#form-status').selectOption('Pago');
  await page.locator('#form-payment').fill('Pix E2E');
  await page.locator('#form-occurred').fill(DUE_DATE);
  await page.locator('#form-due').fill(DUE_DATE);
  await page.locator('#form-paid-at').fill(DUE_DATE);
  await page.locator('#form-competence').fill(COMPETENCE);
  await page.locator('#cycle-saida-inicio-mes').click();
  await page.locator('#btn-submit').click();

  await expect(page.locator('#toast')).toContainText(/Sa.da salva/i);
  await page.waitForFunction((description) =>
    (window.allRecords || []).filter((record) => record.type === 'saida' && record.description === description).length === 1,
  DESCRIPTION);

  const recordsAfterSave = await currentRecords(page);
  const saved = recordsAfterSave.find((record) => record.description === DESCRIPTION && record.type === 'saida');
  expect(saved).toMatchObject({
    type: 'saida',
    person: PERSON,
    description: DESCRIPTION,
    amount: AMOUNT,
    competence: COMPETENCE,
    owner_uid: userA.uid,
    owner_email: userA.email,
    macro_category: 'FIXO',
    subcategory: 'Moradia E2E',
    status: 'Pago'
  });

  await page.evaluate(() => window.switchTab('saidas'));
  await expect(page.locator('#saidas-list')).toContainText(DESCRIPTION);
  await expect(page.locator('#saidas-list')).toContainText(PERSON);
  await expect(page.locator('#saidas-total')).toContainText('R$ 123,45');

  await page.evaluate(() => window.switchTab('dashboard'));
  await setDashboardFilter(page);
  await expect(page.locator('#summary-cards')).toContainText('R$ 123,45');

  await page.reload({ waitUntil: 'load' });
  await expect(page.locator('#app')).toBeVisible();
  await page.waitForFunction((description) =>
    (window.allRecords || []).filter((record) => record.type === 'saida' && record.description === description).length === 1,
  DESCRIPTION);
  expect(await countPersistedExpenses(userA.uid)).toHaveLength(1);

  await signOutUi(page);
  await signIn(page, userB);
  await page.waitForFunction((description) => !(window.allRecords || []).some((record) => record.description === description), DESCRIPTION);
  await page.evaluate(() => window.switchTab('saidas'));
  await expect(page.locator('#saidas-list')).not.toContainText(DESCRIPTION);
  await page.evaluate(() => window.switchTab('dashboard'));
  await expect(page.locator('#summary-cards')).not.toContainText('R$ 123,45');
  expect(await countPersistedExpenses(userB.uid)).toHaveLength(0);

  await signOutUi(page);
  await signIn(page, userA);
  await page.waitForFunction((description) =>
    (window.allRecords || []).filter((record) => record.type === 'saida' && record.description === description).length === 1,
  DESCRIPTION);
  const persistedForA = await countPersistedExpenses(userA.uid);
  expect(persistedForA).toHaveLength(1);
  await page.evaluate(() => window.switchTab('saidas'));
  await expect(page.locator('#saidas-list')).toContainText(DESCRIPTION);
});
