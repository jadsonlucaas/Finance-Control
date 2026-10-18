import { resolveRecordRepository } from './repositoryAdapter.js';

export async function deleteRecord(record, options = {}) {
  return resolveRecordRepository(options).delete(record);
}
