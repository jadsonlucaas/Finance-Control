import { describe, expect, it, vi } from 'vitest';
import { FinanceRepository } from '../../src/domain/FinanceRepository.js';

describe('FinanceRepository', () => {
  it('normalizes records before persisting through the provider', async () => {
    const provider = {
      create: vi.fn(async () => ({ isOk: true, id: 'created_1' })),
      update: vi.fn(async () => ({ isOk: true })),
      upsert: vi.fn(async () => ({ isOk: true, id: 'saida_1' })),
      delete: vi.fn(async () => ({ isOk: true }))
    };

    FinanceRepository.setDataProvider(provider);
    FinanceRepository.setTarget({});

    await FinanceRepository.create({ type: 'saida', amount: '12.34', archived: 'false' });
    await FinanceRepository.update({ id: 'r1', type: 'saida', amount: '10', installment_no: '2' });
    await FinanceRepository.upsert({ id: 'r2', type: 'pessoa', person: 'Jadson', salary_base: '5300' });

    expect(provider.create).toHaveBeenCalledWith(expect.objectContaining({
      type: 'saida',
      amount: 12.34,
      archived: false
    }));
    expect(provider.update).toHaveBeenCalledWith(expect.objectContaining({
      id: 'r1',
      amount: 10,
      installment_no: 2
    }));
    expect(provider.upsert).toHaveBeenCalledWith(expect.objectContaining({
      id: 'r2',
      type: 'pessoa',
      salary_base: 5300
    }));
  });

  it('logs writes through repository audit when provider does not handle audit', async () => {
    const provider = {
      create: vi.fn(async () => ({ isOk: true, id: 'saida_1' })),
      update: vi.fn(async () => ({ isOk: true })),
      upsert: vi.fn(async () => ({ isOk: true, id: 'r1' })),
      delete: vi.fn(async () => ({ isOk: true }))
    };
    const auditSdk = { logLater: vi.fn() };

    FinanceRepository.setDataProvider(provider);
    FinanceRepository.setTarget({ auditSdk });

    await FinanceRepository.create({ type: 'saida', amount: 123, person: 'Jadson' });
    await FinanceRepository.delete({ id: 'saida_1', type: 'saida', amount: 123, person: 'Jadson' });

    expect(auditSdk.logLater).toHaveBeenCalledWith('finance_record.create', expect.objectContaining({
      operation: 'create',
      source: 'FinanceRepository',
      person: 'Jadson'
    }));
    expect(auditSdk.logLater).toHaveBeenCalledWith('finance_record.delete', expect.objectContaining({
      operation: 'delete',
      source: 'FinanceRepository',
      record_id: 'saida_1'
    }));
  });

  it('exposes a legacy sdk proxy backed by the repository', async () => {
    const provider = {
      init: vi.fn(async () => ({ isOk: true })),
      create: vi.fn(async () => ({ isOk: true, id: 'created_2' })),
      update: vi.fn(async () => ({ isOk: true })),
      upsert: vi.fn(async () => ({ isOk: true, id: 'r9' })),
      delete: vi.fn(async () => ({ isOk: true })),
      list: vi.fn(() => [{ id: 'x1' }])
    };

    FinanceRepository.setDataProvider(provider);
    FinanceRepository.setTarget({});
    const proxy = FinanceRepository.createLegacySdkProxy({});

    await proxy.init();
    await proxy.create({ type: 'saida', amount: '50' });
    await proxy.update({ id: 'r9', type: 'saida', amount: '51' });
    await proxy.upsert({ id: 'r9', type: 'saida', amount: '52' });
    await proxy.delete({ id: 'r9', type: 'saida' });

    expect(provider.init).toHaveBeenCalled();
    expect(provider.create).toHaveBeenCalledWith(expect.objectContaining({ amount: 50 }));
    expect(provider.update).toHaveBeenCalledWith(expect.objectContaining({ amount: 51 }));
    expect(provider.upsert).toHaveBeenCalledWith(expect.objectContaining({ amount: 52 }));
    expect(provider.delete).toHaveBeenCalledWith(expect.objectContaining({ id: 'r9' }));
    expect(proxy.list()).toEqual([{ id: 'x1' }]);
  });
});
