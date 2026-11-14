import { collection, doc, getDoc, serverTimestamp, writeBatch } from 'firebase/firestore';
import {
  CONSENT_EVENTS_SUBCOLLECTION,
  NOTIFICATION_SETTINGS_COLLECTION,
  NOTIFICATION_SETTINGS_SCHEMA_VERSION,
  resolveNotificationSettings,
  validateNotificationPreferences,
  WHATSAPP_CONSENT_VERSION
} from '../core/notificationSettings.js';

export * from '../core/notificationSettings.js';

/**
 * Preferencias de notificacao do usuario (notification_settings/{uid}).
 * - savePreferences: liga/desliga cada alerta, antecedencia e horario. Nao mexe no consentimento.
 * - setWhatsAppConsent: concede ou revoga o envio de alertas pelo WhatsApp. Grava, no mesmo lote,
 *   o estado atual e um registro imutavel em consent_events (as regras exigem os dois juntos).
 */
export function createNotificationSettingsService(db) {
  const settingsRef = (uid) => doc(db, NOTIFICATION_SETTINGS_COLLECTION, uid);

  async function readRaw(uid) {
    const snapshot = await getDoc(settingsRef(uid));
    return snapshot.exists() ? snapshot.data() : null;
  }

  async function getMySettings(uid) {
    if (!uid) return resolveNotificationSettings(null);
    return resolveNotificationSettings(await readRaw(uid));
  }

  function baseDocument(uid, current, preferences) {
    const resolved = resolveNotificationSettings(current);
    return {
      uid,
      schema_version: NOTIFICATION_SETTINGS_SCHEMA_VERSION,
      due_soon_enabled: resolved.due_soon_enabled,
      due_soon_days: resolved.due_soon_days,
      overdue_enabled: resolved.overdue_enabled,
      budget_enabled: resolved.budget_enabled,
      monthly_summary_enabled: resolved.monthly_summary_enabled,
      send_hour: resolved.send_hour,
      ...preferences,
      updated_at: serverTimestamp()
    };
  }

  async function savePreferences(uid, input) {
    if (!uid) throw new Error('NOTIFICATION_UID_REQUIRED');
    const checked = validateNotificationPreferences(input);
    if (!checked.ok) throw new Error(checked.error);
    const current = await readRaw(uid);
    const data = baseDocument(uid, current, checked.value);
    // Documento novo nasce sem consentimento; um existente mantem o consentimento como esta.
    if (!current) data.whatsapp_consent = 'none';
    const batch = writeBatch(db);
    batch.set(settingsRef(uid), data, { merge: true });
    await batch.commit();
    return resolveNotificationSettings({ ...(current || {}), ...data, updated_at: null });
  }

  async function setWhatsAppConsent(uid, granted) {
    if (!uid) throw new Error('NOTIFICATION_UID_REQUIRED');
    const action = granted ? 'granted' : 'revoked';
    const current = await readRaw(uid);
    if (resolveNotificationSettings(current).whatsapp_consent === action) return resolveNotificationSettings(current);
    const eventRef = doc(collection(db, NOTIFICATION_SETTINGS_COLLECTION, uid, CONSENT_EVENTS_SUBCOLLECTION));
    const consent = {
      whatsapp_consent: action,
      whatsapp_consent_version: WHATSAPP_CONSENT_VERSION,
      whatsapp_consent_source: 'dashboard',
      whatsapp_consent_at: serverTimestamp(),
      whatsapp_consent_event_id: eventRef.id
    };
    const batch = writeBatch(db);
    batch.set(settingsRef(uid), { ...baseDocument(uid, current, {}), ...consent }, { merge: true });
    batch.set(eventRef, {
      uid,
      action,
      version: WHATSAPP_CONSENT_VERSION,
      source: 'dashboard',
      at: serverTimestamp()
    });
    await batch.commit();
    return resolveNotificationSettings({ ...(current || {}), ...consent, whatsapp_consent_at: new Date().toISOString() });
  }

  return { getMySettings, savePreferences, setWhatsAppConsent };
}
