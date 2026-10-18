import { defineLegacyGlobalBridge } from './bridgeRegistry.js';

const ALLOWED_EXTERNAL_LIBRARY_HOSTS = new Set([
  'cdnjs.cloudflare.com'
]);

function isAllowedExternalLibraryUrl(src, options = {}) {
  try {
    const target = options?.target || globalThis;
    const documentRef = options?.documentRef || target.document || null;
    const url = new URL(src, documentRef?.baseURI || 'https://finance-control.local/');
    return url.protocol === 'https:' && ALLOWED_EXTERNAL_LIBRARY_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
}

async function loadLibraryLoaderModule() {
  return import('../services/libraryLoader.js');
}

export function createLibraryLoaderBridge(target = globalThis) {
  const callWithTarget = (name) => async (...args) => {
    const last = args[args.length - 1];
    const hasOptions = last && typeof last === 'object' && !Array.isArray(last) && ('target' in last || 'documentRef' in last);
    const mod = await loadLibraryLoaderModule();
    if (hasOptions) return mod[name](...args);
    return mod[name](...args, { target });
  };

  const bridge = {
    loadExternalLibrary: callWithTarget('loadExternalLibrary'),
    isAllowedExternalLibraryUrl: (src, options) => isAllowedExternalLibraryUrl(src, { target, ...(options || {}) }),
    ensurePdfLibraries: async (options) => {
      const mod = await loadLibraryLoaderModule();
      return mod.ensurePdfLibraries({ target, ...(options || {}) });
    },
    ensureSpreadsheetLibrary: async (options) => {
      const mod = await loadLibraryLoaderModule();
      return mod.ensureSpreadsheetLibrary({ target, ...(options || {}) });
    }
  };

  return bridge;
}

export function installLibraryLoaderBridge(target = globalThis) {
  const bridge = target.financeLibraryLoader || createLibraryLoaderBridge(target);

  defineLegacyGlobalBridge(target, 'financeLibraryLoader', bridge, {
    canonical: 'src/legacy/libraryLoaderBridge.js:financeLibraryLoader'
  });
  defineLegacyGlobalBridge(target, 'loadExternalLibrary', bridge.loadExternalLibrary, {
    canonical: 'src/services/libraryLoader.js:loadExternalLibrary'
  });
  defineLegacyGlobalBridge(target, 'isAllowedExternalLibraryUrl', bridge.isAllowedExternalLibraryUrl, {
    canonical: 'src/services/libraryLoader.js:isAllowedExternalLibraryUrl'
  });
  defineLegacyGlobalBridge(target, 'ensurePdfLibraries', bridge.ensurePdfLibraries, {
    canonical: 'src/services/libraryLoader.js:ensurePdfLibraries'
  });
  defineLegacyGlobalBridge(target, 'ensureSpreadsheetLibrary', bridge.ensureSpreadsheetLibrary, {
    canonical: 'src/services/libraryLoader.js:ensureSpreadsheetLibrary'
  });

  return target.financeLibraryLoader;
}
