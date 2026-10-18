import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { analyzeLegacyLoader } from '../../scripts/analyze-legacy-loader.mjs';

const modernFiles = [
  'src/application/readModels/settingsReadModel.js',
  'src/ui/settings/settingsController.js',
  'src/ui/settings/settingsPresenter.js',
  'src/ui/settings/settingsActiveUi.js',
  'src/ui/settings/loadSettingsActiveUi.js'
];

describe('settings modernization boundaries', () => {
  it('keeps SettingsReadModel pure and deterministic by construction', () => {
    const source = readFileSync('src/application/readModels/settingsReadModel.js', 'utf8');
    expect(source).not.toMatch(/\bwindow\b|\bdocument\b|dataSdk|firebase\/|from ['"]firebase|localStorage|financeApp|CalculateINSS|CalculateIRRF|materialize/i);
    expect(source).toMatch(/buildEffectiveReferences/);
  });

  it('keeps modern Settings UI free from Firebase and direct financeApp business dependencies', () => {
    for (const file of modernFiles) {
      const source = readFileSync(file, 'utf8');
      expect(source, file).not.toMatch(/dataSdk|firebase\/|from ['"]firebase|window\.financeApp|financeApp\.financialCrud|CalculateINSS|CalculateIRRF|MaterializePercentage|materializePercentage/i);
    }
  });

  it('connects active Settings UI through lazy loading after legacy bootstrap', () => {
    const appSource = readFileSync('src/app.js', 'utf8');
    const loaderSource = readFileSync('src/ui/settings/loadSettingsActiveUi.js', 'utf8');
    const activeSource = readFileSync('src/ui/settings/settingsActiveUi.js', 'utf8');

    expect(appSource).not.toMatch(/import\s+\{?\s*installSettingsActiveUi\b/);
    expect(appSource).toMatch(/loadLegacyClassicScripts\(globalThis\)[\s\S]*installSettingsLazyLoader\(globalThis\)/);
    expect(appSource).toMatch(/import\('\.\/ui\/settings\/loadSettingsActiveUi\.js'\)/);
    expect(loaderSource).toMatch(/import\('\.\/settingsActiveUi\.js'\)/);
    expect(activeSource).toMatch(/createSettingsController\(/);
  });

  it('keeps settings-only web adapter helpers out of the bootstrap source', () => {
    const appSource = readFileSync('src/app.js', 'utf8');
    expect(appSource).not.toMatch(/createSettingsReadSource|createSettingsActions|settingsBaseRecord|settingsReferenceScope|createSettingsSupplementaryRenderers/);
    expect(appSource).not.toMatch(/SETTINGS_SHARED_REFERENCE_FORBIDDEN|resolveReferenceWriteScope/);
    expect(readFileSync('src/ui/settings/loadSettingsActiveUi.js', 'utf8')).toMatch(/settingsWebAdapter/);
  });

  it('keeps reference write scope resolution pure', () => {
    const source = readFileSync('src/application/settings/referenceWriteScope.js', 'utf8');
    expect(source).not.toMatch(/\bwindow\b|\bdocument\b|localStorage|dataSdk|firebase\/|from ['"]firebase|financeApp/i);
    expect(source).toMatch(/resolveReferenceWriteScope/);
  });

  it('does not add globals or classic scripts', () => {
    const inventory = readFileSync('docs/global-api-inventory.md', 'utf8');
    const globals = (inventory.match(/^\| `[^`]+` \|/gm) || []).length;
    expect(globals).toBeLessThanOrEqual(50);
    const legacyLoader = analyzeLegacyLoader();
    expect(legacyLoader.classicScripts).toBeLessThanOrEqual(33);
    expect(legacyLoader.evalExecutedScripts).toBeLessThanOrEqual(33);
  });
});
