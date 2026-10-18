import { describe, expect, it, vi } from 'vitest';
import { createFirebaseDataProvider } from '../../../../src/services/data/providers/firebaseDataProvider.js';

describe('firebase data provider', () => {
  it('adapts the data SDK to the repository provider contract', async () => {
    const sdk = {
      init: vi.fn(async () => ({ isOk: true })),
      create: vi.fn(async (record) => ({ isOk: true, id: record.id })),
      update: vi.fn(async () => ({ isOk: true })),
      upsert: vi.fn(async (record) => ({ isOk: true, id: record.id })),
      delete: vi.fn(async () => ({ isOk: true }))
    };
    const provider = createFirebaseDataProvider(sdk);
    const record = { id: 'r1', type: 'saida' };

    await provider.init({ onDataChanged: vi.fn() });
    await provider.create(record);
    await provider.update(record);
    await provider.upsert(record);
    await provider.delete(record);

    expect(sdk.init).toHaveBeenCalled();
    expect(sdk.create).toHaveBeenCalledWith(record);
    expect(sdk.update).toHaveBeenCalledWith(record);
    expect(sdk.upsert).toHaveBeenCalledWith(record);
    expect(sdk.delete).toHaveBeenCalledWith(record);
  });

  it('fails fast when the SDK does not expose required write methods', () => {
    expect(() => createFirebaseDataProvider({ create: vi.fn() })).toThrow(/update/);
  });
});
