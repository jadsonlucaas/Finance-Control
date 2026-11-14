import { readFileSync } from 'node:fs';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, setDoc } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createBudgetService } from '../../src/services/budgets.js';

const PROJECT_ID = 'finance-control-budgets-test';
const NOW = '2026-11-14T00:00:00.000Z';
const ALICE = 'alice';
const BOB = 'bob';
const PENDING = 'pending';
const OWNER = 'owner';

let testEnv;
const profile = (uid, { role = 'user', status = 'active' } = {}) => ({ uid, email: `${uid}@example.test`, role, status, created_at: NOW, updated_at: NOW });
const dbFor = (uid) => testEnv.authenticatedContext(uid, { email: `${uid}@example.test` }).firestore();
const budgetRef = (db, uid, id) => doc(db, 'users', uid, 'budgets', id);
const category = (uid, extra = {}) => ({ owner_uid: uid, scope: 'category', category_name: 'Alimentação', limits: { '2026-11': 500 }, updated_at: NOW, schema_version: 1, ...extra });
const total = (uid, extra = {}) => ({ owner_uid: uid, scope: 'total', limits: { '2026-11': 3000 }, updated_at: NOW, ...extra });

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({ projectId: PROJECT_ID, firestore: { rules: readFileSync(process.env.RULES_FILE || 'firestore.rules', 'utf8') } });
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, 'users', ALICE), profile(ALICE));
    await setDoc(doc(db, 'users', BOB), profile(BOB));
    await setDoc(doc(db, 'users', PENDING), profile(PENDING, { status: 'pending' }));
    await setDoc(doc(db, 'users', OWNER), profile(OWNER, { role: 'owner' }));
  });
});

afterAll(async () => {
  await testEnv?.cleanup();
});

describe('Firestore Rules - orcamentos (users/{uid}/budgets)', () => {
  it('dono ativo cria, le, altera e apaga orcamento por categoria e total', async () => {
    const db = dbFor(ALICE);
    await assertSucceeds(setDoc(budgetRef(db, ALICE, 'cat_alimentacao'), category(ALICE)));
    await assertSucceeds(setDoc(budgetRef(db, ALICE, 'total'), total(ALICE)));
    await assertSucceeds(getDoc(budgetRef(db, ALICE, 'cat_alimentacao')));
    await assertSucceeds(setDoc(budgetRef(db, ALICE, 'cat_alimentacao'), category(ALICE, { limits: { '2026-11': 500, '2026-12': 600 } })));
    await assertSucceeds(deleteDoc(budgetRef(db, ALICE, 'total')));
  });

  it('ninguem le ou grava orcamento de outra pessoa; conta pendente nao grava', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(budgetRef(context.firestore(), ALICE, 'cat_alimentacao'), category(ALICE));
    });
    await assertFails(getDoc(budgetRef(dbFor(BOB), ALICE, 'cat_alimentacao')));
    await assertFails(setDoc(budgetRef(dbFor(BOB), ALICE, 'cat_lazer'), category(ALICE, { category_name: 'Lazer' })));
    await assertFails(setDoc(budgetRef(dbFor(BOB), ALICE, 'cat_lazer'), category(BOB, { category_name: 'Lazer' })));
    await assertFails(deleteDoc(budgetRef(dbFor(BOB), ALICE, 'cat_alimentacao')));
    await assertFails(setDoc(budgetRef(dbFor(PENDING), PENDING, 'total'), total(PENDING)));
  });

  it('recusa formato invalido', async () => {
    const db = dbFor(ALICE);
    const ref = budgetRef(db, ALICE, 'cat_alimentacao');
    await assertFails(setDoc(ref, category(ALICE, { owner_uid: BOB })));
    await assertFails(setDoc(ref, category(ALICE, { limits: [500] })));
    await assertFails(setDoc(ref, category(ALICE, { category_name: '' })));
    await assertFails(setDoc(ref, category(ALICE, { category_name: 'x'.repeat(81) })));
    await assertFails(setDoc(ref, category(ALICE, { plan: 'premium' })));
    await assertFails(setDoc(ref, category(ALICE, { scope: 'total' })));
    await assertFails(setDoc(budgetRef(db, ALICE, 'total'), total(ALICE, { category_name: 'Lazer' })));
    await assertFails(setDoc(budgetRef(db, ALICE, 'outro'), category(ALICE)));
    await assertFails(setDoc(budgetRef(db, ALICE, 'total'), category(ALICE)));
    const { updated_at: _ignored, ...withoutUpdatedAt } = category(ALICE);
    await assertFails(setDoc(ref, withoutUpdatedAt));
  });

  it('servico grava pelo id deterministico e preserva o historico em transacao', async () => {
    let clock = 0;
    const service = createBudgetService(dbFor(ALICE), { now: () => `2026-11-14T00:00:0${clock++}.000Z` });
    await service.saveBudgetLimit(ALICE, { scope: 'category', category_name: 'Alimentação', competence: '2026-10', amount: 400 });
    await service.saveBudgetLimit(ALICE, { scope: 'category', category_name: 'alimentacao', competence: '2026-11', amount: '550,00' });
    await service.saveBudgetLimit(ALICE, { scope: 'total', competence: '2026-11', amount: 3000 });
    const budgets = await service.listBudgets(ALICE);
    expect(budgets).toHaveLength(2);
    const food = budgets.find((item) => item.id === 'cat_alimentacao');
    expect(food).toMatchObject({ category_name: 'Alimentação', limits: { '2026-10': 400, '2026-11': 550 } });
    await service.deleteBudget(ALICE, 'total');
    expect(await service.listBudgets(ALICE)).toHaveLength(1);
  });

  it('gravacoes simultaneas no mesmo orcamento nao perdem meses', async () => {
    const serviceA = createBudgetService(dbFor(ALICE), { now: () => NOW });
    const serviceB = createBudgetService(dbFor(ALICE), { now: () => NOW });
    await serviceA.saveBudgetLimit(ALICE, { scope: 'total', competence: '2026-09', amount: 1000 });
    await Promise.all([
      serviceA.saveBudgetLimit(ALICE, { scope: 'category', category_name: 'Lazer', competence: '2026-11', amount: 100 }),
      serviceB.saveBudgetLimit(ALICE, { scope: 'total', competence: '2026-11', amount: 2000 })
    ]);
    const budgets = await serviceA.listBudgets(ALICE);
    expect(budgets.find((item) => item.id === 'total').limits).toEqual({ '2026-09': 1000, '2026-11': 2000 });
    expect(budgets.find((item) => item.id === 'cat_lazer').limits).toEqual({ '2026-11': 100 });
  });
});
