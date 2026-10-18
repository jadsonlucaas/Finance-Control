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
import {
  FINANCE_BACKUP_SCHEMA_VERSION,
  FINANCE_BACKUP_VERSION,
  ValidateFinanceBackupSnapshot,
  buildBackupChecksum
} from '../../src/application/backup/financeBackupUseCases.js';
import { buildOperationFingerprint } from '../../src/application/gateway/idempotency.js';

const PROJECT_ID = 'demo-finance-control-local-e2e';
const AUTH_EMULATOR_URL = 'http://127.0.0.1:9099';
const FIRESTORE_HOST = '127.0.0.1';
const FIRESTORE_PORT = 8080;
const PASSWORD = 'Senha-forte-123';
const PERSON = 'Jadson';
const COMPETENCE = '2026-09';
const B_ONLY_DESCRIPTION = `B only backup isolation ${Date.now()}`;

let testEnv;
let setupApp;
let setupAuth;

function emailFor(label) {
  return `${label}-${Date.now()}-${Math.random().toString(16).slice(2)}@example.test`;
}

function ownerReference(uid) {
  return buildOperationFingerprint({
    commandName: 'owner-reference',
    sourceChannel: 'system',
    idempotencyKey: uid,
    payload: uid
  });
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value).sort().reduce((acc, key) => {
    acc[key] = stable(value[key]);
    return acc;
  }, {});
}

function stableRecords(records) {
  return records
    .map((record) => stable(record))
    .sort((a, b) => String(a.id || '').localeCompare(String(b.id || '')));
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
    created_at: '2026-09-18T00:00:00.000Z',
    updated_at: '2026-09-18T00:00:00.000Z',
    last_login_at: '2026-09-18T00:00:00.000Z'
  };
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'users', credential.user.uid), profile);
  });
  return { uid: credential.user.uid, email, password: PASSWORD };
}

function recordsForUser(account, ownerLabel = 'A') {
  const owner = { owner_uid: account.uid, owner_email: account.email, schema_version: 1 };
  if (ownerLabel === 'B') {
    return [{
      id: 'b-expense-only',
      type: 'saida',
      person: 'Bia',
      description: B_ONLY_DESCRIPTION,
      amount: 77,
      status: 'Em aberto',
      competence: COMPETENCE,
      due_date: '2026-09-20',
      ...owner
    }];
  }
  return [
    {
      id: 'reference-person-jadson',
      type: 'pessoa',
      person: PERSON,
      salary_base: 5000,
      receiving_type: 'mensal',
      created_at: '2026-09-18T00:00:00.000Z',
      ...owner
    },
    {
      id: 'reference-macro-fixo',
      type: 'macro',
      macro_category: 'FIXO',
      shared_scope: 'personal',
      created_at: '2026-09-18T00:00:00.000Z',
      ...owner
    },
    {
      id: 'reference-category-moradia',
      type: 'categoria',
      macro_category: 'FIXO',
      category_name: 'Moradia E2E',
      category_color: '#38bdf8',
      category_icon: 'home',
      shared_scope: 'personal',
      created_at: '2026-09-18T00:00:00.000Z',
      ...owner
    },
    {
      id: 'entry-a',
      type: 'entrada',
      person: PERSON,
      competence: COMPETENCE,
      amount: 5000,
      salary_base: 5000,
      overtime_total: 250,
      dsr_total: 50,
      cardLiquido: 4300,
      description: 'Entrada mensal backup',
      ...owner
    },
    {
      id: 'expense-a',
      type: 'saida',
      person: PERSON,
      description: 'Saida normal backup',
      amount: 123.45,
      status: 'Em aberto',
      competence: COMPETENCE,
      due_date: '2026-09-10',
      macro_category: 'FIXO',
      subcategory: 'Moradia E2E',
      password: 'fixture-password-secret',
      token: 'fixture-token-secret',
      telefone: '5599999999999',
      raw_file: { bytes: 'fixture-raw-file-secret' },
      nested: { accessToken: 'fixture-access-token-secret' },
      ...owner
    },
    ...[1, 2, 3].map((installment) => ({
      id: `parcelamento-a-${installment}`,
      type: 'saida',
      person: PERSON,
      description: `Notebook backup (${installment}/3)`,
      purchase_name: 'Notebook backup',
      amount: installment === 3 ? 33.34 : 33.33,
      status: installment === 1 ? 'Pago' : 'Em aberto',
      paid_at: installment === 1 ? '2026-09-16' : '',
      competence: `2026-${String(8 + installment).padStart(2, '0')}`,
      due_date: `2026-${String(8 + installment).padStart(2, '0')}-15`,
      is_installment: true,
      parent_id: 'parcelamento-parent-a',
      installment_no: installment,
      total_installments: 3,
      ...owner
    })),
    ...[1, 2].map((sequence) => ({
      id: `recurrence-a-${sequence}`,
      type: 'saida',
      person: PERSON,
      description: `Internet backup ${sequence}`,
      amount: 80,
      status: 'Em aberto',
      competence: `2026-${String(8 + sequence).padStart(2, '0')}`,
      due_date: `2026-${String(8 + sequence).padStart(2, '0')}-05`,
      recurrence_series_id: 'recurrence-series-a',
      recurrence_sequence_no: sequence,
      recurrence_total_occurrences: 2,
      recurrence_frequency: 'monthly',
      source_mode: 'recurring',
      ...owner
    })),
    {
      id: 'hours-a',
      type: 'controle_horas',
      person: PERSON,
      competence: COMPETENCE,
      occurred_date: '2026-09-12',
      hour_control_type: 'Hora Extra',
      start_time: '08:00',
      end_time: '18:00',
      break_start: '12:00',
      break_end: '13:00',
      gross_minutes: 600,
      break_minutes: 60,
      net_minutes: 540,
      extra_minutes: 60,
      financial_total: 85.5,
      ...owner
    }
  ];
}

async function seedFinanceRecords(account, ownerLabel = 'A') {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const recordsPath = ['users', account.uid, 'finance_records'];
    await Promise.all(recordsForUser(account, ownerLabel).map((record) =>
      setDoc(doc(context.firestore(), ...recordsPath, record.id), record)
    ));
  });
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

async function openSettingsBackup(page) {
  await page.evaluate(async () => {
    window.switchTab('configuracoes');
    document.getElementById('view-configuracoes')?.classList.remove('hidden');
  });
  await page.waitForFunction(() => window.renderConfiguracoes?.__financeModernSettings === true);
  await page.evaluate(() => window.renderConfiguracoes());
  await page.waitForFunction(() => window.financeApp?.backupActiveUi?.installed === true);
  await expect(page.locator('#backup-restore-panel')).toBeVisible();
}

async function readFinanceRecords(account) {
  let records = [];
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const snapshot = await getDocs(collection(context.firestore(), 'users', account.uid, 'finance_records'));
    records = snapshot.docs.map((recordDoc) => ({ id: recordDoc.id, ...recordDoc.data() }));
  });
  return stableRecords(records);
}

async function readAuditEvents(account) {
  let events = [];
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const snapshot = await getDocs(collection(context.firestore(), 'users', account.uid, 'audit_logs'));
    events = snapshot.docs.map((recordDoc) => ({ id: recordDoc.id, ...recordDoc.data() }));
  });
  return events;
}

function assertSnapshotHasExpectedStructure(snapshot, account) {
  expect(snapshot).toMatchObject({
    backup_version: FINANCE_BACKUP_VERSION,
    schema_version: FINANCE_BACKUP_SCHEMA_VERSION,
    owner_reference: ownerReference(account.uid),
    source_channel: 'web'
  });
  expect(snapshot.checksum).toBe(buildBackupChecksum(snapshot));
  expect(snapshot.record_counts).toMatchObject({
    finance_records: 7,
    personal_references: 3,
    hour_entries: 1
  });
  expect(snapshot.record_counts.local_settings).toBeGreaterThanOrEqual(0);
  expect(snapshot.collections.finance_records.some((record) => record.id === 'entry-a')).toBe(true);
  expect(snapshot.collections.finance_records.some((record) => record.id === 'expense-a')).toBe(true);
  expect(snapshot.collections.finance_records.some((record) => record.id === 'parcelamento-a-1')).toBe(true);
  expect(snapshot.collections.finance_records.some((record) => record.id === 'recurrence-a-1')).toBe(true);
  expect(snapshot.collections.hour_entries.some((record) => record.id === 'hours-a')).toBe(true);
  expect(JSON.stringify(snapshot)).not.toContain(B_ONLY_DESCRIPTION);
  [
    'fixture-password-secret',
    'fixture-token-secret',
    'fixture-raw-file-secret',
    'fixture-access-token-secret',
    '5599999999999'
  ].forEach((secret) => expect(JSON.stringify(snapshot)).not.toContain(secret));
  expect(ValidateFinanceBackupSnapshot({ snapshot, expectedOwnerReference: ownerReference(account.uid) })).toMatchObject({
    isValid: true,
    checksumValid: true
  });
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
  }, `backup-restore-local-${Date.now()}-${Math.random()}`);
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
  await testEnv?.cleanup();
});

test('backup download, restore dry-run and A -> B -> A isolation preserve local data', async ({ page }) => {
  const userA = await createActiveAccount('backup-a');
  const userB = await createActiveAccount('backup-b');
  await seedFinanceRecords(userA, 'A');
  await seedFinanceRecords(userB, 'B');

  await page.goto('/', { waitUntil: 'load' });
  await page.waitForFunction(() => window.__financeFirestoreDb && window.authSdk && window.userAdminSdk);
  expect(await page.evaluate(() => window.__financeFirestoreDb?.app?.options?.projectId)).toBe(PROJECT_ID);

  await signIn(page, userA);
  const beforeA = await readFinanceRecords(userA);
  await openSettingsBackup(page);

  await page.evaluate(() => {
    localStorage.setItem('finance-control-theme-v1', 'dark');
  });
  await page.locator('#btn-backup-preview').click();
  await page.waitForFunction(() => window.financeApp?.backupActiveUi?.controller?.getState?.().backupPreview?.metadata?.backupId);
  await expect(page.locator('#backup-summary')).toContainText('1.0.0');

  const downloadPromise = page.waitForEvent('download');
  await page.locator('#btn-backup-download').click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^finance-control-backup-\d{8}-\d{4}-v1\.0\.0\.json$/);
  const downloadPath = await download.path();
  const snapshot = JSON.parse(readFileSync(downloadPath, 'utf8'));
  assertSnapshotHasExpectedStructure(snapshot, userA);

  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => window.__financeFirestoreDb && window.authSdk && window.userAdminSdk);
  await expect(page.locator('#app')).toBeVisible();
  await openSettingsBackup(page);
  await page.locator('#backup-restore-file').setInputFiles({
    name: 'backup-user-a.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(snapshot))
  });
  await page.locator('#btn-backup-validate-restore').click();
  await page.waitForFunction(() => window.financeApp?.backupActiveUi?.controller?.getState?.().restoreValidation);
  await expect(page.locator('#restore-state')).not.toContainText(/CHECKSUM_INVALID|OWNER_REFERENCE_MISMATCH|Snapshot invalido/i);

  await page.locator('#btn-backup-restore-dry-run').click();
  await page.waitForFunction(() => window.financeApp?.backupActiveUi?.controller?.getState?.().restorePreview?.metadata?.restoreId);
  const dryRunState = await page.evaluate(() => window.financeApp.backupActiveUi.controller.getState().restorePreview.summary);
  expect(dryRunState).toMatchObject({ wrote: false });
  expect(dryRunState.wouldIgnore).toBeGreaterThanOrEqual(11);
  expect(dryRunState.wouldCreate).toBe(0);
  expect(await readFinanceRecords(userA)).toEqual(beforeA);

  await expect(page.locator('#btn-backup-restore-real')).toBeDisabled();
  const restoreReal = await page.evaluate(() => window.financeApp.backupActiveUi.controller.restoreRealUnavailable());
  expect(restoreReal).toMatchObject({ success: false, wrote: false });
  expect(String(restoreReal.error?.message || restoreReal.error?.code || '')).toContain('RESTORE_REAL_UNAVAILABLE');
  expect(await readFinanceRecords(userA)).toEqual(beforeA);
  expect((await readAuditEvents(userA)).some((event) => event.event_type === 'RESTORE_COMMITTED')).toBe(false);

  await signOutUi(page);
  await signIn(page, userB);
  await openSettingsBackup(page);
  await expect(page.locator('#backup-state')).toContainText('Nenhum backup gerado.');
  await page.locator('#backup-restore-file').setInputFiles({
    name: 'backup-user-a.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(snapshot))
  });
  await page.locator('#btn-backup-validate-restore').click();
  await page.waitForFunction(() => window.financeApp?.backupActiveUi?.controller?.getState?.().restoreValidation);
  const validationForB = await page.evaluate(() => window.financeApp.backupActiveUi.controller.getState().restoreValidation);
  expect(validationForB.isValid).toBe(false);
  expect(validationForB.errors.map((error) => error.code)).toContain('OWNER_REFERENCE_MISMATCH');
  expect(await readFinanceRecords(userB)).toEqual(stableRecords(recordsForUser(userB, 'B')));

  await signOutUi(page);
  await signIn(page, userA);
  expect(await readFinanceRecords(userA)).toEqual(beforeA);
});

test('tampered backup snapshot is rejected and produces zero finance record mutation', async ({ page }) => {
  const userA = await createActiveAccount('backup-tampered-a');
  await seedFinanceRecords(userA, 'A');

  await page.goto('/', { waitUntil: 'load' });
  await page.waitForFunction(() => window.__financeFirestoreDb && window.authSdk && window.userAdminSdk);
  await signIn(page, userA);
  const beforeA = await readFinanceRecords(userA);
  await openSettingsBackup(page);

  await page.locator('#btn-backup-preview').click();
  await page.waitForFunction(() => window.financeApp?.backupActiveUi?.controller?.getState?.().backupEnvelope?.checksum);
  const snapshot = await page.evaluate(() => window.financeApp.backupActiveUi.controller.getState().backupEnvelope);
  const tampered = {
    ...snapshot,
    backup_version: '99.0.0',
    collections: {
      ...snapshot.collections,
      finance_records: snapshot.collections.finance_records.map((record, index) =>
        index === 0 ? { ...record, amount: Number(record.amount || 0) + 1 } : record
      )
    }
  };

  await page.locator('#backup-restore-file').setInputFiles({
    name: 'backup-tampered.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(tampered))
  });
  await page.locator('#btn-backup-validate-restore').click();
  await page.waitForFunction(() => window.financeApp?.backupActiveUi?.controller?.getState?.().restoreValidation);
  const validation = await page.evaluate(() => window.financeApp.backupActiveUi.controller.getState().restoreValidation);
  expect(validation.isValid).toBe(false);
  expect(validation.checksumValid).toBe(false);
  expect(validation.errors.map((error) => error.code)).toEqual(expect.arrayContaining([
    'BACKUP_VERSION_UNSUPPORTED',
    'BACKUP_VERSION_INVALID',
    'CHECKSUM_INVALID'
  ]));

  await page.locator('#btn-backup-restore-dry-run').click();
  await expect(page.locator('#restore-state')).toContainText(/BACKUP_VERSION|Snapshot invalido|checksum|backup/i);
  expect(await readFinanceRecords(userA)).toEqual(beforeA);
  expect((await readAuditEvents(userA)).some((event) => event.event_type === 'RESTORE_COMMITTED')).toBe(false);
});
