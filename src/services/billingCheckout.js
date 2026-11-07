/**
 * Abre o checkout ou o portal do Stripe criados pelo servidor.
 *
 * O endpoint e o webhook publico do n8n, que repassa para a whatsapp-api. Vai so o ID token
 * do Firebase: preco, moeda, uid e telefone sao decididos no servidor. O corpo segue como
 * text/plain para ser uma requisicao simples (sem preflight de CORS).
 */
export const BILLING_ERROR_MESSAGES = Object.freeze({
  ONBOARDING_REQUIRED: 'Complete país e WhatsApp do cadastro antes de assinar.',
  ACCOUNT_NOT_ACTIVE: 'Sua conta não está ativa.',
  AUTH_INVALID: 'Sua sessão expirou. Entre de novo.',
  NO_SUBSCRIPTION: 'Você ainda não tem assinatura.',
  BILLING_NOT_CONFIGURED: 'Assinatura indisponível no momento.'
});

export function createBillingCheckoutService({ endpoint = '', getIdToken, fetchImpl = globalThis.fetch } = {}) {
  const enabled = Boolean(endpoint && typeof getIdToken === 'function');

  async function open(acao) {
    if (!enabled) throw Object.assign(new Error('BILLING_NOT_CONFIGURED'), { code: 'BILLING_NOT_CONFIGURED' });
    const idToken = await getIdToken();
    const response = await fetchImpl(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'text/plain;charset=UTF-8' },
      body: JSON.stringify({ acao, idToken })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data?.erro) {
      const code = data?.erro?.codigo || `HTTP_${response.status}`;
      throw Object.assign(new Error(code), { code });
    }
    return data;
  }

  return {
    enabled,
    startCheckout: () => open('checkout'),
    openPortal: () => open('portal'),
    errorMessage: billingErrorMessage
  };
}

export function billingErrorMessage(error) {
  return BILLING_ERROR_MESSAGES[error?.code] || 'Não foi possível abrir a assinatura agora. Tente de novo.';
}
