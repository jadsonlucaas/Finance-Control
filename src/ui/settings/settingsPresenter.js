function escapeHtml(value = '') {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function currency(value = 0) {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function badge(scope = 'personal') {
  const global = scope === 'global';
  const classes = global ? 'bg-accent/10 text-accent border-accent/20' : 'bg-success/10 text-success border-success/20';
  return `<span class="inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold ${classes}">${global ? 'Global' : 'Pessoal'}</span>`;
}

function renderPeople(model = {}) {
  const people = model.people || [];
  if (!people.length) return '';
  return people.map((person) => `
    <div class="rounded-xl border border-surfaceLight bg-surfaceLight/30 p-3" data-settings-person-id="${escapeHtml(person.id)}">
      <div class="flex items-start justify-between gap-3 flex-wrap">
        <div class="min-w-0">
          <p class="text-sm font-semibold">${escapeHtml(person.person)}</p>
          <p class="text-xl font-bold text-success mt-2">${currency(person.salary_base || person.amount || 0)}</p>
          <div class="mt-3">
            <label class="text-[11px] text-textSecondary mb-1 block">Tipo de recebimento</label>
            <select data-settings-action="update-person-receiving-type" data-person-id="${escapeHtml(person.id)}" class="w-full text-sm" ${model.permissions.canManagePeople ? '' : 'disabled'}>
              <option value="mensal" ${person.receiving_type === 'quinzenal' ? '' : 'selected'}>Uma vez ao mes</option>
              <option value="quinzenal" ${person.receiving_type === 'quinzenal' ? 'selected' : ''}>Quinzenal</option>
            </select>
          </div>
        </div>
        <div class="flex gap-2 flex-wrap">
          <button type="button" data-open-salary-history-id="${escapeHtml(person.id)}" data-open-salary-history-person="${escapeHtml(person.person)}" class="px-3 py-1.5 text-xs rounded-lg bg-surfaceLight text-textSecondary hover:text-textPrimary">Ver historico</button>
          ${model.permissions.canManagePeople ? `<button type="button" data-delete-person-id="${escapeHtml(person.id)}" class="text-textSecondary hover:text-danger p-2" title="Excluir pessoa" aria-label="Excluir pessoa ${escapeHtml(person.person || '')}"><i data-lucide="trash-2" class="w-4 h-4"></i></button>` : ''}
        </div>
      </div>
    </div>
  `).join('');
}

function renderMacros(model = {}) {
  const macros = [...(model.references.sharedMacros || []), ...(model.references.personalMacros || [])];
  return macros.map((macro) => `
    <div class="flex items-center justify-between bg-surfaceLight/50 rounded-lg p-2.5" data-settings-macro-id="${escapeHtml(macro.id || macro.macro_id)}">
      <div class="flex items-center gap-2 flex-wrap"><span class="text-sm">${escapeHtml(macro.macro_category || '')}</span>${badge(macro.reference_origin)}</div>
      ${macro.canDelete ? `<button type="button" data-delete-macro-id="${escapeHtml(macro.id || macro.macro_id)}" class="text-textSecondary hover:text-danger p-1" title="Excluir macro" aria-label="Excluir macro ${escapeHtml(macro.macro_category || '')}"><i data-lucide="trash-2" class="w-4 h-4"></i></button>` : ''}
    </div>
  `).join('');
}

function renderCategories(model = {}) {
  const categories = [...(model.references.sharedCategories || []), ...(model.references.personalCategories || [])];
  return categories.map((category) => `
    <div class="bg-surface rounded-xl p-4 border border-surfaceLight flex items-center justify-between card-hover" data-settings-category-id="${escapeHtml(category.id || category.category_id)}">
      <div class="flex items-center gap-3 min-w-0">
        <div class="w-12 h-12 rounded-lg flex items-center justify-center" style="background: ${escapeHtml(category.category_color || '#38bdf8')}20; color: ${escapeHtml(category.category_color || '#38bdf8')};">
          <i data-lucide="${escapeHtml(category.category_icon || 'tag')}" class="w-6 h-6"></i>
        </div>
        <div class="min-w-0">
          <div class="flex items-center gap-2 flex-wrap"><h3 class="font-semibold">${escapeHtml(category.category_name || category.subcategory || '')}</h3>${badge(category.reference_origin)}</div>
          <p class="text-xs text-textSecondary">${escapeHtml(category.macro_category || '')}</p>
        </div>
      </div>
      <div class="flex gap-2">
        ${category.canEdit ? `<button type="button" data-open-edit-category="${escapeHtml(category.id || category.category_id)}" class="text-textSecondary hover:text-accent p-2" title="Editar categoria" aria-label="Editar categoria ${escapeHtml(category.category_name || '')}"><i data-lucide="pencil" class="w-4 h-4"></i></button>` : ''}
        ${category.canDelete ? `<button type="button" data-delete-category-id="${escapeHtml(category.id || category.category_id)}" class="text-textSecondary hover:text-danger p-2" title="Excluir categoria" aria-label="Excluir categoria ${escapeHtml(category.category_name || '')}"><i data-lucide="trash-2" class="w-4 h-4"></i></button>` : ''}
      </div>
    </div>
  `).join('');
}

export function createSettingsPresenter({ document: documentRef = globalThis.document } = {}) {
  function setHtml(id, html) {
    const element = documentRef?.getElementById?.(id);
    if (element) element.innerHTML = html;
  }

  function setHidden(id, hidden) {
    const element = documentRef?.getElementById?.(id);
    if (element) element.classList.toggle('hidden', hidden);
  }

  return {
    render(viewState = {}) {
      const model = viewState.data || viewState.model || viewState;
      if (viewState.status === 'loading') {
        setHtml('pessoas-list', '<p class="text-xs text-textSecondary text-center py-4">Carregando...</p>');
        return;
      }
      if (viewState.status === 'error' || viewState.status === 'offline') {
        setHtml('pessoas-list', `<p class="text-xs text-danger text-center py-4">${escapeHtml(viewState.error?.userMessage || 'Nao foi possivel carregar configuracoes.')}</p>`);
        return;
      }

      const peopleHtml = renderPeople(model);
      setHtml('pessoas-list', peopleHtml);
      setHidden('pessoas-empty', Boolean(peopleHtml));

      const macroHtml = renderMacros(model);
      setHtml('macro-list', macroHtml);
      setHidden('macro-empty', Boolean(macroHtml));

      const categoryHtml = renderCategories(model);
      setHtml('categories-list', categoryHtml);
      setHidden('categories-empty', Boolean(categoryHtml));

      documentRef?.defaultView?.lucide?.createIcons?.();
    }
  };
}
