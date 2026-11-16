import { createHash } from 'node:crypto';
import { resolveNotificationSettings, SEND_HOUR_MAX } from '../../../src/core/notificationSettings.js';
import { currentCompetence, todayIn } from './dates.js';
import { ApiError, badRequest } from './errors.js';
import { runWithCurrency } from './money.js';
import { buildUserAlerts, stopAlertsReply } from './notifications.js';
import { hashPhone } from './phoneLinks.js';
import { shiftCompetence } from '../../../src/core/recordsHistoryWindow.js';

/**
 * Motor dos alertas automaticos, chamado pelo n8n de hora em hora.
 *
 * pendentes: para cada usuario com consentimento do WhatsApp, uma vez por dia, a partir do
 * horario escolhido (send_hour, no fuso da conta) e ate as 21h:
 *   1. exige vinculo ativo do WhatsApp e acesso Premium;
 *   2. monta os alertas ligados (notifications.js), sem repetir os ja enviados;
 *   3. janela de 24h: com mensagem do usuario nas ultimas 23h30 vai texto livre; fora dela so
 *      com template aprovado na Meta (NOTIFICATION_TEMPLATES). Sem template o alerta nao sai e
 *      volta a ser avaliado no dia seguinte;
 *   4. reserva as chaves (notification_deliveries) antes de devolver, para dois disparos
 *      seguidos nao mandarem o mesmo aviso.
 * resultado: o n8n informa enviado/falhou. Falha libera as chaves (novo aviso no dia seguinte).
 *
 * Nada de texto, valor ou telefone em claro fica gravado: so tipo, chaves e hash do telefone.
 */
export const WINDOW_MS = 23.5 * 60 * 60 * 1000;
export const DELIVERY_TTL_MS = 120 * 24 * 60 * 60 * 1000;
export const MESSAGE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const DEFAULT_MAX_USERS_PER_RUN = 200;
const RESULT_STATUSES = Object.freeze(['enviado', 'falhou']);
const MESSAGE_ID_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;

export const deliveryId = (uid, key) => createHash('sha256').update(`${uid}|${key}`).digest('hex').slice(0, 40);

export function localHour(date, timeZone) {
  const hour = new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', hourCycle: 'h23' }).format(date);
  return Number(hour);
}

/**
 * NOTIFICATION_TEMPLATES (JSON): { "due_soon": { "pt-BR": "fc_contas_a_vencer", "es-ES": "fc_facturas_por_vencer" }, ... }
 * O idioma do template na Meta segue o locale: pt-BR -> pt_BR, es-ES -> es.
 */
export function parseNotificationTemplates(raw) {
  if (!raw || !String(raw).trim()) return {};
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('NOTIFICATION_TEMPLATES deve ser JSON valido.');
  }
  const out = {};
  for (const [type, byLocale] of Object.entries(parsed || {})) {
    if (!byLocale || typeof byLocale !== 'object') continue;
    for (const [locale, name] of Object.entries(byLocale)) {
      if (typeof name === 'string' && /^[a-z0-9_]{1,512}$/.test(name)) (out[type] ||= {})[locale] = name;
    }
  }
  return out;
}

const META_LANGUAGE = Object.freeze({ 'pt-BR': 'pt_BR', 'es-ES': 'es' });

function templateFor(templates, type, locale) {
  const name = templates?.[type]?.[locale];
  return name ? { nome: name, idioma: META_LANGUAGE[locale] || locale.replace('-', '_') } : null;
}

function windowOpen(link, nowMs) {
  const last = Date.parse(String(link?.last_inbound_at || ''));
  return Number.isFinite(last) && nowMs - last < WINDOW_MS;
}

export function createNotificationService({
  store,
  access,
  preferences,
  now = () => new Date(),
  newId,
  templates = {},
  logger = console,
  maxUsersPerRun = DEFAULT_MAX_USERS_PER_RUN
}) {
  const configured = typeof store?.listNotificationRecipients === 'function';

  async function processUser(uid, rawSettings, current, summary) {
    const settings = resolveNotificationSettings(rawSettings);
    if (settings.whatsapp_consent !== 'granted') return null;
    const link = await store.getActiveLinkByUid(uid);
    const prefs = await preferences.forUser(uid, link?.telefone || '');
    const today = todayIn(current, prefs.time_zone);
    const hour = localHour(current, prefs.time_zone);
    if (hour < settings.send_hour || hour > SEND_HOUR_MAX) {
      summary.fora_do_horario += 1;
      return null;
    }
    const state = await store.getNotificationState(uid);
    if (state?.last_run_date === today) {
      summary.ja_processados += 1;
      return null;
    }
    const markDone = (motivo) => store.setNotificationState(uid, { last_run_date: today, last_run_at: current.toISOString(), last_result: motivo });

    if (!link) {
      summary.sem_vinculo += 1;
      await markDone('sem_vinculo');
      return null;
    }
    const permitted = await access.check(uid, { phone: link.telefone });
    if (!permitted.allowed) {
      summary.sem_premium += 1;
      await markDone('sem_premium');
      return null;
    }

    const competence = currentCompetence(current, prefs.time_zone);
    // Mes anterior (resumo mensal) em diante + contas em aberto de qualquer epoca (vencidas).
    const [records, budgets] = await Promise.all([
      store.listFinanceRecords(uid, { from: shiftCompetence(competence, -1) }),
      settings.budget_enabled && typeof store.listBudgets === 'function' ? store.listBudgets(uid) : []
    ]);
    // Primeiro sem filtro para saber as chaves candidatas; depois so as ainda nao enviadas.
    const candidates = await runWithCurrency(prefs.currency, () => buildUserAlerts({ records, budgets, settings, locale: prefs.locale, today, competence }));
    const keys = [...new Set(candidates.flatMap((alert) => alert.chaves))];
    const sent = keys.length ? await store.getNotificationDeliveries(keys.map((key) => deliveryId(uid, key))) : new Map();
    const alreadySent = new Set(keys.filter((key) => sent.has(deliveryId(uid, key))));
    const alerts = alreadySent.size
      ? await runWithCurrency(prefs.currency, () => buildUserAlerts({ records, budgets, settings, locale: prefs.locale, today, competence, alreadySent }))
      : candidates;

    const open = windowOpen(link, current.getTime());
    const messages = [];
    for (const alert of alerts) {
      const template = open ? null : templateFor(templates, alert.tipo, prefs.locale);
      if (!open && !template) {
        summary.aguardando_template += 1;
        continue;
      }
      const id = newId().replace(/[^A-Za-z0-9_-]/g, '');
      const reserved = await store.reserveNotificationDeliveries(alert.chaves.map((key) => ({
        id: deliveryId(uid, key),
        data: {
          uid,
          tipo: alert.tipo,
          status: 'pending',
          message_id: id,
          created_at: current.toISOString(),
          expires_at: new Date(current.getTime() + DELIVERY_TTL_MS)
        }
      })));
      if (!reserved) {
        summary.concorrencia += 1;
        continue;
      }
      await store.saveNotificationMessage(id, {
        uid,
        tipo: alert.tipo,
        delivery_ids: alert.chaves.map((key) => deliveryId(uid, key)),
        phone_hash: hashPhone(link.telefone),
        modo: template ? 'template' : 'texto',
        status: 'pending',
        created_at: current.toISOString(),
        expires_at: new Date(current.getTime() + MESSAGE_TTL_MS)
      });
      messages.push({
        id,
        tipo: alert.tipo,
        telefone: link.telefone,
        chatwoot_account_id: String(link.chatwoot_account_id || ''),
        idioma: prefs.locale,
        janela_aberta: open,
        texto: alert.texto,
        template: template ? { ...template, parametros: alert.parametros } : null
      });
    }
    await markDone(messages.length ? 'mensagens' : 'nada_a_enviar');
    return messages;
  }

  async function collectPending(body = {}) {
    if (!configured) throw new ApiError(503, 'NOTIFICATIONS_NOT_CONFIGURED', 'Alertas indisponiveis.');
    const limit = Math.min(Number(body.limite) > 0 ? Number(body.limite) : maxUsersPerRun, maxUsersPerRun);
    const current = now();
    const summary = { usuarios: 0, fora_do_horario: 0, ja_processados: 0, sem_vinculo: 0, sem_premium: 0, aguardando_template: 0, concorrencia: 0, erros: 0 };
    const recipients = await store.listNotificationRecipients({ limit });
    const mensagens = [];
    for (const { uid, settings } of recipients) {
      summary.usuarios += 1;
      try {
        const messages = await processUser(uid, settings, current, summary);
        if (messages) mensagens.push(...messages);
      } catch (error) {
        // Um usuario com problema nao impede os outros; tenta de novo na proxima hora.
        summary.erros += 1;
        logger.error?.(JSON.stringify({ level: 'error', event: 'notification_user_failed', message: String(error?.message || error).slice(0, 200) }));
      }
    }
    return { gerado_em: current.toISOString(), mensagens, resumo: { ...summary, mensagens: mensagens.length } };
  }

  async function reportResult(body = {}) {
    const id = String(body.id || '');
    if (!MESSAGE_ID_PATTERN.test(id)) throw badRequest('INVALID_MESSAGE_ID', 'Identificador da mensagem invalido.');
    const status = String(body.status || '');
    if (!RESULT_STATUSES.includes(status)) throw badRequest('INVALID_STATUS', 'Status deve ser enviado ou falhou.');
    const code = String(body.erro_codigo ?? '').replace(/[^A-Za-z0-9_.:-]/g, '').slice(0, 60);
    const message = await store.getNotificationMessage(id);
    if (!message) throw new ApiError(404, 'MESSAGE_NOT_FOUND', 'Mensagem nao encontrada.');
    if (message.status !== 'pending') return { id, status: message.status, alterado: false };
    const finishedAt = now().toISOString();
    if (status === 'enviado') {
      await store.finishNotificationMessage(id, message.delivery_ids, { status: 'sent', finished_at: finishedAt });
      return { id, status: 'sent', alterado: true };
    }
    // Falhou: libera as chaves; o aviso pode sair de novo no proximo dia.
    await store.failNotificationMessage(id, message.delivery_ids, { status: 'failed', finished_at: finishedAt, erro_codigo: code });
    logger.warn?.(JSON.stringify({ level: 'warn', event: 'notification_send_failed', tipo: message.tipo, code }));
    return { id, status: 'failed', alterado: true };
  }

  /** "parar alertas" no WhatsApp: revoga o consentimento (origem whatsapp) com registro no historico. */
  async function stopFromWhatsApp(uid, prefs) {
    const current = await store.getNotificationSettings(uid);
    if (resolveNotificationSettings(current).whatsapp_consent !== 'granted') {
      return { parado: true, ja_estava: true, resposta_usuario: stopAlertsReply(prefs.locale, { alreadyStopped: true }) };
    }
    await store.revokeNotificationConsent(uid, { at: now(), eventId: newId().replace(/[^A-Za-z0-9]/g, '').slice(0, 20) });
    return { parado: true, ja_estava: false, resposta_usuario: stopAlertsReply(prefs.locale) };
  }

  return { configured, collectPending, reportResult, stopFromWhatsApp };
}
