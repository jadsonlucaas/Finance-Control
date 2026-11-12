/**
 * "Idioma, moeda e região" em Configuracoes.
 *
 * O usuario escolhe pais, idioma, moeda de exibicao e fuso horario, cada um de forma
 * independente. Grava em user_onboarding/{uid} pelo accountOnboardingSdk. Contas sem
 * cadastro (nome/WhatsApp) veem os padroes e um aviso para completar o cadastro.
 *
 * Depois de salvar, publica `financeApp.userPreferences` e dispara o evento
 * `financeUserPreferencesChanged` para as proximas etapas (formatacao, traducao).
 */
import {
  resolveUserPreferences,
  SIGNUP_COUNTRIES,
  SUPPORTED_CURRENCIES,
  SUPPORTED_LOCALES,
  SUPPORTED_TIME_ZONES
} from '../../services/accountOnboarding.js';

export const PREFERENCES_CHANGED_EVENT = 'financeUserPreferencesChanged';

const BUTTON = 'text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed';

const LOCALE_LABELS = Object.freeze({ 'pt-BR': 'Português (Brasil)', 'es-ES': 'Español (España)' });
const CURRENCY_LABELS = Object.freeze({ BRL: 'Real (R$)', EUR: 'Euro (€)' });

// Nome amigavel de cada fuso, agrupado pelo pais.
const TIME_ZONE_GROUPS = Object.freeze([
  {
    label: 'Brasil',
    zones: {
      'America/Sao_Paulo': 'Brasília / São Paulo',
      'America/Bahia': 'Salvador',
      'America/Fortaleza': 'Fortaleza',
      'America/Recife': 'Recife',
      'America/Belem': 'Belém',
      'America/Maceio': 'Maceió',
      'America/Araguaina': 'Araguaína (TO)',
      'America/Santarem': 'Santarém (PA)',
      'America/Noronha': 'Fernando de Noronha',
      'America/Manaus': 'Manaus',
      'America/Cuiaba': 'Cuiabá',
      'America/Campo_Grande': 'Campo Grande',
      'America/Porto_Velho': 'Porto Velho',
      'America/Boa_Vista': 'Boa Vista',
      'America/Rio_Branco': 'Rio Branco',
      'America/Eirunepe': 'Eirunepé (AM)'
    }
  },
  {
    label: 'Espanha',
    zones: {
      'Europe/Madrid': 'Madri (península e Baleares)',
      'Atlantic/Canary': 'Ilhas Canárias',
      'Africa/Ceuta': 'Ceuta e Melilla'
    }
  },
  {
    label: 'Portugal',
    zones: {
      'Europe/Lisbon': 'Lisboa (continente)',
      'Atlantic/Azores': 'Açores',
      'Atlantic/Madeira': 'Madeira'
    }
  }
]);

function escapeHtml(value = '') {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));
}

function option(value, label, selected) {
  return `<option value="${escapeHtml(value)}"${value === selected ? ' selected' : ''}>${escapeHtml(label)}</option>`;
}

function timeZoneOptions(selected) {
  return TIME_ZONE_GROUPS.map((group) => {
    const options = Object.entries(group.zones)
      .filter(([zone]) => SUPPORTED_TIME_ZONES.includes(zone))
      .map(([zone, label]) => option(zone, label, selected))
      .join('');
    return `<optgroup label="${escapeHtml(group.label)}">${options}</optgroup>`;
  }).join('');
}

function field(id, label, control) {
  return `
    <div>
      <label for="${id}" class="text-xs text-textSecondary mb-1 block">${label}</label>
      ${control}
    </div>`;
}

export function renderUserPreferencesPanel({
  loading = false,
  saving = false,
  needsSignup = false,
  preferences = resolveUserPreferences(null),
  error = '',
  notice = ''
} = {}) {
  const header = `
    <div class="flex items-start gap-3">
      <div class="w-8 h-8 rounded-lg bg-accent/10 text-accent flex items-center justify-center shrink-0">
        <i data-lucide="sliders-horizontal" class="w-4 h-4"></i>
      </div>
      <div class="min-w-0 flex-1">
        <h3 class="font-semibold text-sm">Idioma, moeda e região</h3>
        <p class="text-xs text-textSecondary mt-1">Cada opção é independente. A moeda muda só a forma de mostrar os valores; nada é convertido.</p>
      </div>
    </div>`;

  if (loading) {
    return `<div class="bg-surface rounded-xl p-4 border border-surfaceLight" aria-busy="true">${header}
      <div class="grid gap-3 sm:grid-cols-2 mt-3">
        ${'<div class="h-9 rounded-lg bg-surfaceLight/60 animate-pulse motion-reduce:animate-none"></div>'.repeat(4)}
      </div></div>`;
  }

  if (needsSignup) {
    return `<div class="bg-surface rounded-xl p-4 border border-surfaceLight">${header}
      <p class="text-xs text-textSecondary mt-3">Complete seu cadastro (nome, país e WhatsApp) para escolher idioma, moeda e fuso. Até lá, usamos Português, Real e o horário de Brasília.</p>
    </div>`;
  }

  const disabled = saving ? ' disabled' : '';
  const select = (id, name, options) => `<select id="${id}" name="${name}" class="w-full text-sm"${disabled}>${options}</select>`;
  const countryOptions = SIGNUP_COUNTRIES.map((item) => option(item.code, item.label, preferences.country)).join('');
  const localeOptions = SUPPORTED_LOCALES.map((code) => option(code, LOCALE_LABELS[code] || code, preferences.locale)).join('');
  const currencyOptions = SUPPORTED_CURRENCIES.map((code) => option(code, CURRENCY_LABELS[code] || code, preferences.currency)).join('');

  const feedback = error
    ? `<div class="text-xs text-danger bg-danger/10 rounded-lg px-3 py-2" role="alert">${escapeHtml(error)}</div>`
    : (notice ? `<p class="text-xs text-success" role="status">${escapeHtml(notice)}</p>` : '');

  return `<div class="bg-surface rounded-xl p-4 border border-surfaceLight">${header}
    <form data-user-preferences-form class="mt-3 space-y-3" autocomplete="off">
      <div class="grid gap-3 sm:grid-cols-2">
        ${field('user-pref-country', 'País', select('user-pref-country', 'country', countryOptions))}
        ${field('user-pref-locale', 'Idioma', select('user-pref-locale', 'locale', localeOptions))}
        ${field('user-pref-currency', 'Moeda', select('user-pref-currency', 'currency', currencyOptions))}
        ${field('user-pref-time-zone', 'Fuso horário', select('user-pref-time-zone', 'time_zone', timeZoneOptions(preferences.time_zone)))}
      </div>
      <p class="text-xs text-textSecondary">O país também define a moeda da assinatura Premium.</p>
      ${feedback}
      <div>
        <button type="submit" data-user-preferences-action="save" class="${BUTTON} bg-accent hover:bg-accentDark text-bg"${disabled}>${saving ? 'Salvando...' : 'Salvar'}</button>
      </div>
    </form>
  </div>`;
}

function currentUid(target) {
  return target.currentUser?.uid
    || target.auth?.currentUser?.uid
    || target.authSdk?.getCurrentUser?.()?.uid
    || target.currentUserProfile?.uid
    || '';
}

function readForm(documentRef) {
  const value = (id) => documentRef.getElementById(id)?.value || '';
  return {
    country: value('user-pref-country'),
    locale: value('user-pref-locale'),
    currency: value('user-pref-currency'),
    time_zone: value('user-pref-time-zone')
  };
}

const ERROR_MESSAGES = Object.freeze({
  ONBOARDING_DETAILS_REQUIRED: 'Complete seu cadastro antes de mudar essas opções.',
  'permission-denied': 'Não foi possível salvar. Tente de novo em instantes.',
  unavailable: 'Sem conexão no momento. Tente de novo em instantes.'
});

function messageFor(error) {
  const code = String(error?.code || '').replace(/^firestore\//, '');
  return ERROR_MESSAGES[code] || ERROR_MESSAGES[error?.message] || error?.message || 'Não foi possível salvar agora.';
}

export function installUserPreferencesUi(target = globalThis, options = {}) {
  const documentRef = target?.document;
  if (!documentRef) return null;
  if (target.financeApp?.userPreferencesUi?.installed) {
    target.financeApp.userPreferencesUi.load();
    return target.financeApp.userPreferencesUi;
  }
  const service = options.service || target.accountOnboardingSdk || null;
  const uidProvider = options.uidProvider || (() => currentUid(target));
  let state = { loading: true, saving: false, needsSignup: false, preferences: resolveUserPreferences(null), error: '', notice: '' };

  const root = () => documentRef.getElementById('user-preferences-panel');
  function render() {
    const panel = root();
    if (!panel) return;
    panel.innerHTML = renderUserPreferencesPanel(state);
    target.lucide?.createIcons?.();
  }
  const setState = (patch) => {
    state = { ...state, ...patch };
    render();
  };

  function publish(preferences) {
    const app = target.financeApp || {};
    target.financeApp = app;
    app.userPreferences = preferences;
    try {
      target.dispatchEvent?.(new target.CustomEvent(PREFERENCES_CHANGED_EVENT, { detail: preferences }));
    } catch {
      // Sem CustomEvent (ambiente de teste): o valor ja ficou em financeApp.userPreferences.
    }
  }

  async function load() {
    const uid = uidProvider();
    if (!service?.getMyDetails || !uid) {
      setState({ loading: false, needsSignup: true, error: '', notice: '' });
      return;
    }
    setState({ loading: true, error: '', notice: '' });
    try {
      const details = await service.getMyDetails(uid);
      const preferences = resolveUserPreferences(details);
      setState({ loading: false, needsSignup: !details, preferences });
      publish(preferences);
    } catch (error) {
      target.financeApp?.resilience?.errorReporter?.report?.({ error, operation: 'user_preferences.load' });
      setState({ loading: false, needsSignup: false, error: messageFor(error) });
    }
  }

  async function save() {
    if (state.saving) return;
    const uid = uidProvider();
    const draft = readForm(documentRef);
    setState({ saving: true, error: '', notice: '', preferences: { ...state.preferences, ...draft } });
    try {
      const preferences = await service.saveMyPreferences(uid, draft);
      setState({ saving: false, preferences, notice: 'Preferências salvas.' });
      publish(preferences);
    } catch (error) {
      target.financeApp?.resilience?.errorReporter?.report?.({ error, operation: 'user_preferences.save' });
      setState({ saving: false, error: messageFor(error) });
    }
  }

  if (!documentRef.documentElement.dataset.financeUserPreferencesBound) {
    documentRef.addEventListener('submit', (event) => {
      if (!event.target.closest?.('[data-user-preferences-form]')) return;
      event.preventDefault();
      save();
    });
    // Troca de usuario na mesma aba: recarrega as preferencias da nova conta.
    target.addEventListener?.('authStateChanged', () => load());
    documentRef.documentElement.dataset.financeUserPreferencesBound = 'true';
  }

  const app = target.financeApp || {};
  target.financeApp = app;
  app.userPreferencesUi = { installed: true, load, save, render, getState: () => state };
  load();
  return app.userPreferencesUi;
}
