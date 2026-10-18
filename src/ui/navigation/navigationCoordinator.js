import { activateTab } from '../navigationTabs.js';

const installedCoordinators = new WeakMap();

export function createNavigationCoordinator({
  target = globalThis,
  activate = activateTab,
  continueNavigation = (tab) => {
    target.currentTab = tab;
    target.renderCurrentTab?.();
  }
} = {}) {
  function switchTab(tab, options = {}) {
    continueNavigation(tab, options);
    activate(tab, target);
  }

  return {
    switchTab
  };
}

export function installNavigationCoordinator(target = globalThis) {
  const installed = installedCoordinators.get(target);
  if (installed && target.switchTab === installed.switchTab) return installed.coordinator;

  const previousSwitchTab = target.switchTab;
  const coordinator = createNavigationCoordinator({
    target,
    continueNavigation: (tab, options) => {
      if (typeof previousSwitchTab === 'function') {
        previousSwitchTab.call(target, tab, options);
        return;
      }
      target.currentTab = tab;
      target.renderCurrentTab?.();
    }
  });

  function switchTab(tab, options = {}) {
    return coordinator.switchTab(tab, options);
  }

  target.switchTab = switchTab;
  installedCoordinators.set(target, { switchTab, coordinator });
  return coordinator;
}
