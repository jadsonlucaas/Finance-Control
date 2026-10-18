import { describe, expect, it } from 'vitest';
import {
  analyzeRecurrenceSeries,
  buildRecurrenceDates,
  createRecurrenceSeries,
  getRecurrenceMutationScopeOptions
} from '../../src/domain/recurrenceSeries.js';

const fixedNow = new Date('2026-07-18T12:00:00.000Z');

function baseInput(overrides = {}) {
  return {
    person: 'Jadson',
    macro: 'FIXO',
    subcategory: 'Assinatura',
    description: 'Servico',
    amount: 100,
    status: 'Pago',
    paidAt: '2026-01-31',
    firstDueDate: '2026-01-31',
    frequency: 'monthly',
    recurrence_count: 3,
    cycle: 'INICIO_MES',
    source_channel: 'web',
    now: fixedNow,
    ...overrides
  };
}

describe('CreateRecurrenceSeries', () => {
  it('creates monthly recurrence by count with series metadata', () => {
    const series = createRecurrenceSeries(baseInput(), { idFactory: () => 'r_fixed' });

    expect(series).toMatchObject({
      isValid: true,
      seriesId: 'r_fixed',
      frequency: 'monthly',
      totalOccurrences: 3,
      firstDate: '2026-01-31',
      lastDate: '2026-03-31'
    });
    expect(series.occurrences.map((item) => item.due_date)).toEqual(['2026-01-31', '2026-02-28', '2026-03-31']);
    expect(series.occurrences.map((item) => item.recurrence_sequence_no)).toEqual([1, 2, 3]);
    expect(series.occurrences.every((item) => item.recurrence_series_id === 'r_fixed')).toBe(true);
    expect(series.occurrences.every((item) => item.parent_id === '')).toBe(true);
    expect(series.occurrences[0]).toMatchObject({ status: 'Pago', paid_at: '2026-01-31', recurrence: 'mensal' });
    expect(series.occurrences[1]).toMatchObject({ status: 'Em aberto', paid_at: '' });
  });

  it('creates yearly recurrence by count without assuming twelve years', () => {
    const series = createRecurrenceSeries(baseInput({
      frequency: 'yearly',
      recurrence_count: 2,
      firstDueDate: '2026-04-05'
    }));

    expect(series.isValid).toBe(true);
    expect(series.occurrences.map((item) => item.due_date)).toEqual(['2026-04-05', '2027-04-05']);
    expect(series.occurrences).toHaveLength(2);
    expect(series.occurrences.every((item) => item.recurrence === 'anual')).toBe(true);
  });

  it('creates monthly and yearly recurrence by inclusive end date', () => {
    const monthly = createRecurrenceSeries(baseInput({
      recurrence_count: undefined,
      recurrence_end_date: '2026-04-30'
    }));
    const yearly = createRecurrenceSeries(baseInput({
      frequency: 'yearly',
      firstDueDate: '2024-02-29',
      recurrence_count: undefined,
      recurrence_end_date: '2028-02-29'
    }));

    expect(monthly.occurrences.map((item) => item.due_date)).toEqual(['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30']);
    expect(yearly.occurrences.map((item) => item.due_date)).toEqual(['2024-02-29', '2025-02-28', '2026-02-28', '2027-02-28', '2028-02-29']);
  });

  it('rejects missing or duplicated termination criteria and invalid frequency', () => {
    expect(createRecurrenceSeries(baseInput({ recurrence_count: undefined })).errors.map((item) => item.code)).toContain('RECURRENCE_TERMINATION_REQUIRED');
    expect(createRecurrenceSeries(baseInput({ recurrence_end_date: '2026-12-31' })).errors.map((item) => item.code)).toContain('RECURRENCE_TERMINATION_EXCLUSIVE');
    expect(createRecurrenceSeries(baseInput({ frequency: 'weekly' })).errors.map((item) => item.code)).toContain('INVALID_RECURRENCE_FREQUENCY');
  });

  it('enforces safe monthly and yearly limits', () => {
    expect(createRecurrenceSeries(baseInput({ recurrence_count: 121 })).errors.map((item) => item.code)).toContain('RECURRENCE_LIMIT_EXCEEDED');
    expect(createRecurrenceSeries(baseInput({ frequency: 'yearly', recurrence_count: 31 })).errors.map((item) => item.code)).toContain('RECURRENCE_LIMIT_EXCEEDED');
  });

  it('preserves anchor day for 28, 29, 30 and 31 and handles year rollover', () => {
    expect(buildRecurrenceDates({ frequency: 'monthly', firstDate: '2026-01-28', recurrence_count: 3 }).dates).toEqual(['2026-01-28', '2026-02-28', '2026-03-28']);
    expect(buildRecurrenceDates({ frequency: 'monthly', firstDate: '2024-01-29', recurrence_count: 3 }).dates).toEqual(['2024-01-29', '2024-02-29', '2024-03-29']);
    expect(buildRecurrenceDates({ frequency: 'monthly', firstDate: '2026-01-30', recurrence_count: 3 }).dates).toEqual(['2026-01-30', '2026-02-28', '2026-03-30']);
    expect(buildRecurrenceDates({ frequency: 'monthly', firstDate: '2026-12-31', recurrence_count: 3 }).dates).toEqual(['2026-12-31', '2027-01-31', '2027-02-28']);
  });

  it('keeps source_channel from changing recurrence dates', () => {
    const web = createRecurrenceSeries(baseInput({ source_channel: 'web' }));
    const future = createRecurrenceSeries(baseInput({ source_channel: 'future_integration' }));

    expect(future.occurrences.map((item) => item.due_date)).toEqual(web.occurrences.map((item) => item.due_date));
  });

  it('models unsupported edit and delete scopes as disabled', () => {
    expect(getRecurrenceMutationScopeOptions()).toEqual([
      expect.objectContaining({ value: 'only_this', enabled: true }),
      expect.objectContaining({ value: 'this_and_next', enabled: false }),
      expect.objectContaining({ value: 'whole_series', enabled: false })
    ]);
  });
});

describe('recurrence dry-run', () => {
  it('detects yearly twelve-occurrence risk, gaps, duplicates, invalid dates and installment conflict without writes', () => {
    const records = [
      ...Array.from({ length: 12 }, (_, index) => ({
        id: `a-${index + 1}`,
        type: 'saida',
        recurrence_series_id: 'annual-12',
        recurrence_frequency: 'yearly',
        recurrence_sequence_no: index + 1,
        recurrence_total_occurrences: 12,
        due_date: `${2026 + index}-05-10`,
        amount: 10
      })),
      { id: 'gap-1', type: 'saida', recurrence_series_id: 'gap', recurrence_frequency: 'monthly', recurrence_sequence_no: 1, recurrence_total_occurrences: 3, due_date: '2026-01-10' },
      { id: 'gap-3', type: 'saida', recurrence_series_id: 'gap', recurrence_frequency: 'monthly', recurrence_sequence_no: 3, recurrence_total_occurrences: 3, due_date: '2026-03-10' },
      { id: 'dup-1', type: 'saida', recurrence_series_id: 'dup', recurrence_frequency: 'monthly', recurrence_sequence_no: 1, recurrence_total_occurrences: 2, due_date: '2026-04-10' },
      { id: 'dup-2', type: 'saida', recurrence_series_id: 'dup', recurrence_frequency: 'monthly', recurrence_sequence_no: 2, recurrence_total_occurrences: 2, due_date: '2026-04-10' },
      { id: 'bad-date', type: 'saida', recurrence_series_id: 'bad-date', recurrence_frequency: 'monthly', recurrence_sequence_no: 1, recurrence_total_occurrences: 1, due_date: '2026-02-30' },
      { id: 'conflict', type: 'saida', recurrence_series_id: 'conflict', recurrence_frequency: 'monthly', recurrence_sequence_no: 1, recurrence_total_occurrences: 1, due_date: '2026-01-10', parent_id: 'p_1' }
    ];

    const report = analyzeRecurrenceSeries(records);

    expect(report.wrote).toBe(false);
    expect(report.series.find((item) => item.recurrence_series_id === 'annual-12')).toMatchObject({ annualTwelveOccurrences: true, status: 'needs_review' });
    expect(report.series.find((item) => item.recurrence_series_id === 'gap')).toMatchObject({ missingSequenceNumbers: [2] });
    expect(report.series.find((item) => item.recurrence_series_id === 'dup')).toMatchObject({ duplicates: ['2026-04-10'] });
    expect(report.series.find((item) => item.recurrence_series_id === 'bad-date')).toMatchObject({ invalidDates: ['bad-date'] });
    expect(report.series.find((item) => item.recurrence_series_id === 'conflict')).toMatchObject({ conflictsWithInstallment: ['conflict'] });
  });
});
