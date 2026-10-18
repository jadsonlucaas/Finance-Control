export const APPLICATION_RESULT_CODES = Object.freeze({
  OK: 'OK',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  IDEMPOTENT_REPLAY: 'IDEMPOTENT_REPLAY',
  PERSISTENCE_ERROR: 'PERSISTENCE_ERROR',
  BUSINESS_RULE_ERROR: 'BUSINESS_RULE_ERROR',
  CONFIGURATION_ERROR: 'CONFIGURATION_ERROR'
});

export function createApplicationResult(input = {}) {
  const success = input.success === true;
  return {
    success,
    code: input.code || (success ? APPLICATION_RESULT_CODES.OK : APPLICATION_RESULT_CODES.BUSINESS_RULE_ERROR),
    message: input.message || (success ? 'Operacao concluida.' : 'Operacao nao concluida.'),
    entityId: input.entityId || '',
    entityIds: Array.isArray(input.entityIds) ? input.entityIds : [],
    data: input.data ?? null,
    warnings: Array.isArray(input.warnings) ? input.warnings : [],
    validationErrors: Array.isArray(input.validationErrors) ? input.validationErrors : [],
    applicationError: input.applicationError || null,
    idempotentReplay: input.idempotentReplay === true,
    correlationId: input.correlationId || '',
    processedAt: input.processedAt || ''
  };
}

export function createSuccessResult(input = {}) {
  return createApplicationResult({
    ...input,
    success: true,
    code: input.code || APPLICATION_RESULT_CODES.OK
  });
}

export function createErrorResult(input = {}) {
  return createApplicationResult({
    ...input,
    success: false,
    code: input.code || APPLICATION_RESULT_CODES.BUSINESS_RULE_ERROR
  });
}

export function normalizeApplicationResult(result = {}, context = {}) {
  const normalized = createApplicationResult({
    ...result,
    success: result.success === true || result.isOk === true,
    code: result.code || (result.isOk === true ? APPLICATION_RESULT_CODES.OK : undefined),
    message: result.message || result.error || '',
    entityId: result.entityId || result.id || '',
    entityIds: result.entityIds || (Array.isArray(result.ids) ? result.ids : []),
    data: result.data ?? null,
    warnings: result.warnings || [],
    validationErrors: result.validationErrors || result.errors || [],
    applicationError: result.applicationError || null,
    correlationId: result.correlationId || context.correlationId || '',
    processedAt: result.processedAt || context.processedAt || ''
  });
  if (!normalized.processedAt) normalized.processedAt = context.processedAt || '';
  return normalized;
}
