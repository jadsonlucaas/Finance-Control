import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Consumo por cliente (Etapa 5, item 3).
 *
 * Um documento por usuario e mes: users/{uid}/usage/{AAAA-MM}, com contadores
 * incrementados pela API (uma escrita por chamada):
 *   messages        mensagens recebidas no WhatsApp (= execucoes do agente de IA no n8n)
 *   tool_calls      ferramentas chamadas pelo agente (rotas /internal/whatsapp/*)
 *   writes          ferramentas que gravam (registrar, editar, orcamento/definir...)
 *   records_read    documentos lidos no Firestore para responder (fora do cache)
 *   by_route.{rota} chamadas por ferramenta
 *   by_day.{DD}     { messages, tool_calls, records_read } por dia (UTC)
 *
 * Fica dentro de users/{uid}: entra na exportacao de dados e sai na exclusao da conta.
 * Nada de valor, telefone ou texto de mensagem e gravado aqui.
 */
const usageContext = new AsyncLocalStorage();

export function emptyUsage() {
  return { messages: 0, tool_calls: 0, writes: 0, records_read: 0, routes: {} };
}

/** Executa fn contando as leituras feitas pelo store nesta requisicao. */
export function runWithUsage(counter, fn) {
  return usageContext.run(counter, fn);
}

/** Liga o contador ao restante da requisicao atual (o handler HTTP ja e um contexto proprio). */
export function enterUsage(counter) {
  usageContext.enterWith(counter);
  return counter;
}

export function countRecordsRead(count) {
  const counter = usageContext.getStore();
  if (counter && Number.isFinite(count) && count > 0) counter.records_read += count;
}

const COUNTED_LISTS = ['listFinanceRecords', 'listReferenceRecords', 'listBudgets'];

/**
 * Conta os documentos devolvidos pelas leituras grandes do store. Deve ficar POR BAIXO
 * do cache (withReadCache), para contar so o que foi de fato ao Firestore.
 */
export function withReadCounting(store) {
  const wrapped = Object.create(store);
  for (const name of COUNTED_LISTS) {
    if (typeof store[name] !== 'function') continue;
    wrapped[name] = async (...args) => {
      const result = await store[name](...args);
      // Consulta vazia tambem custa 1 leitura no Firestore.
      countRecordsRead(Array.isArray(result) ? Math.max(result.length, 1) : 1);
      return result;
    };
  }
  return wrapped;
}

/** Converte o contador da requisicao no incremento do documento do mes. */
export function usageIncrement(counter, now = new Date()) {
  const iso = now.toISOString();
  const month = iso.slice(0, 7);
  const day = iso.slice(8, 10);
  const fields = {};
  const add = (path, value) => {
    if (value > 0) fields[path] = (fields[path] || 0) + value;
  };
  add('messages', counter.messages);
  add('tool_calls', counter.tool_calls);
  add('writes', counter.writes);
  add('records_read', counter.records_read);
  Object.entries(counter.routes || {}).forEach(([route, total]) => add(`by_route.${route.replace(/\//g, '_')}`, total));
  add(`by_day.${day}.messages`, counter.messages);
  add(`by_day.${day}.tool_calls`, counter.tool_calls);
  add(`by_day.${day}.records_read`, counter.records_read);
  return { month, fields, updatedAt: iso };
}

/** Grava sem derrubar a requisicao: medir consumo nunca impede o usuario de ser atendido. */
export async function saveUsage(store, uid, counter, { now = new Date(), logger } = {}) {
  if (!uid || typeof store.incrementUsage !== 'function') return false;
  const { month, fields, updatedAt } = usageIncrement(counter, now);
  if (!Object.keys(fields).length) return false;
  try {
    await store.incrementUsage(uid, month, fields, updatedAt);
    return true;
  } catch {
    logger?.warn?.(JSON.stringify({ level: 'warn', event: 'usage_write_failed' }));
    return false;
  }
}
