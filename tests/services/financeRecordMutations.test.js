import { describe, expect, it, vi } from 'vitest';
import {
  buildArchiveToggleRecord,
  buildPaidToggleRecord,
  installFinanceRecordMutationGlobals
} from '../../src/services/financeRecordMutations.js';

describe('finance record mutations', () => {
  it('builds paid toggle payloads without mutating the original record', () => {
    const original = { id: 'r1', status: 'Em aberto', paid_at: '' };
    const updated = buildPaidToggleRecord(original, { now: new Date('2026-04-17T12:00:00.000Z') });

    expect(updated).toEqual({ id: 'r1', status: 'Pago', paid_at: '2026-04-17' });
    expect(original).toEqual({ id: 'r1', status: 'Em aberto', paid_at: '' });
    expect(buildPaidToggleRecord(updated).status).toBe('Em aberto');
    expect(buildPaidToggleRecord(updated).paid_at).toBe('');
  });

  it('builds archive toggle payloads with archived timestamp only when archiving', () => {
    const now = new Date('2026-04-17T12:30:00.000Z');
    const archived = buildArchiveToggleRecord({ id: 'r1', archived: false }, { now });
    const reopened = buildArchiveToggleRecord(archived, { now });

    expect(archived.archived).toBe(true);
    expect(archived.archived_at).toBe('2026-04-17T12:30:00.000Z');
    expect(reopened.archived).toBe(false);
    expect(reopened.archived_at).toBe('');
  });

  it('installs a global mutation API backed by the current data SDK', async () => {
    const target = {
      dataSdk: {
        create: vi.fn(async (record) => ({ isOk: true, id: record.id || 'created' })),
        update: vi.fn(async () => ({ isOk: true })),
        upsert: vi.fn(async () => ({ isOk: true })),
        delete: vi.fn(async () => ({ isOk: true }))
      }
    };

    const api = installFinanceRecordMutationGlobals(target);
    const record = { id: 'r1', type: 'saida' };

    await api.createRecord(record);
    await api.updateRecord(record);
    await api.upsertRecord(record);
    await api.deleteRecord(record);

    expect(target.financeRecordMutations).toBe(api);
    expect(target.dataSdk.create).toHaveBeenCalledWith(record);
    expect(target.dataSdk.update).toHaveBeenCalledWith(record);
    expect(target.dataSdk.upsert).toHaveBeenCalledWith(record);
    expect(target.dataSdk.delete).toHaveBeenCalledWith(record);
  });
});
