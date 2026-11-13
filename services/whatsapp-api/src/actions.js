import { createHash, randomUUID } from 'node:crypto';
import { validateFinanceRecord, FINANCE_RECORD_SCHEMA_VERSION } from '../../../src/domain/records/index.js';
import { summarizeFinanceRecord } from '../../../src/domain/audit/financeRecordAudit.js';
import { ApiError, badRequest } from './errors.js';
import { DEFAULT_TIME_ZONE, isCompetence, isDate, todayIn } from './dates.js';
import { formatBRL, parseAmount } from './money.js';
import { toPublicRecord } from './queries.js';
import { buildPaymentMethods, buildReferenceCatalog, canonicalPaymentMethod, resolveExpenseCategory, resolvePaymentMethod } from './references.js';

export const PENDING_ACTION_TTL_MS = 10 * 60 * 1000;
// Uma confirmacao parada em processing por mais que isso (queda do processo) pode ser retomada.
export const STALE_PROCESSING_MS = 2 * 60 * 1000;
export const ACTIONS = Object.freeze(['registrar_despesa', 'registrar_receita', 'marcar_pago', 'editar', 'excluir']);
const SOURCE_CHANNEL = 'future_integration';
const CREATED_BY_ID = 'whatsapp-api';
const MAX_TEXT = 140;

function cleanText(value, field) {
  if (value === undefined || value === null) return undefined;
  const text = String(value).trim();
  if (text.length > MAX_TEXT) throw badRequest('TEXT_TOO_LONG', `Campo ${field} excede ${MAX_TEXT} caracteres.`);
  return text;
}

function requireAmount(value, field = 'valor') {
  const amount = parseAmount(value);
  if (!Number.isFinite(amount) || amount <= 0) throw badRequest('INVALID_AMOUNT', `Campo ${field} deve ser um valor positivo (ex.: 150,90).`);
  if (amount > 10_000_000) throw badRequest('INVALID_AMOUNT', `Campo ${field} acima do limite permitido.`);
  return amount;
}

function optionalDate(value, field) {
  if (value === undefined || value === null || value === '') return undefined;
  if (!isDate(value)) throw badRequest('INVALID_DATE', `Campo ${field} deve usar YYYY-MM-DD.`);
  return String(value);
}

function optionalCompetence(value) {
  if (value === undefined || value === null || value === '') return undefined;
  if (!isCompetence(value)) throw badRequest('INVALID_COMPETENCE', 'Competencia deve usar YYYY-MM.');
  return String(value);
}

function stripUndefined(object) {
  return Object.fromEntries(Object.entries(object).filter(([, value]) => value !== undefined));
}

function fingerprint(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function assertValidRecord(record) {
  const result = validateFinanceRecord(record);
  if (!result.isValid) {
    throw new ApiError(422, 'FINANCE_RECORD_CONTRACT_INVALID', 'Lancamento nao respeita o contrato de dados.',
      result.errors.map((issue) => ({ campo: issue.field, codigo: issue.code })));
  }
}

function describe(record) {
  const publicRecord = toPublicRecord(record);
  const parts = [
    publicRecord.tipo === 'receita' ? 'Receita' : 'Despesa',
    publicRecord.descricao ? `"${publicRecord.descricao}"` : '',
    publicRecord.valor_formatado,
    publicRecord.categoria ? `categoria ${publicRecord.categoria}${publicRecord.macro_categoria ? ` (${publicRecord.macro_categoria})` : ''}` : '',
    publicRecord.forma_pagamento ? `pagamento ${publicRecord.forma_pagamento}` : '',
    publicRecord.vencimento ? `vencimento ${publicRecord.vencimento}` : '',
    publicRecord.competencia ? `competencia ${publicRecord.competencia}` : '',
    publicRecord.status ? `status ${publicRecord.status}` : ''
  ];
  return parts.filter(Boolean).join(', ');
}

function buildNewRecord(action, dados, today, nowIso, lookups = null) {
  const type = action === 'registrar_receita' ? 'entrada' : 'saida';
  const descricao = cleanText(dados.descricao, 'descricao');
  if (!descricao) throw badRequest('DESCRIPTION_REQUIRED', 'Informe a descricao do lancamento.');
  const amount = requireAmount(dados.valor);
  const occurredDate = optionalDate(dados.data, 'data') || today;
  const dueDate = optionalDate(dados.vencimento, 'vencimento');
  const competence = optionalCompetence(dados.competencia) || (dueDate || occurredDate).slice(0, 7);

  let status = dados.status ? String(dados.status) : (type === 'saida' ? 'Em aberto' : 'Pago');
  if (type === 'entrada' && /^recebid/i.test(status)) status = 'Pago';
  const allowed = type === 'saida' ? ['Em aberto', 'Pago'] : ['Pago', 'Pendente'];
  if (!allowed.includes(status)) throw badRequest('INVALID_STATUS', `Status permitido: ${allowed.join(' ou ')}.`);

  let categoryName = cleanText(dados.categoria, 'categoria') || undefined;
  let macroCategory = cleanText(dados.macro_categoria, 'macro_categoria') || undefined;
  let paymentMethod = type === 'saida' ? (cleanText(dados.forma_pagamento, 'forma_pagamento') || undefined) : undefined;
  if (type === 'saida' && lookups) {
    ({ category_name: categoryName, macro_category: macroCategory } = resolveExpenseCategory(lookups.catalog, categoryName, macroCategory));
    paymentMethod = resolvePaymentMethod(lookups.paymentMethods, paymentMethod);
  }

  const record = stripUndefined({
    type,
    description: descricao,
    amount,
    liquido: type === 'entrada' ? amount : undefined,
    category_name: categoryName,
    macro_category: macroCategory,
    person: cleanText(dados.pessoa, 'pessoa') || undefined,
    payment_method: paymentMethod,
    occurred_date: occurredDate,
    due_date: dueDate,
    competence,
    status,
    paid_at: type === 'saida' && status === 'Pago' ? today : undefined,
    archived: false,
    source_mode: 'manual',
    schema_version: FINANCE_RECORD_SCHEMA_VERSION,
    source_channel: SOURCE_CHANNEL,
    created_by_type: 'integration',
    created_by_id: CREATED_BY_ID,
    received_at: nowIso
  });
  assertValidRecord(record);
  return record;
}

const EDITABLE_FIELDS = Object.freeze({
  descricao: 'description',
  valor: 'amount',
  categoria: 'category_name',
  macro_categoria: 'macro_category',
  vencimento: 'due_date',
  data: 'occurred_date',
  competencia: 'competence',
  status: 'status',
  forma_pagamento: 'payment_method',
  pessoa: 'person'
});

function buildEditPatch(record, alteracoes, today, lookups = null) {
  if (!alteracoes || typeof alteracoes !== 'object' || Array.isArray(alteracoes)) {
    throw badRequest('CHANGES_REQUIRED', 'Informe as alteracoes em dados.alteracoes.');
  }
  const unknown = Object.keys(alteracoes).filter((key) => !(key in EDITABLE_FIELDS));
  if (unknown.length) throw badRequest('FIELD_NOT_EDITABLE', `Campos nao editaveis: ${unknown.join(', ')}.`);
  const patch = {};
  Object.entries(alteracoes).forEach(([key, value]) => {
    const field = EDITABLE_FIELDS[key];
    if (key === 'valor') {
      patch.amount = requireAmount(value);
      if (record.type === 'entrada') patch.liquido = patch.amount;
    } else if (key === 'vencimento' || key === 'data') {
      patch[field] = optionalDate(value, key);
    } else if (key === 'competencia') {
      patch[field] = optionalCompetence(value);
    } else {
      patch[field] = cleanText(value, key);
    }
  });
  if (record.type === 'saida' && lookups && (patch.category_name !== undefined || patch.macro_category !== undefined)) {
    const resolved = resolveExpenseCategory(lookups.catalog, patch.category_name ?? record.category_name, patch.macro_category);
    patch.category_name = resolved.category_name;
    patch.macro_category = resolved.macro_category;
  }
  if (record.type === 'saida' && lookups && patch.payment_method) {
    patch.payment_method = canonicalPaymentMethod(lookups.paymentMethods, patch.payment_method);
  }
  if (patch.status === 'Pago' && record.type === 'saida' && record.status !== 'Pago') patch.paid_at = today;
  if (patch.status && patch.status !== 'Pago' && record.type === 'saida' && record.paid_at) patch.paid_at = '';
  const cleaned = stripUndefined(patch);
  if (!Object.keys(cleaned).length) throw badRequest('CHANGES_REQUIRED', 'Nenhuma alteracao valida informada.');
  return cleaned;
}

async function loadEditableRecord(store, uid, recordId) {
  const id = String(recordId || '').trim();
  if (!id || id.length > 128 || id.includes('/')) throw badRequest('RECORD_ID_REQUIRED', 'Informe lancamento_id valido.');
  const record = await store.getRecord(uid, id);
  if (!record || record.archived === true || !['saida', 'entrada'].includes(record.type)) {
    throw new ApiError(404, 'RECORD_NOT_FOUND', 'Lancamento nao encontrado.');
  }
  return record;
}

export function createActionService({ store, now = () => new Date(), newId = () => randomUUID() }) {
  async function audit(uid, { pending, operation, recordId, before, after, resultStatus, resultCode, correlationId }) {
    try {
      await store.writeAudit(uid, {
        event_id: newId(),
        event_type: `whatsapp.${pending.acao}`,
        event_version: 1,
        occurred_at: now().toISOString(),
        actor_uid: uid,
        actor_type: 'integration',
        owner_uid: uid,
        source_channel: SOURCE_CHANNEL,
        operation,
        entity_type: 'finance_record',
        ...(recordId ? { entity_id: recordId } : {}),
        correlation_id: correlationId,
        idempotency_key_hash: fingerprint(`whatsapp:${pending.id}`).slice(0, 32),
        command_name: `whatsapp.${pending.acao}`,
        result_status: resultStatus,
        result_code: resultCode,
        before: before ? summarizeFinanceRecord(before) : null,
        after: after ? summarizeFinanceRecord(after) : null,
        schema_version: 1,
        source: CREATED_BY_ID
      });
    } catch {
      // Auditoria nao pode derrubar a operacao ja concluida; a falha aparece no log do servidor.
      console.warn(JSON.stringify({ level: 'warn', event: 'audit_write_failed', action: pending.acao }));
    }
  }

  async function loadLookups(uid) {
    const [references, records] = await Promise.all([store.listReferenceRecords(uid), store.listFinanceRecords(uid)]);
    return { catalog: buildReferenceCatalog(references), paymentMethods: buildPaymentMethods(records) };
  }

  // timeZone: fuso do usuario; define a data de "hoje" do lancamento e do pagamento.
  async function prepare(uid, body = {}, { timeZone = DEFAULT_TIME_ZONE } = {}) {
    const acao = String(body.acao || '');
    if (!ACTIONS.includes(acao)) throw badRequest('INVALID_ACTION', `Acao deve ser uma de: ${ACTIONS.join(', ')}.`);
    const dados = body.dados && typeof body.dados === 'object' ? body.dados : {};
    const current = now();
    const today = todayIn(current, timeZone);
    const nowIso = current.toISOString();
    const pending = {
      id: newId(),
      owner_uid: uid,
      acao,
      status: 'pending',
      created_at: nowIso,
      expires_at: new Date(current.getTime() + PENDING_ACTION_TTL_MS).toISOString(),
      correlation_id: String(body.correlation_id || newId())
    };

    let resumo;
    if (acao === 'registrar_despesa' || acao === 'registrar_receita') {
      const lookups = acao === 'registrar_despesa' ? await loadLookups(uid) : null;
      pending.record = buildNewRecord(acao, dados, today, nowIso, lookups);
      resumo = `Registrar ${describe(pending.record)}.`;
    } else {
      const record = await loadEditableRecord(store, uid, dados.lancamento_id);
      pending.record_id = record.id;
      pending.base_updated_at = record.updated_at || '';
      if (acao === 'marcar_pago') {
        if (record.status === 'Pago') throw new ApiError(409, 'ALREADY_PAID', 'Lancamento ja esta pago.');
        if (record.status === 'Cancelado') throw new ApiError(409, 'CANCELLED', 'Lancamento cancelado nao pode ser pago.');
        pending.patch = record.type === 'saida' ? { status: 'Pago', paid_at: today } : { status: 'Pago' };
        resumo = `Marcar como pago: ${describe(record)}.`;
      } else if (acao === 'editar') {
        const touchesReferences = dados.alteracoes && typeof dados.alteracoes === 'object' &&
          ['categoria', 'macro_categoria', 'forma_pagamento'].some((key) => key in dados.alteracoes);
        const lookups = record.type === 'saida' && touchesReferences ? await loadLookups(uid) : null;
        pending.patch = buildEditPatch(record, dados.alteracoes, today, lookups);
        const changes = Object.entries(pending.patch)
          .filter(([field]) => field !== 'paid_at' && field !== 'liquido')
          .map(([field, value]) => `${field}: ${field === 'amount' ? formatBRL(value) : value || '(vazio)'}`);
        resumo = `Editar ${describe(record)} -> ${changes.join(', ')}.`;
      } else {
        pending.patch = { archived: true, archived_at: nowIso };
        resumo = `Excluir (arquivar) ${describe(record)}.`;
      }
      const { id: _id, ...rest } = record;
      assertValidRecord({ ...rest, ...pending.patch, updated_at: nowIso });
    }

    pending.resumo = resumo;
    pending.request_fingerprint = fingerprint({ acao, record: pending.record, record_id: pending.record_id, patch: pending.patch });
    // Uma acao pendente por vez: a nova substitui as anteriores, entao o "sim" do usuario
    // so pode confirmar o ultimo resumo que ele viu.
    await store.cancelPendingActions(uid, nowIso);
    await store.savePendingAction(uid, pending.id, pending);
    return {
      status: 'aguardando_confirmacao',
      confirmation_id: pending.id,
      acao,
      resumo,
      expira_em: pending.expires_at,
      instrucao: 'Mostre o resumo ao usuario e so chame confirmar apos um "sim" explicito.'
    };
  }

  async function loadPending(uid, body) {
    const id = String(body.confirmation_id || '').trim();
    // Sem id (ou "ultima"): usa a acao pendente mais recente do proprio usuario.
    // Permite ao agente confirmar sem guardar o id entre mensagens.
    if (!id || id === 'ultima') {
      const latest = await store.getLatestPendingAction(uid);
      if (!latest || latest.owner_uid !== uid) throw new ApiError(404, 'PENDING_ACTION_NOT_FOUND', 'Nenhuma acao aguardando confirmacao.');
      return latest;
    }
    if (id.length > 128 || id.includes('/')) throw badRequest('CONFIRMATION_ID_REQUIRED', 'Informe confirmation_id valido.');
    const pending = await store.getPendingAction(uid, id);
    if (!pending || pending.owner_uid !== uid) throw new ApiError(404, 'PENDING_ACTION_NOT_FOUND', 'Confirmacao nao encontrada.');
    return pending;
  }

  async function confirm(uid, body = {}) {
    const pending = await loadPending(uid, body);
    if (pending.status === 'executed') return { status: 'ja_executado', replay: true, ...pending.result };
    if (pending.status === 'cancelled') throw new ApiError(409, 'PENDING_ACTION_CANCELLED', 'Esta acao foi cancelada.');
    if (pending.status === 'failed') throw new ApiError(409, 'PENDING_ACTION_FAILED', 'Esta acao falhou; prepare novamente.');
    const current = now();
    if (pending.expires_at <= current.toISOString()) {
      await store.updatePendingAction(uid, pending.id, { status: 'expired' });
      throw new ApiError(410, 'PENDING_ACTION_EXPIRED', 'A confirmacao expirou; prepare a acao novamente.');
    }

    const nowIso = current.toISOString();
    const idempotencyKey = `whatsapp:${pending.id}`;
    const receiptId = `whatsapp_${pending.id}`;
    // Uma reserva 'processing' antiga indica que o processo caiu no meio: pode ser retomada.
    const staleBeforeIso = new Date(current.getTime() - STALE_PROCESSING_MS).toISOString();
    const reservation = await store.reserveReceipt(uid, receiptId, {
      owner_uid: uid,
      command_name: `whatsapp.${pending.acao}`,
      source_channel: SOURCE_CHANNEL,
      idempotency_key: idempotencyKey,
      request_fingerprint: pending.request_fingerprint,
      status: 'processing',
      correlation_id: pending.correlation_id,
      created_at: nowIso,
      schema_version: 1
    }, { staleBeforeIso });
    if (!reservation.created) {
      if (reservation.existing?.status === 'completed') {
        const latest = await store.getPendingAction(uid, pending.id);
        return { status: 'ja_executado', replay: true, ...(latest?.result || {}) };
      }
      throw new ApiError(409, 'ACTION_IN_PROGRESS', 'Esta acao ja esta sendo processada.');
    }

    let recordId = pending.record_id;
    let before = null;
    let after = null;
    const operation = pending.record ? 'create' : (pending.acao === 'excluir' ? 'archive' : 'update');
    try {
      if (pending.record) {
        after = {
          ...pending.record,
          idempotency_key: idempotencyKey,
          correlation_id: pending.correlation_id,
          created_at: nowIso,
          updated_at: nowIso,
          processed_at: nowIso
        };
        // Id fixo: numa retomada o lancamento ja criado e reaproveitado, nunca duplicado.
        recordId = await store.createRecord(uid, after, { id: receiptId });
        const stored = reservation.reclaimed ? await store.getRecord(uid, recordId) : null;
        after = { ...(stored || after), id: recordId };
      } else {
        before = await store.getRecord(uid, pending.record_id);
        const alreadyApplied = reservation.reclaimed && before && before.correlation_id === pending.correlation_id;
        if (alreadyApplied) {
          // Retomada: a alteracao ja foi gravada antes da queda.
          after = before;
        } else {
          if (!before || before.archived === true) throw new ApiError(409, 'RECORD_CHANGED', 'O lancamento nao existe mais.');
          if ((before.updated_at || '') !== (pending.base_updated_at || '')) {
            throw new ApiError(409, 'RECORD_CHANGED', 'O lancamento mudou depois do resumo; prepare novamente.');
          }
          const patch = { ...pending.patch, updated_at: nowIso, processed_at: nowIso, correlation_id: pending.correlation_id };
          const { id: _id, ...rest } = before;
          assertValidRecord({ ...rest, ...patch });
          await store.updateRecord(uid, pending.record_id, patch);
          after = { ...before, ...patch };
        }
      }
    } catch (error) {
      const code = error instanceof ApiError ? error.code : 'INTERNAL_ERROR';
      await store.completeReceipt(uid, receiptId, { status: 'failed', failed_at: now().toISOString(), result_code: code });
      await store.updatePendingAction(uid, pending.id, { status: 'failed', failed_code: code });
      await audit(uid, { pending, operation, recordId, before, after: null, resultStatus: error?.status === 409 ? 'conflict' : 'failure', resultCode: code, correlationId: pending.correlation_id });
      throw error;
    }

    const result = {
      acao: pending.acao,
      lancamento: toPublicRecord(after),
      mensagem: pending.acao === 'excluir' ? 'Lancamento arquivado.' : 'Acao concluida.'
    };
    await store.completeReceipt(uid, receiptId, {
      status: 'completed',
      completed_at: now().toISOString(),
      entity_id: recordId,
      result_code: 'OK'
    });
    await store.updatePendingAction(uid, pending.id, { status: 'executed', executed_at: nowIso, result });
    await audit(uid, { pending, operation, recordId, before, after, resultStatus: 'success', resultCode: 'OK', correlationId: pending.correlation_id });
    return { status: 'executado', replay: false, ...result };
  }

  async function cancel(uid, body = {}) {
    const pending = await loadPending(uid, body);
    if (pending.status !== 'pending') {
      return { status: pending.status === 'cancelled' ? 'cancelado' : pending.status, confirmation_id: pending.id };
    }
    await store.updatePendingAction(uid, pending.id, { status: 'cancelled', cancelled_at: now().toISOString() });
    return { status: 'cancelado', confirmation_id: pending.id };
  }

  return { prepare, confirm, cancel };
}
