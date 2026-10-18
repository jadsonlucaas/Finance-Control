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
const PERSON = 'Jadson';
const MACRO = 'FIXO';
const CATEGORY = 'Moradia E2E';
const CARD = 'Cartao E2E';
const PAYMENT_METHOD = 'Cartao E2E';
const TOTAL_AMOUNT = '100.00';
const FIRST_DUE_DATE = '2026-09-15';
const PAID_AT = '2026-09-20';
const DESCRIPTION = `E2E parcelamento emulator ${Date.now()}`;
const EXPECTED_INSTALLMENTS = [
  { installment_no: 1, amountCents: 3333, amount: 33.33, due_date: '2026-09-15', competence: '2026-09', status: 'Em aberto' },
  { installment_no: 2, amountCents: 3333, amount: 33.33, due_date: '2026-10-15', competence: '2026-10', status: 'Em aberto' },
  { installment_no: 3, amountCents: 3334, amount: 33.34, due_date: '2026-11-15', competence: '2026-11', status: 'Em aberto' }
];
const EXPECTED_AFTER_PAYMENT = [
  { ...EXPECTED_INSTALLMENTS[0], status: 'Pago' },
  EXPECTED_INSTALLMENTS[1],
  EXPECTED_INSTALLMENTS[2]
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

async function readFinanceRecordsAs(account) {
  const context = testEnv.authenticatedContext(account.uid, { email: account.email });
  try {
    const snapshot = await getDocs(collection(context.firestore(), 'users', account.uid, 'finance_records'));
    return snapshot.docs.map((recordDoc) => ({ id: recordDoc.id, ...recordDoc.data() }));
  } finally {
    await context.cleanup();
  }
}

function installmentRecords(records) {
  return records
    .filter((record) => record.type === 'saida' && record.purchase_name === DESCRIPTION && record.is_installment === true)
    .sort((a, b) => Number(a.installment_no || 0) - Number(b.installment_no || 0));
}

async function currentInstallments(page) {
  return page.evaluate((description) => (window.allRecords || [])
    .filter((record) => record.type === 'saida' && record.purchase_name === description && record.is_installment === true)
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
      payment_method: record.payment_method,
      card: record.card,
      owner_uid: record.owner_uid,
      owner_email: record.owner_email,
      macro_category: record.macro_category,
      subcategory: record.subcategory
    }))
    .sort((a, b) => Number(a.installment_no || 0) - Number(b.installment_no || 0)), DESCRIPTION);
}

function assertInstallmentSeries(records, account, expectedStatuses = EXPECTED_INSTALLMENTS) {
  expect(records).toHaveLength(3);
  const parentIds = new Set(records.map((record) => record.parent_id));
  expect(parentIds.size).toBe(1);
  expect([...parentIds][0]).toMatch(/^p_/);
  expect(records.reduce((sum, record) => sum + cents(record.amount), 0)).toBe(10000);
  records.forEach((record, index) => {
    const expected = expectedStatuses[index];
    expect(record).toMatchObject({
      type: 'saida',
      person: PERSON,
      purchase_name: DESCRIPTION,
      description: `${DESCRIPTION} (${expected.installment_no}/3)`,
      amount: expected.amount,
      due_date: expected.due_date,
      competence: expected.competence,
      installment_no: expected.installment_no,
      total_installments: 3,
      status: expected.status,
      owner_uid: account.uid,
      owner_email: account.email,
      macro_category: MACRO,
      subcategory: CATEGORY,
      payment_method: PAYMENT_METHOD,
      card: CARD
    });
    expect(cents(record.amount)).toBe(expected.amountCents);
  });
}

async function createInstallmentSeriesThroughUi(page) {
  await page.locator('#btn-new-record-header').click();
  await expect(page.locator('#view-novo')).toBeVisible();
  await page.locator('#form-person').selectOption(PERSON);
  await page.locator('#form-macro').selectOption(MACRO);
  await page.locator('#form-category').fill(CATEGORY);
  await page.locator('#form-desc').fill(DESCRIPTION);
  await page.locator('#form-amount').fill(TOTAL_AMOUNT);
  await page.locator('#form-status').selectOption('Em aberto');
  await page.locator('#form-payment').fill(PAYMENT_METHOD);
  await page.locator('#form-occurred').fill(FIRST_DUE_DATE);
  await page.locator('#form-due').fill(FIRST_DUE_DATE);
  await page.locator('#form-competence').fill('2026-09');
  await page.locator('#cycle-saida-inicio-mes').click();
  await page.locator('#form-expense-type').selectOption('parcelada');
  await expect(page.locator('#installment-fields')).toBeVisible();
  await page.locator('#form-installments').fill('3');
  await page.locator('#form-card').fill(CARD);
  await expect(page.locator('#form-installment-value')).toHaveValue('33.34');
  await page.locator('#btn-submit').click();
  await expect(page.locator('#toast')).toContainText('3 parcela(s) criada(s)!');
  await page.waitForFunction((description) =>
    (window.allRecords || []).filter((record) => record.type === 'saida' && record.purchase_name === description && record.is_installment === true).length === 3,
  DESCRIPTION);
}

async function openParcelamentosMonthDetail(page) {
  await page.evaluate(() => window.switchTab('parcelamentos'));
  await expect(page.locator('#view-parcelamentos')).toBeVisible();
  await expect(page.locator('#parcelamentos-list')).toContainText(DESCRIPTION);
  await page.locator('[data-parcelamentos-detail="mes"]').click();
  await expect(page.locator('#parcelamentos-detail-modal')).toBeVisible();
  await expect(page.locator('#parcelamentos-detail-title')).toContainText('Parcelas');
}

async function setDashboardPeriodForSeptember(page) {
  await page.locator('#f-comp-start').fill('2026-09');
  await page.locator('#f-comp-end').fill('2026-09');
  await page.locator('#btn-advanced-filters').click();
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
  }, `e2e-local-installments-${Date.now()}-${Math.random()}`);
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

test('installment series payment persists and stays isolated across A -> B -> A in one browser context', async ({ page }) => {
  test.setTimeout(120_000);
  const userA = await createActiveAccount('installment-user-a');
  const userB = await createActiveAccount('installment-user-b');

  await page.clock.setFixedTime(new Date(`${PAID_AT}T12:00:00.000Z`));
  await page.goto('/', { waitUntil: 'load' });
  await page.waitForFunction(() => window.__financeFirestoreDb && window.authSdk && window.userAdminSdk);
  const runtime = await page.evaluate(() => ({
    projectId: window.__financeFirestoreDb?.app?.options?.projectId,
    hasFinanceUiGlobal: Object.prototype.hasOwnProperty.call(window, 'financeUI')
  }));
  expect(runtime).toEqual({ projectId: PROJECT_ID, hasFinanceUiGlobal: false });

  await signIn(page, userA);
  await createInstallmentSeriesThroughUi(page);

  const createdRecords = await currentInstallments(page);
  const originalIds = createdRecords.map((record) => record.id);
  const parentId = createdRecords[0].parent_id;
  assertInstallmentSeries(createdRecords, userA);

  const persistedAfterCreate = installmentRecords(await readFinanceRecordsAs(userA));
  expect(persistedAfterCreate.map((record) => record.id)).toEqual(originalIds);
  assertInstallmentSeries(persistedAfterCreate, userA);

  await openParcelamentosMonthDetail(page);
  await expect(page.locator('#parcelamentos-detail-list')).toContainText(DESCRIPTION);
  await expect(page.locator('#parcelamentos-detail-list')).toContainText('parcela 1/3');
  await expect(page.locator('#parcelamentos-detail-list')).toContainText('R$ 33,33');
  await expect(page.locator('#parcelamentos-detail-list')).toContainText('Atrasado');
  await page.locator(`#parcelamentos-detail-list [data-finance-record-id="${originalIds[0]}"][data-finance-record-action="toggle-paid"]`).click();
  await expect.poll(async () => {
    const persisted = installmentRecords(await readFinanceRecordsAs(userA));
    return persisted.map((record) => [record.id, record.status, record.paid_at]);
  }).toEqual([
    [originalIds[0], 'Pago', PAID_AT],
    [originalIds[1], 'Em aberto', ''],
    [originalIds[2], 'Em aberto', '']
  ]);

  const persistedAfterPayment = installmentRecords(await readFinanceRecordsAs(userA));
  expect(persistedAfterPayment.map((record) => record.id)).toEqual(originalIds);
  expect(persistedAfterPayment.map((record) => record.paid_at)).toEqual([PAID_AT, '', '']);
  expect(persistedAfterPayment.every((record) => record.parent_id === parentId)).toBe(true);
  assertInstallmentSeries(persistedAfterPayment, userA, EXPECTED_AFTER_PAYMENT);

  await page.locator('#btn-close-parcelamentos-detail').click();
  await page.evaluate(() => window.switchTab('dashboard'));
  await setDashboardPeriodForSeptember(page);
  await expect(page.locator('#summary-cards')).toContainText('R$ 33,33');
  await expect(page.locator('#recent-list')).toContainText(DESCRIPTION);
  await expect(page.locator('#recent-list')).toContainText('Parcela 1/3');
  await expect(page.locator('#recent-list')).not.toContainText('Parcela 2/3');

  await page.evaluate(() => window.switchTab('parcelamentos'));
  await expect(page.locator('#parcelamentos-total-comprometido')).toContainText('R$ 66,67');
  await expect(page.locator('#parcelamentos-total-pago')).toContainText('R$ 33,33');
  await expect(page.locator('#parcelamentos-total-mes')).toContainText('R$ 33,33');

  await page.reload({ waitUntil: 'load' });
  await expect(page.locator('#app')).toBeVisible();
  await page.waitForFunction(({ description }) => {
    const installments = (window.allRecords || []).filter((record) => record.purchase_name === description && record.is_installment === true);
    return installments.length === 3
      && installments.some((record) => record.installment_no === 1 && record.status === 'Pago' && record.paid_at)
      && installments.filter((record) => record.status === 'Em aberto' && !record.paid_at).length === 2;
  }, { description: DESCRIPTION });
  const afterReload = await currentInstallments(page);
  expect(afterReload.map((record) => record.id)).toEqual(originalIds);
  expect(afterReload.map((record) => record.paid_at)).toEqual([PAID_AT, '', '']);
  assertInstallmentSeries(afterReload, userA, EXPECTED_AFTER_PAYMENT);

  await signOutUi(page);
  await signIn(page, userB);
  await page.waitForFunction((description) => !(window.allRecords || []).some((record) => record.purchase_name === description), DESCRIPTION);
  await page.evaluate(() => window.switchTab('parcelamentos'));
  await expect(page.locator('#parcelamentos-list')).not.toContainText(DESCRIPTION);
  await expect(page.locator('#parcelamentos-total-comprometido')).toContainText('R$ 0,00');
  await expect(page.locator('#parcelamentos-total-pago')).toContainText('R$ 0,00');
  await page.evaluate(() => window.switchTab('dashboard'));
  await setDashboardPeriodForSeptember(page);
  await expect(page.locator('#summary-cards')).not.toContainText('R$ 33,33');
  expect(installmentRecords(await readFinanceRecordsAs(userB))).toHaveLength(0);

  await signOutUi(page);
  await signIn(page, userA);
  await page.waitForFunction(({ description, parentId }) => {
    const installments = (window.allRecords || [])
      .filter((record) => record.purchase_name === description && record.parent_id === parentId && record.is_installment === true);
    return installments.length === 3
      && installments.some((record) => record.installment_no === 1 && record.status === 'Pago' && record.paid_at)
      && installments.filter((record) => record.status === 'Em aberto' && !record.paid_at).length === 2;
  }, { description: DESCRIPTION, parentId });
  const returnedToA = await currentInstallments(page);
  expect(returnedToA.map((record) => record.id)).toEqual(originalIds);
  expect(returnedToA.map((record) => record.paid_at)).toEqual([PAID_AT, '', '']);
  assertInstallmentSeries(returnedToA, userA, EXPECTED_AFTER_PAYMENT);
});
