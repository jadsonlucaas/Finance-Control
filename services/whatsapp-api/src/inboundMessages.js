import { createHash } from 'node:crypto';
import { badRequest } from './errors.js';
import { hashPhone, normalizePhone } from './phoneLinks.js';

/**
 * Deduplicacao das mensagens recebidas pelo WhatsApp.
 *
 * O Chatwoot pode entregar o mesmo message_created mais de uma vez (reenvio, timeout do
 * n8n, duplo clique na automacao). O n8n chama mensagem/registrar logo depois de conferir
 * a assinatura do Chatwoot; so a primeira entrega de cada mensagem segue para o agente.
 *
 * Guarda so o hash da mensagem e do telefone (nunca o texto). expires_at serve para a
 * politica de TTL do Firestore apagar o registro depois de alguns dias.
 */
export const INBOUND_MESSAGE_TTL_MS = 3 * 24 * 60 * 60 * 1000;

const MESSAGE_ID_PATTERN = /^[A-Za-z0-9_.:-]{1,128}$/;

export function inboundMessageKey(accountId, messageId) {
  return createHash('sha256').update(`chatwoot:${accountId}:${messageId}`).digest('hex');
}

export function createInboundMessageService({ store, now = () => new Date() }) {
  if (typeof store?.reserveInboundMessage !== 'function') throw new Error('Store sem suporte a deduplicacao de mensagens.');

  async function register(body = {}) {
    const phone = normalizePhone(body.telefone);
    if (!phone) throw badRequest('INVALID_PHONE', 'Telefone invalido.');
    const accountId = String(body.accountId ?? '').trim();
    if (!/^\d+$/.test(accountId)) throw badRequest('INVALID_ACCOUNT', 'Conta de atendimento invalida.');
    const messageId = String(body.mensagemId ?? '').trim();
    if (!MESSAGE_ID_PATTERN.test(messageId)) throw badRequest('INVALID_MESSAGE_ID', 'Identificador da mensagem invalido.');

    const current = now();
    const phoneHash = hashPhone(phone);
    const { created } = await store.reserveInboundMessage(inboundMessageKey(accountId, messageId), {
      phone_hash: phoneHash,
      chatwoot_account_id: accountId,
      received_at: current.toISOString(),
      expires_at: new Date(current.getTime() + INBOUND_MESSAGE_TTL_MS)
    });
    return { phoneHash, result: { duplicada: !created } };
  }

  return { register };
}
