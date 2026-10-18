import { createPlannerController } from './plannerController.js';

function defineModernFlag(fn) {
  if (typeof fn !== 'function') return fn;
  try {
    Object.defineProperty(fn, '__financeModernPlanner', { value: true });
  } catch {}
  return fn;
}

function createReadSource(target = globalThis) {
  return {
    read: async () => {
      return { records: Array.isArray(target.allRecords) ? target.allRecords : [] };
    },
    subscribe: null
  };
}

function bindPlannerActions(target, controller) {
  const documentRef = target.document;
  if (!documentRef || documentRef.documentElement.dataset.financePlannerModernActionsBound) return;
  documentRef.addEventListener('click', (event) => {
    const button = event.target.closest?.('[data-planner-action]');
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    controller.delegateExpenseAction(button.dataset.plannerAction, button.dataset.plannerEventId);
  });
  documentRef.documentElement.dataset.financePlannerModernActionsBound = 'true';
}

export function installPlannerActiveUi(target = globalThis, options = {}) {
  if (!target?.document) return null;
  if (target.openPlannerModal?.__financeModernPlanner === true && options.reuseExisting !== false) {
    return { installed: true, alreadyInstalled: true };
  }

  const controller = options.controller || createPlannerController({
    target,
    document: target.document,
    storage: target.localStorage,
    ownerProvider: options.ownerProvider,
    localEventStore: options.localEventStore,
    financialActions: options.financialActions,
    readSource: options.readSource || createReadSource(target),
    presenter: options.presenter,
    now: options.now
  });

  target.openPlannerModal = defineModernFlag(() => controller.open());
  target.closePlannerModal = defineModernFlag(() => controller.close());
  target.renderPlannerModal = defineModernFlag(() => controller.render());
  target.savePlannerEvent = defineModernFlag(() => controller.saveLocalEvent());
  target.deletePlannerEvent = defineModernFlag((id) => controller.deleteLocalEvent(id));
  target.shiftPlannerMonth = defineModernFlag((delta) => controller.shiftMonth(delta));
  target.selectPlannerDate = defineModernFlag((date) => controller.selectDate(date));

  bindPlannerActions(target, controller);

  return {
    installed: true,
    controller,
    destroy: () => controller.destroy()
  };
}
