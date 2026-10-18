import { createApplicationDependencies } from '../src/application/dependencies/createApplicationDependencies.js';
import { buildOperationFingerprint } from '../src/application/gateway/idempotency.js';
import {
  CommitImportBatch,
  IMPORT_TYPES,
  PrepareImportBatch
} from '../src/application/imports/importBatchUseCases.js';
import {
  SPREADSHEET_IMPORT_KINDS,
  createSpreadsheetDryRunFixtures,
  parseSpreadsheetImport
} from '../src/application/imports/spreadsheetImportParser.js';

const now = () => '2026-08-22T12:00:00.000Z';
const context = {
  actorUid: 'xlsx-dry-run-admin',
  ownerUid: 'xlsx-dry-run-owner',
  actorRole: 'admin',
  actorStatus: 'active',
  correlationId: 'xlsx-dry-run'
};

function fail(message, details = {}) {
  console.error(JSON.stringify({ ok: false, message, ...details }, null, 2));
  process.exit(1);
}

const fixtures = createSpreadsheetDryRunFixtures();
const parsed = parseSpreadsheetImport(fixtures.expenses, {
  kind: SPREADSHEET_IMPORT_KINDS.EXPENSES
});

if (!parsed.ok || parsed.rows.length !== 9) {
  fail('Parser XLSX nao produziu as linhas esperadas.', { parsed });
}

const existingRow = parsed.rows.find((row) => row.source_reference_id === 'xlsx-existing');
const dependencies = createApplicationDependencies({
  mode: 'memory',
  now,
  records: [{
    ...existingRow,
    id: 'existing-xlsx-record',
    owner_uid: context.ownerUid,
    import_signature: existingRow.legacy_import_signature
  }],
  financeRecordIdGenerator: (() => {
    let next = 1;
    return () => `xlsx_imported_${next++}`;
  })()
});

const conflictPreview = await PrepareImportBatch({
  rows: parsed.rows,
  importType: IMPORT_TYPES.SPREADSHEET,
  originalFilename: 'saidas.xlsx',
  fileContent: parsed.rows,
  context,
  repositories: dependencies.repositories,
  mapRowToPayload: (row) => row,
  now
});

if (!conflictPreview.success) fail('Prepare inicial falhou.', { result: conflictPreview });

const conflictCandidate = conflictPreview.data.candidates.find((candidate) =>
  candidate.source_reference_id === 'xlsx-conflict'
);
await dependencies.repositories.idempotency.reserve({
  ownerUid: context.ownerUid,
  commandName: 'ImportRowCommand',
  sourceChannel: conflictCandidate.source_channel,
  idempotencyKey: conflictCandidate.idempotency_key,
  requestFingerprint: buildOperationFingerprint({
    ownerUid: context.ownerUid,
    commandName: 'ImportRowCommand',
    sourceChannel: conflictCandidate.source_channel,
    payload: { changed: true }
  }),
  correlationId: context.correlationId
}, context);

const prepared = await PrepareImportBatch({
  rows: parsed.rows,
  importType: IMPORT_TYPES.SPREADSHEET,
  originalFilename: 'saidas-renomeado.xlsx',
  fileContent: fixtures.sameContentDifferentName,
  context,
  repositories: dependencies.repositories,
  mapRowToPayload: (row) => row,
  now
});

if (!prepared.success) fail('Prepare com cenarios XLSX falhou.', { result: prepared });

const summary = prepared.data.summary;
if (summary.totalRows !== 9) fail('Total de linhas inesperado.', { summary });
if (summary.readyRows !== 5) fail('Quantidade de linhas prontas inesperada.', { summary });
if (summary.duplicateRows !== 1) fail('Duplicidade interna nao detectada.', { summary });
if (summary.invalidRows !== 1) fail('Linha invalida nao detectada.', { summary });
if (summary.alreadyImportedRows !== 1) fail('Assinatura legada existente nao detectada.', { summary });
if (summary.conflictRows !== 1) fail('Conflito de idempotencia nao detectado.', { summary });

const committed = await CommitImportBatch({
  preparedBatch: prepared.data,
  context,
  repositories: dependencies.repositories,
  now
});

if (!committed.success) fail('Commit XLSX falhou.', { result: committed });
if (committed.data.imported !== 5) fail('Commit importou quantidade inesperada.', { result: committed });

const listed = await dependencies.repositories.financeRecords.list({}, context);
const imported = listed.items.filter((record) => record.import_batch_id === prepared.data.batch.batch_id);
if (imported.length !== 5) fail('Persistencia atomica XLSX inesperada.', { imported });
if (imported.some((record) => record.source_channel !== 'spreadsheet_import')) {
  fail('source_channel XLSX inesperado.', { imported });
}

console.log(JSON.stringify({
  ok: true,
  wrote: false,
  note: 'Contagens simuladas em repositorio em memoria; nenhuma escrita em Firebase real foi executada.',
  source_channel: 'spreadsheet_import',
  summary,
  simulatedImported: committed.data.imported,
  simulatedPersisted: imported.length
}, null, 2));
