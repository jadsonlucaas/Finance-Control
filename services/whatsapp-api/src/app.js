import { randomUUID } from 'node:crypto';
import { ApiError } from './errors.js';
import { isAuthorized } from './auth.js';
import { createActionService } from './actions.js';
import { buildOpcoes } from './references.js';
import { createLinkService } from './links.js';
import { accessMessage, createAccessPolicy } from './access.js';
import { createBillingService, verifyStripeSignature } from './billing.js';
import { createRateLimiter, hashKey } from './rateLimit.js';
import { normalizePhone } from './phoneLinks.js';
import {
  buildCategorias,
  buildLancamentos,
  buildLegacyDespesas,
  buildResumo,
  buildVencimentos,
  parseListFilters,
  resolveCompetence,
  resolvePeriod
} from './queries.js';

export const MAX_BODY_BYTES = 16 * 1024;
// Eventos do Stripe (checkout/assinatura) passam facil de 16 KB.
export const MAX_STRIPE_BODY_BYTES = 512 * 1024;
export const STRIPE_WEBHOOK_PATH = '/internal/stripe/webhook';
// Chamadas pelo Dashboard (via relay do n8n) com o ID token do Firebase no corpo.
export const BILLING_CHECKOUT_PATH = '/internal/billing/checkout';
export const BILLING_PORTAL_PATH = '/internal/billing/portal';
// Rota unica para o relay do n8n: a acao vem no corpo ({ acao: 'checkout' | 'portal', idToken }).
export const BILLING_PATH = '/internal/billing';
const PREFIX = '/internal/whatsapp';
// Exclusao de conta: mesma rota/relay do n8n, acao no corpo.
export const ACCOUNT_DELETION_ACTIONS = Object.freeze({ excluir_conta: 'deleteOwnAccount', excluir_usuario: 'deleteUserAsAdmin' });

/**
 * Nucleo HTTP independente de framework: recebe {method, path, headers, body}
 * e devolve {status, body}. O servidor (server.js) so faz a ponte com node:http.
 */
export function createApp({
  store,
  resolver,
  apiKey,
  accessMode = 'open',
  stripeWebhookSecret = '',
  checkout = null,
  accountDeletion = null,
  now = () => new Date(),
  logger = console,
  newId = () => randomUUID(),
  rateLimiter = createRateLimiter()
}) {
  if (!store || !resolver) throw new Error('createApp requer store e resolver.');
  const access = createAccessPolicy({ store, mode: accessMode });
  const actions = createActionService({ store, now, newId });
  const links = createLinkService({ store, now });
  const billing = stripeWebhookSecret ? createBillingService({ store, now, logger }) : null;

  // Rotas sem usuario resolvido: o telefone ainda pode nao estar vinculado.
  const linkRoutes = {
    'vinculo/confirmar': async (body) => {
      const { phoneHash, ...result } = await links.confirm(body);
      return { phoneHash, result };
    },
    'vinculo/status': async (body) => {
      try {
        const { uid, phoneHash } = await resolver.resolve({ telefone: body.telefone, accountId: body.accountId });
        const permitted = await access.check(uid, { phone: body.telefone });
        if (!permitted.allowed) {
          return {
            phoneHash,
            result: { vinculado: false, motivo: 'WHATSAPP_ACCESS_REQUIRED', assinatura: permitted.status, mensagem: accessMessage(permitted.status) }
          };
        }
        return { phoneHash, result: { vinculado: true, acesso: permitted.source } };
      } catch (error) {
        if (error instanceof ApiError && error.status === 403) return { phoneHash: '', result: { vinculado: false, motivo: error.code } };
        throw error;
      }
    }
  };

  const readRoutes = {
    despesas: async (uid, body) => buildLegacyDespesas(await store.listFinanceRecords(uid), resolveCompetence(body.competencia, now())),
    resumo: async (uid, body) => buildResumo(await store.listFinanceRecords(uid), resolvePeriod(body, now())),
    lancamentos: async (uid, body) => {
      const filters = parseListFilters(body, now());
      return buildLancamentos(await store.listFinanceRecords(uid), filters);
    },
    categorias: async (uid, body) => buildCategorias(await store.listFinanceRecords(uid), resolvePeriod(body, now())),
    vencimentos: async (uid, body) => buildVencimentos(await store.listFinanceRecords(uid), body, now()),
    opcoes: async (uid, body) => {
      const [references, records] = await Promise.all([store.listReferenceRecords(uid), store.listFinanceRecords(uid)]);
      return buildOpcoes(references, records, body);
    }
  };

  const writeRoutes = {
    'acoes/preparar': (uid, body) => actions.prepare(uid, body),
    'acoes/confirmar': (uid, body) => actions.confirm(uid, body),
    'acoes/cancelar': (uid, body) => actions.cancel(uid, body)
  };

  async function handleStripeWebhook(headers, rawBody) {
    if (!billing) throw new ApiError(503, 'BILLING_NOT_CONFIGURED', 'Webhook do Stripe nao configurado.');
    verifyStripeSignature(rawBody, headers['stripe-signature'], stripeWebhookSecret, { nowSeconds: Math.floor(now().getTime() / 1000) });
    // Usa exatamente os bytes assinados, nunca um corpo reinterpretado no caminho.
    return billing.handleEvent(JSON.parse(rawBody));
  }

  async function handle({ method, path, headers = {}, body, rawBody }) {
    const requestId = newId();
    const started = Date.now();
    const route = String(path || '').split('?')[0];
    let phoneHash = '';
    let status = 500;
    let code = 'OK';
    try {
      if (method === 'GET' && route === '/health') {
        status = 200;
        return { status, body: { ok: true } };
      }
      if (!isAuthorized(headers, apiKey)) throw new ApiError(401, 'UNAUTHORIZED', 'Chave de API ausente ou invalida.');
      if (route === STRIPE_WEBHOOK_PATH) {
        if (method !== 'POST') throw new ApiError(405, 'METHOD_NOT_ALLOWED', 'Use POST.');
        const result = await handleStripeWebhook(headers, rawBody);
        code = result.resultado;
        status = 200;
        return { status, body: result };
      }
      if (route === BILLING_PATH || route === BILLING_CHECKOUT_PATH || route === BILLING_PORTAL_PATH) {
        if (method !== 'POST') throw new ApiError(405, 'METHOD_NOT_ALLOWED', 'Use POST.');
        // Antes de conferir o token: cada chamada pode ir ao Firebase e ao Stripe.
        rateLimiter.enforce('billingGlobal', 'all');
        rateLimiter.enforce('billingToken', body?.idToken ? hashKey(body.idToken) : '');
        const deletion = route === BILLING_PATH ? ACCOUNT_DELETION_ACTIONS[String(body?.acao || '')] : '';
        if (deletion) {
          if (!accountDeletion?.configured) throw new ApiError(503, 'ACCOUNT_DELETION_NOT_CONFIGURED', 'Exclusao de conta indisponivel no momento.');
          const result = await accountDeletion[deletion](body);
          code = 'ACCOUNT_DELETED';
          status = 200;
          return { status, body: result };
        }
        if (!checkout?.configured) throw new ApiError(503, 'BILLING_NOT_CONFIGURED', 'Assinatura indisponivel no momento.');
        const action = route === BILLING_PATH ? String(body?.acao || '') : route.slice(BILLING_PATH.length + 1);
        if (!['checkout', 'portal'].includes(action)) throw new ApiError(400, 'INVALID_ACTION', 'Acao invalida.');
        const result = action === 'checkout' ? await checkout.createCheckout(body) : await checkout.createPortal(body);
        status = 200;
        return { status, body: result };
      }
      if (!route.startsWith(`${PREFIX}/`)) throw new ApiError(404, 'NOT_FOUND', 'Rota nao encontrada.');
      if (method !== 'POST') throw new ApiError(405, 'METHOD_NOT_ALLOWED', 'Use POST.');
      if (!body || typeof body !== 'object' || Array.isArray(body)) throw new ApiError(400, 'INVALID_BODY', 'Corpo JSON obrigatorio.');

      const name = route.slice(PREFIX.length + 1);
      // Por telefone antes de qualquer leitura no banco (o telefone vem verificado do Chatwoot).
      const phoneKey = hashKey(normalizePhone(body.telefone) || String(body.telefone ?? ''));
      rateLimiter.enforce('phone', phoneKey);
      if (name === 'vinculo/confirmar') rateLimiter.enforce('linkConfirm', phoneKey);
      if (linkRoutes[name]) {
        const { phoneHash: hash, result } = await linkRoutes[name](body);
        phoneHash = hash;
        status = 200;
        return { status, body: result };
      }
      const handler = readRoutes[name] || writeRoutes[name];
      if (!handler) throw new ApiError(404, 'NOT_FOUND', 'Rota nao encontrada.');

      const { uid, phoneHash: hash } = await resolver.resolve({ telefone: body.telefone, accountId: body.accountId });
      phoneHash = hash;
      rateLimiter.enforce('user', uid);
      if (writeRoutes[name]) rateLimiter.enforce('userWrite', uid);
      await access.assert(uid, { phone: body.telefone });
      const result = await handler(uid, body);
      status = 200;
      return { status, body: result };
    } catch (error) {
      if (error instanceof ApiError) {
        status = error.status;
        code = error.code;
        return { status, body: { erro: { codigo: error.code, mensagem: error.message, ...(error.details ? { detalhes: error.details } : {}) } } };
      }
      status = 500;
      code = 'INTERNAL_ERROR';
      logger.error(JSON.stringify({ level: 'error', request_id: requestId, event: 'unhandled_error', message: String(error?.message || error).slice(0, 300) }));
      return { status, body: { erro: { codigo: 'INTERNAL_ERROR', mensagem: 'Erro interno.' } } };
    } finally {
      // Sem valores financeiros, telefone ou corpo da requisicao no log.
      logger.info(JSON.stringify({ level: 'info', request_id: requestId, method, route, status, code, phone_hash: phoneHash, duration_ms: Date.now() - started }));
    }
  }

  return { handle };
}
