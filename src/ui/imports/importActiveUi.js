import { createImportController } from './importController.js';
import { createImportPresenter } from './importPresenter.js';
import { getImportPipelineRepositories } from '../../application/imports/importPipelineRuntime.js';

function currentUser(target = globalThis) {
  return target.authSdk?.getCurrentUser?.() || target.auth?.currentUser || target.currentUser || null;
}

function authContext(target = globalThis) {
  const user = currentUser(target) || {};
  const profile = target.currentUserProfile || {};
  return {
    actorUid: user.uid || '',
    ownerUid: user.uid || '',
    actorRole: target.currentUserRole || profile.role || 'user',
    actorStatus: target.currentAccountStatus || profile.status || 'active',
    correlationId: `import-ui-${Date.now()}`
  };
}

async function loadWorkbookFromXlsx(file, target = globalThis) {
  if (typeof target.ensureSpreadsheetLibrary === 'function') {
    await target.ensureSpreadsheetLibrary();
  }
  const xlsx = target.XLSX;
  if (!xlsx?.read || !xlsx?.utils?.sheet_to_json) throw new Error('XLSX_LIBRARY_NOT_READY');
  const buffer = await file.arrayBuffer();
  const workbook = xlsx.read(buffer, { type: 'array', cellDates: false });
  const sheetName = workbook.SheetNames?.[0] || '';
  const sheet = sheetName ? workbook.Sheets?.[sheetName] : null;
  return {
    SheetNames: workbook.SheetNames || [],
    Sheets: workbook.Sheets || {},
    __financeSheetToJson: sheet ? (targetOptions) => xlsx.utils.sheet_to_json(sheet, targetOptions) : null
  };
}

async function parseWorkbook(workbook, options = {}) {
  const { parseSpreadsheetImport } = await import('../../application/imports/spreadsheetImportParser.js');
  const sheetName = workbook.SheetNames?.[0] || '';
  return parseSpreadsheetImport(workbook, {
    kind: options.kind || 'expenses',
    sheetName,
    sheetToJson: workbook.__financeSheetToJson || undefined
  });
}

export async function installImportActiveUi(target = globalThis, options = {}) {
  const legacy = options.legacyModule || await import('../importacao.js');
  const presenter = options.presenter || createImportPresenter({ documentRef: target.document, target });
  const controller = options.controller || createImportController({
    presenter,
    repositoriesProvider: options.repositoriesProvider || (() => getImportPipelineRepositories(target)),
    contextProvider: options.contextProvider || (() => authContext(target)),
    loadWorkbook: options.loadWorkbook || ((file) => loadWorkbookFromXlsx(file, target)),
    parseSpreadsheet: options.parseSpreadsheet || parseWorkbook,
    connectivity: target.financeApp?.resilience?.connectivity || null,
    errorReporter: target.financeApp?.resilience?.errorReporter || null,
    onAfterCommit: () => {
      try {
        target.renderImportacao?.();
      } catch {}
    }
  });

  function bind() {
    presenter.renderShell();
    const doc = target.document;
    const fileInput = doc?.getElementById?.('modern-import-file');
    const kindInput = doc?.getElementById?.('modern-import-kind');
    const previewButton = doc?.getElementById?.('modern-import-preview');
    const commitButton = doc?.getElementById?.('modern-import-commit');
    const tabs = doc?.getElementById?.('modern-import-tabs');

    fileInput?.addEventListener('change', () => controller.setFile(fileInput.files?.[0] || null));
    kindInput?.addEventListener('change', () => controller.setKind(kindInput.value || 'expenses'));
    previewButton?.addEventListener('click', async () => {
      await controller.prepare({ file: fileInput?.files?.[0] || null, kind: kindInput?.value || 'expenses' });
    });
    commitButton?.addEventListener('click', async () => {
      await controller.commit();
    });
    tabs?.addEventListener('click', (event) => {
      const tab = event.target?.closest?.('[data-modern-import-tab]')?.dataset?.modernImportTab;
      if (tab) {
        const state = controller.getState();
        presenter.setTab(tab, state.previewModel, state.viewState);
      }
    });
  }

  const previousRender = legacy.renderImportacao || target.renderImportacao;
  target.renderImportacao = function renderImportacaoModernBridge(...args) {
    const result = typeof previousRender === 'function' ? previousRender.apply(this, args) : null;
    bind();
    return result;
  };
  Object.defineProperty(target.renderImportacao, '__financeModernImportUi', { value: true });

  target.financeApp = target.financeApp || {};
  target.financeApp.importActiveUi = {
    installed: true,
    controller,
    presenter,
    render: target.renderImportacao
  };

  return target.financeApp.importActiveUi;
}
