import { afterEach, describe, expect, it, vi } from 'vitest';
import { addDaysToIsoDate, currentCompetenceKey, isoDateInTimeZone, todayIsoDate } from '../../src/core/dates.js';

afterEach(() => { vi.useRealTimers(); delete globalThis.financeApp; });

describe('datas no fuso do usuario', () => {
  it('"hoje" respeita o fuso, nao o UTC', () => {
    // 14/11 21:30 em Manaus = 15/11 01:30 UTC = 15/11 02:30 em Madri.
    const instant = new Date('2026-11-15T01:30:00Z');
    expect(isoDateInTimeZone(instant, 'America/Manaus')).toBe('2026-11-14');
    expect(isoDateInTimeZone(instant, 'Europe/Madrid')).toBe('2026-11-15');
    // 31/12 23:30 em Madri = 31/12 22:30 UTC: ainda dezembro.
    expect(isoDateInTimeZone(new Date('2026-12-31T22:30:00Z'), 'Europe/Madrid')).toBe('2026-12-31');
    expect(isoDateInTimeZone(instant, 'Fuso/Invalido')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('usa o fuso salvo nas preferencias da conta', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-12-01T01:00:00Z'));
    globalThis.financeApp = { userPreferences: { time_zone: 'America/Manaus' } };
    expect(todayIsoDate()).toBe('2026-11-30');
    expect(currentCompetenceKey()).toBe('2026-11');
    globalThis.financeApp.userPreferences.time_zone = 'Europe/Madrid';
    expect(currentCompetenceKey()).toBe('2026-12');
  });

  it('soma dias no calendario sem depender do fuso', () => {
    expect(addDaysToIsoDate('2026-03-28', 1)).toBe('2026-03-29');
    expect(addDaysToIsoDate('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDaysToIsoDate('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDaysToIsoDate('', 1)).toBe('');
  });
});
