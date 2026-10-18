import { buildFinancialReportReadModel } from '../../application/readModels/financialReportReadModel.js';
import { toErrorState, toLoadingState, toSuccessState, createAsyncViewState } from '../../application/resilience/asyncViewState.js';
import { normalizeApplicationError, normalizeLazyLoadError } from '../../application/resilience/errorNormalization.js';

export function createReportExportController({
  presenter,
  readSource,
  pdfAdapterLoader = () => import('./pdfAdapter.js'),
  now = () => new Date().toISOString(),
  errorReporter = null
} = {}) {
  let state = createAsyncViewState({ status: 'idle' });
  let inFlight = null;
  let ownerKey = '';

  function render() {
    presenter?.render?.(state);
    return state;
  }

  function resetForOwner(nextOwnerKey = '') {
    ownerKey = nextOwnerKey;
    state = createAsyncViewState({ status: 'idle' });
    inFlight = null;
    return render();
  }

  async function exportReport(selection = {}) {
    if (inFlight) return inFlight;
    inFlight = runExport(selection).finally(() => {
      inFlight = null;
    });
    return inFlight;
  }

  async function runExport(selection = {}) {
    const previous = state;
    state = toLoadingState(state);
    render();
    try {
      const source = await readSource.read(selection);
      const nextOwnerKey = source.userContext?.ownerKey || source.userContext?.ownerUid || '';
      if (ownerKey && nextOwnerKey && ownerKey !== nextOwnerKey) resetForOwner(nextOwnerKey);
      ownerKey = nextOwnerKey || ownerKey;
      const report = buildFinancialReportReadModel({
        financeRecords: source.records || [],
        filters: source.filters || selection.filters || {},
        referenceData: source.referenceData || {},
        userContext: source.userContext || {},
        reportType: selection.reportType || source.reportType || 'financial',
        options: {
          pdfFinancialData: source.pdfFinancialData,
          hourSummary: source.hourSummary,
          focusedDashboardCard: source.focusedDashboardCard,
          generatedAt: now()
        }
      });
      if (!report.tables.detailedRows.length && Number(report.summary.receitas || 0) <= 0) {
        state = toSuccessState(null, now);
        render();
        return { success: false, empty: true, wrote: false, report };
      }
      const adapter = await pdfAdapterLoader().catch((error) => {
        throw normalizeLazyLoadError(error, { operation: 'pdf_adapter_load' });
      });
      const result = await adapter.createPdfReport(report, source.pdfOptions || {});
      state = toSuccessState({ report, filename: result.filename, result }, now);
      render();
      return { success: true, wrote: false, report, result };
    } catch (error) {
      const normalized = normalizeApplicationError(error, { operation: 'pdf_export' });
      errorReporter?.report?.({ error: normalized, operation: 'pdf_export' });
      state = toErrorState(normalized, previous);
      render();
      return { success: false, wrote: false, error: normalized };
    }
  }

  return {
    exportReport,
    resetForOwner,
    getState: () => state,
    render
  };
}
