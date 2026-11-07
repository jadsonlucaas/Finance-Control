/**
 * Exclusao definitiva de conta, feita pelo servidor (Admin SDK).
 *
 * Usa o mesmo endpoint do checkout (relay do n8n -> servidor), com a acao no corpo.
 * O navegador nunca apaga dados direto: so manda o ID token e a confirmacao.
 * - propria conta: confirma a senha (login recente) e digita o e-mail;
 * - admin: digita o e-mail da conta que sera excluida.
 */
export const ACCOUNT_DELETION_ERROR_MESSAGES = Object.freeze({
  REAUTH_REQUIRED: 'Confirme sua senha para excluir a conta.',
  WRONG_PASSWORD: 'Senha incorreta.',
  CONFIRMATION_MISMATCH: 'O e-mail digitado não confere com o da conta.',
  ADMIN_SELF_DELETE_BLOCKED: 'Contas de administrador não podem se excluir. Peça a outro administrador.',
  ADMIN_REQUIRED: 'Apenas administradores podem excluir contas.',
  OWNER_DELETE_BLOCKED: 'A conta owner não pode ser excluída.',
  OWNER_REQUIRED: 'Apenas o owner exclui administradores.',
  USER_NOT_FOUND: 'Usuário não encontrado.',
  STRIPE_REQUIRED: 'Não foi possível cancelar a assinatura agora. A conta foi bloqueada; tente de novo mais tarde.',
  DELETION_INCOMPLETE: 'A exclusão não terminou. Tente de novo.',
  AUTH_INVALID: 'Sua sessão expirou. Entre de novo.',
  ACCOUNT_DELETION_NOT_CONFIGURED: 'Exclusão de conta indisponível no momento.'
});

export function accountDeletionErrorMessage(error) {
  return ACCOUNT_DELETION_ERROR_MESSAGES[error?.code] || 'Não foi possível excluir a conta agora. Tente de novo.';
}

const fail = (code) => Object.assign(new Error(code), { code });

export function createAccountDeletionService({ endpoint = '', getIdToken, reauthenticate, fetchImpl = globalThis.fetch } = {}) {
  const enabled = Boolean(endpoint && typeof getIdToken === 'function');

  async function send(body, { forceRefresh = false } = {}) {
    if (!enabled) throw fail('ACCOUNT_DELETION_NOT_CONFIGURED');
    const idToken = await getIdToken(forceRefresh);
    const response = await fetchImpl(endpoint, {
      method: 'POST',
      // text/plain: requisicao simples, sem preflight de CORS (igual ao checkout).
      headers: { 'content-type': 'text/plain;charset=UTF-8' },
      body: JSON.stringify({ ...body, idToken })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data?.erro) throw fail(data?.erro?.codigo || `HTTP_${response.status}`);
    return data;
  }

  return {
    enabled,
    async deleteOwnAccount({ password = '', confirmacao = '' } = {}) {
      if (typeof reauthenticate !== 'function') throw fail('ACCOUNT_DELETION_NOT_CONFIGURED');
      if (!password) throw fail('REAUTH_REQUIRED');
      try {
        await reauthenticate(password);
      } catch (error) {
        const code = String(error?.code || '');
        if (/wrong-password|invalid-credential|invalid-login-credentials/.test(code)) throw fail('WRONG_PASSWORD');
        throw error;
      }
      // Token novo: o servidor confere que o login acabou de acontecer.
      return send({ acao: 'excluir_conta', confirmacao: String(confirmacao).trim() }, { forceRefresh: true });
    },
    deleteUser(uid, confirmacao = '') {
      return send({ acao: 'excluir_usuario', uid: String(uid || ''), confirmacao: String(confirmacao).trim() });
    },
    errorMessage: accountDeletionErrorMessage
  };
}
