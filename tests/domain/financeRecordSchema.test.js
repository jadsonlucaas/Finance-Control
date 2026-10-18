import { describe, expect, it } from 'vitest';
import {
  FINANCE_RECORD_TYPES,
  getFinanceRecordSchema,
  isKnownFinanceRecordType,
  validateFinanceRecordShape
} from '../../src/domain/schemas/financeRecordSchema.js';

describe('finance record schema contracts', () => {
  it('declares the core record types used by the app', () => {
    expect(FINANCE_RECORD_TYPES).toMatchObject({
      SAIDA: 'saida',
      ENTRADA: 'entrada',
      PESSOA: 'pessoa',
      CATEGORIA: 'categoria',
      MACRO: 'macro',
      CONTROLE_HORAS: 'controle_horas',
      SALARIO_HISTORICO: 'salario_historico',
      PERCENTAGE_RULE: 'percentage_rule'
    });
    expect(isKnownFinanceRecordType('saida')).toBe(true);
    expect(isKnownFinanceRecordType('percentage_rule')).toBe(true);
  });

  it('returns field contracts for known record types', () => {
    expect(getFinanceRecordSchema('saida')?.fields.amount).toMatchObject({ kind: 'moneyNonNegative' });
    expect(getFinanceRecordSchema('saida')?.fields.status).toMatchObject({ kind: 'enum' });
    expect(getFinanceRecordSchema('saida')?.fields.competence).toMatchObject({ kind: 'competence' });
    expect(getFinanceRecordSchema('saida')?.fields.archived).toMatchObject({ kind: 'boolean' });
    expect(getFinanceRecordSchema('controle_horas')?.fields.hour_control_type).toMatchObject({ kind: 'enum' });
    expect(getFinanceRecordSchema('controle_horas')?.fields.quantidadeHoras).toMatchObject({ kind: 'numberNonNegative' });
    expect(getFinanceRecordSchema('percentage_rule')?.fields.percentage).toMatchObject({ kind: 'percentageLimit' });
    expect(getFinanceRecordSchema('percentage_rule')?.fields.active).toMatchObject({ kind: 'boolean' });
    expect(getFinanceRecordSchema('percentage_rule')?.fields.startCompetence).toMatchObject({ kind: 'competence' });
  });

  it('validates required fields without blocking unknown legacy types', () => {
    expect(validateFinanceRecordShape({ type: 'macro', macro_category: '' })).toMatchObject({
      isValid: false,
      isKnownType: true
    });
    expect(validateFinanceRecordShape({ type: 'legacy_aux', any: 'field' })).toMatchObject({
      isValid: false,
      isKnownType: false
    });
  });
});
