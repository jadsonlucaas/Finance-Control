import { describe, expect, it, vi } from 'vitest';
import { installLegacyEventBindings } from '../../src/ui/legacy-events.js';

function createElement() {
  return {
    dataset: {},
    value: '',
    addEventListener: vi.fn(),
    closest: () => null
  };
}

function createTarget() {
  const elements = new Map();
  return {
    document: {
      readyState: 'complete',
      documentElement: { dataset: {} },
      getElementById: (id) => {
        if (!elements.has(id)) elements.set(id, createElement());
        return elements.get(id);
      },
      addEventListener: vi.fn()
    },
    allRecords: [],
    __elements: elements
  };
}

describe('legacy-events ES module', () => {
  it('installs an idempotent temporary bridge and delegates to target functions', () => {
    const target = createTarget();
    target.toggleSidebar = vi.fn();

    const first = installLegacyEventBindings(target);
    const second = installLegacyEventBindings(target);

    expect(second).toBe(first);
    expect(target.financeEvents).toBe(first);
    first.invoke('toggleSidebar');
    expect(target.toggleSidebar).toHaveBeenCalledTimes(1);
    expect(target.__elements.get('btn-mobile-menu').addEventListener).toHaveBeenCalledTimes(1);
  });

  it('does not require DOM when imported by non-browser consumers', () => {
    const api = installLegacyEventBindings({});
    expect(typeof api.invoke).toBe('function');
    expect(typeof api.bindStaticEvents).toBe('function');
  });
});
