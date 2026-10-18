import { describe, expect, it } from 'vitest';
import { resolveUserAdminPermissions } from '../../../src/application/userAdmin/userAdminPermissions.js';

describe('resolveUserAdminPermissions', () => {
  it('permite recuperacao administrativa por custom claim sem perfil ativo', () => {
    const permissions = resolveUserAdminPermissions({
      profile: null,
      claims: { admin: true }
    });

    expect(permissions).toMatchObject({
      isAdminByClaim: true,
      canReadUserAdmin: true,
      canApproveUser: true,
      canManageUsers: true,
      canAccessPersonalFinancialData: false
    });
  });

  it('bloqueia admin por perfil quando a conta esta inativa', () => {
    const permissions = resolveUserAdminPermissions({
      profile: { uid: 'admin-a', role: 'admin', status: 'inactive' },
      claims: {}
    });

    expect(permissions).toMatchObject({
      isAdminByClaim: false,
      isAdminByProfile: false,
      canReadUserAdmin: false,
      canManageUsers: false,
      canAccessPersonalFinancialData: false
    });
  });

  it('mantem usuario comum ativo sem autoridade administrativa', () => {
    const permissions = resolveUserAdminPermissions({
      profile: { uid: 'user-a', role: 'user', status: 'active' }
    });

    expect(permissions).toMatchObject({
      canReadUserAdmin: false,
      canApproveUser: false,
      canChangeUserRole: false,
      canAccessPersonalFinancialData: true
    });
  });
});

