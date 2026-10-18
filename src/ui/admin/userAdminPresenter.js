const BUTTON_BASE = 'px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed';

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function statusClass(status) {
  if (status === 'inactive') return 'bg-warn/10 text-warn';
  if (status === 'pending') return 'bg-accent/10 text-accent';
  return 'bg-success/10 text-success';
}

function roleClass(role) {
  if (role === 'admin' || role === 'owner') return 'bg-danger/10 text-danger';
  return 'bg-accent/10 text-accent';
}

function disabledAttr(condition) {
  return condition ? 'disabled' : '';
}

function ensurePanel(documentRef) {
  const existing = documentRef.getElementById('admin-users-panel');
  if (existing) return existing;
  const settingsWrap = documentRef.querySelector('#view-configuracoes .space-y-6');
  if (!settingsWrap) return null;
  const panel = documentRef.createElement('div');
  panel.id = 'admin-users-panel';
  panel.className = 'bg-surface rounded-xl p-4 border border-surfaceLight hidden';
  settingsWrap.prepend(panel);
  return panel;
}

function renderControls(model) {
  return `
    <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-3">
      <div>
        <h3 class="font-semibold text-sm">Usuários do sistema</h3>
        <p class="text-xs text-textSecondary mt-1">Controle de papel e status de acesso.</p>
      </div>
      <div class="flex flex-col sm:flex-row gap-2">
        <input id="admin-user-search" data-user-admin-filter="search" class="bg-surfaceLight border border-surfaceLight rounded-lg px-3 py-1.5 text-xs min-w-0" placeholder="Buscar na página" title="Busca apenas nos usuários carregados nesta página." value="${escapeHtml(model.filters.search)}">
        <select id="admin-user-status-filter" data-user-admin-filter="status" class="bg-surfaceLight border border-surfaceLight rounded-lg px-3 py-1.5 text-xs">
          <option value="">Todos status</option>
          <option value="pending" ${model.filters.status === 'pending' ? 'selected' : ''}>Pendente</option>
          <option value="active" ${model.filters.status === 'active' ? 'selected' : ''}>Ativo</option>
          <option value="inactive" ${model.filters.status === 'inactive' ? 'selected' : ''}>Inativo</option>
        </select>
        <select id="admin-user-role-filter" data-user-admin-filter="role" class="bg-surfaceLight border border-surfaceLight rounded-lg px-3 py-1.5 text-xs">
          <option value="">Todos perfis</option>
          <option value="user" ${model.filters.role === 'user' ? 'selected' : ''}>Padrão</option>
          <option value="admin" ${model.filters.role === 'admin' ? 'selected' : ''}>Admin</option>
          <option value="owner" ${model.filters.role === 'owner' ? 'selected' : ''}>Owner</option>
        </select>
        <button data-legacy-click="refreshManagedUsers" class="bg-surfaceLight hover:bg-surfaceLight/80 text-textSecondary text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1 justify-center">
          <i data-lucide="refresh-cw" class="w-3 h-3"></i> Atualizar
        </button>
      </div>
    </div>`;
}

function renderUser(user) {
  const disabled = user.actions.self || user.actions.loading;
  const approve = user.actions.approve
    ? `<button data-set-managed-user-status="${escapeHtml(user.uid)}" data-managed-user-status="active" class="${BUTTON_BASE} bg-success/10 text-success hover:bg-success hover:text-white" ${disabledAttr(disabled)}>Aprovar</button>`
    : '';
  const statusButton = user.status === 'inactive'
    ? `<button data-set-managed-user-status="${escapeHtml(user.uid)}" data-managed-user-status="active" class="${BUTTON_BASE} bg-success/10 text-success hover:bg-success hover:text-white" ${disabledAttr(disabled || !user.actions.reactivate)}>Reativar</button>`
    : `<button data-set-managed-user-status="${escapeHtml(user.uid)}" data-managed-user-status="inactive" class="${BUTTON_BASE} bg-warn/10 text-warn hover:bg-warn hover:text-white" ${disabledAttr(disabled || !user.actions.deactivate)}>Desativar</button>`;

  return `
    <div class="rounded-xl border border-surfaceLight bg-surfaceLight/40 p-3" data-admin-user-row="${escapeHtml(user.uid)}">
      <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <div class="font-medium text-sm text-textPrimary">${escapeHtml(user.email || 'Sem email')}</div>
          <div class="text-xs text-textSecondary mt-1">UID: ${escapeHtml(user.uid)}</div>
          <div class="flex gap-2 mt-2 flex-wrap">
            <span class="px-2 py-1 rounded-full text-[11px] font-semibold ${roleClass(user.role)}">${escapeHtml(user.roleLabel)}</span>
            <span class="px-2 py-1 rounded-full text-[11px] font-semibold ${statusClass(user.status)}">${escapeHtml(user.statusLabel)}</span>
            ${user.actions.self ? '<span class="px-2 py-1 rounded-full text-[11px] font-semibold bg-surface text-textSecondary border border-surfaceLight">Você</span>' : ''}
            ${user.actions.loading ? '<span class="px-2 py-1 rounded-full text-[11px] font-semibold bg-surface text-textSecondary border border-surfaceLight">Atualizando</span>' : ''}
          </div>
        </div>
        <div class="flex gap-2 flex-wrap">
          <button data-set-managed-user-role="${escapeHtml(user.uid)}" data-managed-user-role="admin" class="${BUTTON_BASE} ${user.role === 'admin' ? 'bg-danger text-white' : 'bg-danger/10 text-danger hover:bg-danger hover:text-white'}" ${disabledAttr(disabled || !user.actions.changeRole)}>Admin</button>
          <button data-set-managed-user-role="${escapeHtml(user.uid)}" data-managed-user-role="user" class="${BUTTON_BASE} ${user.role === 'user' ? 'bg-accent text-white' : 'bg-accent/10 text-accent hover:bg-accent hover:text-white'}" ${disabledAttr(disabled || !user.actions.changeRole)}>Padrão</button>
          ${approve}
          ${statusButton}
        </div>
      </div>
    </div>`;
}

export function createUserAdminPresenter(documentRef) {
  return {
    render(model = {}) {
      const panel = ensurePanel(documentRef);
      if (!panel) return;
      panel.classList.toggle('hidden', model.canRead !== true);
      if (model.canRead !== true) {
        panel.innerHTML = '<div id="admin-users-list"></div><div id="admin-users-empty" class="hidden"></div>';
        return;
      }
      const emptyVisible = !model.users?.length;
      panel.innerHTML = [
        renderControls(model),
        model.error ? `<div class="text-xs text-danger bg-danger/10 rounded-lg px-3 py-2 mb-3">${escapeHtml(model.error)}</div>` : '',
        `<div id="admin-users-empty" class="text-textSecondary text-xs text-center py-4 ${emptyVisible ? '' : 'hidden'}">Nenhum usuário cadastrado.</div>`,
        `<div id="admin-users-list" class="space-y-2">${(model.users || []).map(renderUser).join('')}</div>`,
        `<div class="flex justify-end gap-2 mt-3">
          <button id="admin-users-prev" data-user-admin-page="prev" class="${BUTTON_BASE} bg-surfaceLight text-textSecondary" ${model.pagination?.hasPrevious ? '' : 'disabled'}>Anterior</button>
          <button id="admin-users-next" data-user-admin-page="next" class="${BUTTON_BASE} bg-surfaceLight text-textSecondary" ${model.pagination?.hasMore ? '' : 'disabled'}>Próxima</button>
        </div>`
      ].join('');
      globalThis.lucide?.createIcons?.();
    }
  };
}
