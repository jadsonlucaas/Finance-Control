import { resolveUserAdminPermissions } from '../../application/userAdmin/userAdminPermissions.js';
import { createUserAdminController } from './userAdminController.js';

function defineModernFlag(fn) {
  if (typeof fn !== 'function') return fn;
  try {
    Object.defineProperty(fn, '__financeModernUserAdmin', { value: true });
  } catch {}
  return fn;
}

function getCurrentUser(target) {
  return target.financeApp?.authContext?.currentUser
    || target.currentUser
    || target.authSdk?.getCurrentUser?.()
    || target.auth?.currentUser
    || null;
}

function getCurrentProfile(target) {
  return target.financeApp?.authContext?.profile || target.currentUserProfile || null;
}

function createUserAdminWebAdapter(target = globalThis) {
  return {
    readSource: {
      listUsers: (query = {}) => target.userAdminSdk?.listUsers?.(query) || [],
      listAssistantComps: () => target.assistantAccessSdk?.listCompGrants?.() || {}
    },
    actions: {
      updateUser: (uid, payload) => target.userAdminSdk?.updateUser?.(uid, payload),
      setAssistantComp: (uid, active, options = {}) => {
        const adminUid = getCurrentUser(target)?.uid || '';
        const sdk = target.assistantAccessSdk;
        if (!sdk) throw new Error('ASSISTANT_ACCESS_SERVICE_UNAVAILABLE');
        return active ? sdk.grantComp(adminUid, uid, options) : sdk.revokeComp(adminUid, uid, options);
      },
      deleteUser: (uid, confirmacao) => {
        const sdk = target.accountDeletionSdk;
        if (!sdk?.enabled) throw Object.assign(new Error('ACCOUNT_DELETION_NOT_CONFIGURED'), { code: 'ACCOUNT_DELETION_NOT_CONFIGURED' });
        return sdk.deleteUser(uid, confirmacao);
      }
    },
    describeError: (error) => target.accountDeletionSdk?.errorMessage?.(error) || '',
    prompt: (message) => target.prompt?.(message),
    authContext: () => {
      const profile = getCurrentProfile(target);
      const claims = target.financeApp?.authContext?.claims || target.currentAuthClaims || {};
      const fallbackAdminProfile = !profile && target.isCurrentUserAdmin?.() === true
        ? { role: 'admin', status: 'active' }
        : null;
      return {
        currentUser: getCurrentUser(target),
        profile: profile || fallbackAdminProfile,
        claims,
        permissions: resolveUserAdminPermissions({ profile: profile || fallbackAdminProfile, claims })
      };
    },
    notify: target.showToast,
    confirm: target.confirm,
    consoleRef: target.console || console
  };
}

function bindUserAdminActions(target, controller) {
  const documentRef = target.document;
  if (!documentRef || documentRef.documentElement.dataset.financeUserAdminModernActionsBound) return;
  documentRef.addEventListener('change', (event) => {
    const filter = event.target.closest?.('[data-user-admin-filter]');
    if (!filter) return;
    controller.updateFilters({
      [filter.dataset.userAdminFilter]: filter.value || ''
    });
  });
  documentRef.addEventListener('input', (event) => {
    const filter = event.target.closest?.('[data-user-admin-filter="search"]');
    if (!filter) return;
    controller.updateFilters({ search: filter.value || '' });
  });
  documentRef.addEventListener('click', (event) => {
    const next = event.target.closest?.('[data-user-admin-page="next"]');
    if (!next) return;
    event.preventDefault();
    controller.nextPage();
  });
  documentRef.addEventListener('click', (event) => {
    const previous = event.target.closest?.('[data-user-admin-page="prev"]');
    if (!previous) return;
    event.preventDefault();
    controller.previousPage();
  });
  documentRef.addEventListener('click', (event) => {
    const button = event.target.closest?.('[data-set-assistant-comp]');
    if (!button) return;
    event.preventDefault();
    controller.setAssistantComp(button.dataset.setAssistantComp, button.dataset.assistantComp === 'on');
  });
  documentRef.addEventListener('click', (event) => {
    const button = event.target.closest?.('[data-delete-managed-user]');
    if (!button) return;
    event.preventDefault();
    controller.deleteUser(button.dataset.deleteManagedUser);
  });
  documentRef.documentElement.dataset.financeUserAdminModernActionsBound = 'true';
}

export function installUserAdminActiveUi(target = globalThis, options = {}) {
  if (!target?.document) return null;
  if (target.refreshManagedUsers?.__financeModernUserAdmin === true && options.reuseExisting !== false) {
    return { installed: true, alreadyInstalled: true };
  }

  const adapter = createUserAdminWebAdapter(target);
  const controller = options.controller || createUserAdminController({
    document: target.document,
    ...adapter,
    ...options
  });

  target.refreshManagedUsers = defineModernFlag(() => controller.refresh());
  target.renderManagedUsers = defineModernFlag(() => controller.refresh());
  target.setManagedUserRole = defineModernFlag((uid, role) => controller.setRole(uid, role));
  target.setManagedUserStatus = defineModernFlag((uid, status) => controller.setStatus(uid, status));
  target.toggleManagedUserStatus = defineModernFlag((uid) => controller.toggleStatus(uid));

  bindUserAdminActions(target, controller);

  if (target.isCurrentUserAdmin?.() === true) {
    setTimeout(() => controller.refresh().catch(adapter.consoleRef.error), 0);
  }

  return {
    installed: true,
    controller,
    destroy: () => {}
  };
}
