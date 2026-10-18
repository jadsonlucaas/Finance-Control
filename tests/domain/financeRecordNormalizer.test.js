import { describe, expect, it } from 'vitest';
import {
  normalizeFinanceRecord,
  normalizeFinanceRecords
} from '../../src/domain/normalizers/financeRecordNormalizer.js';

describe('finance record normalizer', () => {
  it('normalizes saida values while preserving custom fields', () => {
    expect(normalizeFinanceRecord({
      type: 'saida',
      amount: '123.45',
      status: 'Em aberto',
      paid_at: '2026-04-17',
      archived: 'false',
      installment_no: '2',
      total_installments: '5',
      custom_flag: 'keep'
    })).toMatchObject({
      type: 'saida',
      amount: 123.45,
      status: 'Em aberto',
      paid_at: '',
      archived: false,
      installment_no: 2,
      total_installments: 5,
      custom_flag: 'keep'
    });
  });

  it('normalizes known configuration and hour records', () => {
    expect(normalizeFinanceRecord({
      type: 'pessoa',
      person: 'Jadson',
      salary_base: '4400.50'
    })).toMatchObject({
      type: 'pessoa',
      person: 'Jadson',
      salary_base: 4400.5,
      amount: 0
    });

    expect(normalizeFinanceRecord({
      type: 'controle_horas',
      quantidadeHoras: '2.5',
      archived: ''
    })).toMatchObject({
      type: 'controle_horas',
      quantidadeHoras: 2.5,
      amount: 0,
      archived: false
    });

    expect(normalizeFinanceRecord({
      type: 'percentage_rule',
      percentage: '12.5',
      active: 'false',
      startCompetence: 202604
    })).toMatchObject({
      type: 'percentage_rule',
      percentage: 12.5,
      active: false,
      startCompetence: '202604'
    });
  });

  it('preserves unknown legacy records and normalizes arrays defensively', () => {
    const legacy = { type: 'custom_legacy_rule', amount: '9', nested: { keep: true } };
    expect(normalizeFinanceRecord(legacy)).toEqual(legacy);
    expect(normalizeFinanceRecords([legacy, { type: 'macro', macro_category: 'FIXO', amount: '1' }])).toEqual([
      legacy,
      expect.objectContaining({ type: 'macro', macro_category: 'FIXO', amount: 1 })
    ]);
    expect(normalizeFinanceRecords(null)).toEqual([]);
  });

  it('can run strict validation for required fields', () => {
    expect(() => normalizeFinanceRecord({ type: 'macro', macro_category: '' }, { strict: true })).toThrow('Campo macro_category');
  });
});
