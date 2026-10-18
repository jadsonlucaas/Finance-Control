import { expect, test } from '@playwright/test';
import { assertFails, initializeTestEnvironment } from '@firebase/rules-unit-testing';
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
const PERSON = 'Jadson';
const MACRO = 'FIXO';
const CATEGORY = 'Moradia E2E';
const PAYMENT_METHOD = 'Pix Recorrencia E2E';
const FIRST_DUE_DATE = '2026-01-31';
const DESCRIPTION = `E2E recorrencia mensal emulator ${Date.now()}`;
const CANCEL_DESCRIPTION = `E2E recorrencia cancelada ${Date.now()}`;
const INVALID_DESCRIPTION = `E2E recorrencia invalida ${Date.now()}`;
const EXPECTED_RECURRENCES = [
  { recurrence_sequence_no: 1, amount: 40, due_date: '2026-01-31', competence: '2026-01', competenceLabel: 'jan/2026' },
  { recurrence_sequence_no: 2, amount: 40, due_date: '2026-02-28', competence: '2026-02', competenceLabel: 'fev/2026' },
  { recurrence_sequence_no: 3, amount: 40, due_date: '2026-03-31', competence: '2026-03', competenceLabel: 'mar/2026' }
];

let testEnv;
let setupApp;
let setupAuth;

function emailFor(label) {
  return `${label}-${Date.now()}-${Math.random().toString(16).slice(2)}@example.test`;
}

function cents(value) {
  return Math.round((Number(value) || 0) * 100);
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
      macro_category: MACRO,
      shared_scope: 'personal',
      created_at: '2026-09-12T00:00:00.000Z',
      owner_uid: credential.user.uid,
      owner_email: email
    });
    await setDoc(doc(context.firestore(), ...recordsPath, 'reference-category-moradia'), {
      type: 'categoria',
      macro_category: MACRO,
      category_name: CATEGORY,
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
  await page.waitForFunction(() => window.__financeCacheState?.uid && window.__financeCacheState.source === 'firebase');
}

async function signOutUi(page) {
  await page.locator('#btn-logout').click();
  await expect(page.locator('#auth-screen')).toBeVisible();
  await expect(page.locator('#app')).toBeHidden();
}

async function readFinanceRecordsAs(account, targetUid = account.uid) {
  const context = testEnv.authenticatedContext(account.uid, { email: account.email });
  try {
    const snapshot = await getDocs(collection(context.firestore(), 'users', targetUid, 'finance_records'));
    return snapshot.docs.map((recordDoc) => ({ id: recordDoc.id, ...recordDoc.data() }));
  } finally {
    await context.cleanup();
  }
}

async function assertCannotReadOtherUserRecords(account, targetUid) {
  const context = testEnv.authenticatedContext(account.uid, { email: account.email });
  try {
    await assertFails(getDocs(collection(context.firestore(), 'users', targetUid, 'finance_records')));
  } finally {
    await context.cleanup();
  }
}

function recurrenceRecords(records, description = DESCRIPTION) {
  return records
    .filter((record) => record.type === 'saida' && record.purchase_name === description && record.source_mode === 'recurring')
    .sort((a, b) => Number(a.recurrence_sequence_no || 0) - Number(b.recurrence_sequence_no || 0));
}

async function currentRecurrences(page, description = DESCRIPTION) {
  return page.evaluate((targetDescription) => (window.allRecords || [])
    .filter((record) => record.type === 'saida' && record.purchase_name === targetDescription && record.source_mode === 'recurring')
    .map((record) => ({
      id: record.id,
      type: record.type,
      person: record.person,
      description: record.description,
      purchase_name: record.purchase_name,
      amount: record.amount,
      status: record.status,
      paid_at: record.paid_at,
      due_date: record.due_date,
      competence: record.competence,
      parent_id: record.parent_id,
      installment_no: record.installment_no,
      total_installments: record.total_installments,
      is_installment: record.is_installment,
      recurrence: record.recurrence,
      recurrence_frequency: record.recurrence_frequency,
      recurrence_count: record.recurrence_count,
      recurrence_end_date: record.recurrence_end_date,
      recurrence_series_id: record.recurrence_series_id,
      recurrence_sequence_no: record.recurrence_sequence_no,
      recurrence_total_occurrences: record.recurrence_total_occurrences,
      source_mode: record.source_mode,
      payment_method: record.payment_method,
      owner_uid: record.owner_uid,
      owner_email: record.owner_email,
      macro_category: record.macro_category,
      subcategory: record.subcategory
    }))
    .sort((a, b) => Number(a.recurrence_sequence_no || 0) - Number(b.recurrence_sequence_no || 0)), description);
}

function assertRecurrenceSeries(records, account, originalIds = null, seriesId = null) {
  expect(records).toHaveLength(3);
  if (originalIds) expect(records.map((record) => record.id)).toEqual(originalIds);
  const seriesIds = new Set(records.map((record) => record.recurrence_series_id));
  expect(seriesIds.size).toBe(1);
  const resolvedSeriesId = [...seriesIds][0];
  expect(resolvedSeriesId).toMatch(/^r_/);
  if (seriesId) expect(resolvedSeriesId).toBe(seriesId);
  expect(records.reduce((sum, record) => sum + cents(record.amount), 0)).toBe(12000);

  records.forEach((record, index) => {
    const expected = EXPECTED_RECURRENCES[index];
    expect(record).toMatchObject({
      type: 'saida',
      person: PERSON,
      purchase_name: DESCRIPTION,
      description: DESCRIPTION,
      amount: expected.amount,
      status: 'Em aberto',
      paid_at: '',
      due_date: expected.due_date,
      competence: expected.competence,
      parent_id: '',
      installment_no: 0,
      total_installments: 0,
      is_installment: false,
      recurrence: 'mensal',
      recurrence_frequency: 'monthly',
      recurrence_count: 3,
      recurrence_end_date: '',
      recurrence_sequence_no: expected.recurrence_sequence_no,
      recurrence_total_occurrences: 3,
      source_mode: 'recurring',
      payment_method: PAYMENT_METHOD,
      owner_uid: account.uid,
      owner_email: account.email,
      macro_category: MACRO,
      subcategory: CATEGORY
    });
    expect(cents(record.amount)).toBe(4000);
  });
  return resolvedSeriesId;
}

async function openNewRecordForm(page, description = DESCRIPTION) {
  await page.locator('#btn-new-record-header').click();
  await expect(page.locator('#view-novo')).toBeVisible();
  await page.locator('#form-person').selectOption(PERSON);
  await page.locator('#form-macro').selectOption(MACRO);
  await page.locator('#form-category').fill(CATEGORY);
  await page.locator('#form-desc').fill(description);
  await page.locator('#form-amount').fill('40.00');
  await page.locator('#form-status').selectOption('Em aberto');
  await page.locator('#form-payment').fill(PAYMENT_METHOD);
  await page.locator('#form-occurred').fill(FIRST_DUE_DATE);
  await page.locator('#form-due').fill(FIRST_DUE_DATE);
  await page.locator('#form-competence').fill('2026-01');
  await page.locator('#cycle-saida-inicio-mes').click();
}

async function fillMonthlyRecurrence(page, count = '3') {
  await page.locator('#form-expense-type').selectOption('a_vista');
  await page.locator('#form-recurrence').selectOption('mensal');
  await expect(page.locator('#recurrence-fields')).toBeVisible();
  await page.locator('#form-recurrence-termination').selectOption('count');
  await page.locator('#form-recurrence-count').fill(count);
}

async function createMonthlyRecurrenceThroughUi(page) {
  await openNewRecordForm(page);
  await fillMonthlyRecurrence(page, '3');
  await expect(page.locator('#recurrence-preview-frequency')).toHaveText('Mensal');
  await expect(page.locator('#recurrence-preview-count')).toHaveText('3');
  await expect(page.locator('#recurrence-preview-first')).toHaveText('2026-01-31');
  await expect(page.locator('#recurrence-preview-last')).toHaveText('2026-03-31');
  await expect(page.locator('#recurrence-preview-total')).toHaveText('R$ 120,00');
  await page.locator('#btn-submit').click();
  await expect(page.locator('#toast')).toContainText('Recorrencia mensal criada (3x)!');
  await page.waitForFunction((description) =>
    (window.allRecords || []).filter((record) => record.type === 'saida' && record.purchase_name === description && record.source_mode === 'recurring').length === 3,
  DESCRIPTION);
}

async function showSaidasForMonth(page, month) {
  await page.evaluate(() => window.switchTab('dashboard'));
  await page.locator('#f-comp-start').fill(month);
  await page.locator('#f-comp-end').fill(month);
  await page.evaluate(() => window.switchTab('saidas'));
  await expect(page.locator('#view-saidas')).toBeVisible();
  await page.locator('#saidas-filter-all').click();
  await page.locator('#saidas-person-filter').selectOption(PERSON);
}

async function ensureDashboardAdvancedFiltersOpen(page) {
  const panelHidden = await page.locator('#advanced-filters-panel').evaluate((panel) => panel.classList.contains('hidden'));
  if (panelHidden) await page.locator('#btn-advanced-filters').click();
}

async function showDashboardForMonth(page, month) {
  await page.evaluate(() => window.switchTab('dashboard'));
  await page.locator('#f-comp-start').fill(month);
  await page.locator('#f-comp-end').fill(month);
  await ensureDashboardAdvancedFiltersOpen(page);
  await page.locator('#f-person').selectOption(PERSON);
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
  }, `e2e-local-recurrences-${Date.now()}-${Math.random()}`);
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

test('monthly recurrence series persists by UI and stays isolated across A -> B -> A in one browser context', async ({ page }) => {
  test.setTimeout(120_000);
  const userA = await createActiveAccount('recurrence-user-a');
  const userB = await createActiveAccount('recurrence-user-b');

  await page.goto('/', { waitUntil: 'load' });
  await page.waitForFunction(() => window.__financeFirestoreDb && window.authSdk && window.userAdminSdk);
  const runtime = await page.evaluate(() => ({
    projectId: window.__financeFirestoreDb?.app?.options?.projectId,
    hasFinanceUiGlobal: Object.prototype.hasOwnProperty.call(window, 'financeUI')
  }));
  expect(runtime).toEqual({ projectId: PROJECT_ID, hasFinanceUiGlobal: false });

  await signIn(page, userA);
  await createMonthlyRecurrenceThroughUi(page);

  const createdRecords = await currentRecurrences(page);
  const originalIds = createdRecords.map((record) => record.id);
  const seriesId = assertRecurrenceSeries(createdRecords, userA);

  const persistedAfterCreate = recurrenceRecords(await readFinanceRecordsAs(userA));
  expect(persistedAfterCreate.map((record) => record.id)).toEqual(originalIds);
  assertRecurrenceSeries(persistedAfterCreate, userA, originalIds, seriesId);

  for (const expected of EXPECTED_RECURRENCES) {
    await showSaidasForMonth(page, expected.competence);
    await expect(page.locator('#saidas-list')).toContainText(DESCRIPTION);
    await expect(page.locator('#saidas-list')).toContainText(expected.competenceLabel);
    await expect(page.locator('#saidas-total')).toContainText('R$ 40,00');

    await showDashboardForMonth(page, expected.competence);
    await expect(page.locator('#summary-cards')).toContainText('R$ 40,00');
    await expect(page.locator('#recent-list')).toContainText(DESCRIPTION);
  }

  await page.reload({ waitUntil: 'load' });
  await expect(page.locator('#app')).toBeVisible();
  await page.waitForFunction(({ description, seriesId }) => {
    const records = (window.allRecords || []).filter((record) => record.purchase_name === description && record.recurrence_series_id === seriesId);
    return records.length === 3;
  }, { description: DESCRIPTION, seriesId });
  const afterReload = await currentRecurrences(page);
  assertRecurrenceSeries(afterReload, userA, originalIds, seriesId);

  for (const expected of EXPECTED_RECURRENCES) {
    await showDashboardForMonth(page, expected.competence);
    await expect(page.locator('#summary-cards')).toContainText('R$ 40,00');
  }

  await signOutUi(page);
  await signIn(page, userB);
  await page.waitForFunction((description) => !(window.allRecords || []).some((record) => record.purchase_name === description), DESCRIPTION);
  await showSaidasForMonth(page, '2026-01');
  await expect(page.locator('#saidas-list')).not.toContainText(DESCRIPTION);
  await showDashboardForMonth(page, '2026-01');
  await expect(page.locator('#summary-cards')).not.toContainText('R$ 40,00');
  expect(recurrenceRecords(await readFinanceRecordsAs(userB))).toHaveLength(0);
  await assertCannotReadOtherUserRecords(userB, userA.uid);

  await signOutUi(page);
  await signIn(page, userA);
  await page.waitForFunction(({ description, seriesId }) => {
    const records = (window.allRecords || []).filter((record) => record.purchase_name === description && record.recurrence_series_id === seriesId);
    return records.length === 3;
  }, { description: DESCRIPTION, seriesId });
  const returnedToA = await currentRecurrences(page);
  assertRecurrenceSeries(returnedToA, userA, originalIds, seriesId);
});

test('monthly recurrence validation blocks invalid quantity and cancel leaves no records', async ({ page }) => {
  const userA = await createActiveAccount('recurrence-validation-user-a');

  await page.goto('/', { waitUntil: 'load' });
  await page.waitForFunction(() => window.__financeFirestoreDb && window.authSdk && window.userAdminSdk);
  await signIn(page, userA);

  await openNewRecordForm(page, INVALID_DESCRIPTION);
  await fillMonthlyRecurrence(page, '0');
  await expect(page.locator('#form-recurrence-count')).toHaveJSProperty('validity.valid', false);
  await page.locator('#btn-submit').click();
  expect(recurrenceRecords(await readFinanceRecordsAs(userA), INVALID_DESCRIPTION)).toHaveLength(0);

  await page.reload({ waitUntil: 'load' });
  await expect(page.locator('#app')).toBeVisible();
  await page.waitForFunction(() => window.__financeCacheState?.uid && window.__financeCacheState.source === 'firebase');
  await openNewRecordForm(page, CANCEL_DESCRIPTION);
  await fillMonthlyRecurrence(page, '3');
  await page.locator('#btn-dashboard-home').click();
  await expect(page.locator('#view-dashboard')).toBeVisible();
  expect(recurrenceRecords(await readFinanceRecordsAs(userA), CANCEL_DESCRIPTION)).toHaveLength(0);
});
