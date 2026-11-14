import { readFileSync } from 'node:fs';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createLegalConsentService, PRIVACY_VERSION, TERMS_VERSION } from '../../src/services/legalConsent.js';

const PROJECT_ID = 'finance-control-legal-consents-test';
const NOW = '2026-11-14T00:00:00.000Z';
const ALICE = 'alice';
const BOB = 'bob';
const OWNER = 'owner';

let testEnv;
const profile = (uid, { role = 'user', status = 'active' } = {}) => ({ uid, email: `${uid}@example.test`, role, status, created_at: NOW, updated_at: NOW });
const dbFor = (uid) => testEnv.authenticatedContext(uid, { email: `${uid}@example.test` }).firestore();
const consentRef = (db, uid) => doc(db, 'legal_consents', uid);

function acceptBatch(db, uid, { owner = uid, eventOverrides = {}, consentOverrides = {} } = {}) {
  const eventRef = doc(collection(db, 'legal_consents', owner, 'events'));
  const batch = writeBatch(db);
  batch.set(consentRef(db, owner), {
    uid: owner,
    schema_version: 1,
    terms_version: TERMS_VERSION,
    privacy_version: PRIVACY_VERSION,
    source: 'signup',
    locale: 'pt-BR',
    accepted_at: serverTimestamp(),
    last_event_id: eventRef.id,
    ...consentOverrides
  });
  batch.set(eventRef, {
    uid: owner,
    terms_version: TERMS_VERSION,
    privacy_version: PRIVACY_VERSION,
    source: 'signup',
    locale: 'pt-BR',
    at: serverTimestamp(),
    ...eventOverrides
  });
  return { batch, eventRef };
}

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({ projectId: PROJECT_ID, firestore: { rules: readFileSync(process.env.RULES_FILE || 'firestore.rules', 'utf8') } });
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, 'users', ALICE), profile(ALICE));
    await setDoc(doc(db, 'users', BOB), profile(BOB));
    await setDoc(doc(db, 'users', OWNER), profile(OWNER, { role: 'owner' }));
  });
});

afterAll(async () => {
  await testEnv?.cleanup();
});

describe('Firestore Rules - legal_consents', () => {
  it('servico grava o aceite com historico e le de volta', async () => {
    const service = createLegalConsentService(dbFor(ALICE));
    expect((await service.getMyConsent(ALICE)).current).toBe(false);
    await service.accept(ALICE, { source: 'signup', locale: 'es-ES' });
    await service.accept(ALICE, { source: 'dashboard', locale: 'pt-BR' });
    const consent = await service.getMyConsent(ALICE);
    expect(consent).toMatchObject({ terms_version: TERMS_VERSION, privacy_version: PRIVACY_VERSION, source: 'dashboard', locale: 'pt-BR', current: true });
    expect(consent.accepted_at).toMatch(/^\d{4}-/);
    const history = await service.listMyHistory(ALICE);
    expect(history.map((item) => item.source)).toEqual(['dashboard', 'signup']);
  });

  it('aceite logo apos criar a conta funciona mesmo sem perfil ainda', async () => {
    const service = createLegalConsentService(dbFor('recem-criada'));
    await assertSucceeds(service.accept('recem-criada', { source: 'signup' }));
  });

  it('ninguem le ou grava o aceite de outra pessoa; admin le; ninguem apaga', async () => {
    const { batch } = acceptBatch(dbFor(ALICE), ALICE);
    await assertSucceeds(batch.commit());
    await assertFails(getDoc(consentRef(dbFor(BOB), ALICE)));
    await assertFails(getDocs(collection(dbFor(BOB), 'legal_consents', ALICE, 'events')));
    await assertFails(acceptBatch(dbFor(BOB), BOB, { owner: ALICE }).batch.commit());
    await assertSucceeds(getDoc(consentRef(dbFor(OWNER), ALICE)));
    await assertFails(deleteDoc(consentRef(dbFor(ALICE), ALICE)));
  });

  it('historico e imutavel', async () => {
    const { batch, eventRef } = acceptBatch(dbFor(ALICE), ALICE);
    await batch.commit();
    await assertFails(updateDoc(doc(dbFor(ALICE), eventRef.path), { source: 'dashboard' }));
    await assertFails(deleteDoc(doc(dbFor(ALICE), eventRef.path)));
  });

  it('exige o registro no historico, versoes atuais e horario do servidor', async () => {
    const db = dbFor(ALICE);
    // Sem historico.
    await assertFails(setDoc(consentRef(db, ALICE), {
      uid: ALICE, schema_version: 1, terms_version: TERMS_VERSION, privacy_version: PRIVACY_VERSION,
      source: 'signup', locale: 'pt-BR', accepted_at: serverTimestamp(), last_event_id: 'x'
    }));
    await assertFails(acceptBatch(db, ALICE, { consentOverrides: { terms_version: 'termos-antigo' }, eventOverrides: { terms_version: 'termos-antigo' } }).batch.commit());
    await assertFails(acceptBatch(db, ALICE, { consentOverrides: { accepted_at: new Date() } }).batch.commit());
    await assertFails(acceptBatch(db, ALICE, { eventOverrides: { privacy_version: 'outra' } }).batch.commit());
    await assertFails(acceptBatch(db, ALICE, { consentOverrides: { source: 'whatsapp' }, eventOverrides: { source: 'whatsapp' } }).batch.commit());
    await assertFails(acceptBatch(db, ALICE, { consentOverrides: { extra: true } }).batch.commit());
  });
});
