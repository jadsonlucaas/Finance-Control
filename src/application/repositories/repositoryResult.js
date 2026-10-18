export const REPOSITORY_ERROR_CODES = Object.freeze({
  NOT_FOUND: 'REPOSITORY_NOT_FOUND',
  PERMISSION_DENIED: 'REPOSITORY_PERMISSION_DENIED',
  CONFLICT: 'REPOSITORY_CONFLICT',
  VALIDATION_ERROR: 'REPOSITORY_VALIDATION_ERROR',
  UNAVAILABLE: 'REPOSITORY_UNAVAILABLE',
  TIMEOUT: 'REPOSITORY_TIMEOUT',
  UNKNOWN_ERROR: 'REPOSITORY_UNKNOWN_ERROR'
});

export class RepositoryError extends Error {
  constructor(code, message, options = {}) {
    super(message || code);
    this.name = 'RepositoryError';
    this.code = code || REPOSITORY_ERROR_CODES.UNKNOWN_ERROR;
    this.cause = options.cause;
    this.validationErrors = Array.isArray(options.validationErrors) ? options.validationErrors : [];
  }
}

export function createRepositoryResult(input = {}) {
  return {
    ok: input.ok === true,
    code: input.code || '',
    message: input.message || '',
    id: input.id || '',
    ids: Array.isArray(input.ids) ? input.ids : [],
    count: Number.isInteger(input.count) ? input.count : (Array.isArray(input.ids) ? input.ids.length : 0),
    data: input.data ?? null,
    items: Array.isArray(input.items) ? input.items : [],
    nextCursor: input.nextCursor || '',
    hasMore: input.hasMore === true,
    totalKnown: Number.isInteger(input.totalKnown) ? input.totalKnown : undefined,
    pageInfo: input.pageInfo || null,
    validationErrors: Array.isArray(input.validationErrors) ? input.validationErrors : [],
    cause: input.cause
  };
}

export function repositoryOk(input = {}) {
  return createRepositoryResult({
    ...input,
    ok: true
  });
}

export function repositoryFailure(input = {}) {
  return createRepositoryResult({
    ...input,
    ok: false,
    code: input.code || REPOSITORY_ERROR_CODES.UNKNOWN_ERROR,
    message: input.message || 'Erro de repositorio.'
  });
}

export function cloneRepositoryData(value) {
  if (value === null || value === undefined) return value;
  return JSON.parse(JSON.stringify(value));
}

export function mapUnknownRepositoryError(error) {
  if (error instanceof RepositoryError) {
    return repositoryFailure({
      code: error.code,
      message: error.message,
      validationErrors: error.validationErrors,
      cause: error.cause || error
    });
  }

  const rawCode = String(error?.code || error?.message || '').toLowerCase();
  if (rawCode.includes('permission') || rawCode.includes('denied')) {
    return repositoryFailure({
      code: REPOSITORY_ERROR_CODES.PERMISSION_DENIED,
      message: 'Permissao negada pelo repositorio.',
      cause: error
    });
  }
  if (rawCode.includes('not_found') || rawCode.includes('not-found') || rawCode.includes('not found')) {
    return repositoryFailure({
      code: REPOSITORY_ERROR_CODES.NOT_FOUND,
      message: 'Registro nao encontrado.',
      cause: error
    });
  }
  if (rawCode.includes('unavailable')) {
    return repositoryFailure({
      code: REPOSITORY_ERROR_CODES.UNAVAILABLE,
      message: 'Repositorio indisponivel.',
      cause: error
    });
  }
  if (rawCode.includes('timeout') || rawCode.includes('deadline')) {
    return repositoryFailure({
      code: REPOSITORY_ERROR_CODES.TIMEOUT,
      message: 'Tempo esgotado no repositorio.',
      cause: error
    });
  }

  return repositoryFailure({
    code: REPOSITORY_ERROR_CODES.UNKNOWN_ERROR,
    message: error?.message || 'Erro inesperado no repositorio.',
    cause: error
  });
}

export function legacyResultToRepositoryResult(result = {}, fallbackData = null) {
  if (result?.ok === true || result?.isOk === true || result?.success === true) {
    const data = result.data ?? result.record ?? fallbackData;
    return repositoryOk({
      id: result.id || result.entityId || data?.id || '',
      ids: result.ids || result.entityIds || [],
      count: result.count,
      data,
      items: Array.isArray(result.items) ? result.items : (Array.isArray(data) ? data : [])
    });
  }

  const validationErrors = result?.validationErrors || result?.errors || [];
  const error = String(result?.error || result?.code || '').toUpperCase();
  const code = error.includes('NOT_FOUND')
    ? REPOSITORY_ERROR_CODES.NOT_FOUND
    : error.includes('PERMISSION') || error.includes('DENIED')
      ? REPOSITORY_ERROR_CODES.PERMISSION_DENIED
      : error.includes('CONFLICT') || error.includes('ALREADY_EXISTS') || error.includes('EXISTS')
        ? REPOSITORY_ERROR_CODES.CONFLICT
        : error.includes('VALIDATION') || error.includes('CONTRACT')
          ? REPOSITORY_ERROR_CODES.VALIDATION_ERROR
          : REPOSITORY_ERROR_CODES.UNKNOWN_ERROR;

  return repositoryFailure({
    code,
    message: result?.error || result?.message || 'Erro de persistencia.',
    validationErrors,
    cause: result?.cause
  });
}
