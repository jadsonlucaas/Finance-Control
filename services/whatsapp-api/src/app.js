import { randomUUID } from 'node:crypto';
import { ApiError } from './errors.js';
import { isAuthorized } from './auth.js';
import { createActionService } from './actions.js';
import { buildOpcoes } from './references.js';
import { createLinkService } from './links.js';
import { accessMessage, createAccessPolicy } from './access.js';
import { createBillingService, verifyStripeSignature } from './billing.js';
import { createRateLimiter, hashKey } from './rateLimit.js';
import { createInboundMessageService } from './inboundMessages.js';
import { normalizePhone } from './phoneLinks.js';
import { checkStoreHealth } from './health.js';
import { createPreferenceResolver } from './preferences.js';
import { runWithCurrency } from './money.js';
import { buildOrcamento, defineBudget } from './budgets.js';
import { currentCompetence } from './dates.js';
import { shiftCompetence } from '../../../src/core/recordsHistoryWindow.js';
import { createNotificationService } from './notificationService.js';
import { emptyUsage, enterUsage, saveUsage } from './usage.js';
import { createDailyLimiter, dailyLimitMessage } from './dailyLimits.js';
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


// Meses lidos quando a consulta nao diz o periodo (busca, opcoes, formas de pagamento).
export const RECENT_LOOKUP_MONTHS = 12;
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
// Saude com teste real do banco (usada pelo monitor do n8n a cada 5 min).
export const HEALTH_DEEP_PATH = '/internal/health';
// Alertas automaticos (n8n de hora em hora): busca as mensagens e devolve o resultado do envio.
export const NOTIFICATIONS_PENDING_PATH = '/internal/notificacoes/pendentes';
export const NOTIFICATIONS_RESULT_PATH = '/internal/notificacoes/resultado';
// Exclusao de conta: mesma rota/relay do n8n, acao no corpo.
// Exportacao dos dados da conta (direito de acesso/portabilidade): mesma rota, acao no corpo.
export const DATA_EXPORT_ACTION = 'exportar_dados';
export const ACCOUNT_DELETION_ACTIONS = Object.freeze({ excluir_conta: 'deleteOwnAccount', excluir_usuario: 'deleteUserAsAdmin' });

/**
 * Nucleo HTTP independente de framework: recebe {method, path, headers, body}
 * e devolve {status, body}. O servidor (server.js) so faz a ponte com node:http.
 */
// O assistente (n8n) le daqui o idioma e a moeda para responder ao usuario.
// Idioma = DDI do telefone cadastrado na conta (mesma regra do Dashboard, localeForPhone).
function withPreferences(result, prefs) {
  if (!result || typeof result !== 'object' || Array.isArray(result)) return result;
  return { ...result, preferencias: { idioma: prefs.locale, moeda: prefs.currency, fuso: prefs.time_zone } };
}

export function createApp({
  store,
  resolver,
  apiKey,
  accessMode = 'open',
  stripeWebhookSecret = '',
  checkout = null,
  accountDeletion = null,
  dataExport = null,
  now = () => new Date(),
  logger = console,
  newId = () => randomUUID(),
  rateLimiter = createRateLimiter(),
  healthTimeoutMs = 5000,
  preferenceResolver = null,
  notificationTemplates = {},
  dailyLimits = undefined,
  dailyLimiter = null
}) {
  if (!store || !resolver) throw new Error('createApp requer store e resolver.');
  const access = createAccessPolicy({ store, mode: accessMode });
  const actions = createActionService({ store, now, newId });
  const preferences = preferenceResolver || createPreferenceResolver({ store, logger });
  const links = createLinkService({ store, now });
  const billing = stripeWebhookSecret ? createBillingService({ store, now, logger }) : null;
  const inbound = typeof store.reserveInboundMessage === 'function' ? createInboundMessageService({ store, now }) : null;
  const daily = dailyLimiter || createDailyLimiter({ store, limits: dailyLimits, logger });
  const notifications = createNotificationService({ store, access, preferences, now, newId, templates: notificationTemplates, logger });

  // Rotas sem usuario resolvido: o telefone ainda pode nao estar vinculado.
  const linkRoutes = {
    // Chamada pelo n8n antes do agente: { duplicada: true } quando a mensagem ja foi recebida.
    'mensagem/registrar': async (body, usage) => {
      if (!inbound) throw new ApiError(503, 'DEDUP_NOT_CONFIGURED', 'Deduplicacao indisponivel.');
      const registered = await inbound.register(body);
      // Consumo: 1 mensagem nova = 1 execucao do agente no n8n. Telefone sem vinculo nao conta.
      if (!registered.result.duplicada && usage) {
        try {
          usage.uid = (await resolver.resolve({ telefone: body.telefone, accountId: body.accountId })).uid;
          usage.messages = 1;
        } catch {
          // Sem vinculo: nada a medir.
        }
      }
      // Limite diario por usuario: o n8n responde a mensagem pronta em vez de chamar o agente.
      if (!registered.result.duplicada && usage?.uid) {
        const dailyCheck = await daily.hit('messages', usage.uid, now());
        if (!dailyCheck.allowed) {
          let locale = '';
          try {
            locale = (await preferences.forUser(usage.uid, body.telefone)).locale;
          } catch {
            // Sem preferencias: responde em portugues.
          }
          registered.result = { ...registered.result, limite_atingido: true, mensagem: dailyLimitMessage(locale) };
        }
      }
      // Janela de 24h do WhatsApp: guarda no vinculo a hora da ultima mensagem do usuario.
      if (!registered.result.duplicada && typeof store.touchLinkInbound === 'function') {
        try {
          await store.touchLinkInbound(normalizePhone(body.telefone), now().toISOString());
        } catch {
          logger.warn?.(JSON.stringify({ level: 'warn', event: 'link_inbound_touch_failed' }));
        }
      }
      return registered;
    },
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

  // Ler so a partir do mes que a consulta precisa (mais as contas em aberto), nao o historico inteiro.
  const recentStart = (prefs) => shiftCompetence(currentCompetence(now(), prefs.time_zone), -(RECENT_LOOKUP_MONTHS - 1));
  const recordsFrom = (uid, from) => store.listFinanceRecords(uid, { from });

  const readRoutes = {
    despesas: async (uid, body, prefs) => {
      const competence = resolveCompetence(body.competencia, now(), prefs.time_zone);
      return buildLegacyDespesas(await recordsFrom(uid, competence), competence);
    },
    resumo: async (uid, body, prefs) => {
      const period = resolvePeriod(body, now(), prefs.time_zone);
      return buildResumo(await recordsFrom(uid, period.inicio), period);
    },
    lancamentos: async (uid, body, prefs) => {
      const filters = parseListFilters(body, now(), prefs.time_zone);
      // Sem competencia: busca nos ultimos 12 meses (e futuros), mais recentes primeiro.
      return buildLancamentos(await recordsFrom(uid, filters.competencia || recentStart(prefs)), filters);
    },
    categorias: async (uid, body, prefs) => {
      const period = resolvePeriod(body, now(), prefs.time_zone);
      return buildCategorias(await recordsFrom(uid, period.inicio), period);
    },
    // Orcamentos: lidos sem cache (documentos pequenos) para refletir na hora o que
    // mudou no Dashboard; os lancamentos seguem o cache curto de leitura.
    orcamento: async (uid, body, prefs) => {
      if (typeof store.listBudgets !== 'function') throw new ApiError(503, 'BUDGETS_NOT_CONFIGURED', 'Orcamentos indisponiveis.');
      const competencia = resolveCompetence(body.competencia, now(), prefs.time_zone);
      const [records, budgets] = await Promise.all([recordsFrom(uid, competencia), store.listBudgets(uid)]);
      return buildOrcamento(records, budgets, {
        competencia,
        categoria: typeof body.categoria === 'string' ? body.categoria.slice(0, 80) : '',
        currentCompetence: currentCompetence(now(), prefs.time_zone),
        locale: prefs.locale
      });
    },
    // Vencidas de qualquer epoca vem pela consulta de contas em aberto.
    vencimentos: async (uid, body, prefs) => buildVencimentos(await recordsFrom(uid, currentCompetence(now(), prefs.time_zone)), body, now(), prefs.time_zone),
    opcoes: async (uid, body, prefs) => {
      const [references, records] = await Promise.all([store.listReferenceRecords(uid), recordsFrom(uid, recentStart(prefs))]);
      return buildOpcoes(references, records, body);
    }
  };

  const writeRoutes = {
    'acoes/preparar': (uid, body, prefs) => actions.prepare(uid, body, prefs),
    'acoes/confirmar': (uid, body, prefs) => actions.confirm(uid, body, prefs),
    'acoes/cancelar': (uid, body) => actions.cancel(uid, body),
    // Cria ou altera o limite (categoria ou total) direto, como o cadastro de gastos.
    'orcamento/definir': (uid, body, prefs) => defineBudget(store, uid, {
      categoria: typeof body.categoria === 'string' ? body.categoria : '',
      valor: body.valor,
      competencia: resolveCompetence(body.competencia, now(), prefs.time_zone),
      currentCompetence: currentCompetence(now(), prefs.time_zone),
      locale: prefs.locale,
      nowIso: now().toISOString()
    })
  };

  async function handleStripeWebhook(headers, rawBody) {
    if (!billing) throw new ApiError(503, 'BILLING_NOT_CONFIGURED', 'Webhook do Stripe nao configurado.');
    verifyStripeSignature(rawBody, headers['stripe-signature'], stripeWebhookSecret, { nowSeconds: Math.floor(now().getTime() / 1000) });
    // Usa exatamente os bytes assinados, nunca um corpo reinterpretado no caminho.
    return billing.handleEvent(JSON.parse(rawBody));
  }

  let lastUsageWrite = Promise.resolve(false);

  async function handle({ method, path, headers = {}, body, rawBody }) {
    const requestId = newId();
    const started = Date.now();
    const route = String(path || '').split('?')[0];
    let phoneHash = '';
    let status = 500;
    let code = 'OK';
    const usage = enterUsage({ ...emptyUsage(), uid: '' });
    try {
      if (method === 'GET' && route === '/health') {
        status = 200;
        return { status, body: { ok: true } };
      }
      if (!isAuthorized(headers, apiKey)) throw new ApiError(401, 'UNAUTHORIZED', 'Chave de API ausente ou invalida.');
      if (method === 'GET' && route === HEALTH_DEEP_PATH) {
        // Autenticada: cada chamada gasta uma leitura no Firestore.
        rateLimiter.enforce('healthDeep', 'all');
        const result = await checkStoreHealth(store, { timeoutMs: healthTimeoutMs });
        code = result.ok ? 'OK' : 'STORE_UNAVAILABLE';
        status = result.ok ? 200 : 503;
        return { status, body: result };
      }
      if (route === NOTIFICATIONS_PENDING_PATH || route === NOTIFICATIONS_RESULT_PATH) {
        if (method !== 'POST') throw new ApiError(405, 'METHOD_NOT_ALLOWED', 'Use POST.');
        if (!notifications.configured) throw new ApiError(503, 'NOTIFICATIONS_NOT_CONFIGURED', 'Alertas indisponiveis.');
        const pendingRoute = route === NOTIFICATIONS_PENDING_PATH;
        rateLimiter.enforce(pendingRoute ? 'notificationsRun' : 'notificationsResult', 'all');
        const result = pendingRoute ? await notifications.collectPending(body || {}) : await notifications.reportResult(body || {});
        status = 200;
        return { status, body: result };
      }
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
        if (route === BILLING_PATH && String(body?.acao || '') === DATA_EXPORT_ACTION) {
          if (!dataExport?.configured) throw new ApiError(503, 'DATA_EXPORT_NOT_CONFIGURED', 'Exportacao indisponivel no momento.');
          const result = await dataExport.exportOwnData(body, { beforeExport: (uid) => rateLimiter.enforce('dataExport', uid) });
          code = 'DATA_EXPORTED';
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
        const { phoneHash: hash, result } = await linkRoutes[name](body, usage);
        phoneHash = hash;
        status = 200;
        return { status, body: result };
      }
      const handler = readRoutes[name] || writeRoutes[name] || (name === 'notificacoes/parar' ? true : null);
      if (!handler) throw new ApiError(404, 'NOT_FOUND', 'Rota nao encontrada.');

      const { uid, phoneHash: hash } = await resolver.resolve({ telefone: body.telefone, accountId: body.accountId });
      phoneHash = hash;
      usage.uid = uid;
      usage.tool_calls = 1;
      usage.routes = { [name]: 1 };
      if (writeRoutes[name] || name === 'notificacoes/parar') usage.writes = 1;
      rateLimiter.enforce('user', uid);
      if (writeRoutes[name] || name === 'notificacoes/parar') rateLimiter.enforce('userWrite', uid);
      // "parar alertas" vale mesmo sem Premium: revogar consentimento nunca depende de assinatura.
      if (name === 'notificacoes/parar') {
        const prefs = await preferences.forUser(uid, body.telefone);
        status = 200;
        return { status, body: await notifications.stopFromWhatsApp(uid, prefs) };
      }
      await access.assert(uid, { phone: body.telefone });
      // Fuso, idioma e moeda do usuario, escolhidos em Configuracoes no Dashboard.
      const prefs = await preferences.forUser(uid, body.telefone);
      // Teto diario de ferramentas: segura o custo mesmo se o agente entrar em loop.
      await daily.enforce('tool_calls', uid, { now: now(), locale: prefs.locale });
      const result = await runWithCurrency(prefs.currency, () => handler(uid, body, prefs));
      status = 200;
      // /despesas e a rota legada com contrato fixo: fica sem o bloco de preferencias.
      return { status, body: name === 'despesas' ? result : withPreferences(result, prefs) };
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
      // Sem await: medir consumo nao atrasa nem derruba a resposta.
      if (usage.uid) lastUsageWrite = saveUsage(store, usage.uid, usage, { now: now(), logger });
    }
  }

  // Testes: aguarda a ultima gravacao de consumo.
  return { handle, flushUsage: () => lastUsageWrite };
}
