import { readFileSync } from 'node:fs';
import { analyzeLegacyLoader } from './analyze-legacy-loader.mjs';

const pureFiles = [
  'src/application/selectors/plannerFilters.js',
  'src/application/readModels/plannerReadModel.js'
];

const uiFiles = [
  'src/ui/planner/plannerController.js',
  'src/ui/planner/plannerPresenter.js',
  'src/ui/planner/plannerActiveUi.js'
];

const modernPlannerFiles = [
  'src/ui/planner/plannerController.js',
  'src/ui/planner/plannerActiveUi.js',
  'src/ui/planner/loadPlannerActiveUi.js'
];

const pureForbidden = [
  /\bwindow\b/,
  /\bdocument\b/,
  /dataSdk/,
  /firebase\//,
  /from ['"]firebase/,
  /WhatsApp|webhook|Admin SDK|telefone|phone/i
];

const uiForbidden = [
  /dataSdk/,
  /firebase\//,
  /from ['"]firebase/,
  /calcularINSS|calcularIRRF|calcularLiquido|calcularHoras|calcularHoraExtra|CreateInstallmentSeries|CreateRecurrenceSeries|CalculateDSR/,
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

const appSource = readFileSync('src/app.js', 'utf8');
const loaderSource = readFileSync('src/ui/planner/loadPlannerActiveUi.js', 'utf8');
const activeUiSource = readFileSync('src/ui/planner/plannerActiveUi.js', 'utf8');
const controllerSource = readFileSync('src/ui/planner/plannerController.js', 'utf8');
const eventStoreSource = readFileSync('src/application/planner/plannerLocalEventStore.js', 'utf8');
const inventory = readFileSync('docs/global-api-inventory.md', 'utf8');
const legacyLoader = analyzeLegacyLoader();
const globals = (inventory.match(/^\| `[^`]+` \|/gm) || []).length;

const integrationChecks = [
  {
    name: 'bootstrap_installs_planner_lazy_loader_after_legacy_loader',
    ok: /loadLegacyClassicScripts\(globalThis\)[\s\S]*installPlannerLazyLoader\(globalThis\)/.test(appSource)
  },
  {
    name: 'active_planner_ui_is_not_static_imported_by_app',
    ok: !/import\s+\{?\s*installPlannerActiveUi\b/.test(appSource)
  },
  {
    name: 'active_planner_ui_loader_imports_chunk_on_demand',
    ok: /import\('\.\/ui\/planner\/loadPlannerActiveUi\.js'\)/.test(appSource)
      && /import\('\.\/plannerActiveUi\.js'\)/.test(loaderSource)
  },
  {
    name: 'active_ui_uses_controller',
    ok: /createPlannerController\(/.test(activeUiSource)
  },
  {
    name: 'controller_uses_read_model',
    ok: /buildPlannerReadModel/.test(controllerSource)
  },
  {
    name: 'financial_mutations_use_injected_actions',
    ok: /financialActions/.test(controllerSource) && /markExpenseAsPaid/.test(controllerSource)
  },
  {
    name: 'active_ui_marks_existing_bridges',
    ok: /__financeModernPlanner/.test(activeUiSource)
  },
  {
    name: 'modern_planner_has_no_global_finance_app_or_v1_storage_dependency',
    ok: modernPlannerFiles.every((file) => {
      const source = readFileSync(file, 'utf8');
      return !/financeApp|financialCrud|finance-control-planner-events-v1|finance-control-custom-holidays-v1/.test(source);
    })
  },
  {
    name: 'planner_local_event_store_requires_owner_and_keeps_v1_legacy_unassigned',
    ok: /PLANNER_OWNER_UID_REQUIRED/.test(eventStoreSource)
      && /getLegacyUnassigned/.test(eventStoreSource)
      && /PLANNER_EVENTS_V2_PREFIX/.test(eventStoreSource)
  }
];

const violations = [
  ...collectViolations(pureFiles, pureForbidden),
  ...collectViolations(uiFiles, uiForbidden)
];
const failedIntegrationChecks = integrationChecks.filter((check) => !check.ok);

const result = {
  ok: violations.length === 0
    && failedIntegrationChecks.length === 0
    && globals <= 50
    && legacyLoader.classicScripts <= 33
    && legacyLoader.evalExecutedScripts <= 33,
  wrote: false,
  violations,
  integrationChecks,
  failedIntegrationChecks,
  globals,
  classicScripts: legacyLoader.classicScripts,
  evalExecutedScripts: legacyLoader.evalExecutedScripts,
  limits: {
    globals: 50,
    classicScripts: 33,
    evalExecutedScripts: 33
  }
};

console.log(JSON.stringify(result, null, 2));
if (!result.ok) process.exit(1);
