import { createSettingsController } from './settingsController.js';

function defineModernFlag(fn) {
  if (typeof fn !== 'function') return fn;
  try {
    Object.defineProperty(fn, '__financeModernSettings', { value: true });
  } catch {}
  return fn;
}

function bindSettingsActions(target, controller) {
  const documentRef = target.document;
  if (!documentRef || documentRef.documentElement.dataset.financeSettingsModernActionsBound) return;
  documentRef.addEventListener('change', (event) => {
    const input = event.target.closest?.('[data-settings-action="update-person-receiving-type"]');
    if (!input) return;
    controller.updatePersonReceivingType(input.dataset.personId, input.value);
  });
  documentRef.documentElement.dataset.financeSettingsModernActionsBound = 'true';
}

export function installSettingsActiveUi(target = globalThis, options = {}) {
  if (!target?.document) return null;
  if (target.renderConfiguracoes?.__financeModernSettings === true && options.reuseExisting !== false) {
    return { installed: true, alreadyInstalled: true };
  }

  const controller = options.controller || createSettingsController({
    document: target.document,
    readSource: options.readSource,
    actions: options.actions,
    supplementaryRenderers: options.supplementaryRenderers,
    connectivity: options.connectivity,
    presenter: options.presenter,
    now: options.now
  });

  target.renderConfiguracoes = defineModernFlag(() => controller.render());
  target.addPerson = defineModernFlag(() => controller.openPersonForm());
  target.closeAddPersonModal = defineModernFlag(() => controller.closePersonForm());
  target.savePerson = defineModernFlag(() => controller.savePerson());
  target.addMacroCategory = defineModernFlag(() => controller.openMacroForm());
  target.closeAddMacroModal = defineModernFlag(() => controller.closeMacroForm());
  target.saveMacroCategory = defineModernFlag(() => controller.saveMacro());
  target.openCategoryForm = defineModernFlag(() => controller.openCategoryForm());
  target.openEditCategory = defineModernFlag((categoryId) => controller.openCategoryForm(categoryId));
  target.closeCategoryForm = defineModernFlag(() => controller.closeCategoryForm());
  target.saveCategory = defineModernFlag(() => controller.saveCategory());

  bindSettingsActions(target, controller);

  return {
    installed: true,
    controller,
    destroy: () => controller.destroy()
  };
}
