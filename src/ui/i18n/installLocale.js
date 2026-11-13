/**
 * Idioma inicial da interface, antes do login: o ultimo idioma usado neste navegador
 * ou o sugerido pelo navegador. Depois do login vale a preferencia da conta
 * (userPreferencesRuntime chama rememberLocale).
 */
import { setLocale } from '../../core/i18n.js';
import { browserLocaleContext, suggestPreferences } from '../../core/userPreferences.js';
import { installDomTranslator } from './domTranslator.js';

export const LOCALE_STORAGE_KEY = 'fc.locale';

export function rememberLocale(target, locale) {
  try {
    target?.localStorage?.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // Sem storage (aba privada): so nao lembra para a proxima visita.
  }
}

export function initialLocale(target = globalThis) {
  try {
    const saved = target?.localStorage?.getItem(LOCALE_STORAGE_KEY);
    if (saved) return saved;
  } catch {
    // Sem storage: usa o navegador.
  }
  return suggestPreferences(browserLocaleContext(target)).locale;
}

export function installLocale(target = globalThis) {
  setLocale(initialLocale(target));
  return installDomTranslator(target);
}
