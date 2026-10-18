import { describe, expect, it } from 'vitest';
import {
  buildFinancialReportReadModel,
  buildReportFilename
} from '../../../src/application/readModels/financialReportReadModel.js';

function records() {
  return [
    { id: 'in-a', type: 'entrada', owner_uid: 'uid-a', person: 'Ana', competence: '2026-08', amount: 3000, cardLiquido: 3000, token: 'secret' },
    { id: 'out-a-paid', type: 'saida', owner_uid: 'uid-a', person: 'Ana', competence: '2026-08', due_date: '2026-08-10', amount: 500, status: 'Pago', macro_category: 'Fixo', telefone: '999' },
    { id: 'out-a-open', type: 'saida', owner_uid: 'uid-a', person: 'Ana', competence: '2026-08', due_date: '2026-08-15', amount: 200, status: 'Em aberto', macro_category: 'Variavel' },
    { id: 'out-b', type: 'saida', owner_uid: 'uid-b', person: 'Bia', competence: '2026-08', amount: 900, status: 'Pago', macro_category: 'Fixo' },
    { id: 'archived', type: 'saida', owner_uid: 'uid-a', person: 'Ana', competence: '2026-08', amount: 100, status: 'Pago', archived: true }
  ];
}

describe('FinancialReportReadModel', () => {
  it('is deterministic, keeps input immutable and does not export sensitive fields', () => {
    const inputRecords = records().filter((record) => record.owner_uid === 'uid-a');
    const before = JSON.stringify(inputRecords);
    const input = {
      financeRecords: inputRecords,
      filters: { start: '2026-08', end: '2026-08', person: 'Ana' },
      userContext: { ownerUid: 'uid-a' },
      options: { generatedAt: '2026-09-08T12:00:00.000Z' }
    };

    const first = buildFinancialReportReadModel(input);
    const second = buildFinancialReportReadModel(input);

    expect(JSON.stringify(inputRecords)).toBe(before);
    expect(first).toEqual(second);
    expect(first.summary).toMatchObject({
      receitas: 3000,
      despesas: 500,
      emAberto: 200,
      saldoProjetado: 2300,
      totalRegistros: 3
    });
    expect(JSON.stringify(first)).not.toMatch(/token|secret|telefone|owner_uid|uid-a/i);
  });

  it('reuses supplied canonical PDF data and preserves open-card semantics', () => {
    const report = buildFinancialReportReadModel({
      financeRecords: records(),
      filters: { start: '2026-08', end: '2026-08' },
      options: {
        focusedDashboardCard: 'aberto',
        generatedAt: '2026-09-08T12:00:00.000Z',
        pdfFinancialData: {
          detailedRecords: [{ id: 'out-a-open', type: 'saida', person: 'Ana', amount: 200, status: 'Em aberto', competence: '2026-08' }],
          financialEntradas: [{ id: 'in-a', type: 'entrada', person: 'Ana', amount: 3000, cardLiquido: 3000, competence: '2026-08' }],
          dashboardEntradas: [{ id: 'in-a', type: 'entrada', person: 'Ana', amount: 3000, cardLiquido: 3000, competence: '2026-08' }],
          saidas: [{ id: 'out-a-open', type: 'saida', person: 'Ana', amount: 200, status: 'Em aberto', competence: '2026-08' }],
          paidSaidas: [],
          openSaidas: [{ id: 'out-a-open', type: 'saida', person: 'Ana', amount: 200, status: 'Em aberto', competence: '2026-08' }],
          totals: { receitas: 3000, despesas: 0, emAberto: 200, saldoRealizado: 3000, saldoProjetado: 2800, saldoLiquido: 2800, comprometimento: 0 }
        }
      }
    });

    expect(report.title).toContain('Em Aberto');
    expect(report.tables.detailedRows).toHaveLength(1);
    expect(report.summary).toMatchObject({ receitas: 3000, despesas: 0, emAberto: 200, saldoProjetado: 2800 });
  });

  it('builds a filename without technical PII', () => {
    const filename = buildReportFilename({
      reportType: 'financial',
      period: { start: '2026-08', end: '2026-09' },
      generatedAt: '2026-09-08T12:00:00.000Z'
    });
    expect(filename).toBe('relatorio-financial-2026-08-2026-09-20260908.pdf');
    expect(filename).not.toMatch(/uid|@|telefone|whatsapp|token/i);
  });
});
