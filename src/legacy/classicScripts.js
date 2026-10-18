import { installGlobalBridge } from './globalBridge.js';

const LEGACY_CLASSIC_SCRIPTS = [
  ['src/legacy/inline/part-03.js', () => import('./inline/part-03.js?raw')],
  ['src/legacy/inline/part-04.js', () => import('./inline/part-04.js?raw')],
  ['src/legacy/inline/part-05.js', () => import('./inline/part-05.js?raw')],
  ['src/legacy/inline/part-06.js', () => import('./inline/part-06.js?raw')],
  ['src/legacy/inline/part-07.js', () => import('./inline/part-07.js?raw')],
  ['src/legacy/inline/part-08.js', () => import('./inline/part-08.js?raw')],
  ['src/legacy/inline/part-09.js', () => import('./inline/part-09.js?raw')],
  ['src/legacy/inline/part-10.js', () => import('./inline/part-10.js?raw')],
  ['src/legacy/inline/part-11.js', () => import('./inline/part-11.js?raw')],
  ['src/legacy/inline/part-12.js', () => import('./inline/part-12.js?raw')],
  ['src/legacy/inline/part-13.js', () => import('./inline/part-13.js?raw')],
  ['src/legacy/inline/part-14.js', () => import('./inline/part-14.js?raw')],
  ['src/legacy/inline/part-15.js', () => import('./inline/part-15.js?raw')],
  ['src/legacy/inline/part-16.js', () => import('./inline/part-16.js?raw')],
  ['src/legacy/inline/part-17.js', () => import('./inline/part-17.js?raw')],
  ['src/legacy/inline/part-18.js', () => import('./inline/part-18.js?raw')],
  ['src/legacy/inline/part-19.js', () => import('./inline/part-19.js?raw')],
  ['src/legacy/inline/part-20.js', () => import('./inline/part-20.js?raw')],
  ['src/legacy/inline/part-26.js', () => import('./inline/part-26.js?raw')],
  ['src/legacy/inline/part-27.js', () => import('./inline/part-27.js?raw')],
  ['src/legacy/inline/part-28.js', () => import('./inline/part-28.js?raw')],
  ['src/legacy/inline/part-29.js', () => import('./inline/part-29.js?raw')]
];

function runClassicScript(source) {
  // Indirect eval runs in the global scope, preserving classic script semantics
  // while the files are gradually converted to real modules.
  (0, eval)(`${source}\n//# sourceURL=finance-legacy-classic-bundle.js`);
}

function markBootstrap(name, target = globalThis) {
  try {
    if (!target.performance?.getEntriesByName?.(name, 'mark')?.length) target.performance?.mark?.(name);
  } catch {}
}

export async function loadLegacyClassicScripts(target = window) {
  if (target.__financeLegacyClassicScriptsPromise) return target.__financeLegacyClassicScriptsPromise;

  target.__financeLegacyClassicScriptsPromise = (async () => {
    markBootstrap('finance-legacy-loader-start', target);
    const { installPerformanceMonitor } = await import('../services/performanceMonitor.js');
    installPerformanceMonitor(target);
    const { installLibraryLoaderBridge } = await import('./libraryLoaderBridge.js');
    installLibraryLoaderBridge(target);
    const { installLegacyUiBridge } = await import('../ui/legacy-ui.js');
    installLegacyUiBridge(target);
    markBootstrap('finance-bridges-ready', target);

    const sources = await Promise.all(
      LEGACY_CLASSIC_SCRIPTS.map(([, load]) => load().then((mod) => mod.default))
    );
    runClassicScript(sources.join('\n'));
    installGlobalBridge(target);
    const { installNavigationCoordinator } = await import('../ui/navigation/navigationCoordinator.js');
    installNavigationCoordinator(target);

    const { installEntryApplicationGlobals } = await import('../application/entries/index.js');
    installEntryApplicationGlobals(target);
    await import('../ui/monthDetail/monthDetailEvents.js');
    await import('../ui/dashboard/dashboardRenderer.js');
    await import('../ui/router.js');

    target.dispatchEvent(new Event('financeLegacyReady'));
    markBootstrap('finance-legacy-loader-end', target);
    return { loaded: LEGACY_CLASSIC_SCRIPTS.map(([name]) => name) };
  })().catch((error) => {
    target.__financeLegacyClassicScriptsPromise = null;
    console.error('Erro ao carregar scripts legados', error);
    throw error;
  });

  return target.__financeLegacyClassicScriptsPromise;
}
