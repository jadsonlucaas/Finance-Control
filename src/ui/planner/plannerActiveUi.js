import { createPlannerController } from './plannerController.js';
import { setPlannerNewEventOpen, syncPlannerExpandAll, togglePlannerDetails } from './plannerPresenter.js';

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

    // "Novo evento" abre o formulario numa janela propria; o X ou o fundo fecham.
    if (event.target.closest?.('[data-planner-new-event]')) {
      event.preventDefault();
      setPlannerNewEventOpen(documentRef, true);
      return;
    }
    if (event.target.closest?.('[data-planner-close-new-event]')) {
      event.preventDefault();
      setPlannerNewEventOpen(documentRef, false);
      return;
    }

    // X e fundo da janela do dia desmarcam o dia (fecha a janela).
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
    if (button.disabled) return;
    // Excluir pede um segundo toque ("Confirmar exclusao") antes de apagar.
    if (button.dataset.plannerAction === 'delete' && button.dataset.confirming !== 'true') {
      button.dataset.confirming = 'true';
      button.textContent = 'Confirmar exclusão';
      setTimeout(() => {
        if (!button.isConnected || button.dataset.confirming !== 'true') return;
        button.dataset.confirming = '';
        button.textContent = 'Excluir';
      }, 4000);
      return;
    }
    button.disabled = true;
    Promise.resolve(controller.delegateExpenseAction(button.dataset.plannerAction, button.dataset.plannerEventId))
      .finally(() => {
        if (button.isConnected) button.disabled = false;
      });
  });
  // Esc fecha primeiro o formulario, depois a janela do dia; o Planner so fecha no proximo Esc.
  documentRef.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    const modal = documentRef.getElementById?.('planner-modal');
    if (!modal || modal.classList.contains('hidden')) return;
    const form = documentRef.getElementById('planner-new-event-dialog');
    const day = documentRef.getElementById('planner-day-dialog');
    if (form && !form.classList.contains('hidden')) {
      setPlannerNewEventOpen(documentRef, false);
    } else if (day && !day.classList.contains('hidden')) {
      const selected = controller.getState?.().selectedDate;
      if (selected) controller.selectDate(selected);
    } else {
      return;
    }
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);

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
    monthSummary: options.monthSummary,
    now: options.now
  });

  target.openPlannerModal = defineModernFlag(() => controller.open());
  target.closePlannerModal = defineModernFlag(() => controller.close());
  target.renderPlannerModal = defineModernFlag(() => controller.render());
  target.savePlannerEvent = defineModernFlag(async () => {
    const result = await controller.saveLocalEvent();
    if (result?.success) setPlannerNewEventOpen(target.document, false);
    return result;
  });
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
