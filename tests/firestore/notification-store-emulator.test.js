import { createRequire } from 'node:module';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createFirestoreStore } from '../../services/whatsapp-api/src/firestoreStore.js';

/**
 * Alertas automaticos contra o Firestore de verdade (emulador): consultas, reserva atomica
 * das chaves, revogacao pelo WhatsApp e limpeza do que venceu.
 */
const requireFromApi = createRequire(new URL('../../services/whatsapp-api/package.json', import.meta.url));
const { initializeApp, deleteApp } = requireFromApi('firebase-admin/app');
const { getFirestore } = requireFromApi('firebase-admin/firestore');

const PROJECT_ID = 'finance-control-notification-store';
let app;
let db;
let store;

beforeAll(() => {
  process.env.FIRESTORE_EMULATOR_HOST ||= '127.0.0.1:8080';
  app = initializeApp({ projectId: PROJECT_ID }, 'notification-store');
  db = getFirestore(app);
  store = createFirestoreStore(db);
});
afterAll(async () => { await deleteApp(app); });
beforeEach(async () => {
  const host = process.env.FIRESTORE_EMULATOR_HOST;
  await fetch(`http://${host}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`, { method: 'DELETE' });
});

describe('whatsapp-api no Firestore: alertas', () => {
  it('lista quem consentiu, acha o vinculo ativo e grava a janela de 24h', async () => {
    await db.collection('notification_settings').doc('a').set({ whatsapp_consent: 'granted', send_hour: 9 });
    await db.collection('notification_settings').doc('b').set({ whatsapp_consent: 'revoked' });
    await db.collection('whatsapp_links').doc('+5511').set({ uid: 'a', telefone: '+5511', status: 'revoked' });
    await db.collection('whatsapp_links').doc('+5522').set({ uid: 'a', telefone: '+5522', status: 'active' });
    expect((await store.listNotificationRecipients({ limit: 10 })).map((r) => r.uid)).toEqual(['a']);
    await store.touchLinkInbound('+5522', '2026-11-14T10:00:00.000Z');
    await store.touchLinkInbound('+5599', '2026-11-14T10:00:00.000Z');
    expect(await store.getActiveLinkByUid('a')).toMatchObject({ telefone: '+5522', last_inbound_at: '2026-11-14T10:00:00.000Z' });
    expect((await db.collection('whatsapp_links').doc('+5599').get()).exists).toBe(false);
  });

  it('reserva todas as chaves ou nenhuma, mesmo com disparos simultaneos', async () => {
    const entries = (msg) => ['k1', 'k2'].map((id) => ({ id, data: { uid: 'a', status: 'pending', message_id: msg, expires_at: new Date('2027-01-01') } }));
    const results = await Promise.all([1, 2, 3, 4, 5].map((n) => store.reserveNotificationDeliveries(entries(`m${n}`))));
    expect(results.filter(Boolean)).toHaveLength(1);
    expect((await store.reserveNotificationDeliveries([{ id: 'k3', data: { uid: 'a' } }, { id: 'k1', data: { uid: 'a' } }]))).toBe(false);
    expect((await db.collection('notification_deliveries').doc('k3').get()).exists).toBe(false);
    const found = await store.getNotificationDeliveries(['k1', 'k2', 'k9']);
    expect([...found.keys()].sort()).toEqual(['k1', 'k2']);

    await store.saveNotificationMessage('m1', { uid: 'a', status: 'pending', delivery_ids: ['k1', 'k2'], expires_at: new Date('2026-01-01') });
    await store.failNotificationMessage('m1', ['k1', 'k2'], { status: 'failed', finished_at: 'x' });
    expect((await store.getNotificationDeliveries(['k1', 'k2'])).size).toBe(0);
    expect((await store.getNotificationMessage('m1')).status).toBe('failed');
    expect(await store.purgeExpiredNotificationData({ before: new Date('2026-06-01'), limit: 10 })).toBe(1);
  });

  it('revogacao pelo WhatsApp grava estado e historico juntos; exclusao de conta apaga tudo', async () => {
    const at = new Date('2026-11-14T12:00:00Z');
    await store.revokeNotificationConsent('a', { at, eventId: 'evt1234567' });
    const settings = await store.getNotificationSettings('a');
    expect(settings).toMatchObject({ whatsapp_consent: 'revoked', whatsapp_consent_source: 'whatsapp', whatsapp_consent_event_id: 'evt1234567' });
    const event = await db.collection('notification_settings').doc('a').collection('consent_events').doc('evt1234567').get();
    expect(event.data()).toMatchObject({ action: 'revoked', source: 'whatsapp' });

    await store.setNotificationState('a', { last_run_date: '2026-11-14' });
    await store.reserveNotificationDeliveries([{ id: 'd1', data: { uid: 'a' } }]);
    await store.saveNotificationMessage('m1', { uid: 'a' });
    await store.purgeAccountData('a');
    expect(await store.findAccountLeftovers('a')).toEqual([]);
  });
});
