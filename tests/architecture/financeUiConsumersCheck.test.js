import { describe, expect, it } from 'vitest';
import { analyzeFinanceUiConsumers } from '../../scripts/finance-ui-consumers-check.mjs';

const cleanLoader = {
  classicScripts: 22,
  evalExecutedScripts: 22,
  newEval: [],
  newFunction: []
};

const inventory = '| `showToast` | src/ui/toast.js | teste | evento | manter |\n';
const navigationCoordinatorSource = `
  import { activateTab } from '../navigationTabs.js';
  export function installNavigationCoordinator() {
    activateTab('dashboard');
  }
`;

describe('finance-ui-consumers check', () => {
  it('detects modern direct, adapter and dynamic bridge consumers separately', () => {
    const result = analyzeFinanceUiConsumers({
      loader: cleanLoader,
      globalInventory: inventory,
      modernEntries: ['src/ui/example.js'],
      sources: {
        'src/ui/example.js': `
          const direct = window.financeUI;
          const adapter = window.financeApp.financeUiAdapters;
          const dynamic = window['financeUI'];
          adapter.showToast?.('ok');
          direct.showToast?.('ok');
          dynamic.showToast?.('ok');
        `,
        'src/ui/legacy-ui.js': 'export function createFinanceUiConsumerAdapters(){ return { showToast: () => null }; } target.financeApp.financeUiAdapters = createFinanceUiConsumerAdapters({});',
        'src/ui/navigation/navigationCoordinator.js': navigationCoordinatorSource,
        'src/legacy/inline/part-08.js': '',
        'src/legacy/inline/part-14.js': ''
      }
    });

    expect(result.ok).toBe(false);
    expect(result.violations).toContain('MODERN_GLOBAL_UI_CONSUMERS_REMAIN');
    expect(result.modernGlobalUiConsumers).toEqual(expect.arrayContaining([
      'src/ui/example.js:2:window.financeUI',
      'src/ui/example.js:3:window.financeApp.financeUiAdapters',
      'src/ui/example.js:4:window[\'financeUI\']'
    ]));
    expect(result.unresolvedDynamicConsumers).toEqual(expect.arrayContaining([
      'src/ui/example.js:2:const direct = window.financeUI',
      'src/ui/example.js:4:window[\'financeUI\']'
    ]));
  });

  it('tracks aliases, destructuring, brackets and injected parameters without hiding runtime consumers', () => {
    const result = analyzeFinanceUiConsumers({
      loader: cleanLoader,
      globalInventory: inventory,
      modernEntries: ['src/ui/injected.js'],
      sources: {
        'src/ui/injected.js': `
          export function usesInjected(ui) {
            return ui.activateTab?.('dashboard');
          }
        `,
        'src/legacy/inline/part-03.js': `
          const ui = window['financeUI'];
          const { showToast } = window.financeApp.financeUiAdapters;
          const render = window.financeApp.financeUiAdapters.renderListState;
          showToast('ok');
          render({});
          ui.showToast('ok');
        `,
        'src/ui/legacy-ui.js': `
          export function createFinanceUiConsumerAdapters(){ return { showToast: () => null }; }
          target.financeApp.financeUiAdapters = createFinanceUiConsumerAdapters(createLegacyUiBridge(target));
        `,
        'src/ui/navigation/navigationCoordinator.js': navigationCoordinatorSource,
        'src/legacy/inline/part-07.js': '',
        'src/legacy/inline/part-08.js': '',
        'src/legacy/inline/part-14.js': '',
        'src/legacy/inline/part-29.js': ''
      }
    });

    expect(result.ok).toBe(true);
    expect(result.modernGlobalUiConsumers).toEqual([]);
    expect(result.aliasConsumers).toEqual(expect.arrayContaining([
      'src/legacy/inline/part-03.js:2:window[\'financeUI\']:alias',
      'src/legacy/inline/part-03.js:3:const { showToast } = window.financeApp.financeUiAdapters:alias',
      'src/legacy/inline/part-03.js:4:const render = window.financeApp.financeUiAdapters.renderListState:alias'
    ]));
    expect(result.remainingRuntimeConsumers).toEqual(['src/legacy/inline/part-03.js']);
    expect(result.bridgeDefinitions).toEqual(expect.arrayContaining([
      'src/ui/legacy-ui.js:3:financeApp.financeUiAdapters:definition'
    ]));
    expect(result.financeUiInstalled).toBe(false);
    expect(result.financeUiAdaptersInstalled).toBe(true);
  });

  it('rejects navigation that only swaps to another global UI bridge', () => {
    const result = analyzeFinanceUiConsumers({
      loader: cleanLoader,
      globalInventory: inventory,
      modernEntries: ['src/ui/example.js'],
      sources: {
        'src/ui/example.js': 'export const ok = true;',
        'src/ui/legacy-ui.js': 'export function createFinanceUiConsumerAdapters(){ return { setHtml: () => null, activateTab: () => null }; } target.financeApp.financeUiAdapters = createFinanceUiConsumerAdapters({});',
        'src/ui/navigation/navigationCoordinator.js': navigationCoordinatorSource,
        'src/legacy/inline/part-08.js': 'function switchTab(tab) { window.financeApp.financeUiAdapters.activateTab(tab); }',
        'src/legacy/inline/part-14.js': '',
        'src/legacy/inline/part-07.js': ''
      }
    });

    expect(result.ok).toBe(false);
    expect(result.violations).toContain('NAVIGATION_STILL_USES_GLOBAL_UI_BRIDGE');
    expect(result.navigationBridgeConsumers).toEqual([
      'src/legacy/inline/part-08.js:1:window.financeApp.financeUiAdapters.activateTab'
    ]);
  });

  it('rejects migrated classic navigation while the duplicated visual helper remains', () => {
    const result = analyzeFinanceUiConsumers({
      loader: cleanLoader,
      globalInventory: inventory,
      modernEntries: ['src/ui/example.js'],
      sources: {
        'src/ui/example.js': 'export const ok = true;',
        'src/ui/legacy-ui.js': 'export function createFinanceUiConsumerAdapters(){ return { setHtml: () => null, activateTab: () => null }; } target.financeApp.financeUiAdapters = createFinanceUiConsumerAdapters({});',
        'src/ui/navigation/navigationCoordinator.js': navigationCoordinatorSource,
        'src/legacy/inline/part-08.js': 'function switchTab(tab) { activateLegacyTabView(tab); }',
        'src/legacy/inline/part-14.js': '',
        'src/legacy/inline/part-07.js': 'window.financeApp.financeUiAdapters.setHtml("x", "");'
      }
    });

    expect(result.ok).toBe(false);
    expect(result.violations).toContain('NAVIGATION_ES_COORDINATOR_NOT_PROVEN');
    expect(result.part08HasClassicVisualActivation).toBe(true);
  });

  it('allows ES-coordinated navigation while preserving modern zero-consumer gate', () => {
    const result = analyzeFinanceUiConsumers({
      loader: cleanLoader,
      globalInventory: inventory,
      modernEntries: ['src/ui/example.js'],
      sources: {
        'src/ui/example.js': 'export const ok = true;',
        'src/ui/legacy-ui.js': 'export function createFinanceUiConsumerAdapters(){ return { setHtml: () => null, activateTab: () => null }; } target.financeApp.financeUiAdapters = createFinanceUiConsumerAdapters({});',
        'src/ui/navigation/navigationCoordinator.js': navigationCoordinatorSource,
        'src/legacy/inline/part-08.js': 'function switchTab(tab) { renderCurrentTab(); }',
        'src/legacy/inline/part-14.js': '',
        'src/legacy/inline/part-07.js': 'window.financeApp.financeUiAdapters.setHtml("x", "");'
      }
    });

    expect(result.ok).toBe(true);
    expect(result.modernGlobalUiConsumers).toEqual([]);
    expect(result.part08FinanceUiCalls).toBe(0);
    expect(result.part14FinanceUiCalls).toBe(0);
    expect(result.navigationBridgeConsumers).toEqual([]);
    expect(result.navigationCoordinatorUsesCanonical).toBe(true);
    expect(result.part08HasClassicVisualActivation).toBe(false);
    expect(result.navigationEvidenceStatus).toMatch(/^ok:/);
    expect(result.adapterAliasCallsByFile).toMatchObject({
      'src/legacy/inline/part-07.js': 1
    });
    expect(result.remainingConsumers).toEqual(['src/legacy/inline/part-07.js']);
    expect(result.remainingRuntimeConsumers).toEqual(['src/legacy/inline/part-07.js']);
    expect(result.financeUiInstalled).toBe(false);
    expect(result.financeUiAdaptersInstalled).toBe(true);
    expect(result.removedGlobalSurface).toEqual(['window.financeUI']);
  });
});
