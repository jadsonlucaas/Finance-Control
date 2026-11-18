import { expect, test } from '@playwright/test';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { deleteApp, initializeApp } from 'firebase/app';
import { connectAuthEmulator, createUserWithEmailAndPassword, getAuth, signOut } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { readFileSync } from 'node:fs';
import { acceptCurrentLegalTerms } from './helpers/legalConsent.js';

// Janela de historico: ao abrir, o app carrega so os ultimos 12 meses (mais contas
// em aberto, parcelamentos e cadastros). Meses antigos entram sob demanda.

const PROJECT_ID = 'demo-finance-control-local-e2e';
const AUTH_EMULATOR_URL = 'http://127.0.0.1:9099';
const PASSWORD = 'Senha-forte-123';
const NOW = '2026-11-14T00:00:00.000Z';
const SHOTS = process.env.E2E_SCREENSHOT_DIR || '';

let testEnv;
let setupApp;
let setupAuth;

function competenceOffset(months) {
  const now = new Date();
  const index = now.getFullYear() * 12 + now.getMonth() + months;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`;
}

async function clearAuthEmulator() {
  await fetch(`${AUTH_EMULATOR_URL}/emulator/v1/projects/${PROJECT_ID}/accounts`, { method: 'DELETE' }).catch(() => {});
}

async function createAccount(label) {
  const email = `${label}-${Date.now()}@example.test`;
  const credential = await createUserWithEmailAndPassword(setupAuth, email, PASSWORD);
  await acceptCurrentLegalTerms(testEnv, credential.user.uid);
  await signOut(setupAuth);
  return { uid: credential.user.uid, email, password: PASSWORD };
}

function expense(account, id, competence, overrides = {}) {
  return {
    id,
    type: 'saida',
    description: id,
    amount: 100,
    status: 'Pago',
    category_name: 'Alimentação',
    macro_category: 'VARIAVEL',
    competence,
    occurred_date: `${competence}-05`,
    due_date: `${competence}-05`,
    owner_uid: account.uid,
    owner_email: account.email,
    created_at: NOW,
    updated_at: NOW,
    schema_version: 1,
    ...overrides
  };
}

async function seed(account) {
  const old = competenceOffset(-24);
  const older = competenceOffset(-30);
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    const put = (id, data) => setDoc(doc(db, 'users', account.uid, 'finance_records', id), data);
    await setDoc(doc(db, 'users', account.uid), { uid: account.uid, email: account.email, role: 'user', status: 'active', created_at: NOW, updated_at: NOW, last_login_at: NOW });
    await put('recente', expense(account, 'recente', competenceOffset(0)));
    await put('futuro', expense(account, 'futuro', competenceOffset(3), { status: 'Pago' }));
    await put('antigo_pago', expense(account, 'antigo_pago', old));
    await put('antigo_aberto', expense(account, 'antigo_aberto', old, { status: 'Em aberto' }));
    await put('parcela_antiga', expense(account, 'parcela_antiga', older, { installment_no: 1, total_installments: 3, parent_id: 'p_serie' }));
    await put('sem_competencia', expense(account, 'sem_competencia', '', { competence: '', due_date: `${competenceOffset(-1)}-10`, occurred_date: `${competenceOffset(-1)}-10` }));
    await put('pessoa_ana', { id: 'pessoa_ana', type: 'pessoa', person: 'Ana', owner_uid: account.uid, owner_email: account.email, created_at: NOW, updated_at: NOW, schema_version: 1 });
  });
  return { old };
}

async function signIn(page, account) {
  await page.goto('/', { waitUntil: 'load' });
  await page.waitForFunction(() => window.__financeFirestoreDb && window.authSdk);
  await page.locator('#auth-email').fill(account.email);
  await page.locator('#auth-password').fill(account.password);
  await page.locator('#auth-submit').click();
  await expect(page.locator('#app')).toBeVisible();
  await expect(page.locator('#auth-screen')).toBeHidden();
}

async function loadedIds(page) {
  return page.evaluate(() => (window.allRecords || []).map((record) => record.id).filter(Boolean).sort());
}

async function waitForHistory(page, predicate) {
  await page.waitForFunction(predicate, null, { timeout: 15000 });
}

test.beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 }
  });
});

test.beforeEach(async () => {
  await testEnv.clearFirestore();
  await clearAuthEmulator();
  setupApp = initializeApp({ apiKey: 'demo-key', authDomain: `${PROJECT_ID}.firebaseapp.com`, projectId: PROJECT_ID }, `e2e-history-${Date.now()}`);
  setupAuth = getAuth(setupApp);
  connectAuthEmulator(setupAuth, AUTH_EMULATOR_URL, { disableWarnings: true });
});

test.afterEach(async () => {
  await deleteApp(setupApp).catch(() => {});
  await clearAuthEmulator();
});

test.afterAll(async () => {
  await testEnv?.cleanup();
});

test('abre so com os meses recentes e carrega meses antigos sob demanda', async ({ page }) => {
  const account = await createAccount('history');
  const { old } = await seed(account);
  await signIn(page, account);

  await waitForHistory(page, () => {
    const state = window.financeHistoryWindow?.getState?.();
    return state?.mode === 'window' && !state.loading && (window.allRecords || []).some((record) => record.id === 'recente');
  });
  const initial = await loadedIds(page);
  expect(initial).toEqual(expect.arrayContaining(['recente', 'futuro', 'antigo_aberto', 'parcela_antiga', 'sem_competencia', 'pessoa_ana']));
  expect(initial).not.toContain('antigo_pago');

  const notice = page.locator('#view-dashboard [data-history-window-notice]');
  await expect(notice).toBeVisible();
  await expect(notice).toContainText('Mostrando lançamentos a partir de');
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/historico-janela.png` });

  // Escolher um mes antigo no filtro do Dashboard amplia a janela.
  await page.locator('#f-comp-start').fill(old);
  await page.locator('#f-comp-start').dispatchEvent('change');
  await waitForHistory(page, () => (window.allRecords || []).some((record) => record.id === 'antigo_pago'));
  expect(await page.evaluate(() => window.financeHistoryWindow.getState())).toMatchObject({ mode: 'window', start: old, loading: false });

  // "Carregar historico completo" troca para a colecao inteira e some o aviso.
  await notice.locator('[data-history-load-all]').click();
  await waitForHistory(page, () => window.financeHistoryWindow?.getState?.().mode === 'full' && !window.financeHistoryWindow.getState().loading);
  await expect(notice).toBeHidden();

  // Lancamento novo gravado por fora (whatsapp-api) continua chegando em tempo real.
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'users', account.uid, 'finance_records', 'whatsapp_novo'), expense(account, 'whatsapp_novo', competenceOffset(0)));
  });
  await waitForHistory(page, () => (window.allRecords || []).some((record) => record.id === 'whatsapp_novo'));
});

test('lancamento novo chega em tempo real na janela e Importacao carrega o historico completo', async ({ page }) => {
  const account = await createAccount('history-import');
  await seed(account);
  await signIn(page, account);
  await waitForHistory(page, () => {
    const state = window.financeHistoryWindow?.getState?.();
    return state?.mode === 'window' && !state.loading;
  });

  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'users', account.uid, 'finance_records', 'whatsapp_novo'), expense(account, 'whatsapp_novo', competenceOffset(0)));
  });
  await waitForHistory(page, () => (window.allRecords || []).some((record) => record.id === 'whatsapp_novo'));
  expect(await loadedIds(page)).not.toContain('antigo_pago');

  await page.evaluate(() => { window.location.hash = '/importacao'; });
  await waitForHistory(page, () => (window.allRecords || []).some((record) => record.id === 'antigo_pago'));
  expect(await page.evaluate(() => window.financeHistoryWindow.getState().mode)).toBe('full');
});
