import { describe, expect, it, vi } from 'vitest';
import { createApplicationDependencies } from '../../src/application/dependencies/createApplicationDependencies.js';
import { createImportController } from '../../src/ui/imports/importController.js';

const now = () => '2026-09-06T12:00:00.000Z';
const context = {
  actorUid: 'owner-a',
  ownerUid: 'owner-a',
  actorRole: 'admin',
  actorStatus: 'active',
  correlationId: 'corr-import-ui'
};

function file(name = 'saidas.xlsx') {
  return { name, size: 12, type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', lastModified: 1 };
}

function rows() {
  return [
    { type: 'saida', person: 'Ana', description: 'Mercado', amount: 10, status: 'Pago', occurred_date: '2026-08-01', due_date: '2026-08-01', competence: '2026-08', source_reference_id: 'xlsx-1' },
    { type: 'saida', person: 'Ana', description: 'Mercado', amount: 10, status: 'Pago', occurred_date: '2026-08-01', due_date: '2026-08-01', competence: '2026-08', source_reference_id: 'xlsx-1' },
    { type: 'saida', person: '', description: '', amount: 0, status: 'Pago', occurred_date: '', due_date: '', competence: '', source_reference_id: 'bad', parser_errors: [{ code: 'MISSING_PERSON', message: 'Pessoa obrigatoria.' }] }
  ];
}

function presenter() {
  return {
    renderPreview: vi.fn(),
    renderCommitResult: vi.fn(),
    renderError: vi.fn(),
    setBusy: vi.fn(),
    setTab: vi.fn()
  };
}

async function waitUntil(predicate, attempts = 20) {
  for (let index = 0; index < attempts; index += 1) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  throw new Error('WAIT_TIMEOUT');
}

function controllerHarness(overrides = {}) {
  const dependencies = createApplicationDependencies({
    mode: 'memory',
    now,
    financeRecordIdGenerator: (() => {
      let next = 1;
      return () => `imported_${next++}`;
    })()
  });
  const ui = presenter();
  const controller = createImportController({
    presenter: ui,
    repositoriesProvider: () => dependencies.repositories,
    contextProvider: () => context,
    loadWorkbook: overrides.loadWorkbook || vi.fn(async () => ({ workbook: true })),
    parseSpreadsheet: overrides.parseSpreadsheet || vi.fn(async () => ({ ok: true, sheetName: 'Plan1', rows: rows(), errors: [], ignoredRows: [{ row_index: 5, reason: 'Linha vazia.' }] })),
    connectivity: overrides.connectivity || { isOnline: () => true },
    now,
    onAfterCommit: overrides.onAfterCommit || vi.fn()
  });
  return { controller, dependencies, ui };
}

describe('importController', () => {
  it('prepares preview through canonical batch and preserves grouped state', async () => {
    const { controller } = controllerHarness();

    const result = await controller.prepare({ file: file(), kind: 'expenses' });
    const state = controller.getState();

    expect(result.success).toBe(true);
    expect(state.previewModel.summary).toMatchObject({
      readyRows: 1,
      invalidRows: 1,
      duplicateRows: 1,
      ignoredRows: 1
    });
    expect(state.preparedEnvelope.prepared.batch.source_channel).toBe('spreadsheet_import');
  });

  it('commits only ready candidates and replay does not duplicate records', async () => {
    const { controller, dependencies, ui } = controllerHarness();

    await controller.prepare({ file: file(), kind: 'expenses' });
    const first = await controller.commit();
    const second = await controller.commit();
    const listed = await dependencies.repositories.financeRecords.list({}, context);

    expect(first.success).toBe(true);
    expect(second.success).toBe(true);
    expect(listed.items).toHaveLength(1);
    expect(ui.renderCommitResult).toHaveBeenCalled();
  });

  it('ignores duplicate commit click while a commit is running', async () => {
    let release;
    const { controller, dependencies } = controllerHarness();
    const originalCreateMany = dependencies.repositories.financeRecords.createMany.bind(dependencies.repositories.financeRecords);
    dependencies.repositories.financeRecords.createMany = vi.fn(async (...args) => {
      await new Promise((resolve) => { release = resolve; });
      return originalCreateMany(...args);
    });
    await controller.prepare({ file: file(), kind: 'expenses' });

    const first = controller.commit();
    await waitUntil(() => typeof release === 'function');
    const second = await controller.commit();
    release();
    await first;

    expect(second).toEqual({ ignored: true, reason: 'COMMIT_IN_PROGRESS' });
    expect(dependencies.repositories.financeRecords.createMany).toHaveBeenCalledTimes(1);
  });

  it('keeps preview when commit fails', async () => {
    const { controller, dependencies } = controllerHarness();
    await controller.prepare({ file: file(), kind: 'expenses' });
    dependencies.repositories.financeRecords.failNext('createMany');

    const result = await controller.commit();
    const state = controller.getState();

    expect(result.success).toBe(false);
    expect(state.previewModel.summary.readyRows).toBe(1);
    expect(state.viewState.status).toBe('stale');
  });

  it('keeps previous preview when lazy XLSX loading fails and can retry', async () => {
    const loadWorkbook = vi.fn()
      .mockResolvedValueOnce({ workbook: true })
      .mockRejectedValueOnce(new Error('LOAD_FAILED:XLSX'))
      .mockResolvedValueOnce({ workbook: true });
    const { controller } = controllerHarness({ loadWorkbook });

    await controller.prepare({ file: file('ok.xlsx'), kind: 'expenses' });
    const failed = await controller.prepare({ file: file('fail.xlsx'), kind: 'expenses' });
    const retry = await controller.prepare({ file: file('retry.xlsx'), kind: 'expenses' });

    expect(failed.success).toBe(false);
    expect(controller.getState().previewModel.summary.readyRows).toBe(1);
    expect(retry.success).toBe(true);
  });

  it('sets offline state without parsing', async () => {
    const parseSpreadsheet = vi.fn();
    const { controller } = controllerHarness({
      connectivity: { isOnline: () => false },
      parseSpreadsheet
    });

    const result = await controller.prepare({ file: file(), kind: 'expenses' });

    expect(result.success).toBe(false);
    expect(parseSpreadsheet).not.toHaveBeenCalled();
    expect(controller.getState().viewState.status).toBe('offline');
  });

  it('clears batch state when owner changes', async () => {
    let nextContext = context;
    const { controller } = controllerHarness();
    controller.resetForOwner('owner-a');
    await controller.prepare({ file: file(), kind: 'expenses' });
    nextContext = { ...context, actorUid: 'owner-b', ownerUid: 'owner-b' };
    const fresh = createImportController({
      presenter: presenter(),
      repositoriesProvider: () => createApplicationDependencies({ mode: 'memory', now }).repositories,
      contextProvider: () => nextContext,
      loadWorkbook: vi.fn(async () => ({ workbook: true })),
      parseSpreadsheet: vi.fn(async () => ({ ok: true, sheetName: 'Plan1', rows: rows(), errors: [], ignoredRows: [] })),
      now
    });

    fresh.resetForOwner('owner-a');
    await fresh.prepare({ file: file(), kind: 'expenses' });

    expect(fresh.getState().ownerKey).toBe('owner-b');
  });
});
