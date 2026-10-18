import {
  createViewStatePilot,
  toOfflineState
} from '../../application/resilience/asyncViewState.js';
import { normalizeApplicationError } from '../../application/resilience/errorNormalization.js';
import { buildDashboardReadModel } from '../../application/readModels/dashboardReadModel.js';
import { createDashboardPresenter } from './dashboardPresenter.js';

export function createDashboardController(dependencies = {}) {
  const readSource = dependencies.readSource || { read: () => [] };
  const readModel = dependencies.readModel || buildDashboardReadModel;
  const presenter = dependencies.presenter || createDashboardPresenter();
  const connectivity = dependencies.connectivity || { isOnline: () => true };
  const errorReporter = dependencies.errorReporter || { capture: () => {} };
  const viewState = dependencies.viewState || createViewStatePilot('dashboard');
  const subscriptions = new Set();
  let currentFilters = {};

  function cleanupSubscriptions() {
    for (const unsubscribe of subscriptions) {
      if (typeof unsubscribe === 'function') unsubscribe();
    }
    subscriptions.clear();
  }

  async function load(filters = currentFilters) {
    currentFilters = { ...filters };
    if (typeof connectivity.isOnline === 'function' && connectivity.isOnline() === false) {
      const offline = toOfflineState(viewState.getState());
      presenter.render(offline);
      return offline;
    }

    presenter.render(viewState.loading());
    try {
      const payload = await readSource.read(currentFilters);
      const model = readModel({
        records: payload?.records || [],
        filters: currentFilters,
        referenceData: payload?.referenceData || {},
        metadata: payload?.metadata || {},
        options: payload?.options || {}
      });
      const state = viewState.success(model);
      presenter.render(state);
      return state;
    } catch (error) {
      const normalized = normalizeApplicationError(error, { operation: 'dashboard.load' });
      errorReporter.capture?.(normalized);
      const state = viewState.error(normalized);
      presenter.render(state);
      return state;
    }
  }

  function setFilters(filters = {}) {
    currentFilters = { ...currentFilters, ...filters };
    return load(currentFilters);
  }

  function subscribe(factory) {
    const unsubscribe = typeof factory === 'function' ? factory((payload = {}) => load(payload.filters || currentFilters)) : null;
    if (typeof unsubscribe === 'function') subscriptions.add(unsubscribe);
    return unsubscribe;
  }

  return {
    load,
    setFilters,
    subscribe,
    destroy: cleanupSubscriptions,
    getSubscriptionCount: () => subscriptions.size,
    getState: viewState.getState
  };
}
