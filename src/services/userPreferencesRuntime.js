/**
 * Aplica as preferencias do usuario (idioma, moeda, pais, fuso) no app inteiro.
 *
 * - Ao entrar: le user_onboarding pelo accountOnboardingSdk e aplica.
 * - Ao salvar em Configuracoes: o painel dispara PREFERENCES_CHANGED_EVENT e reaplica.
 * - Ao sair: volta aos padroes (BRL).
 * Aplica a moeda de exibicao e o idioma da interface (o fuso e usado pela whatsapp-api).
 * Falha ao ler nunca bloqueia o app: fica no padrao.
 */
import { getDisplayCurrency, setDisplayCurrency } from '../core/formatters.js';
import { resolveUserPreferences } from './accountOnboarding.js';
import { getLocale, setLocale } from '../core/i18n.js';
import { rememberLocale } from '../ui/i18n/installLocale.js';

export const PREFERENCES_CHANGED_EVENT = 'financeUserPreferencesChanged';

/**
 * Le o cadastro e o numero de WhatsApp vinculado e resolve as preferencias.
 * O idioma segue o numero vinculado (ou o do cadastro). Falha ao ler o vinculo nao bloqueia.
 */
export async function loadAccountPreferences(target, uid, service = target?.accountOnboardingSdk) {
  const [details, linkedPhone] = await Promise.all([
    service.getMyDetails(uid),
    Promise.resolve()
      .then(() => target?.whatsappLinkSdk?.getStatus?.(uid))
      .then((status) => (status?.linked ? status.phoneId || '' : ''))
      .catch(() => '')
  ]);
  return { details, preferences: resolveUserPreferences(details, { linkedPhone }) };
}

export function installUserPreferencesRuntime(target = globalThis, options = {}) {
  if (!target?.addEventListener) return null;
  if (target.financeApp?.userPreferencesRuntime?.installed) return target.financeApp.userPreferencesRuntime;
  const service = () => options.service || target.accountOnboardingSdk || null;
  let loadToken = 0;

  function apply(preferences) {
    const app = target.financeApp || {};
    target.financeApp = app;
    app.userPreferences = preferences;
    // Idioma: so troca com uma conta logada (preferencia salva); sem conta fica o do navegador.
    if (preferences?.fromAccount) {
      const localeBefore = getLocale();
      rememberLocale(target, preferences.locale);
      // Graficos e textos montados pelo codigo (meses, PDF) precisam ser redesenhados.
      Promise.resolve(setLocale(preferences.locale)).then((locale) => {
        if (locale !== localeBefore) target.renderCurrentTab?.();
      });
    }
    const previous = getDisplayCurrency();
    const next = setDisplayCurrency(preferences?.currency);
    // Redesenha a aba atual so quando a moeda mudou de fato.
    if (next !== previous) target.renderCurrentTab?.();
  }

  async function loadFor(uid) {
    const token = ++loadToken;
    if (!uid || !service()?.getMyDetails) {
      apply(resolveUserPreferences(null));
      return;
    }
    try {
      const { details, preferences } = await loadAccountPreferences(target, uid, service());
      if (token === loadToken) apply({ ...preferences, fromAccount: Boolean(details) });
    } catch (error) {
      target.financeApp?.resilience?.errorReporter?.report?.({ error, operation: 'user_preferences.runtime_load' });
    }
  }

  target.addEventListener('authStateChanged', (event) => loadFor(event?.detail?.uid || ''));
  target.addEventListener(PREFERENCES_CHANGED_EVENT, (event) => {
    if (event?.detail) apply({ ...event.detail, fromAccount: true });
  });

  const app = target.financeApp || {};
  target.financeApp = app;
  app.userPreferencesRuntime = { installed: true, loadFor, apply };
  return app.userPreferencesRuntime;
}
