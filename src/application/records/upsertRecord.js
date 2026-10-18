import { resolveRecordRepository } from './repositoryAdapter.js';

export async function upsertRecord(record, options = {}) {
  return resolveRecordRepository(options).upsert(record);
}
