import { evaluateWhatsAppAccess } from '../../services/whatsappAccess.js';

/**
 * Plano Gratuito x Premium no Dashboard.
 *
 * Gratuito ("Dashboard basico"): lancar entradas e saidas e ver o dashboard (e Configuracoes,
 * onde ficam a conta e a assinatura). O resto e Premium: abrir esses itens mostra a escolha
 * de plano. Premium = assinatura do Stripe valendo (trialing/active/past_due) ou cortesia do
 * admin; admin sempre tem tudo.
 *
 * Isto e a experiencia no app. O WhatsApp/IA continua bloqueado no servidor (whatsapp-api).
 */
// Aba -> como o recurso aparece no aviso ("<nome> é do Premium").
export const PREMIUM_TABS = Object.freeze({
  parcelamentos: 'O controle de parcelamentos',
  importacao: 'A importação',
  'controle-horas': 'O controle de horas'
});

export const PREMIUM_ACTIONS = Object.freeze({
  'btn-planner': 'O Planner',
  'btn-export-pdf': 'O relatório em PDF'
});

/** Plano efetivo a partir da cortesia, da assinatura e do papel do usuario. */
export function resolvePlan({ comp = null, subscription = null, isAdmin = false } = {}) {
  if (isAdmin) return { plan: 'premium', source: 'admin' };
  const access = evaluateWhatsAppAccess({ comp, subscription });
  return access.allowed ? { plan: 'premium', source: access.source } : { plan: 'free', source: access.source };
}

/** Decide se uma navegacao/acao pode seguir. Devolve o nome do recurso quando bloqueia. */
export function gateDecision({ plan, tab = '', actionId = '' }) {
  if (plan !== 'free') return { allowed: true };
  if (tab && PREMIUM_TABS[tab]) return { allowed: false, reason: PREMIUM_TABS[tab] };
  if (actionId && PREMIUM_ACTIONS[actionId]) return { allowed: false, reason: PREMIUM_ACTIONS[actionId] };
  return { allowed: true };
}

const BADGE_ATTR = 'data-premium-badge';

export function installPlanGate(target = globalThis, options = {}) {
  const documentRef = target?.document;
  if (!documentRef) return null;
  if (target.financeApp?.planGate) return target.financeApp.planGate;

  const accessService = options.accessService ?? target.whatsappAccessSdk;
  const getUid = options.getUid || (() => target.authSdk?.getCurrentUser?.()?.uid || '');
  const isAdmin = options.isAdmin || (() => Boolean(target.financeApp?.authContext?.isAdmin));
  let current = { plan: 'unknown', source: 'none' };

  async function refresh() {
    const uid = getUid();
    if (!uid) {
      current = { plan: 'unknown', source: 'none' };
      paintBadges();
      return current;
    }
    try {
      const access = accessService ? await accessService.getMyAccess(uid) : {};
      current = resolvePlan({ comp: access.comp, subscription: access.subscription, isAdmin: isAdmin() });
    } catch {
      // Sem conseguir ler a assinatura, nao bloqueia (o servidor continua protegendo o WhatsApp).
      current = { plan: 'unknown', source: 'error' };
    }
    paintBadges();
    return current;
  }

  function paintBadges() {
    Object.keys(PREMIUM_TABS).forEach((tab) => {
      documentRef.querySelectorAll(`#main-tabs [data-tab="${tab}"]`).forEach((button) => {
        const existing = button.querySelector(`[${BADGE_ATTR}]`);
        if (current.plan === 'free' && !existing) {
          const badge = documentRef.createElement('span');
          badge.setAttribute(BADGE_ATTR, '');
          badge.className = 'ml-auto text-[10px] font-semibold uppercase tracking-wide text-accent bg-accent/10 rounded px-1.5 py-0.5';
          badge.textContent = 'Premium';
          button.appendChild(badge);
        } else if (current.plan !== 'free' && existing) {
          existing.remove();
        }
      });
    });
  }

  // Quem esta no Gratuito: confere de novo antes de bloquear (a assinatura pode ter acabado de entrar).
  async function allow({ tab = '', actionId = '' }) {
    if (gateDecision({ plan: current.plan, tab, actionId }).allowed) return true;
    await refresh();
    const decision = gateDecision({ plan: current.plan, tab, actionId });
    if (decision.allowed) return true;
    target.financeApp?.planChooser?.open?.({ reason: decision.reason });
    return false;
  }

  // Botoes do topo (Planner, PDF): intercepta antes dos handlers legados.
  documentRef.addEventListener('click', (event) => {
    const button = event.target.closest?.(Object.keys(PREMIUM_ACTIONS).map((id) => `#${id}`).join(','));
    if (!button || current.plan !== 'free') return;
    event.preventDefault();
    event.stopImmediatePropagation();
    allow({ actionId: button.id }).then((ok) => { if (ok) button.click(); });
  }, true);

  // Abas: envolve o switchTab final (menu, links e mudanca de hash passam por ele).
  function wrapSwitchTab() {
    const inner = target.switchTab;
    if (typeof inner !== 'function' || inner.__financePlanGate) return;
    const gated = function (tab, tabOptions = {}) {
      const name = String(tab || '');
      if (current.plan !== 'free' || !PREMIUM_TABS[name]) return inner.call(this, tab, tabOptions);
      allow({ tab: name }).then((ok) => {
        if (ok) inner.call(target, tab, tabOptions);
        else if (String(target.location?.hash || '').includes(name)) target.history?.replaceState?.(null, '', '#/dashboard');
      });
      return undefined;
    };
    gated.__financePlanGate = true;
    target.switchTab = gated;
  }

  target.addEventListener?.('financeAccessActive', () => {
    wrapSwitchTab();
    refresh().then(() => {
      // Abriu direto num link de recurso Premium (ex.: #/importacao): volta para o dashboard.
      const tab = String(target.location?.hash || '').replace('#/', '');
      if (current.plan === 'free' && PREMIUM_TABS[tab]) {
        target.switchTab?.(tab, { fromRouter: true });
      }
    });
  });
  target.addEventListener?.('authStateChanged', () => {
    current = { plan: 'unknown', source: 'none' };
    paintBadges();
  });

  const api = { installed: true, refresh, getPlan: () => current.plan, allow };
  target.financeApp = target.financeApp || {};
  target.financeApp.planGate = api;
  if (target.financeApp?.authContext?.accessState === 'active') {
    wrapSwitchTab();
    refresh();
  }
  return api;
}
