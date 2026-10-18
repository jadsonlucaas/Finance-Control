export function createReportExportPresenter({ target = globalThis, rootId = 'report-export-panel' } = {}) {
  const documentRef = target.document;

  function root() {
    if (!documentRef) return null;
    let element = documentRef.getElementById(rootId);
    if (!element) {
      element = documentRef.createElement('div');
      element.id = rootId;
      documentRef.getElementById('view-dashboard')?.prepend(element);
    }
    return element;
  }

  function render(viewState = {}) {
    const element = root();
    if (!element) return;
    const data = viewState.data || {};
    const error = viewState.error;
    const hidden = viewState.status === 'idle' && !data.report;
    element.className = hidden ? 'hidden' : 'glass rounded-xl p-3 mb-4 text-sm';
    element.innerHTML = `
      <div data-report-export-root>
        <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
          <div>
            <h3 class="font-semibold text-textPrimary text-sm">Relatorio PDF</h3>
            <p id="report-export-state" class="text-xs text-textSecondary">${message(viewState)}</p>
          </div>
          <div class="flex gap-2 text-xs text-textSecondary">
            <span>${data.report?.metadata?.detailedRecordCount || 0} lancamento(s)</span>
            <span>${data.filename || data.report?.metadata?.filename || ''}</span>
          </div>
        </div>
        ${error ? `<div class="mt-2 text-xs text-danger">${safe(error.userMessage || error.message || 'Nao foi possivel exportar.')}</div>` : ''}
      </div>
    `;
  }

  function message(viewState = {}) {
    if (viewState.status === 'loading' || viewState.isRefreshing) return 'Gerando relatorio...';
    if (viewState.status === 'empty') return 'Sem lancamentos para exportar no filtro atual.';
    if (viewState.status === 'error' || viewState.status === 'stale') return 'Nao foi possivel gerar o relatorio.';
    if (viewState.status === 'success') return 'Relatorio PDF exportado.';
    return '';
  }

  function safe(value = '') {
    return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  }

  return { render };
}
