function escapeHtml(value = '') {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[char]));
}

function formatDate(value) {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) return '';
  return value.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatTime(value) {
  if (!(value instanceof Date)) return '';
  return value.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

const BUTTON_PRIMARY = 'bg-accent hover:bg-accentDark text-bg text-xs font-semibold px-3 py-1.5 rounded-lg disabled:opacity-60';
const BUTTON_SECONDARY = 'border border-surfaceLight text-textSecondary hover:text-textPrimary text-xs font-semibold px-3 py-1.5 rounded-lg disabled:opacity-60';
const BUTTON_DANGER = 'border border-danger/60 text-danger hover:bg-danger/10 text-xs font-semibold px-3 py-1.5 rounded-lg disabled:opacity-60';

function feedback(state) {
  if (state.error) return `<p class="text-xs text-danger mt-3" role="alert">${escapeHtml(state.error)}</p>`;
  if (state.notice) return `<p class="text-xs text-success mt-3">${escapeHtml(state.notice)}</p>`;
  return '';
}

function botLink(botNumber, code) {
  const digits = String(botNumber || '').replace(/\D/g, '');
  if (!digits) return '';
  const text = encodeURIComponent(code);
  return `<a href="https://wa.me/${digits}?text=${text}" target="_blank" rel="noopener noreferrer" class="${BUTTON_PRIMARY} inline-block">Abrir no WhatsApp</a>`;
}

const SUBSCRIPTION_LABELS = Object.freeze({
  trialing: 'Premium (teste grátis)',
  active: 'Premium ativo',
  past_due: 'Premium com pagamento pendente'
});

// Checkout e portal sao criados pelo servidor (ver services/billingCheckout.js); aqui so os botoes.
function subscribeOffer(access, billing, state) {
  if (!billing.enabled || !access.account?.uid) return '';
  const busy = state.billingPending ? 'disabled aria-busy="true"' : '';
  return `<div class="flex gap-2 flex-wrap mt-2" data-premium-offer>
      <button type="button" data-premium-action="checkout" class="${BUTTON_PRIMARY}" ${busy}>Assinar Premium · 7 dias grátis</button>
    </div>
    <p class="text-xs text-textSecondary mt-1">R$ 24,90/mês no Brasil ou € 5,90/mês na Europa, conforme o país do cadastro. O WhatsApp do cadastro vira o número principal.</p>`;
}

function manageButton(access, billing, state) {
  if (!billing.enabled || !access.hasCustomer) return '';
  const busy = state.billingPending ? 'disabled aria-busy="true"' : '';
  return `<button type="button" data-premium-action="portal" class="${BUTTON_SECONDARY}" ${busy}>Gerenciar assinatura</button>`;
}

function billingError(state) {
  return state.billingError ? `<p class="text-xs text-danger mt-2" role="alert">${escapeHtml(state.billingError)}</p>` : '';
}

function accessLine(access, billing = {}, state = {}) {
  if (!access) return '';
  if (access.source === 'comp') return '<p class="text-xs text-success mb-2" data-whatsapp-access="comp">Acesso cortesia liberado.</p>';
  if (access.allowed) {
    const ending = access.cancelAtPeriodEnd && access.periodEnd ? ` Cancelado: vale até ${escapeHtml(formatDate(access.periodEnd))}.` : '';
    const principal = access.principalPhone ? `<p class="text-xs text-textSecondary">Número principal: <strong>${escapeHtml(access.principalPhone)}</strong></p>` : '';
    const manage = manageButton(access, billing, state);
    return `<div class="mb-2" data-whatsapp-access="stripe">
        <p class="text-xs text-success">${escapeHtml(SUBSCRIPTION_LABELS[access.status] || 'Premium ativo')}.${ending}</p>
        ${principal}
        ${manage ? `<div class="mt-2">${manage}</div>` : ''}
        ${billingError(state)}
      </div>`;
  }
  const manage = manageButton(access, billing, state);
  return `<div class="mb-2" data-whatsapp-access="none">
      <p class="text-xs text-warn">O assistente do WhatsApp faz parte do Premium. Sem assinatura ativa, o número vinculado não recebe respostas.</p>
      ${subscribeOffer(access, billing, state)}
      ${manage ? `<div class="mt-2">${manage}</div>` : ''}
      ${billingError(state)}
    </div>`;
}

function body(state, { botNumber } = {}) {
  const disabled = state.pending ? 'disabled aria-busy="true"' : '';
  switch (state.view) {
    case 'loading':
      return `<div class="space-y-2" aria-hidden="true">
        <div class="h-3 w-2/3 rounded bg-surfaceLight/60"></div>
        <div class="h-3 w-1/3 rounded bg-surfaceLight/60"></div>
      </div>
      <p class="sr-only">Carregando o status do WhatsApp.</p>`;
    case 'error':
      return `<p class="text-xs text-danger" role="alert">${escapeHtml(state.message)}</p>
        <button type="button" data-whatsapp-link-action="reload" class="${BUTTON_SECONDARY} mt-3">Tentar de novo</button>`;
    case 'linked':
      return `<p class="text-sm">Vinculado ao número <strong>${escapeHtml(state.maskedPhone)}</strong>${state.linkedAt ? ` desde ${escapeHtml(formatDate(state.linkedAt))}` : ''}.</p>
        <p class="text-xs text-textSecondary mt-1">As mensagens desse número consultam e registram lançamentos nesta conta.</p>
        <button type="button" data-whatsapp-link-action="revoke" class="${BUTTON_DANGER} mt-3" ${disabled}>Desvincular WhatsApp</button>
        ${feedback(state)}`;
    case 'code':
      return `<p class="text-xs text-textSecondary">Envie este código, como mensagem, para o WhatsApp do Finance Control:</p>
        <p class="text-2xl font-bold tracking-[0.2em] text-textPrimary my-3 select-all" data-whatsapp-link-code>${escapeHtml(state.code)}</p>
        <p class="text-xs text-textSecondary">Válido até ${escapeHtml(formatTime(state.expiresAt))}. Só funciona uma vez e só para esta conta. Não compartilhe.</p>
        <p class="text-xs text-textSecondary mt-1" aria-live="polite">Aguardando a mensagem…</p>
        <div class="flex gap-2 flex-wrap mt-3">
          ${botLink(botNumber, state.code)}
          <button type="button" data-whatsapp-link-action="cancel" class="${BUTTON_SECONDARY}">Cancelar</button>
        </div>`;
    default:
      return `<p class="text-xs text-textSecondary">Vincule seu número para consultar e registrar lançamentos pelo WhatsApp. Você recebe um código temporário e o envia pelo próprio WhatsApp.</p>
        <button type="button" data-whatsapp-link-action="generate" class="${BUTTON_PRIMARY} mt-3" ${disabled}>Gerar código</button>
        ${feedback(state)}`;
  }
}

export function createWhatsAppLinkPresenter({ documentRef = document, botNumber = '', billing = {} } = {}) {
  const root = () => documentRef.getElementById('whatsapp-link-panel');

  function render(state = { view: 'loading' }) {
    const element = root();
    if (!element) return;
    element.innerHTML = `
      <div class="bg-surface rounded-xl p-4 border border-surfaceLight mb-4" data-whatsapp-link-root>
        <h3 class="font-semibold text-sm mb-2">WhatsApp</h3>
        ${state.view === 'loading' ? '' : accessLine(state.access, billing, state)}
        <div data-whatsapp-link-state="${escapeHtml(state.view)}" aria-live="polite">${body(state, { botNumber })}</div>
      </div>`;
  }

  return { render };
}
