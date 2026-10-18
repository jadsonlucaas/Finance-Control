import { InMemoryIdempotencyRepository } from '../repositories/inMemoryIdempotencyRepository.js';
import {
  REPOSITORY_ERROR_CODES,
  legacyResultToRepositoryResult,
  repositoryFailure,
  repositoryOk
} from '../repositories/repositoryResult.js';
import {
  CommitImportBatch,
  IMPORT_TYPES,
  PrepareImportBatch
} from './importBatchUseCases.js';

export const SPREADSHEET_IMPORT_KINDS = Object.freeze({
  EXPENSES: 'expenses',
  INCOMES: 'incomes'
});

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function getCurrentUser(target = globalThis) {
  return target.authSdk?.getCurrentUser?.() || null;
}

function buildImportContext(target = globalThis, input = {}) {
  const user = getCurrentUser(target);
  return {
    actorUid: input.actorUid || user?.uid || '',
    ownerUid: input.ownerUid || user?.uid || '',
    actorRole: target.financeApp?.authContext?.role || target.currentUserProfile?.role || 'user',
    actorStatus: target.financeApp?.authContext?.accountStatus || target.currentUserProfile?.status || 'active',
    correlationId: input.correlationId || `import-${Date.now()}`
  };
}

function getScopedRecords(target = globalThis, context = {}) {
  const records = Array.isArray(target.allRecords) ? target.allRecords : [];
  const owner = context.ownerUid || context.actorUid || '';
  if (!owner) return records;
  const hasOwnedRecords = records.some((record) => String(record?.owner_uid || '').trim());
  if (!hasOwnedRecords) return records;
  return records.filter((record) => !record.owner_uid || record.owner_uid === owner || record.shared_scope === 'global');
}

export function getImportPipelineRepositories(target = globalThis) {
  const dependencies = target.financeApp?.applicationDependencies;
  const localFinanceRecords = {
    async createMany(records = [], context = {}) {
      if (!target.dataSdk?.createMany) {
        return repositoryFailure({
          code: REPOSITORY_ERROR_CODES.UNAVAILABLE,
          message: 'dataSdk.createMany nao configurado para importacao.'
        });
      }
      return legacyResultToRepositoryResult(await target.dataSdk.createMany(records), records);
    },
    async list(query = {}, context = {}) {
      const records = getScopedRecords(target, context)
        .filter((record) => !query.type || record.type === query.type)
        .filter((record) => !query.sourceChannel || record.source_channel === query.sourceChannel)
        .filter((record) => !query.sourceReferenceId || record.source_reference_id === query.sourceReferenceId);
      return repositoryOk({ items: clone(records), data: clone(records), count: records.length });
    }
  };
  const usePersistentRepositories = target.__financeFirestoreDb && !target.__regressionRecords && !target.__smokeRecords;
  return {
    financeRecords: usePersistentRepositories && dependencies?.repositories?.financeRecords
      ? dependencies.repositories.financeRecords
      : localFinanceRecords,
    idempotency: usePersistentRepositories && dependencies?.repositories?.idempotency
      ? dependencies.repositories.idempotency
      : (target.__financeImportIdempotencyRepository ||= new InMemoryIdempotencyRepository()),
    audit: dependencies?.repositories?.audit || { append: async () => repositoryOk() }
  };
}

export async function parseSpreadsheetImportLazy(workbookOrRows, options = {}) {
  const { parseSpreadsheetImport } = await import('./spreadsheetImportParser.js');
  return parseSpreadsheetImport(workbookOrRows, options);
}

export async function prepareSpreadsheetImport(input = {}, target = globalThis) {
  const context = buildImportContext(target, input.context || {});
  const repositories = input.repositories || getImportPipelineRepositories(target);
  const parsed = input.parsed || await parseSpreadsheetImportLazy(input.workbookOrRows, {
    kind: input.kind || SPREADSHEET_IMPORT_KINDS.EXPENSES,
    sheetName: input.sheetName,
    sheetToJson: input.sheetToJson
  });
  if (!parsed.ok && !parsed.rows.length) {
    return {
      success: false,
      parsed,
      prepared: null,
      context,
      repositories,
      message: parsed.errors?.[0]?.message || 'Planilha invalida para importacao.'
    };
  }
  const prepared = await PrepareImportBatch({
    rows: parsed.rows,
    importType: IMPORT_TYPES.SPREADSHEET,
    originalFilename: input.originalFilename || '',
    fileContent: input.fileContent ?? parsed.rows,
    context,
    repositories,
    mapRowToPayload: (row) => row
  });
  return {
    success: prepared.success,
    parsed,
    prepared: prepared.data,
    result: prepared,
    context,
    repositories,
    message: prepared.message
  };
}

export async function commitPreparedImport(input = {}, target = globalThis) {
  const context = input.context || buildImportContext(target, {});
  const repositories = input.repositories || getImportPipelineRepositories(target);
  return CommitImportBatch({
    preparedBatch: input.preparedBatch || input.prepared,
    selectedCandidateIds: input.selectedCandidateIds || null,
    context,
    repositories
  });
}

export function installImportPipelineGlobals(target = globalThis) {
  const api = {
    IMPORT_TYPES,
    SPREADSHEET_IMPORT_KINDS,
    parseSpreadsheetImport: parseSpreadsheetImportLazy,
    PrepareImportBatch,
    CommitImportBatch,
    getImportPipelineRepositories: () => getImportPipelineRepositories(target),
    prepareSpreadsheetImport: (input) => prepareSpreadsheetImport(input, target),
    commitPreparedImport: (input) => commitPreparedImport(input, target)
  };
  target.financeApp = {
    ...(target.financeApp || {}),
    importPipeline: api
  };
  return api;
}
