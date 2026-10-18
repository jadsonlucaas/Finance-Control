import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  APPLICATION_ERROR_CODES
} from '../../src/application/resilience/applicationError.js';
import {
  PDF_LIBRARY_URL,
  XLSX_LIBRARY_URL,
  clearLibraryLoaderCacheForTests,
  ensureSpreadsheetLibrary,
  getLibraryLoaderState,
  isAllowedExternalLibraryUrl,
  loadExternalLibrary
} from '../../src/services/libraryLoader.js';

function createDocumentStub({ fail = false, onAppend } = {}) {
  const scripts = [];
  return {
    baseURI: 'https://finance-control.local/',
    created: scripts,
    querySelector: vi.fn((selector) => scripts.find((script) => selector.includes(script.dataset.financeSrc)) || null),
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
        scripts.push(script);
        onAppend?.(script);
        queueMicrotask(() => {
          if (fail) script.onerror?.();
          else script.onload?.();
        });
      })
    }
  };
}

beforeEach(() => {
  clearLibraryLoaderCacheForTests();
});

describe('external library loader allowlist', () => {
  it('does not inject PDF or XLSX scripts when the module is imported', async () => {
    const originalDocument = globalThis.document;
    const documentRef = createDocumentStub();
    globalThis.document = documentRef;

    await import('../../src/services/libraryLoader.js?bootstrap-side-effect-check');

    expect(documentRef.head.appendChild).not.toHaveBeenCalled();
    globalThis.document = originalDocument;
  });

  it('allows the approved CDN over HTTPS', () => {
    expect(isAllowedExternalLibraryUrl('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js')).toBe(true);
  });

  it('blocks non-HTTPS and unknown hosts', () => {
    expect(isAllowedExternalLibraryUrl('http://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js')).toBe(false);
    expect(isAllowedExternalLibraryUrl('https://example.com/script.js')).toBe(false);
    expect(isAllowedExternalLibraryUrl('javascript:alert(1)')).toBe(false);
  });

  it('loads a script once and reuses the pending promise', async () => {
    const documentRef = createDocumentStub();
    const first = loadExternalLibrary(XLSX_LIBRARY_URL, null, { documentRef });
    const second = loadExternalLibrary(XLSX_LIBRARY_URL, null, { documentRef });

    expect(first).toBe(second);
    await first;
    expect(documentRef.head.appendChild).toHaveBeenCalledTimes(1);
    expect(getLibraryLoaderState().pending).toContain(XLSX_LIBRARY_URL);
  });

  it('clears cache after failure and allows retry', async () => {
    const failedDocument = createDocumentStub({ fail: true });
    await expect(loadExternalLibrary(XLSX_LIBRARY_URL, null, { documentRef: failedDocument }))
      .rejects.toMatchObject({ code: APPLICATION_ERROR_CODES.LAZY_LOAD_FAILED, retryable: true, causeCode: 'LOAD_FAILED' });

    const retryDocument = createDocumentStub();
    await expect(loadExternalLibrary(XLSX_LIBRARY_URL, null, { documentRef: retryDocument })).resolves.toBeDefined();
    expect(retryDocument.head.appendChild).toHaveBeenCalledTimes(1);
  });

  it('rejects without window/document support using an application lazy error', async () => {
    await expect(loadExternalLibrary(XLSX_LIBRARY_URL, null, { target: {}, documentRef: null }))
      .rejects.toMatchObject({ code: APPLICATION_ERROR_CODES.LAZY_LOAD_FAILED, causeCode: 'LIBRARY_DOCUMENT_UNAVAILABLE' });
  });

  it('loads the spreadsheet library through the spreadsheet-specific helper', async () => {
    const target = {};
    const documentRef = createDocumentStub({
      onAppend: () => {
        target.XLSX = { read: vi.fn(), utils: { sheet_to_json: vi.fn() } };
      }
    });
    target.document = documentRef;

    await ensureSpreadsheetLibrary({ target });
    expect(documentRef.head.appendChild).toHaveBeenCalledTimes(1);
  });

  it('keeps PDF and spreadsheet URLs on the approved CDN only', () => {
    expect(isAllowedExternalLibraryUrl(PDF_LIBRARY_URL)).toBe(true);
    expect(isAllowedExternalLibraryUrl(XLSX_LIBRARY_URL)).toBe(true);
  });
});
