import { describe, expect, it } from 'vitest';
import {
  centsToMoney,
  moneyToCents,
  splitAmountIntoInstallments,
  validateInstallmentSplit
} from '../../src/core/money.js';
import {
  addMonthsClamped,
  analyzeInstallmentSeries,
  buildInstallmentReconciliationDryRun,
  createInstallmentSeries
} from '../../src/domain/installmentSeries.js';

const fixedNow = new Date('2026-07-18T12:00:00.000Z');

function sumAmounts(records) {
  return records.reduce((sum, record) => sum + moneyToCents(record.amount), 0);
}

function makeSeries(input = {}, options = {}) {
  return createInstallmentSeries({
    person: 'Ana',
    macro: 'FIXO',
    subcategory: 'Educacao',
    description: 'Curso',
    paymentMethod: 'Visa',
    totalAmount: 100,
    totalInstallments: 3,
    firstDueDate: '2026-01-31',
    status: 'Pago',
    paidAt: '2026-01-31',
    source_channel: 'web',
    source_reference_id: 'src-1',
    idempotency_key: 'idem-1',
    correlation_id: 'corr-1',
    ...input
  }, {
    now: fixedNow,
    idFactory: () => 'series-fixed',
    ...options
  });
}

describe('installment money model', () => {
  it.each([
    [100, 3, [3333, 3333, 3334]],
    [10, 6, [166, 166, 166, 166, 166, 170]],
    [0.01, 2, [0, 1]],
    [1, 7, [14, 14, 14, 14, 14, 14, 16]],
    [99.99, 10, [999, 999, 999, 999, 999, 999, 999, 999, 999, 1008]],
    [42.5, 1, [4250]],
    [0, 3, [0, 0, 0]]
  ])('splits %s by %s with exact cents', (total, count, expected) => {
    const totalCents = moneyToCents(total);
    const split = splitAmountIntoInstallments(totalCents, count);

    expect(split.installments).toEqual(expected);
    expect(validateInstallmentSplit(split, totalCents)).toMatchObject({
      isValid: true,
      sumCents: totalCents,
      differenceCents: 0
    });
    expect(split.installments.at(-1)).toBe(expected.at(-1));
  });

  it.each([0, -1, 1.5])('rejects invalid installment count %s', (count) => {
    expect(() => splitAmountIntoInstallments(1000, count)).toThrow(/inteiro positivo/);
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY])('rejects non finite money %s', (value) => {
    expect(() => moneyToCents(value)).toThrow(/finito/);
  });

  it('parses explicit BRL strings and rejects ambiguous strings', () => {
    expect(moneyToCents('R$ 1.234,56')).toBe(123456);
    expect(moneyToCents('1234.56')).toBe(123456);
    expect(moneyToCents('1234,56')).toBe(123456);
    expect(() => moneyToCents('1.234')).toThrow(/ambiguo/);
    expect(centsToMoney(123456)).toBe(1234.56);
  });

  it('is deterministic and keeps residue on the last installment by default', () => {
    const a = splitAmountIntoInstallments(10000, 3);
    const b = splitAmountIntoInstallments(10000, 3);
    expect(a).toEqual(b);
    expect(a).toMatchObject({ policy: 'last', residueCents: 1 });
    expect(a.installments).toEqual([3333, 3333, 3334]);
  });
});

describe('installment dates', () => {
  it.each([
    ['2026-01-31', 1, '2026-02-28'],
    ['2026-01-30', 1, '2026-02-28'],
    ['2026-12-31', 1, '2027-01-31'],
    ['2024-01-29', 1, '2024-02-29'],
    ['2026-03-31', 1, '2026-04-30']
  ])('adds months clamping %s + %s', (date, months, expected) => {
    expect(addMonthsClamped(date, months)).toBe(expected);
  });

  it('sets competence from each due date without Date overflow', () => {
    const series = makeSeries({ firstDueDate: '2026-01-31', totalInstallments: 3 });
    expect(series.installments.map((item) => [item.due_date, item.competence])).toEqual([
      ['2026-01-31', '2026-01'],
      ['2026-02-28', '2026-02'],
      ['2026-03-31', '2026-03']
    ]);
  });
});

describe('CreateInstallmentSeries', () => {
  it('creates a pure validated series with consistent metadata', () => {
    const series = makeSeries({ totalAmount: 100, totalInstallments: 3 });

    expect(series).toMatchObject({
      isValid: true,
      seriesId: 'series-fixed',
      totalCents: 10000,
      totalInstallments: 3
    });
    expect(series.installments).toHaveLength(3);
    expect(series.installments.map((item) => item.installment_no)).toEqual([1, 2, 3]);
    expect(series.installments.every((item) => item.total_installments === 3)).toBe(true);
    expect(series.installments.every((item) => item.parent_id === 'series-fixed')).toBe(true);
    expect(series.installments.every((item) => item.schema_version === 1)).toBe(true);
    expect(series.installments.every((item) => item.payment_method === 'Visa')).toBe(true);
    expect(series.installments.every((item) => item.source_channel === 'web')).toBe(true);
    expect(series.installments.every((item) => item.idempotency_key === 'idem-1')).toBe(true);
    expect(series.installments.map((item) => item.amount)).toEqual([33.33, 33.33, 33.34]);
    expect(sumAmounts(series.installments)).toBe(10000);
  });

  it('uses a different parent id per execution and does not persist', () => {
    const first = makeSeries({}, { idFactory: () => 'series-a' });
    const second = makeSeries({}, { idFactory: () => 'series-b' });

    expect(first.seriesId).toBe('series-a');
    expect(second.seriesId).toBe('series-b');
    expect(first.seriesId).not.toBe(second.seriesId);
    expect(globalThis.document).toBeUndefined();
    expect(globalThis.window).toBeUndefined();
  });

  it('rejects the whole series when one required input is invalid', () => {
    const series = makeSeries({ totalAmount: '1.234', firstDueDate: '2026-02-31' });

    expect(series.isValid).toBe(false);
    expect(series.installments).toEqual([]);
    expect(series.errors.map((error) => error.code)).toEqual(expect.arrayContaining(['INVALID_MONEY', 'INVALID_DUE_DATE']));
  });

  it('preserves current status behavior for first installment only', () => {
    const paid = makeSeries({ status: 'Pago', paidAt: '2026-01-31' });
    expect(paid.installments.map((item) => [item.status, item.paid_at])).toEqual([
      ['Pago', '2026-01-31'],
      ['Em aberto', ''],
      ['Em aberto', '']
    ]);

    const open = makeSeries({ status: 'Em aberto', paidAt: '2026-01-31' });
    expect(open.installments.every((item) => item.status === 'Em aberto')).toBe(true);
    expect(open.installments.every((item) => item.paid_at === '')).toBe(true);
    expect(open.installments.every((item) => item.archived === false)).toBe(true);
  });

  it('keeps future integration metadata from changing the calculation', () => {
    const web = makeSeries({ source_channel: 'web' });
    const future = makeSeries({ source_channel: 'future_integration' });

    expect(web.installments.map((item) => item.amount)).toEqual(future.installments.map((item) => item.amount));
    expect(future.installments.some((item) => 'phone' in item || 'whatsapp_phone' in item)).toBe(false);
  });
});

describe('installment legacy analysis', () => {
  it('reports correct series, differences, duplicates and missing numbers without writes', () => {
    const ok = makeSeries({ totalAmount: 100, totalInstallments: 3 }).installments
      .map((record, index) => ({ ...record, id: `ok-${index + 1}` }));
    const inconsistent = [
      { ...ok[0], id: 'bad-1', parent_id: 'bad', installment_no: 1, total_installments: 3, amount: 33.33 },
      { ...ok[1], id: 'bad-dup', parent_id: 'bad', installment_no: 1, total_installments: 4, amount: 33.33 }
    ];
    const report = analyzeInstallmentSeries([...ok, ...inconsistent], {
      expectedTotalsByParentId: {
        'series-fixed': 10000,
        bad: 10000
      }
    });

    expect(report.wrote).toBe(false);
    expect(report.totalSeries).toBe(2);
    expect(report.series.find((item) => item.parent_id === 'series-fixed')).toMatchObject({
      sumCents: 10000,
      differenceCents: 0,
      status: 'ok'
    });
    expect(report.series.find((item) => item.parent_id === 'bad')).toMatchObject({
      duplicates: [1],
      missingInstallmentNumbers: [2, 3, 4],
      inconsistentTotals: [3],
      differenceCents: -3334,
      status: 'needs_review'
    });
  });

  it('detects missing parent, invalid amount precision and is deterministic', () => {
    const records = [
      { id: 'legacy-1', type: 'saida', is_installment: true, installment_no: 1, total_installments: 2, amount: 10.001 }
    ];
    const first = buildInstallmentReconciliationDryRun(records);
    const second = buildInstallmentReconciliationDryRun(records);

    expect(first).toEqual(second);
    expect(first.wrote).toBe(false);
    expect(first.series[0]).toMatchObject({
      totalOriginalKnown: false,
      invalidParentIds: ['legacy-1'],
      invalidAmounts: ['legacy-1'],
      status: 'needs_review'
    });
  });
});
