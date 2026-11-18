import { createPlannerController } from './plannerController.js';
import { syncPlannerExpandAll, togglePlannerDetails } from './plannerPresenter.js';

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
    // Botao "x" do modal e clique no fundo escurecido fecham o Planner.
    const closeButton = event.target.closest?.('[data-close-modal="planner-modal"]');
    const modal = documentRef.getElementById?.('planner-modal');
    const clickedBackdrop = modal && !modal.classList.contains('hidden')
      && (event.target === modal || event.target === modal.firstElementChild);
    if (closeButton || clickedBackdrop) {
      event.preventDefault();
      controller.close();
      return;
    }

    // Seta "Expandir/Recolher" abre ou fecha os detalhes de todos os itens da lista.
    if (event.target.closest?.('[data-planner-expand-all]')) {
      event.preventDefault();
      togglePlannerDetails(documentRef);
      return;
    }

    // Cabecalho do dia na agenda do mes e botao "Ver mes" filtram a lista pelo dia.
    const pickDate = event.target.closest?.('[data-planner-pick-date]');
    if (pickDate) {
      event.preventDefault();
      controller.selectDate(pickDate.dataset.plannerPickDate);
      return;
    }

    const button = event.target.closest?.('[data-planner-action]');
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    controller.delegateExpenseAction(button.dataset.plannerAction, button.dataset.plannerEventId);
  });
  // "toggle" nao borbulha: escuta na captura para manter o rotulo Expandir/Recolher em dia.
  documentRef.addEventListener('toggle', (event) => {
    if (event.target?.classList?.contains('planner-item')) syncPlannerExpandAll(documentRef);
  }, true);
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
