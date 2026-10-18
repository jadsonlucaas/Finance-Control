import { resolveRecordRepository } from './repositoryAdapter.js';

export async function updateRecord(record, options = {}) {
  return resolveRecordRepository(options).update(record);
}
