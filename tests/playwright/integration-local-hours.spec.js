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
const COMPETENCE = '2026-06';
const OCCURRED_DATE = '2026-06-12';
const INITIAL_NOTE = `Banco de horas local ${Date.now()}`;
const EDITED_NOTE = `Banco de horas local editado ${Date.now()}`;

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
    created_at: '2026-09-13T00:00:00.000Z',
    updated_at: '2026-09-13T00:00:00.000Z',
    last_login_at: '2026-09-13T00:00:00.000Z'
  };

  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'users', credential.user.uid), profile);
    const recordsPath = ['users', credential.user.uid, 'finance_records'];
    await setDoc(doc(context.firestore(), ...recordsPath, 'reference-person-jadson'), {
      type: 'pessoa',
      person: PERSON,
      salary_base: 5000,
      receiving_type: 'mensal',
      created_at: '2026-09-13T00:00:00.000Z',
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
  const overlay = page.locator('#sidebar-overlay');
  if (await overlay.evaluate((element) => !element.classList.contains('hidden')).catch(() => false)) {
    await overlay.click();
    await expect(overlay).toHaveClass(/hidden/);
  }
  await page.locator('#btn-logout').click();
  await expect(page.locator('#auth-screen')).toBeVisible();
  await expect(page.locator('#app')).toBeHidden();
}

async function openTab(page, tab) {
  const sidebar = page.locator('#sidebar');
  const isHidden = await sidebar.evaluate((element) => element.classList.contains('-translate-x-full')).catch(() => true);
  if (isHidden) await page.locator('#btn-mobile-menu').click();
  await expect(sidebar).toBeVisible();
  await page.locator(`[data-tab="${tab}"]`).click();
  await expect(page.locator(`#view-${tab}`)).toBeVisible();
}

async function openHourControl(page) {
  await openTab(page, 'controle-horas');
  await page.waitForFunction(() => window.saveHourControlRecord?.__financeModernHourControl === true);
  await page.locator('#controle-horas-competencia').fill(COMPETENCE);
  await page.evaluate(() => window.renderControleHoras?.());
  await expect(page.locator('#view-controle-horas')).toBeVisible();
}

async function openHourModal(page) {
  await page.locator('#btn-new-hour-control').click();
  await expect(page.locator('#hour-control-modal')).toBeVisible();
}

async function fillBankHourForm(page, { endTime, note, expectValidPreview = true }) {
  await page.locator('#hour-person').selectOption(PERSON);
  await page.locator('#hour-competence').fill(COMPETENCE);
  await page.locator('#hour-date').fill(OCCURRED_DATE);
  await page.locator('#hour-type').selectOption('Banco de Horas');
  await page.locator('#hour-start').fill('08:00');
  await page.locator('#hour-end').fill(endTime);
  await page.locator('#hour-break-start').fill('12:00');
  await page.locator('#hour-break-end').fill('13:00');
  await page.locator('#hour-bank-nature').selectOption('Débito');
  await page.locator('#hour-note').fill(note);
  if (expectValidPreview) await expect(page.locator('#hour-calculation-preview')).toContainText('Banco de Horas');
}

async function readRecordsAs(account, targetUid = account.uid) {
  const context = testEnv.authenticatedContext(account.uid, { email: account.email });
  try {
    const snapshot = await getDocs(collection(context.firestore(), 'users', targetUid, 'finance_records'));
    return snapshot.docs.map((recordDoc) => ({ id: recordDoc.id, ...recordDoc.data() }));
  } finally {
    await context.cleanup();
  }
}

async function readHourRecordsAs(account) {
  return (await readRecordsAs(account))
    .filter((record) => record.type === 'controle_horas' && record.person === PERSON && record.competence === COMPETENCE);
}

async function readAuditLogsAs(account) {
  const context = testEnv.authenticatedContext(account.uid, { email: account.email });
  try {
    const snapshot = await getDocs(collection(context.firestore(), 'users', account.uid, 'audit_logs'));
    return snapshot.docs.map((recordDoc) => ({ id: recordDoc.id, ...recordDoc.data() }));
  } finally {
    await context.cleanup();
  }
}

async function readHourAuditLogsAs(account) {
  return (await readAuditLogsAs(account))
    .filter((event) => event.event_type === 'HOUR_ENTRY_CREATED' || event.event_type === 'HOUR_ENTRY_UPDATED');
}

async function waitHourAuditEventsAs(account, expectedTypes = []) {
  let latest = [];
  await expect.poll(async () => {
    latest = (await readHourAuditLogsAs(account))
      .filter((event) => expectedTypes.includes(event.event_type));
    return latest.map((event) => event.event_type).sort().join('|');
  }, { timeout: 15000 }).toBe([...expectedTypes].sort().join('|'));
  return latest;
}

async function waitHourRecordsAs(account, expectedCount) {
  let latest = [];
  await expect.poll(async () => {
    latest = await readHourRecordsAs(account);
    return latest.length;
  }, { timeout: 15000 }).toBe(expectedCount);
  return latest;
}

async function assertCannotReadOtherUserRecords(account, targetUid) {
  const context = testEnv.authenticatedContext(account.uid, { email: account.email });
  try {
    await assertFails(getDocs(collection(context.firestore(), 'users', targetUid, 'finance_records')));
  } finally {
    await context.cleanup();
  }
}

async function currentHourRecords(page) {
  return page.evaluate(({ person, competence }) => (window.allRecords || [])
    .filter((record) => record.type === 'controle_horas' && record.person === person && record.competence === competence)
    .map((record) => ({
      id: record.id,
      type: record.type,
      person: record.person,
      competence: record.competence,
      occurred_date: record.occurred_date,
      hour_control_type: record.hour_control_type,
      bank_nature: record.bank_nature,
      start_time: record.start_time,
      end_time: record.end_time,
      break_start: record.break_start,
      break_end: record.break_end,
      gross_minutes: record.gross_minutes,
      break_minutes: record.break_minutes,
      net_minutes: record.net_minutes,
      bank_minutes: record.bank_minutes,
      financial_total: record.financial_total,
      observation: record.observation,
      owner_uid: record.owner_uid,
      owner_email: record.owner_email
    })), { person: PERSON, competence: COMPETENCE });
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
  }, `e2e-local-hours-${Date.now()}-${Math.random()}`);
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

test('active users create and edit bank-hour records locally without leaking A -> B -> A', async ({ page }) => {
  test.setTimeout(180_000);
  const userA = await createActiveAccount('hours-user-a');
  const userB = await createActiveAccount('hours-user-b');

  await page.goto('/', { waitUntil: 'load' });
  await page.waitForFunction(() => window.__financeFirestoreDb && window.authSdk && window.userAdminSdk);
  const runtime = await page.evaluate(() => ({
    projectId: window.__financeFirestoreDb?.app?.options?.projectId,
    hasFinanceUiGlobal: Object.prototype.hasOwnProperty.call(window, 'financeUI')
  }));
  expect(runtime).toEqual({ projectId: PROJECT_ID, hasFinanceUiGlobal: false });

  await signIn(page, userA);
  await openHourControl(page);
  await expect(page.locator('#controle-horas-meta')).toContainText('0 lancamento');

  await openHourModal(page);
  await fillBankHourForm(page, { endTime: '17:00', note: INITIAL_NOTE });
  await page.locator('#btn-save-hour-control').click();
  await expect(page.locator('#toast')).toContainText(/horas salvo/i);
  await page.waitForFunction(({ person, competence }) =>
    (window.allRecords || []).filter((record) => record.type === 'controle_horas' && record.person === person && record.competence === competence).length === 1,
  { person: PERSON, competence: COMPETENCE });

  const [created] = await currentHourRecords(page);
  expect(created).toMatchObject({
    type: 'controle_horas',
    person: PERSON,
    competence: COMPETENCE,
    occurred_date: OCCURRED_DATE,
    hour_control_type: 'Banco de Horas',
    bank_nature: 'Débito',
    start_time: '08:00',
    end_time: '17:00',
    break_start: '12:00',
    break_end: '13:00',
    gross_minutes: 540,
    break_minutes: 60,
    net_minutes: 480,
    bank_minutes: 480,
    financial_total: 0,
    observation: INITIAL_NOTE,
    owner_uid: userA.uid,
    owner_email: userA.email
  });

  const persistedAfterCreate = await waitHourRecordsAs(userA, 1);
  expect(persistedAfterCreate[0].id).toBe(created.id);
  const [createdAudit] = await waitHourAuditEventsAs(userA, ['HOUR_ENTRY_CREATED']);
  expect(createdAudit).toMatchObject({
    event_type: 'HOUR_ENTRY_CREATED',
    action: 'finance_record.create_hour_entry',
    category: 'financial',
    actor_uid: userA.uid,
    owner_uid: userA.uid,
    source_channel: 'web',
    entity_type: 'finance_record',
    entity_id: created.id,
    result_status: 'success'
  });
  expect(createdAudit.correlation_id).toBeTruthy();
  expect(createdAudit.event_id).toBeTruthy();

  await expect(page.locator(`[data-hour-control-modern-group="${PERSON}|${COMPETENCE}"]`)).toBeVisible();
  await expect(page.locator('#controle-horas-list')).toContainText('Saldo banco: +08:00');
  await page.locator(`[data-open-hour-detail="${PERSON}|${COMPETENCE}"]`).click();
  await expect(page.locator('#hour-detail-modal')).toBeVisible();
  await expect(page.locator('#hour-detail-content')).toContainText(INITIAL_NOTE);
  await page.locator('[data-edit-hour-control-record]').first().click();
  await expect(page.locator('#hour-control-modal')).toBeVisible();
  await page.locator('#hour-end').fill('18:00');
  await page.locator('#hour-note').fill(EDITED_NOTE);
  await page.locator('#btn-save-hour-control').click();
  await expect.poll(async () => {
    const [record] = await currentHourRecords(page);
    return record?.end_time;
  }, { timeout: 15000 }).toBe('18:00');

  const [edited] = await currentHourRecords(page);
  expect(edited).toMatchObject({
    id: created.id,
    end_time: '18:00',
    gross_minutes: 600,
    break_minutes: 60,
    net_minutes: 540,
    bank_minutes: 540,
    financial_total: 0,
    observation: EDITED_NOTE,
    owner_uid: userA.uid,
    owner_email: userA.email
  });
  expect(await waitHourRecordsAs(userA, 1)).toHaveLength(1);
  const hourAudits = await waitHourAuditEventsAs(userA, ['HOUR_ENTRY_CREATED', 'HOUR_ENTRY_UPDATED']);
  const createEvents = hourAudits.filter((event) => event.event_type === 'HOUR_ENTRY_CREATED');
  const updateEvents = hourAudits.filter((event) => event.event_type === 'HOUR_ENTRY_UPDATED');
  expect(createEvents).toHaveLength(1);
  expect(updateEvents).toHaveLength(1);
  expect(updateEvents[0]).toMatchObject({
    action: 'finance_record.update_hour_entry',
    category: 'financial',
    actor_uid: userA.uid,
    owner_uid: userA.uid,
    source_channel: 'web',
    entity_type: 'finance_record',
    entity_id: created.id,
    result_status: 'success'
  });
  expect(updateEvents[0].event_id).toBeTruthy();
  expect(updateEvents[0].event_id).not.toBe(createEvents[0].event_id);
  expect(new Set(hourAudits.map((event) => event.id)).size).toBe(2);
  expect(JSON.stringify(hourAudits)).not.toMatch(/password|token|telefone|whatsapp|phone/i);

  await page.reload({ waitUntil: 'load' });
  await expect(page.locator('#app')).toBeVisible();
  await page.waitForFunction(({ id, note }) =>
    (window.allRecords || []).some((record) => record.id === id && record.observation === note && record.net_minutes === 540),
  { id: created.id, note: EDITED_NOTE });
  await openHourControl(page);
  await expect(page.locator('#controle-horas-list')).toContainText('Saldo banco: +09:00');
  expect(await waitHourAuditEventsAs(userA, ['HOUR_ENTRY_CREATED', 'HOUR_ENTRY_UPDATED'])).toHaveLength(2);

  await signOutUi(page);
  await signIn(page, userB);
  await openHourControl(page);
  await page.waitForFunction((note) => !(window.allRecords || []).some((record) => record.observation === note), EDITED_NOTE);
  await expect(page.locator('#controle-horas-list')).not.toContainText(EDITED_NOTE);
  await expect(page.locator('#controle-horas-meta')).toContainText('0 lancamento');
  expect(await readHourRecordsAs(userB)).toHaveLength(0);
  expect(await readHourAuditLogsAs(userB)).toHaveLength(0);
  await assertCannotReadOtherUserRecords(userB, userA.uid);

  await signOutUi(page);
  await signIn(page, userA);
  await page.waitForFunction(({ id, note }) =>
    (window.allRecords || []).some((record) => record.id === id && record.observation === note && record.net_minutes === 540),
  { id: created.id, note: EDITED_NOTE });
  await openHourControl(page);
  await expect(page.locator('#controle-horas-list')).toContainText('Saldo banco: +09:00');
  const returnedToA = await currentHourRecords(page);
  expect(returnedToA).toHaveLength(1);
  expect(returnedToA[0]).toMatchObject({ id: created.id, observation: EDITED_NOTE, owner_uid: userA.uid });
});

test('invalid hour interval is rejected in the active UI before persistence', async ({ page }) => {
  const userA = await createActiveAccount('hours-validation-user-a');

  await page.goto('/', { waitUntil: 'load' });
  await page.waitForFunction(() => window.__financeFirestoreDb && window.authSdk && window.userAdminSdk);
  await signIn(page, userA);
  await openHourControl(page);
  await openHourModal(page);
  await fillBankHourForm(page, { endTime: '08:00', note: 'Intervalo invalido local', expectValidPreview: false });
  await page.locator('#btn-save-hour-control').click();
  await expect(page.locator('#hour-control-modal')).toBeVisible();
  await expect(page.locator('#toast')).toContainText(/intervalo de horas valido/i);
  expect(await readHourRecordsAs(userA)).toHaveLength(0);
  expect(await readHourAuditLogsAs(userA)).toHaveLength(0);
});
