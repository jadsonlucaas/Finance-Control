import { describe, expect, it } from 'vitest';
import {
  LEGACY_UNVERIFIED_TAX_PARAMETERS,
  validateTaxParameter,
  validateTaxParameterTimeline
} from '../../src/domain/taxParameters.js';
import { InMemoryTaxParameterRepository } from '../../src/domain/taxParameterRepository.js';

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

describe('tax parameter versions', () => {
  it('validates the legacy unverified baseline as migration seed data', () => {
    const result = validateTaxParameterTimeline(LEGACY_UNVERIFIED_TAX_PARAMETERS);

    expect(result.isValid).toBe(true);
    expect(result.total).toBe(2);
  });

  it('rejects active versions without source name', () => {
    const [inss] = clone(LEGACY_UNVERIFIED_TAX_PARAMETERS);
    const result = validateTaxParameter({ ...inss, source_name: '' });

    expect(result.isValid).toBe(false);
    expect(result.errors.map((item) => item.code)).toContain('SOURCE_REQUIRED_FOR_ACTIVE');
  });

  it('rejects overlapping active timelines for the same tax type', () => {
    const [inss] = clone(LEGACY_UNVERIFIED_TAX_PARAMETERS);
    const next = {
      ...inss,
      id: 'overlap',
      version: 'overlap',
      valid_from: '2026-06'
    };

    const result = validateTaxParameterTimeline([inss, next], 'inss');

    expect(result.isValid).toBe(false);
    expect(result.errors.map((item) => item.code)).toContain('TIMELINE_OVERLAP');
  });

  it('selects the latest active non-overlapping version by competence', () => {
    const [inss, irrf] = clone(LEGACY_UNVERIFIED_TAX_PARAMETERS);
    const previous = {
      ...inss,
      id: 'old-inss',
      version: 'old-inss',
      valid_from: '2025-01',
      valid_to: '2025-12'
    };
    const repository = new InMemoryTaxParameterRepository([previous, inss, irrf]);

    expect(repository.findEffective('inss', '2025-06').parameter.version).toBe('old-inss');
    expect(repository.findEffective('inss', '2026-07').parameter.version).toBe('legacy-unverified-inss-app-baseline');
  });

  it('does not activate a draft that would overlap an active version', () => {
    const [inss, irrf] = clone(LEGACY_UNVERIFIED_TAX_PARAMETERS);
    const repository = new InMemoryTaxParameterRepository([inss, irrf]);
    repository.createDraft({
      ...inss,
      id: 'draft-overlap',
      version: 'draft-overlap',
      valid_from: '2026-02',
      source_name: 'baseline legado sem fonte'
    });

    expect(() => repository.activateVersion('draft-overlap')).toThrow(/Timeline tributaria invalida/);
  });
});
