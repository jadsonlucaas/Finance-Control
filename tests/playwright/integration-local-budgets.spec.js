import { expect, test } from '@playwright/test';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { deleteApp, initializeApp } from 'firebase/app';
import { connectAuthEmulator, createUserWithEmailAndPassword, getAuth, signOut } from 'firebase/auth';
import { collection, doc, getDocs, setDoc } from 'firebase/firestore';
import { readFileSync } from 'node:fs';
import { acceptCurrentLegalTerms } from './helpers/legalConsent.js';

// Orcamentos: tela no Dashboard, tempo real entre duas abas e mudancas vindas de
// fora (como o WhatsApp gravando um lancamento pela whatsapp-api).

const PROJECT_ID = 'demo-finance-control-local-e2e';
const AUTH_EMULATOR_URL = 'http://127.0.0.1:9099';
const PASSWORD = 'Senha-forte-123';
const NOW = '2026-11-14T00:00:00.000Z';
const SHOTS = process.env.E2E_SCREENSHOT_DIR || '';

let testEnv;
let setupApp;
let setupAuth;

function currentCompetence() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
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

function expense(account, id, overrides = {}) {
  const competence = currentCompetence();
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
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, 'users', account.uid), { uid: account.uid, email: account.email, role: 'user', status: 'active', created_at: NOW, updated_at: NOW, last_login_at: NOW });
    await setDoc(doc(db, 'users', account.uid, 'finance_records', 'almoco'), expense(account, 'almoco', { amount: 300 }));
    await setDoc(doc(db, 'users', account.uid, 'finance_records', 'mercado'), expense(account, 'mercado', { amount: 150, status: 'Em aberto' }));
    await setDoc(doc(db, 'users', account.uid, 'finance_records', 'uber'), expense(account, 'uber', { amount: 40, category_name: 'Transporte' }));
  });
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

async function openBudgets(page) {
  await expect(page.locator('#main-tabs [data-tab="orcamentos"]')).toHaveCount(1);
  await page.evaluate(() => window.switchTab('orcamentos'));
  await expect(page.locator('#view-orcamentos')).toBeVisible();
  await expect(page.locator('#view-orcamentos [data-budget-form]')).toBeVisible();
}

async function readBudgets(account) {
  let budgets = [];
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const snapshot = await getDocs(collection(context.firestore(), 'users', account.uid, 'budgets'));
    budgets = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
  });
  return budgets;
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
  setupApp = initializeApp({ apiKey: 'demo-key', authDomain: `${PROJECT_ID}.firebaseapp.com`, projectId: PROJECT_ID }, `e2e-budgets-${Date.now()}`);
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

test('cria limites, acompanha o consumo e sincroniza entre abas e com lancamentos de fora', async ({ browser }) => {
  const account = await createAccount('budgets');
  await seed(account);

  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();
  await signIn(pageA, account);
  await signIn(pageB, account);
  await openBudgets(pageA);
  await openBudgets(pageB);

  // Aba A cria o limite de Alimentacao: 300 pago + 150 a pagar de 500 = 90%.
  await pageA.locator('#budget-target').selectOption('Alimentação');
  await pageA.locator('#budget-amount').fill('500');
  await pageA.locator('#view-orcamentos button[type="submit"]').click();
  const foodA = pageA.locator('[data-budget-row="cat_alimentacao"]');
  await expect(foodA).toContainText('90%');
  await expect(foodA).toContainText('Perto do limite');

  // Aba B ve o limite sem recarregar e define o total do mes.
  await expect(pageB.locator('[data-budget-row="cat_alimentacao"]')).toContainText('90%');
  await pageB.locator('#budget-target').selectOption('__total__');
  await pageB.locator('#budget-amount').fill('1.000,00');
  await pageB.locator('#view-orcamentos button[type="submit"]').click();
  await expect(pageA.locator('[data-budget-row="total"]')).toContainText('49%');

  // As duas abas mudam limites ao mesmo tempo: nada se perde.
  await pageA.locator('#budget-target').selectOption('Transporte');
  await pageA.locator('#budget-amount').fill('50');
  await pageB.locator('[data-budget-row="cat_alimentacao"] [data-budget-edit]').click();
  await pageB.locator('#budget-amount').fill('600');
  await Promise.all([
    pageA.locator('#view-orcamentos button[type="submit"]').click(),
    pageB.locator('#view-orcamentos button[type="submit"]').click()
  ]);
  await expect(pageA.locator('[data-budget-row="cat_transporte"]')).toContainText('80%');
  await expect(pageA.locator('[data-budget-row="cat_alimentacao"]')).toContainText('75%');
  await expect(pageB.locator('[data-budget-row="cat_transporte"]')).toContainText('80%');

  // Lancamento gravado por fora (como a whatsapp-api faz) entra no calculo na hora.
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'users', account.uid, 'finance_records', 'whatsapp_teste'), expense(account, 'whatsapp_teste', { amount: 200 }));
  });
  await expect(pageA.locator('[data-budget-row="cat_alimentacao"]')).toContainText('108,3%');
  await expect(pageA.locator('[data-budget-row="cat_alimentacao"]')).toContainText('Limite ultrapassado');
  await expect(pageB.locator('[data-budget-row="cat_alimentacao"]')).toContainText('108,3%');
  if (SHOTS) await pageA.screenshot({ path: `${SHOTS}/orcamentos.png`, fullPage: true });

  const budgets = await readBudgets(account);
  const competence = currentCompetence();
  expect(budgets.map((item) => item.id).sort()).toEqual(['cat_alimentacao', 'cat_transporte', 'total']);
  expect(budgets.find((item) => item.id === 'cat_alimentacao').limits).toEqual({ [competence]: 600 });
  expect(budgets.find((item) => item.id === 'total').limits).toEqual({ [competence]: 1000 });

  // Remover pede confirmacao.
  await pageA.locator('[data-budget-row="cat_transporte"] [data-budget-delete]').click();
  await pageA.locator('[data-budget-row="cat_transporte"] [data-budget-delete-confirm]').click();
  await expect(pageB.locator('[data-budget-row="cat_transporte"]')).toHaveCount(0);

  await contextA.close();
  await contextB.close();
});
