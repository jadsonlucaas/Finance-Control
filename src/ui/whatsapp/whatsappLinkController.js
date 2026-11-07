/**
 * Estado da tela "WhatsApp" em Configuracoes.
 * Estados: loading -> unlinked | linked; unlinked -> code (aguardando o envio pelo WhatsApp) -> linked.
 */
export const STATUS_POLL_MS = 4000;

// Mesmo formato de services/whatsappLink.js (sem importar o Firestore na camada de UI).
function maskPhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length < 6) return '';
  return `+${digits.slice(0, 2)} ••• ••• ${digits.slice(-3)}`;
}

function toDate(value) {
  if (!value) return null;
  const date = typeof value.toDate === 'function' ? value.toDate() : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

const ERROR_MESSAGES = Object.freeze({
  'permission-denied': 'Sua conta precisa estar ativa para vincular o WhatsApp.',
  unavailable: 'Sem conexão no momento. Tente de novo em instantes.'
});

function messageFor(error) {
  const code = String(error?.code || '').replace(/^firestore\//, '');
  return ERROR_MESSAGES[code] || 'Não foi possível concluir agora. Tente de novo.';
}

export function createWhatsAppLinkController({
  service,
  accessService = null,
  presenter,
  uidProvider,
  emailProvider = () => '',
  now = () => Date.now(),
  setTimer = (fn, ms) => setTimeout(fn, ms),
  clearTimer = (id) => clearTimeout(id),
  confirmRevoke = () => true,
  errorReporter
}) {
  let state = { view: 'loading' };
  let pollTimer = null;
  let busy = false;
  let access = null;

  const render = () => presenter.render(state);
  const set = (next) => {
    state = access ? { ...next, access } : next;
    render();
  };

  async function loadAccess(uid) {
    if (!accessService?.getMyAccess) return;
    try {
      const result = await accessService.getMyAccess(uid);
      const subscription = result.subscription || null;
      access = {
        allowed: result.allowed,
        source: result.source,
        status: result.status,
        // Telefone informado no pagamento = numero principal do WhatsApp no Premium.
        principalPhone: maskPhone(subscription?.phone),
        cancelAtPeriodEnd: Boolean(subscription?.cancel_at_period_end),
        periodEnd: toDate(subscription?.current_period_end),
        hasCustomer: Boolean(subscription?.customer_id),
        account: { uid, email: String(emailProvider() || '') }
      };
    } catch (error) {
      access = null;
      report('whatsapp_link.access', error);
    }
  }
  const stopPolling = () => {
    if (pollTimer !== null) clearTimer(pollTimer);
    pollTimer = null;
  };
  const report = (operation, error) => {
    errorReporter?.capture?.(error, { operation });
  };

  function schedulePoll() {
    stopPolling();
    pollTimer = setTimer(poll, STATUS_POLL_MS);
  }

  async function poll() {
    pollTimer = null;
    if (state.view !== 'code') return;
    if (now() >= state.expiresAt.getTime()) {
      set({ view: 'unlinked', notice: 'O código expirou. Gere um novo para tentar de novo.' });
      return;
    }
    try {
      const status = await service.getStatus(uidProvider());
      if (state.view !== 'code') return;
      if (status.linked) {
        set({ view: 'linked', ...status, notice: 'WhatsApp vinculado com sucesso.' });
        return;
      }
    } catch (error) {
      report('whatsapp_link.poll', error);
    }
    schedulePoll();
  }

  async function load() {
    stopPolling();
    set({ view: 'loading' });
    try {
      const uid = uidProvider();
      const [status] = await Promise.all([service.getStatus(uid), loadAccess(uid)]);
      set(status.linked ? { view: 'linked', ...status } : { view: 'unlinked' });
    } catch (error) {
      report('whatsapp_link.load', error);
      set({ view: 'error', message: messageFor(error) });
    }
  }

  async function generateCode() {
    if (busy) return;
    busy = true;
    stopPolling();
    set({ ...state, pending: true });
    try {
      const result = await service.createCode(uidProvider());
      set({ view: 'code', code: result.formatted, expiresAt: result.expiresAt });
      schedulePoll();
    } catch (error) {
      report('whatsapp_link.create_code', error);
      set({ view: 'unlinked', error: messageFor(error) });
    } finally {
      busy = false;
    }
  }

  async function cancelCode() {
    stopPolling();
    try {
      await service.cancelCode(uidProvider());
    } catch (error) {
      report('whatsapp_link.cancel_code', error);
    }
    set({ view: 'unlinked' });
  }

  async function revoke() {
    if (busy || state.view !== 'linked') return;
    if (!confirmRevoke()) return;
    busy = true;
    set({ ...state, pending: true });
    try {
      await service.revoke(uidProvider());
      set({ view: 'unlinked', notice: 'WhatsApp desvinculado. O assistente deixa de responder a esse número.' });
    } catch (error) {
      report('whatsapp_link.revoke', error);
      set({ ...state, pending: false, error: messageFor(error) });
    } finally {
      busy = false;
    }
  }

  return {
    load,
    generateCode,
    cancelCode,
    revoke,
    destroy: stopPolling,
    getState: () => state
  };
}
