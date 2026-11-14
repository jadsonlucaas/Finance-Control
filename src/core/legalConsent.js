/**
 * Aceite dos Termos de Uso e da Politica de Privacidade (legal_consents/{uid}).
 * Puro, sem Firestore: usado pelo Dashboard (cadastro, novo aceite, painel de privacidade).
 *
 * - O documento guarda a versao de cada texto aceito, o horario do servidor, a origem
 *   (cadastro ou Dashboard) e o idioma em que o texto foi mostrado.
 * - Cada aceite tambem vira um registro imutavel em legal_consents/{uid}/events.
 * - Ao publicar texto novo: suba a versao aqui, nas regras do Firestore (listas aceitas)
 *   e nas paginas public/legal/*.html. Quem aceitou a versao antiga e convidado a aceitar de novo.
 */
export const LEGAL_CONSENTS_COLLECTION = 'legal_consents';
export const LEGAL_EVENTS_SUBCOLLECTION = 'events';
export const LEGAL_CONSENT_SCHEMA_VERSION = 1;

export const TERMS_VERSION = 'termos-2026-11-v1';
export const PRIVACY_VERSION = 'privacidade-2026-11-v1';
export const TERMS_VERSIONS = Object.freeze([TERMS_VERSION]);
export const PRIVACY_VERSIONS = Object.freeze([PRIVACY_VERSION]);
export const LEGAL_CONSENT_SOURCES = Object.freeze(['signup', 'dashboard']);
export const LEGAL_CONSENT_LOCALES = Object.freeze(['pt-BR', 'es-ES']);

export const TERMS_URL = '/legal/termos.html';
export const PRIVACY_URL = '/legal/privacidade.html';

/** Link do documento no idioma da pessoa (as paginas leem ?lang=). */
export function legalDocumentUrl(kind, locale = 'pt-BR') {
  const base = kind === 'privacy' ? PRIVACY_URL : TERMS_URL;
  return locale === 'es-ES' ? `${base}?lang=es` : base;
}

function toIso(value) {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (typeof value?.toDate === 'function') return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  return null;
}

export function normalizeLegalLocale(locale) {
  return LEGAL_CONSENT_LOCALES.includes(locale) ? locale : 'pt-BR';
}

/** Situacao do aceite salvo (ou de nenhum). */
export function resolveLegalConsent(saved = null) {
  const s = saved && typeof saved === 'object' ? saved : {};
  const termsVersion = typeof s.terms_version === 'string' ? s.terms_version : '';
  const privacyVersion = typeof s.privacy_version === 'string' ? s.privacy_version : '';
  return {
    terms_version: termsVersion,
    privacy_version: privacyVersion,
    accepted_at: toIso(s.accepted_at),
    source: LEGAL_CONSENT_SOURCES.includes(s.source) ? s.source : '',
    locale: LEGAL_CONSENT_LOCALES.includes(s.locale) ? s.locale : '',
    current: termsVersion === TERMS_VERSION && privacyVersion === PRIVACY_VERSION
  };
}

/** Precisa aceitar (de novo)? Sem registro ou com versao antiga de qualquer um dos textos. */
export function needsLegalAcceptance(saved = null) {
  return !resolveLegalConsent(saved).current;
}

/** Registro do historico, para exibir (mais novo primeiro). */
export function normalizeLegalEvents(events = []) {
  return (Array.isArray(events) ? events : [])
    .map((event) => ({
      terms_version: String(event?.terms_version || ''),
      privacy_version: String(event?.privacy_version || ''),
      source: LEGAL_CONSENT_SOURCES.includes(event?.source) ? event.source : '',
      locale: LEGAL_CONSENT_LOCALES.includes(event?.locale) ? event.locale : '',
      at: toIso(event?.at)
    }))
    .sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')));
}
