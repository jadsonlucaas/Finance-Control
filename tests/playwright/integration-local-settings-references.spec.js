import { expect, test } from '@playwright/test';
import {
  assertFails,
  assertSucceeds,
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
  setDoc
} from 'firebase/firestore';
import { readFileSync } from 'node:fs';

const PROJECT_ID = 'demo-finance-control-local-e2e';
const AUTH_EMULATOR_URL = 'http://127.0.0.1:9099';
const FIRESTORE_HOST = '127.0.0.1';
const FIRESTORE_PORT = 8080;
const PASSWORD = 'Senha-forte-123';
const NOW = '2026-09-18T00:00:00.000Z';
const PERSON_A = `Pessoa Config A ${Date.now()}`;
const PERSON_B = `Pessoa Config B ${Date.now()}`;
const GLOBAL_MACRO = `Global Config ${Date.now()}`;
const GLOBAL_CATEGORY = `Categoria Global Config ${Date.now()}`;
const FORBIDDEN_GLOBAL = `Global Negada ${Date.now()}`;
const INVALID_MACRO = `Macro Invalida ${Date.now()}`;

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
    role: 'user',
    status: 'active',
    created_at: NOW,
    updated_at: NOW,
    last_login_at: NOW,
    ...overrides
  };
}

function owner(account) {
  return {
    owner_uid: account.uid,
    owner_email: account.email,
    schema_version: 1
  };
}

function personRecord(account, person, overrides = {}) {
  return {
    type: 'pessoa',
    person,
    salary_base: 5000,
    receiving_type: 'mensal',
    created_at: NOW,
    updated_at: NOW,
    ...owner(account),
    ...overrides
  };
}

function personalMacroRecord(account, macro, overrides = {}) {
  return {
    type: 'macro',
    macro_category: macro,
    shared_scope: 'personal',
    created_at: NOW,
    updated_at: NOW,
    ...owner(account),
    ...overrides
  };
}

function sharedMacroRecord(account, macro = GLOBAL_MACRO, overrides = {}) {
  return {
    type: 'macro',
    macro_id: `macro_${macro.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
    macro_category: macro,
    shared_scope: 'global',
    person: '',
    category_name: '',
    category_id: '',
    category_color: '',
    category_icon: '',
    created_at: NOW,
    updated_at: NOW,
    ...owner(account),
    ...overrides
  };
}

function sharedCategoryRecord(account, category = GLOBAL_CATEGORY, overrides = {}) {
  return {
    type: 'categoria',
    category_id: `cat_${category.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
    category_name: category,
    macro_category: GLOBAL_MACRO,
    category_color: '#38bdf8',
    category_icon: 'tag',
    shared_scope: 'global',
    person: '',
    created_at: NOW,
    updated_at: NOW,
    ...owner(account),
    ...overrides
  };
}

async function clearAuthEmulator() {
  await fetch(`${AUTH_EMULATOR_URL}/emulator/v1/projects/${PROJECT_ID}/accounts`, {
    method: 'DELETE'
  }).catch(() => {});
}

async function createActiveAccount(label) {
  const email = emailFor(label);
  const credential = await createUserWithEmailAndPassword(setupAuth, email, PASSWORD);
  const account = { uid: credential.user.uid, email, password: PASSWORD };
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'users', account.uid), profile(account));
  });
  return account;
}

async function seedUserSettings(account, person) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, 'users', account.uid, 'finance_records', 'person-settings'), personRecord(account, person));
    await setDoc(doc(db, 'users', account.uid, 'finance_records', 'macro-personal'), personalMacroRecord(account, `Macro ${person}`));
  });
}

async function seedGlobalReferences(ownerAccount) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, 'shared_macros', 'macro-global-config'), sharedMacroRecord(ownerAccount));
    await setDoc(doc(db, 'shared_categories', 'cat-global-config'), sharedCategoryRecord(ownerAccount));
  });
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

async function openSettings(page) {
  await page.evaluate(async () => {
    window.switchTab('configuracoes');
    document.getElementById('view-configuracoes')?.classList.remove('hidden');
  });
  await page.waitForFunction(() => window.renderConfiguracoes?.__financeModernSettings === true);
  await page.evaluate(() => window.renderConfiguracoes());
  await expect(page.locator('#view-configuracoes')).toBeVisible();
}

async function changeReceivingType(page, personId, value) {
  await page.evaluate(({ personId: targetPersonId, value: nextValue }) => {
    const select = document.querySelector(`#pessoas-list [data-settings-person-id="${targetPersonId}"] [data-settings-action="update-person-receiving-type"]`);
    if (!select) throw new Error(`settings person select not found: ${targetPersonId}`);
    select.value = nextValue;
    select.dispatchEvent(new Event('change', { bubbles: true }));
  }, { personId, value });
}

async function readFinanceRecords(account) {
  let records = [];
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const snapshot = await getDocs(collection(context.firestore(), 'users', account.uid, 'finance_records'));
    records = snapshot.docs.map((recordDoc) => ({ id: recordDoc.id, ...recordDoc.data() }));
  });
  return records;
}

async function readSharedCollections() {
  const output = { macros: [], categories: [] };
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    const macros = await getDocs(collection(db, 'shared_macros'));
    const categories = await getDocs(collection(db, 'shared_categories'));
    output.macros = macros.docs.map((recordDoc) => ({ id: recordDoc.id, ...recordDoc.data() }));
    output.categories = categories.docs.map((recordDoc) => ({ id: recordDoc.id, ...recordDoc.data() }));
  });
  return output;
}

function dbFor(uid) {
  return testEnv.authenticatedContext(uid).firestore();
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
  }, `e2e-local-settings-${Date.now()}-${Math.random()}`);
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

test('personal settings stay owner-scoped across A -> B -> A in the same browser', async ({ page }) => {
  const userA = await createActiveAccount('settings-a');
  const userB = await createActiveAccount('settings-b');
  await seedUserSettings(userA, PERSON_A);
  await seedUserSettings(userB, PERSON_B);
  await seedGlobalReferences(userA);

  await page.goto('/', { waitUntil: 'load' });
  await page.waitForFunction(() => window.__financeFirestoreDb && window.authSdk && window.userAdminSdk);

  await signIn(page, userA);
  await openSettings(page);
  await expect(page.locator('#pessoas-list')).toContainText(PERSON_A);
  await expect(page.locator('#pessoas-list')).not.toContainText(PERSON_B);

  const aPersonId = await page.locator(`[data-settings-person-id]:has-text("${PERSON_A}")`).getAttribute('data-settings-person-id');
  await changeReceivingType(page, aPersonId, 'quinzenal');
  await page.waitForFunction(({ personId }) =>
    (window.allRecords || []).some((record) => record.id === personId && record.receiving_type === 'quinzenal'),
  { personId: aPersonId });
  await page.reload({ waitUntil: 'load' });
  await expect(page.locator('#app')).toBeVisible();
  await openSettings(page);
  await expect(page.locator(`[data-settings-person-id="${aPersonId}"] [data-settings-action="update-person-receiving-type"]`)).toHaveValue('quinzenal');

  let aRecords = await readFinanceRecords(userA);
  expect(aRecords.filter((record) => record.type === 'pessoa' && record.person === PERSON_A)).toHaveLength(1);
  const aPersonAfterFirstEdit = aRecords.find((record) => record.id === aPersonId);
  expect(aPersonAfterFirstEdit).toMatchObject({
    owner_uid: userA.uid,
    owner_email: userA.email,
    receiving_type: 'quinzenal'
  });
  expect(aPersonAfterFirstEdit).not.toHaveProperty('shared_scope');

  await changeReceivingType(page, aPersonId, 'mensal');
  await page.waitForFunction(({ personId }) =>
    (window.allRecords || []).some((record) => record.id === personId && record.receiving_type === 'mensal'),
  { personId: aPersonId });
  aRecords = await readFinanceRecords(userA);
  expect(aRecords.filter((record) => record.type === 'pessoa' && record.person === PERSON_A)).toHaveLength(1);
  expect(aRecords.find((record) => record.id === aPersonId).receiving_type).toBe('mensal');

  await assertFails(getDoc(doc(dbFor(userB.uid), 'users', userA.uid, 'finance_records', aPersonId)));
  await assertFails(setDoc(doc(dbFor(userB.uid), 'users', userA.uid, 'finance_records', 'b-cross-write'), personRecord(userB, 'Cross write')));

  await signOutUi(page);
  await signIn(page, userB);
  await openSettings(page);
  await expect(page.locator('#pessoas-list')).toContainText(PERSON_B);
  await expect(page.locator('#pessoas-list')).not.toContainText(PERSON_A);
  const bPersonId = await page.locator(`[data-settings-person-id]:has-text("${PERSON_B}")`).getAttribute('data-settings-person-id');
  await changeReceivingType(page, bPersonId, 'quinzenal');
  await page.waitForFunction(({ personId }) =>
    (window.allRecords || []).some((record) => record.id === personId && record.receiving_type === 'quinzenal'),
  { personId: bPersonId });

  const bRecords = await readFinanceRecords(userB);
  expect(bRecords.find((record) => record.id === bPersonId)).toMatchObject({
    owner_uid: userB.uid,
    owner_email: userB.email,
    receiving_type: 'quinzenal'
  });

  await signOutUi(page);
  await signIn(page, userA);
  await openSettings(page);
  await expect(page.locator('#pessoas-list')).toContainText(PERSON_A);
  await expect(page.locator('#pessoas-list')).not.toContainText(PERSON_B);
  const finalARecords = await readFinanceRecords(userA);
  expect(finalARecords.find((record) => record.id === aPersonId).receiving_type).toBe('mensal');
});

test('global references are read-only for common users and manipulated global writes do not fallback to personal', async ({ page }) => {
  const userA = await createActiveAccount('settings-global-a');
  const userB = await createActiveAccount('settings-global-b');
  await seedUserSettings(userA, PERSON_A);
  await seedUserSettings(userB, PERSON_B);
  await seedGlobalReferences(userA);
  const beforeShared = await readSharedCollections();

  await page.goto('/', { waitUntil: 'load' });
  await page.waitForFunction(() => window.__financeFirestoreDb && window.authSdk && window.userAdminSdk);

  await signIn(page, userA);
  await openSettings(page);
  await expect(page.locator('#macro-list')).toContainText(GLOBAL_MACRO);
  await expect(page.locator('#categories-list')).toContainText(GLOBAL_CATEGORY);
  await expect(page.locator(`[data-settings-macro-id="macro-global-config"]`)).toContainText('Global');
  await expect(page.locator(`[data-settings-category-id="cat-global-config"]`)).toContainText('Global');
  await expect(page.locator(`[data-settings-category-id="cat-global-config"] [data-open-edit-category]`)).toHaveCount(0);

  const runtimeClaims = await page.evaluate(() => ({
    hasCustomClaimsSetter: Object.keys(window).some((key) => /custom.*claim|setCustomUserClaims/i.test(key)),
    currentClaims: window.financeApp?.authContext?.claims || window.currentAuthClaims || {},
    canManageShared: window.financeApp?.settingsActiveUi?.controller?.getState?.()?.model?.permissions?.canManageSharedReferences === true
  }));
  expect(runtimeClaims).toMatchObject({
    hasCustomClaimsSetter: false,
    currentClaims: {},
    canManageShared: false
  });

  await page.locator('#btn-add-macro').click();
  await page.locator('#macro-input').fill(FORBIDDEN_GLOBAL);
  await page.evaluate(() => {
    const scope = document.getElementById('macro-scope');
    scope.disabled = false;
    scope.innerHTML = '<option value="global">Global</option>';
    scope.value = 'global';
  });
  await page.locator('#btn-save-macro').click();
  await expect(page.locator('#add-macro-modal')).toBeVisible();
  await page.waitForTimeout(250);
  await expect(page.locator('#macro-list')).not.toContainText(FORBIDDEN_GLOBAL);

  const aRecordsAfterForbidden = await readFinanceRecords(userA);
  const sharedAfterForbidden = await readSharedCollections();
  expect(aRecordsAfterForbidden.some((record) => record.macro_category === FORBIDDEN_GLOBAL)).toBe(false);
  expect(sharedAfterForbidden).toEqual(beforeShared);
  await assertFails(setDoc(doc(dbFor(userA.uid), 'shared_macros', 'macro-forbidden-direct'), sharedMacroRecord(userA, FORBIDDEN_GLOBAL)));

  await page.locator('#macro-input').fill('');
  const invalidResult = await page.evaluate(() => window.saveMacroCategory());
  expect(invalidResult).toMatchObject({ success: false, code: 'SETTINGS_MACRO_NAME_REQUIRED' });
  await expect(page.locator('#add-macro-modal')).toBeVisible();
  await page.waitForTimeout(250);
  const recordsAfterInvalid = await readFinanceRecords(userA);
  expect(recordsAfterInvalid.some((record) => record.macro_category === INVALID_MACRO || record.macro_category === '')).toBe(false);
  await page.locator('#btn-close-add-macro-modal').click();
  await expect(page.locator('#add-macro-modal')).toBeHidden();

  await signOutUi(page);
  await signIn(page, userB);
  await openSettings(page);
  await expect(page.locator('#macro-list')).toContainText(GLOBAL_MACRO);
  await expect(page.locator('#categories-list')).toContainText(GLOBAL_CATEGORY);
  await expect(page.locator('#macro-list')).not.toContainText(FORBIDDEN_GLOBAL);
  const bRecords = await readFinanceRecords(userB);
  expect(bRecords.some((record) => record.macro_category === GLOBAL_MACRO && record.shared_scope === 'personal')).toBe(false);
  expect(bRecords.some((record) => record.category_name === GLOBAL_CATEGORY && record.shared_scope === 'personal')).toBe(false);
  expect(await readSharedCollections()).toEqual(beforeShared);
});
