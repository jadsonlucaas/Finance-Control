import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const migratedModules = [
  'src/ui/records/expenseFormController.js',
  'src/ui/records/incomeFormController.js',
  'src/ui/records/recordMutationPresenter.js',
  'src/ui/records/mutationAttemptStore.js'
];

describe('financial CRUD modernization boundaries', () => {
  it('keeps migrated modules independent from browser globals and Firebase adapters', () => {
    for (const file of migratedModules) {
      const source = readFileSync(file, 'utf8');
      expect(source, file).not.toMatch(/\bwindow\b|globalThis\.financeApp|financeApp\.applicationGateway|dataSdk|firebase\/|from ['"]firebase/);
    }
  });

  it('does not move fiscal, hour, installment or recurrence rules into CRUD controllers', () => {
    const controllers = [
      'src/ui/records/expenseFormController.js',
      'src/ui/records/incomeFormController.js'
    ];
    for (const file of controllers) {
      const source = readFileSync(file, 'utf8');
      expect(source, file).not.toMatch(/calcularINSS|calcularIRRF|calcularLiquido|calcularHoraExtra|calcularDSR/);
      expect(source, file).not.toMatch(/CreateInstallmentSeriesCommand|CreateRecurrenceSeriesCommand/);
    }
  });

  it('keeps the browser bridge nested under the existing financeApp global', () => {
    const source = readFileSync('src/ui/records/financialCrudControllerInstaller.js', 'utf8');
    expect(source).toContain('financialCrud');
    expect(source).not.toMatch(/target\.(createExpense|updateExpense|deleteExpense|markExpenseAsPaid|archiveExpense|createIncome)\s*=/);
  });
});
