import { readdirSync, readFileSync, statSync } from 'node:fs';

function read(file) {
  return readFileSync(file, 'utf8');
}

function assets() {
  return readdirSync('dist/assets')
    .filter((name) => name.endsWith('.js'))
    .map((name) => ({ file: `dist/assets/${name}`, bytes: statSync(`dist/assets/${name}`).size, text: read(`dist/assets/${name}`) }));
}

const pkg = JSON.parse(read('package.json'));
const baseline = JSON.parse(read('docs/bundle-budget-baseline.json'));
const inventory = read('docs/global-api-inventory.md');
const app = read('src/app.js');
const reportModel = read('src/application/readModels/financialReportReadModel.js');
const controller = read('src/ui/reports/reportExportController.js');
const presenter = read('src/ui/reports/reportExportPresenter.js');
const activeUi = read('src/ui/reports/reportExportActiveUi.js');
const adapter = read('src/ui/reports/pdfAdapter.js');
const loader = read('src/ui/reports/loadReportExportActiveUi.js');
const html = read('dist/index.html');
const chunks = assets();
const entryAsset = html.match(/<script[^>]+type="module"[^>]+src="\/?(assets\/app-[^"]+\.js)"/)?.[1] || '';
const entry = chunks.find((chunk) => chunk.file === `dist/${entryAsset}`);
const entryText = entry?.text || '';
const globalCount = (inventory.match(/^\| `[^`]+` \|/gm) || []).length;
const classicScripts = (read('src/legacy/classicScripts.js').match(/\['src\//g) || []).length;
const violations = [];

function forbid(name, text, patterns) {
  patterns.forEach((pattern) => {
    if (pattern.test(text)) violations.push(`${name}:${pattern}`);
  });
}

if (pkg.scripts['pdf-export-modernization:check'] !== 'node scripts/pdf-export-modernization-check.mjs') violations.push('SCRIPT_MISSING:pdf-export-modernization:check');
if (pkg.scripts['pdf-export:benchmark'] !== 'node scripts/pdf-export-benchmark.mjs') violations.push('SCRIPT_MISSING:pdf-export:benchmark');
if (baseline.entryChunkBytes !== 430080) violations.push(`ENTRY_BASELINE_CHANGED:${baseline.entryChunkBytes}`);
if (globalCount > 50) violations.push(`GLOBAL_API_BUDGET:${globalCount}`);
if (classicScripts > 33) violations.push(`CLASSIC_SCRIPT_BUDGET:${classicScripts}`);
if (!entry || entry.bytes > 430080) violations.push(`ENTRY_CHUNK_BUDGET:${entry?.bytes || 0}`);
if (!app.includes('installReportExportLazyLoader(globalThis)')) violations.push('ACTIVE_UI_NOT_CONNECTED');
if (!app.includes("import('./ui/reports/loadReportExportActiveUi.js')")) violations.push('REPORT_EXPORT_NOT_LAZY');
if (!loader.includes('reportExportActiveUi.js')) violations.push('LOAD_REPORT_ACTIVE_UI_MISSING');
if (!activeUi.includes('__financeModernReportExport')) violations.push('EXPORT_BRIDGE_NOT_PRESERVED');
if (!controller.includes('buildFinancialReportReadModel')) violations.push('CONTROLLER_DOES_NOT_USE_REPORT_MODEL');
if (!controller.includes('pdfAdapterLoader')) violations.push('PDF_ADAPTER_NOT_LAZY_FROM_CONTROLLER');
if (!adapter.includes('ensurePdfLibraries')) violations.push('PDF_LIBRARY_LAZY_CONTRACT_MISSING');
if (!adapter.includes('doc.save')) violations.push('PDF_DOWNLOAD_NOT_TRIGGERED');
if (!reportModel.includes('selectPdfFinancialReport')) violations.push('CANONICAL_SELECTOR_NOT_USED');

forbid('reportModel', reportModel, [/document\./, /window\./, /globalThis\./, /dataSdk/, /firebase/i, /jspdf/i, /autoTable/i]);
forbid('controller', controller, [/document\./, /window\./, /globalThis\.financeApp/, /dataSdk/, /firebase/i, /jspdf/i, /autoTable/i]);
forbid('presenter', presenter, [/dataSdk/, /firebase/i, /jspdf/i, /autoTable/i]);
forbid('adapter', adapter, [/dataSdk/, /firebase/i, /financeApp/, /selectPdfFinancialReport/, /buildDashboardReadModel/, /buildHourPeriodSummary/, /calcularINSS|calcularIRRF|calcularLiquido|CreateInstallmentSeries|CreateRecurrenceSeries|calculateWorkSession/i]);
forbid('entry', entryText, [/createReportExportController/, /buildFinancialReportReadModel/, /PDF_LIBRARY_NOT_READY/, /jspdf\.umd\.min\.js/, /autoTable\(/]);

const report = {
  ok: violations.length === 0,
  wrote: false,
  violations,
  globals: globalCount,
  classicScripts,
  entryBudget: 430080,
  entry: entry ? { file: entry.file, bytes: entry.bytes } : null
};

console.log(JSON.stringify(report, null, 2));
if (violations.length) process.exit(1);
