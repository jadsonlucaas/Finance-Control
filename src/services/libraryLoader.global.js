(function () {
  const PDF_LIBRARY_URL = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
  const PDF_AUTOTABLE_URL = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js';
  const XLSX_LIBRARY_URL = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
  const externalLibraryPromises = new Map();
  const ALLOWED_EXTERNAL_LIBRARY_HOSTS = new Set([
    'cdnjs.cloudflare.com'
  ]);

  function isAllowedExternalLibraryUrl(src) {
    try {
      const url = new URL(src, window.document?.baseURI || 'https://finance-control.local/');
      return url.protocol === 'https:' && ALLOWED_EXTERNAL_LIBRARY_HOSTS.has(url.hostname);
    } catch {
      return false;
    }
  }

  function loadExternalLibrary(src, isReady) {
    if (!isAllowedExternalLibraryUrl(src)) return Promise.reject(new Error(`LIBRARY_NOT_ALLOWED:${src}`));
    if (typeof isReady === 'function' && isReady()) return Promise.resolve();
    if (externalLibraryPromises.has(src)) return externalLibraryPromises.get(src);

    const promise = new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[data-finance-src="${src}"]`);
      if (existing) {
        existing.addEventListener('load', () => resolve(), { once: true });
        existing.addEventListener('error', () => reject(new Error(`LOAD_FAILED:${src}`)), { once: true });
        return;
      }

      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.crossOrigin = 'anonymous';
      script.referrerPolicy = 'no-referrer';
      script.dataset.financeSrc = src;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`LOAD_FAILED:${src}`));
      document.head.appendChild(script);
    }).then(() => {
      if (typeof isReady === 'function' && !isReady()) throw new Error(`LIBRARY_NOT_READY:${src}`);
    }).catch((error) => {
      externalLibraryPromises.delete(src);
      throw error;
    });

    externalLibraryPromises.set(src, promise);
    return promise;
  }

  async function ensurePdfLibraries() {
    await loadExternalLibrary(PDF_LIBRARY_URL, () => Boolean(window.jspdf?.jsPDF));
    await loadExternalLibrary(PDF_AUTOTABLE_URL, () => Boolean(window.jspdf?.jsPDF && (window.jspdf.autoTable || window.jspdf.jsPDF.API?.autoTable)));
  }

  async function ensureSpreadsheetLibrary() {
    await loadExternalLibrary(XLSX_LIBRARY_URL, () => Boolean(window.XLSX?.read && window.XLSX?.utils?.sheet_to_json));
  }

  Object.assign(window, {
    financeLibraryLoader: {
      loadExternalLibrary,
      isAllowedExternalLibraryUrl,
      ensurePdfLibraries,
      ensureSpreadsheetLibrary
    },
    loadExternalLibrary,
    isAllowedExternalLibraryUrl,
    ensurePdfLibraries,
    ensureSpreadsheetLibrary
  });
})();
