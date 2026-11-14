/**
 * "Notificações" em Configurações.
 *
 * O usuario liga/desliga cada alerta (contas a vencer, vencidas, orcamento, resumo mensal),
 * escolhe a antecedencia e o horario de envio, e autoriza ou revoga os alertas no WhatsApp.
 * Grava em notification_settings/{uid} pelo notificationSettingsSdk; o consentimento fica com
 * data, versao do texto e um registro no historico (consent_events).
 */
import {
  DUE_SOON_DAY_OPTIONS,
  resolveNotificationSettings,
  SEND_HOUR_MAX,
  SEND_HOUR_MIN
} from '../../core/notificationSettings.js';

const BUTTON = 'text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed';

// Texto exato do consentimento (versao whatsapp-alerts-v1). Mudou o texto? Suba a versao.
export const WHATSAPP_CONSENT_TEXT = 'Autorizo o envio de alertas financeiros (contas a vencer, contas vencidas, orçamento e resumo mensal) para o meu WhatsApp vinculado. Posso revogar quando quiser aqui ou mandando "parar alertas" no WhatsApp.';

const TOGGLES = Object.freeze([
  { key: 'due_soon_enabled', label: 'Contas a vencer', hint: 'Aviso antes do vencimento de despesas em aberto.' },
  { key: 'overdue_enabled', label: 'Contas vencidas', hint: 'Um aviso por conta vencida e não paga.' },
  { key: 'budget_enabled', label: 'Limite de orçamento', hint: 'Aviso ao chegar a 80% e a 100% do limite no mês.' },
  { key: 'monthly_summary_enabled', label: 'Resumo mensal', hint: 'Receitas, despesas e compromissos do mês anterior, no dia 1.' }
]);

function escapeHtml(value = '') {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));
}

function hourLabel(hour) {
  return `${String(hour).padStart(2, '0')}:00`;
}

function formatConsentDate(iso, timeZone, locale = 'pt-BR') {
  if (!iso) return '';
  try {
    return new Intl.DateTimeFormat(locale || 'pt-BR', { dateStyle: 'short', timeStyle: 'short', ...(timeZone ? { timeZone } : {}) }).format(new Date(iso));
  } catch {
    return '';
  }
}

function consentSection(settings, { saving, timeZone, locale }) {
  const disabled = saving ? ' disabled' : '';
  const granted = settings.whatsapp_consent === 'granted';
  const when = formatConsentDate(settings.whatsapp_consent_at, timeZone, locale);
  const status = granted
    ? `<p class="text-xs text-success" data-consent-status="granted">Alertas no WhatsApp autorizados${when ? ` em ${escapeHtml(when)}` : ''}.</p>`
    : `<p class="text-xs text-textSecondary" data-consent-status="${escapeHtml(settings.whatsapp_consent)}">${settings.whatsapp_consent === 'revoked' ? 'Autorização revogada' : 'Alertas no WhatsApp ainda não autorizados'}${settings.whatsapp_consent === 'revoked' && when ? ` em ${escapeHtml(when)}` : ''}.</p>`;
  const action = granted
    ? `<button type="button" data-notification-action="revoke" class="${BUTTON} bg-surfaceLight hover:bg-surfaceLight/80 text-textSecondary hover:text-textPrimary"${disabled}>Revogar autorização</button>`
    : `<button type="button" data-notification-action="grant" class="${BUTTON} bg-accent hover:bg-accentDark text-bg"${disabled}>Autorizar alertas no WhatsApp</button>`;
  return `
    <div class="rounded-lg border border-surfaceLight p-3 space-y-2">
      <p class="text-xs font-semibold">WhatsApp</p>
      <p class="text-xs text-textSecondary">${escapeHtml(WHATSAPP_CONSENT_TEXT)}</p>
      ${status}
      <div>${action}</div>
      <p class="text-xs text-textSecondary">Os alertas no WhatsApp fazem parte do Premium e usam o número vinculado em Configurações.</p>
    </div>`;
}

export function renderNotificationSettingsPanel({
  loading = false,
  saving = false,
  settings = resolveNotificationSettings(null),
  timeZone = '',
  locale = 'pt-BR',
  error = '',
  notice = ''
} = {}) {
  const header = `
    <div class="flex items-start gap-3">
      <div class="w-8 h-8 rounded-lg bg-accent/10 text-accent flex items-center justify-center shrink-0">
        <i data-lucide="bell" class="w-4 h-4"></i>
      </div>
      <div class="min-w-0 flex-1">
        <h3 class="font-semibold text-sm">Notificações</h3>
        <p class="text-xs text-textSecondary mt-1">Escolha quais alertas quer receber e em que horário.</p>
      </div>
    </div>`;

  if (loading) {
    return `<div class="bg-surface rounded-xl p-4 border border-surfaceLight" aria-busy="true">${header}
      <div class="space-y-2 mt-3">
        ${'<div class="h-9 rounded-lg bg-surfaceLight/60 animate-pulse motion-reduce:animate-none"></div>'.repeat(4)}
      </div></div>`;
  }

  const disabled = saving ? ' disabled' : '';
  const toggles = TOGGLES.map((item) => `
      <label class="flex items-start gap-2 cursor-pointer">
        <input type="checkbox" id="notif-${item.key}" name="${item.key}" class="mt-0.5"${settings[item.key] ? ' checked' : ''}${disabled}>
        <span class="min-w-0">
          <span class="text-sm block">${escapeHtml(item.label)}</span>
          <span class="text-xs text-textSecondary block">${escapeHtml(item.hint)}</span>
        </span>
      </label>`).join('');
  const dayOptions = DUE_SOON_DAY_OPTIONS.map((days) =>
    `<option value="${days}"${days === settings.due_soon_days ? ' selected' : ''}>${days === 1 ? '1 dia antes' : `${days} dias antes`}</option>`).join('');
  const hourOptions = [];
  for (let hour = SEND_HOUR_MIN; hour <= SEND_HOUR_MAX; hour += 1) {
    hourOptions.push(`<option value="${hour}"${hour === settings.send_hour ? ' selected' : ''}>${hourLabel(hour)}</option>`);
  }

  const feedback = error
    ? `<div class="text-xs text-danger bg-danger/10 rounded-lg px-3 py-2" role="alert">${escapeHtml(error)}</div>`
    : (notice ? `<p class="text-xs text-success" role="status">${escapeHtml(notice)}</p>` : '');

  return `<div class="bg-surface rounded-xl p-4 border border-surfaceLight">${header}
    <form data-notification-settings-form class="mt-3 space-y-3" autocomplete="off">
      <fieldset class="space-y-2">
        <legend class="sr-only">Tipos de alerta</legend>
        ${toggles}
      </fieldset>
      <div class="grid gap-3 sm:grid-cols-2">
        <div>
          <label for="notif-due_soon_days" class="text-xs text-textSecondary mb-1 block">Antecedência das contas a vencer</label>
          <select id="notif-due_soon_days" name="due_soon_days" class="w-full text-sm"${disabled}>${dayOptions}</select>
        </div>
        <div>
          <label for="notif-send_hour" class="text-xs text-textSecondary mb-1 block">Horário de envio</label>
          <select id="notif-send_hour" name="send_hour" class="w-full text-sm"${disabled}>${hourOptions.join('')}</select>
        </div>
      </div>
      <p class="text-xs text-textSecondary">O horário segue o fuso escolhido em "Idioma, moeda e região".</p>
      ${feedback}
      <div>
        <button type="submit" data-notification-action="save" class="${BUTTON} bg-accent hover:bg-accentDark text-bg"${disabled}>${saving ? 'Salvando...' : 'Salvar'}</button>
      </div>
    </form>
    <div class="mt-3">${consentSection(settings, { saving, timeZone, locale })}</div>
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
  const checked = (key) => Boolean(documentRef.getElementById(`notif-${key}`)?.checked);
  const value = (key) => documentRef.getElementById(`notif-${key}`)?.value;
  return {
    due_soon_enabled: checked('due_soon_enabled'),
    overdue_enabled: checked('overdue_enabled'),
    budget_enabled: checked('budget_enabled'),
    monthly_summary_enabled: checked('monthly_summary_enabled'),
    due_soon_days: Number(value('due_soon_days')),
    send_hour: Number(value('send_hour'))
  };
}

const ERROR_MESSAGES = Object.freeze({
  NOTIFICATION_SETTINGS_INVALID: 'Confira as opções escolhidas.',
  'permission-denied': 'Não foi possível salvar. Tente de novo em instantes.',
  unavailable: 'Sem conexão no momento. Tente de novo em instantes.'
});

function messageFor(error) {
  const code = String(error?.code || '').replace(/^firestore\//, '');
  return ERROR_MESSAGES[code] || ERROR_MESSAGES[error?.message] || 'Não foi possível salvar agora.';
}

export function installNotificationSettingsUi(target = globalThis, options = {}) {
  const documentRef = target?.document;
  if (!documentRef) return null;
  if (target.financeApp?.notificationSettingsUi?.installed) {
    target.financeApp.notificationSettingsUi.load();
    return target.financeApp.notificationSettingsUi;
  }
  const service = options.service || target.notificationSettingsSdk || null;
  const uidProvider = options.uidProvider || (() => currentUid(target));
  let state = { loading: true, saving: false, settings: resolveNotificationSettings(null), error: '', notice: '' };

  const root = () => documentRef.getElementById('notification-settings-panel');
  function render() {
    const panel = root();
    if (!panel) return;
    panel.innerHTML = renderNotificationSettingsPanel({ ...state, timeZone: target.financeApp?.userPreferences?.time_zone || '', locale: target.financeApp?.userPreferences?.locale || 'pt-BR' });
    target.lucide?.createIcons?.();
  }
  const setState = (patch) => {
    state = { ...state, ...patch };
    render();
  };

  async function load() {
    const uid = uidProvider();
    if (!service?.getMySettings || !uid) {
      setState({ loading: false, error: '', notice: '' });
      return;
    }
    setState({ loading: true, error: '', notice: '' });
    try {
      setState({ loading: false, settings: await service.getMySettings(uid) });
    } catch (error) {
      target.financeApp?.resilience?.errorReporter?.report?.({ error, operation: 'notification_settings.load' });
      setState({ loading: false, error: messageFor(error) });
    }
  }

  async function run(operation, action, notice) {
    if (state.saving || !service) return;
    const uid = uidProvider();
    if (!uid) return;
    setState({ saving: true, error: '', notice: '' });
    try {
      const settings = await action(uid);
      setState({ saving: false, settings, notice });
    } catch (error) {
      target.financeApp?.resilience?.errorReporter?.report?.({ error, operation });
      setState({ saving: false, error: messageFor(error) });
    }
  }

  const save = () => {
    const draft = readForm(documentRef);
    state = { ...state, settings: { ...state.settings, ...draft } };
    return run('notification_settings.save', (uid) => service.savePreferences(uid, draft), 'Preferências salvas.');
  };
  const grant = () => run('notification_settings.consent', (uid) => service.setWhatsAppConsent(uid, true), 'Alertas no WhatsApp autorizados.');
  const revoke = () => run('notification_settings.consent', (uid) => service.setWhatsAppConsent(uid, false), 'Autorização revogada. Nenhum alerta será enviado pelo WhatsApp.');

  if (!documentRef.documentElement.dataset.financeNotificationSettingsBound) {
    documentRef.addEventListener('submit', (event) => {
      if (!event.target.closest?.('[data-notification-settings-form]')) return;
      event.preventDefault();
      save();
    });
    documentRef.addEventListener('click', (event) => {
      const action = event.target.closest?.('[data-notification-action]')?.dataset?.notificationAction;
      if (action === 'grant') grant();
      if (action === 'revoke') revoke();
    });
    target.addEventListener?.('authStateChanged', () => load());
    documentRef.documentElement.dataset.financeNotificationSettingsBound = 'true';
  }

  const app = target.financeApp || {};
  target.financeApp = app;
  app.notificationSettingsUi = { installed: true, load, save, grant, revoke, render, getState: () => state };
  load();
  return app.notificationSettingsUi;
}
