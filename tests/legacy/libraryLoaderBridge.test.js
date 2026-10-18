import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearLegacyGlobalBridgeRegistryForTests, getLegacyGlobalBridgeRegistry } from '../../src/legacy/bridgeRegistry.js';
import { installLibraryLoaderBridge } from '../../src/legacy/libraryLoaderBridge.js';
import { clearLibraryLoaderCacheForTests } from '../../src/services/libraryLoader.js';

function createDocumentStub() {
  return {
    baseURI: 'https://finance-control.local/',
    querySelector: vi.fn(() => null),
    createElement: vi.fn(() => ({
      dataset: {},
      addEventListener: vi.fn(),
      set src(value) {
        this._src = value;
      },
      get src() {
        return this._src;
      }
    })),
    head: {
      appendChild: vi.fn((script) => {
        queueMicrotask(() => script.onload?.());
      })
    }
  };
}

beforeEach(() => {
  clearLibraryLoaderCacheForTests();
});

describe('legacy library loader bridge', () => {
  it('installs the legacy global names through the bridge registry', () => {
    const target = { document: createDocumentStub() };
    const bridge = installLibraryLoaderBridge(target);

    expect(bridge).toBe(target.financeLibraryLoader);
    expect(typeof target.loadExternalLibrary).toBe('function');
    expect(typeof target.isAllowedExternalLibraryUrl).toBe('function');
    expect(typeof target.ensurePdfLibraries).toBe('function');
    expect(typeof target.ensureSpreadsheetLibrary).toBe('function');
    expect(getLegacyGlobalBridgeRegistry(target).map((item) => item.name)).toEqual(expect.arrayContaining([
      'financeLibraryLoader',
      'loadExternalLibrary',
      'isAllowedExternalLibraryUrl',
      'ensurePdfLibraries',
      'ensureSpreadsheetLibrary'
    ]));

    clearLegacyGlobalBridgeRegistryForTests(target);
  });

  it('is idempotent and does not preload libraries during installation', () => {
    const target = { document: createDocumentStub(), addEventListener: vi.fn() };

    const first = installLibraryLoaderBridge(target);
    const second = installLibraryLoaderBridge(target);

    expect(second).toBe(first);
    expect(target.document.createElement).not.toHaveBeenCalled();
    expect(target.document.head.appendChild).not.toHaveBeenCalled();
    expect(target.addEventListener).not.toHaveBeenCalled();
    clearLegacyGlobalBridgeRegistryForTests(target);
  });

  it('does not duplicate bridge registry entries when installed repeatedly', () => {
    const target = { document: createDocumentStub() };

    installLibraryLoaderBridge(target);
    installLibraryLoaderBridge(target);

    const names = getLegacyGlobalBridgeRegistry(target).map((item) => item.name);
    expect(names.filter((name) => name === 'financeLibraryLoader')).toHaveLength(1);
    expect(names.filter((name) => name === 'ensureSpreadsheetLibrary')).toHaveLength(1);
    clearLegacyGlobalBridgeRegistryForTests(target);
  });

  it('delegates spreadsheet loading to the canonical ES loader with the target context', async () => {
    const target = { document: createDocumentStub() };
    installLibraryLoaderBridge(target);
    target.XLSX = { read: vi.fn(), utils: { sheet_to_json: vi.fn() } };

    await target.ensureSpreadsheetLibrary();

    expect(target.document.head.appendChild).not.toHaveBeenCalled();
    clearLegacyGlobalBridgeRegistryForTests(target);
  });
});
