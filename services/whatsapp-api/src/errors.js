export class ApiError extends Error {
  constructor(status, code, message, details = undefined) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function badRequest(code, message, details) {
  return new ApiError(400, code, message, details);
}

/**
 * Falha de uma dependencia (Firestore e afins) que nao e culpa do pedido.
 * Devolve 'COTA_ESGOTADA', 'INDISPONIVEL', 'TIMEOUT' ou '' (erro desconhecido).
 * Codigos gRPC do Firestore: 8 = RESOURCE_EXHAUSTED, 14 = UNAVAILABLE, 4 = DEADLINE_EXCEEDED.
 */
export function classifyDependencyError(error) {
  const code = String(error?.code ?? '');
  const raw = `${code} ${String(error?.message ?? error ?? '')}`;
  if (code === '8' || /RESOURCE_EXHAUSTED|quota/i.test(raw)) return 'COTA_ESGOTADA';
  if (code === '4' || /^TIMEOUT$|DEADLINE_EXCEEDED/i.test(String(error?.message ?? '')) || /DEADLINE_EXCEEDED/i.test(raw)) return 'TIMEOUT';
  if (code === '14' || /UNAVAILABLE|ECONNREFUSED|ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN/i.test(raw)) return 'INDISPONIVEL';
  return '';
}

export const SERVICE_UNAVAILABLE_MESSAGE = 'Estou com instabilidade para acessar seus dados agora. Tente de novo em alguns minutos.';
export const SERVICE_UNAVAILABLE_MESSAGE_ES = 'Tengo problemas para acceder a tus datos ahora. Inténtalo de nuevo en unos minutos.';

/** Mesmo criterio do n8n: numero da Espanha (+34) recebe a mensagem em espanhol. */
export function serviceUnavailableMessage(telefone = '') {
  return String(telefone).replace(/\D/g, '').startsWith('34') ? SERVICE_UNAVAILABLE_MESSAGE_ES : SERVICE_UNAVAILABLE_MESSAGE;
}
