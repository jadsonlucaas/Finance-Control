import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const pureModules = [
  'src/application/selectors/dashboardFilters.js',
  'src/application/readModels/dashboardChartData.js',
  'src/application/readModels/dashboardReadModel.js',
  'src/application/readModels/expenseListReadModel.js',
  'src/application/readModels/incomeListReadModel.js'
];

const uiModules = [
  'src/ui/dashboard/dashboardController.js',
  'src/ui/dashboard/dashboardPresenter.js'
];

describe('dashboard read model modernization boundaries', () => {
  it('keeps read models independent from DOM, globals, Firebase and channel-specific code', () => {
    for (const file of pureModules) {
      const source = readFileSync(file, 'utf8');
      expect(source, file).not.toMatch(/\bwindow\b|\bdocument\b|dataSdk|firebase\/|from ['"]firebase|WhatsApp|webhook|provider|Admin SDK|telefone|phone/i);
    }
  });

  it('keeps dashboard controller and presenter out of Firebase and financial calculations', () => {
    for (const file of uiModules) {
      const source = readFileSync(file, 'utf8');
      expect(source, file).not.toMatch(/dataSdk|firebase\/|from ['"]firebase|calcularINSS|calcularIRRF|calcularLiquido|calcularHoraExtra|calcularDSR|WhatsApp|webhook|Admin SDK|telefone|phone/i);
    }
  });

  it('does not introduce top-level global dashboard bridges in modern read model modules', () => {
    for (const file of [...pureModules, ...uiModules]) {
      const source = readFileSync(file, 'utf8');
      expect(source, file).not.toMatch(/Object\.assign\(target|target\.[A-Za-z0-9_]+\s*=/);
    }
  });
});
