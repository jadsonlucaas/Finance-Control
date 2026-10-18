import { createReportExportController } from './reportExportController.js';
import { createReportExportPresenter } from './reportExportPresenter.js';

function valueById(target, id) {
  return target.document?.getElementById?.(id)?.value || '';
}

function currentOwner(target) {
  return target.currentUser?.uid
    || target.auth?.currentUser?.uid
    || target.authSdk?.getCurrentUser?.()?.uid
    || target.currentUserProfile?.uid
    || '';
}

function createReadSource(target = globalThis) {
  return {
    read: async () => {
      const ownerUid = currentOwner(target);
      const filters = {
        start: valueById(target, 'f-comp-start'),
        end: valueById(target, 'f-comp-end') || valueById(target, 'f-comp-start'),
        person: valueById(target, 'f-person'),
        macro: valueById(target, 'f-macro'),
        cycle: valueById(target, 'f-cycle'),
        archiveMode: 'active'
      };
      return {
        records: Array.isArray(target.allRecords) ? target.allRecords.filter((record) => !ownerUid || !record.owner_uid || record.owner_uid === ownerUid) : [],
        filters,
        userContext: { ownerUid, ownerKey: ownerUid ? 'owner-scoped' : '' },
        focusedDashboardCard: target.focusedDashboardCard || '',
        pdfFinancialData: typeof target.getPdfDashboardFinancialData === 'function' ? target.getPdfDashboardFinancialData() : null,
        hourSummary: typeof target.buildHourPeriodSummary === 'function'
          ? target.buildHourPeriodSummary(Array.isArray(target.allRecords) ? target.allRecords : [], { start: filters.start, end: filters.end, person: filters.person })
          : null,
        pdfOptions: {
          target,
          ensurePdfLibraries: target.ensurePdfLibraries,
          filename: undefined
        }
      };
    }
  };
}

export function installReportExportActiveUi(target = globalThis, options = {}) {
  const app = target.financeApp || {};
  target.financeApp = app;
  if (app.reportExportActiveUi?.installed) return app.reportExportActiveUi;

  const presenter = options.presenter || createReportExportPresenter({ target });
  const controller = options.controller || createReportExportController({
    presenter,
    readSource: options.readSource || createReadSource(target),
    pdfAdapterLoader: options.pdfAdapterLoader,
    now: options.now,
    errorReporter: target.financeApp?.resilience?.errorReporter
  });
  const previousExportPDF = target.exportPDF;

  target.exportPDF = function exportPDFModernBridge(selection = {}) {
    return controller.exportReport(selection).then((result) => {
      if (result?.success) target.showToast?.('Relatorio PDF exportado!');
      if (result?.empty) target.showToast?.('Sem lancamentos para exportar no filtro atual', true);
      if (!result?.success && result?.error) target.showToast?.(result.error.userMessage || 'Nao foi possivel gerar o relatorio.', true);
      return result;
    }).catch((error) => {
      if (typeof previousExportPDF === 'function') return previousExportPDF();
      throw error;
    });
  };
  Object.defineProperty(target.exportPDF, '__financeModernReportExport', { value: true });

  const api = { installed: true, controller, presenter, previousExportPDF };
  app.reportExportActiveUi = api;
  presenter.render(controller.getState());
  return api;
}
