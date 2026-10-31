import { expect, test } from '@playwright/test';

const accounts = {
  A: { email: process.env.STAGING_A_EMAIL, password: process.env.STAGING_A_PASSWORD, uid: process.env.STAGING_A_UID },
  B: { email: process.env.STAGING_B_EMAIL, password: process.env.STAGING_B_PASSWORD, uid: process.env.STAGING_B_UID },
  pending: { email: process.env.STAGING_PENDING_EMAIL, password: process.env.STAGING_PENDING_PASSWORD, uid: process.env.STAGING_PENDING_UID },
  inactive: { email: process.env.STAGING_INACTIVE_EMAIL, password: process.env.STAGING_INACTIVE_PASSWORD, uid: process.env.STAGING_INACTIVE_UID }
};

const runId = Date.now();
const expenseDescription = `staging-ui-${runId}-saida`;
const MIME_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const XLSX_HEADERS = ['Data', 'Classe', 'Categoria_macro', 'Categoria', 'Descricao', 'Parcela', 'Valor Orcado', 'STATUS', 'Pagamento', 'Quem paga', 'Data competencia', 'Identificador'];

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

function stagingXlsxBuffer(description, externalId) {
  const rows = [
    XLSX_HEADERS,
    ['2026-10-17', 'Inicio do mes', 'STAGING FIXO', 'Moradia Staging', description, '', '19,90', 'Pago', 'Pix Sintetico', 'Pessoa Sintetica A', '2026-10', externalId]
  ];
  return zipStore([
    { name: '[Content_Types].xml', content: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>' },
    { name: '_rels/.rels', content: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>' },
    { name: 'xl/workbook.xml', content: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Saidas" sheetId="1" r:id="rId1"/></sheets></workbook>' },
    { name: 'xl/_rels/workbook.xml.rels', content: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>' },
    { name: 'xl/worksheets/sheet1.xml', content: worksheetXml(rows) }
  ]);
}

async function openTab(page, tab) {
  const sidebar = page.locator('#sidebar');
  const isMobile = (page.viewportSize()?.width || 1280) < 1024;
  if (isMobile) {
    const hidden = await sidebar.evaluate((element) => element.classList.contains('-translate-x-full')).catch(() => true);
    if (hidden) await page.locator('#btn-mobile-menu').click();
    await page.locator(`[data-tab="${tab}"]`).click();
  } else {
    await page.evaluate((targetTab) => window.switchTab(targetTab), tab);
  }
  await expect(page.locator(`#view-${tab}`)).toBeVisible();
  if (isMobile) await expect(page.locator('#sidebar-overlay')).toBeHidden();
}

async function readAuditEventTypes(page, uid, projectId) {
  const token = await page.evaluate(() => window.authSdk.getCurrentUser().getIdToken());
  const response = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${uid}/audit_logs?pageSize=300`, {
    headers: { authorization: `Bearer ${token}` }
  });
  if (!response.ok) throw new Error(`STAGING_AUDIT_READ_FAILED:${response.status}`);
  const payload = await response.json();
  return (payload.documents || []).map((document) => document.fields?.event_type?.stringValue).filter(Boolean);
}

function requireAccounts() {
  for (const [label, account] of Object.entries(accounts)) {
    if (!account.email || !account.password || !account.uid) throw new Error(`STAGING_${label.toUpperCase()}_CREDENTIALS_REQUIRED`);
  }
}

async function readSessionState(page) {
  return page.evaluate(() => ({
    authUid: window.authSdk?.getCurrentUser?.()?.uid || null,
    contextUid: window.financeApp?.authContext?.uid || null,
    profileUid: window.financeApp?.authContext?.profile?.uid || null,
    profileStatus: window.financeApp?.authContext?.profile?.status || null,
    appVisible: Boolean(document.getElementById('app')?.getClientRects().length),
    accessNoticeVisible: Boolean(document.getElementById('account-access-notice')?.getClientRects().length)
  }));
}

async function waitForSessionReady(page, account, expectedStatus) {
  await page.waitForFunction((uid) => window.authSdk?.getCurrentUser?.()?.uid === uid, account.uid);
  await page.waitForFunction(({ uid, status }) => (
    window.financeApp?.authContext?.uid === uid
    && window.financeApp?.authContext?.profile?.uid === uid
    && window.financeApp?.authContext?.profile?.status === status
  ), { uid: account.uid, status: expectedStatus });
  if (expectedStatus === 'active') {
    await expect(page.locator('#app')).toBeVisible();
    await expect(page.locator('#auth-screen')).toBeHidden();
    await expect(page.locator('#account-access-notice')).toBeHidden();
    await page.waitForFunction((uid) => window.__financeCacheState?.uid === uid && window.__financeCacheState.source === 'firebase', account.uid);
  } else {
    await expect(page.locator('#account-access-notice')).toBeVisible();
    await expect(page.locator('#app')).toBeHidden();
    const expectedTitle = expectedStatus === 'pending' ? /aprova|valida|pendente/i : /inativ|desativad/i;
    await expect(page.locator('#account-access-title')).toContainText(expectedTitle);
  }
  const state = await readSessionState(page);
  console.log('STAGING_SESSION_READY', JSON.stringify({ expectedStatus, ...state }));
  return state;
}

async function signIn(page, account, expectedStatus = 'active') {
  await page.waitForFunction(() => window.__financeFirestoreDb && window.authSdk && window.userAdminSdk);
  await page.locator('#auth-email').fill(account.email);
  await page.locator('#auth-password').fill(account.password);
  await page.locator('#auth-submit').click();
  return waitForSessionReady(page, account, expectedStatus);
}

async function signOutUi(page) {
  const status = await page.evaluate(() => window.financeApp?.authContext?.profile?.status || null);
  const logout = status === 'active' ? page.locator('#btn-logout') : page.locator('#account-logout-button');
  await logout.click();
  await page.waitForFunction(() => window.authSdk?.getCurrentUser?.() === null);
  await page.waitForFunction(() => {
    const context = window.financeApp?.authContext;
    return !context?.uid && context?.currentUser == null && context?.profile == null;
  });
  await page.waitForFunction(() => !window.__financeCacheState?.uid && window.__financeCacheState?.source === 'logout');
  await expect(page.locator('#auth-screen')).toBeVisible();
  console.log('STAGING_SESSION_CLEARED', JSON.stringify(await readSessionState(page)));
}

function monitorIsolation(page, expectedProjectId, productionProjectId) {
  const requests = [];
  const consoleErrors = [];
  page.on('request', (request) => requests.push(request.url()));
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    consoleErrors.push(message.text());
    console.log('STAGING_BROWSER_ERROR', message.text());
  });
  return async () => {
    expect(await page.evaluate(() => window.__financeFirestoreDb?.app?.options?.projectId)).toBe(expectedProjectId);
    expect(requests.some((url) => url.includes(productionProjectId))).toBe(false);
    expect(consoleErrors.filter((message) => !/permission-denied|missing or insufficient permissions/i.test(message))).toEqual([]);
  };
}

test('staging loads with staging Firebase config and no production requests', async ({ page }, testInfo) => {
  const expectedProjectId = testInfo.project.use.expectedProjectId;
  const productionProjectId = testInfo.project.use.productionProjectId;
  const requests = [];
  const consoleErrors = [];

  page.on('request', (request) => {
    requests.push(request.url());
  });
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });

  await page.goto('/', { waitUntil: 'load' });
  await page.waitForFunction(() => window.__financeFirestoreDb?.app?.options?.projectId);

  const runtimeProjectId = await page.evaluate(() => window.__financeFirestoreDb.app.options.projectId);
  expect(runtimeProjectId).toBe(expectedProjectId);
  expect(runtimeProjectId).not.toBe(productionProjectId);
  expect(requests.some((url) => url.includes(productionProjectId))).toBe(false);

  await expect(page.locator('#auth-screen')).toBeVisible();
  await expect(page.locator('#auth-email')).toBeVisible();
  await expect(page.locator('#auth-password')).toBeVisible();
  expect(consoleErrors.filter((message) => !/CONFIGURATION_NOT_FOUND|auth\/configuration-not-found/i.test(message))).toEqual([]);
});

test('diagnoses active profile value used by the staging UI', async ({ page }, testInfo) => {
  requireAccounts();
  const requests = [];
  const consoleErrors = [];
  page.on('request', (request) => requests.push(request.url()));
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  await page.goto('/', { waitUntil: 'load' });
  await page.waitForFunction(() => window.__financeFirestoreDb && window.authSdk && window.userAdminSdk);
  await page.locator('#auth-email').fill(accounts.A.email);
  await page.locator('#auth-password').fill(accounts.A.password);
  await page.locator('#auth-submit').click();
  await page.waitForFunction((uid) => window.authSdk?.getCurrentUser?.()?.uid === uid, accounts.A.uid);
  await page.waitForFunction((uid) => window.financeApp?.authContext?.uid === uid && window.financeApp?.authContext?.profile?.uid === uid, accounts.A.uid);
  const diagnostic = await page.evaluate(async (expectedUid) => {
    const authUser = window.authSdk?.getCurrentUser?.();
    const directProfile = authUser ? await window.userAdminSdk.getProfile(authUser.uid) : null;
    return {
      expectedUid,
      authUid: authUser?.uid || null,
      authEmail: authUser?.email || null,
      projectId: window.__financeFirestoreDb?.app?.options?.projectId || null,
      directProfile,
      currentUserProfile: window.currentUserProfile || null,
      financeAuthContext: window.financeApp?.authContext || null,
      accountStatus: window.currentAccountStatus || null,
      role: window.currentUserRole || null,
      appVisible: !document.getElementById('app')?.classList.contains('hidden'),
      accessTitle: document.getElementById('account-access-title')?.textContent || ''
    };
  }, accounts.A.uid);
  console.log('STAGING_PROFILE_DIAGNOSTIC', JSON.stringify(diagnostic));
  expect(diagnostic.authUid).toBe(accounts.A.uid);
  expect(diagnostic.projectId).toBe(testInfo.project.use.expectedProjectId);
  expect(requests.some((url) => url.includes(testInfo.project.use.productionProjectId))).toBe(false);
  expect(consoleErrors).toEqual([]);
});

test('active A -> B -> A CRUD persists and stays isolated through the real UI', async ({ page }, testInfo) => {
  requireAccounts();
  const assertIsolation = monitorIsolation(page, testInfo.project.use.expectedProjectId, testInfo.project.use.productionProjectId);
  await page.goto('/', { waitUntil: 'load' });
  await page.waitForFunction(() => window.__financeFirestoreDb && window.authSdk && window.userAdminSdk);
  await signIn(page, accounts.A);

  await page.locator('#btn-new-record-header').click();
  await page.locator('#form-person').selectOption('Pessoa Sintetica A');
  await page.locator('#form-macro').selectOption('STAGING FIXO');
  await page.locator('#form-category').fill('Moradia Staging');
  await page.locator('#form-desc').fill(expenseDescription);
  await page.locator('#form-amount').fill('12.34');
  await page.locator('#form-status').selectOption('Em aberto');
  await page.locator('#form-payment').fill('Pix Sintetico');
  await page.locator('#form-occurred').fill('2026-10-17');
  await page.locator('#form-due').fill('2026-10-20');
  await page.locator('#form-competence').fill('2026-10');
  await page.locator('#cycle-saida-inicio-mes').click();
  await page.locator('#btn-submit').click();
  await page.waitForFunction((description) => (window.allRecords || []).some((record) => record.description === description), expenseDescription);
  await page.reload({ waitUntil: 'load' });
  await waitForSessionReady(page, accounts.A, 'active');
  await page.waitForFunction((description) => (window.allRecords || []).some((record) => record.description === description), expenseDescription);
  await signOutUi(page);
  await signIn(page, accounts.B);
  expect(await page.evaluate((description) => (window.allRecords || []).some((record) => record.description === description), expenseDescription)).toBe(false);
  await signOutUi(page);
  await signIn(page, accounts.A);
  await expect.poll(() => page.evaluate((description) => (window.allRecords || []).some((record) => record.description === description), expenseDescription), { timeout: 15_000 }).toBe(true);
  await assertIsolation();
});

test('account lifecycle uses canonical ready states across active, pending and inactive', async ({ page }, testInfo) => {
  requireAccounts();
  const assertIsolation = monitorIsolation(page, testInfo.project.use.expectedProjectId, testInfo.project.use.productionProjectId);
  await page.goto('/', { waitUntil: 'load' });

  await signIn(page, accounts.A, 'active');
  await signOutUi(page);
  await signIn(page, accounts.B, 'active');
  await signOutUi(page);
  await signIn(page, accounts.A, 'active');
  await page.reload({ waitUntil: 'load' });
  await waitForSessionReady(page, accounts.A, 'active');
  await signOutUi(page);

  await signIn(page, accounts.pending, 'pending');
  await page.reload({ waitUntil: 'load' });
  await waitForSessionReady(page, accounts.pending, 'pending');
  await signOutUi(page);
  await signIn(page, accounts.inactive, 'inactive');
  await page.reload({ waitUntil: 'load' });
  await waitForSessionReady(page, accounts.inactive, 'inactive');
  await signOutUi(page);
  await signIn(page, accounts.pending, 'pending');
  await signOutUi(page);
  await signIn(page, accounts.inactive, 'inactive');
  await signOutUi(page);
  await signIn(page, accounts.A, 'active');
  await assertIsolation();
});

test('mobile staging covers login, XLSX, hours and backup without critical horizontal overflow', async ({ page }, testInfo) => {
  requireAccounts();
  await page.setViewportSize({ width: 390, height: 844 });
  const assertIsolation = monitorIsolation(page, testInfo.project.use.expectedProjectId, testInfo.project.use.productionProjectId);
  await page.goto('/', { waitUntil: 'load' });
  await page.waitForFunction(() => window.__financeFirestoreDb?.app?.options?.projectId);
  await expect(page.locator('#auth-submit')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(4);
  await signIn(page, accounts.A);
  await openTab(page, 'importacao');
  await expect(page.locator('#modern-import-file')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), 'mobile overflow on importacao').toBeLessThanOrEqual(4);
  await openTab(page, 'controle-horas');
  await expect(page.locator('#btn-new-hour-control')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), 'mobile overflow on controle-horas').toBeLessThanOrEqual(4);
  await openTab(page, 'configuracoes');
  await page.waitForFunction(() => window.financeApp?.backupActiveUi?.installed === true);
  await expect(page.locator('#btn-backup-preview')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), 'mobile overflow on configuracoes').toBeLessThanOrEqual(4);
  await assertIsolation();
});

test('staging UI exercises installments, payment and recurrence', async ({ page }, testInfo) => {
  requireAccounts();
  const assertIsolation = monitorIsolation(page, testInfo.project.use.expectedProjectId, testInfo.project.use.productionProjectId);
  const installment = `staging-ui-${runId}-parcelamento`;
  const recurrence = `staging-ui-${runId}-recorrencia`;
  await page.goto('/', { waitUntil: 'load' });
  await signIn(page, accounts.A);

  const fillBaseExpense = async (description) => {
    await page.locator('#btn-new-record-header').click();
    await page.locator('#form-person').selectOption('Pessoa Sintetica A');
    await page.locator('#form-macro').selectOption('STAGING FIXO');
    await page.locator('#form-category').fill('Moradia Staging');
    await page.locator('#form-desc').fill(description);
    await page.locator('#form-amount').fill('30.00');
    await page.locator('#form-status').selectOption('Em aberto');
    await page.locator('#form-payment').fill('Cartao Sintetico');
    await page.locator('#form-occurred').fill('2026-10-17');
    await page.locator('#form-due').fill('2026-10-20');
    await page.locator('#form-competence').fill('2026-10');
    await page.locator('#cycle-saida-inicio-mes').click();
  };

  await fillBaseExpense(installment);
  await page.locator('#form-expense-type').selectOption('parcelada');
  await page.locator('#form-installments').fill('2');
  await page.locator('#form-card').fill('Cartao Sintetico');
  await page.locator('#btn-submit').click();
  await page.waitForFunction((description) => (window.allRecords || []).filter((record) => record.purchase_name === description && record.is_installment).length === 2, installment);
  const installmentId = await page.evaluate((description) => (window.allRecords || []).find((record) => record.purchase_name === description && record.installment_no === 1)?.id, installment);
  await page.evaluate(() => window.switchTab('parcelamentos'));
  await page.locator('[data-parcelamentos-detail="mes"]').click();
  await page.locator(`#parcelamentos-detail-list [data-finance-record-id="${installmentId}"][data-finance-record-action="toggle-paid"]`).click();
  await expect.poll(() => page.evaluate((id) => (window.allRecords || []).find((record) => record.id === id)?.status, installmentId)).toBe('Pago');
  await page.locator('#btn-close-parcelamentos-detail').click();

  await fillBaseExpense(recurrence);
  await page.locator('#form-expense-type').selectOption('a_vista');
  await page.locator('#form-recurrence').selectOption('mensal');
  await page.locator('#form-recurrence-termination').selectOption('count');
  await page.locator('#form-recurrence-count').fill('3');
  await page.locator('#btn-submit').click();
  await page.waitForFunction((description) => (window.allRecords || []).filter((record) => record.purchase_name === description && record.source_mode === 'recurring').length === 3, recurrence);
  await assertIsolation();
});

test('staging UI exercises hours and backup restore dry-run', async ({ page }, testInfo) => {
  requireAccounts();
  const assertIsolation = monitorIsolation(page, testInfo.project.use.expectedProjectId, testInfo.project.use.productionProjectId);
  const hourNote = `staging-ui-${runId}-horas`;
  await page.goto('/', { waitUntil: 'load' });
  await signIn(page, accounts.A);
  await page.evaluate(() => window.switchTab('controle-horas'));
  await page.waitForFunction(() => window.saveHourControlRecord?.__financeModernHourControl === true);
  await page.locator('#controle-horas-competencia').fill('2026-10');
  await page.evaluate(() => window.renderControleHoras?.());
  await page.locator('#btn-new-hour-control').click();
  await page.locator('#hour-person').selectOption('Pessoa Sintetica A');
  await page.locator('#hour-competence').fill('2026-10');
  await page.locator('#hour-date').fill('2026-10-17');
  await page.locator('#hour-type').selectOption('Banco de Horas');
  await page.locator('#hour-start').fill('08:00');
  await page.locator('#hour-end').fill('17:00');
  await page.locator('#hour-break-start').fill('12:00');
  await page.locator('#hour-break-end').fill('13:00');
  await page.locator('#hour-bank-nature').selectOption({ index: 1 });
  await page.locator('#hour-note').fill(hourNote);
  await page.locator('#btn-save-hour-control').click();
  await page.waitForFunction((note) => (window.allRecords || []).some((record) => record.type === 'controle_horas' && record.observation === note), hourNote);
  const hourId = await page.evaluate((note) => (window.allRecords || []).find((record) => record.type === 'controle_horas' && record.observation === note)?.id, hourNote);
  await page.locator(`[data-open-hour-detail="Pessoa Sintetica A|2026-10"]`).click();
  await page.locator(`[data-edit-hour-control-record="${hourId}"]`).click();
  await page.locator('#hour-end').fill('18:00');
  await page.locator('#hour-note').fill(`${hourNote}-editado`);
  await page.locator('#btn-save-hour-control').click();
  await page.waitForFunction(({ id, note }) => (window.allRecords || []).some((record) => record.id === id && record.observation === note && record.net_minutes === 540), { id: hourId, note: `${hourNote}-editado` });
  await expect.poll(async () => readAuditEventTypes(page, accounts.A.uid, testInfo.project.use.expectedProjectId), { timeout: 15_000 }).toEqual(expect.arrayContaining(['HOUR_ENTRY_CREATED', 'HOUR_ENTRY_UPDATED']));
  await page.locator('#btn-close-hour-detail-modal').click();
  await expect(page.locator('#hour-detail-modal')).toBeHidden();

  await page.evaluate(() => window.switchTab('configuracoes'));
  await page.waitForFunction(() => window.financeApp?.backupActiveUi?.installed === true);
  await page.locator('#btn-backup-preview').click();
  await page.waitForFunction(() => window.financeApp?.backupActiveUi?.controller?.getState?.().backupEnvelope?.checksum);
  const envelope = await page.evaluate(() => window.financeApp.backupActiveUi.controller.getState().backupEnvelope);
  expect(envelope.backup_version).toBeTruthy();
  expect(envelope.checksum).toBeTruthy();
  expect(envelope.owner_reference).toBeTruthy();
  await page.locator('#backup-restore-file').setInputFiles({ name: 'staging-synthetic-backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(envelope)) });
  await page.locator('#btn-backup-validate-restore').click();
  await page.waitForFunction(() => window.financeApp?.backupActiveUi?.controller?.getState?.().restoreValidation);
  const restoreValidation = await page.evaluate(() => window.financeApp.backupActiveUi.controller.getState().restoreValidation);
  console.log('STAGING_BACKUP_VALIDATION', JSON.stringify({
    isValid: restoreValidation.isValid,
    compatible: restoreValidation.compatible,
    checksumValid: restoreValidation.checksumValid,
    detectedVersion: restoreValidation.detectedVersion,
    errorCodes: (restoreValidation.errors || []).map((error) => error.code),
    counts: restoreValidation.counts
  }));
  expect(restoreValidation.isValid, JSON.stringify(restoreValidation.errors || [])).toBe(true);
  expect((restoreValidation.errors || []).some((error) => error.code === 'ORPHAN_REFERENCE')).toBe(false);
  await page.locator('#btn-backup-restore-dry-run').click();
  await page.waitForFunction(() => window.financeApp?.backupActiveUi?.controller?.getState?.().restorePreview?.metadata?.restoreId);
  const dryRun = await page.evaluate(() => window.financeApp.backupActiveUi.controller.getState().restorePreview.summary);
  expect(dryRun).toMatchObject({ wrote: false });
  await expect(page.locator('#btn-backup-restore-real')).toBeDisabled();
  await assertIsolation();
});

test('staging XLSX import persists and renamed reimport stays idempotent', async ({ page }, testInfo) => {
  requireAccounts();
  const assertIsolation = monitorIsolation(page, testInfo.project.use.expectedProjectId, testInfo.project.use.productionProjectId);
  const description = `staging-ui-${runId}-xlsx`;
  const externalId = `staging-xlsx-${runId}`;
  const workbook = stagingXlsxBuffer(description, externalId);
  await page.goto('/', { waitUntil: 'load' });
  await signIn(page, accounts.A);
  await openTab(page, 'importacao');
  await page.waitForFunction(() => window.financeApp?.importActiveUi?.installed === true);

  const prepare = async (name) => {
    await page.locator('#modern-import-kind').selectOption('expenses');
    await page.locator('#modern-import-file').setInputFiles({ name, mimeType: MIME_XLSX, buffer: workbook });
    await page.locator('#modern-import-preview').click();
    await page.waitForFunction(() => window.financeApp?.importActiveUi?.controller?.getState?.().previewModel);
    return page.evaluate(() => window.financeApp.importActiveUi.controller.getState().previewModel);
  };

  const firstPreview = await prepare('staging-synthetic-import.xlsx');
  expect(firstPreview.summary).toMatchObject({ totalRows: 1, readyRows: 1, duplicateRows: 0, invalidRows: 0 });
  await page.locator('#modern-import-commit').click();
  await page.waitForFunction((expected) => (window.allRecords || []).filter((record) => record.description === expected).length === 1, description);
  const importedId = await page.evaluate((expected) => (window.allRecords || []).find((record) => record.description === expected)?.id, description);
  await page.reload({ waitUntil: 'load' });
  await waitForSessionReady(page, accounts.A, 'active');
  await page.waitForFunction(({ expected, id }) => (window.allRecords || []).some((record) => record.id === id && record.description === expected), { expected: description, id: importedId });
  await openTab(page, 'importacao');

  const duplicatePreview = await prepare('staging-synthetic-import-renamed.xlsx');
  expect(duplicatePreview.summary.readyRows).toBe(0);
  expect(duplicatePreview.summary.duplicateRows).toBe(1);
  expect(duplicatePreview.metadata.batchId).toBe(firstPreview.metadata.batchId);
  await expect(page.locator('#modern-import-commit')).toBeDisabled();
  expect(await page.evaluate((expected) => (window.allRecords || []).filter((record) => record.description === expected).length, description)).toBe(1);
  await assertIsolation();
});

test('staging settings and personal references remain isolated across A -> B -> A', async ({ page }, testInfo) => {
  requireAccounts();
  const assertIsolation = monitorIsolation(page, testInfo.project.use.expectedProjectId, testInfo.project.use.productionProjectId);
  await page.goto('/', { waitUntil: 'load' });
  await signIn(page, accounts.A);
  await openTab(page, 'configuracoes');
  await page.waitForFunction(() => window.financeApp?.settingsActiveUi?.installed === true);
  await expect(page.locator('#pessoas-list')).toContainText('Pessoa Sintetica A');
  await expect(page.locator('#macro-list')).toContainText('STAGING FIXO');
  await expect(page.locator('#categories-list')).toContainText('Moradia Staging');
  const person = page.locator('[data-settings-person-id="reference-person-staging"]');
  const receivingType = person.locator('[data-settings-action="update-person-receiving-type"]');
  if (!await receivingType.isVisible()) await page.getByRole('button', { name: /Exibir informações de Pessoas/i }).click();
  await receivingType.selectOption('quinzenal');
  await page.waitForFunction(() => (window.allRecords || []).some((record) => record.id === 'reference-person-staging' && record.receiving_type === 'quinzenal'));
  await signOutUi(page);

  await signIn(page, accounts.B);
  await openTab(page, 'configuracoes');
  await expect(page.locator('#pessoas-list')).not.toContainText('Pessoa Sintetica A');
  await expect(page.locator('#macro-list')).not.toContainText('STAGING FIXO');
  await expect(page.locator('#categories-list')).not.toContainText('Moradia Staging');
  await signOutUi(page);

  await signIn(page, accounts.A);
  await openTab(page, 'configuracoes');
  await expect(page.locator('[data-settings-person-id="reference-person-staging"] [data-settings-action="update-person-receiving-type"]')).toHaveValue('quinzenal');
  await assertIsolation();
});
