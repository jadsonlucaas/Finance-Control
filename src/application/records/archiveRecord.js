import { updateRecord } from './updateRecord.js';

export function buildArchiveToggleRecord(record = {}, options = {}) {
  const now = options.now instanceof Date ? options.now : new Date();
  const isArchived = Boolean(options.isArchivedRecord
    ? options.isArchivedRecord(record)
    : record.archived);
  return {
    ...record,
    archived: !isArchived,
    archived_at: !isArchived ? now.toISOString() : ''
  };
}

export async function archiveRecord(record, options = {}) {
  return updateRecord(buildArchiveToggleRecord(record, options), options);
}
