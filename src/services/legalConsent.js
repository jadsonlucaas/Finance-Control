import { collection, doc, getDoc, getDocs, limit, orderBy, query, serverTimestamp, writeBatch } from 'firebase/firestore';
import {
  LEGAL_CONSENT_SCHEMA_VERSION,
  LEGAL_CONSENT_SOURCES,
  LEGAL_CONSENTS_COLLECTION,
  LEGAL_EVENTS_SUBCOLLECTION,
  normalizeLegalEvents,
  normalizeLegalLocale,
  PRIVACY_VERSION,
  resolveLegalConsent,
  TERMS_VERSION
} from '../core/legalConsent.js';

export * from '../core/legalConsent.js';

/**
 * Aceite de Termos/Privacidade (legal_consents/{uid}).
 * accept() grava, no mesmo lote, o estado atual e um registro imutavel em events
 * (as regras do Firestore exigem os dois juntos, com o horario do servidor).
 */
export function createLegalConsentService(db) {
  const consentRef = (uid) => doc(db, LEGAL_CONSENTS_COLLECTION, uid);

  async function getMyConsent(uid) {
    if (!uid) return resolveLegalConsent(null);
    const snapshot = await getDoc(consentRef(uid));
    return resolveLegalConsent(snapshot.exists() ? snapshot.data() : null);
  }

  async function accept(uid, { source = 'dashboard', locale = 'pt-BR' } = {}) {
    if (!uid) throw new Error('LEGAL_UID_REQUIRED');
    if (!LEGAL_CONSENT_SOURCES.includes(source)) throw new Error('LEGAL_SOURCE_INVALID');
    const lang = normalizeLegalLocale(locale);
    const eventRef = doc(collection(db, LEGAL_CONSENTS_COLLECTION, uid, LEGAL_EVENTS_SUBCOLLECTION));
    const batch = writeBatch(db);
    batch.set(consentRef(uid), {
      uid,
      schema_version: LEGAL_CONSENT_SCHEMA_VERSION,
      terms_version: TERMS_VERSION,
      privacy_version: PRIVACY_VERSION,
      source,
      locale: lang,
      accepted_at: serverTimestamp(),
      last_event_id: eventRef.id
    });
    batch.set(eventRef, {
      uid,
      terms_version: TERMS_VERSION,
      privacy_version: PRIVACY_VERSION,
      source,
      locale: lang,
      at: serverTimestamp()
    });
    await batch.commit();
    return resolveLegalConsent({ terms_version: TERMS_VERSION, privacy_version: PRIVACY_VERSION, source, locale: lang, accepted_at: new Date().toISOString() });
  }

  async function listMyHistory(uid, max = 20) {
    if (!uid) return [];
    const snapshot = await getDocs(query(collection(db, LEGAL_CONSENTS_COLLECTION, uid, LEGAL_EVENTS_SUBCOLLECTION), orderBy('at', 'desc'), limit(max)));
    return normalizeLegalEvents(snapshot.docs.map((item) => item.data()));
  }

  return { getMyConsent, accept, listMyHistory };
}
