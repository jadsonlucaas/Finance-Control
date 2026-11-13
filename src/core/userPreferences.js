/**
 * Preferencias do usuario (pais, idioma, moeda de exibicao, fuso horario).
 * Puro, sem Firestore: usado pelo Dashboard e pela whatsapp-api.
 * Os valores aceitos sao os mesmos das regras do Firestore (user_onboarding).
 */
export const SIGNUP_COUNTRIES = Object.freeze([
  { code: 'BR', label: 'Brasil', dial: '55' },
  { code: 'ES', label: 'Espanha', dial: '34' },
  { code: 'PT', label: 'Portugal', dial: '351' }
]);

export const SUPPORTED_LOCALES = Object.freeze(['pt-BR', 'es-ES']);
export const SUPPORTED_CURRENCIES = Object.freeze(['BRL', 'EUR']);
// Fusos aceitos (mesma lista das regras do Firestore). Independentes do pais escolhido.
export const SUPPORTED_TIME_ZONES = Object.freeze([
  'America/Sao_Paulo', 'America/Bahia', 'America/Fortaleza', 'America/Recife', 'America/Belem',
  'America/Maceio', 'America/Araguaina', 'America/Santarem', 'America/Noronha', 'America/Manaus',
  'America/Cuiaba', 'America/Campo_Grande', 'America/Porto_Velho', 'America/Boa_Vista',
  'America/Rio_Branco', 'America/Eirunepe',
  'Europe/Madrid', 'Atlantic/Canary', 'Africa/Ceuta',
  'Europe/Lisbon', 'Atlantic/Azores', 'Atlantic/Madeira'
]);

const COUNTRY_DEFAULTS = Object.freeze({
  BR: Object.freeze({ locale: 'pt-BR', currency: 'BRL', time_zone: 'America/Sao_Paulo' }),
  ES: Object.freeze({ locale: 'es-ES', currency: 'EUR', time_zone: 'Europe/Madrid' }),
  // Ainda nao ha traducao pt-PT: Portugal usa pt-BR ate existir.
  PT: Object.freeze({ locale: 'pt-BR', currency: 'EUR', time_zone: 'Europe/Lisbon' })
});

export function defaultPreferencesForCountry(country) {
  return { ...(COUNTRY_DEFAULTS[country] || COUNTRY_DEFAULTS.BR) };
}

/**
 * Preferencias efetivas do usuario: o que ele escolheu, completado pelos padroes do pais
 * (contas antigas nao tem esses campos). Sem dados de cadastro, vale o padrao do Brasil.
 */
export function resolveUserPreferences(details) {
  const country = SIGNUP_COUNTRIES.some((item) => item.code === details?.country) ? details.country : 'BR';
  const defaults = defaultPreferencesForCountry(country);
  return {
    country,
    locale: SUPPORTED_LOCALES.includes(details?.locale) ? details.locale : defaults.locale,
    currency: SUPPORTED_CURRENCIES.includes(details?.currency) ? details.currency : defaults.currency,
    time_zone: SUPPORTED_TIME_ZONES.includes(details?.time_zone) ? details.time_zone : defaults.time_zone
  };
}

export function validatePreferences({ country = '', locale = '', currency = '', time_zone: timeZone = '' } = {}) {
  if (!SIGNUP_COUNTRIES.some((item) => item.code === country)) return { ok: false, error: 'Escolha o país.' };
  if (!SUPPORTED_LOCALES.includes(locale)) return { ok: false, error: 'Escolha o idioma.' };
  if (!SUPPORTED_CURRENCIES.includes(currency)) return { ok: false, error: 'Escolha a moeda.' };
  if (!SUPPORTED_TIME_ZONES.includes(timeZone)) return { ok: false, error: 'Escolha o fuso horário.' };
  return { ok: true, value: { country, locale, currency, time_zone: timeZone } };
}

const COUNTRY_TIME_ZONES = Object.freeze({
  BR: SUPPORTED_TIME_ZONES.filter((zone) => zone.startsWith('America/')),
  ES: Object.freeze(['Europe/Madrid', 'Atlantic/Canary', 'Africa/Ceuta']),
  PT: Object.freeze(['Europe/Lisbon', 'Atlantic/Azores', 'Atlantic/Madeira'])
});

function countryFromPhone(phone) {
  const raw = String(phone ?? '').trim();
  if (!raw.startsWith('+')) return '';
  const digits = raw.replace(/\D/g, '');
  // DDI mais longo primeiro (351 antes de 35...).
  const match = [...SIGNUP_COUNTRIES].sort((a, b) => b.dial.length - a.dial.length).find((item) => digits.startsWith(item.dial));
  return match?.code || '';
}

function countryFromTimeZone(timeZone) {
  return Object.keys(COUNTRY_TIME_ZONES).find((code) => COUNTRY_TIME_ZONES[code].includes(timeZone)) || '';
}

function localeFromLanguages(languages = []) {
  for (const language of languages) {
    const code = String(language || '').toLowerCase();
    if (code.startsWith('es')) return 'es-ES';
    if (code.startsWith('pt')) return 'pt-BR';
  }
  return '';
}

function countryFromLanguages(languages = []) {
  for (const language of languages) {
    const code = String(language || '').toLowerCase();
    if (code.startsWith('es')) return 'ES';
    if (code === 'pt-pt') return 'PT';
    if (code.startsWith('pt')) return 'BR';
  }
  return '';
}

/**
 * Sugestao inicial de pais, idioma, moeda e fuso a partir do navegador e do telefone.
 * E so sugestao: o que o usuario escolher (ex.: o pais no cadastro) sempre vale mais.
 *
 * - country: escolhido > DDI do telefone (+55/+34/+351) > fuso do navegador > idioma > BR
 * - locale: idioma do navegador (es*, pt*) > padrao do pais
 * - time_zone: fuso do navegador, se for um dos aceitos > padrao do pais
 * - currency: padrao do pais
 */
export function suggestPreferences({ country = '', phone = '', languages = [], timeZone = '' } = {}) {
  const chosen = SIGNUP_COUNTRIES.some((item) => item.code === country) ? country : '';
  const resolvedCountry = chosen || countryFromPhone(phone) || countryFromTimeZone(timeZone) || countryFromLanguages(languages) || 'BR';
  const defaults = defaultPreferencesForCountry(resolvedCountry);
  return {
    country: resolvedCountry,
    locale: localeFromLanguages(languages) || defaults.locale,
    currency: defaults.currency,
    time_zone: SUPPORTED_TIME_ZONES.includes(timeZone) ? timeZone : defaults.time_zone
  };
}

/** Le idioma e fuso do navegador sem quebrar onde nao existirem. */
export function browserLocaleContext(target = globalThis) {
  let timeZone = '';
  try {
    timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
  } catch {
    timeZone = '';
  }
  const nav = target?.navigator || {};
  const languages = Array.isArray(nav.languages) && nav.languages.length ? [...nav.languages] : [nav.language].filter(Boolean);
  return { languages, timeZone };
}
