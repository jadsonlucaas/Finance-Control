/**
 * "Privacidade e dados" em Configurações.
 *
 * Mostra o que a pessoa aceitou (versao e data dos Termos/Privacidade, com historico),
 * as autorizacoes do WhatsApp e os direitos sobre os dados (exportar, excluir).
 * - Aceite: legalConsentSdk (legal_consents/{uid}); aceitar de novo grava novo registro.
 * - Alertas no WhatsApp: estado lido do notificationSettingsSdk; a troca fica no painel Notificações.
 * - Exportar: aparece so quando o servico de exportacao estiver configurado (dataExportSdk).
 */
import { getLocale } from '../../core/i18n.js';
import { legalDocumentUrl, needsLegalAcceptance, resolveLegalConsent } from '../../core/legalConsent.js';

const BUTTON = 'text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed';

function escapeHtml(value = '') {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));
}

export function formatPrivacyDate(iso, timeZone = '', locale = 'pt-BR') {
  if (!iso) return '';
  try {
    return new Intl.DateTimeFormat(locale || 'pt-BR', { dateStyle: 'short', timeStyle: 'short', ...(timeZone ? { timeZone } : {}) }).format(new Date(iso));
  } catch {
    return '';
  }
}

const SOURCE_LABELS = Object.freeze({ signup: 'no cadastro', dashboard: 'no app' });

function documentsSection({ consent, history, saving, timeZone, locale }) {
  const when = formatPrivacyDate(consent.accepted_at, timeZone, locale);
  const pending = needsLegalAcceptance(consent);
  const status = pending
    ? `<p class="text-xs text-warn" data-legal-status="pending">${consent.terms_version ? 'Há uma nova versão para aceitar.' : 'Ainda não aceitos nesta conta.'}</p>`
    : `<p class="text-xs text-success" data-legal-status="current">Aceitos em ${escapeHtml(when)}.</p>`;
  const action = pending
    ? `<div><button type="button" data-privacy-action="accept" class="${BUTTON} bg-accent hover:bg-accentDark text-bg"${saving ? ' disabled' : ''}>Li e aceito</button></div>`
    : '';
  const items = history.slice(0, 5).map((event) => `
      <li class="flex flex-wrap gap-x-2">
        <span>${escapeHtml(formatPrivacyDate(event.at, timeZone, locale))}</span>
        <span class="text-textSecondary">${escapeHtml(SOURCE_LABELS[event.source] || '')}</span>
        <span class="text-textSecondary">${escapeHtml(event.terms_version)} · ${escapeHtml(event.privacy_version)}</span>
      </li>`).join('');
  return `
    <div class="rounded-lg border border-surfaceLight p-3 space-y-2">
      <p class="text-xs font-semibold">Documentos</p>
      <p class="text-xs"><a href="${legalDocumentUrl('terms', locale)}" target="_blank" rel="noopener" class="text-accent underline">Termos de Uso</a> · <a href="${legalDocumentUrl('privacy', locale)}" target="_blank" rel="noopener" class="text-accent underline">Política de Privacidade</a></p>
      ${status}
      ${action}
      ${items ? `<details class="text-xs"><summary class="cursor-pointer text-textSecondary">Histórico de aceites</summary><ul class="mt-2 space-y-1">${items}</ul></details>` : ''}
    </div>`;
}

function authorizationsSection({ alertsConsent, signupConsent }) {
  const alerts = {
    granted: 'Autorizados',
    revoked: 'Revogados',
    none: 'Não autorizados'
  }[alertsConsent] || 'Não autorizados';
  return `
    <div class="rounded-lg border border-surfaceLight p-3 space-y-2">
      <p class="text-xs font-semibold">Autorizações</p>
      <div class="flex items-center justify-between gap-2 text-xs">
        <span>Alertas no WhatsApp</span>
        <span class="text-textSecondary" data-privacy-alerts="${escapeHtml(alertsConsent)}">${alerts}</span>
      </div>
      <div class="flex items-center justify-between gap-2 text-xs">
        <span>Mensagens de boas-vindas no WhatsApp</span>
        <span class="text-textSecondary">${signupConsent ? 'Aceitas no cadastro' : 'Não aceitas'}</span>
      </div>
      <div><button type="button" data-privacy-action="manage-alerts" class="${BUTTON} bg-surfaceLight hover:bg-surfaceLight/80 text-textSecondary hover:text-textPrimary">Gerenciar alertas</button></div>
    </div>`;
}

function dataSection({ exportEnabled, exporting, locale }) {
  const exportBlock = exportEnabled
    ? `<div class="flex items-start justify-between gap-3 flex-wrap">
        <div class="min-w-0">
          <p class="text-xs">Baixar uma cópia de todos os seus dados.</p>
          <p class="text-xs text-textSecondary">Arquivo JSON com tudo e uma planilha CSV dos lançamentos.</p>
        </div>
        <button type="button" data-privacy-action="export" class="${BUTTON} bg-accent hover:bg-accentDark text-bg"${exporting ? ' disabled' : ''}>${exporting ? 'Preparando...' : 'Exportar meus dados'}</button>
      </div>`
    : '';
  return `
    <div class="rounded-lg border border-surfaceLight p-3 space-y-2">
      <p class="text-xs font-semibold">Seus dados</p>
      ${exportBlock}
      <p class="text-xs text-textSecondary">Para apagar a conta e todos os dados, use "Excluir minha conta" no fim desta página. Os prazos de guarda de cada dado estão na <a href="${legalDocumentUrl('privacy', locale)}" target="_blank" rel="noopener" class="text-accent underline">Política de Privacidade</a>.</p>
    </div>`;
}

export function renderPrivacyPanel({
  loading = false,
  saving = false,
  exporting = false,
  consent = resolveLegalConsent(null),
  history = [],
  alertsConsent = 'none',
  signupConsent = false,
  exportEnabled = false,
  timeZone = '',
  locale = 'pt-BR',
  error = '',
  notice = ''
} = {}) {
  const header = `
    <div class="flex items-start gap-3">
      <div class="w-8 h-8 rounded-lg bg-accent/10 text-accent flex items-center justify-center shrink-0">
        <i data-lucide="shield-check" class="w-4 h-4"></i>
      </div>
      <div class="min-w-0 flex-1">
        <h3 class="font-semibold text-sm">Privacidade e dados</h3>
        <p class="text-xs text-textSecondary mt-1">O que você aceitou, suas autorizações e seus dados.</p>
      </div>
    </div>`;
  if (loading) {
    return `<div class="bg-surface rounded-xl p-4 border border-surfaceLight" aria-busy="true">${header}
      <div class="space-y-2 mt-3">${'<div class="h-16 rounded-lg bg-surfaceLight/60 animate-pulse motion-reduce:animate-none"></div>'.repeat(3)}</div></div>`;
  }
  const feedback = error
    ? `<div class="text-xs text-danger bg-danger/10 rounded-lg px-3 py-2" role="alert">${escapeHtml(error)}</div>`
    : (notice ? `<p class="text-xs text-success" role="status">${escapeHtml(notice)}</p>` : '');
  return `<div class="bg-surface rounded-xl p-4 border border-surfaceLight">${header}
    <div class="mt-3 space-y-3">
      ${documentsSection({ consent, history, saving, timeZone, locale })}
      ${authorizationsSection({ alertsConsent, signupConsent })}
      ${dataSection({ exportEnabled, exporting, locale })}
      ${feedback}
    </div></div>`;
}

const currentUid = (target) => target.authSdk?.getCurrentUser?.()?.uid || '';

export function installPrivacyUi(target = globalThis, options = {}) {
  const documentRef = target?.document;
  if (!documentRef) return null;
  if (target.financeApp?.privacyUi?.installed) {
    target.financeApp.privacyUi.load();
    return target.financeApp.privacyUi;
  }
  const legal = () => options.legalService || target.legalConsentSdk || null;
  const notifications = () => options.notificationService || target.notificationSettingsSdk || null;
  const onboarding = () => options.onboardingService || target.accountOnboardingSdk || null;
  const exporter = () => options.exportService || target.dataExportSdk || null;
  const uidProvider = options.uidProvider || (() => currentUid(target));
  let state = { loading: true, saving: false, exporting: false, consent: resolveLegalConsent(null), history: [], alertsConsent: 'none', signupConsent: false, error: '', notice: '' };

  const root = () => documentRef.getElementById('privacy-panel');
  function render() {
    const panel = root();
    if (!panel) return;
    panel.innerHTML = renderPrivacyPanel({
      ...state,
      exportEnabled: Boolean(exporter()?.enabled),
      timeZone: target.financeApp?.userPreferences?.time_zone || '',
      locale: target.financeApp?.userPreferences?.locale || getLocale()
    });
    target.lucide?.createIcons?.();
  }
  const setState = (patch) => {
    state = { ...state, ...patch };
    render();
  };
  const report = (error, operation) => target.financeApp?.resilience?.errorReporter?.report?.({ error, operation });

  async function load() {
    const uid = uidProvider();
    if (!uid || !legal()?.getMyConsent) {
      setState({ loading: false });
      return;
    }
    setState({ loading: true, error: '', notice: '' });
    const safe = (promise, fallback) => Promise.resolve().then(() => promise()).catch((error) => {
      report(error, 'privacy.load');
      return fallback;
    });
    const [consent, history, settings, details] = await Promise.all([
      safe(() => legal().getMyConsent(uid), resolveLegalConsent(null)),
      safe(() => legal().listMyHistory?.(uid) || [], []),
      safe(() => notifications()?.getMySettings?.(uid), null),
      safe(() => onboarding()?.getMyDetails?.(uid), null)
    ]);
    setState({
      loading: false,
      consent,
      history: history || [],
      alertsConsent: settings?.whatsapp_consent || 'none',
      signupConsent: Boolean(details?.whatsapp_consent)
    });
  }

  async function accept() {
    const uid = uidProvider();
    if (!uid || state.saving) return;
    setState({ saving: true, error: '', notice: '' });
    try {
      const consent = await legal().accept(uid, { source: 'dashboard', locale: getLocale() });
      const history = (await Promise.resolve(legal().listMyHistory?.(uid)).catch(() => null)) || state.history;
      setState({ saving: false, consent, history, notice: 'Aceite registrado.' });
    } catch (error) {
      report(error, 'privacy.accept');
      setState({ saving: false, error: 'Não foi possível salvar agora. Tente de novo.' });
    }
  }

  async function exportData() {
    if (state.exporting || !exporter()?.enabled) return;
    setState({ exporting: true, error: '', notice: '' });
    try {
      await exporter().downloadMyData();
      setState({ exporting: false, notice: 'Arquivos baixados.' });
    } catch (error) {
      report(error, 'privacy.export');
      setState({ exporting: false, error: exporter().errorMessage?.(error) || 'Não foi possível exportar agora. Tente de novo.' });
    }
  }

  if (!documentRef.documentElement.dataset.financePrivacyBound) {
    documentRef.addEventListener('click', (event) => {
      const action = event.target.closest?.('[data-privacy-action]')?.dataset?.privacyAction;
      if (action === 'accept') accept();
      if (action === 'export') exportData();
      if (action === 'manage-alerts') {
        documentRef.getElementById('notification-settings-panel')?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
      }
    });
    target.addEventListener?.('authStateChanged', () => load());
    target.addEventListener?.('financeLegalConsentChanged', () => load());
    documentRef.documentElement.dataset.financePrivacyBound = 'true';
  }

  const app = target.financeApp || {};
  target.financeApp = app;
  app.privacyUi = { installed: true, load, accept, exportData, render, getState: () => state };
  load();
  return app.privacyUi;
}
