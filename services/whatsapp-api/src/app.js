import { randomUUID } from 'node:crypto';
import { ApiError } from './errors.js';
import { isAuthorized } from './auth.js';
import { createActionService } from './actions.js';
import { buildOpcoes } from './references.js';
import { createLinkService } from './links.js';
import { ACCESS_REQUIRED_MESSAGE, createAccessPolicy } from './access.js';
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
export function createApp({
  store,
  resolver,
  apiKey,
  accessMode = 'open',
  now = () => new Date(),
  logger = console,
  newId = () => randomUUID()
}) {
  if (!store || !resolver) throw new Error('createApp requer store e resolver.');
  const access = createAccessPolicy({ store, mode: accessMode });
  const actions = createActionService({ store, now, newId });
  const links = createLinkService({ store, now });

  // Rotas sem usuario resolvido: o telefone ainda pode nao estar vinculado.
  const linkRoutes = {
    'vinculo/confirmar': async (body) => {
      const { phoneHash, ...result } = await links.confirm(body);
      return { phoneHash, result };
    },
    'vinculo/status': async (body) => {
      try {
        const { uid, phoneHash } = await resolver.resolve({ telefone: body.telefone, accountId: body.accountId });
        const permitted = await access.check(uid);
        if (!permitted.allowed) {
          return {
            phoneHash,
            result: { vinculado: false, motivo: 'WHATSAPP_ACCESS_REQUIRED', assinatura: permitted.status, mensagem: ACCESS_REQUIRED_MESSAGE }
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
      await access.assert(uid);
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
