import { describe, expect, it, vi } from 'vitest';
import { createReportExportController } from '../../src/ui/reports/reportExportController.js';

function createPresenter() {
  return { render: vi.fn() };
}

function source(records = []) {
  return {
    read: vi.fn(async () => ({
      records,
      filters: { start: '2026-08', end: '2026-08' },
      userContext: { ownerUid: 'uid-a', ownerKey: 'uid-a' }
    }))
  };
}

describe('ReportExportController', () => {
  it('moves through loading and success without writing data', async () => {
    const presenter = createPresenter();
    const readSource = source([
      { id: 'in', type: 'entrada', person: 'Ana', competence: '2026-08', amount: 1000 },
      { id: 'out', type: 'saida', person: 'Ana', competence: '2026-08', amount: 100, status: 'Pago' }
    ]);
    const createPdfReport = vi.fn(async () => ({ success: true, filename: 'relatorio.pdf' }));
    const controller = createReportExportController({
      presenter,
      readSource,
      pdfAdapterLoader: async () => ({ createPdfReport }),
      now: () => '2026-09-08T12:00:00.000Z'
    });

    const result = await controller.exportReport();

    expect(result).toMatchObject({ success: true, wrote: false });
    expect(createPdfReport).toHaveBeenCalledWith(expect.objectContaining({ title: expect.stringContaining('Relatorio') }), expect.any(Object));
    expect(controller.getState().status).toBe('success');
    expect(presenter.render.mock.calls.some(([state]) => state.status === 'loading')).toBe(true);
  });

  it('returns empty state without loading the PDF adapter', async () => {
    const controller = createReportExportController({
      presenter: createPresenter(),
      readSource: source([]),
      pdfAdapterLoader: vi.fn(async () => ({ createPdfReport: vi.fn() }))
    });

    const result = await controller.exportReport();

    expect(result.empty).toBe(true);
    expect(result.wrote).toBe(false);
    expect(controller.getState().status).toBe('empty');
  });

  it('keeps retryable error state for data and lazy-load failures', async () => {
    const reporter = { report: vi.fn() };
    const controller = createReportExportController({
      presenter: createPresenter(),
      readSource: { read: vi.fn(async () => { throw new Error('network unavailable'); }) },
      errorReporter: reporter
    });

    const result = await controller.exportReport();

    expect(result.success).toBe(false);
    expect(result.wrote).toBe(false);
    expect(controller.getState().retryAvailable).toBe(true);
    expect(reporter.report).toHaveBeenCalled();
  });

  it('protects duplicate clicks and resets when owner changes', async () => {
    let resolveRead;
    const readSource = {
      read: vi.fn(() => new Promise((resolve) => { resolveRead = resolve; }))
    };
    const createPdfReport = vi.fn(async () => ({ success: true, filename: 'relatorio.pdf' }));
    const controller = createReportExportController({
      presenter: createPresenter(),
      readSource,
      pdfAdapterLoader: async () => ({ createPdfReport }),
      now: () => '2026-09-08T12:00:00.000Z'
    });

    const first = controller.exportReport();
    const second = controller.exportReport();
    resolveRead({
      records: [{ id: 'in', type: 'entrada', person: 'Ana', competence: '2026-08', amount: 1000 }],
      filters: { start: '2026-08', end: '2026-08' },
      userContext: { ownerUid: 'uid-a', ownerKey: 'uid-a' }
    });
    await Promise.all([first, second]);
    controller.resetForOwner('uid-b');

    expect(readSource.read).toHaveBeenCalledTimes(1);
    expect(controller.getState().status).toBe('idle');
  });

  it('normalizes generation failures without stack text in state', async () => {
    const controller = createReportExportController({
      presenter: createPresenter(),
      readSource: source([{ id: 'in', type: 'entrada', person: 'Ana', competence: '2026-08', amount: 1000 }]),
      pdfAdapterLoader: async () => ({ createPdfReport: async () => { throw new Error('boom stack trace'); } })
    });

    const result = await controller.exportReport();

    expect(result.success).toBe(false);
    expect(JSON.stringify(controller.getState().error)).not.toMatch(/at Object|at async/);
  });
});
