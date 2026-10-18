import { createViewStatePilot } from '../../application/resilience/asyncViewState.js';
import { buildSettingsReadModel } from '../../application/readModels/settingsReadModel.js';
import { createSettingsPresenter } from './settingsPresenter.js';

function successful(result = {}) {
  return result.success === true || result.isOk === true || result.ok === true;
}

function roundCurrency(value = 0) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function setScopeOptions(scope, canManageShared, value = 'personal') {
  if (!scope) return;
  const showGlobalReadOnly = value === 'global' && !canManageShared;
  const nextValue = value === 'global' && (canManageShared || showGlobalReadOnly) ? 'global' : 'personal';
  scope.innerHTML = canManageShared || showGlobalReadOnly
    ? '<option value="personal">Pessoal</option><option value="global">Global</option>'
    : '<option value="personal">Pessoal</option>';
  scope.value = nextValue;
  scope.disabled = !canManageShared;
}

function setScopeHelp(scopeWrap, canManageShared) {
  const help = scopeWrap?.querySelector?.('p');
  if (!help) return;
  help.textContent = canManageShared
    ? 'Global afeta todos os usuarios e exige escolha administrativa explicita.'
    : 'Novas referencias criadas por esta conta serao pessoais.';
}

function configureScopeControl({ scope, scopeWrap, value = 'personal', forceReadOnly = false, canManageShared = false }) {
  setScopeOptions(scope, canManageShared, value);
  if (scope) scope.disabled = forceReadOnly || !canManageShared;
  setScopeHelp(scopeWrap, canManageShared);
  scopeWrap?.classList.remove('hidden');
}

export function createSettingsController(dependencies = {}) {
  const documentRef = dependencies.document || globalThis.document;
  const readModel = dependencies.readModel || buildSettingsReadModel;
  const presenter = dependencies.presenter || createSettingsPresenter({ document: documentRef });
  const viewState = dependencies.viewState || createViewStatePilot('settings');
  const readSource = dependencies.readSource || { read: async () => ({}) };
  const actions = dependencies.actions || {};
  const supplementaryRenderers = Array.isArray(dependencies.supplementaryRenderers) ? dependencies.supplementaryRenderers : [];
  const connectivity = dependencies.connectivity || { isOnline: () => true };
  const now = dependencies.now || (() => new Date().toISOString());
  let state = {
    section: 'overview',
    model: null
  };

  async function load(options = {}) {
    state.section = options.section || state.section;
    if (connectivity.isOnline?.() === false) {
      const offline = viewState.offline();
      presenter.render(offline);
      return offline;
    }
    presenter.render(viewState.loading());
    try {
      const payload = await readSource.read({ section: state.section });
      state.model = readModel({
        ...(payload || {}),
        options: {
          ...(payload?.options || {}),
          activeSection: state.section,
          generatedAt: now()
        }
      });
      const success = viewState.success(state.model);
      presenter.render(success);
      supplementaryRenderers.forEach((render) => render?.(state.model));
      return success;
    } catch (error) {
      const failed = viewState.failure(error);
      presenter.render(failed);
      return failed;
    }
  }

  function switchSection(section = 'overview') {
    state.section = section || 'overview';
    return load({ section: state.section });
  }

  function openPersonForm() {
    const modal = documentRef.getElementById('add-person-modal');
    const name = documentRef.getElementById('person-input');
    const salary = documentRef.getElementById('person-base-salary');
    if (name) name.value = '';
    if (salary) salary.value = '';
    modal?.classList.remove('hidden');
    name?.focus?.();
  }

  function closePersonForm() {
    documentRef.getElementById('add-person-modal')?.classList.add('hidden');
  }

  async function savePerson() {
    const name = documentRef.getElementById('person-input')?.value?.trim() || '';
    const salaryBase = roundCurrency(documentRef.getElementById('person-base-salary')?.value || 0);
    const receivingType = documentRef.getElementById('person-receiving-type')?.value === 'quinzenal' ? 'quinzenal' : 'mensal';
    if (!name) return { success: false, code: 'SETTINGS_PERSON_NAME_REQUIRED' };
    const result = await actions.createPerson?.({ person: name, salary_base: salaryBase, receiving_type: receivingType });
    if (successful(result)) {
      closePersonForm();
      await load();
    }
    return result || { success: false, code: 'SETTINGS_ACTION_UNAVAILABLE' };
  }

  function openMacroForm() {
    const modal = documentRef.getElementById('add-macro-modal');
    const name = documentRef.getElementById('macro-input');
    const scope = documentRef.getElementById('macro-scope');
    const scopeWrap = documentRef.getElementById('macro-scope-wrap');
    const canManageShared = state.model?.permissions?.canManageSharedReferences === true;
    if (name) name.value = '';
    configureScopeControl({ scope, scopeWrap, value: 'personal', canManageShared });
    modal?.classList.remove('hidden');
    name?.focus?.();
  }

  function closeMacroForm() {
    documentRef.getElementById('add-macro-modal')?.classList.add('hidden');
  }

  async function saveMacro() {
    const name = documentRef.getElementById('macro-input')?.value?.trim() || '';
    const scope = documentRef.getElementById('macro-scope')?.value || '';
    if (!name) return { success: false, code: 'SETTINGS_MACRO_NAME_REQUIRED' };
    const result = await actions.createMacro?.({ macro_category: name, shared_scope: scope });
    if (successful(result)) {
      closeMacroForm();
      await load();
    }
    return result || { success: false, code: 'SETTINGS_ACTION_UNAVAILABLE' };
  }

  function ensureCategoryModalInSettings() {
    const modal = documentRef.getElementById('category-modal');
    const settingsView = documentRef.getElementById('view-configuracoes');
    if (modal && settingsView && modal.parentElement?.id === 'view-categorias') {
      settingsView.appendChild(modal);
    }
    return modal;
  }

  function openCategoryForm(categoryId = '') {
    const category = categoryId ? state.model?.references?.effectiveCategories?.find((item) => String(item.id || item.category_id) === String(categoryId)) : null;
    const modal = ensureCategoryModalInSettings();
    const title = documentRef.getElementById('category-modal-title');
    const saveButton = documentRef.getElementById('category-save-button');
    const name = documentRef.getElementById('cat-name');
    const macro = documentRef.getElementById('cat-macro');
    const color = documentRef.getElementById('cat-color');
    const icon = documentRef.getElementById('cat-icon');
    const scope = documentRef.getElementById('cat-scope');
    const scopeWrap = documentRef.getElementById('cat-scope-wrap');
    const canManageShared = state.model?.permissions?.canManageSharedReferences === true;
    const globalReadOnly = category?.shared_scope === 'global' && !canManageShared;
    if (title) title.textContent = category ? 'Editar Categoria' : 'Nova Categoria';
    if (saveButton) saveButton.textContent = category ? 'Salvar alterações' : 'Salvar';
    if (name) name.value = category?.category_name || '';
    if (macro) macro.value = category?.macro_category || 'FIXO';
    if (color) color.value = category?.category_color || '#38bdf8';
    if (icon) icon.value = category?.category_icon || 'tag';
    configureScopeControl({
      scope,
      scopeWrap,
      value: category?.shared_scope === 'global' ? 'global' : 'personal',
      canManageShared,
      forceReadOnly: Boolean(category)
    });
    [name, macro, color, icon].forEach((input) => {
      if (input) input.disabled = globalReadOnly;
    });
    if (saveButton) saveButton.disabled = globalReadOnly;
    if (modal) modal.dataset.settingsEditingCategoryId = categoryId || '';
    modal?.classList.remove('hidden');
  }

  function closeCategoryForm() {
    const modal = documentRef.getElementById('category-modal');
    if (modal) modal.dataset.settingsEditingCategoryId = '';
    modal?.classList.add('hidden');
  }

  async function saveCategory() {
    const modal = documentRef.getElementById('category-modal');
    const categoryId = modal?.dataset?.settingsEditingCategoryId || '';
    const name = documentRef.getElementById('cat-name')?.value?.trim() || '';
    const macro = documentRef.getElementById('cat-macro')?.value || '';
    const color = documentRef.getElementById('cat-color')?.value || '#38bdf8';
    const icon = documentRef.getElementById('cat-icon')?.value || 'tag';
    const scope = documentRef.getElementById('cat-scope')?.value || '';
    if (!name) return { success: false, code: 'SETTINGS_CATEGORY_NAME_REQUIRED' };
    const payload = { id: categoryId, category_name: name, macro_category: macro, category_color: color, category_icon: icon, shared_scope: scope };
    const result = categoryId ? await actions.updateCategory?.(payload) : await actions.createCategory?.(payload);
    if (successful(result)) {
      closeCategoryForm();
      await load();
    }
    return result || { success: false, code: 'SETTINGS_ACTION_UNAVAILABLE' };
  }

  async function updatePersonReceivingType(personId = '', value = '') {
    const result = await actions.updatePerson?.({ id: personId, fields: { receiving_type: value === 'quinzenal' ? 'quinzenal' : 'mensal' } });
    if (successful(result)) await load();
    return result || { success: false, code: 'SETTINGS_ACTION_UNAVAILABLE' };
  }

  function destroy() {
    state = { section: 'overview', model: null };
  }

  return {
    load,
    render: load,
    switchSection,
    openPersonForm,
    closePersonForm,
    savePerson,
    openMacroForm,
    closeMacroForm,
    saveMacro,
    openCategoryForm,
    closeCategoryForm,
    saveCategory,
    updatePersonReceivingType,
    destroy,
    getState: () => ({ ...state })
  };
}
