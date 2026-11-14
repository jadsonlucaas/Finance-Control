import { readFileSync } from 'node:fs';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createNotificationSettingsService } from '../../src/services/notificationSettings.js';

const PROJECT_ID = 'finance-control-notifications-test';
const NOW = '2026-11-14T00:00:00.000Z';
const ALICE = 'alice';
const BOB = 'bob';
const PENDING = 'pending';
const OWNER = 'owner';

let testEnv;
const profile = (uid, { role = 'user', status = 'active' } = {}) => ({ uid, email: `${uid}@example.test`, role, status, created_at: NOW, updated_at: NOW });
const dbFor = (uid) => testEnv.authenticatedContext(uid, { email: `${uid}@example.test` }).firestore();
const settingsRef = (db, uid) => doc(db, 'notification_settings', uid);
const prefs = (uid, extra = {}) => ({
  uid,
  schema_version: 1,
  updated_at: serverTimestamp(),
  due_soon_enabled: true,
  due_soon_days: 3,
  overdue_enabled: true,
  budget_enabled: true,
  monthly_summary_enabled: false,
  send_hour: 9,
  whatsapp_consent: 'none',
  ...extra
});
const validPrefs = { due_soon_enabled: true, due_soon_days: 7, overdue_enabled: false, budget_enabled: true, monthly_summary_enabled: true, send_hour: 20 };

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

describe('Firestore Rules - notification_settings', () => {
  it('servico salva preferencias, concede e revoga o consentimento com historico', async () => {
    const service = createNotificationSettingsService(dbFor(ALICE));
    const saved = await service.savePreferences(ALICE, validPrefs);
    expect(saved).toMatchObject({ ...validPrefs, whatsapp_consent: 'none' });

    const granted = await service.setWhatsAppConsent(ALICE, true);
    expect(granted.whatsapp_consent).toBe('granted');
    // Mudar preferencias depois nao mexe no consentimento.
    await service.savePreferences(ALICE, { ...validPrefs, send_hour: 8 });
    const afterPrefs = await service.getMySettings(ALICE);
    expect(afterPrefs).toMatchObject({ send_hour: 8, whatsapp_consent: 'granted', whatsapp_consent_version: 'whatsapp-alerts-v1', whatsapp_consent_source: 'dashboard' });
    expect(afterPrefs.whatsapp_consent_at).toMatch(/^\d{4}-/);

    await service.setWhatsAppConsent(ALICE, false);
    expect((await service.getMySettings(ALICE)).whatsapp_consent).toBe('revoked');

    const events = await getDocs(collection(dbFor(ALICE), 'notification_settings', ALICE, 'consent_events'));
    expect(events.docs.map((item) => item.data().action).sort()).toEqual(['granted', 'revoked']);
  });

  it('consentimento direto no Dashboard ja cria o documento (sem salvar preferencias antes)', async () => {
    const service = createNotificationSettingsService(dbFor(ALICE));
    await service.setWhatsAppConsent(ALICE, true);
    expect((await service.getMySettings(ALICE)).whatsapp_consent).toBe('granted');
  });

  it('ninguem le ou grava preferencias de outra pessoa; conta pendente nao grava; admin le', async () => {
    await assertSucceeds(setDoc(settingsRef(dbFor(ALICE), ALICE), prefs(ALICE)));
    await assertFails(getDoc(settingsRef(dbFor(BOB), ALICE)));
    await assertFails(setDoc(settingsRef(dbFor(BOB), ALICE), prefs(ALICE)));
    await assertFails(setDoc(settingsRef(dbFor(PENDING), PENDING), prefs(PENDING)));
    await assertSucceeds(getDoc(settingsRef(dbFor(OWNER), ALICE)));
    await assertFails(deleteDoc(settingsRef(dbFor(ALICE), ALICE)));
  });

  it('recusa formato invalido', async () => {
    const ref = settingsRef(dbFor(ALICE), ALICE);
    await assertFails(setDoc(ref, prefs(ALICE, { due_soon_days: 2 })));
    await assertFails(setDoc(ref, prefs(ALICE, { send_hour: 3 })));
    await assertFails(setDoc(ref, prefs(ALICE, { send_hour: 9.5 })));
    await assertFails(setDoc(ref, prefs(ALICE, { budget_enabled: 'sim' })));
    await assertFails(setDoc(ref, prefs(ALICE, { uid: BOB })));
    await assertFails(setDoc(ref, prefs(ALICE, { plan: 'premium' })));
    await assertFails(setDoc(ref, prefs(ALICE, { updated_at: NOW })));
  });

  it('nao concede consentimento sem o registro no historico, nem com historico divergente', async () => {
    const db = dbFor(ALICE);
    const ref = settingsRef(db, ALICE);
    const consent = { whatsapp_consent: 'granted', whatsapp_consent_version: 'whatsapp-alerts-v1', whatsapp_consent_source: 'dashboard', whatsapp_consent_at: serverTimestamp(), whatsapp_consent_event_id: 'abcdefghij1234567890' };
    await assertFails(setDoc(ref, prefs(ALICE, consent)));

    await assertSucceeds(setDoc(ref, prefs(ALICE)));
    await assertFails(updateDoc(ref, { ...consent, updated_at: serverTimestamp() }));

    // Historico com acao diferente do estado gravado.
    const batch = writeBatch(db);
    const eventRef = doc(db, 'notification_settings', ALICE, 'consent_events', 'abcdefghij1234567890');
    batch.set(ref, prefs(ALICE, consent));
    batch.set(eventRef, { uid: ALICE, action: 'revoked', version: 'whatsapp-alerts-v1', source: 'dashboard', at: serverTimestamp() });
    await assertFails(batch.commit());

    // Origem 'whatsapp' e reservada ao servidor; versao desconhecida e recusada.
    for (const extra of [{ whatsapp_consent_source: 'whatsapp' }, { whatsapp_consent_version: 'v0' }]) {
      const attempt = writeBatch(db);
      attempt.set(ref, prefs(ALICE, { ...consent, ...extra }));
      attempt.set(eventRef, { uid: ALICE, action: 'granted', version: extra.whatsapp_consent_version || 'whatsapp-alerts-v1', source: extra.whatsapp_consent_source || 'dashboard', at: serverTimestamp() });
      await assertFails(attempt.commit());
    }
  });

  it('historico de consentimento nao pode ser alterado, apagado ou criado solto', async () => {
    const service = createNotificationSettingsService(dbFor(ALICE));
    await service.setWhatsAppConsent(ALICE, true);
    const events = await getDocs(collection(dbFor(ALICE), 'notification_settings', ALICE, 'consent_events'));
    const eventRef = events.docs[0].ref;
    await assertFails(updateDoc(eventRef, { action: 'revoked' }));
    await assertFails(deleteDoc(eventRef));
    await assertFails(setDoc(doc(dbFor(ALICE), 'notification_settings', ALICE, 'consent_events', 'solto1234567'), { uid: ALICE, action: 'granted', version: 'whatsapp-alerts-v1', source: 'dashboard', at: serverTimestamp() }));
    await assertFails(getDocs(collection(dbFor(BOB), 'notification_settings', ALICE, 'consent_events')));
  });
});
