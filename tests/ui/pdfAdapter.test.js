import { describe, expect, it, vi } from 'vitest';
import { createPdfReport, localizedPdfFilename } from '../../src/ui/reports/pdfAdapter.js';
import { setLocale } from '../../src/core/i18n.js';

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

  it('periodo como mes/ano e nome do arquivo no idioma da conta', async () => {
    const { target, doc } = createTarget();
    const textCalls = doc.text.mock.calls;
    const model = {
      generatedAt: '2026-11-14T12:00:00.000Z',
      period: { start: '2026-11', end: '2026-11' },
      tables: { summaryRows: [], detailedRows: [] },
      metadata: { filename: 'relatorio-financial-2026-11-2026-11-20261114.pdf' }
    };
    await createPdfReport(model, { target, ensurePdfLibraries: async () => {} });
    expect(textCalls.some(([text]) => String(text).includes('Periodo nov/2026 ate nov/2026'))).toBe(true);
    expect(localizedPdfFilename('relatorio-financial-2026-11-2026-11-20261114.pdf', 'pt-BR')).toBe('relatorio-financial-2026-11-2026-11-20261114.pdf');
    expect(localizedPdfFilename('relatorio-financial-2026-11-2026-11-20261114.pdf', 'es-ES')).toBe('informe-financiero-2026-11-2026-11-20261114.pdf');
    await setLocale('es-ES');
    const es = createTarget();
    const esCalls = es.doc.text.mock.calls;
    const result = await createPdfReport(model, { target: es.target, ensurePdfLibraries: async () => {} });
    expect(result.filename).toBe('informe-financiero-2026-11-2026-11-20261114.pdf');
    expect(esCalls.some(([text]) => String(text).includes('Periodo nov/2026 hasta nov/2026'))).toBe(true);
    await setLocale('pt-BR');
  });
});
