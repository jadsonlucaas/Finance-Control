import {
  createPlanChooserModel,
  PLAN_CHOICE_STORAGE_KEY,
  readCheckoutReturn,
  renderPlanChooser,
  stripCheckoutReturn
} from './planChooserModel.js';

function safeStorage(target) {
  try {
    return target.sessionStorage || null;
  } catch {
    return null;
  }
}

function takePlanChoicePending(target, uid) {
  try {
    const storage = safeStorage(target);
    const value = storage?.getItem(PLAN_CHOICE_STORAGE_KEY);
    if (!value) return false;
    storage.removeItem(PLAN_CHOICE_STORAGE_KEY);
    return value === '1' || value === uid;
  } catch {
    return false;
  }
}

export function installPlanChooser(target = globalThis, options = {}) {
  const documentRef = target?.document;
  if (!documentRef) return null;
  if (target.financeApp?.planChooser) return target.financeApp.planChooser;

  const getUid = options.getUid || (() => target.authSdk?.getCurrentUser?.()?.uid || '');
  const root = () => {
    let element = documentRef.getElementById('plan-chooser-root');
    if (!element) {
      element = documentRef.createElement('div');
      element.id = 'plan-chooser-root';
      documentRef.body.appendChild(element);
    }
    return element;
  };
  const field = (name) => root().querySelector(`[data-plan-field="${name}"]`);

  const model = createPlanChooserModel({
    onboarding: options.onboarding ?? target.accountOnboardingSdk,
    billing: options.billing ?? target.billingCheckoutSdk,
    validate: options.validate ?? target.authSdk?.validateSignupDetails ?? (() => ({ ok: false, error: 'Indisponível.' })),
    getUid,
    navigate: options.navigate || ((url) => target.location.assign(url)),
    render: (state) => { root().innerHTML = renderPlanChooser(state); },
    readForm: () => ({
      name: field('name')?.value || '',
      country: field('country')?.value || '',
      phone: field('phone')?.value || '',
      consent: Boolean(field('consent')?.checked)
    })
  });

  documentRef.addEventListener('click', (event) => {
    const action = event.target.closest?.('[data-plan-action]')?.dataset.planAction;
    if (!action) return;
    if (action === 'premium') model.choosePremium();
    if (action === 'free' || action === 'close') model.close();
    if (action === 'go-whatsapp') {
      model.close();
      target.location.hash = '#/configuracoes';
    }
  });

  // Ao entrar com acesso liberado: volta do Stripe ou conta recem-criada.
  const onAccessActive = (uid) => {
    const checkoutReturn = readCheckoutReturn(target.location?.search);
    if (checkoutReturn) {
      const clean = stripCheckoutReturn(target.location?.href);
      if (clean) target.history?.replaceState?.(null, '', clean);
      model.open({ mode: checkoutReturn === 'sucesso' ? 'success' : 'canceled' });
      target.financeApp?.whatsappLinkActiveUi?.refresh?.();
      // O webhook do Stripe pode levar alguns segundos: confere o plano de novo.
      setTimeout(() => target.financeApp?.planGate?.refresh?.(), 5000);
      return;
    }
    if (takePlanChoicePending(target, uid)) model.open({ waitFor: target.__financeSignupInFlight });
  };
  target.addEventListener?.('financeAccessActive', (event) => onAccessActive(event?.detail?.uid || getUid()));
  // Se o acesso ja foi liberado antes deste modulo carregar.
  const context = target.financeApp?.authContext;
  if (context?.accessState === 'active') onAccessActive(context.uid || getUid());

  const api = { installed: true, open: (opts) => model.open(opts), close: model.close, model };
  target.financeApp = target.financeApp || {};
  target.financeApp.planChooser = api;
  return api;
}
