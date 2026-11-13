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
