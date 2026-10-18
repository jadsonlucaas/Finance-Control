import { describe, expect, it } from 'vitest';
import { buildImportPreviewReadModel } from '../../../src/application/readModels/importPreviewReadModel.js';

const preparedBatch = Object.freeze({
  batch: {
    batch_id: 'batch-a',
    import_type: 'spreadsheet',
    source_channel: 'spreadsheet_import',
    original_filename: 'saidas.xlsx',
    idempotency_key: 'idem-a',
    correlation_id: 'corr-a',
    status: 'ready'
  },
  candidates: [
    { candidate_id: 'row_1', row_index: 1, source_row_reference: '2', status: 'ready', source_reference_id: 'a', normalized_payload: { type: 'saida', person: 'Ana', description: 'Mercado', competence: '2026-08', occurred_date: '2026-08-01', amount: 10 } },
    { candidate_id: 'row_2', row_index: 2, source_row_reference: '3', status: 'invalid', source_reference_id: 'b', normalized_payload: { type: 'saida', person: '', description: '', competence: '', amount: 0 }, validation_errors: [{ field: 'person', code: 'MISSING_PERSON', message: 'Pessoa obrigatoria.' }] },
    { candidate_id: 'row_3', row_index: 3, source_row_reference: '4', status: 'duplicate_in_file', source_reference_id: 'c', normalized_payload: { type: 'saida', person: 'Ana', description: 'Duplicada', competence: '2026-08', amount: 11 } },
    { candidate_id: 'row_4', row_index: 4, source_row_reference: '5', status: 'already_imported', source_reference_id: 'd', existing_entity_id: 'rec-1', normalized_payload: { type: 'saida', person: 'Ana', description: 'Ja foi', competence: '2026-08', amount: 12 } },
    { candidate_id: 'row_5', row_index: 5, source_row_reference: '6', status: 'conflict', source_reference_id: 'e', conflict_reason: 'Mesmo id com payload diferente.', normalized_payload: { type: 'saida', person: 'Ana', description: 'Conflito', competence: '2026-08', amount: 13 } },
    { candidate_id: 'row_6', row_index: 6, source_row_reference: '7', status: 'ignored', source_reference_id: 'f', normalized_payload: { type: 'entrada', person: 'Ana', description: 'Credito', competence: '2026-08', amount: 14 } }
  ],
  warnings: [{ code: 'LIMIT_WARNING', message: 'Limite aplicado.' }]
});

describe('importPreviewReadModel', () => {
  it('builds deterministic grouped preview without mutating input', () => {
    const input = {
      preparedBatch,
      parsed: { sheetName: 'Plan1', ignoredRows: [{ row_index: 8, reason: 'Linha vazia.' }] },
      fileMetadata: { name: 'saidas.xlsx', size: 123 },
      options: { kind: 'expenses' }
    };
    const before = JSON.stringify(input);

    const first = buildImportPreviewReadModel(input);
    const second = buildImportPreviewReadModel(input);

    expect(JSON.stringify(input)).toBe(before);
    expect(second).toEqual(first);
    expect(first.summary).toMatchObject({
      totalRows: 6,
      readyRows: 1,
      invalidRows: 1,
      duplicateRows: 2,
      conflictRows: 1,
      ignoredRows: 2
    });
    expect(first.ready[0]).toMatchObject({ id: 'row_1', person: 'Ana', amount: 10 });
    expect(first.invalid[0].reason).toContain('Pessoa obrigatoria');
    expect(first.duplicates.map((row) => row.status)).toEqual(['duplicate_in_file', 'already_imported']);
    expect(first.conflicts[0].reason).toContain('payload diferente');
    expect(first.ignored).toHaveLength(2);
    expect(first.warnings).toEqual([{ code: 'LIMIT_WARNING', message: 'Limite aplicado.' }]);
    expect(first.metadata).toMatchObject({
      source: 'spreadsheet_import',
      batchId: 'batch-a',
      fileName: 'saidas.xlsx',
      sheetName: 'Plan1'
    });
  });
});
