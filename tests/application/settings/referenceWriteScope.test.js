import { describe, expect, it } from 'vitest';
import {
  REFERENCE_WRITE_SCOPE_ERRORS,
  resolveReferenceWriteScope
} from '../../../src/application/settings/referenceWriteScope.js';

const commonPermissions = {
  canManagePersonalReferences: true,
  canManageSharedReferences: false,
  isAdmin: false
};

const adminPermissions = {
  canManagePersonalReferences: true,
  canManageSharedReferences: true,
  isAdmin: true
};

describe('resolveReferenceWriteScope', () => {
  it('allows common user to create personal explicitly', () => {
    expect(resolveReferenceWriteScope({
      requestedScope: 'personal',
      permissions: commonPermissions,
      operation: 'createMacro'
    })).toMatchObject({
      allowed: true,
      effectiveScope: 'personal',
      errorCode: ''
    });
  });

  it('defaults omitted common scope to personal only when the contract allows it', () => {
    expect(resolveReferenceWriteScope({
      permissions: commonPermissions,
      operation: 'createCategory',
      allowDefaultPersonal: true
    })).toMatchObject({
      allowed: true,
      effectiveScope: 'personal',
      reason: 'createCategory:DEFAULT_PERSONAL_SCOPE'
    });
  });

  it('rejects omitted scope when the operation requires explicit choice', () => {
    expect(resolveReferenceWriteScope({
      permissions: commonPermissions,
      operation: 'restrictedOperation',
      allowDefaultPersonal: false
    })).toMatchObject({
      allowed: false,
      effectiveScope: '',
      errorCode: REFERENCE_WRITE_SCOPE_ERRORS.SCOPE_REQUIRED
    });
  });

  it('rejects common global request without converting it to personal', () => {
    expect(resolveReferenceWriteScope({
      requestedScope: 'global',
      permissions: commonPermissions,
      operation: 'createMacro'
    })).toEqual({
      allowed: false,
      effectiveScope: '',
      reason: 'SHARED_SCOPE_REQUIRES_ADMIN',
      errorCode: REFERENCE_WRITE_SCOPE_ERRORS.SHARED_FORBIDDEN
    });
  });

  it('allows admin to create personal explicitly', () => {
    expect(resolveReferenceWriteScope({
      requestedScope: 'personal',
      permissions: adminPermissions,
      operation: 'createMacro'
    })).toMatchObject({
      allowed: true,
      effectiveScope: 'personal'
    });
  });

  it('allows admin to create global only when requested explicitly', () => {
    expect(resolveReferenceWriteScope({
      requestedScope: 'global',
      permissions: adminPermissions,
      operation: 'createCategory'
    })).toMatchObject({
      allowed: true,
      effectiveScope: 'global',
      reason: 'createCategory:EXPLICIT_GLOBAL_SCOPE'
    });
  });

  it('does not default admin omitted scope to global', () => {
    expect(resolveReferenceWriteScope({
      permissions: adminPermissions,
      operation: 'createCategory'
    })).toMatchObject({
      allowed: true,
      effectiveScope: 'personal',
      reason: 'createCategory:DEFAULT_PERSONAL_SCOPE'
    });
  });

  it('rejects invalid scope values', () => {
    expect(resolveReferenceWriteScope({
      requestedScope: 'shared',
      permissions: adminPermissions,
      operation: 'createCategory'
    })).toMatchObject({
      allowed: false,
      errorCode: REFERENCE_WRITE_SCOPE_ERRORS.INVALID_SCOPE
    });
  });
});
