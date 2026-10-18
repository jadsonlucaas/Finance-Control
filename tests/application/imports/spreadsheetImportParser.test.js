import { describe, expect, it } from 'vitest';
import {
  SPREADSHEET_IMPORT_KINDS,
  createSpreadsheetDryRunFixtures,
  parseSpreadsheetImport
} from '../../../src/application/imports/spreadsheetImportParser.js';

describe('spreadsheet import parser', () => {
  it('maps expense spreadsheet rows without touching UI or persistence dependencies', () => {
    const fixtures = createSpreadsheetDryRunFixtures();

    const parsed = parseSpreadsheetImport(fixtures.expenses, {
      kind: SPREADSHEET_IMPORT_KINDS.EXPENSES
    });

    expect(parsed.ok).toBe(true);
    expect(parsed.rows[0]).toMatchObject({
      type: 'saida',
      person: 'Ana',
      macro_category: 'VARIAVEL',
      subcategory: 'Alimentacao',
      description: 'Mercado 1',
      amount: 100,
      status: 'Pago',
      payment_method: 'Pix',
      competence: '2026-08',
      source_reference_id: 'xlsx-1',
      import_source: 'saidas_xlsx'
    });
    expect(parsed.rows[0].legacy_import_signature).toContain('Ana|VARIAVEL|Alimentacao|Mercado 1|100');
  });

  it('keeps invalid expense rows visible for the prepare step', () => {
    const fixtures = createSpreadsheetDryRunFixtures();

    const parsed = parseSpreadsheetImport(fixtures.expenses, {
      kind: SPREADSHEET_IMPORT_KINDS.EXPENSES
    });

    const invalid = parsed.rows.find((row) => row.source_reference_id === 'xlsx-invalid');
    expect(invalid.parser_errors.map((error) => error.code)).toContain('INVALID_AMOUNT');
  });

  it('maps supported income descriptions to entrada payloads', () => {
    const parsed = parseSpreadsheetImport([
      ['Competencia', 'Desc', 'Valores', 'Pessoa', 'Identificador'],
      ['2026-08', 'HE', '125,75', 'Jadson', 'income-1'],
      ['2026-08', 'DSR H.E', '25,10', 'Jadson', 'income-2']
    ], {
      kind: SPREADSHEET_IMPORT_KINDS.INCOMES
    });

    expect(parsed.ok).toBe(true);
    expect(parsed.rows).toHaveLength(2);
    expect(parsed.rows[0]).toMatchObject({
      type: 'entrada',
      person: 'Jadson',
      description: 'Hora Extra',
      earning_type: 'Hora Extra',
      macro_category: 'Rendimento',
      amount: 125.75,
      import_source: 'entradas_xlsx'
    });
  });
});
