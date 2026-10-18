import { describe, expect, it, vi } from 'vitest';
import { createNavigationCoordinator, installNavigationCoordinator } from '../../src/ui/navigation/navigationCoordinator.js';

describe('navigation coordinator', () => {
  it('runs the legacy navigation continuation and then the canonical tab activation', () => {
    const calls = [];
    const target = { currentTab: 'dashboard' };
    const coordinator = createNavigationCoordinator({
      target,
      continueNavigation: (tab, options) => {
        target.currentTab = tab;
        calls.push(`legacy:${tab}:${options.fromRouter === true}`);
      },
      activate: (tab, activationTarget) => {
        calls.push(`activate:${tab}:${activationTarget === target}`);
      }
    });

    coordinator.switchTab('saidas', { fromRouter: true });

    expect(target.currentTab).toBe('saidas');
    expect(calls).toEqual([
      'legacy:saidas:true',
      'activate:saidas:true'
    ]);
  });

  it('installs over the existing public switchTab bridge without creating another global bridge', () => {
    const previousSwitchTab = vi.fn(function switchTab(tab) {
      this.currentTab = tab;
      this.renderCurrentTab();
    });
    const target = {
      currentTab: 'dashboard',
      switchTab: previousSwitchTab,
      renderCurrentTab: vi.fn(),
      document: {
        getElementById: vi.fn(),
        querySelectorAll: vi.fn(() => [])
      }
    };

    installNavigationCoordinator(target);
    target.switchTab('entradas', { fromHistory: true });

    expect(previousSwitchTab).toHaveBeenCalledWith('entradas', { fromHistory: true });
    expect(target.currentTab).toBe('entradas');
    expect(target.renderCurrentTab).toHaveBeenCalledTimes(1);
  });

  it('does not wrap the same target twice', () => {
    const target = {
      currentTab: 'dashboard',
      switchTab: vi.fn(),
      renderCurrentTab: vi.fn(),
      document: {
        getElementById: vi.fn(),
        querySelectorAll: vi.fn(() => [])
      }
    };

    installNavigationCoordinator(target);
    const installedSwitchTab = target.switchTab;

    installNavigationCoordinator(target);

    expect(target.switchTab).toBe(installedSwitchTab);
  });
});
