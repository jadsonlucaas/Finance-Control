/**
 * Preferencias de notificacao e consentimento do WhatsApp (notification_settings/{uid}).
 * Puro, sem Firestore: usado pelo Dashboard e pela whatsapp-api (motor de alertas).
 * Os valores aceitos sao os mesmos das regras do Firestore.
 *
 * - Cada tipo de alerta liga/desliga sozinho. Sem documento salvo, valem os padroes
 *   (todos ligados, vencimento com 3 dias, envio as 9h), mas nada sai pelo WhatsApp
 *   sem consentimento explicito (whatsapp_consent = 'granted').
 * - O consentimento guarda versao do texto, horario e origem. Cada concessao/revogacao
 *   tambem vira um registro em notification_settings/{uid}/consent_events (so criacao).
 */
export const NOTIFICATION_SETTINGS_COLLECTION = 'notification_settings';
export const CONSENT_EVENTS_SUBCOLLECTION = 'consent_events';
export const NOTIFICATION_SETTINGS_SCHEMA_VERSION = 1;

// Versao do texto de consentimento mostrado no Dashboard. Ao mudar o texto, suba a versao
// (e a lista aceita nas regras do Firestore): consentimentos antigos continuam com a versao que viram.
export const WHATSAPP_CONSENT_VERSION = 'whatsapp-alerts-v1';
export const WHATSAPP_CONSENT_VERSIONS = Object.freeze([WHATSAPP_CONSENT_VERSION]);
export const WHATSAPP_CONSENT_STATES = Object.freeze(['none', 'granted', 'revoked']);
export const WHATSAPP_CONSENT_SOURCES = Object.freeze(['dashboard', 'whatsapp']);

export const DUE_SOON_DAY_OPTIONS = Object.freeze([1, 3, 7]);
// Horario local de envio aceito (evita madrugada).
export const SEND_HOUR_MIN = 7;
export const SEND_HOUR_MAX = 21;

export const ALERT_TYPES = Object.freeze(['due_soon', 'overdue', 'budget', 'monthly_summary']);

export const DEFAULT_NOTIFICATION_SETTINGS = Object.freeze({
  due_soon_enabled: true,
  due_soon_days: 3,
  overdue_enabled: true,
  budget_enabled: true,
  monthly_summary_enabled: true,
  send_hour: 9,
  whatsapp_consent: 'none',
  whatsapp_consent_version: '',
  whatsapp_consent_source: '',
  whatsapp_consent_at: null
});

const bool = (value, fallback) => (typeof value === 'boolean' ? value : fallback);

function toIso(value) {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (typeof value?.toDate === 'function') return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  return null;
}

/** Preferencias efetivas: o que foi salvo, completado pelos padroes. */
export function resolveNotificationSettings(saved = null) {
  const d = DEFAULT_NOTIFICATION_SETTINGS;
  const s = saved && typeof saved === 'object' ? saved : {};
  const hour = Number(s.send_hour);
  return {
    due_soon_enabled: bool(s.due_soon_enabled, d.due_soon_enabled),
    due_soon_days: DUE_SOON_DAY_OPTIONS.includes(Number(s.due_soon_days)) ? Number(s.due_soon_days) : d.due_soon_days,
    overdue_enabled: bool(s.overdue_enabled, d.overdue_enabled),
    budget_enabled: bool(s.budget_enabled, d.budget_enabled),
    monthly_summary_enabled: bool(s.monthly_summary_enabled, d.monthly_summary_enabled),
    send_hour: Number.isInteger(hour) && hour >= SEND_HOUR_MIN && hour <= SEND_HOUR_MAX ? hour : d.send_hour,
    whatsapp_consent: WHATSAPP_CONSENT_STATES.includes(s.whatsapp_consent) ? s.whatsapp_consent : d.whatsapp_consent,
    whatsapp_consent_version: typeof s.whatsapp_consent_version === 'string' ? s.whatsapp_consent_version : '',
    whatsapp_consent_source: WHATSAPP_CONSENT_SOURCES.includes(s.whatsapp_consent_source) ? s.whatsapp_consent_source : '',
    whatsapp_consent_at: toIso(s.whatsapp_consent_at)
  };
}

/** So os campos de preferencia (sem consentimento), validados para gravar. */
export function validateNotificationPreferences(input = {}) {
  const out = {};
  for (const key of ['due_soon_enabled', 'overdue_enabled', 'budget_enabled', 'monthly_summary_enabled']) {
    if (typeof input[key] !== 'boolean') return { ok: false, error: 'NOTIFICATION_SETTINGS_INVALID' };
    out[key] = input[key];
  }
  const days = Number(input.due_soon_days);
  if (!DUE_SOON_DAY_OPTIONS.includes(days)) return { ok: false, error: 'NOTIFICATION_SETTINGS_INVALID' };
  out.due_soon_days = days;
  const hour = Number(input.send_hour);
  if (!Number.isInteger(hour) || hour < SEND_HOUR_MIN || hour > SEND_HOUR_MAX) return { ok: false, error: 'NOTIFICATION_SETTINGS_INVALID' };
  out.send_hour = hour;
  return { ok: true, value: out };
}

/** O alerta desse tipo pode sair pelo WhatsApp? (consentimento + tipo ligado) */
export function isWhatsAppAlertAllowed(settings, type) {
  const resolved = resolveNotificationSettings(settings);
  if (resolved.whatsapp_consent !== 'granted') return false;
  if (!ALERT_TYPES.includes(type)) return false;
  return resolved[`${type}_enabled`] === true;
}
