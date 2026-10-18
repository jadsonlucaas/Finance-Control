import { readdirSync, readFileSync, statSync } from 'node:fs';

const baseline = JSON.parse(readFileSync('docs/bundle-budget-baseline.json', 'utf8'));

const budgets = {
  entryChunkBytes: 420 * 1024,
  maxChunkBytes: 560 * 1024,
  servicesFirebaseChunkBytes: 560 * 1024,
  globalsMax: 50,
  classicScriptsMax: 23,
  evalExecutedScriptsMax: 23,
  lazyEntryEvidence: [
    { name: 'hour-control-active-ui-runtime', patterns: ['finance-hour-control-active-ui-runtime', 'data-hour-control-modern-group'] },
    {
      name: 'settings-active-ui-runtime',
      patterns: [
        'data-settings-person-id',
        'createSettingsWebAdapter',
        'settingsBaseRecord',
        'resolveReferenceWriteScope',
        'SETTINGS_SHARED_REFERENCE_FORBIDDEN'
      ]
    },
    {
      name: 'user-admin-active-ui-runtime',
      patterns: [
        'data-admin-user-row',
        'createUserAdminPresenter',
        'resolveUserAdminPermissions'
      ]
    },
    {
      name: 'import-active-ui-runtime',
      patterns: [
        'createImportController',
        'buildImportPreviewReadModel'
      ]
    },
    {
      name: 'backup-active-ui-runtime',
      patterns: [
        'createBackupController',
        'buildBackupPreviewReadModel',
        'RESTORE_REAL_UNAVAILABLE'
      ]
    },
    {
      name: 'pdf-export-active-ui-runtime',
      patterns: [
        'createReportExportController',
        'buildFinancialReportReadModel',
        'PDF_LIBRARY_NOT_READY'
      ]
    }
  ],
  forbiddenBootstrapEvidence: [
    { name: 'xlsx-runtime', patterns: ['xlsx.full.min.js', 'cdnjs.cloudflare.com/ajax/libs/xlsx', 'XLSX.read'] },
    { name: 'jspdf-runtime', patterns: ['jspdf.umd.min.js', 'new jsPDF', 'autoTable('] },
    { name: 'firebase-admin', patterns: ['firebase-admin'] },
    { name: 'whatsapp-provider', patterns: ['twilio', 'z-api', 'whatsapp-web.js', 'wppconnect', 'baileys'] }
  ]
};

function assets() {
  return readdirSync('dist/assets')
    .filter((name) => name.endsWith('.js'))
    .map((name) => ({ file: `dist/assets/${name}`, bytes: statSync(`dist/assets/${name}`).size }));
}

function read(file) {
  return readFileSync(file, 'utf8');
}

const chunks = assets();
const html = readFileSync('dist/index.html', 'utf8');
const entryAsset = html.match(/<script[^>]+type="module"[^>]+src="\/?(assets\/app-[^"]+\.js)"/)?.[1] || '';
const entry = chunks.find((chunk) => chunk.file === `dist/${entryAsset}`)
  || chunks.find((chunk) => /assets\/app-[A-Za-z0-9_-]+\.js$/.test(chunk.file) && !chunk.file.includes('app-resilience-'));
const firebase = chunks.find((chunk) => /services-firebase-.*\.js$/.test(chunk.file));
const largest = chunks.toSorted((a, b) => b.bytes - a.bytes)[0];
const entryText = entry ? read(entry.file) : '';
const appSource = read('src/app.js');
const globalInventory = read('docs/global-api-inventory.md');
const globalCount = (globalInventory.match(/^\| `[^`]+` \|/gm) || []).length;
const violations = [];

if (budgets.entryChunkBytes !== 430080) violations.push(`ENTRY_BUDGET_NOT_OFFICIAL:${budgets.entryChunkBytes}`);
if (baseline.entryChunkBytes !== 430080) violations.push(`ENTRY_BASELINE_NOT_OFFICIAL:${baseline.entryChunkBytes}`);
if (budgets.entryChunkBytes !== baseline.entryChunkBytes) {
  violations.push(`ENTRY_BUDGET_LIMIT_INCREASE:${budgets.entryChunkBytes}:${baseline.entryChunkBytes}`);
}
if (globalCount > budgets.globalsMax) violations.push(`GLOBAL_API_BUDGET:${globalCount}`);
if (!entry || entry.bytes > budgets.entryChunkBytes) violations.push(`ENTRY_CHUNK_BUDGET:${entry?.bytes || 0}`);
if (largest && largest.bytes > budgets.maxChunkBytes) violations.push(`MAX_CHUNK_BUDGET:${largest.file}:${largest.bytes}`);
if (firebase && firebase.bytes > budgets.servicesFirebaseChunkBytes) violations.push(`FIREBASE_CHUNK_BUDGET:${firebase.bytes}`);
if (firebase && html.includes(firebase.file.replace('dist/', ''))) violations.push('FIREBASE_IN_BOOTSTRAP');
if (/import\s+\{?\s*installHourControlActiveUi\b/.test(appSource)) {
  violations.push('HOUR_CONTROL_ACTIVE_UI_STATIC_IMPORT');
}
budgets.lazyEntryEvidence.forEach((evidence) => {
  if (evidence.patterns.some((pattern) => entryText.includes(pattern))) {
    violations.push(`LAZY_MODULE_IN_ENTRY:${evidence.name}`);
  }
});
budgets.forbiddenBootstrapEvidence.forEach((evidence) => {
  if (evidence.patterns.some((pattern) => entryText.includes(pattern))) {
    violations.push(`FORBIDDEN_BOOTSTRAP:${evidence.name}`);
  }
});

const report = { ok: violations.length === 0, budgets, globalCount, entry, firebase, largest, violations };
console.log(JSON.stringify(report, null, 2));
if (violations.length) process.exit(1);
