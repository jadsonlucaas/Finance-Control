import { describe, expect, it } from 'vitest';
import {
  normalizeCycleValue,
  normalizeImportText,
  normalizeStatusValue,
  parseCurrencyValue
} from '../../src/domain/imports.js';

describe('import normalization', () => {
  it('normalizes spreadsheet text without depending on DOM state', () => {
    expect(normalizeImportText('  Café com leite  ')).toBe('Café com leite');
    expect(normalizeImportText(null)).toBe('');
  });

  it('normalizes supported cycle labels from imports', () => {
    expect(normalizeCycleValue('Início do mês')).toBe('INICIO_MES');
    expect(normalizeCycleValue('inicio do mes')).toBe('INICIO_MES');
    expect(normalizeCycleValue('Quinzena')).toBe('QUINZENA');
    expect(normalizeCycleValue('Outro')).toBe('');
  });

  it('normalizes payment status labels from imports', () => {
    expect(normalizeStatusValue('')).toBe('Em aberto');
    expect(normalizeStatusValue('PAGO')).toBe('Pago');
    expect(normalizeStatusValue('cancelada')).toBe('Cancelado');
    expect(normalizeStatusValue('pendente')).toBe('Em aberto');
  });

  it('reuses the pure currency parser for imported values', () => {
    expect(parseCurrencyValue('R$ 1.234,56')).toBe(1234.56);
    expect(parseCurrencyValue('invalid')).toBe(0);
  });
});
