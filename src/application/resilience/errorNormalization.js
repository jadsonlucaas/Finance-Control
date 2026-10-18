import {
  APPLICATION_ERROR_CATEGORIES,
  APPLICATION_ERROR_CODES,
  APPLICATION_ERROR_SEVERITIES,
  createApplicationError,
  isApplicationError
} from './applicationError.js';
import { REPOSITORY_ERROR_CODES } from '../repositories/repositoryResult.js';

const FIREBASE_CODE_MAP = Object.freeze({
  'permission-denied': [APPLICATION_ERROR_CATEGORIES.AUTHORIZATION, APPLICATION_ERROR_CODES.AUTHORIZATION_DENIED, false],
  unauthenticated: [APPLICATION_ERROR_CATEGORIES.AUTHENTICATION, APPLICATION_ERROR_CODES.AUTHENTICATION_REQUIRED, false],
  unavailable: [APPLICATION_ERROR_CATEGORIES.NETWORK, APPLICATION_ERROR_CODES.NETWORK_UNAVAILABLE, true],
  'deadline-exceeded': [APPLICATION_ERROR_CATEGORIES.TIMEOUT, APPLICATION_ERROR_CODES.OPERATION_TIMEOUT, true],
  'already-exists': [APPLICATION_ERROR_CATEGORIES.CONFLICT, APPLICATION_ERROR_CODES.CONFLICT_DETECTED, false],
  'not-found': [APPLICATION_ERROR_CATEGORIES.NOT_FOUND, APPLICATION_ERROR_CODES.RESOURCE_NOT_FOUND, false],
  aborted: [APPLICATION_ERROR_CATEGORIES.PERSISTENCE, APPLICATION_ERROR_CODES.PERSISTENCE_FAILED, true],
  'resource-exhausted': [APPLICATION_ERROR_CATEGORIES.PERSISTENCE, APPLICATION_ERROR_CODES.PERSISTENCE_FAILED, true],
  'failed-precondition': [APPLICATION_ERROR_CATEGORIES.BUSINESS_RULE, APPLICATION_ERROR_CODES.BUSINESS_RULE_BLOCKED, false]
});

const REPOSITORY_CODE_MAP = Object.freeze({
  [REPOSITORY_ERROR_CODES.NOT_FOUND]: [APPLICATION_ERROR_CATEGORIES.NOT_FOUND, APPLICATION_ERROR_CODES.RESOURCE_NOT_FOUND, false],
  [REPOSITORY_ERROR_CODES.PERMISSION_DENIED]: [APPLICATION_ERROR_CATEGORIES.AUTHORIZATION, APPLICATION_ERROR_CODES.AUTHORIZATION_DENIED, false],
  [REPOSITORY_ERROR_CODES.CONFLICT]: [APPLICATION_ERROR_CATEGORIES.CONFLICT, APPLICATION_ERROR_CODES.CONFLICT_DETECTED, false],
  [REPOSITORY_ERROR_CODES.VALIDATION_ERROR]: [APPLICATION_ERROR_CATEGORIES.VALIDATION, APPLICATION_ERROR_CODES.VALIDATION_FAILED, false],
  [REPOSITORY_ERROR_CODES.UNAVAILABLE]: [APPLICATION_ERROR_CATEGORIES.NETWORK, APPLICATION_ERROR_CODES.NETWORK_UNAVAILABLE, true],
  [REPOSITORY_ERROR_CODES.TIMEOUT]: [APPLICATION_ERROR_CATEGORIES.TIMEOUT, APPLICATION_ERROR_CODES.OPERATION_TIMEOUT, true],
  [REPOSITORY_ERROR_CODES.UNKNOWN_ERROR]: [APPLICATION_ERROR_CATEGORIES.UNKNOWN, APPLICATION_ERROR_CODES.UNKNOWN_ERROR, false]
});

const USER_MESSAGES = Object.freeze({
  [APPLICATION_ERROR_CATEGORIES.VALIDATION]: 'Revise os campos destacados e tente novamente.',
  [APPLICATION_ERROR_CATEGORIES.BUSINESS_RULE]: 'A operacao nao pode ser concluida com os dados atuais.',
  [APPLICATION_ERROR_CATEGORIES.AUTHENTICATION]: 'Faça login novamente para continuar.',
  [APPLICATION_ERROR_CATEGORIES.AUTHORIZATION]: 'Voce nao tem permissao para executar esta acao.',
  [APPLICATION_ERROR_CATEGORIES.NOT_FOUND]: 'O registro solicitado nao foi encontrado.',
  [APPLICATION_ERROR_CATEGORIES.CONFLICT]: 'A operacao entrou em conflito com dados ja existentes.',
  [APPLICATION_ERROR_CATEGORIES.IDEMPOTENCY]: 'Esta operacao ja esta em processamento ou foi concluida.',
  [APPLICATION_ERROR_CATEGORIES.NETWORK]: 'Falha de conexao. Verifique a internet e tente novamente.',
  [APPLICATION_ERROR_CATEGORIES.TIMEOUT]: 'A operacao demorou demais. Tente novamente com segurança quando disponivel.',
  [APPLICATION_ERROR_CATEGORIES.OFFLINE]: 'Voce esta offline. Os dados nao foram salvos.',
  [APPLICATION_ERROR_CATEGORIES.PERSISTENCE]: 'Nao foi possivel salvar ou consultar os dados agora.',
  [APPLICATION_ERROR_CATEGORIES.CONFIGURATION]: 'Existe uma configuracao pendente para concluir esta operacao.',
  [APPLICATION_ERROR_CATEGORIES.LAZY_LOAD]: 'Nao foi possivel carregar uma parte do aplicativo. Recarregue ou tente novamente.',
  [APPLICATION_ERROR_CATEGORIES.UNKNOWN]: 'Nao foi possivel concluir a operacao.'
});

function rawCode(error = {}) {
  return String(error?.code || error?.cause?.code || error?.message || error || '').replace(/^FirebaseError:\s*/i, '').toLowerCase();
}

function normalizeFirebaseCode(code = '') {
  return String(code).replace(/^firestore\//, '').replace(/^firebase\//, '').replace(/^auth\//, '');
}

export function normalizeFirebaseError(error, context = {}) {
  const code = normalizeFirebaseCode(rawCode(error));
  const entry = FIREBASE_CODE_MAP[code] ||
    Object.entries(FIREBASE_CODE_MAP).find(([key]) => code.includes(key))?.[1] ||
    null;
  const [category, mappedCode, retryable] = entry || [APPLICATION_ERROR_CATEGORIES.UNKNOWN, APPLICATION_ERROR_CODES.UNKNOWN_ERROR, false];
  return createApplicationError({
    code: mappedCode,
    category,
    severity: category === APPLICATION_ERROR_CATEGORIES.AUTHORIZATION ? APPLICATION_ERROR_SEVERITIES.WARNING : APPLICATION_ERROR_SEVERITIES.ERROR,
    message: error?.message || String(error || ''),
    userMessage: USER_MESSAGES[category],
    retryable,
    operation: context.operation,
    correlationId: context.correlationId,
    causeCode: error?.code || code,
    details: { source: 'firebase', ...context.details },
    cause: error,
    occurredAt: context.occurredAt
  });
}

export function normalizeRepositoryError(error, context = {}) {
  if (isApplicationError(error)) return error;
  const code = error?.code || '';
  const entry = REPOSITORY_CODE_MAP[code];
  if (!entry) return normalizeApplicationError(error, { ...context, details: { source: 'repository', ...context.details } });
  const [category, mappedCode, retryable] = entry;
  return createApplicationError({
    code: mappedCode,
    category,
    severity: category === APPLICATION_ERROR_CATEGORIES.AUTHORIZATION ? APPLICATION_ERROR_SEVERITIES.WARNING : APPLICATION_ERROR_SEVERITIES.ERROR,
    message: error?.message || code,
    userMessage: USER_MESSAGES[category],
    retryable,
    operation: context.operation,
    correlationId: context.correlationId,
    causeCode: code,
    details: { validationErrors: error?.validationErrors || [], ...context.details },
    cause: error,
    occurredAt: context.occurredAt
  });
}

export function normalizeNetworkError(error, context = {}) {
  const code = rawCode(error);
  const offline = context.offline === true || code.includes('offline');
  const timeout = code.includes('timeout') || code.includes('deadline');
  const category = offline
    ? APPLICATION_ERROR_CATEGORIES.OFFLINE
    : timeout
      ? APPLICATION_ERROR_CATEGORIES.TIMEOUT
      : APPLICATION_ERROR_CATEGORIES.NETWORK;
  return createApplicationError({
    code: offline
      ? APPLICATION_ERROR_CODES.CLIENT_OFFLINE
      : timeout
        ? APPLICATION_ERROR_CODES.OPERATION_TIMEOUT
        : APPLICATION_ERROR_CODES.NETWORK_UNAVAILABLE,
    category,
    severity: APPLICATION_ERROR_SEVERITIES.WARNING,
    message: error?.message || String(error || ''),
    userMessage: USER_MESSAGES[category],
    retryable: true,
    operation: context.operation,
    correlationId: context.correlationId,
    causeCode: error?.code || '',
    details: context.details,
    cause: error,
    occurredAt: context.occurredAt
  });
}

export function normalizeLazyLoadError(error, context = {}) {
  return createApplicationError({
    code: APPLICATION_ERROR_CODES.LAZY_LOAD_FAILED,
    category: APPLICATION_ERROR_CATEGORIES.LAZY_LOAD,
    severity: APPLICATION_ERROR_SEVERITIES.ERROR,
    message: error?.message || String(error || ''),
    userMessage: USER_MESSAGES[APPLICATION_ERROR_CATEGORIES.LAZY_LOAD],
    retryable: true,
    operation: context.operation || 'lazy_load',
    correlationId: context.correlationId,
    causeCode: error?.code || '',
    details: context.details,
    cause: error,
    occurredAt: context.occurredAt
  });
}

export function normalizeApplicationError(error, context = {}) {
  if (isApplicationError(error)) return error;
  const code = rawCode(error);
  if (code.includes('permission') || code.includes('denied') || code.includes('forbidden')) {
    return createApplicationError({
      code: APPLICATION_ERROR_CODES.AUTHORIZATION_DENIED,
      category: APPLICATION_ERROR_CATEGORIES.AUTHORIZATION,
      severity: APPLICATION_ERROR_SEVERITIES.WARNING,
      message: error?.message || String(error || ''),
      userMessage: USER_MESSAGES[APPLICATION_ERROR_CATEGORIES.AUTHORIZATION],
      operation: context.operation,
      correlationId: context.correlationId,
      causeCode: error?.code || '',
      details: context.details,
      cause: error,
      occurredAt: context.occurredAt
    });
  }
  if (code.includes('auth_required') || code.includes('unauthenticated')) return normalizeFirebaseError({ ...error, code: 'unauthenticated' }, context);
  if (code.includes('not_found') || code.includes('not-found') || code.includes('not found')) return normalizeFirebaseError({ ...error, code: 'not-found' }, context);
  if (code.includes('conflict') || code.includes('already')) return normalizeFirebaseError({ ...error, code: 'already-exists' }, context);
  if (code.includes('validation') || code.includes('contract')) {
    return createApplicationError({
      code: APPLICATION_ERROR_CODES.VALIDATION_FAILED,
      category: APPLICATION_ERROR_CATEGORIES.VALIDATION,
      severity: APPLICATION_ERROR_SEVERITIES.WARNING,
      message: error?.message || String(error || ''),
      userMessage: USER_MESSAGES[APPLICATION_ERROR_CATEGORIES.VALIDATION],
      operation: context.operation,
      correlationId: context.correlationId,
      causeCode: error?.code || '',
      details: { validationErrors: error?.validation?.errors || error?.validationErrors || [], ...context.details },
      cause: error,
      occurredAt: context.occurredAt
    });
  }
  if (code.includes('unavailable') || code.includes('network') || code.includes('fetch failed')) return normalizeNetworkError(error, context);
  if (code.includes('timeout') || code.includes('deadline')) return normalizeNetworkError(error, context);
  if (code.includes('chunk') || code.includes('dynamically imported') || code.includes('load_failed') || code.includes('library_not_ready')) {
    return normalizeLazyLoadError(error, context);
  }
  return createApplicationError({
    code: APPLICATION_ERROR_CODES.UNKNOWN_ERROR,
    category: APPLICATION_ERROR_CATEGORIES.UNKNOWN,
    severity: APPLICATION_ERROR_SEVERITIES.ERROR,
    message: error?.message || String(error || ''),
    userMessage: USER_MESSAGES[APPLICATION_ERROR_CATEGORIES.UNKNOWN],
    retryable: false,
    operation: context.operation,
    correlationId: context.correlationId,
    causeCode: error?.code || '',
    details: context.details,
    cause: error,
    occurredAt: context.occurredAt
  });
}

export function userMessageForError(error) {
  return isApplicationError(error) ? error.userMessage : normalizeApplicationError(error).userMessage;
}
