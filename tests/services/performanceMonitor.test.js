import { describe, expect, it, vi } from 'vitest';
import { createPerformanceMonitor, installPerformanceMonitor } from '../../src/services/performanceMonitor.js';

function createMemoryStorage() {
  const items = new Map();
  return {
    getItem: (key) => items.get(key) || null,
    setItem: (key, value) => items.set(key, String(value))
  };
}

function createTarget() {
  const listeners = new Map();
  return {
    document: {
      readyState: 'complete',
      getElementById: () => null,
      addEventListener: vi.fn()
    },
    location: { href: 'http://local.test/' },
    localStorage: createMemoryStorage(),
    performance: {
      now: vi.fn(() => 10),
      getEntriesByType: vi.fn((type) => {
        if (type === 'navigation') return [{ domContentLoadedEventEnd: 15, loadEventEnd: 20, transferSize: 100 }];
        if (type === 'resource') return [{ transferSize: 200, encodedBodySize: 150, decodedBodySize: 300, initiatorType: 'script' }];
        return [];
      })
    },
    addEventListener: vi.fn((name, handler) => listeners.set(name, handler)),
    dispatchLoad: () => listeners.get('load')?.()
  };
}

describe('performance monitor module', () => {
  it('collects reports without requiring browser globals', () => {
    const target = { location: { href: '' } };
    const monitor = createPerformanceMonitor(target, {
      clock: { bootStartedAt: 0, now: () => 5 },
      storage: createMemoryStorage(),
      performance: null,
      document: null
    });

    monitor.start();
    monitor.mark('bootstrap');

    expect(monitor.getReport('memory')).toMatchObject({
      label: 'memory',
      resources: { count: 0 },
      memory: null
    });
  });

  it('wraps functions, measures calls and stores local baselines', () => {
    const target = createTarget();
    let now = 20;
    target.performance.now = vi.fn(() => {
      now += 5;
      return now;
    });
    target.switchTab = vi.fn(() => 'ok');

    const monitor = createPerformanceMonitor(target);
    monitor.wrapFunction('switchTab');

    expect(target.switchTab('dashboard')).toBe('ok');
    expect(monitor.getReport('runtime').summary.switchTab.count).toBe(1);
    expect(monitor.saveBaseline('local-only').label).toBe('local-only');
    expect(monitor.getBaselines()).toHaveLength(1);
  });

  it('installs an idempotent global bridge that delegates to the module API', () => {
    const target = createTarget();

    const first = installPerformanceMonitor(target);
    const second = installPerformanceMonitor(target);

    expect(second).toBe(first);
    expect(target.financePerformance).toBe(first);
    expect(typeof target.financePerformance.getReport).toBe('function');
    expect(typeof target.financePerformance.mark).toBe('function');
    expect(target.addEventListener).toHaveBeenCalledTimes(1);
  });

  it('does not send data externally or require Performance API support', () => {
    const fetchSpy = vi.fn();
    const target = {
      fetch: fetchSpy,
      document: { readyState: 'complete', getElementById: () => null },
      localStorage: createMemoryStorage(),
      addEventListener: vi.fn()
    };

    const monitor = installPerformanceMonitor(target);
    monitor.report('local');
    monitor.saveBaseline('baseline');

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('reports deterministic bootstrap timings from Performance marks', () => {
    const marks = new Map([
      ['finance-app-entry-start', 10],
      ['finance-bridge-install-start', 12],
      ['finance-bridges-ready', 20],
      ['finance-legacy-loader-start', 21],
      ['finance-legacy-loader-end', 61],
      ['finance-auth-init-start', 62],
      ['finance-auth-init-end', 82],
      ['finance-shell-ready', 62],
      ['finance-first-screen-ready', 90],
      ['finance-bootstrap-complete', 83]
    ]);
    const target = {
      location: { href: 'http://local.test/' },
      localStorage: createMemoryStorage(),
      document: { readyState: 'complete', getElementById: () => null },
      addEventListener: vi.fn(),
      performance: {
        now: () => 100,
        getEntriesByName: vi.fn((name, type) => (type === 'mark' && marks.has(name) ? [{ startTime: marks.get(name) }] : [])),
        getEntriesByType: vi.fn((type) => {
          if (type === 'navigation') return [{ duration: 120, domContentLoadedEventEnd: 80, loadEventEnd: 120 }];
          return [];
        })
      }
    };

    const monitor = createPerformanceMonitor(target);
    const bootstrap = monitor.getReport('bootstrap').bootstrap;

    expect(bootstrap.requiredMarksPresent).toBe(true);
    expect(bootstrap.metrics).toMatchObject({
      app_bootstrap_ms: 52,
      legacy_loader_ms: 40,
      bridge_install_ms: 8,
      auth_init_ms: 20,
      first_screen_ready_ms: 80,
      lazy_registration_ms: 1,
      document_load_ms: 120,
      environment_overhead_ms: 68
    });
  });
});
