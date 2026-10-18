import { appState } from '../../state/appState.js';
import { getDashboardBaseSaidas } from './dashboardData.js';
import { openDashboardSaidasDetail, openDashboardSummaryDetail } from './dashboardCards.js';

function bindField(id, renderScheduler) {
  const field = document.getElementById(id);
  if (!field || field.dataset.dashboardModuleBound === 'true') return;
  field.dataset.dashboardModuleBound = 'true';
  field.removeAttribute('onchange');
  field.addEventListener('change', () => {
    window.closeDashboardExpenseCategoryModal?.();
    renderScheduler();
  });
  field.addEventListener('input', renderScheduler);
}

export function bindDashboardBaseFilters(renderScheduler) {
  ['f-comp-start', 'f-comp-end', 'f-person', 'f-macro', 'f-cycle'].forEach((id) => bindField(id, renderScheduler));
}

export function bindDashboardSummaryEvents(renderScheduler) {
  const summary = document.getElementById('summary-cards');
  if (!summary || summary.dataset.dashboardSummaryModuleBound === 'true') return;
  summary.dataset.dashboardSummaryModuleBound = 'true';
  summary.addEventListener('click', (event) => {
    const detailButton = event.target.closest('[data-dashboard-detail]');
    if (detailButton && summary.contains(detailButton)) {
      event.stopPropagation();
      openDashboardSummaryDetail(detailButton.dataset.dashboardDetail);
      return;
    }

    const card = event.target.closest('[data-dashboard-card]');
    if (!card || !summary.contains(card)) return;
    const targetCard = card.dataset.dashboardCard || null;
    if (typeof window.setFocusedCard === 'function') {
      window.setFocusedCard(targetCard);
      return;
    }
    appState.focusedDashboardCard = appState.focusedDashboardCard === targetCard ? null : targetCard;
    renderScheduler();
  });

  const parcelamentosCards = document.getElementById('dashboard-parcelamentos-cards');
  if (parcelamentosCards && parcelamentosCards.dataset.dashboardSummaryModuleBound !== 'true') {
    parcelamentosCards.dataset.dashboardSummaryModuleBound = 'true';
    parcelamentosCards.addEventListener('click', (event) => {
      const detailButton = event.target.closest('[data-dashboard-detail]');
      if (detailButton && parcelamentosCards.contains(detailButton)) {
        event.stopPropagation();
        openDashboardSummaryDetail(detailButton.dataset.dashboardDetail);
      }
    });
  }
}

export function installDashboardEvents(renderScheduler) {
  bindDashboardBaseFilters(renderScheduler);
  bindDashboardSummaryEvents(renderScheduler);
}

export function installDashboardEventGlobals(target = window) {
  Object.assign(target, {
    bindDashboardBaseFilters,
    bindDashboardSummaryEvents,
    openDashboardSaidasDetail,
    getDashboardBaseSaidas
  });
}
