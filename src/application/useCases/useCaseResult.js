import { APPLICATION_RESULT_CODES, createErrorResult, createSuccessResult } from '../gateway/applicationResult.js';

export function validationErrorResult(validation = {}, message = 'Payload financeiro invalido.') {
  return createErrorResult({
    code: APPLICATION_RESULT_CODES.VALIDATION_ERROR,
    message,
    validationErrors: validation.errors || validation.validationErrors || []
  });
}

export function mapRepositoryResult(result = {}, message = 'Operacao concluida.') {
  if (result?.ok || result?.isOk || result?.success) {
    return createSuccessResult({
      message,
      entityId: result.id || result.entityId || '',
      entityIds: result.ids || result.entityIds || [],
      data: result.data ?? result.record ?? (Array.isArray(result.items) ? result.items : null)
    });
  }

  const codeMap = {
    REPOSITORY_NOT_FOUND: APPLICATION_RESULT_CODES.NOT_FOUND,
    REPOSITORY_PERMISSION_DENIED: APPLICATION_RESULT_CODES.FORBIDDEN,
    REPOSITORY_CONFLICT: APPLICATION_RESULT_CODES.CONFLICT,
    REPOSITORY_VALIDATION_ERROR: APPLICATION_RESULT_CODES.VALIDATION_ERROR,
    REPOSITORY_UNAVAILABLE: APPLICATION_RESULT_CODES.PERSISTENCE_ERROR,
    REPOSITORY_TIMEOUT: APPLICATION_RESULT_CODES.PERSISTENCE_ERROR,
    REPOSITORY_UNKNOWN_ERROR: APPLICATION_RESULT_CODES.PERSISTENCE_ERROR
  };

  return createErrorResult({
    code: codeMap[result?.code] || (result?.error === 'NOT_FOUND' ? APPLICATION_RESULT_CODES.NOT_FOUND : APPLICATION_RESULT_CODES.PERSISTENCE_ERROR),
    message: result?.message || result?.error || 'Erro de persistencia.',
    validationErrors: result?.validationErrors || []
  });
}

export function requireRepository(repository, label = 'Repository') {
  if (!repository) {
    return createErrorResult({
      code: APPLICATION_RESULT_CODES.CONFIGURATION_ERROR,
      message: `${label} nao configurado.`
    });
  }
  return null;
}
