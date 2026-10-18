import { expect, test } from '@playwright/test';

const accounts = {
  A: { email: process.env.STAGING_A_EMAIL, password: process.env.STAGING_A_PASSWORD, uid: process.env.STAGING_A_UID },
  B: { email: process.env.STAGING_B_EMAIL, password: process.env.STAGING_B_PASSWORD, uid: process.env.STAGING_B_UID },
  pending: { email: process.env.STAGING_PENDING_EMAIL, password: process.env.STAGING_PENDING_PASSWORD, uid: process.env.STAGING_PENDING_UID },
  inactive: { email: process.env.STAGING_INACTIVE_EMAIL, password: process.env.STAGING_INACTIVE_PASSWORD, uid: process.env.STAGING_INACTIVE_UID }
};

const runId = Date.now();
const expenseDescription = `staging-ui-${runId}-saida`;

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

test('mobile staging exposes login without critical horizontal overflow', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const assertIsolation = monitorIsolation(page, testInfo.project.use.expectedProjectId, testInfo.project.use.productionProjectId);
  await page.goto('/', { waitUntil: 'load' });
  await page.waitForFunction(() => window.__financeFirestoreDb?.app?.options?.projectId);
  await expect(page.locator('#auth-submit')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(4);
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
  await page.locator('#btn-backup-restore-dry-run').click();
  await page.waitForFunction(() => window.financeApp?.backupActiveUi?.controller?.getState?.().restorePreview?.metadata?.restoreId);
  const dryRun = await page.evaluate(() => window.financeApp.backupActiveUi.controller.getState().restorePreview.summary);
  expect(dryRun).toMatchObject({ wrote: false });
  await expect(page.locator('#btn-backup-restore-real')).toBeDisabled();
  await assertIsolation();
});
