import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

function read(path) {
  return readFileSync(path, 'utf8');
}

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}

const violations = [];
const pkg = JSON.parse(read('package.json'));
const budget = JSON.parse(read('docs/bundle-budget-baseline.json'));
const controller = read('src/ui/backup/backupController.js');
const presenter = read('src/ui/backup/backupPresenter.js');
const activeUi = read('src/ui/backup/backupActiveUi.js');
const backupReadModel = read('src/application/readModels/backupPreviewReadModel.js');
const restoreReadModel = read('src/application/readModels/restorePreviewReadModel.js');
const downloadAdapter = read('src/ui/backup/backupDownloadAdapter.js');
const settingsLoader = read('src/ui/settings/loadSettingsActiveUi.js');
const inventory = read('docs/global-api-inventory.md');
const legacyStats = JSON.parse(read('docs/bundle-budget-baseline.json'));
const distAssets = walk('dist/assets').filter((path) => path.endsWith('.js'));
const entry = distAssets
  .map((file) => ({ file, bytes: statSync(file).size, source: read(file) }))
  .find((item) => /assets[\\/]+app-/.test(item.file));

function forbid(label, source, pattern) {
  if (pattern.test(source)) violations.push(label);
}

['src/ui/backup/backupController.js', 'src/ui/backup/backupPresenter.js', 'src/application/readModels/backupPreviewReadModel.js', 'src/application/readModels/restorePreviewReadModel.js'].forEach((file) => {
  const source = read(file);
  forbid(`${file}:DATA_SDK_FORBIDDEN`, source, /\bdataSdk\b/);
  forbid(`${file}:FIREBASE_FORBIDDEN`, source, /\bfirebase\b|Firestore|firebase\/firestore/i);
  forbid(`${file}:ADMIN_SDK_FORBIDDEN`, source, /firebase-admin|Admin SDK/i);
  forbid(`${file}:WINDOW_FINANCE_APP_FORBIDDEN`, source, /window\.financeApp|globalThis\.financeApp/);
});

forbid('BACKUP_CONTROLLER_RESTORE_COMMIT_FORBIDDEN', controller, /\bCommitFinanceRestore\b|\bCommitFinanceRollback\b|\bPrepareFinanceRollback\b/);
forbid('BACKUP_CONTROLLER_DIRECT_WRITE_FORBIDDEN', controller, /\.create\(|\.createMany\(|\.update\(|\.delete\(/);
if (!/CreateFinanceBackupSnapshot/.test(controller)) violations.push('BACKUP_USE_CASE_NOT_USED');
if (!/PrepareFinanceRestore/.test(controller)) violations.push('RESTORE_DRY_RUN_NOT_USED');
if (!/ValidateFinanceBackupSnapshot/.test(controller)) violations.push('RESTORE_VALIDATION_NOT_USED');
if (!/restoreRealUnavailable/.test(controller)) violations.push('RESTORE_REAL_BLOCK_MISSING');
if (!/downloadJson/.test(controller) || !/Blob/.test(downloadAdapter) || !/createObjectURL/.test(downloadAdapter)) violations.push('DOWNLOAD_ADAPTER_NOT_ISOLATED');
if (!/buildBackupPreviewReadModel/.test(controller) || !/buildRestorePreviewReadModel/.test(controller)) violations.push('READ_MODELS_NOT_CONNECTED');
if (!/loadAndInstallBackupActiveUi/.test(settingsLoader) || !/backupActiveUi/.test(activeUi)) violations.push('ACTIVE_UI_NOT_CONNECTED');
if (pkg.scripts['backup-ui-modernization:check'] !== 'node scripts/backup-ui-modernization-check.mjs') violations.push('PACKAGE_SCRIPT_MISSING');
if (budget.entryChunkBytes !== 430080) violations.push('ENTRY_BUDGET_CHANGED');
if ((inventory.match(/^\| `/gm) || []).length > budget.globalsMax) violations.push('GLOBALS_LIMIT_EXCEEDED');
if (entry?.bytes > budget.entryChunkBytes) violations.push('ENTRY_BUDGET_EXCEEDED');
['createBackupController', 'buildBackupPreviewReadModel', 'buildRestorePreviewReadModel', 'RESTORE_REAL_UNAVAILABLE'].forEach((pattern) => {
  if (entry?.source.includes(pattern)) violations.push(`BACKUP_RUNTIME_IN_ENTRY:${pattern}`);
});

console.log(JSON.stringify({
  ok: violations.length === 0,
  wrote: false,
  violations,
  globals: (inventory.match(/^\| `/gm) || []).length,
  classicScripts: legacyStats.classicScriptsMax || 33,
  entryBudget: budget.entryChunkBytes
}, null, 2));

if (violations.length) process.exit(1);
