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
 * Guarda so o hash da mensagem e do telefone (nunca o texto). expires_at marca quando o
 * registro pode ser apagado: a propria API faz a limpeza (startInboundCleanup), porque o
 * TTL do Firestore nao existe no plano gratuito.
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

export const INBOUND_CLEANUP_INTERVAL_MS = 6 * 60 * 60 * 1000;
export const INBOUND_CLEANUP_FIRST_DELAY_MS = 60 * 1000;
export const INBOUND_CLEANUP_BATCH = 200;
export const INBOUND_CLEANUP_MAX_BATCHES = 10;

/**
 * Apaga os registros com expires_at vencido, em lotes. Cada rodada le no maximo
 * batch * maxBatches documentos (so os vencidos), para nao pesar na cota do Firestore.
 * Devolve quantos foram apagados.
 */
export async function purgeExpiredInboundMessages({ store, now = () => new Date(), batch = INBOUND_CLEANUP_BATCH, maxBatches = INBOUND_CLEANUP_MAX_BATCHES }) {
  if (typeof store?.purgeExpiredInboundMessages !== 'function') return 0;
  const before = now();
  let total = 0;
  for (let round = 0; round < maxBatches; round += 1) {
    const deleted = await store.purgeExpiredInboundMessages({ before, limit: batch });
    total += deleted;
    if (deleted < batch) break;
  }
  return total;
}

/**
 * Agenda a limpeza: a primeira um minuto depois de subir, depois a cada intervalMs.
 * Erro so vai para o log; a proxima rodada tenta de novo. Devolve stop().
 */
export function startInboundCleanup({
  store,
  now = () => new Date(),
  logger = console,
  intervalMs = INBOUND_CLEANUP_INTERVAL_MS,
  firstDelayMs = INBOUND_CLEANUP_FIRST_DELAY_MS,
  timers = { setTimeout, clearTimeout, setInterval, clearInterval }
} = {}) {
  if (typeof store?.purgeExpiredInboundMessages !== 'function' || !(intervalMs > 0)) return { stop() {}, run: async () => 0 };
  let running = false;
  async function run() {
    if (running) return 0;
    running = true;
    try {
      const deleted = await purgeExpiredInboundMessages({ store, now });
      if (deleted > 0) logger.info?.(JSON.stringify({ level: 'info', event: 'inbound_cleanup', deleted }));
      return deleted;
    } catch (error) {
      logger.error?.(JSON.stringify({ level: 'error', event: 'inbound_cleanup_failed', code: String(error?.code ?? 'ERRO').slice(0, 40) }));
      return 0;
    } finally {
      running = false;
    }
  }
  let interval = null;
  const first = timers.setTimeout(() => {
    run();
    interval = timers.setInterval(run, intervalMs);
    interval?.unref?.();
  }, Math.max(0, firstDelayMs));
  first?.unref?.();
  return {
    run,
    stop() {
      timers.clearTimeout(first);
      if (interval) timers.clearInterval(interval);
    }
  };
}
