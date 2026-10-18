export const ACCOUNT_STATUS = Object.freeze({
  PENDING: 'pending',
  ACTIVE: 'active',
  INACTIVE: 'inactive'
});

export const ACCOUNT_ROLE = Object.freeze({
  USER: 'user',
  ADMIN: 'admin',
  OWNER: 'owner'
});

const STATUS_LABELS = Object.freeze({
  [ACCOUNT_STATUS.PENDING]: 'Aguardando aprovacao',
  [ACCOUNT_STATUS.ACTIVE]: 'Ativo',
  [ACCOUNT_STATUS.INACTIVE]: 'Inativo'
});

const ROLE_LABELS = Object.freeze({
  [ACCOUNT_ROLE.USER]: 'Usuario padrao',
  [ACCOUNT_ROLE.ADMIN]: 'Admin master',
  [ACCOUNT_ROLE.OWNER]: 'Owner'
});

const ALLOWED_TRANSITIONS = Object.freeze({
  [ACCOUNT_STATUS.PENDING]: [ACCOUNT_STATUS.ACTIVE, ACCOUNT_STATUS.INACTIVE],
  [ACCOUNT_STATUS.ACTIVE]: [ACCOUNT_STATUS.INACTIVE],
  [ACCOUNT_STATUS.INACTIVE]: [ACCOUNT_STATUS.ACTIVE]
});

export function isValidAccountStatus(status) {
  return Object.values(ACCOUNT_STATUS).includes(status);
}

export function isValidAccountRole(role) {
  return Object.values(ACCOUNT_ROLE).includes(role);
}

export function normalizeAccountStatus(status, fallback = ACCOUNT_STATUS.PENDING) {
  return isValidAccountStatus(status) ? status : fallback;
}

export function normalizeAccountRole(role, fallback = ACCOUNT_ROLE.USER) {
  return isValidAccountRole(role) ? role : fallback;
}

export function canTransitionAccountStatus(previousStatus, nextStatus) {
  if (!isValidAccountStatus(previousStatus) || !isValidAccountStatus(nextStatus)) return false;
  if (previousStatus === nextStatus) return true;
  return (ALLOWED_TRANSITIONS[previousStatus] || []).includes(nextStatus);
}

export function getAccountStatusLabel(status) {
  return STATUS_LABELS[normalizeAccountStatus(status)] || STATUS_LABELS[ACCOUNT_STATUS.PENDING];
}

export function getAccountRoleLabel(role) {
  return ROLE_LABELS[normalizeAccountRole(role)] || ROLE_LABELS[ACCOUNT_ROLE.USER];
}

export function getAccountAccessMessage(status, email = '') {
  const suffix = email ? `\nEmail: ${email}` : '';
  if (status === ACCOUNT_STATUS.PENDING) {
    return `Sua conta esta aguardando aprovacao do administrador.${suffix}`;
  }
  if (status === ACCOUNT_STATUS.INACTIVE) {
    return `Seu acesso esta desativado. Solicite reativacao ao administrador.${suffix}`;
  }
  return '';
}

export function getAdminStatusAction(previousStatus, nextStatus) {
  if (previousStatus === ACCOUNT_STATUS.PENDING && nextStatus === ACCOUNT_STATUS.ACTIVE) return 'admin.user_approve';
  if (nextStatus === ACCOUNT_STATUS.INACTIVE) return 'admin.user_deactivate';
  if (previousStatus === ACCOUNT_STATUS.INACTIVE && nextStatus === ACCOUNT_STATUS.ACTIVE) return 'admin.user_reactivate';
  if (previousStatus === nextStatus) return 'admin.user_status_keep';
  return 'admin.user_status_change';
}

export function buildInitialUserProfile(user, { now = new Date() } = {}) {
  const timestamp = now instanceof Date ? now.toISOString() : String(now || new Date().toISOString());
  return {
    uid: user.uid,
    email: user.email || '',
    role: ACCOUNT_ROLE.USER,
    status: ACCOUNT_STATUS.PENDING,
    created_at: timestamp,
    updated_at: timestamp,
    last_login_at: timestamp
  };
}

export function getUserAccessState(profile = null) {
  if (!profile) {
    return {
      status: ACCOUNT_STATUS.PENDING,
      isPending: true,
      isActive: false,
      isInactive: false,
      canAccessFinancialData: false
    };
  }
  const status = normalizeAccountStatus(profile.status);
  return {
    status,
    isPending: status === ACCOUNT_STATUS.PENDING,
    isActive: status === ACCOUNT_STATUS.ACTIVE,
    isInactive: status === ACCOUNT_STATUS.INACTIVE,
    canAccessFinancialData: status === ACCOUNT_STATUS.ACTIVE
  };
}

export function buildAdminUpdatePlan(previousProfile = {}, payload = {}) {
  const previousRole = normalizeAccountRole(previousProfile.role);
  const previousStatus = normalizeAccountStatus(previousProfile.status);
  const nextRole = payload.role === undefined ? previousRole : normalizeAccountRole(payload.role, '');
  const nextStatus = payload.status === undefined ? previousStatus : normalizeAccountStatus(payload.status, '');

  if (!isValidAccountRole(nextRole)) return { isOk: false, error: 'INVALID_ROLE' };
  if (!isValidAccountStatus(nextStatus)) return { isOk: false, error: 'INVALID_STATUS' };
  if (!canTransitionAccountStatus(previousStatus, nextStatus)) return { isOk: false, error: 'INVALID_STATUS_TRANSITION' };

  const patch = {};
  if (nextRole !== previousRole) patch.role = nextRole;
  if (nextStatus !== previousStatus) patch.status = nextStatus;

  return {
    isOk: true,
    previousRole,
    nextRole,
    previousStatus,
    nextStatus,
    statusAction: getAdminStatusAction(previousStatus, nextStatus),
    patch
  };
}

export function installAccountLifecycleGlobals(target = globalThis) {
  target.financeAccountLifecycle = {
    ACCOUNT_STATUS,
    ACCOUNT_ROLE,
    isValidAccountStatus,
    isValidAccountRole,
    normalizeAccountStatus,
    normalizeAccountRole,
    canTransitionAccountStatus,
    getAccountStatusLabel,
    getAccountRoleLabel,
    getAccountAccessMessage,
    getAdminStatusAction,
    buildInitialUserProfile,
    getUserAccessState,
    buildAdminUpdatePlan
  };
  return target.financeAccountLifecycle;
}
