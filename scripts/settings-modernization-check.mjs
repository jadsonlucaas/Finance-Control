import { readFileSync } from 'node:fs';
import { analyzeLegacyLoader } from './analyze-legacy-loader.mjs';

const files = [
  'src/application/readModels/settingsReadModel.js',
  'src/ui/settings/settingsController.js',
  'src/ui/settings/settingsPresenter.js',
  'src/ui/settings/settingsActiveUi.js',
  'src/ui/settings/loadSettingsActiveUi.js'
];

const forbidden = [
  /dataSdk/,
  /firebase\//,
  /from ['"]firebase/,
  /window\.financeApp/,
  /financeApp\.financialCrud/,
  /CalculateINSS|CalculateIRRF|calcularINSS|calcularIRRF/,
  /MaterializePercentage|materializePercentage|percentage_rule_materialization/,
  /WhatsApp|webhook|Admin SDK|telefone|phone/i
];

function collectViolations() {
  const violations = [];
  for (const file of files) {
    const source = readFileSync(file, 'utf8');
    for (const pattern of forbidden) {
      if (pattern.test(source)) violations.push({ file, pattern: pattern.source });
    }
  }
  return violations;
}

const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
const budget = JSON.parse(readFileSync('docs/bundle-budget-baseline.json', 'utf8'));
const appSource = readFileSync('src/app.js', 'utf8');
const inventory = readFileSync('docs/global-api-inventory.md', 'utf8');
const legacyLoader = analyzeLegacyLoader();
const globals = (inventory.match(/^\| `[^`]+` \|/gm) || []).length;
const entryBudget = budget.budgets?.entryChunkBytes || budget.entryChunkBytes || 430080;
const appSettingsOnlyPatterns = [
  /createSettingsReadSource/,
  /createSettingsActions/,
  /settingsBaseRecord/,
  /settingsReferenceScope/,
  /createSettingsSupplementaryRenderers/,
  /resolveReferenceWriteScope/,
  /SETTINGS_SHARED_REFERENCE_FORBIDDEN/
];
const distEntryEvidence = [
  'data-settings-person-id',
  'createSettingsWebAdapter',
  'settingsBaseRecord',
  'resolveReferenceWriteScope',
  'SETTINGS_SHARED_REFERENCE_FORBIDDEN'
];

function readDistEntry() {
  try {
    const html = readFileSync('dist/index.html', 'utf8');
    const entryAsset = html.match(/<script[^>]+type="module"[^>]+src="\/?(assets\/app-[^"]+\.js)"/)?.[1] || '';
    return entryAsset ? readFileSync(`dist/${entryAsset}`, 'utf8') : '';
  } catch {
    return '';
  }
}

const distEntry = readDistEntry();

const checks = [
  {
    name: 'settings_script_registered',
    ok: packageJson.scripts['settings-modernization:check'] === 'node scripts/settings-modernization-check.mjs'
  },
  {
    name: 'settings_benchmark_registered',
    ok: packageJson.scripts['settings:benchmark'] === 'node scripts/settings-benchmark.mjs'
  },
  {
    name: 'settings_lazy_loader_after_legacy',
    ok: /loadLegacyClassicScripts\(globalThis\)[\s\S]*installSettingsLazyLoader\(globalThis\)/.test(appSource)
  },
  {
    name: 'settings_active_ui_not_static_imported',
    ok: !/import\s+\{?\s*installSettingsActiveUi\b/.test(appSource)
  },
  {
    name: 'settings_only_web_adapter_not_in_bootstrap_source',
    ok: !appSettingsOnlyPatterns.some((pattern) => pattern.test(appSource))
  },
  {
    name: 'settings_only_runtime_not_in_dist_entry',
    ok: !distEntry || !distEntryEvidence.some((pattern) => distEntry.includes(pattern))
  },
  {
    name: 'budget_is_not_increased',
    ok: entryBudget === 430080
  },
  {
    name: 'personal_shared_boundaries_present',
    ok: /personalMacros/.test(readFileSync('src/application/readModels/settingsReadModel.js', 'utf8'))
      && /sharedMacros/.test(readFileSync('src/application/readModels/settingsReadModel.js', 'utf8'))
  }
];

const violations = collectViolations();
const failedChecks = checks.filter((check) => !check.ok);
const result = {
  ok: violations.length === 0
    && failedChecks.length === 0
    && globals <= 50
    && legacyLoader.classicScripts <= 33
    && legacyLoader.evalExecutedScripts <= 33,
  wrote: false,
  violations,
  checks,
  failedChecks,
  globals,
  classicScripts: legacyLoader.classicScripts,
  evalExecutedScripts: legacyLoader.evalExecutedScripts,
  entryBudget,
  limits: {
    globals: 50,
    classicScripts: 33,
    evalExecutedScripts: 33,
    entryBudget: 430080
  }
};

console.log(JSON.stringify(result, null, 2));
if (!result.ok) process.exit(1);
