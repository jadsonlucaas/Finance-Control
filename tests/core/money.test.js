import { describe, expect, it } from 'vitest';
import { parseCurrencyValue, roundCurrency } from '../../src/core/money.js';

describe('money helpers', () => {
  it('rounds currency values to two decimals', () => {
    expect(roundCurrency(10.005)).toBe(10.01);
    expect(roundCurrency('15.239')).toBe(15.24);
    expect(roundCurrency(null)).toBe(0);
    expect(roundCurrency('invalid')).toBe(0);
  });

  it('parses Brazilian currency strings', () => {
    expect(parseCurrencyValue('R$ 1.234,56')).toBe(1234.56);
    expect(parseCurrencyValue('2.500,1')).toBe(2500.1);
    expect(parseCurrencyValue(' 99,999 ')).toBe(100);
    expect(parseCurrencyValue(15.239)).toBe(15.24);
    expect(parseCurrencyValue('abc')).toBe(0);
  });
});
