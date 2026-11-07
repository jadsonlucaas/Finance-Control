import { buildUserAdminReadModel } from '../../application/readModels/userAdminReadModel.js';
import { resolveUserAdminPermissions } from '../../application/userAdmin/userAdminPermissions.js';
import { createUserAdminPresenter } from './userAdminPresenter.js';

const DEFAULT_LIMIT = 50;

function normalizeListResult(result) {
  if (Array.isArray(result)) {
    return { items: result, pageInfo: null };
  }
  return {
    items: result?.items || result?.data || [],
    pageInfo: {
      hasMore: Boolean(result?.hasMore),
      nextCursor: result?.nextCursor || '',
      totalKnown: result?.totalKnown,
      limit: result?.pageInfo?.limit || DEFAULT_LIMIT,
      orderBy: result?.pageInfo?.orderBy || 'email',
      direction: result?.pageInfo?.direction || 'asc',
      searchMode: result?.pageInfo?.searchMode || 'local_page'
    }
  };
}

export function createUserAdminController({
  document,
  readSource,
  actions,
  authContext,
  presenter = createUserAdminPresenter(document),
  confirm = globalThis.confirm,
  notify = globalThis.showToast,
  consoleRef = console
} = {}) {
  let state = {
    filters: { status: '', role: '', search: '' },
    pagination: { limit: DEFAULT_LIMIT, cursor: '', orderBy: 'email', direction: 'asc' },
    cursorHistory: [],
    pendingActions: {},
    model: null,
    lastItems: [],
    compGrants: {}
  };

  function getAuth() {
    const context = authContext?.() || {};
    const permissions = context.permissions || resolveUserAdminPermissions({
      profile: context.profile,
      claims: context.claims
    });
    return {
      currentUser: context.currentUser || null,
      permissions
    };
  }

  function withAssistantAccess(items) {
    return items.map((user) => ({ ...user, assistantComp: state.compGrants[user.uid]?.status === 'active' }));
  }

  async function loadCompGrants() {
    if (typeof readSource.listAssistantComps !== 'function') return;
    try {
      state.compGrants = (await readSource.listAssistantComps()) || {};
    } catch (error) {
      consoleRef.error?.(error);
    }
  }

  function renderFromItems(items, pageInfo = null, error = '') {
    const auth = getAuth();
    state.model = buildUserAdminReadModel({
      users: withAssistantAccess(items),
      currentUser: auth.currentUser,
      permissions: auth.permissions,
      filters: state.filters,
      pagination: { ...state.pagination, hasPrevious: state.cursorHistory.length > 0 },
      pageInfo,
      pendingActions: state.pendingActions,
      error
    });
    presenter.render(state.model);
    return state.model;
  }

  async function refresh(overrides = {}) {
    state = {
      ...state,
      filters: { ...state.filters, ...(overrides.filters || {}) },
      pagination: { ...state.pagination, ...(overrides.pagination || {}) }
    };
    const auth = getAuth();
    if (auth.permissions.canReadUserAdmin !== true) {
      state.lastItems = [];
      return renderFromItems([]);
    }
    try {
      const result = normalizeListResult(await readSource.listUsers({
        pageSize: state.pagination.limit,
        cursor: state.pagination.cursor,
        orderBy: state.pagination.orderBy,
        direction: state.pagination.direction,
        filters: {
          status: state.filters.status,
          role: state.filters.role
        }
      }));
      state.lastItems = result.items;
      await loadCompGrants();
      return renderFromItems(result.items, result.pageInfo);
    } catch (error) {
      consoleRef.error?.(error);
      return renderFromItems(state.lastItems, null, 'Erro ao carregar usuários.');
    }
  }

  async function update(uid, payload) {
    const target = state.lastItems.find((user) => String(user.uid) === String(uid));
    if (!target || state.pendingActions[uid]) return { isOk: false, code: 'USER_ADMIN_ACTION_IGNORED' };
    if (payload.status === target.status || payload.role === target.role) return { isOk: true, skipped: true };
    if (payload.status === 'inactive' && confirm && !confirm('Desativar este usuário e bloquear o acesso aos dados financeiros?')) {
      return { isOk: false, code: 'USER_ADMIN_ACTION_CANCELLED' };
    }
    try {
      state.pendingActions = { ...state.pendingActions, [uid]: true };
      renderFromItems(state.lastItems);
      const result = await actions.updateUser(uid, payload);
      await refresh();
      notify?.(payload.role ? 'Perfil atualizado!' : `Status atualizado: ${payload.status === 'active' ? 'acesso liberado' : 'acesso bloqueado'}.`);
      return result;
    } catch (error) {
      consoleRef.error?.(error);
      notify?.(payload.role ? 'Erro ao atualizar perfil do usuário' : 'Erro ao atualizar status do usuário', true);
      return renderFromItems(state.lastItems, null, 'Falha ao atualizar usuário.');
    } finally {
      const { [uid]: _removed, ...rest } = state.pendingActions;
      state.pendingActions = rest;
      renderFromItems(state.lastItems);
    }
  }

  async function setAssistantComp(uid, active) {
    const target = state.lastItems.find((user) => String(user.uid) === String(uid));
    if (!target || state.pendingActions[uid] || typeof actions.setAssistantComp !== 'function') {
      return { isOk: false, code: 'USER_ADMIN_ACTION_IGNORED' };
    }
    if (!active && confirm && !confirm('Revogar o acesso cortesia ao assistente deste usuário?')) {
      return { isOk: false, code: 'USER_ADMIN_ACTION_CANCELLED' };
    }
    try {
      state.pendingActions = { ...state.pendingActions, [uid]: true };
      renderFromItems(state.lastItems);
      await actions.setAssistantComp(uid, active, { targetEmail: target.email || '' });
      await refresh();
      notify?.(active ? 'Acesso cortesia ao assistente concedido.' : 'Acesso cortesia ao assistente revogado.');
      return { isOk: true };
    } catch (error) {
      consoleRef.error?.(error);
      notify?.('Erro ao atualizar o acesso ao assistente', true);
      return renderFromItems(state.lastItems, null, 'Falha ao atualizar o acesso ao assistente.');
    } finally {
      const { [uid]: _removed, ...rest } = state.pendingActions;
      state.pendingActions = rest;
      renderFromItems(state.lastItems);
    }
  }

  return {
    refresh,
    setAssistantComp,
    setRole: (uid, role) => update(uid, { role }),
    setStatus: (uid, status) => update(uid, { status }),
    toggleStatus: (uid) => {
      const target = state.lastItems.find((user) => String(user.uid) === String(uid));
      if (!target) return Promise.resolve({ isOk: false, code: 'USER_ADMIN_NOT_FOUND' });
      return update(uid, { status: target.status === 'inactive' ? 'active' : 'inactive' });
    },
    updateFilters(filters = {}) {
      state.cursorHistory = [];
      return refresh({ filters, pagination: { cursor: '' } });
    },
    nextPage() {
      if (!state.model?.pagination?.hasMore) return Promise.resolve(state.model);
      state.cursorHistory = [...state.cursorHistory, state.pagination.cursor || ''];
      return refresh({ pagination: { cursor: state.model.pagination.nextCursor } });
    },
    previousPage() {
      if (!state.cursorHistory.length) return Promise.resolve(state.model);
      const previousCursor = state.cursorHistory.at(-1) || '';
      state.cursorHistory = state.cursorHistory.slice(0, -1);
      return refresh({ pagination: { cursor: previousCursor } });
    },
    getState: () => state
  };
}
