import {
  ACCOUNT_ROLE,
  ACCOUNT_STATUS,
  getAccountRoleLabel,
  getAccountStatusLabel,
  normalizeAccountRole,
  normalizeAccountStatus
} from '../../domain/accountLifecycle.js';
import { pageItems } from '../repositories/pagination.js';

const VALID_STATUSES = new Set(Object.values(ACCOUNT_STATUS));
const VALID_ROLES = new Set(Object.values(ACCOUNT_ROLE));

function normalizeText(value = '') {
  return String(value || '').trim().toLowerCase();
}

function normalizeUser(user = {}) {
  const status = normalizeAccountStatus(user.status, ACCOUNT_STATUS.PENDING);
  const role = normalizeAccountRole(user.role, ACCOUNT_ROLE.USER);
  return {
    ...user,
    uid: String(user.uid || user.id || ''),
    email: user.email || '',
    name: user.name || user.displayName || '',
    role,
    status,
    roleLabel: getAccountRoleLabel(role),
    statusLabel: getAccountStatusLabel(status)
  };
}

function matchesFilters(user, filters = {}) {
  const status = VALID_STATUSES.has(filters.status) ? filters.status : '';
  const role = VALID_ROLES.has(filters.role) ? filters.role : '';
  const search = normalizeText(filters.search);
  if (status && user.status !== status) return false;
  if (role && user.role !== role) return false;
  if (!search) return true;
  return [
    user.email,
    user.name,
    user.displayName,
    user.uid
  ].some((value) => normalizeText(value).includes(search));
}

function summarize(users = []) {
  const summary = {
    total: users.length,
    byStatus: Object.fromEntries(Object.values(ACCOUNT_STATUS).map((status) => [status, 0])),
    byRole: Object.fromEntries(Object.values(ACCOUNT_ROLE).map((role) => [role, 0]))
  };
  for (const user of users) {
    if (summary.byStatus[user.status] !== undefined) summary.byStatus[user.status] += 1;
    if (summary.byRole[user.role] !== undefined) summary.byRole[user.role] += 1;
  }
  return summary;
}

function allowedActions(user, currentUser, permissions = {}, pendingActions = {}) {
  const isSelf = Boolean(currentUser?.uid && user.uid === currentUser.uid);
  const isLoading = Boolean(pendingActions[user.uid]);
  const baseAllowed = !isSelf && !isLoading && permissions.canManageUsers === true;
  return {
    approve: baseAllowed && permissions.canApproveUser === true && user.status === ACCOUNT_STATUS.PENDING,
    deactivate: baseAllowed && permissions.canDeactivateUser === true && user.status !== ACCOUNT_STATUS.INACTIVE,
    reactivate: baseAllowed && permissions.canReactivateUser === true && user.status === ACCOUNT_STATUS.INACTIVE,
    changeRole: baseAllowed && permissions.canChangeUserRole === true,
    self: isSelf,
    loading: isLoading
  };
}

export function buildUserAdminReadModel({
  users = [],
  currentUser = null,
  permissions = {},
  filters = {},
  pagination = {},
  pageInfo = null,
  pendingActions = {},
  error = ''
} = {}) {
  const normalizedUsers = users.map(normalizeUser);
  const filteredUsers = normalizedUsers.filter((user) => matchesFilters(user, filters));
  const page = pageInfo
    ? {
        items: filteredUsers,
        count: filteredUsers.length,
        nextCursor: pageInfo.nextCursor || '',
        hasMore: Boolean(pageInfo.hasMore),
        totalKnown: pageInfo.totalKnown,
        pageInfo
      }
    : pageItems(filteredUsers, { orderBy: 'email', direction: 'asc', ...pagination });

  return {
    canRead: permissions.canReadUserAdmin === true,
    filters: {
      status: VALID_STATUSES.has(filters.status) ? filters.status : '',
      role: VALID_ROLES.has(filters.role) ? filters.role : '',
      search: filters.search || ''
    },
    users: page.items.map((user) => ({
      ...user,
      isSelf: Boolean(currentUser?.uid && user.uid === currentUser.uid),
      actions: allowedActions(user, currentUser, permissions, pendingActions)
    })),
    summary: summarize(normalizedUsers),
    pagination: {
      count: page.count,
      hasMore: page.hasMore,
      hasPrevious: Boolean(pagination.hasPrevious),
      nextCursor: page.nextCursor || '',
      totalKnown: page.totalKnown,
      pageInfo: page.pageInfo || {}
    },
    error
  };
}
