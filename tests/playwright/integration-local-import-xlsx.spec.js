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
const PAYMENT_METHOD = 'Pix XLSX E2E';
const COMPETENCE = '2026-04';
const DESCRIPTIONS = [
  'XLSX aluguel local',
  'XLSX energia local',
  'XLSX internet local'
];
const VALID_ROWS = [
  { date: '2026-04-05', description: DESCRIPTIONS[0], amountText: '25,50', amount: 25.5, amountCents: 2550, externalId: 'xlsx-local-1' },
  { date: '2026-04-06', description: DESCRIPTIONS[1], amountText: '40,00', amount: 40, amountCents: 4000, externalId: 'xlsx-local-2' },
  { date: '2026-04-07', description: DESCRIPTIONS[2], amountText: '34,50', amount: 34.5, amountCents: 3450, externalId: 'xlsx-local-3' }
];
const HEADERS = ['Data', 'Classe', 'Categoria_macro', 'Categoria', 'Descricao', 'Parcela', 'Valor Orcado', 'STATUS', 'Pagamento', 'Quem paga', 'Data competencia', 'Identificador'];
const MIME_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

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
    await setDoc(doc(context.firestore(), ...recordsPath, 'reference-macro-fixo'), {
      type: 'macro',
      macro_category: MACRO,
      shared_scope: 'personal',
      created_at: '2026-09-13T00:00:00.000Z',
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

async function openImport(page) {
  await openTab(page, 'importacao');
  await expect(page.locator('#modern-import-panel [data-import-modern-root]')).toBeVisible();
}

async function showSaidas(page) {
  await openTab(page, 'dashboard');
  await page.locator('#f-comp-start').fill(COMPETENCE);
  await page.locator('#f-comp-end').fill(COMPETENCE);
  await openTab(page, 'saidas');
  await page.locator('#saidas-filter-all').click();
  await page.locator('#saidas-person-filter').selectOption(PERSON);
}

async function showDashboard(page) {
  await openTab(page, 'dashboard');
  await page.locator('#f-comp-start').fill(COMPETENCE);
  await page.locator('#f-comp-end').fill(COMPETENCE);
  const panelHidden = await page.locator('#advanced-filters-panel').evaluate((panel) => panel.classList.contains('hidden'));
  if (panelHidden) await page.locator('#btn-advanced-filters').click();
  await page.locator('#f-person').selectOption(PERSON);
}

async function readCollectionAs(account, collectionName, targetUid = account.uid) {
  const context = testEnv.authenticatedContext(account.uid, { email: account.email });
  try {
    const snapshot = await getDocs(collection(context.firestore(), 'users', targetUid, collectionName));
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

function importedExpenseRecords(records) {
  return records
    .filter((record) => record.type === 'saida' && DESCRIPTIONS.includes(record.description))
    .sort((a, b) => String(a.source_reference_id || '').localeCompare(String(b.source_reference_id || '')));
}

async function readImportedExpensesAs(account) {
  return importedExpenseRecords(await readCollectionAs(account, 'finance_records'));
}

async function waitImportedExpensesAs(account, expectedCount = 3) {
  let latest = [];
  await expect.poll(async () => {
    latest = await readImportedExpensesAs(account);
    return latest.length;
  }, { timeout: 15000 }).toBe(expectedCount);
  return latest;
}async function waitSpreadsheetReceiptsAs(account) {
  let latest = [];
  await expect.poll(async () => {
    latest = (await readCollectionAs(account, 'idempotency_receipts'))
      .filter((receipt) => receipt.source_channel === 'spreadsheet_import');
    return latest.filter((receipt) => receipt.command_name === 'ImportRowCommand' && receipt.status === 'completed').length;
  }, { timeout: 15000 }).toBe(3);
  return latest;
}async function waitImportAuditAs(account, batchId) {
  let latest = [];
  await expect.poll(async () => {
    latest = await readCollectionAs(account, 'audit_logs');
    const auditText = JSON.stringify(latest);
    return auditText.includes('IMPORT_COMMITTED') && auditText.includes('spreadsheet_import') && auditText.includes(batchId);
  }, { timeout: 15000 }).toBe(true);
  return latest;
}
async function currentImportedExpenses(page) {
  return page.evaluate((descriptions) => (window.allRecords || [])
    .filter((record) => record.type === 'saida' && descriptions.includes(record.description))
    .map((record) => ({
      id: record.id,
      type: record.type,
      person: record.person,
      description: record.description,
      amount: record.amount,
      status: record.status,
      payment_method: record.payment_method,
      occurred_date: record.occurred_date,
      due_date: record.due_date,
      paid_at: record.paid_at,
      competence: record.competence,
      owner_uid: record.owner_uid,
      owner_email: record.owner_email,
      macro_category: record.macro_category,
      subcategory: record.subcategory,
      category_name: record.category_name,
      source_channel: record.source_channel,
      source_mode: record.source_mode,
      import_source: record.import_source,
      import_batch_id: record.import_batch_id,
      source_reference_id: record.source_reference_id,
      idempotency_key: record.idempotency_key,
      correlation_id: record.correlation_id
    }))
    .sort((a, b) => String(a.source_reference_id || '').localeCompare(String(b.source_reference_id || ''))), DESCRIPTIONS);
}

function assertImportedRecords(records, account, originalIds = null) {
  expect(records).toHaveLength(3);
  if (originalIds) expect(records.map((record) => record.id)).toEqual(originalIds);
  expect(records.reduce((sum, record) => sum + cents(record.amount), 0)).toBe(10000);
  const batchIds = new Set(records.map((record) => record.import_batch_id));
  expect(batchIds.size).toBe(1);
  expect([...batchIds][0]).toMatch(/^batch_/);

  records.forEach((record, index) => {
    const expected = VALID_ROWS[index];
    expect(record).toMatchObject({
      type: 'saida',
      person: PERSON,
      description: expected.description,
      amount: expected.amount,
      status: 'Pago',
      payment_method: PAYMENT_METHOD,
      occurred_date: expected.date,
      due_date: `${COMPETENCE}-01`,
      paid_at: expected.date,
      competence: COMPETENCE,
      owner_uid: account.uid,
      owner_email: account.email,
      macro_category: MACRO,
      subcategory: CATEGORY,
      source_channel: 'spreadsheet_import',
      source_mode: 'import',
      import_source: 'saidas_xlsx',
      source_reference_id: expected.externalId
    });
    expect(cents(record.amount)).toBe(expected.amountCents);
    expect(record.idempotency_key).toContain('import-row:spreadsheet:');
    expect(record.correlation_id).toContain('import-');
  });
  return [...batchIds][0];
}

function xmlEscape(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
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
  const sheetRows = rows.map((row, rowIndex) => {
    const cells = row.map((value, columnIndex) => {
      const ref = `${columnName(columnIndex)}${rowIndex + 1}`;
      return `<c r="${ref}" t="inlineStr"><is><t>${xmlEscape(value)}</t></is></c>`;
    }).join('');
    return `<row r="${rowIndex + 1}">${cells}</row>`;
  }).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${sheetRows}</sheetData></worksheet>`;
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
  const end = Buffer.concat([
    uint32(0x06054b50), uint16(0), uint16(0), uint16(files.length), uint16(files.length),
    uint32(centralDirectory.length), uint32(offset), uint16(0)
  ]);
  return Buffer.concat([...localParts, centralDirectory, end]);
}

function xlsxBufferFromRows(rows) {
  return zipStore([
    { name: '[Content_Types].xml', content: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>' },
    { name: '_rels/.rels', content: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>' },
    { name: 'xl/workbook.xml', content: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Saidas" sheetId="1" r:id="rId1"/></sheets></workbook>' },
    { name: 'xl/_rels/workbook.xml.rels', content: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>' },
    { name: 'xl/worksheets/sheet1.xml', content: worksheetXml(rows) }
  ]);
}

function validWorkbookBuffer() {
  const rows = [
    HEADERS,
    ...VALID_ROWS.map((row) => [
      row.date,
      'Inicio do mes',
      MACRO,
      CATEGORY,
      row.description,
      '',
      row.amountText,
      'Pago',
      PAYMENT_METHOD,
      PERSON,
      COMPETENCE,
      row.externalId
    ])
  ];
  return xlsxBufferFromRows(rows);
}

function mixedWorkbookBuffer() {
  const valid = VALID_ROWS.map((row) => [
    row.date,
    'Inicio do mes',
    MACRO,
    CATEGORY,
    row.description,
    '',
    row.amountText,
    'Pago',
    PAYMENT_METHOD,
    PERSON,
    COMPETENCE,
    row.externalId
  ]);
  return xlsxBufferFromRows([
    HEADERS,
    ...valid,
    valid[0],
    ['2026-04-08', 'Inicio do mes', MACRO, CATEGORY, 'XLSX valor invalido local', '', 'abc', 'Pago', PAYMENT_METHOD, PERSON, COMPETENCE, 'xlsx-local-invalid']
  ]);
}

async function preparePreview(page, fileName, buffer) {
  await page.locator('#modern-import-kind').selectOption('expenses');
  await page.locator('#modern-import-file').setInputFiles({ name: fileName, mimeType: MIME_XLSX, buffer });
  await page.locator('#modern-import-preview').click();
  await page.waitForFunction(() => {
    const state = window.financeApp?.importActiveUi?.controller?.getState?.();
    return Boolean(state?.previewModel || state?.viewState?.error);
  });
  const stateSnapshot = await page.evaluate(() => {
    const state = window.financeApp?.importActiveUi?.controller?.getState?.();
    return {
      hasPreview: Boolean(state?.previewModel),
      error: state?.viewState?.error?.message || state?.viewState?.error?.code || '',
      errorText: document.getElementById('modern-import-error')?.textContent || ''
    };
  });
  expect(stateSnapshot, `IMPORT_PREVIEW_NOT_READY ${JSON.stringify(stateSnapshot)}`).toMatchObject({ hasPreview: true, error: '' });
  await expect(page.locator('#modern-import-summary')).toContainText('Prontas');
  return page.evaluate(() => window.financeApp.importActiveUi.controller.getState().previewModel);
}

async function commitPreview(page) {
  await page.locator('#modern-import-commit').click();
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
  }, `e2e-local-import-xlsx-${Date.now()}-${Math.random()}`);
  setupAuth = getAuth(setupApp);
  connectAuthEmulator(setupAuth, AUTH_EMULATOR_URL, { disableWarnings: true });
  const setupDb = getFirestore(setupApp);
  connectFirestoreEmulator(setupDb, FIRESTORE_HOST, FIRESTORE_PORT);
});

test.afterEach(async ({ page, context }) => {
  await page.close().catch(() => {});
  await context.close().catch(() => {});
  await signOut(setupAuth).catch(() => {});
  await deleteApp(setupApp).catch(() => {});
  await clearAuthEmulator();
});

test.afterAll(async () => {
  await testEnv.cleanup();
});

test('xlsx import persists only confirmed rows, survives reload, dedupes reimport and isolates A -> B -> A', async ({ page }) => {
  test.setTimeout(180_000);
  const userA = await createActiveAccount('xlsx-user-a');
  const userB = await createActiveAccount('xlsx-user-b');
  const workbook = validWorkbookBuffer();
  const renamedSameBytes = Buffer.from(workbook);

  await page.goto('/', { waitUntil: 'load' });
  await page.waitForFunction(() => window.__financeFirestoreDb && window.authSdk && window.userAdminSdk);
  const runtime = await page.evaluate(() => ({
    projectId: window.__financeFirestoreDb?.app?.options?.projectId,
    hasFinanceUiGlobal: Object.prototype.hasOwnProperty.call(window, 'financeUI')
  }));
  expect(runtime).toEqual({ projectId: PROJECT_ID, hasFinanceUiGlobal: false });

  await signIn(page, userA);
  await openImport(page);
  const previewA = await preparePreview(page, 'saidas-xlsx-local.xlsx', workbook);
  expect(previewA.summary).toMatchObject({ totalRows: 3, readyRows: 3, invalidRows: 0, duplicateRows: 0, conflictRows: 0 });
  expect(previewA.summary.readyAmountTotal).toBe(100);
  await expect(page.locator('#modern-import-rows')).toContainText(DESCRIPTIONS[0]);
  await expect(page.locator('#modern-import-rows')).toContainText('R$ 25,50');
  expect(await readImportedExpensesAs(userA)).toHaveLength(0);

  await commitPreview(page);
  await page.waitForFunction((descriptions) => (window.allRecords || []).filter((record) => record.type === 'saida' && descriptions.includes(record.description)).length === 3, DESCRIPTIONS);

  const createdForA = await currentImportedExpenses(page);
  const idsA = createdForA.map((record) => record.id);
  const batchIdA = assertImportedRecords(createdForA, userA);
  const persistedForA = await waitImportedExpensesAs(userA);
  expect(persistedForA.map((record) => record.id)).toEqual(idsA);
  assertImportedRecords(persistedForA, userA, idsA);

  const spreadsheetReceiptsA = await waitSpreadsheetReceiptsAs(userA);
  const completedRowReceiptsA = spreadsheetReceiptsA.filter((receipt) => receipt.command_name === 'ImportRowCommand' && receipt.status === 'completed');
  const batchReceiptA = spreadsheetReceiptsA.find((receipt) => receipt.command_name === 'CommitImportBatch');
  expect(completedRowReceiptsA).toHaveLength(3);
  if (batchReceiptA) {
    expect(['processing', 'completed']).toContain(batchReceiptA.status);
    if (batchReceiptA.status === 'completed') expect(batchReceiptA.entity_ids).toHaveLength(3);
  }

  const auditA = await waitImportAuditAs(userA, batchIdA);
  expect(auditA.length).toBeGreaterThanOrEqual(1);

  await showSaidas(page);
  for (const description of DESCRIPTIONS) await expect(page.locator('#saidas-list')).toContainText(description);
  await expect(page.locator('#saidas-total')).toContainText('R$ 100,00');
  await showDashboard(page);
  await expect(page.locator('#summary-cards')).toContainText('R$ 100,00');

  await page.reload({ waitUntil: 'load' });
  await expect(page.locator('#app')).toBeVisible();
  await page.waitForFunction(({ descriptions, ids }) => {
    const records = (window.allRecords || []).filter((record) => record.type === 'saida' && descriptions.includes(record.description));
    return records.length === 3 && ids.every((id) => records.some((record) => record.id === id));
  }, { descriptions: DESCRIPTIONS, ids: idsA });
  const afterReloadA = await currentImportedExpenses(page);
  assertImportedRecords(afterReloadA, userA, idsA);

  await openImport(page);
  const duplicatePreview = await preparePreview(page, 'saidas-xlsx-local.xlsx', workbook);
  expect(duplicatePreview.summary.readyRows).toBe(0);
  expect(duplicatePreview.summary.duplicateRows).toBe(3);
  await expect(page.locator('#modern-import-commit')).toBeDisabled();
  expect((await readImportedExpensesAs(userA)).map((record) => record.id)).toEqual(idsA);

  const renamedPreview = await preparePreview(page, 'saidas-xlsx-local-renomeado.xlsx', renamedSameBytes);
  expect(renamedPreview.summary.readyRows).toBe(0);
  expect(renamedPreview.summary.duplicateRows).toBe(3);
  expect(renamedPreview.metadata.batchId).toBe(duplicatePreview.metadata.batchId);
  await expect(page.locator('#modern-import-commit')).toBeDisabled();
  expect((await readImportedExpensesAs(userA)).map((record) => record.id)).toEqual(idsA);

  await signOutUi(page);
  await signIn(page, userB);
  await openImport(page);
  await expect(page.locator('#modern-import-file-meta')).toContainText('Nenhum arquivo selecionado');
  await expect(page.locator('#modern-import-file-meta')).not.toContainText('saidas-xlsx-local');
  await showSaidas(page);
  for (const description of DESCRIPTIONS) await expect(page.locator('#saidas-list')).not.toContainText(description);
  await showDashboard(page);
  await expect(page.locator('#summary-cards')).not.toContainText('R$ 100,00');
  expect(await readImportedExpensesAs(userB)).toHaveLength(0);
  await assertCannotReadOtherUserRecords(userB, userA.uid);

  await openImport(page);
  const previewB = await preparePreview(page, 'saidas-xlsx-local.xlsx', workbook);
  expect(previewB.summary).toMatchObject({ totalRows: 3, readyRows: 3, invalidRows: 0, duplicateRows: 0, conflictRows: 0 });
  await commitPreview(page);
  await page.waitForFunction((descriptions) => (window.allRecords || []).filter((record) => record.type === 'saida' && descriptions.includes(record.description)).length === 3, DESCRIPTIONS);
  const createdForB = await currentImportedExpenses(page);
  const idsB = createdForB.map((record) => record.id);
  assertImportedRecords(createdForB, userB);
  expect(idsB).not.toEqual(idsA);
  expect(await waitImportedExpensesAs(userB)).toHaveLength(3);

  await signOutUi(page);
  await signIn(page, userA);
  await page.waitForFunction(({ descriptions, ids }) => {
    const records = (window.allRecords || []).filter((record) => record.type === 'saida' && descriptions.includes(record.description));
    return records.length === 3 && ids.every((id) => records.some((record) => record.id === id));
  }, { descriptions: DESCRIPTIONS, ids: idsA });
  const returnedToA = await currentImportedExpenses(page);
  assertImportedRecords(returnedToA, userA, idsA);
  expect(await waitImportedExpensesAs(userA)).toHaveLength(3);
});

test('mixed xlsx preview classifies invalid and duplicate rows and cancel leaves no records', async ({ page }) => {
  const userA = await createActiveAccount('xlsx-validation-user-a');
  const mixedWorkbook = mixedWorkbookBuffer();

  await page.goto('/', { waitUntil: 'load' });
  await page.waitForFunction(() => window.__financeFirestoreDb && window.authSdk && window.userAdminSdk);
  await signIn(page, userA);
  await openImport(page);

  const preview = await preparePreview(page, 'saidas-xlsx-misto-local.xlsx', mixedWorkbook);
  expect(preview.summary).toMatchObject({ totalRows: 5, readyRows: 3, invalidRows: 1, duplicateRows: 1, conflictRows: 0 });
  expect(preview.summary.readyAmountTotal).toBe(100);
  await page.locator('[data-modern-import-tab="invalid"]').click();
  await expect(page.locator('#modern-import-rows')).toContainText('Valor invalido');
  await page.locator('[data-modern-import-tab="duplicates"]').click();
  await expect(page.locator('#modern-import-rows')).toContainText('Duplicidade interna');
  expect(await readImportedExpensesAs(userA)).toHaveLength(0);

  await page.locator('#btn-dashboard-home').click();
  await expect(page.locator('#view-dashboard')).toBeVisible();
  expect(await readImportedExpensesAs(userA)).toHaveLength(0);

  await openImport(page);
  await expect(page.locator('#modern-import-file-meta')).toContainText('Nenhum arquivo selecionado');
  await expect(page.locator('#modern-import-file-meta')).not.toContainText('saidas-xlsx-misto-local');
});
