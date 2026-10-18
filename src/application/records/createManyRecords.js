import { resolveRecordRepository } from './repositoryAdapter.js';

export async function createManyRecords(records = [], options = {}) {
  return resolveRecordRepository(options).createMany(records);
}
