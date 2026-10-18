import { describe, expect, it } from 'vitest';
import { createApplicationDependencies } from '../../../src/application/dependencies/createApplicationDependencies.js';
import { buildOperationFingerprint } from '../../../src/application/gateway/idempotency.js';
import {
  CommitImportBatch,
  IMPORT_CANDIDATE_STATUS,
  IMPORT_MAX_ATOMIC_ROWS,
  IMPORT_TYPES,
  PrepareImportBatch,
  buildFileFingerprint,
  buildImportRowFingerprint,
  createImportDryRunFixtures
} from '../../../src/application/imports/importBatchUseCases.js';
import { APPLICATION_RESULT_CODES } from '../../../src/application/gateway/applicationResult.js';
import {
  SPREADSHEET_IMPORT_KINDS,
  createSpreadsheetDryRunFixtures,
  parseSpreadsheetImport
} from '../../../src/application/imports/spreadsheetImportParser.js';

const now = () => '2026-08-22T12:00:00.000Z';
const context = {
  actorUid: 'tester',
  ownerUid: 'owner-a',
  actorRole: 'admin',
  actorStatus: 'active',
  correlationId: 'corr-import-test'
};

function deps(options = {}) {
  return createApplicationDependencies({
    mode: 'memory',
    now,
    financeRecordIdGenerator: (() => {
      let next = 1;
      return () => `imported_${next++}`;
    })(),
    ...options
  });
}

const baseRows = [
  { person: 'Ana', description: 'Mercado', amount: 120.35, occurred_date: '2026-08-01', due_date: '2026-08-01', competence: '2026-08', status: 'Pago', type: 'saida', source_reference_id: 'bank-1' },
  { person: 'Ana', description: 'Energia', amount: 250, occurred_date: '2026-08-05', due_date: '2026-08-05', competence: '2026-08', status: 'Em aberto', type: 'saida', source_reference_id: 'bank-2' }
];

async function prepare(rows = baseRows, repositories = deps().repositories, extra = {}) {
  return PrepareImportBatch({
    rows,
    importType: IMPORT_TYPES.BANK_STATEMENT,
    originalFilename: extra.originalFilename || 'extrato-a.csv',
    fileContent: extra.fileContent ?? rows,
    context,
    repositories,
    now
  });
}

describe('import batch use cases', () => {
  it('builds file fingerprint from canonical content, independent of filename', () => {
    const content = '2026-08-01;Mercado;120.35';

    expect(buildFileFingerprint(content)).toBe(buildFileFingerprint(content));
    expect(buildFileFingerprint(content)).not.toBe(buildFileFingerprint(`${content}\n2026-08-02;Nova linha;1`));
  });

  it('builds stable row fingerprints for the same external transaction identity', () => {
    const row = baseRows[0];

    expect(buildImportRowFingerprint(row)).toBe(buildImportRowFingerprint({ ...row, description: 'Mercado ajustado' }));
    expect(buildImportRowFingerprint(row)).not.toBe(buildImportRowFingerprint({ ...row, source_reference_id: 'bank-99' }));
  });

  it('prepares a batch with ready candidates and no writes', async () => {
    const dependencies = deps();

    const result = await prepare(baseRows, dependencies.repositories);
    const listed = await dependencies.repositories.financeRecords.list({}, context);

    expect(result.success).toBe(true);
    expect(result.data.summary).toMatchObject({ totalRows: 2, readyRows: 2, skippedRows: 0 });
    expect(result.data.batch).toMatchObject({ import_type: IMPORT_TYPES.BANK_STATEMENT, source_channel: 'bank_import', status: 'ready' });
    expect(listed.count).toBe(0);
  });

  it('marks duplicate rows inside the same file without importing both', async () => {
    const result = await prepare([baseRows[0], { ...baseRows[0] }]);

    expect(result.data.candidates.map((candidate) => candidate.status)).toEqual([
      IMPORT_CANDIDATE_STATUS.READY,
      IMPORT_CANDIDATE_STATUS.DUPLICATE_IN_FILE
    ]);
    expect(result.data.summary).toMatchObject({ readyRows: 1, duplicateRows: 1, skippedRows: 1 });
  });

  it('marks conflict when the same external id has a different payload in the file', async () => {
    const result = await prepare([baseRows[0], { ...baseRows[0], amount: 121.35 }]);

    expect(result.data.candidates[1]).toMatchObject({
      status: IMPORT_CANDIDATE_STATUS.CONFLICT
    });
    expect(result.data.summary.conflictRows).toBe(1);
  });

  it('marks invalid rows using existing finance record validation', async () => {
    const result = await prepare([{ ...baseRows[0], status: 'Quitado' }]);

    expect(result.data.candidates[0].status).toBe(IMPORT_CANDIDATE_STATUS.INVALID);
    expect(result.data.errors.map((error) => error.code)).toContain('INVALID_FIELD_TYPE');
  });

  it('detects rows already imported by legacy signatures', async () => {
    const rowFingerprint = buildImportRowFingerprint(baseRows[0]);
    const dependencies = deps({
      records: [{
        ...baseRows[0],
        id: 'legacy-imported',
        owner_uid: context.ownerUid,
        import_signature: rowFingerprint
      }]
    });

    const result = await prepare(baseRows, dependencies.repositories);

    expect(result.data.candidates[0]).toMatchObject({
      status: IMPORT_CANDIDATE_STATUS.LEGACY_MATCH,
      existing_entity_id: 'legacy-imported'
    });
    expect(result.data.summary).toMatchObject({ readyRows: 1, alreadyImportedRows: 1 });
  });

  it('honors spreadsheet parser errors before persistence', async () => {
    const dependencies = deps();
    const parsed = parseSpreadsheetImport(createSpreadsheetDryRunFixtures().expenses, {
      kind: SPREADSHEET_IMPORT_KINDS.EXPENSES
    });

    const result = await PrepareImportBatch({
      rows: parsed.rows,
      importType: IMPORT_TYPES.SPREADSHEET,
      originalFilename: 'saidas.xlsx',
      fileContent: parsed.rows,
      context,
      repositories: dependencies.repositories,
      mapRowToPayload: (row) => row,
      now
    });

    const invalid = result.data.candidates.find((candidate) =>
      candidate.source_reference_id === 'xlsx-invalid'
    );
    expect(invalid.status).toBe(IMPORT_CANDIDATE_STATUS.INVALID);
    expect(invalid.validation_errors.map((error) => error.code)).toContain('INVALID_AMOUNT');
  });

  it('detects records imported by the previous XLSX legacy signature', async () => {
    const parsed = parseSpreadsheetImport(createSpreadsheetDryRunFixtures().expenses, {
      kind: SPREADSHEET_IMPORT_KINDS.EXPENSES
    });
    const existingRow = parsed.rows.find((row) => row.source_reference_id === 'xlsx-existing');
    const dependencies = deps({
      records: [{
        ...existingRow,
        id: 'legacy-xlsx-1',
        owner_uid: context.ownerUid,
        import_signature: existingRow.legacy_import_signature
      }]
    });

    const result = await PrepareImportBatch({
      rows: parsed.rows,
      importType: IMPORT_TYPES.SPREADSHEET,
      originalFilename: 'saidas.xlsx',
      fileContent: parsed.rows,
      context,
      repositories: dependencies.repositories,
      mapRowToPayload: (row) => row,
      now
    });

    const candidate = result.data.candidates.find((item) =>
      item.source_reference_id === 'xlsx-existing'
    );
    expect(candidate).toMatchObject({
      status: IMPORT_CANDIDATE_STATUS.LEGACY_MATCH,
      existing_entity_id: 'legacy-xlsx-1'
    });
  });

  it('detects idempotency receipt conflict before commit', async () => {
    const dependencies = deps();
    const firstPreview = await prepare([baseRows[0]], dependencies.repositories);
    const candidate = firstPreview.data.candidates[0];
    await dependencies.repositories.idempotency.reserve({
      ownerUid: context.ownerUid,
      commandName: 'ImportRowCommand',
      sourceChannel: candidate.source_channel,
      idempotencyKey: candidate.idempotency_key,
      requestFingerprint: buildOperationFingerprint({
        ownerUid: context.ownerUid,
        commandName: 'ImportRowCommand',
        sourceChannel: candidate.source_channel,
        payload: { changed: true }
      }),
      correlationId: context.correlationId
    }, context);

    const result = await prepare([baseRows[0]], dependencies.repositories);

    expect(result.data.candidates[0].status).toBe(IMPORT_CANDIDATE_STATUS.CONFLICT);
  });

  it('commits only ready rows in one repository batch', async () => {
    const dependencies = deps();
    const prepared = await prepare([baseRows[0], { ...baseRows[0] }, { ...baseRows[1], status: 'Quitado' }], dependencies.repositories);

    const result = await CommitImportBatch({
      preparedBatch: prepared.data,
      context,
      repositories: dependencies.repositories,
      now
    });
    const listed = await dependencies.repositories.financeRecords.list({}, context);

    expect(result.success).toBe(true);
    expect(result.entityIds).toEqual(['imported_1']);
    expect(result.data).toMatchObject({ imported: 1, skipped: 2 });
    expect(listed.items).toHaveLength(1);
    expect(listed.items[0]).toMatchObject({ import_batch_id: prepared.data.batch.batch_id, idempotency_key: expect.stringContaining('import-row:') });
  });

  it('replays a committed batch without creating records again', async () => {
    const dependencies = deps();
    const prepared = await prepare(baseRows, dependencies.repositories);

    const first = await CommitImportBatch({ preparedBatch: prepared.data, context, repositories: dependencies.repositories, now });
    const second = await CommitImportBatch({ preparedBatch: prepared.data, context, repositories: dependencies.repositories, now });
    const listed = await dependencies.repositories.financeRecords.list({}, context);

    expect(first.success).toBe(true);
    expect(second).toMatchObject({ success: true, code: APPLICATION_RESULT_CODES.IDEMPOTENT_REPLAY, idempotentReplay: true });
    expect(second.entityIds).toEqual(first.entityIds);
    expect(listed.items).toHaveLength(2);
  });

  it('rejects batches above the atomic row limit before writing', async () => {
    const dependencies = deps();
    const rows = Array.from({ length: IMPORT_MAX_ATOMIC_ROWS + 1 }, (_, index) => ({
      ...baseRows[0],
      amount: index + 1,
      description: `Linha ${index + 1}`,
      source_reference_id: `bulk-${index + 1}`
    }));
    const prepared = await prepare(rows, dependencies.repositories);

    const result = await CommitImportBatch({ preparedBatch: prepared.data, context, repositories: dependencies.repositories, now });
    const listed = await dependencies.repositories.financeRecords.list({}, context);

    expect(result).toMatchObject({ success: false, code: APPLICATION_RESULT_CODES.VALIDATION_ERROR });
    expect(listed.items).toHaveLength(0);
  });

  it('does not partially persist when createMany fails', async () => {
    const dependencies = deps();
    dependencies.repositories.financeRecords.failNext('createMany');
    const prepared = await prepare(baseRows, dependencies.repositories);

    const result = await CommitImportBatch({ preparedBatch: prepared.data, context, repositories: dependencies.repositories, now });
    const listed = await dependencies.repositories.financeRecords.list({}, context);

    expect(result).toMatchObject({ success: false, code: APPLICATION_RESULT_CODES.PERSISTENCE_ERROR });
    expect(listed.items).toHaveLength(0);
  });

  it('provides dry-run fixtures for duplicate, invalid, existing and conflict scenarios', () => {
    const fixtures = createImportDryRunFixtures();

    expect(fixtures.fileA).toHaveLength(6);
    expect(fixtures.fileBWithSameContentDifferentName).toEqual(fixtures.fileA);
    expect(fixtures.changedFile[0].amount).not.toBe(fixtures.fileA[0].amount);
  });
});
