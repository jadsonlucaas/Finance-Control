import { buildArchiveToggleRecord, archiveRecord } from '../application/records/archiveRecord.js';
import { createManyRecords as createManyRecordsUseCase } from '../application/records/createManyRecords.js';
import { createRecord as createRecordUseCase } from '../application/records/createRecord.js';
import { deleteRecord as deleteRecordUseCase } from '../application/records/deleteRecord.js';
import { updateRecord as updateRecordUseCase } from '../application/records/updateRecord.js';
import { upsertRecord as upsertRecordUseCase } from '../application/records/upsertRecord.js';
import { resolveRecordRepository } from '../application/records/repositoryAdapter.js';

export { buildArchiveToggleRecord };

function getMutationSdk(target = globalThis) {
  const repository = resolveRecordRepository({ target });
  if (!repository) throw new Error('Data provider is not initialized.');
  return repository;
}

function dateToIsoDate(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

export async function createRecord(record, options = {}) {
  return createRecordUseCase(record, { ...options, repository: getMutationSdk(options.target) });
}

export async function createManyRecords(records, options = {}) {
  return createManyRecordsUseCase(records, { ...options, repository: getMutationSdk(options.target) });
}

export async function updateRecord(record, options = {}) {
  return updateRecordUseCase(record, { ...options, repository: getMutationSdk(options.target) });
}

export async function upsertRecord(record, options = {}) {
  return upsertRecordUseCase(record, { ...options, repository: getMutationSdk(options.target) });
}

export async function deleteRecord(record, options = {}) {
  return deleteRecordUseCase(record, { ...options, repository: getMutationSdk(options.target) });
}

export function buildPaidToggleRecord(record = {}, options = {}) {
  const now = options.now instanceof Date ? options.now : new Date();
  const newStatus = record.status === 'Pago' ? 'Em aberto' : 'Pago';
  return {
    ...record,
    status: newStatus,
    paid_at: newStatus === 'Pago' ? dateToIsoDate(now) : ''
  };
}

export async function togglePaidRecord(record, options = {}) {
  return updateRecord(buildPaidToggleRecord(record, options), options);
}

export async function toggleArchiveRecord(record, options = {}) {
  return archiveRecord(record, { ...options, repository: getMutationSdk(options.target) });
}

export function installFinanceRecordMutationGlobals(target = globalThis) {
  const api = {
      createRecord: (record) => createRecord(record, { target }),
      createManyRecords: (records) => createManyRecords(records, { target }),
    updateRecord: (record) => updateRecord(record, { target }),
    upsertRecord: (record) => upsertRecord(record, { target }),
    deleteRecord: (record) => deleteRecord(record, { target }),
    buildPaidToggleRecord,
    togglePaidRecord: (record) => togglePaidRecord(record, { target }),
    buildArchiveToggleRecord,
    toggleArchiveRecord: (record) => toggleArchiveRecord(record, {
      target,
      isArchivedRecord: target.isArchivedRecord
    })
  };

  target.financeRecordMutations = api;
  return api;
}
