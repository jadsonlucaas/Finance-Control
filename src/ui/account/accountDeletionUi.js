/**
 * "Excluir minha conta" em Configuracoes.
 *
 * A exclusao e feita pelo servidor (accountDeletionSdk). Aqui so coletamos a senha (login
 * recente) e o e-mail digitado como confirmacao. Depois de excluir, encerra a sessao e
 * limpa o que ficou guardado neste navegador.
 */
const BUTTON = 'text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed';

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));
}

export function renderAccountDeletionPanel({ open = false, busy = false, error = '', isAdmin = false, enabled = true } = {}) {
  const header = `
    <div class="flex items-start gap-3">
      <div class="w-8 h-8 rounded-lg bg-danger/10 text-danger flex items-center justify-center shrink-0">
        <i data-lucide="alert-triangle" class="w-4 h-4"></i>
      </div>
      <div class="min-w-0 flex-1">
        <h3 class="font-semibold text-sm">Excluir minha conta</h3>
        <p class="text-xs text-textSecondary mt-1">Apaga de forma definitiva seus lançamentos, configurações, histórico, vínculos do WhatsApp, assinatura (cancelada na hora) e o login. Não dá para desfazer. Se quiser guardar uma cópia, use o backup acima antes.</p>
      </div>
    </div>`;
  let body = '';
  if (isAdmin) {
    body = '<p class="text-xs text-textSecondary mt-3">Contas de administrador não podem se excluir. Peça a outro administrador (ou ao owner).</p>';
  } else if (!enabled) {
    body = '<p class="text-xs text-textSecondary mt-3">Exclusão de conta indisponível no momento.</p>';
  } else if (!open) {
    body = `<div class="mt-3"><button type="button" data-account-deletion-action="open" class="${BUTTON} bg-danger/10 text-danger hover:bg-danger hover:text-white">Excluir minha conta</button></div>`;
  } else {
    body = `
      <form data-account-deletion-form class="mt-3 space-y-3" autocomplete="off">
        <div class="grid gap-3 sm:grid-cols-2">
          <div>
            <label for="account-deletion-password" class="text-xs text-textSecondary mb-1 block">Sua senha</label>
            <input id="account-deletion-password" type="password" autocomplete="current-password" class="w-full text-sm" ${busy ? 'disabled' : ''} required>
          </div>
          <div>
            <label for="account-deletion-email" class="text-xs text-textSecondary mb-1 block">Digite seu e-mail para confirmar</label>
            <input id="account-deletion-email" type="email" autocomplete="off" class="w-full text-sm" ${busy ? 'disabled' : ''} required>
          </div>
        </div>
        ${error ? `<div class="text-xs text-danger bg-danger/10 rounded-lg px-3 py-2" data-account-deletion-error>${escapeHtml(error)}</div>` : ''}
        <div class="flex gap-2 flex-wrap">
          <button type="submit" data-account-deletion-action="confirm" class="${BUTTON} bg-danger text-white hover:bg-danger/90" ${busy ? 'disabled' : ''}>${busy ? 'Excluindo...' : 'Excluir definitivamente'}</button>
          <button type="button" data-account-deletion-action="cancel" class="${BUTTON} bg-surfaceLight text-textSecondary" ${busy ? 'disabled' : ''}>Cancelar</button>
        </div>
      </form>`;
  }
  return `<div class="bg-surface rounded-xl p-4 border border-danger/30">${header}${body}</div>`;
}

function clearBrowserData(target) {
  for (const storage of [target.localStorage, target.sessionStorage]) {
    try {
      storage?.clear?.();
    } catch {
      // Sem acesso ao storage: nada a limpar.
    }
  }
}

export function installAccountDeletionUi(target = globalThis, options = {}) {
  const documentRef = target?.document;
  if (!documentRef) return null;
  if (target.financeApp?.accountDeletionUi?.installed) {
    target.financeApp.accountDeletionUi.render();
    return target.financeApp.accountDeletionUi;
  }
  const sdk = options.service || target.accountDeletionSdk || null;
  let state = { open: false, busy: false, error: '' };

  const root = () => documentRef.getElementById('account-deletion-panel');
  function render() {
    const panel = root();
    if (!panel) return;
    panel.innerHTML = renderAccountDeletionPanel({
      ...state,
      isAdmin: target.isCurrentUserAdmin?.() === true,
      enabled: Boolean(sdk?.enabled)
    });
    target.lucide?.createIcons?.();
  }
  const setState = (patch) => {
    state = { ...state, ...patch };
    render();
  };

  async function confirmDeletion() {
    const password = documentRef.getElementById('account-deletion-password')?.value || '';
    const email = documentRef.getElementById('account-deletion-email')?.value || '';
    if (!password || !email) {
      setState({ error: 'Preencha a senha e o e-mail.' });
      return;
    }
    setState({ busy: true, error: '' });
    try {
      await sdk.deleteOwnAccount({ password, confirmacao: email });
    } catch (error) {
      setState({ busy: false, error: sdk.errorMessage?.(error) || 'Não foi possível excluir a conta agora.' });
      return;
    }
    // Conta apagada no servidor: encerra a sessao e limpa este navegador.
    try {
      await target.authSdk?.signOut?.();
    } catch {
      // O login ja nao existe; a sessao local cai de qualquer forma.
    }
    clearBrowserData(target);
    state = { open: false, busy: false, error: '' };
    target.showToast?.('Sua conta foi excluída definitivamente.');
  }

  if (!documentRef.documentElement.dataset.financeAccountDeletionBound) {
    documentRef.addEventListener('click', (event) => {
      const action = event.target.closest?.('[data-account-deletion-action]')?.dataset.accountDeletionAction;
      if (!action || state.busy) return;
      if (action === 'open') setState({ open: true, error: '' });
      if (action === 'cancel') setState({ open: false, error: '' });
      if (action === 'confirm') {
        event.preventDefault();
        confirmDeletion();
      }
    });
    documentRef.addEventListener('submit', (event) => {
      if (!event.target.closest?.('[data-account-deletion-form]')) return;
      event.preventDefault();
      if (!state.busy) confirmDeletion();
    });
    // Troca de usuario na mesma aba: volta ao estado fechado.
    target.addEventListener?.('authStateChanged', () => setState({ open: false, busy: false, error: '' }));
    documentRef.documentElement.dataset.financeAccountDeletionBound = 'true';
  }

  render();
  const app = target.financeApp || {};
  target.financeApp = app;
  app.accountDeletionUi = { installed: true, render, getState: () => state };
  return app.accountDeletionUi;
}
