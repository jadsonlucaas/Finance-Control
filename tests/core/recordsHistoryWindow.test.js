import { describe, expect, it } from 'vitest';
import {
  buildHistoryWindowQueries,
  historyWindowStart,
  isCompetenceLoaded,
  mergeRecordSets,
  nextHistoryStart,
  normalizeHistoryWindowMonths,
  shiftCompetence,
  toCompetence
} from '../../src/core/recordsHistoryWindow.js';

describe('recordsHistoryWindow', () => {
  it('starts the window N-1 months before the current month', () => {
    expect(historyWindowStart('2026-11', 12)).toBe('2025-12');
    expect(historyWindowStart('2026-01', 12)).toBe('2025-02');
    expect(historyWindowStart('2026-03', 1)).toBe('2026-03');
  });

  it('treats 0 months as full history and clamps bad values', () => {
    expect(historyWindowStart('2026-11', 0)).toBe('');
    expect(normalizeHistoryWindowMonths('0')).toBe(0);
    expect(normalizeHistoryWindowMonths('-5')).toBe(0);
    expect(normalizeHistoryWindowMonths('abc')).toBe(12);
    expect(normalizeHistoryWindowMonths(undefined)).toBe(12);
    expect(normalizeHistoryWindowMonths('6')).toBe(6);
  });

  it('shifts competences across years', () => {
    expect(shiftCompetence('2026-01', -1)).toBe('2025-12');
    expect(shiftCompetence('2025-12', 1)).toBe('2026-01');
    expect(shiftCompetence('2026-11', -23)).toBe('2024-12');
  });

  it('accepts only AAAA-MM and AAAA-MM-DD values', () => {
    expect(toCompetence('2024-03-15')).toBe('2024-03');
    expect(toCompetence('2024-03')).toBe('2024-03');
    expect(toCompetence('03/2024')).toBe('');
    expect(toCompetence('')).toBe('');
  });

  it('builds single-field queries that cover recent, open, installments and non-transaction records', () => {
    const queries = buildHistoryWindowQueries('2025-12');
    expect(queries.map((item) => item.key)).toEqual([
      'competence', 'due_date', 'occurred_date', 'open', 'installments', 'non_transactions'
    ]);
    expect(queries.find((item) => item.key === 'competence')).toMatchObject({ field: 'competence', op: '>=', value: '2025-12' });
    expect(queries.find((item) => item.key === 'due_date')).toMatchObject({ field: 'due_date', op: '>=', value: '2025-12-01' });
    expect(queries.find((item) => item.key === 'open').value).toEqual(['Em aberto', 'Vencido', 'Pendente']);
    expect(queries.find((item) => item.key === 'installments')).toMatchObject({ field: 'total_installments', op: '>', value: 1 });
    expect(queries.find((item) => item.key === 'non_transactions')).toMatchObject({ field: 'type', op: 'not-in', value: ['saida', 'entrada'] });
    // Firestore aceita no maximo 10 valores em in/not-in.
    queries.filter((item) => Array.isArray(item.value)).forEach((item) => expect(item.value.length).toBeLessThanOrEqual(10));
  });

  it('falls back to the whole collection without a start', () => {
    expect(buildHistoryWindowQueries('')).toEqual([{ key: 'all' }]);
  });

  it('merges query results without duplicating documents', () => {
    const merged = mergeRecordSets([
      [{ id: 'a', amount: 1 }, { id: 'b', amount: 2 }],
      [{ id: 'b', amount: 2 }, { id: 'c', amount: 3 }],
      null
    ]);
    expect(merged.map((record) => record.id).sort()).toEqual(['a', 'b', 'c']);
  });

  it('only widens the window, never shrinks it', () => {
    const state = { mode: 'window', start: '2025-12' };
    expect(isCompetenceLoaded('2026-02', state)).toBe(true);
    expect(isCompetenceLoaded('2025-06', state)).toBe(false);
    expect(nextHistoryStart('2025-06-10', state)).toBe('2025-06');
    expect(nextHistoryStart('2026-02', state)).toBe('2025-12');
    expect(nextHistoryStart('', state)).toBe('2025-12');
    expect(isCompetenceLoaded('2001-01', { mode: 'full', start: '' })).toBe(true);
  });
});
