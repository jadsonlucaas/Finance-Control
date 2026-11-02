export const PROFILE_ACCESS_ERROR = Object.freeze({
  QUOTA_EXHAUSTED: 'PROFILE_QUOTA_EXHAUSTED',
  SERVICE_UNAVAILABLE: 'PROFILE_SERVICE_UNAVAILABLE',
  PERMISSION_DENIED: 'PROFILE_PERMISSION_DENIED',
  SESSION_INVALID: 'PROFILE_SESSION_INVALID',
  NOT_FOUND: 'PROFILE_NOT_FOUND',
  CLAIMS_FAILED: 'AUTH_CLAIMS_FAILED',
  LOAD_FAILED: 'PROFILE_LOAD_FAILED'
});

const UI_MESSAGES = Object.freeze({
  [PROFILE_ACCESS_ERROR.QUOTA_EXHAUSTED]: 'Seu login foi realizado, mas o serviço de dados atingiu temporariamente o limite de uso. Tente novamente mais tarde.',
  [PROFILE_ACCESS_ERROR.SERVICE_UNAVAILABLE]: 'Seu login foi realizado, mas o serviço de dados está temporariamente indisponível.',
  [PROFILE_ACCESS_ERROR.PERMISSION_DENIED]: 'Seu login foi realizado, mas sua conta não possui permissão para acessar os dados.',
  [PROFILE_ACCESS_ERROR.SESSION_INVALID]: 'Sua sessão expirou. Entre novamente.',
  [PROFILE_ACCESS_ERROR.NOT_FOUND]: 'Seu login foi realizado, mas seu perfil não foi encontrado.',
  [PROFILE_ACCESS_ERROR.CLAIMS_FAILED]: 'Seu login foi realizado, mas não foi possível validar sua sessão.',
  [PROFILE_ACCESS_ERROR.LOAD_FAILED]: 'Seu login foi realizado, mas não foi possível carregar seu perfil.'
});

function firebaseCode(error) {
  return String(error?.code || error?.name || '').toLowerCase().replace(/^firestore\//, '');
}

export function normalizeProfileAccessError(error, { stage = 'profile' } = {}) {
  const sourceCode = firebaseCode(error);
  let code;
  if (stage === 'claims') code = PROFILE_ACCESS_ERROR.CLAIMS_FAILED;
  else if (sourceCode.endsWith('resource-exhausted')) code = PROFILE_ACCESS_ERROR.QUOTA_EXHAUSTED;
  else if (sourceCode.endsWith('unavailable')) code = PROFILE_ACCESS_ERROR.SERVICE_UNAVAILABLE;
  else if (sourceCode.endsWith('permission-denied')) code = PROFILE_ACCESS_ERROR.PERMISSION_DENIED;
  else if (sourceCode.endsWith('unauthenticated')) code = PROFILE_ACCESS_ERROR.SESSION_INVALID;
  else if (sourceCode.endsWith('not-found')) code = PROFILE_ACCESS_ERROR.NOT_FOUND;
  else code = PROFILE_ACCESS_ERROR.LOAD_FAILED;

  const normalized = new Error(UI_MESSAGES[code]);
  normalized.name = 'ProfileAccessError';
  normalized.code = code;
  normalized.stage = stage;
  normalized.sourceCode = sourceCode || 'unknown';
  normalized.cause = error;
  return normalized;
}

export function getProfileAccessErrorMessage(error) {
  return UI_MESSAGES[error?.code] || UI_MESSAGES[PROFILE_ACCESS_ERROR.LOAD_FAILED];
}

export function getProfileAccessTelemetryEvent(error) {
  const suffix = {
    [PROFILE_ACCESS_ERROR.QUOTA_EXHAUSTED]: 'resource_exhausted',
    [PROFILE_ACCESS_ERROR.SERVICE_UNAVAILABLE]: 'unavailable',
    [PROFILE_ACCESS_ERROR.PERMISSION_DENIED]: 'permission_denied'
  }[error?.code] || 'failure';
  return `profile.load.${suffix}`;
}
