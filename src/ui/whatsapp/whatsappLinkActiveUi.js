import { createWhatsAppLinkController } from './whatsappLinkController.js';
import { createWhatsAppLinkPresenter } from './whatsappLinkPresenter.js';

function currentUid(target = globalThis) {
  return target.currentUser?.uid
    || target.auth?.currentUser?.uid
    || target.authSdk?.getCurrentUser?.()?.uid
    || target.currentUserProfile?.uid
    || '';
}

function currentEmail(target = globalThis) {
  return target.currentUser?.email
    || target.auth?.currentUser?.email
    || target.authSdk?.getCurrentUser?.()?.email
    || target.currentUserProfile?.email
    || '';
}

function bind(target, controller) {
  const documentRef = target.document;
  if (!documentRef || documentRef.documentElement.dataset.financeWhatsAppLinkBound) return;
  documentRef.addEventListener('click', (event) => {
    const action = event.target.closest?.('[data-whatsapp-link-action]')?.dataset.whatsappLinkAction;
    if (action === 'generate') controller.generateCode();
    if (action === 'cancel') controller.cancelCode();
    if (action === 'revoke') controller.revoke();
    if (action === 'reload') controller.load();
  });
  // Troca de usuario na mesma aba: recarrega o status da nova conta.
  target.addEventListener?.('authStateChanged', () => controller.load());
  documentRef.documentElement.dataset.financeWhatsAppLinkBound = 'true';
}

export function installWhatsAppLinkActiveUi(target = globalThis, options = {}) {
  if (!target?.document) return null;
  const service = options.service || target.whatsappLinkSdk;
  if (!service) return { installed: false, reason: 'WHATSAPP_LINK_SERVICE_UNAVAILABLE' };
  if (target.financeApp?.whatsappLinkActiveUi?.installed) return target.financeApp.whatsappLinkActiveUi;

  const presenter = options.presenter || createWhatsAppLinkPresenter({
    documentRef: target.document,
    botNumber: options.botNumber ?? target.__financeWhatsAppConfig?.botNumber ?? '',
    billing: options.billing ?? target.__financeWhatsAppConfig?.billing ?? {}
  });
  const controller = options.controller || createWhatsAppLinkController({
    service,
    accessService: options.accessService ?? target.whatsappAccessSdk ?? null,
    presenter,
    uidProvider: options.uidProvider || (() => currentUid(target)),
    emailProvider: options.emailProvider || (() => currentEmail(target)),
    confirmRevoke: options.confirmRevoke || (() => (typeof target.confirm === 'function'
      ? target.confirm('Desvincular o WhatsApp? O assistente deixa de responder a esse número.')
      : true)),
    errorReporter: options.errorReporter || target.financeApp?.applicationDependencies?.services?.errorReporter
  });

  bind(target, controller);
  controller.load();

  const state = target.financeApp || {};
  target.financeApp = state;
  state.whatsappLinkActiveUi = { installed: true, controller, presenter, refresh: () => controller.load() };
  return state.whatsappLinkActiveUi;
}
