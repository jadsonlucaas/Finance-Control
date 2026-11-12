import { readFileSync } from 'node:fs';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, setDoc } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createAccountOnboardingService } from '../../src/services/accountOnboarding.js';

const PROJECT_ID = 'finance-control-onboarding-test';
const NOW = '2026-11-07T00:00:00.000Z';
const OWNER = 'jadson';
const NEWBIE = 'newbie';
const BOB = 'bob';

let testEnv;
const profile = (uid, { role = 'user', status = 'active' } = {}) => ({ uid, email: `${uid}@example.test`, role, status, created_at: NOW, updated_at: NOW });
const dbFor = (uid) => testEnv.authenticatedContext(uid, { email: `${uid}@example.test` }).firestore();
const valid = (uid, extra = {}) => ({ uid, name: 'Fulano', country: 'BR', whatsapp_phone: '+5511999998888', whatsapp_consent: true, consent_at: NOW, updated_at: NOW, ...extra });

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({ projectId: PROJECT_ID, firestore: { rules: readFileSync(process.env.RULES_FILE || 'firestore.rules', 'utf8') } });
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, 'users', OWNER), profile(OWNER, { role: 'owner' }));
    await setDoc(doc(db, 'users', NEWBIE), profile(NEWBIE, { status: 'pending' }));
    await setDoc(doc(db, 'users', BOB), profile(BOB));
  });
});

afterAll(async () => {
  await testEnv?.cleanup();
});

describe('Firestore Rules - dados do cadastro (user_onboarding)', () => {
  it('conta recem-criada (pendente) grava e le os proprios dados pelo servico', async () => {
    const service = createAccountOnboardingService(dbFor(NEWBIE), { now: () => NOW });
    await service.saveSignupDetails(NEWBIE, { name: 'Novo Cliente', country: 'ES', phone: '637 21 02 15', consent: true });
    expect(await service.getMyDetails(NEWBIE)).toMatchObject({ country: 'ES', whatsapp_phone: '+34637210215', whatsapp_consent: true });
  });

  it('ninguem grava ou le os dados de outra pessoa; admin ativo le', async () => {
    await assertSucceeds(setDoc(doc(dbFor(NEWBIE), 'user_onboarding', NEWBIE), valid(NEWBIE)));
    await assertFails(getDoc(doc(dbFor(BOB), 'user_onboarding', NEWBIE)));
    await assertFails(setDoc(doc(dbFor(BOB), 'user_onboarding', NEWBIE), valid(NEWBIE)));
    await assertSucceeds(getDoc(doc(dbFor(OWNER), 'user_onboarding', NEWBIE)));
    await assertFails(deleteDoc(doc(dbFor(NEWBIE), 'user_onboarding', NEWBIE)));
  });

  it('recusa formato invalido e campos extras (plano, status...)', async () => {
    const db = dbFor(NEWBIE);
    const ref = doc(db, 'user_onboarding', NEWBIE);
    await assertFails(setDoc(ref, valid(NEWBIE, { whatsapp_phone: '11999998888' })));
    await assertFails(setDoc(ref, valid(NEWBIE, { country: 'US' })));
    await assertFails(setDoc(ref, valid(NEWBIE, { plan: 'premium' })));
    await assertFails(setDoc(ref, valid(NEWBIE, { uid: BOB })));
    await assertFails(setDoc(ref, valid(NEWBIE, { whatsapp_consent: 'sim' })));
  });

  it('aceita idioma, moeda e fuso validos (opcionais) e recusa valores fora da lista', async () => {
    const ref = doc(dbFor(NEWBIE), 'user_onboarding', NEWBIE);
    await assertSucceeds(setDoc(ref, valid(NEWBIE, { locale: 'es-ES', currency: 'EUR', time_zone: 'Europe/Madrid' })));
    await assertSucceeds(setDoc(ref, valid(NEWBIE, { country: 'ES', locale: 'pt-BR', currency: 'BRL', time_zone: 'America/Manaus' })));
    await assertFails(setDoc(ref, valid(NEWBIE, { locale: 'en-US' })));
    await assertFails(setDoc(ref, valid(NEWBIE, { currency: 'USD' })));
    await assertFails(setDoc(ref, valid(NEWBIE, { time_zone: 'UTC' })));
  });

  it('o servico grava as preferencias sem mexer em nome e WhatsApp, e exige cadastro feito', async () => {
    const service = createAccountOnboardingService(dbFor(NEWBIE), { now: () => NOW });
    await expect(service.saveMyPreferences(NEWBIE, { country: 'ES', locale: 'es-ES', currency: 'EUR', time_zone: 'Europe/Madrid' }))
      .rejects.toThrow('ONBOARDING_DETAILS_REQUIRED');
    await service.saveSignupDetails(NEWBIE, { name: 'Novo Cliente', country: 'BR', phone: '11 99999-8888', consent: true });
    expect(await service.getMyPreferences(NEWBIE)).toEqual({ country: 'BR', locale: 'pt-BR', currency: 'BRL', time_zone: 'America/Sao_Paulo' });
    const saved = await service.saveMyPreferences(NEWBIE, { country: 'ES', locale: 'es-ES', currency: 'EUR', time_zone: 'Atlantic/Canary' });
    expect(saved).toEqual({ country: 'ES', locale: 'es-ES', currency: 'EUR', time_zone: 'Atlantic/Canary' });
    expect(await service.getMyDetails(NEWBIE)).toMatchObject({ name: 'Novo Cliente', whatsapp_phone: '+5511999998888', locale: 'es-ES' });
  });
});
