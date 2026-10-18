import {
  byId as findById,
  renderListState as renderDomListState,
  setHidden as setElementHidden,
  setHtml as setElementHtml,
  setNodes as setElementNodes,
  setText as setElementText
} from './dom.js';
import { activateTab as activateNavigationTab } from './navigationTabs.js';

const DEFAULT_VIEWS = ['dashboard', 'mes-detalhe', 'saidas', 'entradas', 'parcelamentos', 'importacao', 'controle-horas', 'novo', 'configuracoes'];
const STATE_KEY = Symbol.for('finance.legacyUiBridgeState');

function getState(target) {
  if (!target[STATE_KEY]) {
    Object.defineProperty(target, STATE_KEY, {
      value: {
        toastHideTimer: null,
        sidebarAnimationTimer: null
      },
      enumerable: false,
      configurable: false,
      writable: false
    });
  }
  return target[STATE_KEY];
}

export function createLegacyUiBridge(target = globalThis) {
  const state = getState(target);
  const documentRef = target.document;

  function byId(id) {
    return findById(id, documentRef);
  }

  function showElement(id) {
    const element = byId(id);
    if (element) element.classList.remove('hidden');
    return element;
  }

  function hideElement(id) {
    const element = byId(id);
    if (element) element.classList.add('hidden');
    return element;
  }

  function showToast(message, isError = false) {
    const toast = byId('toast');
    if (!toast) return;

    if (state.toastHideTimer) target.clearTimeout(state.toastHideTimer);
    toast.textContent = String(message || '');
    toast.className = `fixed bottom-4 right-4 px-4 py-2 rounded-lg text-sm font-medium shadow-lg z-[100] ${isError ? 'bg-danger text-white' : 'bg-success text-bg'}`;
    toast.classList.remove('hidden');
    state.toastHideTimer = target.setTimeout(() => {
      toast.classList.add('hidden');
      state.toastHideTimer = null;
    }, 2500);
  }

  function showOverlay(overlayId) {
    const overlay = byId(overlayId);
    const appRoot = documentRef.body || byId('app');
    if (!overlay) return null;
    if (appRoot && overlay.parentElement !== appRoot) appRoot.appendChild(overlay);
    overlay.classList.remove('hidden');
    return overlay;
  }

  function hideOverlay(overlayId) {
    return hideElement(overlayId);
  }

  function setSidebarOpen(isOpen) {
    const overlay = byId('sidebar-overlay');
    const sidebar = byId('sidebar');
    if (!overlay || !sidebar) return Boolean(isOpen);

    if (state.sidebarAnimationTimer) {
      target.clearTimeout(state.sidebarAnimationTimer);
      state.sidebarAnimationTimer = null;
    }

    if (isOpen) {
      overlay.classList.remove('hidden');
      state.sidebarAnimationTimer = target.setTimeout(() => {
        overlay.classList.remove('opacity-0');
        sidebar.classList.remove('-translate-x-full');
        state.sidebarAnimationTimer = null;
      }, 10);
    } else {
      overlay.classList.add('opacity-0');
      sidebar.classList.add('-translate-x-full');
      state.sidebarAnimationTimer = target.setTimeout(() => {
        overlay.classList.add('hidden');
        state.sidebarAnimationTimer = null;
      }, 300);
    }

    return Boolean(isOpen);
  }

  function toggleSidebar(isCurrentlyOpen) {
    const nextState = !Boolean(isCurrentlyOpen);
    setSidebarOpen(nextState);
    return nextState;
  }

  function updateBackButton(canGoBack) {
    const button = byId('btn-go-back');
    if (button) button.classList.toggle('hidden', !canGoBack);
  }

  function setHidden(id, isHidden) {
    const element = byId(id);
    setElementHidden(element, isHidden);
    return element;
  }

  function setHtml(id, html) {
    const element = byId(id);
    setElementHtml(element, html);
    return element;
  }

  function setNodes(id, nodes = []) {
    const element = byId(id);
    setElementNodes(element, nodes);
    return element;
  }

  function setText(id, text) {
    const element = byId(id);
    setElementText(element, text);
    return element;
  }

  function renderListState(config = {}) {
    const {
      emptyId,
      listId,
      metaId,
      paginationId,
      ...options
    } = config;

    renderDomListState({
      ...options,
      empty: byId(emptyId),
      list: byId(listId),
      meta: byId(metaId),
      pagination: paginationId ? byId(paginationId) : null
    });
  }

  function renderTotalBox(id, html, isVisible) {
    const element = byId(id);
    if (!element) return null;
    element.classList.toggle('hidden', !isVisible);
    element.innerHTML = isVisible ? String(html || '') : '';
    return element;
  }

  function activateTab(tab, views = DEFAULT_VIEWS) {
    activateNavigationTab(tab, target, views);
  }

  return {
    activateTab,
    hideElement,
    hideOverlay,
    renderListState,
    renderTotalBox,
    setSidebarOpen,
    setHidden,
    setHtml,
    setNodes,
    setText,
    showElement,
    showOverlay,
    showToast,
    toggleSidebar,
    updateBackButton
  };
}

export function installLegacyUiBridge(target = globalThis) {
  if (!target?.document) return null;
  return installFinanceUiConsumerAdapters(target, createLegacyUiBridge(target));
}

export function createFinanceUiConsumerAdapters(api = {}) {
  return {
    activateTab: (...args) => api.activateTab?.(...args),
    hideOverlay: (...args) => api.hideOverlay?.(...args),
    renderListState: (...args) => api.renderListState?.(...args),
    renderTotalBox: (...args) => api.renderTotalBox?.(...args),
    setHidden: (...args) => api.setHidden?.(...args),
    setHtml: (...args) => api.setHtml?.(...args),
    setText: (...args) => api.setText?.(...args),
    setSidebarOpen: (...args) => api.setSidebarOpen?.(...args),
    showOverlay: (...args) => api.showOverlay?.(...args),
    showToast: (...args) => api.showToast?.(...args),
    toggleSidebar: (...args) => api.toggleSidebar?.(...args),
    updateBackButton: (...args) => api.updateBackButton?.(...args)
  };
}

export function installFinanceUiConsumerAdapters(target = globalThis, api = null) {
  if (!target?.document) return null;
  target.financeApp = target.financeApp || {};
  if (target.financeApp.financeUiAdapters) return target.financeApp.financeUiAdapters;
  const visualApi = api || createLegacyUiBridge(target);
  const adapters = createFinanceUiConsumerAdapters(visualApi);
  target.financeApp.financeUiAdapters = adapters;
  return adapters;
}
