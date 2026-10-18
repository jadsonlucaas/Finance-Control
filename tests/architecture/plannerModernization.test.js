import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { analyzeLegacyLoader } from '../../scripts/analyze-legacy-loader.mjs';

const pureModules = [
  'src/application/selectors/plannerFilters.js',
  'src/application/readModels/plannerReadModel.js'
];

const uiModules = [
  'src/ui/planner/plannerController.js',
  'src/ui/planner/plannerPresenter.js',
  'src/ui/planner/plannerActiveUi.js'
];

const modernPlannerModules = [
  'src/ui/planner/plannerController.js',
  'src/ui/planner/plannerActiveUi.js',
  'src/ui/planner/loadPlannerActiveUi.js'
];

describe('planner modernization boundaries', () => {
  it('keeps planner read model modules independent from DOM, globals, Firebase and channel-specific code', () => {
    for (const file of pureModules) {
      const source = readFileSync(file, 'utf8');
      expect(source, file).not.toMatch(/\bwindow\b|\bdocument\b|dataSdk|firebase\/|from ['"]firebase|WhatsApp|webhook|Admin SDK|telefone|phone/i);
    }
  });

  it('keeps planner UI out of Firebase and financial formula engines', () => {
    for (const file of uiModules) {
      const source = readFileSync(file, 'utf8');
      expect(source, file).not.toMatch(/dataSdk|firebase\/|from ['"]firebase|calcularINSS|calcularIRRF|calcularLiquido|calcularHoras|calcularHoraExtra|CreateInstallmentSeries|CreateRecurrenceSeries|CalculateDSR|WhatsApp|webhook|Admin SDK|telefone|phone/i);
    }
  });

  it('connects active Planner UI through lazy loading after legacy bootstrap', () => {
    const appSource = readFileSync('src/app.js', 'utf8');
    const loaderSource = readFileSync('src/ui/planner/loadPlannerActiveUi.js', 'utf8');
    const activeUiSource = readFileSync('src/ui/planner/plannerActiveUi.js', 'utf8');
    const controllerSource = readFileSync('src/ui/planner/plannerController.js', 'utf8');

    expect(appSource).not.toMatch(/import\s+\{?\s*installPlannerActiveUi\b/);
    expect(appSource).toMatch(/loadLegacyClassicScripts\(globalThis\)[\s\S]*installPlannerLazyLoader\(globalThis\)/);
    expect(appSource).toMatch(/import\('\.\/ui\/planner\/loadPlannerActiveUi\.js'\)/);
    expect(loaderSource).toMatch(/import\('\.\/plannerActiveUi\.js'\)/);
    expect(activeUiSource).toMatch(/createPlannerController\(/);
    expect(controllerSource).toMatch(/buildPlannerReadModel/);
    expect(controllerSource).toMatch(/financialActions/);
    expect(controllerSource).toMatch(/markExpenseAsPaid/);
  });

  it('keeps modern Planner isolated from global financeApp dependencies and V1 localStorage keys', () => {
    for (const file of modernPlannerModules) {
      const source = readFileSync(file, 'utf8');
      expect(source, file).not.toMatch(/financeApp|financialCrud|finance-control-planner-events-v1|finance-control-custom-holidays-v1/);
    }
    const legacyPlanner = readFileSync('src/legacy/inline/part-26.js', 'utf8');
    expect(legacyPlanner).toMatch(/plannerStorage\?\.localEventStore/);
    expect(legacyPlanner).toMatch(/replaceAll\(events, \{ ownerUid \}\)/);
  });

  it('does not introduce top-level global planner APIs or extra eval scripts', () => {
    for (const file of pureModules) {
      const source = readFileSync(file, 'utf8');
      expect(source, file).not.toMatch(/Object\.assign\(target|target\.[A-Za-z0-9_]+\s*=/);
    }
    const inventory = readFileSync('docs/global-api-inventory.md', 'utf8');
    expect((inventory.match(/^\| `[^`]+` \|/gm) || []).length).toBeLessThanOrEqual(50);
    const legacyLoader = analyzeLegacyLoader();
    expect(legacyLoader.classicScripts).toBeLessThanOrEqual(33);
    expect(legacyLoader.evalExecutedScripts).toBeLessThanOrEqual(33);
  });
});
