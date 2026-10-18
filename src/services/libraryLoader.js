export const PDF_LIBRARY_URL = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
export const PDF_AUTOTABLE_URL = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js';
export const XLSX_LIBRARY_URL = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';

const libraryPromises = new Map();
const ALLOWED_EXTERNAL_LIBRARY_HOSTS = new Set([
  'cdnjs.cloudflare.com'
]);

function normalizeOptions(options = {}) {
  const looksLikeTarget = options?.document && !options.target && !options.documentRef;
  const target = options?.target || (looksLikeTarget ? options : globalThis);
  return {
    target,
    documentRef: options?.documentRef || target.document || null
  };
}

function createLazyLibraryError(code, src, cause) {
  const error = new Error(`${code}:${src}`);
  Object.assign(error, {
    code: 'LAZY_LOAD_FAILED',
    category: 'LAZY_LOAD',
    severity: 'error',
    message: `${code}:${src}`,
    userMessage: 'Nao foi possivel carregar a biblioteca necessaria.',
    retryable: true,
    operation: 'load_external_library',
    correlationId: '',
    causeCode: code,
    details: { src },
    occurredAt: new Date().toISOString(),
    schemaVersion: 1
  });
  if (cause) {
    Object.defineProperty(error, 'cause', {
      value: cause,
      enumerable: false
    });
  }
  return error;
}

export function isAllowedExternalLibraryUrl(src, options = {}) {
  try {
    const { documentRef } = normalizeOptions(options);
    const url = new URL(src, documentRef?.baseURI || 'https://finance-control.local/');
    return url.protocol === 'https:' && ALLOWED_EXTERNAL_LIBRARY_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
}

export function loadExternalLibrary(src, isReady, options = {}) {
  const { target, documentRef } = normalizeOptions(options);
  if (!isAllowedExternalLibraryUrl(src, { documentRef })) {
    return Promise.reject(createLazyLibraryError('LIBRARY_NOT_ALLOWED', src));
  }
  if (typeof isReady === 'function' && isReady()) return Promise.resolve();
  if (libraryPromises.has(src)) return libraryPromises.get(src);
  if (!documentRef?.querySelector || !documentRef?.createElement || !documentRef?.head?.appendChild) {
    return Promise.reject(createLazyLibraryError('LIBRARY_DOCUMENT_UNAVAILABLE', src));
  }

  const promise = new Promise((resolve, reject) => {
    const existing = documentRef.querySelector(`script[data-finance-src="${src}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(createLazyLibraryError('LOAD_FAILED', src)), { once: true });
      return;
    }

    const script = documentRef.createElement('script');
    script.src = src;
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.referrerPolicy = 'no-referrer';
    script.dataset.financeSrc = src;
    script.onload = () => resolve();
    script.onerror = () => reject(createLazyLibraryError('LOAD_FAILED', src));
    documentRef.head.appendChild(script);
  }).then(() => {
    if (typeof isReady === 'function' && !isReady()) throw createLazyLibraryError('LIBRARY_NOT_READY', src);
    return target;
  }).catch((error) => {
    libraryPromises.delete(src);
    throw error;
  });

  libraryPromises.set(src, promise);
  return promise;
}

export async function ensurePdfLibraries(options = {}) {
  const { target } = normalizeOptions(options);
  await loadExternalLibrary(PDF_LIBRARY_URL, () => Boolean(target.jspdf?.jsPDF), { target });
  await loadExternalLibrary(PDF_AUTOTABLE_URL, () => Boolean(target.jspdf?.jsPDF && (target.jspdf.autoTable || target.jspdf.jsPDF.API?.autoTable)), { target });
}

export async function ensureSpreadsheetLibrary(options = {}) {
  const { target } = normalizeOptions(options);
  await loadExternalLibrary(XLSX_LIBRARY_URL, () => Boolean(target.XLSX?.read && target.XLSX?.utils?.sheet_to_json), { target });
}

export function getLibraryLoaderState() {
  return {
    pending: [...libraryPromises.keys()],
    allowedHosts: [...ALLOWED_EXTERNAL_LIBRARY_HOSTS]
  };
}

export function clearLibraryLoaderCacheForTests() {
  libraryPromises.clear();
}
