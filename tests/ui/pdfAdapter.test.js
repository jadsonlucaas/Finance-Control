import { describe, expect, it, vi } from 'vitest';
import { createPdfReport } from '../../src/ui/reports/pdfAdapter.js';

function createTarget() {
  const save = vi.fn();
  const autoTable = vi.fn();
  const doc = {
    setFontSize: vi.fn(),
    text: vi.fn(),
    addPage: vi.fn(),
    save,
    getNumberOfPages: () => 2,
    autoTable
  };
  const jsPDF = vi.fn(() => doc);
  return {
    target: { jspdf: { jsPDF } },
    doc,
    save,
    autoTable
  };
}

describe('pdfAdapter', () => {
  it('receives a ready report model and saves a safe filename', async () => {
    const { target, save, autoTable } = createTarget();
    const ensurePdfLibraries = vi.fn(async () => {});
    const result = await createPdfReport({
      title: 'Relatorio Financeiro Gerencial',
      generatedAt: '2026-09-08T12:00:00.000Z',
      period: { start: '2026-08', end: '2026-08' },
      summary: { receitas: 1000 },
      tables: {
        summaryRows: [['Receitas', 1000]],
        detailedRows: [{ data: '2026-08-10', tipo: 'Entrada', pessoa: 'Ana', categoria: 'Salario', descricao: 'Salario', valor: 1000, status: 'Pago', competencia: '2026-08' }]
      },
      metadata: { filename: 'relatorio-financial-2026-08-2026-08-20260908.pdf' }
    }, { target, ensurePdfLibraries });

    expect(result).toMatchObject({ success: true, filename: 'relatorio-financial-2026-08-2026-08-20260908.pdf' });
    expect(ensurePdfLibraries).toHaveBeenCalled();
    expect(autoTable).toHaveBeenCalledTimes(2);
    expect(save).toHaveBeenCalledWith('relatorio-financial-2026-08-2026-08-20260908.pdf');
    expect(save.mock.calls[0][0]).not.toMatch(/uid|@|telefone|whatsapp|token/i);
  });

  it('fails before generation when PDF libraries are unavailable', async () => {
    await expect(createPdfReport({ tables: { summaryRows: [], detailedRows: [] } }, { target: {}, ensurePdfLibraries: async () => {} }))
      .rejects.toThrow('PDF_LIBRARY_NOT_READY');
  });
});
