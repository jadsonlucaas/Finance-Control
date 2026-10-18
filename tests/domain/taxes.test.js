import { describe, expect, it } from 'vitest';
import {
  CalculateINSS,
  CalculateIRRF,
  CalculateNetIncome,
  calcularINSS,
  calcularIRRF,
  calcularLiquido,
  resolveTaxParametersByCompetence
} from '../../src/domain/taxes.js';
import { dryRunTaxHistory } from '../../src/domain/taxHistoryDryRun.js';

describe('tax calculations', () => {
  it('calculates progressive INSS according to current table in the app', () => {
    expect(calcularINSS(0)).toBe(0);
    expect(calcularINSS(1621)).toBe(121.58);
    expect(calcularINSS(3000)).toBe(248.61);
    expect(calcularINSS(10000)).toBe(988.1);
  });

  it('calculates IRRF with simplified discount rules used by the app', () => {
    expect(calcularIRRF(4000, 360)).toBe(0);
    expect(calcularIRRF(6000, 600)).toBe(396.52);
  });

  it('calculates net income', () => {
    expect(calcularLiquido({
      salarioBase: 5000,
      horaExtra: 300,
      outrosProventos: 200,
      inss: 550,
      irrf: 120.5,
      outrosDescontos: 80
    })).toBe(4749.5);
  });

  it('selects versioned legacy parameters by competence without official-source claims', () => {
    const resolved = resolveTaxParametersByCompetence({ competence: '2026-07' });

    expect(resolved.isValid).toBe(true);
    expect(resolved.inss.version).toBe('legacy-unverified-inss-app-baseline');
    expect(resolved.irrf.source_name).toBe('baseline legado sem fonte');
  });

  it('returns structured INSS calculation with version and auditable breakdown', () => {
    const result = CalculateINSS({
      competence: '2026-07',
      grossIncomeCents: 903810
    });

    expect(result).toMatchObject({
      isValid: true,
      taxType: 'inss',
      competence: '2026-07',
      parameterVersion: 'legacy-unverified-inss-app-baseline',
      taxableIncomeCents: 847555,
      amountCents: 98810,
      amount: 988.1
    });
    expect(result.breakdown.reduce((sum, item) => sum + item.amountCents, 0)).toBe(98810);
  });

  it('returns structured IRRF calculation with legacy reduction isolated in the breakdown', () => {
    const result = CalculateIRRF({
      competence: '2026-07',
      grossIncomeCents: 600000,
      inssCents: 60000
    });

    expect(result).toMatchObject({
      isValid: true,
      taxType: 'irrf',
      parameterVersion: 'legacy-unverified-irrf-app-baseline',
      taxableIncomeCents: 540000,
      traditionalCents: 57627,
      reductionCents: 17975,
      amountCents: 39652,
      amount: 396.52
    });
    expect(result.breakdown.at(-1)).toMatchObject({
      code: 'IRRF_FINAL',
      amountCents: 39652
    });
  });

  it('requires explicit competence outside legacy compatibility wrappers', () => {
    const result = CalculateINSS({ grossIncomeCents: 300000 });

    expect(result.isValid).toBe(false);
    expect(result.errors[0].code).toBe('COMPETENCE_REQUIRED');
  });

  it('calculates net income through the versioned engine when taxes are not supplied', () => {
    const result = CalculateNetIncome({
      competence: '2026-07',
      grossIncomeCents: 600000,
      otherDiscountsCents: 5000
    });

    expect(result.isValid).toBe(true);
    expect(result.inssVersion).toBe('legacy-unverified-inss-app-baseline');
    expect(result.irrfVersion).toBe('legacy-unverified-irrf-app-baseline');
    expect(result.netIncomeCents).toBe(492338);
  });

  it('dry-runs historical reconciliation without mutating source entries', () => {
    const entries = [{
      id: 'entrada-1',
      person: 'Ana',
      competence: '2026-07',
      salaryBase: 6000,
      hourExtra: 0,
      dsrProventos: 0,
      inss: 600,
      irrf: 316.63
    }];

    const result = dryRunTaxHistory(entries);

    expect(result[0]).toMatchObject({
      id: 'entrada-1',
      calculatedInssCents: 64152,
      inssDifferenceCents: 4152,
      calculatedIrrfCents: 38510,
      irrfDifferenceCents: 6847,
      inssParameterVersion: 'legacy-unverified-inss-app-baseline',
      irrfParameterVersion: 'legacy-unverified-irrf-app-baseline'
    });
    expect(entries[0].inss).toBe(600);
  });
});
