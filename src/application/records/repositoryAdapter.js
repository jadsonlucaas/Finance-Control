import { FinanceRepository } from '../../domain/FinanceRepository.js';

export function resolveRecordRepository(options = {}) {
  const target = options.target || globalThis;
  return options.repository
    || target?.financeRepository
    || target?.financeApp?.FinanceRepository
    || target?.dataSdk
    || FinanceRepository;
}
