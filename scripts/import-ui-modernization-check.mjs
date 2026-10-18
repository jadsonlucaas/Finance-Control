import { existsSync, readFileSync } from 'node:fs';
import { analyzeLegacyLoader } from './analyze-legacy-loader.mjs';

function read(path) {
  return readFileSync(path, 'utf8');
}

function countGlobals() {
  const inventory = read('docs/global-api-inventory.md');
  return (inventory.match(/^\| `[^`]+` \|/gm) || []).length;
}

function entryFile() {
  const html = read('dist/index.html');
  const match = html.match(/<script[^>]+type="module"[^>]+src="\/?(assets\/app-[^"]+\.js)"/);
  return match ? `dist/${match[1]}` : '';
}

const requiredFiles = [
  'src/application/readModels/importPreviewReadModel.js',
  'src/ui/imports/importController.js',
  'src/ui/imports/importPresenter.js',
  'src/ui/imports/importActiveUi.js',
  'src/ui/imports/loadImportActiveUi.js'
];
const violations = [];

requiredFiles.forEach((file) => {
  if (!existsSync(file)) violations.push(`MISSING_FILE:${file}`);
});

const app = read('src/app.js');
const controller = read('src/ui/imports/importController.js');
const presenter = read('src/ui/imports/importPresenter.js');
const readModel = read('src/application/readModels/importPreviewReadModel.js');
const activeUi = read('src/ui/imports/importActiveUi.js');
const packageJson = JSON.parse(read('package.json'));
const legacy = analyzeLegacyLoader();
const globals = countGlobals();
const entry = entryFile();
const entrySource = entry ? read(entry) : '';

if (!/import\('\.\/ui\/imports\/loadImportActiveUi\.js'\)/.test(app)) violations.push('IMPORT_ACTIVE_UI_NOT_LAZY_FROM_APP');
if (/import\s+\{?\s*installImportacaoGlobals\b/.test(app)) violations.push('LEGACY_IMPORTACAO_STATIC_IMPORT');
if (!/renderImportacaoLazyPlaceholder/.test(app)) violations.push('RENDER_IMPORTACAO_BRIDGE_MISSING');
if (!/import\('\.\.\/importacao\.js'\)/.test(activeUi)) violations.push('LEGACY_IMPORTACAO_NOT_LAZY_LOADED_FOR_COMPAT');
if (!/createImportController/.test(activeUi) || !/createImportPresenter/.test(activeUi)) violations.push('ACTIVE_UI_NOT_CONNECTED');
if (!/PrepareImportBatch/.test(controller)) violations.push('PREPARE_IMPORT_BATCH_NOT_USED');
if (!/CommitImportBatch/.test(controller)) violations.push('COMMIT_IMPORT_BATCH_NOT_USED');
if (!/buildImportPreviewReadModel/.test(controller)) violations.push('PREVIEW_READ_MODEL_NOT_USED');
if (!/import\('\.\.\/\.\.\/application\/imports\/spreadsheetImportParser\.js'\)/.test(activeUi)) violations.push('SPREADSHEET_PARSER_NOT_DYNAMIC');
if (/dataSdk|firebase|Firestore|window\.financeApp|globalThis\.financeApp/.test(controller)) violations.push('CONTROLLER_HAS_FORBIDDEN_RUNTIME_DEPENDENCY');
if (/dataSdk|firebase|Firestore|window\.financeApp|globalThis\.financeApp/.test(presenter)) violations.push('PRESENTER_HAS_FORBIDDEN_RUNTIME_DEPENDENCY');
if (/document|window|globalThis|dataSdk|firebase|Firestore/.test(readModel)) violations.push('READ_MODEL_NOT_PURE');
if (/for\s*\([^)]*ready[^)]*\)[\s\S]{0,260}\.create\(/.test(controller)) violations.push('CONTROLLER_HAS_ROW_CREATE_LOOP');
if (!/committing/.test(controller) || !/COMMIT_IN_PROGRESS/.test(controller)) violations.push('DOUBLE_CLICK_GUARD_MISSING');
if (!/toErrorState\(normalized, viewState\)/.test(controller)) violations.push('PREVIEW_PRESERVATION_ON_ERROR_NOT_EXPLICIT');
if (!/ReconcileMutationAttempt/.test(controller)) violations.push('RECONCILIATION_NOT_AUDITED');
if (!packageJson.scripts?.['import-ui-modernization:check']) violations.push('SCRIPT_NOT_REGISTERED');
if (entrySource.includes('createImportController') || entrySource.includes('buildImportPreviewReadModel')) {
  violations.push('IMPORT_UI_IN_ENTRY');
}
if (entrySource.includes('function parseSpreadsheetImport') || entrySource.includes('EXPENSE_ALIASES') || entrySource.includes('INCOME_ALIASES')) {
  violations.push('SPREADSHEET_PARSER_IN_ENTRY');
}
['xlsx.full.min.js', 'XLSX.read', 'cdnjs.cloudflare.com/ajax/libs/xlsx'].forEach((pattern) => {
  if (entrySource.includes(pattern)) violations.push(`XLSX_IN_ENTRY:${pattern}`);
});

const entryBudget = 430080;
const result = {
  ok: violations.length === 0 && globals <= 50 && legacy.classicScripts <= 33 && legacy.evalExecutedScripts <= 33,
  wrote: false,
  violations,
  globals,
  classicScripts: legacy.classicScripts,
  evalExecutedScripts: legacy.evalExecutedScripts,
  entryBudget
};

console.log(JSON.stringify(result, null, 2));
if (!result.ok) process.exit(1);
