import { readFileSync } from 'node:fs';
import { analyzeLegacyLoader } from './analyze-legacy-loader.mjs';

const modernPureFiles = [
  'src/application/selectors/hourControlFilters.js',
  'src/application/readModels/hourControlReadModel.js'
];

const modernUiFiles = [
  'src/ui/hours/hourControlController.js',
  'src/ui/hours/hourControlPresenter.js',
  'src/ui/hours/hourControlActiveUi.js'
];

const pureForbidden = [
  /\bwindow\b/,
  /\bdocument\b/,
  /dataSdk/,
  /firebase\//,
  /from ['"]firebase/,
  /WhatsApp|webhook|Admin SDK|telefone|phone/i,
  /calcularHoras|calcularHoraExtra|calcularBancoHoras|CalculateWorkSession|CalculateDSR/
];

const uiForbidden = [
  /dataSdk/,
  /firebase\//,
  /from ['"]firebase/,
  /calcularHoras|calcularHoraExtra|calcularBancoHoras|CalculateDSR/,
  /WhatsApp|webhook|Admin SDK|telefone|phone/i
];

function collectViolations(files, patterns) {
  const violations = [];
  for (const file of files) {
    const source = readFileSync(file, 'utf8');
    for (const pattern of patterns) {
      if (pattern.test(source)) violations.push({ file, pattern: pattern.source });
    }
  }
  return violations;
}

const classicScriptsSource = readFileSync('src/legacy/classicScripts.js', 'utf8');
const classicScripts = (classicScriptsSource.match(/\[\s*['"]src\//g) || []).length;
const inventory = readFileSync('docs/global-api-inventory.md', 'utf8');
const globals = (inventory.match(/^\| `[^`]+` \|/gm) || []).length;
const legacyLoader = analyzeLegacyLoader();
const evalExecutedScripts = legacyLoader.evalExecutedScripts;
const violations = [
  ...collectViolations(modernPureFiles, pureForbidden),
  ...collectViolations(modernUiFiles, uiForbidden)
];
const appSource = readFileSync('src/app.js', 'utf8');
const loaderSource = readFileSync('src/ui/hours/loadHourControlActiveUi.js', 'utf8');
const activeUiSource = readFileSync('src/ui/hours/hourControlActiveUi.js', 'utf8');
const controllerSource = readFileSync('src/ui/hours/hourControlController.js', 'utf8');
const integrationChecks = [
  {
    name: 'bootstrap_installs_hour_ui_lazy_loader_after_legacy_loader',
    ok: /loadLegacyClassicScripts\(globalThis\)[\s\S]*installHourControlLazyLoader\(globalThis\)/.test(appSource)
  },
  {
    name: 'active_hour_ui_is_not_static_imported_by_app',
    ok: !/import\s+\{?\s*installHourControlActiveUi\b/.test(appSource)
  },
  {
    name: 'active_hour_ui_loader_imports_chunk_on_demand',
    ok: /import\('\.\/ui\/hours\/loadHourControlActiveUi\.js'\)/.test(appSource)
      && /import\('\.\/hourControlActiveUi\.js'\)/.test(loaderSource)
  },
  {
    name: 'active_ui_uses_controller',
    ok: /createHourControlController\(/.test(activeUiSource)
  },
  {
    name: 'active_ui_uses_presenter',
    ok: /createHourControlPresenter\(/.test(activeUiSource)
  },
  {
    name: 'controller_uses_read_model',
    ok: /buildHourControlReadModel/.test(controllerSource)
  },
  {
    name: 'active_create_uses_gateway_command',
    ok: /createHourEntry\(/.test(activeUiSource) && /CreateHourEntryCommand/.test(controllerSource)
  },
  {
    name: 'active_update_uses_gateway_command',
    ok: /updateHourEntry\(/.test(activeUiSource) && /UpdateHourEntryCommand/.test(controllerSource)
  },
  {
    name: 'active_ui_marks_existing_bridges',
    ok: /__financeModernHourControl/.test(activeUiSource) && /target\.saveHourControlRecord = saveHourControlRecordModern/.test(activeUiSource)
  }
];
const failedIntegrationChecks = integrationChecks.filter((check) => !check.ok);

const result = {
  ok: violations.length === 0 && failedIntegrationChecks.length === 0 && globals <= 50 && classicScripts <= 33 && evalExecutedScripts <= 33,
  wrote: false,
  violations,
  integrationChecks,
  failedIntegrationChecks,
  globals,
  classicScripts,
  evalExecutedScripts,
  limits: {
    globals: 50,
    classicScripts: 33,
    evalExecutedScripts: 33
  }
};

console.log(JSON.stringify(result, null, 2));
if (!result.ok) process.exit(1);
