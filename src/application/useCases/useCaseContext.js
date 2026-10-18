import { APPLICATION_RESULT_CODES, createErrorResult } from '../gateway/applicationResult.js';
import { normalizeOperationMetadata } from '../gateway/operationMetadata.js';

export function createUseCaseContext({ context = {}, envelope = {}, now = () => new Date().toISOString() } = {}) {
  const source = envelope.source || {};
  const actor = envelope.actor || {};
  const actorUid = context.actorUid || actor.id || '';
  const actorType = context.actorType || actor.type || 'user';
  return {
    actorUid,
    actorType,
    role: context.role || actor.role || (actorType === 'admin' ? 'admin' : 'user'),
    accountStatus: context.accountStatus || 'active',
    ownerUid: context.ownerUid || actorUid,
    permissions: Array.isArray(context.permissions) ? context.permissions : [],
    trusted: context.trusted === true,
    sourceChannel: context.sourceChannel || source.channel || '',
    sourceReferenceId: context.sourceReferenceId || source.referenceId || '',
    correlationId: context.correlationId || envelope.correlationId || '',
    idempotencyKey: context.idempotencyKey || envelope.idempotencyKey || '',
    requestedAt: context.requestedAt || envelope.requestedAt || now(),
    processedAt: context.processedAt || envelope.processedAt || ''
  };
}

export function validateFinancialUseCaseContext(context = {}) {
  if (!context.actorUid && context.actorType !== 'system') {
    return createErrorResult({
      code: APPLICATION_RESULT_CODES.FORBIDDEN,
      message: 'Ator autenticado obrigatorio.'
    });
  }
  if (context.accountStatus !== 'active') {
    return createErrorResult({
      code: APPLICATION_RESULT_CODES.FORBIDDEN,
      message: 'Usuario sem status ativo nao pode executar operacoes financeiras.'
    });
  }
  if (!context.ownerUid && context.actorType !== 'system') {
    return createErrorResult({
      code: APPLICATION_RESULT_CODES.FORBIDDEN,
      message: 'ownerUid autorizado obrigatorio.'
    });
  }
  return null;
}

export function actorMetadata(context = {}) {
  const metadata = normalizeOperationMetadata({}, context);
  return Object.fromEntries(Object.entries({
    owner_uid: context.ownerUid || context.actorUid || '',
    ...metadata
  }).filter(([, value]) => value !== ''));
}

export function assertOwnRecord(record = {}, context = {}, message = 'Registro nao pertence ao usuario autorizado.') {
  const owner = context.ownerUid || context.actorUid || '';
  if (!record || !owner || !record.owner_uid || record.owner_uid === owner || record.shared_scope === 'global') return null;
  return createErrorResult({
    code: APPLICATION_RESULT_CODES.FORBIDDEN,
    message
  });
}
