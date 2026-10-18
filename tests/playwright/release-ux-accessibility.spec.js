import { expect, test } from '@playwright/test';

const DESKTOP = { width: 1366, height: 768 };
const MOBILE = { width: 390, height: 844 };

const BASE_RECORDS = [
  { id: 'ux-person-ana', type: 'pessoa', person: 'Ana', salary_base: 5000, owner_uid: 'uid-a' },
  { id: 'ux-person-bruno', type: 'pessoa', person: 'Bruno', salary_base: 6200, owner_uid: 'uid-a' },
  { id: 'ux-salary-ana', type: 'salario_historico', person: 'Ana', competence: '2026-09', salary_base: 5000, owner_uid: 'uid-a' },
  { id: 'ux-macro-fixo', type: 'macro', macro_category: 'FIXO', shared_scope: 'personal', owner_uid: 'uid-a' },
  { id: 'ux-category-casa', type: 'categoria', macro_category: 'FIXO', category_name: 'Casa', shared_scope: 'personal', owner_uid: 'uid-a' },
  {
    id: 'ux-income-salary',
    type: 'entrada',
    person: 'Ana',
    competence: '2026-09',
    amount: 5000,
    cardLiquido: 4100,
    salary_base: 5000,
    status: 'Pago',
    owner_uid: 'uid-a'
  },
  {
    id: 'ux-expense-paid',
    type: 'saida',
    person: 'Ana',
    competence: '2026-09',
    macro_category: 'FIXO',
    subcategory: 'Casa',
    description: 'Aluguel UX',
    amount: 1200,
    status: 'Pago',
    due_date: '2026-09-10',
    paid_at: '2026-09-10',
    cycle: 'INICIO_MES',
    owner_uid: 'uid-a'
  },
  {
    id: 'ux-installment-1',
    type: 'saida',
    person: 'Ana',
    competence: '2026-09',
    macro_category: 'FIXO',
    subcategory: 'Casa',
    description: 'Notebook UX 1/3',
    purchase_name: 'Notebook UX',
    amount: 333.33,
    status: 'Em aberto',
    due_date: '2026-09-15',
    is_installment: true,
    installment_no: 1,
    total_installments: 3,
    parent_id: 'ux-installment-parent',
    card: 'Cartao UX',
    owner_uid: 'uid-a'
  },
  {
    id: 'ux-hour-bank',
    type: 'controle_horas',
    person: 'Ana',
    competence: '2026-09',
    date: '2026-09-12',
    hour_control_type: 'Banco de Horas',
    start_time: '08:00',
    end_time: '17:00',
    break_minutes: 60,
    bank_minutes: 30,
    owner_uid: 'uid-a'
  }
];

async function waitTwoFrames(page) {
  await page.evaluate(() => new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  }));
}

async function showAppWithMockData(page, records = BASE_RECORDS) {
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
        const id = payload.id || `ux-${Date.now()}-${Math.random().toString(16).slice(2)}`;
        window.__regressionRecords.push({ ...clone(payload), id });
        syncRecords();
        return { isOk: true, id };
      },
      createMany: async (payloads) => {
        const ids = payloads.map((payload) => payload.id || `ux-${Date.now()}-${Math.random().toString(16).slice(2)}`);
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

async function showAdminAppWithMockData(page) {
  await page.goto('/', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => typeof window.applyAuthState === 'function');
  await page.evaluate(() => {
    window.__managedUsers = [
      { uid: 'admin-ui', email: 'admin-ui@example.test', role: 'admin', status: 'active' },
      { uid: 'pending-target', email: 'pending-target@example.test', role: 'user', status: 'pending' },
      { uid: 'active-target', email: 'active-target@example.test', role: 'user', status: 'active' }
    ];
    window.initSdk = () => {};
    window.authSdk = {
      ...(window.authSdk || {}),
      getClaims: async () => ({}),
      getCurrentUser: () => ({ uid: 'admin-ui', email: 'admin-ui@example.test' }),
      signOut: async () => window.applyAuthState(null)
    };
    window.userAdminSdk = {
      ensureProfile: async (user) => ({
        uid: user.uid,
        email: user.email,
        role: 'admin',
        status: 'active'
      }),
      getProfile: async () => ({
        uid: 'admin-ui',
        email: 'admin-ui@example.test',
        role: 'admin',
        status: 'active'
      }),
      listUsers: async () => window.__managedUsers,
      updateUser: async () => ({ isOk: true })
    };
  });
  await page.evaluate(() => window.applyAuthState({ uid: 'admin-ui', email: 'admin-ui@example.test' }));
  await expect(page.locator('#app')).toBeVisible();
}

async function closeTransientOverlays(page) {
  await page.evaluate(() => {
    [
      'planner-modal',
      'parcelamentos-detail-modal',
      'entry-detail-modal',
      'entry-discount-history-modal',
      'entry-other-revenues-modal',
      'hour-control-modal'
    ].forEach((id) => document.getElementById(id)?.classList.add('hidden'));
  });
  await waitTwoFrames(page);
}

async function openCriticalScreen(page, screen) {
  await closeTransientOverlays(page);
  if (screen === 'novo') {
    await page.locator('#btn-new-record-header').click();
  } else if (screen === 'planner') {
    await page.evaluate(async () => {
      document.getElementById('f-comp-start').value = '2026-09';
      window.financeApp.applicationDependencies.repositories.financeRecords = {
        list: async () => ({ items: window.__regressionRecords || [] })
      };
      await window.openPlannerModal();
    });
  } else if (screen === 'relatorio-pdf') {
    await page.evaluate(() => {
      window.ensurePdfLibraries = async () => {
        window.jspdf = {
          jsPDF: function jsPDF() {
            return {
              setFontSize() {},
              text() {},
              addPage() {},
              getNumberOfPages: () => 1,
              autoTable() {},
              save() {}
            };
          }
        };
      };
    });
    await page.locator('#btn-export-pdf').click();
  } else if (screen === 'admin-usuarios') {
    await showAdminAppWithMockData(page);
    await page.evaluate(async () => {
      window.switchTab('configuracoes');
      await Promise.resolve(window.renderConfiguracoes?.());
    });
    await expect(page.locator('#admin-users-panel')).toBeVisible();
  } else {
    await page.evaluate(async (targetScreen) => {
      window.switchTab(targetScreen);
      if (targetScreen === 'dashboard') {
        document.getElementById('f-comp-start').value = '2026-09';
        document.getElementById('f-comp-end').value = '2026-09';
        await Promise.resolve(window.renderDashboard?.());
      }
      if (targetScreen === 'saidas') await Promise.resolve(window.renderSaidas?.());
      if (targetScreen === 'entradas') await Promise.resolve(window.renderEntradas?.());
      if (targetScreen === 'parcelamentos') await Promise.resolve(window.renderParcelamentos?.());
      if (targetScreen === 'controle-horas') await Promise.resolve(window.renderControleHoras?.());
      if (targetScreen === 'importacao') await Promise.resolve(window.renderImportacao?.());
      if (targetScreen === 'configuracoes') await Promise.resolve(window.renderConfiguracoes?.());
    }, screen);
  }
  await waitTwoFrames(page);
}

async function collectUxFindings(page, screen) {
  return page.evaluate((currentScreen) => {
    const isVisible = (element) => {
      if (element.closest('.hidden,[hidden],[aria-hidden="true"]')) return false;
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.visibility !== 'hidden' && style.display !== 'none' && rect.width > 0 && rect.height > 0;
    };
    const textFromLabelledBy = (element) => String(element.getAttribute('aria-labelledby') || '')
      .split(/\s+/)
      .map((id) => document.getElementById(id)?.textContent?.trim() || '')
      .filter(Boolean)
      .join(' ');
    const labelText = (element) => {
      if (element.id) {
        const explicit = document.querySelector(`label[for="${CSS.escape(element.id)}"]`);
        if (explicit?.textContent?.trim()) return explicit.textContent.trim();
      }
      return element.closest('label')?.textContent?.trim() || '';
    };
    const accessibleName = (element) => [
      element.getAttribute('aria-label'),
      textFromLabelledBy(element),
      element.getAttribute('title'),
      labelText(element),
      element.innerText,
      element.getAttribute('placeholder'),
      element.value
    ].map((value) => String(value || '').trim()).find(Boolean) || '';
    const describe = (element) => element.id || element.getAttribute('data-tab') || element.getAttribute('data-action') || element.outerHTML.slice(0, 90);
    const findings = [];
    document.querySelectorAll('button, a[href], input, select, textarea, [role="button"]').forEach((element) => {
      if (!isVisible(element)) return;
      if (!accessibleName(element)) {
        findings.push({
          screen: currentScreen,
          severity: 'critical',
          kind: 'missing-accessible-name',
          target: describe(element)
        });
      }
    });
    const documentElement = document.documentElement;
    const body = document.body;
    const viewportWidth = window.innerWidth;
    const overflowBy = Math.max(documentElement.scrollWidth, body.scrollWidth) - viewportWidth;
    if (overflowBy > 1) {
      findings.push({
        screen: currentScreen,
        severity: overflowBy > 24 ? 'critical' : 'moderate',
        kind: 'horizontal-overflow',
        target: `${overflowBy}px`
      });
    }
    return findings;
  }, screen);
}

test.afterEach(async ({ page }) => {
  await page.evaluate(() => {
    window.__regressionRecords = [];
    window.allRecords = [];
    window.localStorage.clear();
    window.sessionStorage.clear();
  }).catch(() => {});
});

test('critical screens have no blocking overflow or unnamed visible controls on desktop', async ({ page }) => {
  await page.setViewportSize(DESKTOP);
  await showAppWithMockData(page);
  const screens = [
    'dashboard',
    'saidas',
    'entradas',
    'parcelamentos',
    'controle-horas',
    'importacao',
    'configuracoes',
    'novo',
    'planner',
    'relatorio-pdf',
    'admin-usuarios'
  ];
  const allFindings = [];

  for (const screen of screens) {
    await openCriticalScreen(page, screen);
    allFindings.push(...await collectUxFindings(page, screen));
  }

  expect(allFindings.filter((finding) => finding.severity === 'critical')).toEqual([]);
});

test('critical screens fit mobile viewport without blocking horizontal overflow', async ({ page }) => {
  await page.setViewportSize(MOBILE);
  await showAppWithMockData(page);
  const screens = ['dashboard', 'saidas', 'entradas', 'parcelamentos', 'controle-horas', 'importacao', 'configuracoes', 'novo'];
  const allFindings = [];

  for (const screen of screens) {
    await openCriticalScreen(page, screen);
    allFindings.push(...await collectUxFindings(page, screen));
  }

  expect(allFindings.filter((finding) => finding.kind === 'horizontal-overflow' && finding.severity === 'critical')).toEqual([]);
});

test('primary header actions are keyboard activatable and keep focusable controls named', async ({ page }) => {
  await page.setViewportSize(DESKTOP);
  await showAppWithMockData(page);

  await page.locator('#btn-new-record-header').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#view-novo')).toBeVisible();

  await page.locator('#theme-toggle').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#theme-toggle')).toHaveAttribute('title', /modo claro|modo escuro/i);

  const focusedControls = [];
  for (let index = 0; index < 12; index += 1) {
    await page.keyboard.press('Tab');
    focusedControls.push(await page.evaluate(() => {
      const active = document.activeElement;
      if (!active) return null;
      const name = active.getAttribute('aria-label')
        || active.getAttribute('title')
        || active.innerText
        || active.getAttribute('placeholder')
        || active.id
        || '';
      return {
        tag: active.tagName,
        id: active.id,
        name: String(name).trim()
      };
    }));
  }

  expect(focusedControls.some((control) => control?.name)).toBe(true);
  expect(focusedControls.filter((control) => control && ['BUTTON', 'A', 'INPUT', 'SELECT', 'TEXTAREA'].includes(control.tag) && !control.name)).toEqual([]);
});
