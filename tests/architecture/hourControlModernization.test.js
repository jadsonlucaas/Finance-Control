import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { analyzeLegacyLoader } from '../../scripts/analyze-legacy-loader.mjs';

const pureModules = [
  'src/application/selectors/hourControlFilters.js',
  'src/application/readModels/hourControlReadModel.js'
];

const uiModules = [
  'src/ui/hours/hourControlController.js',
  'src/ui/hours/hourControlPresenter.js',
  'src/ui/hours/hourControlActiveUi.js'
];

describe('hour control modernization boundaries', () => {
  it('keeps hour read model modules independent from DOM, globals, Firebase and channel-specific code', () => {
    for (const file of pureModules) {
      const source = readFileSync(file, 'utf8');
      expect(source, file).not.toMatch(/\bwindow\b|\bdocument\b|dataSdk|firebase\/|from ['"]firebase|WhatsApp|webhook|Admin SDK|telefone|phone/i);
    }
  });

  it('keeps hour controller and presenter out of Firebase and financial calculations', () => {
    for (const file of uiModules) {
      const source = readFileSync(file, 'utf8');
      expect(source, file).not.toMatch(/dataSdk|firebase\/|from ['"]firebase|calcularHoras|calcularHoraExtra|calcularBancoHoras|CalculateDSR|WhatsApp|webhook|Admin SDK|telefone|phone/i);
    }
  });

  it('connects active hour-control UI through modern controller presenter and read model', () => {
    const appSource = readFileSync('src/app.js', 'utf8');
    const loaderSource = readFileSync('src/ui/hours/loadHourControlActiveUi.js', 'utf8');
    const activeUiSource = readFileSync('src/ui/hours/hourControlActiveUi.js', 'utf8');
    const controllerSource = readFileSync('src/ui/hours/hourControlController.js', 'utf8');

    expect(appSource).not.toMatch(/import\s+\{?\s*installHourControlActiveUi\b/);
    expect(appSource).toMatch(/loadLegacyClassicScripts\(globalThis\)[\s\S]*installHourControlLazyLoader\(globalThis\)/);
    expect(appSource).toMatch(/import\('\.\/ui\/hours\/loadHourControlActiveUi\.js'\)/);
    expect(loaderSource).toMatch(/import\('\.\/hourControlActiveUi\.js'\)/);
    expect(activeUiSource).toMatch(/createHourControlController\(/);
    expect(activeUiSource).toMatch(/createHourControlPresenter\(/);
    expect(activeUiSource).toMatch(/target\.saveHourControlRecord = saveHourControlRecordModern/);
    expect(activeUiSource).not.toMatch(/window\.dataSdk\.(create|update)|target\.dataSdk\.(create|update)|Firebase/);
    expect(controllerSource).toMatch(/buildHourControlReadModel/);
    expect(controllerSource).toMatch(/CreateHourEntryCommand/);
    expect(controllerSource).toMatch(/UpdateHourEntryCommand/);
  });

  it('does not introduce top-level global hour-control bridges or extra eval scripts', () => {
    for (const file of [...pureModules, 'src/ui/hours/hourControlController.js', 'src/ui/hours/hourControlPresenter.js']) {
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
