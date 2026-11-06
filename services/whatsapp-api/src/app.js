import { randomUUID } from 'node:crypto';
import { ApiError } from './errors.js';
import { isAuthorized } from './auth.js';
import { createActionService } from './actions.js';
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
const PREFIX = '/internal/whatsapp';

/**
 * Nucleo HTTP independente de framework: recebe {method, path, headers, body}
 * e devolve {status, body}. O servidor (server.js) so faz a ponte com node:http.
 */
export function createApp({ store, resolver, apiKey, now = () => new Date(), logger = console, newId = () => randomUUID() }) {
  if (!store || !resolver) throw new Error('createApp requer store e resolver.');
  const actions = createActionService({ store, now, newId });

  const readRoutes = {
    despesas: async (uid, body) => buildLegacyDespesas(await store.listFinanceRecords(uid), resolveCompetence(body.competencia, now())),
    resumo: async (uid, body) => buildResumo(await store.listFinanceRecords(uid), resolvePeriod(body, now())),
    lancamentos: async (uid, body) => {
      const filters = parseListFilters(body, now());
      return buildLancamentos(await store.listFinanceRecords(uid), filters);
    },
    categorias: async (uid, body) => buildCategorias(await store.listFinanceRecords(uid), resolvePeriod(body, now())),
    vencimentos: async (uid, body) => buildVencimentos(await store.listFinanceRecords(uid), body, now())
  };

  const writeRoutes = {
    'acoes/preparar': (uid, body) => actions.prepare(uid, body),
    'acoes/confirmar': (uid, body) => actions.confirm(uid, body),
    'acoes/cancelar': (uid, body) => actions.cancel(uid, body)
  };

  async function handle({ method, path, headers = {}, body }) {
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
      if (!route.startsWith(`${PREFIX}/`)) throw new ApiError(404, 'NOT_FOUND', 'Rota nao encontrada.');
      if (method !== 'POST') throw new ApiError(405, 'METHOD_NOT_ALLOWED', 'Use POST.');
      if (!body || typeof body !== 'object' || Array.isArray(body)) throw new ApiError(400, 'INVALID_BODY', 'Corpo JSON obrigatorio.');

      const name = route.slice(PREFIX.length + 1);
      const handler = readRoutes[name] || writeRoutes[name];
      if (!handler) throw new ApiError(404, 'NOT_FOUND', 'Rota nao encontrada.');

      const { uid, phoneHash: hash } = await resolver.resolve({ telefone: body.telefone, accountId: body.accountId });
      phoneHash = hash;
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
