import { describe, expect, it, vi } from 'vitest';
import { createMockDataProvider } from '../../../../src/services/data/providers/mockDataProvider.js';

describe('mock data provider', () => {
  it('stores records in memory using the same write contract', async () => {
    const provider = createMockDataProvider([{ id: 'existing', type: 'entrada', amount: 10 }]);
    const dataHandler = { onDataChanged: vi.fn() };

    await provider.init(dataHandler);
    const created = await provider.create({ type: 'saida', amount: 20 });
    await provider.update({ id: created.id, type: 'saida', amount: 25 });
    await provider.upsert({ id: 'custom', type: 'pessoa', person: 'Luana' });
    await provider.delete({ id: 'existing' });

    expect(dataHandler.onDataChanged).toHaveBeenCalledWith([{ id: 'existing', type: 'entrada', amount: 10 }]);
    expect(provider.list()).toEqual([
      { type: 'saida', amount: 25, id: created.id },
      { id: 'custom', type: 'pessoa', person: 'Luana' }
    ]);
  });
});
