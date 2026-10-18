import { readFileSync } from 'node:fs';
import { analyzeLegacyLoader } from './analyze-legacy-loader.mjs';

const modernFiles = [
  'src/application/readModels/userAdminReadModel.js',
  'src/application/userAdmin/userAdminPermissions.js',
  'src/ui/admin/userAdminController.js',
  'src/ui/admin/userAdminPresenter.js',
  'src/ui/admin/userAdminActiveUi.js',
  'src/ui/admin/loadUserAdminActiveUi.js'
];

const uiForbidden = [
  /firebase\//,
  /from ['"]firebase/,
  /updateDoc|setDoc|getDocs|getDoc/,
  /window\.financeApp\.[a-zA-Z_$].*(planner|dashboard|hours|settings|tax|percentage)/,
  /CalculateINSS|CalculateIRRF|calcularINSS|calcularIRRF/,
  /WhatsApp|webhook|telefone|phone|Admin SDK|firebase-admin/i
];

function read(path) {
  return readFileSync(path, 'utf8');
}

function collectViolations() {
  const violations = [];
  for (const file of modernFiles) {
    const source = read(file);
    const forbidden = file.includes('/userAdminActiveUi.js') ? uiForbidden : uiForbidden.filter((pattern) => !/window/.test(pattern.source));
    for (const pattern of forbidden) {
      if (pattern.test(source)) violations.push({ file, pattern: pattern.source });
    }
  }
  return violations;
}

const packageJson = JSON.parse(read('package.json'));
const appSource = read('src/app.js');
const settingsLoader = read('src/ui/settings/loadSettingsActiveUi.js');
const inventory = read('docs/global-api-inventory.md');
const legacyLoader = analyzeLegacyLoader();
const globals = (inventory.match(/^\| `[^`]+` \|/gm) || []).length;

const checks = [
  {
    name: 'script_registered',
    ok: packageJson.scripts['user-admin-modernization:check'] === 'node scripts/user-admin-modernization-check.mjs'
  },
  {
    name: 'benchmark_registered',
    ok: packageJson.scripts['user-admin:benchmark'] === 'node scripts/user-admin-benchmark.mjs'
  },
  {
    name: 'active_ui_not_static_imported_in_bootstrap',
    ok: !/userAdminActiveUi|loadUserAdminActiveUi/.test(appSource)
  },
  {
    name: 'active_ui_loaded_from_settings_lazy_path',
    ok: /import\('\.\.\/admin\/loadUserAdminActiveUi\.js'\)/.test(settingsLoader)
  },
  {
    name: 'legacy_bridge_names_preserved',
    ok: /setManagedUserRole/.test(read('src/ui/admin/userAdminActiveUi.js'))
      && /setManagedUserStatus/.test(read('src/ui/admin/userAdminActiveUi.js'))
      && /toggleManagedUserStatus/.test(read('src/ui/admin/userAdminActiveUi.js'))
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
  limits: {
    globals: 50,
    classicScripts: 33,
    evalExecutedScripts: 33
  }
};

console.log(JSON.stringify(result, null, 2));
if (!result.ok) process.exit(1);

