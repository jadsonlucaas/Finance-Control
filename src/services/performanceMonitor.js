import { defineLegacyGlobalBridge } from '../legacy/bridgeRegistry.js';

const STORAGE_KEY = 'finance-control-performance-baselines';
const CRITICAL_FUNCTIONS = [
  'switchTab',
  'renderDashboard',
  'renderCurrentTab',
  'importSaidasSpreadsheet',
  'importEntradasSpreadsheet',
  'exportPDF'
];
const DASHBOARD_FILTER_IDS = ['f-comp-start', 'f-comp-end', 'f-person', 'f-macro', 'f-cycle'];
const BOOTSTRAP_MARKS = [
  'finance-app-entry-start',
  'finance-bridge-install-start',
  'finance-bridges-ready',
  'finance-legacy-loader-start',
  'finance-legacy-loader-end',
  'finance-auth-init-start',
  'finance-auth-init-end',
  'finance-shell-ready',
  'finance-first-screen-ready',
  'finance-bootstrap-complete'
];

const BOOTSTRAP_MEASURES = {
  app_bootstrap_ms: ['finance-app-entry-start', 'finance-shell-ready'],
  legacy_loader_ms: ['finance-legacy-loader-start', 'finance-legacy-loader-end'],
  bridge_install_ms: ['finance-bridge-install-start', 'finance-bridges-ready'],
  auth_init_ms: ['finance-auth-init-start', 'finance-auth-init-end'],
  first_screen_ready_ms: ['finance-app-entry-start', 'finance-first-screen-ready'],
  lazy_registration_ms: ['finance-legacy-loader-end', 'finance-shell-ready']
};

function defaultClock(target) {
  return {
    now: () => target.performance?.now?.() || Date.now(),
    bootStartedAt: target.performance?.timeOrigin || Date.now()
  };
}

function round(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function readPerformanceMark(performanceApi, name) {
  const entries = performanceApi?.getEntriesByName?.(name, 'mark') || [];
  return entries.length ? round(entries[entries.length - 1].startTime) : null;
}

export function createPerformanceMonitor(target = globalThis, options = {}) {
  const clock = options.clock || defaultClock(target);
  const storage = options.storage || target.localStorage;
  const performanceApi = options.performance || target.performance;
  const documentRef = options.document || target.document;
  const criticalFunctions = options.criticalFunctions || CRITICAL_FUNCTIONS;
  const dashboardFilterIds = options.dashboardFilterIds || DASHBOARD_FILTER_IDS;
  const measuresLimit = options.measuresLimit || 300;
  const dashboardMeasuresLimit = options.dashboardMeasuresLimit || 100;

  const state = {
    bootStartedAt: clock.bootStartedAt,
    firstContentfulPaint: null,
    paintObserverInstalled: false,
    loadCompleteAt: null,
    wrapped: new Set(),
    measures: [],
    counts: {
      dashboardFilterChanges: 0,
      importEntradasSpreadsheet: 0,
      importSaidasSpreadsheet: 0,
      renderCurrentTab: 0,
      renderDashboard: 0,
      switchTab: 0,
      exportPDF: 0
    },
    dashboardRendersByFilterChange: [],
    lastDashboardFilterChangeAt: 0
  };

  function now() {
    return clock.now();
  }

  function getMemorySnapshot() {
    const memory = performanceApi?.memory;
    if (!memory) return null;
    return {
      jsHeapSizeLimit: memory.jsHeapSizeLimit,
      totalJSHeapSize: memory.totalJSHeapSize,
      usedJSHeapSize: memory.usedJSHeapSize
    };
  }

  function getResourceSummary() {
    const resources = performanceApi?.getEntriesByType?.('resource') || [];
    const documentEntry = performanceApi?.getEntriesByType?.('navigation')?.[0];
    const allEntries = documentEntry ? [documentEntry, ...resources] : resources;

    return allEntries.reduce((summary, entry) => {
      const transferSize = Number(entry.transferSize) || 0;
      const encodedBodySize = Number(entry.encodedBodySize) || 0;
      const decodedBodySize = Number(entry.decodedBodySize) || 0;
      summary.count += 1;
      summary.transferSize += transferSize;
      summary.encodedBodySize += encodedBodySize;
      summary.decodedBodySize += decodedBodySize;
      if (entry.initiatorType) {
        summary.byType[entry.initiatorType] = (summary.byType[entry.initiatorType] || 0) + transferSize;
      }
      return summary;
    }, {
      count: 0,
      transferSize: 0,
      encodedBodySize: 0,
      decodedBodySize: 0,
      byType: {}
    });
  }

  function recordMeasure(name, duration, metadata = {}) {
    const measure = {
      name,
      duration: round(duration),
      at: new Date().toISOString(),
      memory: getMemorySnapshot(),
      ...metadata
    };
    state.measures.push(measure);
    if (state.measures.length > measuresLimit) state.measures.shift();
    return measure;
  }

  function finishMeasure(name, startedAt, metadata = {}) {
    state.counts[name] = (state.counts[name] || 0) + 1;
    const measure = recordMeasure(name, now() - startedAt, metadata);
    if (name === 'renderDashboard' && state.lastDashboardFilterChangeAt) {
      state.dashboardRendersByFilterChange.push({
        duration: measure.duration,
        renderCount: state.counts.renderDashboard,
        sinceFilterChange: round(now() - state.lastDashboardFilterChangeAt),
        at: measure.at
      });
      if (state.dashboardRendersByFilterChange.length > dashboardMeasuresLimit) {
        state.dashboardRendersByFilterChange.shift();
      }
    }
  }

  function wrapFunction(name) {
    if (state.wrapped.has(name)) return;
    const original = target[name];
    if (typeof original !== 'function') return;

    target[name] = function measuredFunction(...args) {
      const startedAt = now();
      const tab = name === 'switchTab' ? String(args[0] || '') : undefined;
      try {
        const result = original.apply(this, args);
        if (result && typeof result.then === 'function') {
          return result.finally(() => finishMeasure(name, startedAt, { tab }));
        }
        finishMeasure(name, startedAt, { tab });
        return result;
      } catch (error) {
        finishMeasure(name, startedAt, { tab, failed: true });
        throw error;
      }
    };

    state.wrapped.add(name);
  }

  function bindDashboardFilterCounters() {
    if (!documentRef?.getElementById) return;
    dashboardFilterIds.forEach((id) => {
      const element = documentRef.getElementById(id);
      if (!element || element.dataset.financePerfBound === 'true') return;
      element.dataset.financePerfBound = 'true';
      element.addEventListener('change', () => {
        state.counts.dashboardFilterChanges += 1;
        state.lastDashboardFilterChangeAt = now();
      });
      element.addEventListener('input', () => {
        state.counts.dashboardFilterChanges += 1;
        state.lastDashboardFilterChangeAt = now();
      });
    });
  }

  function installPaintObserver() {
    const Observer = target.PerformanceObserver;
    if (!Observer || state.paintObserverInstalled) return;
    try {
      const observer = new Observer((list) => {
        for (const entry of list.getEntries()) {
          if (entry.name === 'first-contentful-paint') {
            state.firstContentfulPaint = round(entry.startTime);
          }
        }
      });
      observer.observe({ type: 'paint', buffered: true });
      state.paintObserverInstalled = true;
    } catch {
      // Paint timing is unavailable in some browsers or privacy modes.
    }
  }

  function getTimingSummary() {
    const navigation = performanceApi?.getEntriesByType?.('navigation')?.[0];
    return {
      domContentLoaded: navigation ? round(navigation.domContentLoadedEventEnd) : null,
      loadComplete: navigation ? round(navigation.loadEventEnd) : state.loadCompleteAt,
      firstContentfulPaint: state.firstContentfulPaint,
      firstScreenApproximation: state.firstContentfulPaint || (navigation ? round(navigation.domContentLoadedEventEnd) : null)
    };
  }

  function getBootstrapTimings() {
    const marks = Object.fromEntries(BOOTSTRAP_MARKS.map((name) => [name, readPerformanceMark(performanceApi, name)]));
    const metrics = Object.fromEntries(Object.entries(BOOTSTRAP_MEASURES).map(([name, [startMark, endMark]]) => {
      const start = marks[startMark];
      const end = marks[endMark];
      return [name, start === null || end === null ? null : round(end - start)];
    }));
    const navigation = performanceApi?.getEntriesByType?.('navigation')?.[0];
    const documentLoad = navigation ? round(navigation.duration) : null;
    const environmentOverhead = documentLoad === null || metrics.app_bootstrap_ms === null
      ? null
      : Math.max(0, round(documentLoad - metrics.app_bootstrap_ms));
    const libraryLoaderMarks = performanceApi?.getEntriesByName?.('finance-library-loader-setup', 'mark') || [];
    return {
      marks,
      metrics: {
        ...metrics,
        document_load_ms: documentLoad,
        environment_overhead_ms: environmentOverhead
      },
      requiredMarksPresent: BOOTSTRAP_MARKS.every((name) => marks[name] !== null),
      libraryLoaderSetupCount: libraryLoaderMarks.length
    };
  }

  function summarizeMeasures(name) {
    const items = state.measures.filter((item) => item.name === name);
    if (!items.length) return { count: 0, average: null, max: null, last: null };
    const durations = items.map((item) => item.duration);
    return {
      count: items.length,
      average: round(durations.reduce((sum, value) => sum + value, 0) / durations.length),
      max: Math.max(...durations),
      last: durations[durations.length - 1]
    };
  }

  function getReport(label = 'runtime') {
    const resourceSummary = getResourceSummary();
    return {
      label,
      collectedAt: new Date().toISOString(),
      url: target.location?.href || '',
      timing: getTimingSummary(),
      resources: {
        count: resourceSummary.count,
        transferKB: round(resourceSummary.transferSize / 1024),
        encodedKB: round(resourceSummary.encodedBodySize / 1024),
        decodedKB: round(resourceSummary.decodedBodySize / 1024),
        transferByTypeKB: Object.fromEntries(
          Object.entries(resourceSummary.byType).map(([key, value]) => [key, round(value / 1024)])
        )
      },
      memory: getMemorySnapshot(),
      bootstrap: getBootstrapTimings(),
      counts: { ...state.counts },
      summary: Object.fromEntries(criticalFunctions.map((name) => [name, summarizeMeasures(name)])),
      dashboardRendersByFilterChange: [...state.dashboardRendersByFilterChange],
      recentMeasures: state.measures.slice(-30)
    };
  }

  function readBaselines() {
    try {
      return JSON.parse(storage?.getItem?.(STORAGE_KEY) || '[]');
    } catch {
      return [];
    }
  }

  function saveBaseline(label = 'baseline') {
    const baselines = readBaselines();
    const report = getReport(label);
    storage?.setItem?.(STORAGE_KEY, JSON.stringify(baselines.concat(report).slice(-20)));
    return report;
  }

  function compareReports(before, after = getReport('after')) {
    const metricPairs = [
      ['initialTransferKB', before?.resources?.transferKB, after?.resources?.transferKB],
      ['firstScreenMs', before?.timing?.firstScreenApproximation, after?.timing?.firstScreenApproximation],
      ['switchTabAverageMs', before?.summary?.switchTab?.average, after?.summary?.switchTab?.average],
      ['renderDashboardAverageMs', before?.summary?.renderDashboard?.average, after?.summary?.renderDashboard?.average],
      ['importSaidasAverageMs', before?.summary?.importSaidasSpreadsheet?.average, after?.summary?.importSaidasSpreadsheet?.average],
      ['importEntradasAverageMs', before?.summary?.importEntradasSpreadsheet?.average, after?.summary?.importEntradasSpreadsheet?.average],
      ['exportPdfAverageMs', before?.summary?.exportPDF?.average, after?.summary?.exportPDF?.average],
      ['usedHeapMB', before?.memory?.usedJSHeapSize ? before.memory.usedJSHeapSize / 1048576 : null, after?.memory?.usedJSHeapSize ? after.memory.usedJSHeapSize / 1048576 : null]
    ];

    return metricPairs.map(([name, beforeValue, afterValue]) => ({
      name,
      before: beforeValue === null || beforeValue === undefined ? null : round(beforeValue),
      after: afterValue === null || afterValue === undefined ? null : round(afterValue),
      delta: beforeValue === null || beforeValue === undefined || afterValue === null || afterValue === undefined
        ? null
        : round(afterValue - beforeValue)
    }));
  }

  function start() {
    installPaintObserver();
    criticalFunctions.forEach(wrapFunction);
    bindDashboardFilterCounters();
  }

  function bootstrap() {
    start();
    if (typeof target.addEventListener === 'function') {
      target.addEventListener('load', () => {
        state.loadCompleteAt = round(now());
        criticalFunctions.forEach(wrapFunction);
        bindDashboardFilterCounters();
      }, { once: true });
    }
  }

  function mark(name, metadata = {}) {
    return recordMeasure(name, 0, metadata);
  }

  function measure(name, startedAt, metadata = {}) {
    return recordMeasure(name, now() - (Number(startedAt) || now()), metadata);
  }

  function report(label = 'runtime') {
    return getReport(label);
  }

  return {
    compareReports,
    getBaselines: readBaselines,
    getReport,
    getBootstrapTimings,
    mark,
    measure,
    report,
    saveBaseline,
    start,
    state,
    wrapFunction
  };
}

export function installPerformanceMonitor(target = globalThis, options = {}) {
  if (!target) return null;
  if (target.financePerformance?.__financePerformanceMonitorInstalled === true) {
    return target.financePerformance;
  }

  const monitor = createPerformanceMonitor(target, options);
  Object.defineProperty(monitor, '__financePerformanceMonitorInstalled', {
    value: true,
    enumerable: false
  });

  defineLegacyGlobalBridge(target, 'financePerformance', monitor, {
    canonical: 'src/services/performanceMonitor.js:installPerformanceMonitor'
  });

  const documentRef = options.document || target.document;
  if (options.autoStart !== false) {
    if (documentRef?.readyState === 'loading' && typeof documentRef.addEventListener === 'function') {
      documentRef.addEventListener('DOMContentLoaded', () => monitor.start(), { once: true });
    } else {
      monitor.start();
    }

    if (typeof target.addEventListener === 'function') {
      target.addEventListener('load', () => {
        monitor.state.loadCompleteAt = round((options.clock || defaultClock(target)).now());
        monitor.start();
      }, { once: true });
    }
  }

  return monitor;
}
