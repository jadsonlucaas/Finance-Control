import { expect, test } from '@playwright/test';

async function waitTwoFrames(page) {
  const wait = () => page.evaluate(() => new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  }));

  try {
    await wait();
  } catch (error) {
    if (!String(error?.message || error).includes('Execution context was destroyed')) throw error;
    await page.waitForLoadState('domcontentloaded');
    await wait();
  }
}

async function showAppWithMockData(page, records) {
  await page.goto('/', { waitUntil: 'networkidle' });
  await page.evaluate((initialRecords) => {
    const clone = (value) => JSON.parse(JSON.stringify(value));
    window.__regressionRecords = clone(initialRecords);
    window.isCurrentUserAdmin = () => false;
    window.authSdk = {
      ...(window.authSdk || {}),
      getCurrentUser: () => ({ uid: 'uid-a', email: 'ana@example.test' })
    };
    window.currentUserProfile = {
      uid: 'uid-a',
      email: 'ana@example.test',
      role: 'user',
      status: 'active'
    };
    const syncRecords = ({ render = true } = {}) => {
      window.allRecords = clone(window.__regressionRecords);
      window.__financeDataVersion = (window.__financeDataVersion || 0) + 1;
      if (render) window.renderAll?.();
    };
    window.dataSdk = {
      init: async () => ({ isOk: true }),
      create: async (payload) => {
        const id = payload.id || `regression-${Date.now()}-${Math.random().toString(16).slice(2)}`;
        const duplicate = payload.import_signature
          ? window.__regressionRecords.some((record) => record.import_signature === payload.import_signature)
          : false;
        if (!duplicate) window.__regressionRecords.push({ ...clone(payload), id });
        syncRecords();
        return { isOk: true, id };
      },
      createMany: async (payloads) => {
        const ids = payloads.map((payload) => payload.id || `regression-${Date.now()}-${Math.random().toString(16).slice(2)}`);
        payloads.forEach((payload, index) => {
          window.__regressionRecords.push({ ...clone(payload), id: ids[index] });
        });
        syncRecords();
        return { isOk: true, ids, count: ids.length };
      },
      update: async (payload) => {
        window.__regressionRecords = window.__regressionRecords.map((record) =>
          record.id === payload.id ? { ...record, ...clone(payload) } : record
        );
        syncRecords();
        return { isOk: true };
      },
      upsert: async (payload) => {
        const index = window.__regressionRecords.findIndex((record) => record.id === payload.id);
        if (index >= 0) window.__regressionRecords[index] = { ...window.__regressionRecords[index], ...clone(payload) };
        else window.__regressionRecords.push(clone(payload));
        syncRecords();
        return { isOk: true, id: payload.id };
      },
      delete: async (payload) => {
        window.__regressionRecords = window.__regressionRecords.filter((record) => record.id !== payload.id);
        syncRecords();
        return { isOk: true };
      }
    };
    window.financeApp?.FinanceRepository?.setSdk?.(window.dataSdk);
    window.financeRecordMutations = {
      ...(window.financeRecordMutations || {}),
      createRecord: (payload) => window.dataSdk.create(payload),
      updateRecord: (payload) => window.dataSdk.update(payload),
      deleteRecord: (payload) => window.dataSdk.delete(payload)
    };
    syncRecords({ render: false });
    document.getElementById('auth-screen')?.classList.add('hidden');
    document.getElementById('app')?.classList.remove('hidden');
    document.body.classList.remove('overflow-hidden');
  }, records);
  await waitTwoFrames(page);
}

async function openSettingsWithActiveUi(page) {
  await page.evaluate(async () => {
    window.switchTab('configuracoes');
    document.getElementById('view-configuracoes')?.classList.remove('hidden');
  });
  await page.waitForFunction(() => window.renderConfiguracoes?.__financeModernSettings === true);
  await page.evaluate(() => window.renderConfiguracoes());
  await waitTwoFrames(page);
}

async function installAccountUiMocks(page, {
  profile,
  claims = {},
  managedUsers = [],
  ensureDelayMs = 0,
  updateUser = null,
  getProfile = null
} = {}) {
  await page.goto('/', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => typeof window.applyAuthState === 'function');
  await page.evaluate((options) => {
    const clone = (value) => JSON.parse(JSON.stringify(value));
    window.__cleanupCalled = false;
    window.__initSdkCalls = 0;
    window.__signOutCalls = 0;
    window.__accountProfile = clone(options.profile);
    window.__managedUsers = clone(options.managedUsers || []);
    window.__updateUserCalls = [];
    window.__getProfileCalls = 0;
    window.confirm = () => true;
    window.initSdk = () => {
      window.__initSdkCalls += 1;
    };
    window.__financeDataServices = {
      cleanupOnSignOut: () => {
        window.__cleanupCalled = true;
        window.localStorage.removeItem('finance-control-user-records-cache-v1-previous');
      }
    };
    window.authSdk = {
      getClaims: async () => clone(options.claims || {}),
      signOut: async () => {
        window.__signOutCalls += 1;
        await window.applyAuthState(null);
      }
    };
    window.userAdminSdk = {
      ensureProfile: async (user) => {
        if (options.ensureDelayMs) {
          await new Promise((resolve) => setTimeout(resolve, options.ensureDelayMs));
        }
        return { uid: user.uid, email: user.email, ...clone(window.__accountProfile) };
      },
      getProfile: async () => {
        window.__getProfileCalls += 1;
        if (options.getProfile === 'active') {
          window.__accountProfile = { ...clone(window.__accountProfile), status: 'active' };
          return clone(window.__accountProfile);
        }
        if (options.getProfile === 'throw') throw new Error('NETWORK_DOWN');
        return clone(window.__accountProfile);
      },
      listUsers: async () => clone(window.__managedUsers),
      updateUser: async (uid, payload) => {
        window.__updateUserCalls.push({ uid, payload: clone(payload) });
        if (options.updateUser === 'throw') throw new Error('NETWORK_DOWN');
        if (options.updateUser === 'slow') {
          await new Promise((resolve) => setTimeout(resolve, 250));
        }
        window.__managedUsers = window.__managedUsers.map((user) =>
          user.uid === uid ? { ...user, ...clone(payload) } : user
        );
        return { isOk: true };
      }
    };
  }, { profile, claims, managedUsers, ensureDelayMs, updateUser, getProfile });
}

async function openAdminUsersPanel(page) {
  await page.evaluate(async () => {
    window.switchTab?.('configuracoes');
    window.renderConfiguracoes?.();
  });
  await expect(page.locator('#admin-users-panel')).toBeVisible();
  await expect(page.locator('#admin-users-list')).toBeVisible();
}

test('tax engine is exposed in the browser without adding a new top-level global API', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' });

  const result = await page.evaluate(() => {
    const inss = window.financeApp?.taxEngine?.CalculateINSS?.({
      competence: '2026-07',
      grossIncomeCents: 500000
    });
    const irrf = window.financeApp?.taxEngine?.CalculateIRRF?.({
      competence: '2026-07',
      grossIncomeCents: 500000,
      inssCents: inss?.amountCents || 0
    });
    return {
      hasTopLevelTaxEngine: Object.prototype.hasOwnProperty.call(window, 'taxEngine'),
      inssVersion: inss?.parameterVersion,
      irrfVersion: irrf?.parameterVersion,
      inssAmountCents: inss?.amountCents,
      irrfAmountCents: irrf?.amountCents
    };
  });

  expect(result).toEqual({
    hasTopLevelTaxEngine: false,
    inssVersion: 'legacy-unverified-inss-app-baseline',
    irrfVersion: 'legacy-unverified-irrf-app-baseline',
    inssAmountCents: 50152,
    irrfAmountCents: 0
  });
});

test('bootstrap emits deterministic markers once without eager lazy libraries', async ({ page }) => {
  const consoleErrors = [];
  page.on('console', (message) => {
    if (message.type() === 'error' && !message.text().includes('404 (Not Found)')) {
      consoleErrors.push(message.text());
    }
  });

  await page.goto('/', { waitUntil: 'load' });
  await page.waitForFunction(() => {
    const report = window.financePerformance?.getReport?.('playwright-bootstrap');
    return Boolean(report?.bootstrap?.requiredMarksPresent);
  });

  const result = await page.evaluate(() => {
    const requiredMarks = [
      'finance-app-entry-start',
      'finance-bridges-ready',
      'finance-legacy-loader-start',
      'finance-legacy-loader-end',
      'finance-auth-init-start',
      'finance-auth-init-end',
      'finance-shell-ready',
      'finance-first-screen-ready',
      'finance-bootstrap-complete'
    ];
    const resources = performance.getEntriesByType('resource').map((entry) => entry.name);
    window.dispatchEvent(new Event('authStateChanged'));
    return {
      markCounts: Object.fromEntries(requiredMarks.map((name) => [name, performance.getEntriesByName(name, 'mark').length])),
      bootstrap: window.financePerformance.getReport('playwright-bootstrap').bootstrap,
      lazyLibrariesTouched: {
        xlsx: resources.some((name) => /xlsx|spreadsheetImportParser|loadImportActiveUi/.test(name)),
        pdf: resources.some((name) => /jspdf|autotable|pdfAdapter|loadReportExportActiveUi/.test(name))
      }
    };
  });

  expect(Object.values(result.markCounts).every((count) => count === 1)).toBe(true);
  expect(result.bootstrap.requiredMarksPresent).toBe(true);
  expect(result.bootstrap.libraryLoaderSetupCount).toBe(0);
  expect(result.bootstrap.metrics.app_bootstrap_ms).toBeGreaterThan(0);
  expect(result.bootstrap.metrics.document_load_ms).not.toBeNull();
  expect(result.lazyLibrariesTouched).toEqual({ xlsx: false, pdf: false });
  expect(consoleErrors).toEqual([]);
});

test.afterEach(async ({ page }) => {
  await page.evaluate(() => {
    window.__regressionRecords = [];
    window.allRecords = [];
    window.localStorage.clear();
    window.sessionStorage.clear();
  }).catch(() => {});
});

test('pending account notice keeps financial app hidden and clears local records', async ({ page }) => {
  await installAccountUiMocks(page, {
    profile: {
      uid: 'pending-ui',
      email: 'pending-ui@example.test',
      role: 'user',
      status: 'pending'
    }
  });

  const state = await page.evaluate(async () => {
    window.allRecords = [{ id: 'private-record', type: 'saida', amount: 10 }];
    window.localStorage.setItem('finance-control-user-records-cache-v1-previous', '[{"id":"old"}]');

    await window.applyAuthState({ uid: 'pending-ui', email: 'pending-ui@example.test' });

    return {
      appHidden: document.getElementById('app')?.classList.contains('hidden'),
      authVisible: !document.getElementById('auth-screen')?.classList.contains('hidden'),
      noticeVisible: !document.getElementById('account-access-notice')?.classList.contains('hidden'),
      noticeText: document.getElementById('account-access-message')?.textContent || '',
      recordsCount: window.allRecords.length,
      cleanupCalled: window.__cleanupCalled,
      initSdkCalls: window.__initSdkCalls,
      oldCache: window.localStorage.getItem('finance-control-user-records-cache-v1-previous')
    };
  });

  expect(state).toMatchObject({
    appHidden: true,
    authVisible: true,
    noticeVisible: true,
    recordsCount: 0,
    cleanupCalled: true,
    initSdkCalls: 0,
    oldCache: null
  });
  expect(state.noticeText).toContain('pending-ui@example.test');
});

test('pending account can refresh to active and can sign out', async ({ page }) => {
  await installAccountUiMocks(page, {
    profile: {
      uid: 'pending-refresh',
      email: 'pending-refresh@example.test',
      role: 'user',
      status: 'pending'
    },
    getProfile: 'active'
  });
  await page.evaluate(() => window.applyAuthState({ uid: 'pending-refresh', email: 'pending-refresh@example.test' }));
  await expect(page.locator('#account-access-notice')).toBeVisible();

  await page.locator('#account-refresh-status').click();
  await expect(page.locator('#app')).toBeVisible();
  await expect(page.locator('#auth-screen')).toBeHidden();

  await installAccountUiMocks(page, {
    profile: {
      uid: 'pending-refresh',
      email: 'pending-refresh@example.test',
      role: 'user',
      status: 'pending'
    }
  });
  await page.evaluate(() => window.applyAuthState({
    uid: 'pending-refresh',
    email: 'pending-refresh@example.test'
  }));
  await expect(page.locator('#account-access-notice')).toBeVisible();
  await page.locator('#account-logout-button').click();
  await expect(page.locator('#auth-screen')).toBeVisible();
  await expect(page.locator('#app')).toBeHidden();
  expect(await page.evaluate(() => window.__signOutCalls)).toBe(1);
});

test('inactive account keeps app hidden, clears previous state and does not loop login', async ({ page }) => {
  await installAccountUiMocks(page, {
    profile: {
      uid: 'inactive-ui',
      email: 'inactive-ui@example.test',
      role: 'user',
      status: 'inactive'
    }
  });

  const state = await page.evaluate(async () => {
    window.allRecords = [{ id: 'previous-user-record', type: 'saida', amount: 50 }];
    window.localStorage.setItem('finance-control-user-records-cache-v1-previous', '[{"id":"previous"}]');
    await window.applyAuthState({ uid: 'inactive-ui', email: 'inactive-ui@example.test' });
    return {
      appHidden: document.getElementById('app')?.classList.contains('hidden'),
      noticeText: document.getElementById('account-access-message')?.textContent || '',
      recordsCount: window.allRecords.length,
      cleanupCalled: window.__cleanupCalled,
      signOutCalls: window.__signOutCalls,
      oldCache: window.localStorage.getItem('finance-control-user-records-cache-v1-previous')
    };
  });

  expect(state).toMatchObject({
    appHidden: true,
    recordsCount: 0,
    cleanupCalled: true,
    signOutCalls: 0,
    oldCache: null
  });
  expect(state.noticeText).toContain('desativado');

  await page.locator('#account-logout-button').click();
  expect(await page.evaluate(() => window.__signOutCalls)).toBe(1);
});

test('active account shows financial app only after profile validation', async ({ page }) => {
  await installAccountUiMocks(page, {
    profile: {
      uid: 'active-ui',
      email: 'active-ui@example.test',
      role: 'user',
      status: 'active'
    },
    ensureDelayMs: 150
  });

  const authPromise = page.evaluate(() => window.applyAuthState({ uid: 'active-ui', email: 'active-ui@example.test' }));
  expect(await page.locator('#app').evaluate((el) => el.classList.contains('hidden'))).toBe(true);
  await authPromise;

  await expect(page.locator('#app')).toBeVisible();
  await expect(page.locator('#auth-screen')).toBeHidden();
  expect(await page.evaluate(() => window.__initSdkCalls)).toBe(1);
});

test('admin account renders lifecycle actions and blocks self changes', async ({ page }) => {
  await installAccountUiMocks(page, {
    profile: {
      uid: 'admin-ui',
      email: 'admin-ui@example.test',
      role: 'admin',
      status: 'active'
    },
    managedUsers: [
      { uid: 'admin-ui', email: 'admin-ui@example.test', role: 'admin', status: 'active' },
      { uid: 'pending-target', email: 'pending-target@example.test', role: 'user', status: 'pending' },
      { uid: 'active-target', email: 'active-target@example.test', role: 'user', status: 'active' },
      { uid: 'inactive-target', email: 'inactive-target@example.test', role: 'user', status: 'inactive' }
    ]
  });
  await page.evaluate(() => window.applyAuthState({ uid: 'admin-ui', email: 'admin-ui@example.test' }));
  await openAdminUsersPanel(page);

  await expect(page.locator('[data-set-managed-user-status="pending-target"][data-managed-user-status="active"]')).toHaveText('Aprovar');
  await expect(page.locator('[data-set-managed-user-status="active-target"][data-managed-user-status="inactive"]')).toHaveText('Desativar');
  await expect(page.locator('[data-set-managed-user-status="inactive-target"][data-managed-user-status="active"]')).toHaveText('Reativar');
  await expect(page.locator('[data-set-managed-user-role="admin-ui"][data-managed-user-role="user"]')).toBeDisabled();
  await expect(page.locator('[data-set-managed-user-status="admin-ui"]')).toBeDisabled();
});

test('admin duplicate click and network error keep lifecycle UI safe', async ({ page }) => {
  await installAccountUiMocks(page, {
    profile: {
      uid: 'admin-ui',
      email: 'admin-ui@example.test',
      role: 'admin',
      status: 'active'
    },
    managedUsers: [
      { uid: 'pending-target', email: 'pending-target@example.test', role: 'user', status: 'pending' }
    ],
    updateUser: 'slow'
  });
  await page.evaluate(() => window.applyAuthState({ uid: 'admin-ui', email: 'admin-ui@example.test' }));
  await openAdminUsersPanel(page);
  const approveButton = page.locator('[data-set-managed-user-status="pending-target"][data-managed-user-status="active"]');
  await approveButton.dblclick();
  await page.waitForFunction(() => window.__updateUserCalls.length === 1);
  expect(await page.evaluate(() => window.__updateUserCalls.length)).toBe(1);

  await installAccountUiMocks(page, {
    profile: {
      uid: 'admin-ui',
      email: 'admin-ui@example.test',
      role: 'admin',
      status: 'active'
    },
    managedUsers: [
      { uid: 'pending-error', email: 'pending-error@example.test', role: 'user', status: 'pending' }
    ],
    updateUser: 'throw'
  });
  await page.evaluate(() => window.applyAuthState({ uid: 'admin-ui', email: 'admin-ui@example.test' }));
  await openAdminUsersPanel(page);
  await page.locator('[data-set-managed-user-status="pending-error"][data-managed-user-status="active"]').click();
  await expect(page.locator('[data-set-managed-user-status="pending-error"][data-managed-user-status="active"]')).toBeVisible();
  expect(await page.evaluate(() => window.__managedUsers.find((user) => user.uid === 'pending-error').status)).toBe('pending');
});

test('modern admin panel filters users locally without exposing common-user actions', async ({ page }) => {
  await installAccountUiMocks(page, {
    profile: {
      uid: 'admin-ui',
      email: 'admin-ui@example.test',
      role: 'admin',
      status: 'active'
    },
    managedUsers: [
      { uid: 'admin-ui', email: 'admin-ui@example.test', role: 'admin', status: 'active' },
      { uid: 'pending-target', email: 'pending-target@example.test', role: 'user', status: 'pending' },
      { uid: 'active-target', email: 'active-target@example.test', role: 'user', status: 'active' },
      ...Array.from({ length: 65 }, (_, index) => ({
        uid: `page-user-${String(index).padStart(2, '0')}`,
        email: `page-user-${String(index).padStart(2, '0')}@example.test`,
        role: index % 10 === 0 ? 'admin' : 'user',
        status: index % 3 === 0 ? 'pending' : 'active'
      }))
    ]
  });
  await page.evaluate(() => window.applyAuthState({ uid: 'admin-ui', email: 'admin-ui@example.test' }));
  await openAdminUsersPanel(page);
  await page.waitForFunction(() => window.refreshManagedUsers?.__financeModernUserAdmin === true);

  await expect(page.locator('#admin-users-list')).toContainText('admin-ui@example.test');
  await page.locator('#admin-users-next').click();
  await expect(page.locator('#admin-users-list')).toContainText('page-user-48@example.test');
  await expect(page.locator('#admin-users-list')).not.toContainText('admin-ui@example.test');
  await page.locator('#admin-users-prev').click();
  await expect(page.locator('#admin-users-list')).toContainText('admin-ui@example.test');

  await page.locator('#admin-user-status-filter').selectOption('pending');
  await expect(page.locator('#admin-users-list')).toContainText('pending-target@example.test');
  await expect(page.locator('#admin-users-list')).not.toContainText('active-target@example.test');
  await expect(page.locator('#admin-users-prev')).toBeDisabled();
  await expect(page.locator('#admin-user-search')).toHaveAttribute('placeholder', 'Buscar na página');

  await installAccountUiMocks(page, {
    profile: {
      uid: 'common-ui',
      email: 'common-ui@example.test',
      role: 'user',
      status: 'active'
    },
    managedUsers: [
      { uid: 'pending-target', email: 'pending-target@example.test', role: 'user', status: 'pending' }
    ]
  });
  await page.evaluate(() => window.applyAuthState({ uid: 'common-ui', email: 'common-ui@example.test' }));
  await page.evaluate(() => {
    window.switchTab?.('configuracoes');
    window.renderConfiguracoes?.();
  });
  await expect(page.locator('#admin-users-panel')).toBeHidden();
  expect(await page.evaluate(() => window.__updateUserCalls.length)).toBe(0);
});

test('common user sees Global and Pessoal badges but cannot maintain global references', async ({ page }) => {
  await showAppWithMockData(page, [
    { id: 'global-macro', type: 'macro', macro_category: 'FIXO', shared_scope: 'global' },
    { id: 'personal-macro', type: 'macro', macro_category: 'Projetos', shared_scope: 'personal', owner_uid: 'uid-a' },
    { id: 'other-user-macro', type: 'macro', macro_category: 'Outro usuario', shared_scope: 'personal', owner_uid: 'uid-b' },
    { id: 'global-cat', type: 'categoria', macro_category: 'FIXO', category_name: 'Moradia', category_color: '#38bdf8', category_icon: 'home', shared_scope: 'global' },
    { id: 'personal-cat', type: 'categoria', macro_category: 'Projetos', category_name: 'Freela', category_color: '#10b981', category_icon: 'tag', shared_scope: 'personal', owner_uid: 'uid-a' }
  ]);

  await openSettingsWithActiveUi(page);

  expect(await page.locator('#macro-list').textContent()).toContain('Global');
  expect(await page.locator('#macro-list').textContent()).toContain('Pessoal');
  expect(await page.locator('#macro-list').textContent()).not.toContain('Outro usuario');
  expect(await page.evaluate(() => ({
    installed: window.financeApp?.settingsActiveUi?.installed === true,
    modern: window.renderConfiguracoes?.__financeModernSettings === true
  }))).toEqual({ installed: true, modern: true });
  await expect(page.locator('[data-delete-macro-id="global-macro"]')).toHaveCount(0);
  await expect(page.locator('[data-open-edit-category="global-cat"]')).toHaveCount(0);
  await expect(page.locator('[data-delete-category-id="global-cat"]')).toHaveCount(0);
  await expect(page.locator('[data-delete-macro-id="personal-macro"]')).toHaveCount(1);
  await expect(page.locator('[data-open-edit-category="personal-cat"]')).toHaveCount(1);
});

test('legacy settings fallback renders people and macros without active UI loader', async ({ page }) => {
  await showAppWithMockData(page, [
    {
      id: 'person-fallback',
      type: 'pessoa',
      person: 'Ana <Dev>',
      salary_base: 4321.9,
      receiving_type: 'quinzenal'
    },
    {
      id: 'salary-fallback',
      type: 'salario_historico',
      person: 'Ana <Dev>',
      salary_base: 4321.9,
      start_date: '2026-07-01',
      end_date: '',
      observation: ''
    },
    {
      id: 'macro-global-fallback',
      type: 'macro',
      macro_category: 'Global & Seguro',
      shared_scope: 'global'
    },
    {
      id: 'macro-personal-fallback',
      type: 'macro',
      macro_category: 'Pessoal <Casa>',
      shared_scope: 'personal'
    }
  ]);

  await page.evaluate(async () => {
    if (window.financeApp?.settingsActiveUi) {
      window.financeApp.settingsActiveUi.promise = null;
      window.financeApp.settingsActiveUi.installed = false;
    }
    window.financeApp.settingsActiveUiLoader = () => Promise.reject(new Error('CHARACTERIZE_LEGACY_SETTINGS_FALLBACK'));
    window.switchTab?.('configuracoes');
    await Promise.resolve(window.renderConfiguracoes?.());
  });
  await waitTwoFrames(page);

  await expect(page.locator('#pessoas-empty')).toHaveClass(/hidden/);
  await expect(page.locator('#pessoas-list')).toContainText('Ana <Dev>');
  await expect(page.locator('#pessoas-list')).toContainText('R$ 4.321,90');
  await expect(page.locator('#pessoas-list')).toContainText('Vigente desde 2026-07-01');
  await expect(page.locator('[data-update-person-receiving-type="person-fallback"]')).toHaveValue('quinzenal');
  await expect(page.locator('#pessoas-list')).not.toContainText('<script>');

  await expect(page.locator('#macro-empty')).toHaveClass(/hidden/);
  await expect(page.locator('#macro-list')).toContainText('Global');
  await expect(page.locator('#macro-list')).toContainText('Pessoal');
  await expect(page.locator('#macro-list')).toContainText('Global & Seguro');
  await expect(page.locator('#macro-list')).toContainText('Pessoal <Casa>');
  await expect(page.locator('[data-delete-macro-id="macro-global-fallback"]')).toHaveCount(0);
  await expect(page.locator('[data-delete-macro-id="macro-personal-fallback"]')).toHaveCount(1);

  const html = await page.locator('#pessoas-list').innerHTML();
  expect(html).toContain('Ana &lt;Dev&gt;');
  expect(html).not.toContain('Ana <Dev>');
});

test('legacy navigation preserves hash router, back and sidebar behavior', async ({ page }) => {
  await showAppWithMockData(page, []);

  expect(await page.evaluate(() => window.financeUI)).toBeUndefined();
  expect(await page.evaluate(() => typeof window.financeApp?.financeUiAdapters?.showToast)).toBe('function');

  await page.evaluate(() => {
    window.__navigationBridgeCalls = [];
    if (window.financeUI?.activateTab) {
      window.financeUI.activateTab = () => {
        window.__navigationBridgeCalls.push('financeUI.activateTab');
        throw new Error('financeUI.activateTab should not be used by switchTab');
      };
    }
    if (window.financeApp?.financeUiAdapters?.activateTab) {
      window.financeApp.financeUiAdapters.activateTab = () => {
        window.__navigationBridgeCalls.push('financeUiAdapters.activateTab');
        throw new Error('financeUiAdapters.activateTab should not be used by switchTab');
      };
    }
  });

  await page.evaluate(() => window.switchTab('saidas'));
  await page.waitForFunction(() => window.location.hash === '#/saidas');
  await expect(page.locator('#view-saidas')).not.toHaveClass(/hidden/);
  await expect(page.locator('#view-dashboard')).toHaveClass(/hidden/);
  await expect(page.locator('#main-tabs button[data-tab="saidas"]')).toHaveClass(/bg-accent\/10/);

  await page.evaluate(() => window.switchTab('saidas'));
  await page.waitForFunction(() => window.location.hash === '#/saidas');
  await expect(page.locator('#view-saidas')).not.toHaveClass(/hidden/);

  await page.evaluate(() => window.switchTab('entradas'));
  await page.waitForFunction(() => window.location.hash === '#/entradas');
  await expect(page.locator('#view-entradas')).not.toHaveClass(/hidden/);

  await page.evaluate(() => window.goBackTab());
  await page.waitForFunction(() => window.location.hash === '#/saidas');
  await expect(page.locator('#view-saidas')).not.toHaveClass(/hidden/);
  await expect(page.locator('#view-entradas')).toHaveClass(/hidden/);

  await page.evaluate(() => {
    if (!window.isSidebarOpen) window.toggleSidebar?.();
  });
  await page.waitForFunction(() => !document.getElementById('sidebar-overlay')?.classList.contains('hidden'));
  await page.evaluate(() => window.switchTab('configuracoes'));
  await page.waitForFunction(() => window.location.hash === '#/configuracoes');
  await page.waitForFunction(() => document.getElementById('sidebar-overlay')?.classList.contains('hidden'));
  await expect(page.locator('#view-configuracoes')).not.toHaveClass(/hidden/);

  await page.evaluate(() => window.switchTab('aba-inexistente'));
  await page.waitForFunction(() => window.location.hash === '#/aba-inexistente');
  await expect(page.locator('#main-tabs button[data-tab="configuracoes"]')).not.toHaveClass(/bg-accent\/10/);
  await expect(page.locator('#view-dashboard')).toHaveClass(/hidden/);
  expect(await page.evaluate(() => window.__navigationBridgeCalls)).toEqual([]);
});

test('active settings UI does not leak personal references when user changes locally', async ({ page }) => {
  await showAppWithMockData(page, [
    { id: 'macro-a', type: 'macro', macro_category: 'Ana privado', shared_scope: 'personal', owner_uid: 'uid-a' },
    { id: 'macro-b', type: 'macro', macro_category: 'Bruno privado', shared_scope: 'personal', owner_uid: 'uid-b' },
    { id: 'macro-global', type: 'macro', macro_category: 'Global comum', shared_scope: 'global' }
  ]);
  await openSettingsWithActiveUi(page);
  await expect(page.locator('#macro-list')).toContainText('Ana privado');
  await expect(page.locator('#macro-list')).not.toContainText('Bruno privado');

  await page.evaluate(() => {
    window.authSdk.getCurrentUser = () => ({ uid: 'uid-b', email: 'bruno@example.test' });
    window.currentUserProfile = { uid: 'uid-b', email: 'bruno@example.test', role: 'user', status: 'active' };
    window.switchTab('configuracoes');
  });
  await page.waitForFunction(() => window.renderConfiguracoes?.__financeModernSettings === true);
  await page.evaluate(() => window.renderConfiguracoes());

  await expect(page.locator('#macro-list')).toContainText('Bruno privado');
  await expect(page.locator('#macro-list')).toContainText('Global comum');
  await expect(page.locator('#macro-list')).not.toContainText('Ana privado');
});

test('common user creates personal macro and category by default', async ({ page }) => {
  await showAppWithMockData(page, []);
  await openSettingsWithActiveUi(page);

  await page.locator('#btn-add-macro').click();
  await expect(page.locator('#macro-scope')).toBeVisible();
  await expect(page.locator('#macro-scope')).toBeDisabled();
  expect(await page.locator('#macro-scope option').evaluateAll((options) => options.map((option) => option.value))).toEqual(['personal']);
  await page.locator('#macro-input').fill('Projetos locais');
  await page.locator('#btn-save-macro').click();

  await page.locator('#btn-open-category-form').click();
  await expect(page.locator('#cat-scope')).toBeVisible();
  await expect(page.locator('#cat-scope')).toBeDisabled();
  expect(await page.locator('#cat-scope option').evaluateAll((options) => options.map((option) => option.value))).toEqual(['personal']);
  await page.locator('#cat-name').fill('Freela local');
  await page.locator('#cat-macro').selectOption('FIXO');
  await page.locator('#category-save-button').click();

  const created = await page.evaluate(() => window.__regressionRecords.filter((record) => record.type === 'macro' || record.type === 'categoria'));
  expect(created).toEqual(expect.arrayContaining([
    expect.objectContaining({ type: 'macro', macro_category: 'Projetos locais', shared_scope: 'personal' }),
    expect.objectContaining({ type: 'categoria', category_name: 'Freela local', shared_scope: 'personal' })
  ]));
});

test('common manipulated global scope is rejected without converted personal side effect', async ({ page }) => {
  await showAppWithMockData(page, []);
  await openSettingsWithActiveUi(page);

  await page.locator('#btn-add-macro').click();
  await page.locator('#macro-input').fill('Global manipulada');
  await page.evaluate(() => {
    const scope = document.getElementById('macro-scope');
    scope.innerHTML = '<option value="global">Global</option>';
    scope.value = 'global';
  });
  await page.locator('#btn-save-macro').click();

  expect(await page.evaluate(() => ({
    records: window.__regressionRecords.filter((record) => record.macro_category === 'Global manipulada'),
    modalHidden: document.getElementById('add-macro-modal')?.classList.contains('hidden') === true
  }))).toEqual({
    records: [],
    modalHidden: false
  });
});

test('admin creates global reference only through explicit scope selection', async ({ page }) => {
  await showAppWithMockData(page, []);
  await page.evaluate(() => {
    window.isCurrentUserAdmin = () => true;
  });
  await openSettingsWithActiveUi(page);

  await page.locator('#btn-add-macro').click();
  await expect(page.locator('#macro-scope')).toBeVisible();
  await page.locator('#macro-input').fill('Global controlada');
  await page.locator('#macro-scope').selectOption('global');
  await page.locator('#btn-save-macro').click();

  await page.locator('#btn-open-category-form').click();
  await expect(page.locator('#cat-scope')).toBeVisible();
  await page.locator('#cat-name').fill('Categoria global');
  await page.locator('#cat-scope').selectOption('global');
  await page.locator('#category-save-button').click();

  const created = await page.evaluate(() => window.__regressionRecords.filter((record) => record.shared_scope === 'global'));
  expect(created).toEqual(expect.arrayContaining([
    expect.objectContaining({ type: 'macro', macro_category: 'Global controlada' }),
    expect.objectContaining({ type: 'categoria', category_name: 'Categoria global' })
  ]));
});

test('pending and inactive accounts cannot reach financial settings', async ({ page }) => {
  await installAccountUiMocks(page, {
    profile: { uid: 'pending-settings', email: 'pending-settings@example.test', role: 'user', status: 'pending' }
  });
  await page.evaluate(() => window.applyAuthState({ uid: 'pending-settings', email: 'pending-settings@example.test' }));
  await expect(page.locator('#view-configuracoes')).toBeHidden();

  await installAccountUiMocks(page, {
    profile: { uid: 'inactive-settings', email: 'inactive-settings@example.test', role: 'user', status: 'inactive' }
  });
  await page.evaluate(() => window.applyAuthState({ uid: 'inactive-settings', email: 'inactive-settings@example.test' }));
  await expect(page.locator('#view-configuracoes')).toBeHidden();
});

test('reference deletion in use is blocked without deleting financial records', async ({ page }) => {
  await showAppWithMockData(page, [
    { id: 'cat-used', type: 'categoria', macro_category: 'FIXO', category_name: 'Moradia', category_color: '#38bdf8', category_icon: 'home', shared_scope: 'personal', owner_uid: 'uid-a' },
    { id: 'expense-used', type: 'saida', macro_category: 'FIXO', subcategory: 'Moradia', amount: 100 }
  ]);

  const state = await page.evaluate(async () => {
    await window.askDelete(window.allRecords.find((record) => record.id === 'cat-used'));
    await window.confirmDelete();
    return {
      categoryExists: window.__regressionRecords.some((record) => record.id === 'cat-used'),
      expenseExists: window.__regressionRecords.some((record) => record.id === 'expense-used')
    };
  });

  expect(state).toEqual({ categoryExists: true, expenseExists: true });
});

test('duplicate save and permission error keep reference UI from false success', async ({ page }) => {
  await showAppWithMockData(page, []);
  await page.evaluate(() => {
    let createCalls = 0;
    window.dataSdk.create = async (payload) => {
      createCalls += 1;
      window.__createCalls = createCalls;
      if (payload.macro_category === 'Falha') return { isOk: false, error: 'PERMISSION_DENIED' };
      if (createCalls > 1) return { isOk: false, error: 'DUPLICATE_CLICK' };
      window.__regressionRecords.push({ ...payload, id: 'one-ref' });
      window.allRecords = [...window.__regressionRecords];
      window.renderAll?.();
      return { isOk: true, id: 'one-ref' };
    };
    window.financeApp?.FinanceRepository?.setSdk?.(window.dataSdk);
  });
  await openSettingsWithActiveUi(page);

  await page.locator('#btn-add-macro').click();
  await page.locator('#macro-input').fill('Clique unico');
  await page.evaluate(() => Promise.all([
    window.saveMacroCategory(),
    window.saveMacroCategory()
  ]));
  expect(await page.evaluate(() => window.__regressionRecords.filter((record) => record.type === 'macro').length)).toBe(1);

  await page.locator('#btn-add-macro').click();
  await page.locator('#macro-input').fill('Falha');
  await page.locator('#btn-save-macro').click();
  expect(await page.evaluate(() => window.__regressionRecords.some((record) => record.macro_category === 'Falha'))).toBe(false);
});

test('dashboard filters keep local mocked user data separated by person and month', async ({ page }) => {
  await showAppWithMockData(page, [
    { id: 'person-ana', type: 'pessoa', person: 'Ana', salary_base: 5000 },
    { id: 'person-bruno', type: 'pessoa', person: 'Bruno', salary_base: 6000 },
    { id: 'ana-entry', type: 'entrada', person: 'Ana', competence: '2026-07', macro_category: 'Receita', amount: 3000, status: 'Pago' },
    { id: 'bruno-entry', type: 'entrada', person: 'Bruno', competence: '2026-07', macro_category: 'Receita', amount: 9000, status: 'Pago' },
    { id: 'ana-expense', type: 'saida', person: 'Ana', competence: '2026-07', macro_category: 'FIXO', subcategory: 'Moradia', amount: 1000, status: 'Pago', paid_at: '2026-07-05', cycle: 'INICIO_MES' },
    { id: 'ana-other-month', type: 'saida', person: 'Ana', competence: '2026-08', macro_category: 'FIXO', subcategory: 'Moradia', amount: 5000, status: 'Pago', paid_at: '2026-08-05', cycle: 'INICIO_MES' },
    { id: 'bruno-expense', type: 'saida', person: 'Bruno', competence: '2026-07', macro_category: 'FIXO', subcategory: 'Moradia', amount: 7000, status: 'Pago', paid_at: '2026-07-05', cycle: 'INICIO_MES' }
  ]);

  await page.evaluate(() => {
    document.getElementById('f-comp-start').value = '2026-07';
    document.getElementById('f-comp-end').value = '2026-07';
    const personFilter = document.getElementById('f-person');
    if (personFilter && !Array.from(personFilter.options || []).some((option) => option.value === 'Ana')) {
      personFilter.append(new Option('Ana', 'Ana'));
    }
    if (personFilter) personFilter.value = 'Ana';
    window.switchTab('dashboard');
    window.renderDashboard();
  });
  await waitTwoFrames(page);

  const state = await page.evaluate(() => ({
    saidas: window.getDashboardBaseSaidas().map((record) => record.id),
    trend: window.getDashboardTrendData()
  }));

  expect(state.saidas).toEqual(['ana-expense']);
  expect(state.trend.mode).toBe('daily');
  expect(state.trend.daily.insights.total).toBe(1000);
});

test('active Planner UI lazy loads persisted records and opens details by real id', async ({ page }) => {
  await showAppWithMockData(page, [
    { id: 'planner-expense-a', type: 'saida', description: 'Internet', amount: 120, due_date: '2026-06-10', competence: '2026-06', person: 'Ana', status: 'Em aberto', macro_category: 'FIXO', subcategory: 'Casa' },
    { id: 'planner-expense-b', type: 'saida', description: 'Internet', amount: 120, due_date: '2026-06-10', competence: '2026-06', person: 'Ana', status: 'Em aberto', macro_category: 'FIXO', subcategory: 'Casa' },
    { id: 'planner-income', type: 'entrada', description: 'Freela', amount: 300, date: '2026-06-20', competence: '2026-06', person: 'Ana' }
  ]);

  await page.evaluate(() => {
    window.financeApp.applicationDependencies.repositories.financeRecords = {
      list: async () => ({ items: window.__regressionRecords })
    };
    window.financeApp.plannerStorage.localEventStore.save(
      { id: 'planner-local', date: '2026-06-12', type: 'holiday', title: 'Feriado local' },
      { ownerUid: 'uid-a' }
    );
    window.__plannerActionCalls = [];
    window.financeApp.financialCrud = {
      ...(window.financeApp.financialCrud || {}),
      markExpenseAsPaid: async (input) => {
        window.__plannerActionCalls.push(input);
        return { success: true };
      }
    };
    document.getElementById('f-comp-start').value = '2026-06';
  });

  await page.evaluate(() => window.openPlannerModal());
  await expect(page.locator('#planner-modal')).toBeVisible();
  await expect(page.locator('#planner-selected-date-details')).toContainText('R$ 60,00');
  await expect(page.locator('#planner-selected-date-details')).toContainText('R$ 120,00');
  await expect(page.locator('#planner-selected-date-details')).toContainText('Feriado local');

  await page.locator('[data-select-planner-date="2026-06-10"]').click();
  await expect(page.locator('[data-planner-source-id="planner-expense-a"]')).toBeVisible();
  await expect(page.locator('[data-planner-source-id="planner-expense-b"]')).toBeVisible();
  await page.locator('[data-planner-source-id="planner-expense-a"] [data-planner-action="mark-paid"]').click();
  expect(await page.locator('[data-planner-source-id="planner-expense-a"]').count()).toBe(1);
  expect(await page.locator('[data-planner-source-id="planner-expense-b"]').count()).toBe(1);
  expect(await page.evaluate(() => ({
    modern: window.openPlannerModal.__financeModernPlanner === true,
    v1Planner: window.localStorage.getItem('finance-control-planner-events-v1'),
    v1Holiday: window.localStorage.getItem('finance-control-custom-holidays-v1'),
    calls: window.__plannerActionCalls
  }))).toMatchObject({
    modern: true,
    v1Planner: null,
    v1Holiday: null,
    calls: [{ expenseId: 'planner-expense-a', id: 'planner-expense-a' }]
  });
});

test('Planner local events and holidays are isolated by owner on the same browser', async ({ page }) => {
  await showAppWithMockData(page, []);

  await page.evaluate(() => {
    window.financeApp.applicationDependencies.repositories.financeRecords = {
      list: async () => ({ items: [] })
    };
    document.getElementById('f-comp-start').value = '2026-06';
  });

  await page.evaluate(async () => {
    await window.openPlannerModal();
    document.getElementById('planner-date').value = '2026-06-12';
    document.getElementById('planner-type').value = 'holiday';
    document.getElementById('planner-title').value = 'Feriado Ana';
    await window.savePlannerEvent();
  });
  await expect(page.locator('#planner-selected-date-details')).toContainText('Feriado Ana');

  await page.evaluate(async () => {
    window.authSdk.getCurrentUser = () => ({ uid: 'uid-b', email: 'bruno@example.test' });
    window.currentUserProfile = { uid: 'uid-b', email: 'bruno@example.test', role: 'user', status: 'active' };
    window.financeApp.plannerStorage.resetPlannerView();
    await window.openPlannerModal();
  });
  await expect(page.locator('#planner-selected-date-details')).not.toContainText('Feriado Ana');

  await page.evaluate(async () => {
    document.getElementById('planner-date').value = '2026-06-13';
    document.getElementById('planner-type').value = 'holiday';
    document.getElementById('planner-title').value = 'Feriado Bruno';
    await window.savePlannerEvent();
  });
  await expect(page.locator('#planner-selected-date-details')).toContainText('Feriado Bruno');

  const isolated = await page.evaluate(async () => {
    const ownerBHolidays = window.financeApp.plannerStorage.holidayStore.list({ ownerUid: 'uid-b' });
    window.authSdk.getCurrentUser = () => ({ uid: 'uid-a', email: 'ana@example.test' });
    window.currentUserProfile = { uid: 'uid-a', email: 'ana@example.test', role: 'user', status: 'active' };
    window.financeApp.plannerStorage.resetPlannerView();
    await window.openPlannerModal();
    return {
      details: document.getElementById('planner-selected-date-details').textContent,
      ownerAHolidays: window.financeApp.plannerStorage.holidayStore.list({ ownerUid: 'uid-a' }),
      ownerBHolidays,
      v1Planner: window.localStorage.getItem('finance-control-planner-events-v1'),
      v1Holiday: window.localStorage.getItem('finance-control-custom-holidays-v1')
    };
  });

  expect(isolated.details).toContain('Feriado Ana');
  expect(isolated.details).not.toContain('Feriado Bruno');
  expect(isolated.ownerAHolidays).toEqual(['2026-06-12']);
  expect(isolated.ownerBHolidays).toEqual(['2026-06-13']);
  expect(isolated.v1Planner).toBeNull();
  expect(isolated.v1Holiday).toBeNull();
});

test('expense spreadsheet import does not recreate the same duplicated row', async ({ page }) => {
  await showAppWithMockData(page, [
    { id: 'person-base', type: 'pessoa', person: 'Ana', salary_base: 5000 },
    { id: 'macro-base', type: 'macro', macro_category: 'FIXO' },
    { id: 'cat-base', type: 'categoria', macro_category: 'FIXO', category_name: 'Moradia' }
  ]);

  const importState = await page.evaluate(async () => {
    window.switchTab('configuracoes');
    window.__xlsxImportCreateManyCalls = 0;
    const originalCreateMany = window.dataSdk.createMany;
    window.dataSdk.createMany = async (payloads) => {
      window.__xlsxImportCreateManyCalls += 1;
      return originalCreateMany(payloads);
    };
    window.financeApp?.FinanceRepository?.setSdk?.(window.dataSdk);
    window.XLSX = {
      read: () => ({ SheetNames: ['Saidas'], Sheets: { Saidas: {} } }),
      utils: {
        sheet_to_json: () => {
          const row = {
            Data: '2026-07-18',
            Classe: 'Inicio do mes',
            Categoria_macro: 'FIXO',
            Categoria: 'Moradia',
            Descricao: 'Duplicidade regressao',
            Descrição: 'Duplicidade regressao',
            Parcela: '',
            'Valor Orcado': 'R$ 321,00',
            'Valor Orçado': 'R$ 321,00',
            STATUS: 'Pago',
            Pagamento: 'Pix',
            'Quem paga': 'Ana',
            'Data competencia': '2026-07'
          };
          row[`Descri${String.fromCharCode(0x00c3)}${String.fromCharCode(0x00a7)}${String.fromCharCode(0x00c3)}${String.fromCharCode(0x00a3)}o`] = 'Duplicidade regressao';
          row[`Valor Or${String.fromCharCode(0x00c3)}${String.fromCharCode(0x00a7)}ado`] = 'R$ 321,00';
          return [row];
        }
      }
    };

    const attachFile = () => {
      const input = document.getElementById('import-saidas-file');
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(new File(['regression'], 'saidas-regression.xlsx', {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      }));
      input.files = dataTransfer.files;
    };

    attachFile();
    await window.importSaidasSpreadsheet(false);
    attachFile();
    await window.importSaidasSpreadsheet(false);

    const imported = window.__regressionRecords.filter((record) =>
      record.type === 'saida' && record.description === 'Duplicidade regressao'
    );
    return {
      count: imported.length,
      amount: imported[0]?.amount,
      source: imported[0]?.import_source,
      sourceChannel: imported[0]?.source_channel,
      createManyCalls: window.__xlsxImportCreateManyCalls,
      report: document.getElementById('import-report-summary')?.textContent || ''
    };
  });

  expect(importState).toMatchObject({
    count: 1,
    amount: 321,
    source: 'saidas_xlsx',
    sourceChannel: 'spreadsheet_import',
    createManyCalls: 1
  });
});

test('bank import preview commits through idempotent batch without duplicate records', async ({ page }) => {
  await showAppWithMockData(page, [
    { id: 'person-base', type: 'pessoa', person: 'Ana', salary_base: 5000, owner_uid: 'uid-a' },
    { id: 'macro-food', type: 'macro', macro_category: 'VARIAVEL', owner_uid: 'uid-a' },
    { id: 'cat-food', type: 'categoria', macro_category: 'VARIAVEL', category_name: 'Alimentacao', owner_uid: 'uid-a' }
  ]);

  await page.evaluate(async () => {
    window.authSdk = {
      ...(window.authSdk || {}),
      getCurrentUser: () => ({ uid: 'uid-a', email: 'ana@example.test' })
    };
    window.currentUserProfile = { uid: 'uid-a', role: 'user', status: 'active' };
    window.__bankImportCreateManyCalls = 0;
    const originalCreateMany = window.dataSdk.createMany;
    window.dataSdk.createMany = async (payloads) => {
      window.__bankImportCreateManyCalls += 1;
      return originalCreateMany(payloads);
    };
    window.financeApp?.FinanceRepository?.setSdk?.(window.dataSdk);
    window.switchTab('importacao');
    await window.renderImportacao?.();
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

    const personField = document.getElementById('import-person-owner');
    if (personField && !Array.from(personField.options || []).some((option) => option.value === 'Ana')) {
      personField.append(new Option('Ana', 'Ana'));
    }
    if (personField) personField.value = 'Ana';
    document.getElementById('import-bank-model').value = 'PADRAO';
    document.getElementById('import-bank-label').value = 'Banco Local';

    const input = document.getElementById('import-file-input');
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(new File([
      'data,descricao,valor,tipo\n2026-08-01,Mercado Central,120,saida'
    ], 'extrato-local.csv', { type: 'text/csv' }));
    input.files = dataTransfer.files;
    document.getElementById('btn-import-preview').click();
  });

  await page.waitForFunction(() => window.__financeImportacaoState?.rows?.[0]?.importable === true);
  await page.locator('#btn-import-commit').click();
  await page.waitForFunction(() => window.__bankImportCreateManyCalls === 1);
  await expect(page.locator('#btn-import-commit')).toBeDisabled();
  await waitTwoFrames(page);

  const result = await page.evaluate(() => {
    const imported = window.__regressionRecords.filter((record) =>
      record.type === 'saida' && record.description === 'Mercado Central'
    );
    return {
      createManyCalls: window.__bankImportCreateManyCalls,
      count: imported.length,
      sourceChannel: imported[0]?.source_channel,
      idempotencyKey: imported[0]?.idempotency_key,
      importBatchId: imported[0]?.import_batch_id,
      rowStatus: window.__financeImportacaoState.rows[0]?.status
    };
  });

  expect(result).toMatchObject({
    createManyCalls: 1,
    count: 1,
    sourceChannel: 'bank_import',
    rowStatus: 'importado'
  });
  expect(result.idempotencyKey).toContain('import-row:bank_statement:');
  expect(result.importBatchId).toContain('batch_');
});

test('modern XLSX import UI lazy loads preview and keeps idempotent owner-scoped commit', async ({ page }) => {
  await showAppWithMockData(page, []);

  await page.evaluate(() => {
    window.__modernImportCreateManyCalls = 0;
    const originalCreateMany = window.dataSdk.createMany;
    window.dataSdk.createMany = async (payloads, ...rest) => {
      window.__modernImportCreateManyCalls += 1;
      const user = window.authSdk.getCurrentUser();
      return originalCreateMany(payloads.map((payload) => ({
        ...payload,
        owner_uid: payload.owner_uid || user.uid,
        owner_email: payload.owner_email || user.email
      })), ...rest);
    };
    window.ensureSpreadsheetLibrary = async () => {
      window.__xlsxLazyLoaded = true;
      window.XLSX = {
        read: () => ({
          SheetNames: ['Plan1'],
          Sheets: { Plan1: {} }
        }),
        utils: {
          sheet_to_json: () => [
            { Data: '2026-08-01', Classe: 'Inicio do mes', Categoria_macro: 'VARIAVEL', Categoria: 'Alimentacao', Descricao: 'Mercado Moderno', Parcela: '', 'Valor Orcado': '100,00', STATUS: 'Pago', Pagamento: 'Pix', 'Quem paga': 'Ana', 'Data competencia': '2026-08', 'Identificador externo': 'modern-1' },
            { Data: '2026-08-01', Classe: 'Inicio do mes', Categoria_macro: 'VARIAVEL', Categoria: 'Alimentacao', Descricao: 'Mercado Moderno', Parcela: '', 'Valor Orcado': '100,00', STATUS: 'Pago', Pagamento: 'Pix', 'Quem paga': 'Ana', 'Data competencia': '2026-08', 'Identificador externo': 'modern-1' },
            { Data: '', Classe: '', Categoria_macro: '', Categoria: '', Descricao: '', Parcela: '', 'Valor Orcado': 'abc', STATUS: 'Pago', Pagamento: 'Pix', 'Quem paga': '', 'Data competencia': '', 'Identificador externo': 'modern-invalid' },
            { Data: '2026-08-02', Classe: 'Inicio do mes', Categoria_macro: 'VARIAVEL', Categoria: 'Casa', Descricao: 'Conflito', Parcela: '', 'Valor Orcado': '10,00', STATUS: 'Pago', Pagamento: 'Pix', 'Quem paga': 'Ana', 'Data competencia': '2026-08', 'Identificador externo': 'modern-conflict' },
            { Data: '2026-08-02', Classe: 'Inicio do mes', Categoria_macro: 'VARIAVEL', Categoria: 'Casa', Descricao: 'Conflito alterado', Parcela: '', 'Valor Orcado': '11,00', STATUS: 'Pago', Pagamento: 'Pix', 'Quem paga': 'Ana', 'Data competencia': '2026-08', 'Identificador externo': 'modern-conflict' },
            {}
          ]
        }
      };
    };
    window.switchTab('importacao');
    window.renderImportacao();
  });

  await page.waitForSelector('#modern-import-panel [data-import-modern-root]');
  expect(await page.evaluate(() => Boolean(window.__xlsxLazyLoaded))).toBe(false);
  const input = page.locator('#modern-import-file');
  await input.setInputFiles({
    name: 'modern.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: Buffer.from('synthetic')
  });
  await page.locator('#modern-import-preview').click();
  await expect(page.locator('#modern-import-summary')).toContainText('Prontas');
  await expect(page.locator('#modern-import-summary')).toContainText('Invalidas');
  await expect(page.locator('#modern-import-summary')).toContainText('Duplicadas');
  await expect(page.locator('#modern-import-summary')).toContainText('Conflitos');
  await expect(page.locator('#modern-import-summary')).toContainText('Ignoradas');
  expect(await page.evaluate(() => Boolean(window.__xlsxLazyLoaded))).toBe(true);

  await page.evaluate(() => {
    document.getElementById('modern-import-commit')?.click();
    document.getElementById('modern-import-commit')?.click();
  });
  await page.waitForFunction(() => window.__modernImportCreateManyCalls === 1);

  const ownerA = await page.evaluate(() => ({
    createManyCalls: window.__modernImportCreateManyCalls,
    imported: window.__regressionRecords.filter((record) => record.source_channel === 'spreadsheet_import').length,
    owner: window.__regressionRecords.find((record) => record.description === 'Mercado Moderno')?.owner_uid,
    state: window.financeApp.importActiveUi.controller.getState().previewModel.summary
  }));

  expect(ownerA).toMatchObject({
    createManyCalls: 1,
    imported: 2,
    owner: 'uid-a',
    state: { readyRows: 2, invalidRows: 1, duplicateRows: 1, conflictRows: 1, ignoredRows: 1 }
  });

  await page.evaluate(() => {
    window.authSdk.getCurrentUser = () => ({ uid: 'uid-b', email: 'bruno@example.test' });
    window.currentUserProfile = { uid: 'uid-b', role: 'user', status: 'active' };
  });
  await input.setInputFiles({
    name: 'modern-b.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: Buffer.from('synthetic-b')
  });
  await page.locator('#modern-import-preview').click();
  await page.waitForFunction(() =>
    window.financeApp.importActiveUi.controller.getState().previewModel?.metadata?.fileName === 'modern-b.xlsx'
  );

  const ownerB = await page.evaluate(() => ({
    ownerKey: window.financeApp.importActiveUi.controller.getState().ownerKey,
    previousPreviewVisible: window.financeApp.importActiveUi.controller.getState().previewModel?.metadata?.fileName,
    ownerAImported: window.__regressionRecords.filter((record) => record.owner_uid === 'uid-a' && record.description === 'Mercado Moderno').length,
    ownerBImported: window.__regressionRecords.filter((record) => record.owner_uid === 'uid-b' && record.description === 'Mercado Moderno').length
  }));

  expect(ownerB).toMatchObject({
    ownerKey: 'uid-b',
    previousPreviewVisible: 'modern-b.xlsx',
    ownerAImported: 1,
    ownerBImported: 0
  });
});

test('finance contract validation error blocks local persistence and is user visible', async ({ page }) => {
  await showAppWithMockData(page, []);

  const result = await page.evaluate(async () => {
    const contracts = await import('/src/domain/records/index.js');
    const validation = contracts.validateFinanceRecord(
      contracts.normalizeFinanceRecord({ type: 'saida', amount: Number.NaN, status: 'Em aberto' }),
      { requireOwner: true }
    );
    if (!validation.isValid) {
      window.showToast?.('Registro financeiro invalido: amount', 'error');
      return {
        isOk: false,
        persisted: window.__regressionRecords.length,
        error: validation.errors[0]
      };
    }
    await window.dataSdk.create(validation.normalized);
    return { isOk: true, persisted: window.__regressionRecords.length };
  });

  expect(result).toMatchObject({
    isOk: false,
    persisted: 0,
    error: { field: 'amount', code: 'INVALID_FIELD_TYPE' }
  });
  await expect(page.locator('#toast')).toContainText(/Registro financeiro invalido: amount/i);
});

test('valid finance contract payload still persists through local UI data SDK', async ({ page }) => {
  await showAppWithMockData(page, []);

  const result = await page.evaluate(async () => {
    const contracts = await import('/src/domain/records/index.js');
    const payload = contracts.normalizeFinanceRecord({
      type: 'saida',
      person: 'Ana',
      amount: '42.50',
      competence: '2026-07',
      status: 'Pago',
      paid_at: '2026-07-18',
      owner_uid: 'uid-a',
      owner_email: 'a@example.test'
    });
    const validation = contracts.validateFinanceRecord(payload, { requireOwner: true });
    if (!validation.isValid) return { isOk: false, validation };
    return window.dataSdk.create(payload);
  });

  expect(result).toMatchObject({ isOk: true });
  expect(await page.evaluate(() => window.__regressionRecords[0])).toMatchObject({
    type: 'saida',
    amount: 42.5,
    owner_uid: 'uid-a',
    owner_email: 'a@example.test'
  });
});

test('common UI does not expose future multichannel technical fields', async ({ page }) => {
  await showAppWithMockData(page, [
    { id: 'person-base', type: 'pessoa', person: 'Ana', salary_base: 5000 }
  ]);

  await page.evaluate(() => {
    window.switchTab('configuracoes');
    window.renderConfiguracoes?.();
  });

  const visibleText = await page.locator('body').innerText();
  expect(visibleText).not.toContain('source_channel');
  expect(visibleText).not.toContain('idempotency_key');
  expect(visibleText).not.toContain('correlation_id');
  expect(visibleText).not.toContain('created_by_type');
});

test('active backup restore UI lazy loads, exports safely and keeps restore dry-run blocked', async ({ page }) => {
  await showAppWithMockData(page, [
    { id: 'backup-expense-a', type: 'saida', owner_uid: 'uid-a', amount: 42, status: 'Em aberto', competence: '2026-09', schema_version: 1, description: 'Backup local' },
    { id: 'backup-expense-b', type: 'saida', owner_uid: 'uid-b', amount: 99, status: 'Em aberto', competence: '2026-09', schema_version: 1, description: 'Outro owner' }
  ]);
  await openSettingsWithActiveUi(page);
  await page.waitForFunction(() => window.financeApp?.backupActiveUi?.installed === true);
  await expect(page.locator('#backup-restore-panel')).toBeVisible();

  await page.evaluate(() => {
    window.__backupDownloadClicks = 0;
    window.__backupDownloadedFileName = '';
    window.__backupBlobUrls = [];
    window.URL.createObjectURL = (blob) => {
      window.__backupBlobUrls.push(blob.size);
      return `blob:backup-${blob.size}`;
    };
    window.URL.revokeObjectURL = () => {};
    window.HTMLAnchorElement.prototype.click = function click() {
      window.__backupDownloadClicks += 1;
      window.__backupDownloadedFileName = this.download;
    };
  });

  await page.locator('#btn-backup-preview').click();
  await page.waitForFunction(() => window.financeApp?.backupActiveUi?.controller?.getState?.().backupPreview?.metadata?.backupId);
  await expect(page.locator('#backup-summary')).toContainText('1');
  await page.locator('#btn-backup-download').click();

  const backupState = await page.evaluate(() => ({
    downloadClicks: window.__backupDownloadClicks,
    fileName: window.__backupDownloadedFileName,
    snapshotText: JSON.stringify(window.financeApp.backupActiveUi.controller.getState().backupEnvelope)
  }));
  expect(backupState.downloadClicks).toBe(1);
  expect(backupState.fileName).toMatch(/^finance-control-backup-\d{8}-\d{4}-v1\.0\.0\.json$/);
  expect(backupState.fileName).not.toMatch(/uid-a|ana|@|telefone|whatsapp|phone/i);
  expect(backupState.snapshotText).toContain('backup-expense-a');
  expect(backupState.snapshotText).not.toContain('backup-expense-b');

  const conflictBackup = await page.evaluate(async () => {
    const snapshot = JSON.parse(JSON.stringify(window.financeApp.backupActiveUi.controller.getState().backupEnvelope));
    snapshot.collections.finance_records[0].amount = 77;
    const module = await import('/src/application/backup/financeBackupUseCases.js');
    snapshot.record_counts.finance_records = snapshot.collections.finance_records.length;
    snapshot.checksum = module.buildBackupChecksum(snapshot);
    return JSON.stringify(snapshot);
  });
  await page.locator('#backup-restore-file').setInputFiles({
    name: 'backup-conflict.json',
    mimeType: 'application/json',
    buffer: Buffer.from(conflictBackup)
  });
  await page.locator('#btn-backup-restore-dry-run').click();
  await page.waitForFunction(() => window.financeApp?.backupActiveUi?.controller?.getState?.().restorePreview?.metadata?.restoreId);
  await expect(page.locator('#restore-summary')).toContainText('Conflitos');
  await expect(page.locator('#btn-backup-restore-real')).toBeDisabled();
  const dryRun = await page.evaluate(() => window.financeApp.backupActiveUi.controller.getState().restorePreview.summary);
  expect(dryRun).toMatchObject({ conflicts: 1, wrote: false });

  await page.locator('#backup-restore-file').setInputFiles({
    name: 'backup-future.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ backup_version: '99.0.0', schema_version: 99, collections: {} }))
  });
  await page.locator('#btn-backup-validate-restore').click();
  await expect(page.locator('#restore-state')).toContainText(/BACKUP_VERSION|Snapshot invalido|backup/i);

  await page.evaluate(() => {
    window.authSdk.getCurrentUser = () => ({ uid: 'uid-b', email: 'b@example.test' });
    window.currentUserProfile = { uid: 'uid-b', email: 'b@example.test', role: 'user', status: 'active' };
  });
  await page.locator('#btn-backup-preview').click();
  await page.waitForFunction(() => window.financeApp.backupActiveUi.controller.getState().ownerKey === 'uid-b');
  const switched = await page.evaluate(() => JSON.stringify(window.financeApp.backupActiveUi.controller.getState().backupEnvelope));
  expect(switched).toContain('backup-expense-b');
  expect(switched).not.toContain('backup-expense-a');
});

test('active PDF export UI lazy loads report model and keeps downloads owner-scoped', async ({ page }) => {
  await showAppWithMockData(page, [
    { id: 'pdf-income-a', type: 'entrada', owner_uid: 'uid-a', person: 'Ana', competence: '2026-08', amount: 2000, cardLiquido: 2000, schema_version: 1 },
    { id: 'pdf-expense-a', type: 'saida', owner_uid: 'uid-a', person: 'Ana', competence: '2026-08', due_date: '2026-08-10', amount: 350, status: 'Pago', macro_category: 'Fixo', description: 'Aluguel', token: 'secret' },
    { id: 'pdf-expense-b', type: 'saida', owner_uid: 'uid-b', person: 'Bia', competence: '2026-08', due_date: '2026-08-11', amount: 999, status: 'Pago', macro_category: 'Fixo', description: 'Outro owner' }
  ]);
  await page.evaluate(() => {
    document.getElementById('f-comp-start').value = '2026-08';
    document.getElementById('f-comp-end').value = '2026-08';
    window.__pdfSaveCalls = [];
    window.__pdfAutoTableBodies = [];
    window.ensurePdfLibraries = async () => {
      const createDoc = () => ({
        setFontSize() {},
        text() {},
        addPage() {},
        getNumberOfPages: () => 2,
        autoTable(options) {
          window.__pdfAutoTableBodies.push(options.body);
        },
        save(filename) {
          window.__pdfSaveCalls.push(filename);
        }
      });
      window.jspdf = { jsPDF: function jsPDF() { return createDoc(); } };
    };
  });

  await expect(page.locator('#report-export-panel')).toBeHidden();
  await page.locator('#btn-export-pdf').click();
  await page.waitForFunction(() => window.financeApp?.reportExportActiveUi?.installed === true);
  await page.waitForFunction(() => window.__pdfSaveCalls?.length === 1);

  const exported = await page.evaluate(() => ({
    filename: window.__pdfSaveCalls[0],
    state: window.financeApp.reportExportActiveUi.controller.getState(),
    bodies: JSON.stringify(window.__pdfAutoTableBodies)
  }));
  expect(exported.filename).toMatch(/^relatorio-financial-2026-08-2026-08-\d{8}\.pdf$/);
  expect(exported.filename).not.toMatch(/uid|@|telefone|whatsapp|token/i);
  expect(exported.state.status).toBe('success');
  expect(exported.state.data.report.summary).toMatchObject({ receitas: 2000, despesas: 350, emAberto: 0 });
  expect(exported.bodies).toContain('Aluguel');
  expect(exported.bodies).not.toMatch(/Outro owner|secret|uid-a|uid-b|token/i);

  await page.evaluate(() => {
    window.__pdfSaveCalls = [];
    window.ensurePdfLibraries = async () => { throw new Error('LOAD_FAILED:PDF'); };
  });
  await page.locator('#btn-export-pdf').click();
  await expect(page.locator('#report-export-state')).toContainText(/Nao foi possivel|Relatorio/i);

  await page.evaluate(() => {
    window.authSdk.getCurrentUser = () => ({ uid: 'uid-b', email: 'b@example.test' });
    window.currentUserProfile = { uid: 'uid-b', email: 'b@example.test', role: 'user', status: 'active' };
    window.ensurePdfLibraries = async () => {
      window.jspdf = {
        jsPDF: function jsPDF() {
          return {
            setFontSize() {},
            text() {},
            addPage() {},
            getNumberOfPages: () => 2,
            autoTable(options) { window.__pdfAutoTableBodies.push(options.body); },
            save(filename) { window.__pdfSaveCalls.push(filename); }
          };
        }
      };
    };
  });
  await page.locator('#btn-export-pdf').click();
  await page.waitForFunction(() => window.__pdfSaveCalls?.length === 1);
  const switched = await page.evaluate(() => JSON.stringify(window.financeApp.reportExportActiveUi.controller.getState().data.report));
  expect(switched).toContain('Outro owner');
  expect(switched).not.toContain('Aluguel');
});

test('installment creation keeps reconciled total and last-cent adjustment visible locally', async ({ page }) => {
  await showAppWithMockData(page, []);

  const result = await page.evaluate(async () => {
    const { createInstallmentSeries } = await import('/src/domain/installmentSeries.js');
    const series = createInstallmentSeries({
      person: 'Ana',
      macro: 'FIXO',
      subcategory: 'Curso',
      description: 'Parcelamento Playwright',
      totalAmount: 100,
      totalInstallments: 3,
      firstDueDate: '2026-01-31',
      paymentMethod: 'Visa',
      status: 'Em aberto'
    }, {
      now: new Date('2026-07-18T12:00:00.000Z'),
      idFactory: () => 'pw-series'
    });
    const persisted = await window.dataSdk.createMany(series.installments);
    window.switchTab('parcelamentos');
    window.renderParcelamentos?.();
    return {
      persisted,
      amounts: window.__regressionRecords.map((record) => record.amount),
      sum: window.__regressionRecords.reduce((total, record) => total + Math.round(record.amount * 100), 0)
    };
  });

  expect(result.persisted).toMatchObject({ isOk: true, count: 3 });
  expect(result.amounts).toEqual([33.33, 33.33, 33.34]);
  expect(result.sum).toBe(10000);
  await expect(page.locator('#view-parcelamentos')).toContainText('Parcelamento Playwright');
});

test('duplicate installment submit and persistence errors keep UI safe', async ({ page }) => {
  await showAppWithMockData(page, []);

  const state = await page.evaluate(async () => {
    const { createInstallmentSeries } = await import('/src/domain/installmentSeries.js');
    let createManyCalls = 0;
    window.dataSdk.createMany = async (payloads) => {
      createManyCalls += 1;
      if (createManyCalls > 1) return { isOk: false, error: 'DUPLICATE_CLICK' };
      window.__regressionRecords.push(...payloads.map((payload, index) => ({ ...payload, id: `safe-${index + 1}` })));
      window.allRecords = [...window.__regressionRecords];
      window.renderAll?.();
      return { isOk: true, count: payloads.length, ids: payloads.map((_, index) => `safe-${index + 1}`) };
    };
    window.financeApp?.FinanceRepository?.setSdk?.(window.dataSdk);
    const series = createInstallmentSeries({
      description: 'Duplo clique',
      totalAmount: 10,
      totalInstallments: 2,
      firstDueDate: '2026-07-10'
    }, { idFactory: () => 'safe-series' });
    await Promise.all([
      window.financeRecordMutations.createManyRecords(series.installments),
      window.financeRecordMutations.createManyRecords(series.installments)
    ]);

    window.dataSdk.createMany = async () => ({ isOk: false, error: 'NETWORK_DOWN' });
    const failed = await window.financeRecordMutations.createManyRecords(series.installments);
    return {
      createManyCalls,
      count: window.__regressionRecords.length,
      failed,
      toastText: document.getElementById('toast')?.textContent || ''
    };
  });

  expect(state.createManyCalls).toBe(2);
  expect(state.count).toBe(2);
  expect(state.failed).toMatchObject({ isOk: false, error: 'NETWORK_DOWN' });
});

test('explicit recurrence preview and submit use one atomic batch', async ({ page }) => {
  await showAppWithMockData(page, []);

  const state = await page.evaluate(async () => {
    let createManyCalls = 0;
    window.dataSdk.createMany = async (payloads) => {
      createManyCalls += 1;
      await new Promise((resolve) => setTimeout(resolve, 20));
      window.__regressionRecords.push(...payloads.map((payload, index) => ({ ...payload, id: `rec-${index + 1}` })));
      window.allRecords = [...window.__regressionRecords];
      window.renderAll?.();
      return { isOk: true, count: payloads.length, ids: payloads.map((_, index) => `rec-${index + 1}`) };
    };
    window.financeApp?.FinanceRepository?.setSdk?.(window.dataSdk);
    window.switchTab('novo');
    document.getElementById('form-type').value = 'saida';
    window.toggleFormFields?.();
    document.getElementById('form-person').value = 'Jadson';
    document.getElementById('form-macro').value = 'FIXO';
    document.getElementById('form-category').value = 'Assinatura';
    document.getElementById('form-desc').value = 'Licenca anual';
    document.getElementById('form-amount').value = '120';
    document.getElementById('form-status').value = 'Em aberto';
    document.getElementById('form-payment').value = 'Cartao';
    document.getElementById('form-due').value = '2024-02-29';
    document.getElementById('form-competence').value = '2024-02';
    document.getElementById('form-expense-type').value = 'a_vista';
    document.getElementById('form-recurrence').value = 'anual';
    document.getElementById('form-recurrence-termination').value = 'count';
    document.getElementById('form-recurrence-count').value = '2';
    document.getElementById('form-recurrence').dispatchEvent(new Event('change', { bubbles: true }));
    document.getElementById('form-recurrence-count').dispatchEvent(new Event('input', { bubbles: true }));

    const preview = {
      frequency: document.getElementById('recurrence-preview-frequency')?.textContent || '',
      count: document.getElementById('recurrence-preview-count')?.textContent || '',
      first: document.getElementById('recurrence-preview-first')?.textContent || '',
      last: document.getElementById('recurrence-preview-last')?.textContent || '',
      total: document.getElementById('recurrence-preview-total')?.textContent || ''
    };

    await Promise.all([
      window.handleSubmit({ preventDefault() {} }),
      window.handleSubmit({ preventDefault() {} })
    ]);

    const recurringRecords = window.__regressionRecords.filter((record) => record.type === 'saida' && record.source_mode === 'recurring');
    return {
      preview,
      createManyCalls,
      count: recurringRecords.length,
      dueDates: recurringRecords.map((record) => record.due_date),
      parentIds: recurringRecords.map((record) => record.parent_id),
      seriesIds: recurringRecords.map((record) => record.recurrence_series_id),
      sequences: recurringRecords.map((record) => record.recurrence_sequence_no)
    };
  });

  expect(state.preview).toMatchObject({
    frequency: 'Anual',
    count: '2',
    first: '2024-02-29',
    last: '2025-02-28'
  });
  expect(state.preview.total).toContain('240');
  expect(state.createManyCalls).toBe(1);
  expect(state.count).toBe(2);
  expect(state.dueDates).toEqual(['2024-02-29', '2025-02-28']);
  expect(state.parentIds).toEqual(['', '']);
  expect(new Set(state.seriesIds).size).toBe(1);
  expect(state.sequences).toEqual([1, 2]);
});

test('paying one installment changes only that parcel and dashboard sees no duplicates', async ({ page }) => {
  await showAppWithMockData(page, []);

  const state = await page.evaluate(async () => {
    const { createInstallmentSeries } = await import('/src/domain/installmentSeries.js');
    const series = createInstallmentSeries({
      description: 'Pagamento isolado',
      totalAmount: 100,
      totalInstallments: 3,
      firstDueDate: '2026-07-15',
      status: 'Em aberto'
    }, {
      now: new Date('2026-07-18T12:00:00.000Z'),
      idFactory: () => 'pay-series'
    });
    await window.dataSdk.createMany(series.installments);
    const second = window.__regressionRecords[1];
    await window.financeRecordMutations.togglePaidRecord(second, {
      target: window,
      now: new Date('2026-08-16T00:00:00.000Z')
    });
    window.switchTab('dashboard');
    window.renderDashboard?.();
    return {
      statuses: window.__regressionRecords.map((record) => [record.installment_no, record.status, record.paid_at]),
      ids: window.__regressionRecords.map((record) => record.id),
      today: new Date().toISOString().slice(0, 10),
      dashboardText: document.getElementById('dashboard-parcelamentos-section')?.textContent || ''
    };
  });

  expect(new Set(state.ids).size).toBe(3);
  expect(state.statuses).toEqual([
    [1, 'Em aberto', ''],
    [2, 'Pago', state.today],
    [3, 'Em aberto', '']
  ]);
  expect(state.dashboardText).toContain('Parcelamentos');
});

test('financial CRUD bridge delegates main commands through application gateway', async ({ page }) => {
  await showAppWithMockData(page, []);

  const state = await page.evaluate(async () => {
    window.currentUser = { uid: 'uid-a', email: 'ana@example.test' };
    window.currentUserProfile = {
      uid: 'uid-a',
      email: 'ana@example.test',
      role: 'user',
      status: 'active'
    };
    const calls = [];
    window.financeApp.applicationGateway = {
      executeCommand: async (envelope, options) => {
        calls.push({ envelope, authContext: options.authContext });
        return { success: true, code: 'OK', data: { id: envelope.payload.id || 'ok' } };
      }
    };

    await window.financeApp.financialCrud.createExpense({ type: 'saida', description: 'Energia', amount: 180 });
    await window.financeApp.financialCrud.updateExpense({ id: 's1', fields: { amount: 190 } });
    await window.financeApp.financialCrud.markExpenseAsPaid({ expenseId: 's1', paidAt: '2026-09-02' });
    await window.financeApp.financialCrud.archiveExpense({ id: 's1' });
    await window.financeApp.financialCrud.deleteExpense({ id: 's1' });
    await window.financeApp.financialCrud.createIncome({ type: 'entrada', person: 'Ana', amount: 500 });

    return {
      commands: calls.map((call) => call.envelope.commandName),
      idempotencyKeys: calls.map((call) => call.envelope.idempotencyKey),
      ownerUid: calls.map((call) => call.authContext.ownerUid),
      topLevelGlobals: [
        'createExpense',
        'updateExpense',
        'deleteExpense',
        'markExpenseAsPaid',
        'archiveExpense',
        'createIncome'
      ].filter((name) => Object.prototype.hasOwnProperty.call(window, name))
    };
  });

  expect(state.commands).toEqual([
    'CreateExpenseCommand',
    'UpdateExpenseCommand',
    'MarkExpenseAsPaidCommand',
    'ArchiveExpenseCommand',
    'DeleteExpenseCommand',
    'CreateIncomeCommand'
  ]);
  expect(state.idempotencyKeys.every((key) => key.startsWith('idem_'))).toBe(true);
  expect(state.ownerUid.every((uid) => uid === 'uid-a')).toBe(true);
  expect(state.topLevelGlobals).toEqual([]);
});

test('canonical hour engine supports normal, night and invalid break scenarios in local app', async ({ page }) => {
  await showAppWithMockData(page, []);

  const state = await page.evaluate(() => {
    const engine = window.financeApp?.workSessionEngine;
    return {
      normal: engine.CalculateWorkSession({
        startTime: '08:00',
        endTime: '17:00',
        breakMinutes: 60,
        hourControlType: 'Hora Extra',
        overtimePercentage: 50,
        salaryBase: 4400
      }),
      night: engine.CalculateWorkSession({
        occurredDate: '2026-12-31',
        startTime: '22:00',
        endTime: '06:00',
        allowCrossMidnight: true,
        hourControlType: 'Hora Extra',
        overtimePercentage: 50,
        salaryBase: 4400,
        source_channel: 'future_integration'
      }),
      invalidBreak: engine.CalculateWorkSession({
        startTime: '08:00',
        endTime: '10:00',
        breakMinutes: 180
      }),
      noPhoneKeys: Object.keys(engine.CalculateWorkSession({
        startTime: '08:00',
        endTime: '09:00',
        phone: '559999999999'
      })).filter((key) => key.toLowerCase().includes('phone'))
    };
  });

  expect(state.normal).toMatchObject({ isValid: true, grossMinutes: 540, breakMinutes: 60, netMinutes: 480 });
  expect(state.night).toMatchObject({ isValid: true, crossesMidnight: true, netMinutes: 480, endedDate: '2027-01-01' });
  expect(state.invalidBreak).toMatchObject({ isValid: false });
  expect(state.noPhoneKeys).toEqual([]);
});

test('legacy global hour bridge delegates to canonical engine', async ({ page }) => {
  await showAppWithMockData(page, []);

  const state = await page.evaluate(() => {
    const overtime = window.calcularHoraExtra({ salaryBase: 4400, horas: 2, percentual: 50 });
    const bank = window.calcularBancoHoras({ quantityHours: 1.5, natureza: 'Credito' });
    return {
      parsedInvalid: window.parseTimeToMinutes('99:99'),
      night: window.calcularHoras('23:30', '01:30', { allowCrossMidnight: true }),
      overtime: {
        totalHoraExtra: overtime.totalHoraExtra,
        calculatedValueCents: overtime.calculatedValueCents
      },
      bank: {
        credito: bank.credito,
        saldo: bank.saldo,
        minutes: bank.minutes
      }
    };
  });

  expect(state.parsedInvalid).toBeNull();
  expect(state.night).toMatchObject({ quantidade: 2, quantidadeFormatada: '02:00', minutos: 120, crossesMidnight: true });
  expect(state.overtime).toMatchObject({ totalHoraExtra: 60, calculatedValueCents: 6000 });
  expect(state.bank).toMatchObject({ credito: 1.5, saldo: -1.5, minutes: -90 });
});

test('active hour-control UI uses modern controller presenter read model and gateway', async ({ page }) => {
  await showAppWithMockData(page, [
    { id: 'person-jadson', type: 'pessoa', person: 'Jadson', salary_base: 4400, owner_uid: 'uid-a' },
    { id: 'salary-jadson', type: 'salario_historico', person: 'Jadson', competence: '2026-06', salary_base: 4400, owner_uid: 'uid-a' }
  ]);

  const beforeNavigation = await page.evaluate(() => ({
    modernSaveInstalled: window.saveHourControlRecord?.__financeModernHourControl === true,
    lazyLoaderReady: typeof window.financeApp?.loadHourControlActiveUi === 'function'
  }));
  expect(beforeNavigation).toEqual({ modernSaveInstalled: false, lazyLoaderReady: true });

  await page.evaluate(() => {
    window.__hourControlGatewayCalls = [];
    const idempotencyRepository = {
      reserve: async (input) => ({
        ok: true,
        id: `hour-local-${window.__hourControlGatewayCalls.length + 1}`,
        data: { ...input, reservation_status: 'reserved' }
      }),
      complete: async (id, result) => ({ ok: true, id, data: { result_reference: result } }),
      fail: async (id, result) => ({ ok: true, id, data: { result_reference: result } }),
      find: async () => ({ ok: false, code: 'REPOSITORY_NOT_FOUND' })
    };
    window.financeApp.applicationGateway = window.financeApp.createDefaultApplicationGateway({
      dependencies: window.financeApp.applicationDependencies,
      idempotencyRepository
    });
    window.financeApp.__hourControlLocalGateway = window.financeApp.applicationGateway;
    const gateway = window.financeApp.applicationGateway;
    const original = gateway.executeCommand.bind(gateway);
    gateway.executeCommand = async (...args) => {
      window.__hourControlGatewayCalls.push({
        commandName: args[0]?.commandName,
        payload: JSON.parse(JSON.stringify(args[0]?.payload || {})),
        idempotencyKey: args[0]?.idempotencyKey || ''
      });
      return original(...args);
    };
    document.getElementById('app')?.classList.remove('hidden');
    document.getElementById('auth-screen')?.classList.add('hidden');
    window.switchTab('controle-horas');
  });
  await page.waitForFunction(() => window.saveHourControlRecord?.__financeModernHourControl === true);
  await page.evaluate(() => {
    document.getElementById('controle-horas-competencia').value = '2026-06';
    window.renderControleHoras();
  });

  await expect(page.locator('#view-controle-horas')).toBeVisible();
  await expect(page.locator('#controle-horas-meta')).toContainText('0 lancamento');
  await page.click('#btn-new-hour-control');
  await page.selectOption('#hour-person', 'Jadson');
  await page.fill('#hour-competence', '2026-06');
  await page.fill('#hour-date', '2026-06-12');
  await page.selectOption('#hour-type', 'Hora Extra');
  await page.fill('#hour-start', '18:00');
  await page.fill('#hour-end', '20:00');
  await page.fill('#hour-percentage', '50');
  await page.fill('#hour-note', 'Fluxo moderno ativo');
  await expect(page.locator('#hour-calculation-preview')).toContainText('Memoria de calculo da H.E.');
  await page.click('#btn-save-hour-control');
  await page.waitForFunction(() => window.__hourControlGatewayCalls?.some((call) => call.commandName === 'CreateHourEntryCommand'));
  await expect(page.locator('[data-hour-control-modern-group="Jadson|2026-06"]')).toBeVisible();
  await expect(page.locator('#controle-horas-meta')).toContainText('1 lancamento');

  await page.click('[data-open-hour-detail="Jadson|2026-06"]');
  await page.locator('[data-edit-hour-control-record]').first().click();
  await expect(page.locator('#hour-control-modal')).toBeVisible();
  await page.fill('#hour-end', '21:00');
  await page.click('#btn-save-hour-control');
  await page.waitForFunction(() => window.__hourControlGatewayCalls?.some((call) => call.commandName === 'UpdateHourEntryCommand'));

  const activeState = await page.evaluate(() => ({
    markers: {
      render: window.renderControleHoras?.__financeModernHourControl === true,
      save: window.saveHourControlRecord?.__financeModernHourControl === true,
      controller: Boolean(window.saveHourControlRecord?.__controller?.getState),
      presenter: Boolean(window.saveHourControlRecord?.__presenter?.render)
    },
    calls: window.__hourControlGatewayCalls,
    records: window.__regressionRecords.filter((record) => record.type === 'controle_horas'),
    groupCount: document.querySelectorAll('[data-hour-control-modern-group]').length
  }));

  expect(activeState.markers).toEqual({ render: true, save: true, controller: true, presenter: true });
  expect(activeState.calls.map((call) => call.commandName)).toEqual(['CreateHourEntryCommand', 'UpdateHourEntryCommand']);
  expect(activeState.calls.every((call) => call.idempotencyKey.startsWith('idem_'))).toBe(true);
  expect(activeState.records).toHaveLength(1);
  expect(activeState.records[0]).toMatchObject({ net_minutes: 180, observation: 'Fluxo moderno ativo' });
  expect(activeState.groupCount).toBe(1);

  await page.evaluate(() => {
    window.switchTab('dashboard');
    window.switchTab('controle-horas');
    window.renderControleHoras();
  });
  await expect(page.locator('[data-hour-control-modern-group="Jadson|2026-06"]')).toHaveCount(1);
});

test('active hour-control UI lazy load failure is recoverable without breaking shell', async ({ page }) => {
  await showAppWithMockData(page, [
    { id: 'person-jadson', type: 'pessoa', person: 'Jadson', salary_base: 4400, owner_uid: 'uid-a' }
  ]);

  const firstAttempt = await page.evaluate(async () => {
    let attempts = 0;
    const originalLoader = window.financeApp.hourControlActiveUiLoader;
    window.financeApp.hourControlActiveUiLoader = async () => {
      attempts += 1;
      window.__hourControlLazyAttempts = attempts;
      if (attempts === 1) throw new Error('chunk local indisponivel');
      return originalLoader();
    };
    document.getElementById('app')?.classList.remove('hidden');
    document.getElementById('auth-screen')?.classList.add('hidden');
    window.switchTab('controle-horas');
    await new Promise((resolve) => setTimeout(resolve, 0));
    return {
      attempts: window.__hourControlLazyAttempts,
      appVisible: !document.getElementById('app')?.classList.contains('hidden'),
      stillRecoverable: typeof window.financeApp.loadHourControlActiveUi === 'function',
      modernInstalled: window.saveHourControlRecord?.__financeModernHourControl === true
    };
  });

  expect(firstAttempt).toMatchObject({
    attempts: 1,
    appVisible: true,
    stillRecoverable: true,
    modernInstalled: false
  });

  await page.evaluate(() => {
    window.switchTab('dashboard');
    window.switchTab('controle-horas');
  });
  await page.waitForFunction(() => window.saveHourControlRecord?.__financeModernHourControl === true);
  const recovered = await page.evaluate(() => ({
    attempts: window.__hourControlLazyAttempts,
    appVisible: !document.getElementById('app')?.classList.contains('hidden'),
    modernInstalled: window.saveHourControlRecord?.__financeModernHourControl === true
  }));
  expect(recovered).toMatchObject({ attempts: 2, appVisible: true, modernInstalled: true });
});

test('active hour-control UI preserves form on error and uncertain result', async ({ page }) => {
  await showAppWithMockData(page, [
    { id: 'person-jadson', type: 'pessoa', person: 'Jadson', salary_base: 4400, owner_uid: 'uid-a' }
  ]);

  await page.evaluate(() => {
    window.__hourControlGatewayCalls = [];
    window.financeApp.applicationGateway.executeCommand = async (envelope) => {
      window.__hourControlGatewayCalls.push(envelope.commandName);
      return { success: false, code: 'NETWORK_UNAVAILABLE', message: 'Falha local simulada' };
    };
    window.financeApp.__hourControlLocalGateway = window.financeApp.applicationGateway;
    document.getElementById('app')?.classList.remove('hidden');
    document.getElementById('auth-screen')?.classList.add('hidden');
    window.switchTab('controle-horas');
  });
  await page.waitForFunction(() => window.saveHourControlRecord?.__financeModernHourControl === true);

  await page.click('#btn-new-hour-control');
  await page.selectOption('#hour-person', 'Jadson');
  await page.fill('#hour-competence', '2026-06');
  await page.fill('#hour-date', '2026-06-12');
  await page.fill('#hour-start', '18:00');
  await page.fill('#hour-end', '20:00');
  await page.fill('#hour-note', 'Nao perder rascunho');
  await page.click('#btn-save-hour-control');
  await expect(page.locator('#hour-control-modal')).toBeVisible();
  await expect(page.locator('#hour-note')).toHaveValue('Nao perder rascunho');

  const uncertainState = await page.evaluate(async () => {
    window.financeApp.applicationGateway.executeCommand = async (envelope) => {
      window.__hourControlGatewayCalls.push(envelope.commandName);
      return {
        success: false,
        code: 'POST_COMMIT_RESPONSE_LOST',
        data: { mutationOutcome: 'uncertain' }
      };
    };
    window.financeApp.__hourControlLocalGateway = window.financeApp.applicationGateway;
    const result = await window.saveHourControlRecord();
    const controller = window.saveHourControlRecord.__controller;
    const reconciled = await controller.reconcileAttempt({
      attemptId: 'attempt-local',
      commandName: 'CreateHourEntryCommand',
      idempotencyKey: 'idem-local'
    });
    return {
      result,
      reconciled,
      modalVisible: !document.getElementById('hour-control-modal').classList.contains('hidden'),
      note: document.getElementById('hour-note').value,
      calls: window.__hourControlGatewayCalls
    };
  });

  expect(uncertainState.result).toMatchObject({ success: false, data: { mutationOutcome: 'uncertain' } });
  expect(uncertainState.reconciled).toMatchObject({ success: false, code: 'RECONCILER_UNAVAILABLE' });
  expect(uncertainState.modalVisible).toBe(true);
  expect(uncertainState.note).toBe('Nao perder rascunho');
  expect(uncertainState.calls).toEqual(['CreateHourEntryCommand', 'CreateHourEntryCommand']);
});

test('dashboard resilience pilot exposes loading error and retry state locally', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' });
  const state = await page.evaluate(() => {
    const pilot = window.financeApp?.resilience?.viewStates?.dashboard;
    pilot.loading();
    return pilot.error({ code: 'unavailable', message: 'FirebaseError: unavailable raw details' });
  });
  expect(state.status).toBe('error');
  expect(state.retryAvailable).toBe(true);
  expect(state.error.userMessage).not.toContain('FirebaseError');
});

test('import resilience pilot keeps preview data stale after failure', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' });
  const state = await page.evaluate(() => {
    const pilot = window.financeApp?.resilience?.viewStates?.importacao;
    pilot.success([{ row: 1, amount: 10 }]);
    return pilot.error({ code: 'deadline-exceeded', message: 'timeout' });
  });
  expect(state.status).toBe('stale');
  expect(state.data).toHaveLength(1);
  expect(state.retryAvailable).toBe(true);
});

test('lazy load failure is recoverable without breaking the app shell', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' });
  const result = await page.evaluate(async () => {
    let attempts = 0;
    const run = await window.financeApp.resilience.executeWithResilience(() => {
      attempts += 1;
      if (attempts === 1) throw new Error('Failed to fetch dynamically imported module');
      return { loaded: true };
    }, {
      operationType: 'lazy_load',
      operation: 'test_lazy',
      retryPolicy: window.financeApp.resilience.createRetryPolicy({ baseDelayMs: 0, maxDelayMs: 0 }),
      sleep: async () => {}
    });
    return {
      success: run.success,
      attempts: run.attempts,
      appPresent: Boolean(document.getElementById('app'))
    };
  });
  expect(result).toEqual({ success: true, attempts: 2, appPresent: true });
});

test('offline simulated state does not show false saved success', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' });
  const state = await page.evaluate(() => {
    const pilot = window.financeApp.resilience.viewStates.audit;
    return pilot.offline();
  });
  expect(state.status).toBe('offline');
  expect(state.error.userMessage).toContain('nao foram salvos');
});

test('returning online allows safe query retry in browser contract', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' });
  const result = await page.evaluate(async () => {
    let calls = 0;
    return window.financeApp.resilience.executeWithResilience(() => {
      calls += 1;
      if (calls < 2) throw new Error('fetch failed');
      return { ok: true };
    }, {
      operationType: 'query',
      retryPolicy: window.financeApp.resilience.createRetryPolicy({ baseDelayMs: 0, maxDelayMs: 0 }),
      sleep: async () => {}
    });
  });
  expect(result.success).toBe(true);
  expect(result.attempts).toBe(2);
});

test('form draft remains available when a resilient mutation fails without idempotency', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' });
  const result = await page.evaluate(async () => {
    const draft = { description: 'Conta de luz', amount: '120,00' };
    const run = await window.financeApp.resilience.executeWithResilience(() => {
      throw new Error('fetch failed');
    }, {
      operationType: 'mutation',
      operation: 'CreateExpenseCommand',
      context: { draft },
      retryPolicy: window.financeApp.resilience.createRetryPolicy({ baseDelayMs: 0, maxDelayMs: 0 }),
      sleep: async () => {}
    });
    return { success: run.success, attempts: run.attempts, draft };
  });
  expect(result.success).toBe(false);
  expect(result.attempts).toBe(1);
  expect(result.draft).toEqual({ description: 'Conta de luz', amount: '120,00' });
});

test('CreateExpense response loss becomes uncertain and reconciles without duplicate record', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' });

  const result = await page.evaluate(async () => {
    const dependencies = window.financeApp.createApplicationDependencies({ mode: 'test' });
    const applicationGateway = window.financeApp.createDefaultApplicationGateway({ dependencies });
    const payload = {
      type: 'saida',
      description: 'Energia escritorio',
      amount: 180,
      competence: '2026-07',
      date: '2026-07-10',
      category: 'Casa',
      status: 'Em aberto',
      ownerUid: 'local-user',
      userId: 'local-user',
      parentId: ''
    };
    const authContext = {
      uid: 'local-user',
      email: 'local@example.test',
      role: 'user',
      ownerUid: 'local-user',
      permissions: { canManageRecords: true, canViewAllRecords: false }
    };
    const attempt = window.financeApp.resilience.createMutationAttemptContext({
      commandName: 'CreateExpenseCommand',
      sourceChannel: 'web',
      payload,
      context: authContext
    });
    const envelope = {
      commandName: 'CreateExpenseCommand',
      schemaVersion: 1,
      actor: { type: 'user', id: authContext.uid, role: authContext.role },
      source: { channel: 'web' },
      idempotencyKey: attempt.idempotencyKey,
      correlationId: attempt.correlationId,
      requestedAt: attempt.createdAt,
      payload
    };

    const lost = await applicationGateway.executeCommand(envelope, {
      authContext,
      afterMutationBeforeApplicationResult: () => {
        throw new Error('simulated lost response');
      }
    });
    const countAfterLoss = (await dependencies.repositories.financeRecords.list({}, authContext)).count;
    const reconciled = await window.financeApp.resilience.ReconcileMutationAttempt({
      attempt,
      payload,
      context: authContext,
      repositories: dependencies.repositories
    });
    const replay = await applicationGateway.executeCommand(envelope, { authContext });
    const countAfterRetry = (await dependencies.repositories.financeRecords.list({}, authContext)).count;

    return {
      lostOutcome: lost.data?.mutationOutcome,
      lostStatus: lost.data?.status,
      reconciledOutcome: reconciled.data?.mutationOutcome,
      replayCode: replay.code,
      countAfterLoss,
      countAfterRetry
    };
  });

  expect(result.lostOutcome).toBe('uncertain');
  expect(result.lostStatus).toBe('uncertain');
  expect(result.reconciledOutcome).toBe('reconciled_success');
  expect(result.replayCode).toBe('IDEMPOTENT_REPLAY');
  expect(result.countAfterLoss).toBe(1);
  expect(result.countAfterRetry).toBe(1);
});
