import { describe, expect, it, vi } from 'vitest';
import { archiveRecord, buildArchiveToggleRecord } from '../../../src/application/records/archiveRecord.js';
import { createRecord } from '../../../src/application/records/createRecord.js';
import { deleteRecord } from '../../../src/application/records/deleteRecord.js';
import { updateRecord } from '../../../src/application/records/updateRecord.js';
import { upsertRecord } from '../../../src/application/records/upsertRecord.js';

describe('record use cases', () => {
  it('write through the injected repository without knowing the backing provider', async () => {
    const repository = {
      create: vi.fn(async () => ({ isOk: true, id: 'created' })),
      update: vi.fn(async () => ({ isOk: true })),
      upsert: vi.fn(async () => ({ isOk: true, id: 'r1' })),
      delete: vi.fn(async () => ({ isOk: true }))
    };
    const record = { id: 'r1', type: 'saida', amount: 100 };

    await createRecord(record, { repository });
    await updateRecord(record, { repository });
    await upsertRecord(record, { repository });
    await deleteRecord(record, { repository });

    expect(repository.create).toHaveBeenCalledWith(record);
    expect(repository.update).toHaveBeenCalledWith(record);
    expect(repository.upsert).toHaveBeenCalledWith(record);
    expect(repository.delete).toHaveBeenCalledWith(record);
  });

  it('builds and persists archive toggles through the update use case', async () => {
    const now = new Date('2026-04-18T10:00:00.000Z');
    const repository = {
      update: vi.fn(async () => ({ isOk: true }))
    };

    const archived = buildArchiveToggleRecord({ id: 'r1', archived: false }, { now });
    await archiveRecord({ id: 'r1', archived: false }, { repository, now });

    expect(archived).toEqual({ id: 'r1', archived: true, archived_at: '2026-04-18T10:00:00.000Z' });
    expect(repository.update).toHaveBeenCalledWith(archived);
  });
});
