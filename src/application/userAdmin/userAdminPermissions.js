import {
  ACCOUNT_ROLE,
  ACCOUNT_STATUS,
  normalizeAccountRole,
  normalizeAccountStatus
} from '../../domain/accountLifecycle.js';

export function resolveUserAdminPermissions({ profile = null, claims = {} } = {}) {
  const role = normalizeAccountRole(profile?.role, ACCOUNT_ROLE.USER);
  const status = normalizeAccountStatus(profile?.status, profile ? ACCOUNT_STATUS.PENDING : ACCOUNT_STATUS.PENDING);
  const hasAdminClaim = claims?.admin === true;
  const hasActiveAdminProfile = status === ACCOUNT_STATUS.ACTIVE
    && (role === ACCOUNT_ROLE.ADMIN || role === ACCOUNT_ROLE.OWNER);
  const canManageUsers = hasAdminClaim || hasActiveAdminProfile;

  return {
    role,
    status,
    isAdminByClaim: hasAdminClaim,
    isAdminByProfile: hasActiveAdminProfile,
    isOwnerByProfile: hasActiveAdminProfile && role === ACCOUNT_ROLE.OWNER,
    canReadUserAdmin: canManageUsers,
    canApproveUser: canManageUsers,
    canDeactivateUser: canManageUsers,
    canReactivateUser: canManageUsers,
    canChangeUserRole: canManageUsers,
    canManageUsers,
    canAccessPersonalFinancialData: status === ACCOUNT_STATUS.ACTIVE
  };
}

