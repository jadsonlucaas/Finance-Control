/**
 * Aceite obrigatorio dos Termos de Uso e da Politica de Privacidade.
 *
 * Ao entrar com acesso liberado, confere legal_consents/{uid}. Sem aceite ou com versao
 * antiga, mostra um aviso que so fecha aceitando (ou saindo da conta). O aceite grava a
 * versao atual com historico (legalConsentSdk.accept).
 * Se a leitura falhar, o app segue normalmente e a conferencia e refeita no proximo login.
 */
import { getLocale } from '../../core/i18n.js';
import { legalDocumentUrl, needsLegalAcceptance } from '../../core/legalConsent.js';

const BUTTON = 'text-sm font-semibold px-4 py-2 rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed';

function escapeHtml(value = '') {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));
}

export function renderLegalConsentGate({ updated = false, saving = false, error = '', locale = 'pt-BR' } = {}) {
  const disabled = saving ? ' disabled' : '';
  const intro = updated
    ? 'Atualizamos os Termos de Uso e a Política de Privacidade. Leia e aceite a nova versão para continuar.'
    : 'Para continuar, leia e aceite os Termos de Uso e a Política de Privacidade.';
  return `<div class="fixed inset-0 z-[95] bg-black/60 flex items-center justify-center p-4" data-legal-gate role="dialog" aria-modal="true" aria-labelledby="legal-gate-title">
    <div class="bg-surface rounded-2xl border border-surfaceLight w-full max-w-md max-h-[90vh] overflow-y-auto p-5 space-y-3">
      <div class="flex items-start gap-3">
        <div class="w-9 h-9 rounded-lg bg-accent/10 text-accent flex items-center justify-center shrink-0"><i data-lucide="shield-check" class="w-5 h-5"></i></div>
        <h2 id="legal-gate-title" class="font-semibold text-base">Termos de Uso e Política de Privacidade</h2>
      </div>
      <p class="text-sm text-textSecondary">${escapeHtml(intro)}</p>
      <ul class="text-sm space-y-1">
        <li><a href="${legalDocumentUrl('terms', locale)}" target="_blank" rel="noopener" class="text-accent underline">Termos de Uso</a></li>
        <li><a href="${legalDocumentUrl('privacy', locale)}" target="_blank" rel="noopener" class="text-accent underline">Política de Privacidade</a></li>
      </ul>
      ${error ? `<div class="text-xs text-danger bg-danger/10 rounded-lg px-3 py-2" role="alert">${escapeHtml(error)}</div>` : ''}
      <div class="flex gap-2 justify-end flex-wrap pt-1">
        <button type="button" data-legal-action="logout" class="${BUTTON} bg-surfaceLight text-textSecondary hover:text-textPrimary"${disabled}>Sair</button>
        <button type="button" data-legal-action="accept" class="${BUTTON} bg-accent hover:bg-accentDark text-bg"${disabled}>${saving ? 'Salvando...' : 'Li e aceito'}</button>
      </div>
    </div>
  </div>`;
}

export function installLegalConsentGate(target = globalThis, options = {}) {
  const documentRef = target?.document;
  if (!documentRef?.body) return null;
  if (target.financeApp?.legalConsentGate?.installed) return target.financeApp.legalConsentGate;
  const service = () => options.service || target.legalConsentSdk || null;
  let state = { open: false, uid: '', updated: false, saving: false, error: '' };
  let checkToken = 0;

  function render() {
    let host = documentRef.getElementById('legal-consent-gate');
    if (!state.open) {
      host?.remove();
      return;
    }
    if (!host) {
      host = documentRef.createElement('div');
      host.id = 'legal-consent-gate';
      documentRef.body.appendChild(host);
    }
    host.innerHTML = renderLegalConsentGate({ ...state, locale: getLocale() });
    target.lucide?.createIcons?.();
    host.querySelector('[data-legal-action="accept"]')?.focus?.();
  }
  const setState = (patch) => {
    state = { ...state, ...patch };
    render();
  };

  async function check(uid) {
    const token = ++checkToken;
    if (!uid || !service()?.getMyConsent) return state;
    try {
      // Logo apos o cadastro, espera o aceite marcado no formulario ser gravado.
      if (target.__financeSignupInFlight) await Promise.resolve(target.__financeSignupInFlight).catch(() => {});
      const consent = await service().getMyConsent(uid);
      if (token !== checkToken) return state;
      if (needsLegalAcceptance(consent)) setState({ open: true, uid, updated: Boolean(consent.terms_version || consent.privacy_version), saving: false, error: '' });
      else if (state.open) setState({ open: false });
    } catch (error) {
      target.financeApp?.resilience?.errorReporter?.report?.({ error, operation: 'legal_consent.check' });
    }
    return state;
  }

  async function accept() {
    if (!state.open || state.saving) return state;
    setState({ saving: true, error: '' });
    try {
      await service().accept(state.uid, { source: 'dashboard', locale: getLocale() });
      setState({ open: false, saving: false });
      target.dispatchEvent?.(new CustomEvent('financeLegalConsentChanged'));
    } catch (error) {
      target.financeApp?.resilience?.errorReporter?.report?.({ error, operation: 'legal_consent.accept' });
      setState({ saving: false, error: 'Não foi possível salvar agora. Tente de novo.' });
    }
    return state;
  }

  documentRef.addEventListener('click', (event) => {
    const action = event.target.closest?.('[data-legal-action]')?.dataset?.legalAction;
    if (action === 'accept') accept();
    if (action === 'logout') {
      setState({ open: false });
      Promise.resolve(target.authSdk?.signOut?.()).catch(() => {});
    }
  });
  target.addEventListener?.('financeAccessActive', (event) => check(event?.detail?.uid || ''));
  target.addEventListener?.('authStateChanged', (event) => {
    if (!event?.detail) {
      checkToken += 1;
      setState({ open: false, uid: '' });
    }
  });
  // Acesso liberado antes deste modulo carregar.
  const context = target.financeApp?.authContext;
  if (context?.accessState === 'active' && context.uid) check(context.uid);

  const api = { installed: true, check, accept, getState: () => state };
  target.financeApp = target.financeApp || {};
  target.financeApp.legalConsentGate = api;
  return api;
}
