import { doc, getDoc, setDoc } from 'firebase/firestore';
import { resolveUserPreferences, SIGNUP_COUNTRIES, validatePreferences } from '../core/userPreferences.js';

/**
 * Dados do cadastro usados no checkout e no WhatsApp (user_onboarding/{uid}).
 * - country: define a moeda do Premium (BR -> BRL; demais -> EUR).
 * - whatsapp_phone: numero que vira o principal do WhatsApp; vai pre-preenchido no checkout.
 * - whatsapp_consent: aceite para receber mensagens (boas-vindas, alertas) no WhatsApp.
 * - locale / currency / time_zone (opcionais): preferencias de idioma, moeda de exibicao e fuso.
 *   Sao independentes do pais; quando faltam, valem os padroes do pais (resolveUserPreferences).
 * As regras do Firestore validam o formato; so o proprio usuario grava e le (admin le).
 */
const COLLECTION = 'user_onboarding';
// Conta recem-criada: mostrar a escolha de plano (Gratuito/Premium) ao entrar.
export const PLAN_CHOICE_STORAGE_KEY = 'fc.planChoicePending';

export {
  defaultPreferencesForCountry,
  resolveUserPreferences,
  SIGNUP_COUNTRIES,
  SUPPORTED_CURRENCIES,
  SUPPORTED_LOCALES,
  SUPPORTED_TIME_ZONES,
  validatePreferences
} from '../core/userPreferences.js';

export function normalizeWhatsAppPhone(value, country = '') {
  let digits = String(value ?? '').replace(/\D/g, '');
  const raw = String(value ?? '').trim();
  const dial = SIGNUP_COUNTRIES.find((item) => item.code === country)?.dial || '';
  // Sem "+" e sem o DDI do pais: assume o pais escolhido (ex.: 11 99999-9999 no Brasil).
  if (!raw.startsWith('+') && dial && !digits.startsWith(dial)) digits = `${dial}${digits}`;
  if (digits.length < 10 || digits.length > 15 || digits.startsWith('0')) return '';
  return `+${digits}`;
}

export function validateSignupDetails({ name = '', country = '', phone = '', consent = false } = {}) {
  const cleanName = String(name || '').trim().replace(/\s+/g, ' ').slice(0, 80);
  if (cleanName.length < 2) return { ok: false, error: 'Informe seu nome.' };
  if (!SIGNUP_COUNTRIES.some((item) => item.code === country)) return { ok: false, error: 'Escolha o país.' };
  const whatsappPhone = normalizeWhatsAppPhone(phone, country);
  if (!whatsappPhone) return { ok: false, error: 'Informe um telefone de WhatsApp válido, com DDD.' };
  return { ok: true, value: { name: cleanName, country, whatsapp_phone: whatsappPhone, whatsapp_consent: Boolean(consent) } };
}

export function createAccountOnboardingService(db, { now = () => new Date().toISOString() } = {}) {
  async function saveSignupDetails(uid, details) {
    if (!uid) throw new Error('ONBOARDING_UID_REQUIRED');
    // Aceita o formulario ({phone, consent}) ou o resultado ja validado ({whatsapp_phone, whatsapp_consent}).
    const checked = validateSignupDetails({
      name: details?.name,
      country: details?.country,
      phone: details?.phone ?? details?.whatsapp_phone,
      consent: details?.consent ?? details?.whatsapp_consent
    });
    if (!checked.ok) throw new Error(checked.error);
    const timestamp = now();
    const data = { uid, ...checked.value, updated_at: timestamp };
    if (checked.value.whatsapp_consent) data.consent_at = timestamp;
    await setDoc(doc(db, COLLECTION, uid), data, { merge: true });
    return data;
  }

  async function getMyDetails(uid) {
    if (!uid) return null;
    const snapshot = await getDoc(doc(db, COLLECTION, uid));
    return snapshot.exists() ? snapshot.data() : null;
  }

  async function getMyPreferences(uid) {
    return resolveUserPreferences(await getMyDetails(uid));
  }

  // Grava pais, idioma, moeda e fuso. Exige o cadastro ja feito (nome e WhatsApp ficam como estao).
  async function saveMyPreferences(uid, preferences) {
    if (!uid) throw new Error('ONBOARDING_UID_REQUIRED');
    const checked = validatePreferences(preferences);
    if (!checked.ok) throw new Error(checked.error);
    const current = await getMyDetails(uid);
    if (!current) throw new Error('ONBOARDING_DETAILS_REQUIRED');
    const data = { ...checked.value, updated_at: now() };
    await setDoc(doc(db, COLLECTION, uid), data, { merge: true });
    return resolveUserPreferences({ ...current, ...data });
  }

  return { saveSignupDetails, getMyDetails, getMyPreferences, saveMyPreferences };
}
