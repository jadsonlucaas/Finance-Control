import { expect, test } from '@playwright/test';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { deleteApp, initializeApp } from 'firebase/app';
import { connectAuthEmulator, createUserWithEmailAndPassword, getAuth, signOut } from 'firebase/auth';
import { collection, doc, getDocs, setDoc } from 'firebase/firestore';
import { readFileSync } from 'node:fs';
import { acceptCurrentLegalTerms, grantPremiumAccess } from './helpers/legalConsent.js';

// Etapa 6: menu simplificado, chave Saídas | Entradas, Importação dentro de
// Configurações e módulos avançados (horas, H.E., DSR, INSS/IRRF) escondidos
// para quem não usa.

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

test.beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 }
  });
});

test.beforeEach(async () => {
  await testEnv.clearFirestore();
  await clearAuthEmulator();
  setupApp = initializeApp({ apiKey: 'demo-key', authDomain: `${PROJECT_ID}.firebaseapp.com`, projectId: PROJECT_ID }, `e2e-nav-${Date.now()}`);
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

async function shot(page, name) {
  if (!SHOTS) return;
  await page.waitForTimeout(400); // fim da animação de entrada da tela
  await page.screenshot({ path: `${SHOTS}/${name}.png` });
}

test('conta nova vê o menu simples e liga os módulos avançados em Configurações', async ({ page }) => {
  const account = await createAccount('nav');
  await seed(account);
  // Premium: a Importação é do Premium.
  await grantPremiumAccess(testEnv, account.uid);
  await signIn(page, account);

  const tabs = page.locator('#main-tabs button[data-tab]:visible');
  await expect(tabs).toHaveText([/^Início/, /^Lançamentos/, /^Orçamentos/, /^Parcelamentos/, /^Configurações/]);
  await expect(page.locator('#main-tabs [data-tab="entradas"], #main-tabs [data-tab="importacao"]')).toHaveCount(0);
  await expect(page.locator('html')).toHaveClass(/advanced-modules-off/);
  await shot(page, 'desk-menu-simples');

  // Lançamentos troca entre Saídas e Entradas e mantém o item do menu aceso.
  await page.locator('#main-tabs [data-tab="saidas"]').click();
  await expect(page.locator('#view-saidas')).toBeVisible();
  await page.locator('#view-saidas [data-ledger-tab="entradas"]').click();
  await expect(page.locator('#view-entradas')).toBeVisible();
  await expect(page.locator('#view-entradas [data-ledger-tab="entradas"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#main-tabs [data-tab="saidas"]')).toHaveClass(/bg-accent\/10/);
  await shot(page, 'desk-lancamentos-entradas');

  // Tipos de entrada da folha CLT ficam fora do formulário.
  await page.locator('#btn-new-entrada').click();
  const earning = page.locator('#form-earning-type');
  const visibleOptions = await earning.locator('option').evaluateAll((items) => items.filter((item) => !item.hidden).map((item) => item.value));
  expect(visibleOptions).toContain('Salário');
  for (const name of ['Hora Extra', 'DSR', 'INSS (dedução)', 'IRPF (dedução)']) expect(visibleOptions).not.toContain(name);

  // Configurações: Importação vira cartão; a chave liga os módulos avançados.
  await page.evaluate(() => window.switchTab('configuracoes'));
  await expect(page.locator('#settings-import-panel')).toBeVisible();
  const toggle = page.locator('#advanced-modules-toggle');
  await expect(toggle).not.toBeChecked();
  await page.locator('#settings-advanced-panel').scrollIntoViewIfNeeded();
  await shot(page, 'desk-configuracoes-modulos');
  await page.locator('#settings-advanced-panel .settings-switch').click();
  await expect(toggle).toBeChecked();
  await expect(page.locator('html')).not.toHaveClass(/advanced-modules-off/);
  await expect(page.locator('#main-tabs [data-tab="controle-horas"]')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('finance-control-advanced-modules-v1'))).toBe('on');

  await page.locator('#btn-settings-open-import').click();
  await expect(page.locator('#view-importacao')).toBeVisible();
  await expect(page.locator('#main-tabs [data-tab="configuracoes"]')).toHaveClass(/bg-accent\/10/);
});

test('quem já tem lançamento de horas continua vendo o controle de horas', async ({ page }) => {
  const account = await createAccount('nav-hours');
  await seed(account);
  await grantPremiumAccess(testEnv, account.uid);
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'users', account.uid, 'finance_records', 'he'), expense(account, 'he', {
      type: 'entrada', earning_type: 'Hora Extra', subcategory: 'Hora Extra', category_name: 'Hora Extra', person: 'Jadson'
    }));
  });
  await signIn(page, account);
  await expect(page.locator('#main-tabs [data-tab="controle-horas"]')).toBeVisible();
  await expect(page.locator('html')).not.toHaveClass(/advanced-modules-off/);
});

test('celular: barra inferior e chave de lançamentos cabem na tela', async ({ browser }) => {
  const account = await createAccount('nav-mobile');
  await seed(account);
  const context = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  await signIn(page, account);
  await page.locator('#bottom-nav [data-bottom-tab="saidas"]').click();
  await expect(page.locator('#view-saidas .ledger-switch')).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await shot(page, 'mob-lancamentos');
  await page.locator('#bottom-nav [data-bottom-tab="configuracoes"]').click();
  await page.locator('#settings-advanced-panel').scrollIntoViewIfNeeded();
  await shot(page, 'mob-configuracoes');
  await context.close();
});

test('conta sem lançamentos vê estados vazios com ação', async ({ page }) => {
  const account = await createAccount('nav-empty');
  await grantPremiumAccess(testEnv, account.uid);
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'users', account.uid), { uid: account.uid, email: account.email, role: 'user', status: 'active', created_at: NOW, updated_at: NOW, last_login_at: NOW });
  });
  await signIn(page, account);

  await page.locator('#main-tabs [data-tab="saidas"]').click();
  const empty = page.locator('#saidas-empty');
  await expect(empty).toBeVisible();
  await expect(empty).toContainText('Nenhuma saída registrada');
  await shot(page, 'desk-saidas-vazio');
  await empty.getByRole('button', { name: 'Nova saída' }).click();
  await expect(page.locator('#view-novo')).toBeVisible();

  await page.locator('#main-tabs [data-tab="parcelamentos"]').click();
  await expect(page.locator('#parcelamentos-list .empty-state')).toContainText('Nenhuma compra parcelada');
  await shot(page, 'desk-parcelamentos-vazio');
});

test('primeiros passos: aparece para conta nova, marca o lançamento e pode ser ocultado', async ({ page }) => {
  const account = await createAccount('nav-onboarding');
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'users', account.uid), { uid: account.uid, email: account.email, role: 'user', status: 'active', created_at: NOW, updated_at: NOW, last_login_at: NOW });
  });
  await signIn(page, account);
  // A janela de planos pode abrir sozinha para conta nova: escolhe o Gratuito.
  const free = page.locator('[data-plan-action="free"]').first();
  if (await free.isVisible().catch(() => false)) await free.click();

  const card = page.locator('#getting-started-card');
  await expect(card).toBeVisible({ timeout: 15000 });
  await expect(card.locator('[data-step="record"]')).not.toHaveClass(/is-done/);
  await shot(page, 'desk-primeiros-passos');

  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'users', account.uid, 'finance_records', 'primeiro'), expense(account, 'primeiro'));
  });
  await expect(card.locator('[data-step="record"]')).toHaveClass(/is-done/);

  await card.locator('[data-getting-started="dismiss"]').click();
  await expect(card).toHaveCount(0);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('finance-control-getting-started-v1')).dismissed)).toBe(true);
});

test('primeiros passos: conta com tudo feito não vê o cartão', async ({ page }) => {
  const account = await createAccount('nav-onboarding-done');
  await seed(account);
  await grantPremiumAccess(testEnv, account.uid);
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'whatsapp_links', '+5511999990000'), { uid: account.uid, phone: '+5511999990000', linked_at: NOW, status: 'active' });
  });
  await signIn(page, account);
  await page.waitForTimeout(3000);
  await expect(page.locator('#getting-started-card')).toHaveCount(0);
});
