import { resolveRecordRepository } from './repositoryAdapter.js';

export async function createRecord(record, options = {}) {
  return resolveRecordRepository(options).create(record);
}
