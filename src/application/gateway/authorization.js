import { APPLICATION_RESULT_CODES, createErrorResult, createSuccessResult } from './applicationResult.js';

const FINANCIAL_COMMANDS = new Set([
  'CreateExpenseCommand',
  'UpdateExpenseCommand',
  'MarkExpenseAsPaidCommand',
  'ArchiveExpenseCommand',
  'DeleteExpenseCommand',
  'CreateIncomeCommand',
  'ConsolidateMonthlyIncomeCommand',
  'CreateInstallmentSeriesCommand',
  'CreateRecurrenceSeriesCommand',
  'CreateHourEntryCommand',
  'UpdateHourEntryCommand'
]);

function hasPermission(context = {}, permission = '') {
  return Array.isArray(context.permissions) && context.permissions.includes(permission);
}

export function normalizeApplicationAuthContext(context = {}) {
  const actorType = context.actorType || context.type || 'user';
  const actorUid = context.actorUid || context.uid || '';
  return {
    actorUid,
    actorType,
    role: context.role || (actorType === 'admin' ? 'admin' : 'user'),
    accountStatus: context.accountStatus || 'active',
    ownerUid: context.ownerUid || actorUid,
    permissions: Array.isArray(context.permissions) ? context.permissions : [],
    trusted: context.trusted === true
  };
}

export function authorizeApplicationAction(context = {}, action = '', resource = {}) {
  const auth = normalizeApplicationAuthContext(context);
  if (!auth.actorUid && auth.actorType !== 'system') {
    return createErrorResult({
      code: APPLICATION_RESULT_CODES.FORBIDDEN,
      message: 'Ator autenticado obrigatorio.'
    });
  }

  if (FINANCIAL_COMMANDS.has(action) && auth.accountStatus !== 'active') {
    return createErrorResult({
      code: APPLICATION_RESULT_CODES.FORBIDDEN,
      message: 'Usuario sem status ativo nao pode executar comandos financeiros.'
    });
  }

  if (auth.actorType === 'integration') {
    if (!auth.trusted && !hasPermission(auth, 'trusted_integration')) {
      return createErrorResult({
        code: APPLICATION_RESULT_CODES.FORBIDDEN,
        message: 'Integracao exige contexto confiavel.'
      });
    }
    return createSuccessResult({ message: 'Autorizado.' });
  }

  if (auth.actorType === 'system') {
    return createSuccessResult({ message: 'Autorizado.' });
  }

  const isAdmin = auth.actorType === 'admin' || auth.role === 'admin' || hasPermission(auth, 'admin');
  const resourceOwner = resource.ownerUid || auth.ownerUid;
  if (isAdmin) {
    return createSuccessResult({ message: 'Autorizado.' });
  }

  if (resourceOwner && resourceOwner !== auth.ownerUid && resourceOwner !== auth.actorUid) {
    return createErrorResult({
      code: APPLICATION_RESULT_CODES.FORBIDDEN,
      message: 'Usuario ativo comum opera apenas dados proprios.'
    });
  }

  return createSuccessResult({ message: 'Autorizado.' });
}
