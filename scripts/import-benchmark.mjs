import { performance } from 'node:perf_hooks';
import {
  CommitImportBatch,
  IMPORT_MAX_ATOMIC_ROWS,
  IMPORT_TYPES,
  PrepareImportBatch
} from '../src/application/imports/importBatchUseCases.js';
import { parseSpreadsheetImport, SPREADSHEET_IMPORT_KINDS } from '../src/application/imports/spreadsheetImportParser.js';
import { createApplicationDependencies } from '../src/application/dependencies/createApplicationDependencies.js';
import { buildImportPreviewReadModel } from '../src/application/readModels/importPreviewReadModel.js';

function rows(count) {
  return Array.from({ length: count }, (_, index) => ({
    Data: '2026-08-10',
    Classe: 'Inicio do mes',
    Categoria_macro: 'Variavel',
    Categoria: 'Benchmark',
    Descricao: `Linha ${index}`,
    Parcela: '',
    'Valor Orcado': (index % 25) + 1,
    STATUS: 'Pago',
    Pagamento: 'Pix',
    'Quem paga': index % 2 === 0 ? 'Ana' : 'Bruno',
    'Data competencia': '2026-08',
    'Identificador externo': `bench-${index + 1}`
  }));
}

const context = { actorUid: 'bench-user', ownerUid: 'bench-user', accountStatus: 'active', sourceChannel: 'spreadsheet_import', correlationId: 'import-benchmark' };
const results = [];

for (const size of [100, 1000, IMPORT_MAX_ATOMIC_ROWS]) {
  const dependencies = createApplicationDependencies({ mode: 'memory', records: [] });
  const rawRows = rows(size);
  const parseStarted = performance.now();
  const parsed = parseSpreadsheetImport(rawRows, { kind: SPREADSHEET_IMPORT_KINDS.EXPENSES });
  const parseMs = performance.now() - parseStarted;

  const prepareStarted = performance.now();
  const prepared = await PrepareImportBatch({
    rows: parsed.rows,
    importType: IMPORT_TYPES.SPREADSHEET,
    originalFilename: `bench-${size}.xlsx`,
    fileContent: parsed.rows,
    context,
    repositories: dependencies.repositories,
    now: () => '2026-08-23T12:00:00.000Z'
  });
  const prepareMs = performance.now() - prepareStarted;

  const previewStarted = performance.now();
  const preview = buildImportPreviewReadModel({
    preparedBatch: prepared.data,
    parsed,
    source: 'spreadsheet_import',
    fileMetadata: { name: `bench-${size}.xlsx`, size }
  });
  const previewMs = performance.now() - previewStarted;

  const commitStarted = performance.now();
  const commit = size <= IMPORT_MAX_ATOMIC_ROWS
    ? await CommitImportBatch({
      preparedBatch: prepared.data,
      context,
      repositories: dependencies.repositories,
      now: () => '2026-08-23T12:00:00.000Z'
    })
    : { success: true, skipped: true, reason: `Acima do limite atomico ${IMPORT_MAX_ATOMIC_ROWS}` };
  const commitMs = performance.now() - commitStarted;

  results.push({
    size,
    parseMs: Number(parseMs.toFixed(3)),
    prepareMs: Number(prepareMs.toFixed(3)),
    previewReadModelMs: Number(previewMs.toFixed(3)),
    commitMs: Number(commitMs.toFixed(3)),
    totalMs: Number((parseMs + prepareMs + previewMs + commitMs).toFixed(3)),
    success: prepared.success && commit.success,
    readyRows: preview.summary.readyRows,
    committedRows: commit.data?.imported || 0,
    commitSkipped: commit.skipped === true,
    wrote: false
  });
}

console.log(JSON.stringify({ ok: results.every((item) => item.success), wrote: false, results }, null, 2));
