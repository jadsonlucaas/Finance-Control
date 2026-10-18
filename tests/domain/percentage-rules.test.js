import { describe, expect, it } from 'vitest';
import {
  getPercentageBaseValue,
  getPercentageCycleBaseValue,
  buildPercentageOccurrenceEntityId,
  buildPercentageOccurrenceKey,
  CalculatePercentageRuleOccurrence,
  getPercentageRuleAmount,
  getPercentageRuleBaseValue,
  isReserveOrInvestmentPercentageRule,
  normalizePercentageRuleRate
} from '../../src/domain/percentage-rules.js';

const consolidated = {
  baseTotal: 6000,
  baseTrabalho: 5350,
  salaryBase: 5000,
  salarioBase: 4900,
  hourExtra: 300,
  dsrHoraExtra: 50,
  outrosProventos: 200,
  inss: 600,
  irrf: 300,
  outrosDescontos: 250,
  liquido: 4200,
  liquidoFinal: 4100,
  adiantamentoQuinzena: 1800
};

describe('percentage rule calculations', () => {
  it('selects base values by configured base', () => {
    expect(getPercentageBaseValue(consolidated, 'base_total')).toBe(5350);
    expect(getPercentageBaseValue(consolidated, 'bruta')).toBe(5350);
    expect(getPercentageBaseValue(consolidated, 'salario')).toBe(5000);
    expect(getPercentageBaseValue(consolidated, 'extra')).toBe(350);
    expect(getPercentageBaseValue(consolidated, 'liquido')).toBe(4200);
  });

  it('uses quinzena base for liquid cycle and suppresses extra in quinzena', () => {
    expect(getPercentageCycleBaseValue(consolidated, 'liquido', 'QUINZENA')).toBe(1800);
    expect(getPercentageCycleBaseValue(consolidated, 'extra', 'QUINZENA')).toBe(0);
    expect(getPercentageCycleBaseValue(consolidated, 'extra', 'INICIO_MES')).toBe(350);
  });

  it('detects reserve and investment rules', () => {
    expect(isReserveOrInvestmentPercentageRule({ macro: 'RESERVA' })).toBe(true);
    expect(isReserveOrInvestmentPercentageRule({ category: 'Investimentos' })).toBe(true);
    expect(isReserveOrInvestmentPercentageRule({ name: 'Mercado' })).toBe(false);
  });

  it('calculates rule base and amount', () => {
    expect(getPercentageRuleBaseValue(consolidated, {
      macro: 'RESERVA',
      percentage: 10,
      cycle: 'QUINZENA'
    })).toBe(1800);

    expect(getPercentageRuleAmount(consolidated, {
      macro: 'RESERVA',
      percentage: 10,
      cycle: 'QUINZENA'
    })).toBe(180);

    expect(getPercentageRuleAmount(consolidated, {
      base: 'extra',
      percentage: 12.5,
      cycle: 'INICIO_MES'
    })).toBe(43.75);
  });

  it('normalizes canonical percentage rates and rejects ambiguous values', () => {
    expect(normalizePercentageRuleRate(10)).toMatchObject({ isValid: true, normalizedRate: 10, rateBasisPoints: 1000 });
    expect(normalizePercentageRuleRate('12,5')).toMatchObject({ isValid: true, normalizedRate: 12.5, rateBasisPoints: 1250 });
    expect(normalizePercentageRuleRate(0.10).errors[0]).toMatchObject({ code: 'AMBIGUOUS_PERCENTAGE_FORMAT' });
    expect(normalizePercentageRuleRate(110).errors[0]).toMatchObject({ code: 'PERCENTAGE_ABOVE_LIMIT' });
  });

  it('builds deterministic occurrence keys and ids scoped by owner, rule, person and competence', () => {
    const base = { ownerUid: 'owner-a', ruleId: 'rule-1', personId: 'person-1', competence: '2026-06' };
    expect(buildPercentageOccurrenceKey(base)).toBe(buildPercentageOccurrenceKey(base));
    expect(buildPercentageOccurrenceKey(base)).not.toBe(buildPercentageOccurrenceKey({ ...base, personId: 'person-2' }));
    expect(buildPercentageOccurrenceKey(base)).not.toBe(buildPercentageOccurrenceKey({ ...base, competence: '2026-07' }));
    expect(buildPercentageOccurrenceKey(base)).not.toBe(buildPercentageOccurrenceKey({ ...base, ruleId: 'rule-2' }));
    expect(buildPercentageOccurrenceKey(base)).not.toBe(buildPercentageOccurrenceKey({ ...base, ownerUid: 'owner-b' }));
    expect(buildPercentageOccurrenceEntityId(base)).toBe(buildPercentageOccurrenceEntityId(base));
    expect(buildPercentageOccurrenceEntityId(base)).toMatch(/^percentage_exit_[a-f0-9]{8}$/);
  });

  it('calculates a pure deterministic occurrence without window or DOM', () => {
    const first = CalculatePercentageRuleOccurrence({
      rule: {
        id: 'rule-1',
        name: 'Reserva',
        percentage: 10,
        base: 'salario',
        macro: 'RESERVA',
        category: 'Investimentos',
        cycle: 'INICIO_MES',
        startCompetence: '2026-01'
      },
      person: { id: 'person-1', person: 'Ana' },
      competence: '2026-06',
      baseContext: consolidated,
      calculationContext: { ownerUid: 'owner-a', source_channel: 'future_integration' }
    });
    const second = CalculatePercentageRuleOccurrence({
      rule: {
        id: 'rule-1',
        name: 'Reserva',
        percentage: 10,
        base: 'salario',
        macro: 'RESERVA',
        category: 'Investimentos',
        cycle: 'INICIO_MES',
        startCompetence: '2026-01'
      },
      person: { id: 'person-1', person: 'Ana' },
      competence: '2026-06',
      baseContext: consolidated,
      calculationContext: { ownerUid: 'owner-a', source_channel: 'web' }
    });

    expect(first).toMatchObject({
      isValid: true,
      baseAmountCents: 500000,
      calculatedAmountCents: 50000,
      amount: 500,
      normalizedRate: 10,
      competence: '2026-06'
    });
    expect(first.calculatedAmountCents).toBe(second.calculatedAmountCents);
    expect(first.occurrenceKey).toBe(second.occurrenceKey);
  });
});
