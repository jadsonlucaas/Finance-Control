/**
 * Escolha de plano logo depois do cadastro (e pelo botao "Assinar Premium").
 *
 * Gratuito: so fecha e segue no Dashboard basico.
 * Premium: confirma pais/WhatsApp (contas antigas podem nao ter), grava em user_onboarding,
 * pede ao servidor o checkout do Stripe e leva o usuario para la. Preco, moeda e uid sao
 * decididos no servidor; aqui so mostramos o valor conforme o pais.
 */
export { PLAN_CHOICE_STORAGE_KEY } from '../../services/accountOnboarding.js';

export const PLAN_PRICES = Object.freeze({
  BR: 'R$ 24,90/mês',
  EUR: '€ 5,90/mês'
});

const COUNTRIES = Object.freeze([
  { code: 'BR', label: 'Brasil' },
  { code: 'ES', label: 'Espanha' },
  { code: 'PT', label: 'Portugal' }
]);

export function priceLabel(country) {
  if (country === 'BR') return PLAN_PRICES.BR;
  if (country === 'ES' || country === 'PT') return PLAN_PRICES.EUR;
  return `${PLAN_PRICES.BR} no Brasil ou ${PLAN_PRICES.EUR} na Europa`;
}

export function hasCheckoutDetails(details) {
  return Boolean(details?.country && details?.whatsapp_phone);
}

/** Le ?assinatura=sucesso|cancelada da volta do Stripe. */
export function readCheckoutReturn(search = '') {
  const value = new URLSearchParams(String(search || '')).get('assinatura');
  return value === 'sucesso' || value === 'cancelada' ? value : '';
}

export function stripCheckoutReturn(href = '') {
  try {
    const url = new URL(href);
    if (!url.searchParams.has('assinatura')) return '';
    url.searchParams.delete('assinatura');
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return '';
  }
}

function escapeHtml(value = '') {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));
}

const BUTTON_PRIMARY = 'w-full bg-accent hover:bg-accentDark text-white text-sm font-semibold px-4 py-2.5 rounded-xl disabled:opacity-60';
const BUTTON_SECONDARY = 'w-full border border-surfaceLight text-textSecondary hover:text-textPrimary text-sm font-semibold px-4 py-2.5 rounded-xl disabled:opacity-60';
const INPUT = 'w-full bg-bg border border-surfaceLight rounded-lg px-3 py-2 text-sm text-textPrimary';

function detailsForm(details = {}) {
  const country = details?.country || 'BR';
  const options = COUNTRIES.map((item) => `<option value="${item.code}" ${item.code === country ? 'selected' : ''}>${item.label}</option>`).join('');
  return `<div class="space-y-2 mt-3" data-plan-details-form>
      <p class="text-xs text-textSecondary">Confirme seus dados. O WhatsApp informado vira o número principal do assistente.</p>
      <input data-plan-field="name" type="text" autocomplete="name" placeholder="Seu nome" class="${INPUT}" value="${escapeHtml(details?.name || '')}">
      <div class="grid grid-cols-[110px_1fr] gap-2">
        <select data-plan-field="country" class="${INPUT}">${options}</select>
        <input data-plan-field="phone" type="tel" autocomplete="tel" placeholder="+55 11 99999-9999" class="${INPUT}" value="${escapeHtml(details?.whatsapp_phone || '')}">
      </div>
      <label class="flex items-start gap-2 text-xs text-textSecondary">
        <input data-plan-field="consent" type="checkbox" class="mt-0.5" ${details?.whatsapp_consent ? 'checked' : ''}>
        <span>Aceito receber mensagens do Finance Control no WhatsApp (boas-vindas e alertas).</span>
      </label>
    </div>`;
}

/** HTML do modal. state: { open, loading, pending, details, error, mode: 'choose'|'success'|'canceled' } */
export function renderPlanChooser(state = {}) {
  if (!state.open) return '';
  const busy = state.pending ? 'disabled aria-busy="true"' : '';
  const error = state.error ? `<p class="text-xs text-danger mt-3" role="alert">${escapeHtml(state.error)}</p>` : '';
  let content;
  if (state.mode === 'success') {
    content = `<h2 class="text-lg font-bold text-textPrimary">Premium ativado</h2>
      <p class="text-sm text-textSecondary mt-2">Seu teste grátis de 7 dias começou. A confirmação do Stripe pode levar alguns segundos para aparecer em Configurações → WhatsApp.</p>
      <p class="text-sm text-textSecondary mt-2">Próximo passo: em Configurações → WhatsApp, clique em <strong>Gerar código</strong> e envie o código pelo seu WhatsApp principal.</p>
      <div class="grid gap-2 mt-4">
        <button type="button" data-plan-action="go-whatsapp" class="${BUTTON_PRIMARY}">Vincular meu WhatsApp</button>
        <button type="button" data-plan-action="close" class="${BUTTON_SECONDARY}">Agora não</button>
      </div>`;
  } else if (state.mode === 'already') {
    content = `<h2 class="text-lg font-bold text-textPrimary">Você já é Premium</h2>
      <p class="text-sm text-textSecondary mt-2">Sua assinatura está ativa. Para trocar cartão ou cancelar, use "Gerenciar assinatura" em Configurações → WhatsApp.</p>
      <div class="grid gap-2 mt-4">
        <button type="button" data-plan-action="close" class="${BUTTON_PRIMARY}">Ok</button>
      </div>`;
  } else if (state.mode === 'canceled') {
    content = `<h2 class="text-lg font-bold text-textPrimary">Assinatura não concluída</h2>
      <p class="text-sm text-textSecondary mt-2">Nada foi cobrado. Você continua no plano Gratuito e pode assinar o Premium quando quiser.</p>
      <div class="grid gap-2 mt-4">
        <button type="button" data-plan-action="premium" class="${BUTTON_PRIMARY}" ${busy}>Tentar de novo</button>
        <button type="button" data-plan-action="free" class="${BUTTON_SECONDARY}">Continuar no Gratuito</button>
      </div>${error}`;
  } else {
    const needsDetails = !state.loading && !hasCheckoutDetails(state.details);
    content = `<h2 class="text-lg font-bold text-textPrimary">Escolha seu plano</h2>
      <p class="text-sm text-textSecondary mt-1">Você pode mudar depois em Configurações.</p>
      <div class="grid gap-3 mt-4 sm:grid-cols-2">
        <div class="rounded-xl border border-surfaceLight p-4 flex flex-col" data-plan="free">
          <h3 class="font-semibold text-textPrimary">Gratuito</h3>
          <p class="text-xl font-bold text-textPrimary mt-1">R$ 0</p>
          <ul class="text-xs text-textSecondary mt-2 space-y-1 flex-1">
            <li>Lançar entradas e saídas</li>
            <li>Ver o dashboard</li>
          </ul>
          <button type="button" data-plan-action="free" class="${BUTTON_SECONDARY} mt-4" ${busy}>Continuar no Gratuito</button>
        </div>
        <div class="rounded-xl border-2 border-accent p-4 flex flex-col" data-plan="premium">
          <h3 class="font-semibold text-textPrimary">Premium</h3>
          <p class="text-xl font-bold text-textPrimary mt-1">${escapeHtml(priceLabel(state.details?.country))}</p>
          <p class="text-xs text-accent font-semibold">7 dias grátis · cancele quando quiser</p>
          <ul class="text-xs text-textSecondary mt-2 space-y-1 flex-1">
            <li>Tudo do Gratuito</li>
            <li>Assistente no WhatsApp com IA</li>
            <li>Alertas de vencimento</li>
            <li>Relatórios, planejador e importação</li>
          </ul>
          ${needsDetails ? detailsForm(state.details) : ''}
          <button type="button" data-plan-action="premium" class="${BUTTON_PRIMARY} mt-4" ${busy || (state.loading ? 'disabled' : '')}>${state.pending ? 'Abrindo o Stripe…' : 'Testar 7 dias grátis'}</button>
        </div>
      </div>${error}`;
  }
  return `<div class="fixed inset-0 z-[90] bg-black/60 flex items-center justify-center p-4" data-plan-chooser role="dialog" aria-modal="true">
      <div class="bg-surface rounded-2xl border border-surfaceLight w-full max-w-xl max-h-[90vh] overflow-y-auto p-5">${content}</div>
    </div>`;
}

/**
 * Logica do modal sem DOM (testavel). deps:
 * - onboarding: { getMyDetails(uid), saveSignupDetails(uid, details) }
 * - billing: { enabled, startCheckout(), errorMessage(error) }
 * - validate: validateSignupDetails
 * - getUid, navigate(url), render(state), readForm() -> {name, country, phone, consent}
 */
export function createPlanChooserModel({ onboarding, billing, validate, getUid, navigate, render, readForm = () => ({}), onClose = () => {} }) {
  let state = { open: false };
  const set = (next) => { state = next; render(state); };

  async function open({ mode = 'choose', waitFor = null } = {}) {
    set({ open: true, mode, loading: true, pending: false, details: null, error: '' });
    let details = null;
    try {
      // Logo apos o cadastro, espera os dados do cadastro serem gravados.
      if (waitFor) await Promise.resolve(waitFor).catch(() => {});
      details = await onboarding?.getMyDetails?.(getUid());
    } catch {
      details = null;
    }
    if (!state.open) return state;
    set({ ...state, loading: false, details });
    return state;
  }

  function close() {
    set({ open: false });
    onClose();
  }

  async function choosePremium() {
    if (state.pending) return state;
    if (!billing?.enabled) {
      set({ ...state, error: 'Assinatura indisponível no momento.' });
      return state;
    }
    if (state.mode !== 'choose' && !hasCheckoutDetails(state.details)) {
      // Fora da tela de escolha nao ha formulario: volta para ela para completar os dados.
      set({ ...state, mode: 'choose', error: '' });
      return state;
    }
    set({ ...state, pending: true, error: '' });
    try {
      if (!hasCheckoutDetails(state.details)) {
        const checked = validate(readForm());
        if (!checked.ok) {
          set({ ...state, pending: false, error: checked.error });
          return state;
        }
        const saved = await onboarding.saveSignupDetails(getUid(), checked.value);
        set({ ...state, details: saved || checked.value });
      }
      const result = await billing.startCheckout();
      if (result?.jaAssinante) {
        set({ open: true, mode: 'already', pending: false, details: state.details, error: '' });
        return state;
      }
      if (!result?.url) throw Object.assign(new Error('BILLING_NO_URL'), { code: 'BILLING_NO_URL' });
      navigate(result.url);
      set({ ...state, pending: true });
    } catch (error) {
      const message = billing.errorMessage?.(error) || 'Não foi possível abrir a assinatura agora. Tente de novo.';
      set({ ...state, pending: false, error: message });
    }
    return state;
  }

  return {
    open,
    close,
    choosePremium,
    chooseFree: close,
    getState: () => state
  };
}
