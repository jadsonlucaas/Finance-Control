(function installPerformanceMonitor(target) {
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

  const state = {
    bootStartedAt: target.performance?.timeOrigin || Date.now(),
    firstContentfulPaint: null,
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
    return target.performance?.now?.() || Date.now();
  }

  function round(value) {
    return Math.round((Number(value) || 0) * 100) / 100;
  }

  function getMemorySnapshot() {
    const memory = target.performance?.memory;
    if (!memory) return null;
    return {
      jsHeapSizeLimit: memory.jsHeapSizeLimit,
      totalJSHeapSize: memory.totalJSHeapSize,
      usedJSHeapSize: memory.usedJSHeapSize
    };
  }

  function getResourceSummary() {
    const resources = target.performance?.getEntriesByType?.('resource') || [];
    const documentEntry = target.performance?.getEntriesByType?.('navigation')?.[0];
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
    if (state.measures.length > 300) state.measures.shift();
    return measure;
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
      if (state.dashboardRendersByFilterChange.length > 100) state.dashboardRendersByFilterChange.shift();
    }
  }

  function bindDashboardFilterCounters() {
    DASHBOARD_FILTER_IDS.forEach((id) => {
      const element = target.document.getElementById(id);
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
    if (!target.PerformanceObserver) return;
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.name === 'first-contentful-paint') {
            state.firstContentfulPaint = round(entry.startTime);
          }
        }
      });
      observer.observe({ type: 'paint', buffered: true });
    } catch (_) {
      // Paint timing is unavailable in some browsers or privacy modes.
    }
  }

  function getTimingSummary() {
    const navigation = target.performance?.getEntriesByType?.('navigation')?.[0];
    return {
      domContentLoaded: navigation ? round(navigation.domContentLoadedEventEnd) : null,
      loadComplete: navigation ? round(navigation.loadEventEnd) : state.loadCompleteAt,
      firstContentfulPaint: state.firstContentfulPaint,
      firstScreenApproximation: state.firstContentfulPaint || (navigation ? round(navigation.domContentLoadedEventEnd) : null)
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
      counts: { ...state.counts },
      summary: Object.fromEntries(CRITICAL_FUNCTIONS.map((name) => [name, summarizeMeasures(name)])),
      dashboardRendersByFilterChange: [...state.dashboardRendersByFilterChange],
      recentMeasures: state.measures.slice(-30)
    };
  }

  function readBaselines() {
    try {
      return JSON.parse(target.localStorage.getItem(STORAGE_KEY) || '[]');
    } catch (_) {
      return [];
    }
  }

  function saveBaseline(label = 'baseline') {
    const baselines = readBaselines();
    const report = getReport(label);
    baselines.push(report);
    target.localStorage.setItem(STORAGE_KEY, JSON.stringify(baselines.slice(-20)));
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

  function bootstrap() {
    installPaintObserver();
    CRITICAL_FUNCTIONS.forEach(wrapFunction);
    bindDashboardFilterCounters();
    target.addEventListener('load', () => {
      state.loadCompleteAt = round(now());
      CRITICAL_FUNCTIONS.forEach(wrapFunction);
      bindDashboardFilterCounters();
    }, { once: true });
  }

  target.financePerformance = {
    compareReports,
    getBaselines: readBaselines,
    getReport,
    saveBaseline,
    wrapFunction
  };

  if (target.document.readyState === 'loading') {
    target.document.addEventListener('DOMContentLoaded', bootstrap, { once: true });
  } else {
    bootstrap();
  }
})(window);
