import { describe, expect, it } from 'vitest';
import { normalizeCompetenceKey } from '../../src/core/dates.js';

describe('date helpers', () => {
  it('normalizes month competence values', () => {
    expect(normalizeCompetenceKey('2026-04')).toBe('2026-04');
    expect(normalizeCompetenceKey('2026-04-13')).toBe('2026-04');
    expect(normalizeCompetenceKey(' 2026-04 ')).toBe('2026-04');
  });

  it('rejects unsupported competence formats', () => {
    expect(normalizeCompetenceKey('13/04/2026')).toBe('');
    expect(normalizeCompetenceKey('2026-4')).toBe('');
    expect(normalizeCompetenceKey('')).toBe('');
  });
});
