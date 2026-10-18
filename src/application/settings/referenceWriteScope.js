export const REFERENCE_WRITE_SCOPE_ERRORS = Object.freeze({
  SCOPE_REQUIRED: 'SETTINGS_REFERENCE_SCOPE_REQUIRED',
  INVALID_SCOPE: 'SETTINGS_REFERENCE_SCOPE_INVALID',
  PERSONAL_FORBIDDEN: 'SETTINGS_PERSONAL_REFERENCE_FORBIDDEN',
  SHARED_FORBIDDEN: 'SETTINGS_SHARED_REFERENCE_FORBIDDEN'
});

function canManageSharedReferences(permissions = {}) {
  return permissions.canManageSharedReferences === true || permissions.isAdmin === true;
}

function canManagePersonalReferences(permissions = {}) {
  return permissions.canManagePersonalReferences !== false;
}

function denied({ effectiveScope = '', reason, errorCode }) {
  return { allowed: false, effectiveScope, reason, errorCode };
}

export function resolveReferenceWriteScope({
  requestedScope,
  permissions = {},
  operation = 'create',
  allowDefaultPersonal = true
} = {}) {
  const scope = requestedScope === 'global' || requestedScope === 'personal' ? requestedScope : '';

  if (!scope && requestedScope != null && requestedScope !== '') {
    return denied({
      reason: 'INVALID_SCOPE',
      errorCode: REFERENCE_WRITE_SCOPE_ERRORS.INVALID_SCOPE
    });
  }

  if (!scope) {
    if (!allowDefaultPersonal) {
      return denied({
        reason: 'SCOPE_REQUIRED',
        errorCode: REFERENCE_WRITE_SCOPE_ERRORS.SCOPE_REQUIRED
      });
    }
    if (!canManagePersonalReferences(permissions)) {
      return denied({
        effectiveScope: 'personal',
        reason: 'PERSONAL_SCOPE_FORBIDDEN',
        errorCode: REFERENCE_WRITE_SCOPE_ERRORS.PERSONAL_FORBIDDEN
      });
    }
    return {
      allowed: true,
      effectiveScope: 'personal',
      reason: `${operation}:DEFAULT_PERSONAL_SCOPE`,
      errorCode: ''
    };
  }

  if (scope === 'personal') {
    if (!canManagePersonalReferences(permissions)) {
      return denied({
        effectiveScope: 'personal',
        reason: 'PERSONAL_SCOPE_FORBIDDEN',
        errorCode: REFERENCE_WRITE_SCOPE_ERRORS.PERSONAL_FORBIDDEN
      });
    }
    return {
      allowed: true,
      effectiveScope: 'personal',
      reason: `${operation}:EXPLICIT_PERSONAL_SCOPE`,
      errorCode: ''
    };
  }

  if (!canManageSharedReferences(permissions)) {
    return denied({
      reason: 'SHARED_SCOPE_REQUIRES_ADMIN',
      errorCode: REFERENCE_WRITE_SCOPE_ERRORS.SHARED_FORBIDDEN
    });
  }

  return {
    allowed: true,
    effectiveScope: 'global',
    reason: `${operation}:EXPLICIT_GLOBAL_SCOPE`,
    errorCode: ''
  };
}
