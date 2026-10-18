import { normalizeCompetenceKey } from '../../core/dates.js';
import { appState } from '../../state/appState.js';
import {
  getDashboardAggregations,
  getDashboardBaseEntradas,
  getDashboardBaseSaidas,
  getDashboardEntradasSummary,
  getDashboardTotals,
  getDashboardPersonBalances,
  installDashboardDataGlobals
} from './dashboardData.js';
import {
  renderDashboardChartsFromAggregations,
  renderTrendChartByDashboardFilter,
  upsertDashboardChart,
  installDashboardChartGlobals
} from './dashboardCharts.js';
import {
  installDashboardCardGlobals,
  openDashboardExpenseCategoryModal,
  openDashboardExpenseRecordsModal,
  openDashboardSaidasDetail,
  renderDashboardPersonBalanceCards,
  renderDashboardRecentListFromBase,
  renderDashboardSummaryFromBase
} from './dashboardCards.js';
import {
  installDashboardEventGlobals,
  installDashboardEvents
} from './dashboardEvents.js';
import {
  getCurrentMonthFallback,
  getDashboardFilterMonthRange,
  getDashboardMonthKeys,
  getDashboardRecordCompetence
} from './dashboardFilters.js';
import { scheduleIconRender } from '../icons.js';

let dashboardFilterRenderFrame = 0;
let dashboardHeavyRenderHandle = 0;
let dashboardRenderToken = 0;

function cancelDashboardHeavyRender(target = window) {
  if (!dashboardHeavyRenderHandle) return;
  if (typeof target.cancelIdleCallback === 'function') target.cancelIdleCallback(dashboardHeavyRenderHandle);
  else cancelAnimationFrame(dashboardHeavyRenderHandle);
  dashboardHeavyRenderHandle = 0;
}

function scheduleDashboardHeavyRender(callback, target = window) {
  cancelDashboardHeavyRender(target);
  if (typeof target.requestIdleCallback === 'function') {
    dashboardHeavyRenderHandle = target.requestIdleCallback(() => {
      dashboardHeavyRenderHandle = 0;
      callback();
    }, { timeout: 240 });
    return;
  }

  dashboardHeavyRenderHandle = target.requestAnimationFrame(() => {
    dashboardHeavyRenderHandle = 0;
    callback();
  });
}

function shiftDashboardMonthValue(value, delta) {
  if (typeof window.shiftMonthValue === 'function') return window.shiftMonthValue(value, delta);
  const [year, month] = String(value || '').split('-').map(Number);
  if (!year || !month) return value;
  const next = new Date(year, month - 1 + delta, 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`;
}

export function renderDashboard() {
  const renderToken = ++dashboardRenderToken;
  window.updateDashboardFilterChipState?.();
  window.renderActiveDashboardFilters?.();
  const aggregations = getDashboardAggregations();
  renderDashboardSummaryFromBase(aggregations);
  renderDashboardPersonBalanceCards();
  renderDashboardRecentListFromBase(aggregations);
  if (typeof renderDashboardParcelamentosCards === 'function') {
      renderDashboardParcelamentosCards();
  } else if (typeof window.renderDashboardParcelamentosCards === 'function') {
      window.renderDashboardParcelamentosCards();
  }
  scheduleIconRender(document.getElementById('summary-cards') || document, window.lucide);
  scheduleIconRender(document.getElementById('dashboard-parcelamentos-section') || document, window.lucide);
  scheduleIconRender(document.getElementById('recent-list') || document, window.lucide);

  scheduleDashboardHeavyRender(() => {
    if (renderToken !== dashboardRenderToken) return;
    renderDashboardChartsFromAggregations(aggregations);
    renderTrendChartByDashboardFilter();
  });
}

export function scheduleDashboardRender() {
  if (dashboardFilterRenderFrame) cancelAnimationFrame(dashboardFilterRenderFrame);
  dashboardFilterRenderFrame = requestAnimationFrame(() => {
    dashboardFilterRenderFrame = 0;
    window.closeDashboardExpenseCategoryModal?.();
    renderDashboard();
  });
}

export function shiftDashboardCompetenceRange(delta) {
  const startField = document.getElementById('f-comp-start');
  const endField = document.getElementById('f-comp-end');
  if (!startField || !endField) return;
  const fallback = getCurrentMonthFallback();
  const start = normalizeCompetenceKey(startField.value || fallback) || fallback;
  const end = normalizeCompetenceKey(endField.value || start) || start;
  startField.value = shiftDashboardMonthValue(start, Number(delta) || 0) || start;
  endField.value = shiftDashboardMonthValue(end, Number(delta) || 0) || end;
  window.closeDashboardExpenseCategoryModal?.();
  scheduleDashboardRender();
}

export function installDashboardRenderer(target = window) {
  if (!target.__legacyRenderDashboardPersonBalanceCards && typeof target.renderDashboardPersonBalanceCards === 'function') {
    target.__legacyRenderDashboardPersonBalanceCards = target.renderDashboardPersonBalanceCards;
  }

  installDashboardDataGlobals(target);
  installDashboardChartGlobals(target);
  installDashboardCardGlobals(target);
  installDashboardEventGlobals(target);

  Object.assign(target, {
    getDashboardFilterMonthRange,
    getDashboardRecordCompetence,
    getDashboardMonthKeys,
    renderDashboard,
    scheduleDashboardRender,
    shiftDashboardCompetenceRange,
    getDashboardBaseSaidas,
    getDashboardBaseEntradas,
    getDashboardTotals,
    getDashboardEntradasSummary,
    getDashboardPersonBalances,
    getDashboardAggregations,
    renderDashboardChartsFromAggregations,
    renderTrendChartByDashboardFilter,
    upsertDashboardChart,
    renderDashboardSummaryFromBase,
    renderDashboardPersonBalanceCards,
    renderDashboardRecentListFromBase,
    openDashboardExpenseRecordsModal,
    openDashboardExpenseCategoryModal,
    openDashboardSaidasDetail
  });

  installDashboardEvents(scheduleDashboardRender);
  target.financeDashboard = {
    renderDashboard,
    scheduleDashboardRender,
    shiftDashboardCompetenceRange,
    getDashboardBaseSaidas,
    getDashboardBaseEntradas,
    getDashboardTotals,
    getDashboardEntradasSummary,
    getDashboardPersonBalances,
    getDashboardAggregations
  };

  if (appState.currentTab === 'dashboard') renderDashboard();
}

if (typeof window !== 'undefined') {
  installDashboardRenderer(window);
}
