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
const COMPETENCE = '2026-09';
const DUE_DATE = '2026-09-15';
const PAID_AT = '2026-09-20';
const EXPENSE_DESCRIPTION = `Release smoke saida ${Date.now()}`;
const INSTALLMENT_DESCRIPTION = `Release smoke parcelamento ${Date.now()}`;
const IMPORT_DESCRIPTION = `Release smoke xlsx ${Date.now()}`;
const HOUR_NOTE = `Release smoke horas ${Date.now()}`;
const HOUR_NOTE_EDITED = `${HOUR_NOTE} editado`;
const MIME_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const HEADERS = ['Data', 'Classe', 'Categoria_macro', 'Categoria', 'Descricao', 'Parcela', 'Valor Orcado', 'STATUS', 'Pagamento', 'Quem paga', 'Data competencia', 'Identificador'];

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
  const owner = { owner_uid: credential.user.uid, owner_email: email };
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'users', credential.user.uid), {
      uid: credential.user.uid,
      email,
      role: 'user',
      status: 'active',
      created_at: '2026-09-19T00:00:00.000Z',
      updated_at: '2026-09-19T00:00:00.000Z',
      last_login_at: '2026-09-19T00:00:00.000Z'
    });
    const recordsPath = ['users', credential.user.uid, 'finance_records'];
    await setDoc(doc(context.firestore(), ...recordsPath, 'reference-person-jadson'), {
      type: 'pessoa',
      person: PERSON,
      salary_base: 5000,
      receiving_type: 'mensal',
      created_at: '2026-09-19T00:00:00.000Z',
      ...owner
    });
    await setDoc(doc(context.firestore(), ...recordsPath, 'reference-macro-fixo'), {
      type: 'macro',
      macro_category: MACRO,
      shared_scope: 'personal',
      created_at: '2026-09-19T00:00:00.000Z',
      ...owner
    });
    await setDoc(doc(context.firestore(), ...recordsPath, 'reference-category-moradia'), {
      type: 'categoria',
      macro_category: MACRO,
      category_name: CATEGORY,
      category_color: '#38bdf8',
      category_icon: 'home',
      shared_scope: 'personal',
      created_at: '2026-09-19T00:00:00.000Z',
      ...owner
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

async function openTab(page, tab) {
  const sidebar = page.locator('#sidebar');
  const isHidden = await sidebar.evaluate((element) => element.classList.contains('-translate-x-full')).catch(() => true);
  if (isHidden) await page.locator('#btn-mobile-menu').click();
  await expect(sidebar).toBeVisible();
  await page.locator(`[data-tab="${tab}"]`).click();
  await expect(page.locator(`#view-${tab}`)).toBeVisible();
}

async function createPaidExpense(page) {
  await page.locator('#btn-new-record-header').click();
  await expect(page.locator('#view-novo')).toBeVisible();
  await page.locator('#form-person').selectOption(PERSON);
  await page.locator('#form-macro').selectOption(MACRO);
  await page.locator('#form-category').fill(CATEGORY);
  await page.locator('#form-desc').fill(EXPENSE_DESCRIPTION);
  await page.locator('#form-amount').fill('123.45');
  await page.locator('#form-status').selectOption('Pago');
  await page.locator('#form-payment').fill('Pix Smoke');
  await page.locator('#form-occurred').fill(DUE_DATE);
  await page.locator('#form-due').fill(DUE_DATE);
  await page.locator('#form-paid-at').fill(DUE_DATE);
  await page.locator('#form-competence').fill(COMPETENCE);
  await page.locator('#cycle-saida-inicio-mes').click();
  await page.locator('#btn-submit').click();
  await page.waitForFunction((description) => (window.allRecords || []).some((record) => record.type === 'saida' && record.description === description), EXPENSE_DESCRIPTION);
}

async function createAndPayInstallment(page) {
  await page.locator('#btn-new-record-header').click();
  await expect(page.locator('#view-novo')).toBeVisible();
  await page.locator('#form-person').selectOption(PERSON);
  await page.locator('#form-macro').selectOption(MACRO);
  await page.locator('#form-category').fill(CATEGORY);
  await page.locator('#form-desc').fill(INSTALLMENT_DESCRIPTION);
  await page.locator('#form-amount').fill('90.00');
  await page.locator('#form-status').selectOption('Em aberto');
  await page.locator('#form-payment').fill('Cartao Smoke');
  await page.locator('#form-occurred').fill(DUE_DATE);
  await page.locator('#form-due').fill(DUE_DATE);
  await page.locator('#form-competence').fill(COMPETENCE);
  await page.locator('#cycle-saida-inicio-mes').click();
  await page.locator('#form-expense-type').selectOption('parcelada');
  await page.locator('#form-installments').fill('3');
  await page.locator('#form-card').fill('Cartao Smoke');
  await page.locator('#btn-submit').click();
  await page.waitForFunction((description) =>
    (window.allRecords || []).filter((record) => record.purchase_name === description && record.is_installment === true).length === 3,
  INSTALLMENT_DESCRIPTION);

  await openTab(page, 'parcelamentos');
  await expect(page.locator('#parcelamentos-list')).toContainText(INSTALLMENT_DESCRIPTION);
  await page.locator('[data-parcelamentos-detail="mes"]').click();
  await expect(page.locator('#parcelamentos-detail-modal')).toBeVisible();
  const firstId = await page.evaluate((description) => (window.allRecords || [])
    .find((record) => record.purchase_name === description && record.installment_no === 1)?.id, INSTALLMENT_DESCRIPTION);
  await page.clock.setFixedTime(new Date(`${PAID_AT}T12:00:00.000Z`));
  await page.locator(`#parcelamentos-detail-list [data-finance-record-id="${firstId}"][data-finance-record-action="toggle-paid"]`).click();
  await expect.poll(async () => page.evaluate((id) => {
    const record = (window.allRecords || []).find((item) => item.id === id);
    return [record?.status, record?.paid_at];
  }, firstId), { timeout: 15000 }).toEqual(['Pago', PAID_AT]);
  await page.locator('#btn-close-parcelamentos-detail').click();
}

function xmlEscape(value) {
  return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;');
}

function columnName(index) {
  let name = '';
  let current = index + 1;
  while (current > 0) {
    const modulo = (current - 1) % 26;
    name = String.fromCharCode(65 + modulo) + name;
    current = Math.floor((current - modulo) / 26);
  }
  return name;
}

function worksheetXml(rows) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows.map((row, rowIndex) => `<row r="${rowIndex + 1}">${row.map((value, columnIndex) => {
    const ref = `${columnName(columnIndex)}${rowIndex + 1}`;
    return `<c r="${ref}" t="inlineStr"><is><t>${xmlEscape(value)}</t></is></c>`;
  }).join('')}</row>`).join('')}</sheetData></worksheet>`;
}

function crc32(buffer) {
  let table = crc32.table;
  if (!table) {
    table = new Uint32Array(256);
    for (let index = 0; index < 256; index += 1) {
      let value = index;
      for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
      table[index] = value >>> 0;
    }
    crc32.table = table;
  }
  let crc = 0xffffffff;
  for (const byte of buffer) crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function uint16(value) {
  const buffer = Buffer.alloc(2);
  buffer.writeUInt16LE(value);
  return buffer;
}

function uint32(value) {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32LE(value >>> 0);
  return buffer;
}

function zipStore(files) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  files.forEach(({ name, content }) => {
    const nameBuffer = Buffer.from(name, 'utf8');
    const contentBuffer = Buffer.from(content, 'utf8');
    const checksum = crc32(contentBuffer);
    const local = Buffer.concat([
      uint32(0x04034b50), uint16(20), uint16(0), uint16(0), uint16(0), uint16(0),
      uint32(checksum), uint32(contentBuffer.length), uint32(contentBuffer.length),
      uint16(nameBuffer.length), uint16(0), nameBuffer, contentBuffer
    ]);
    localParts.push(local);
    centralParts.push(Buffer.concat([
      uint32(0x02014b50), uint16(20), uint16(20), uint16(0), uint16(0), uint16(0), uint16(0),
      uint32(checksum), uint32(contentBuffer.length), uint32(contentBuffer.length),
      uint16(nameBuffer.length), uint16(0), uint16(0), uint16(0), uint16(0), uint32(0), uint32(offset), nameBuffer
    ]));
    offset += local.length;
  });
  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.concat([uint32(0x06054b50), uint16(0), uint16(0), uint16(files.length), uint16(files.length), uint32(centralDirectory.length), uint32(offset), uint16(0)]);
  return Buffer.concat([...localParts, centralDirectory, end]);
}

function xlsxBuffer() {
  const rows = [
    HEADERS,
    [DUE_DATE, 'Inicio do mes', MACRO, CATEGORY, IMPORT_DESCRIPTION, '', '25,50', 'Pago', 'Pix XLSX Smoke', PERSON, COMPETENCE, `release-smoke-${Date.now()}`]
  ];
  return zipStore([
    { name: '[Content_Types].xml', content: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>' },
    { name: '_rels/.rels', content: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>' },
    { name: 'xl/workbook.xml', content: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Saidas" sheetId="1" r:id="rId1"/></sheets></workbook>' },
    { name: 'xl/_rels/workbook.xml.rels', content: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>' },
    { name: 'xl/worksheets/sheet1.xml', content: worksheetXml(rows) }
  ]);
}

async function importXlsx(page) {
  await openTab(page, 'importacao');
  await page.locator('#modern-import-kind').selectOption('expenses');
  await page.locator('#modern-import-file').setInputFiles({
    name: 'release-readiness-smoke.xlsx',
    mimeType: MIME_XLSX,
    buffer: xlsxBuffer()
  });
  await page.locator('#modern-import-preview').click();
  await page.waitForFunction(() => window.financeApp?.importActiveUi?.controller?.getState?.().previewModel);
  await expect(page.locator('#modern-import-summary')).toContainText('Prontas');
  await page.locator('#modern-import-commit').click();
  await page.waitForFunction((description) => (window.allRecords || []).some((record) => record.description === description), IMPORT_DESCRIPTION);
}

async function createAndEditHour(page) {
  await openTab(page, 'controle-horas');
  await page.waitForFunction(() => window.saveHourControlRecord?.__financeModernHourControl === true);
  await page.locator('#controle-horas-competencia').fill(COMPETENCE);
  await page.evaluate(() => window.renderControleHoras?.());
  await page.locator('#btn-new-hour-control').click();
  await page.locator('#hour-person').selectOption(PERSON);
  await page.locator('#hour-competence').fill(COMPETENCE);
  await page.locator('#hour-date').fill(DUE_DATE);
  await page.locator('#hour-type').selectOption('Banco de Horas');
  await page.locator('#hour-start').fill('08:00');
  await page.locator('#hour-end').fill('17:00');
  await page.locator('#hour-break-start').fill('12:00');
  await page.locator('#hour-break-end').fill('13:00');
  await page.locator('#hour-bank-nature').selectOption('Débito');
  await page.locator('#hour-note').fill(HOUR_NOTE);
  await page.locator('#btn-save-hour-control').click();
  await page.waitForFunction((note) => (window.allRecords || []).some((record) => record.type === 'controle_horas' && record.observation === note), HOUR_NOTE);
  await page.locator(`[data-open-hour-detail="${PERSON}|${COMPETENCE}"]`).click();
  await page.locator('[data-edit-hour-control-record]').first().click();
  await page.locator('#hour-end').fill('18:00');
  await page.locator('#hour-note').fill(HOUR_NOTE_EDITED);
  await page.locator('#btn-save-hour-control').click();
  await page.waitForFunction((note) => (window.allRecords || []).some((record) => record.type === 'controle_horas' && record.observation === note && record.net_minutes === 540), HOUR_NOTE_EDITED);
  await page.locator('#btn-close-hour-detail-modal').click();
  await expect(page.locator('#hour-detail-modal')).toBeHidden();
}

async function backupAndDryRunRestore(page) {
  await page.evaluate(async () => {
    window.switchTab('configuracoes');
    document.getElementById('view-configuracoes')?.classList.remove('hidden');
  });
  await page.waitForFunction(() => window.renderConfiguracoes?.__financeModernSettings === true);
  await page.evaluate(() => window.renderConfiguracoes());
  await page.waitForFunction(() => window.financeApp?.backupActiveUi?.installed === true);
  await page.locator('#btn-backup-preview').click();
  await page.waitForFunction(() => window.financeApp?.backupActiveUi?.controller?.getState?.().backupEnvelope?.checksum);
  const snapshot = await page.evaluate(() => window.financeApp.backupActiveUi.controller.getState().backupEnvelope);
  await page.locator('#backup-restore-file').setInputFiles({
    name: 'release-readiness-smoke-backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(snapshot))
  });
  await page.locator('#btn-backup-validate-restore').click();
  await page.waitForFunction(() => window.financeApp?.backupActiveUi?.controller?.getState?.().restoreValidation);
  const result = await page.evaluate(async () => window.financeApp.backupActiveUi.controller.runRestoreDryRun());
  expect(result).toMatchObject({ success: true, wrote: false });
  await page.waitForFunction(() => window.financeApp?.backupActiveUi?.controller?.getState?.().restorePreview?.metadata?.restoreId);
  const summary = await page.evaluate(() => window.financeApp.backupActiveUi.controller.getState().restorePreview.summary);
  expect(summary.wrote).toBe(false);
  await expect(page.locator('#btn-backup-restore-real')).toBeDisabled();
}

async function assertBasicUiHealth(page) {
  await page.evaluate(() => window.switchTab('dashboard'));
  await page.locator('#f-comp-start').fill(COMPETENCE);
  await page.locator('#f-comp-end').fill(COMPETENCE);
  await expect(page.locator('#summary-cards')).toContainText('R$');
  const health = await page.evaluate(() => ({
    hasFinanceUiGlobal: Object.prototype.hasOwnProperty.call(window, 'financeUI'),
    overflow: document.documentElement.scrollWidth - window.innerWidth,
    unnamedButtons: [...document.querySelectorAll('button')].filter((button) => !button.textContent.trim() && !button.getAttribute('aria-label') && !button.getAttribute('title')).length
  }));
  expect(health.hasFinanceUiGlobal).toBe(false);
  expect(health.overflow).toBeLessThanOrEqual(4);
  expect(health.unnamedButtons).toBeLessThanOrEqual(25);
}

async function readFinanceRecords(account) {
  const context = testEnv.authenticatedContext(account.uid, { email: account.email });
  try {
    const snapshot = await getDocs(collection(context.firestore(), 'users', account.uid, 'finance_records'));
    return snapshot.docs.map((recordDoc) => ({ id: recordDoc.id, ...recordDoc.data() }));
  } finally {
    await context.cleanup();
  }
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
  }, `release-readiness-smoke-${Date.now()}-${Math.random()}`);
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

test('release readiness smoke covers core local journey without production access', async ({ page }) => {
  await page.clock.setFixedTime(new Date(`${PAID_AT}T12:00:00.000Z`));
  test.setTimeout(240_000);
  const account = await createActiveAccount('release-smoke');
  await page.goto('/', { waitUntil: 'load' });
  await page.waitForFunction(() => window.__financeFirestoreDb && window.authSdk && window.userAdminSdk);
  expect(await page.evaluate(() => window.__financeFirestoreDb?.app?.options?.projectId)).toBe(PROJECT_ID);

  await signIn(page, account);
  await backupAndDryRunRestore(page);
  await createPaidExpense(page);
  await createAndPayInstallment(page);
  await importXlsx(page);
  await createAndEditHour(page);
  await page.reload({ waitUntil: 'load' });
  await expect(page.locator('#app')).toBeVisible();
  await assertBasicUiHealth(page);

  const records = await readFinanceRecords(account);
  expect(records.some((record) => record.description === EXPENSE_DESCRIPTION)).toBe(true);
  expect(records.some((record) => record.description === IMPORT_DESCRIPTION)).toBe(true);
  expect(records.some((record) => record.purchase_name === INSTALLMENT_DESCRIPTION && record.status === 'Pago')).toBe(true);
  expect(records.some((record) => record.type === 'controle_horas' && record.observation === HOUR_NOTE_EDITED)).toBe(true);
});
