import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { analyzeLegacyLoader } from './analyze-legacy-loader.mjs';

const ENTRY_BUDGET_BYTES = 430080;
const GLOBALS_MAX = 50;
const CLASSIC_MAX = 23;
const EVAL_MAX = 23;
const REQUIRED_BOOTSTRAP_MARKS = [
  'finance-app-entry-start',
  'finance-bridges-ready',
  'finance-legacy-loader-start',
  'finance-legacy-loader-end',
  'finance-auth-init-start',
  'finance-auth-init-end',
  'finance-shell-ready',
  'finance-first-screen-ready',
  'finance-bootstrap-complete'
];

const LAZY_LIBRARY_PATTERNS = [
  'xlsx.full.min.js',
  'cdnjs.cloudflare.com/ajax/libs/xlsx',
  'XLSX.read',
  'jspdf.umd.min.js',
  'jspdf.plugin.autotable.min.js',
  'new jsPDF',
  'autoTable(',
  'PDF_LIBRARY_NOT_READY',
  'buildImportPreviewReadModel',
  'createImportController',
  'buildBackupPreviewReadModel',
  'createBackupController',
  'buildFinancialReportReadModel',
  'createReportExportController'
];

const FORBIDDEN_SOURCE_PATTERNS = [
  { file: 'src/legacy/classicScripts.js', pattern: 'src/services/libraryLoader.global.js', code: 'LIBRARY_LOADER_GLOBAL_REINTRODUCED' },
  { file: 'src/services/libraryLoader.js', pattern: "applicationError.js", code: 'APPLICATION_ERROR_EAGER_IN_LIBRARY_LOADER' },
  { file: 'src/legacy/libraryLoaderBridge.js', pattern: "from '../services/libraryLoader.js'", code: 'LIBRARY_LOADER_STATIC_IMPORT_IN_BRIDGE' }
];

function read(file) {
  return readFileSync(file, 'utf8');
}

function assets() {
  return readdirSync('dist/assets')
    .filter((name) => name.endsWith('.js'))
    .map((name) => ({ file: `dist/assets/${name}`, bytes: statSync(`dist/assets/${name}`).size, text: read(`dist/assets/${name}`) }));
}

function entryChunk(chunks) {
  const html = read('dist/index.html');
  const entryAsset = html.match(/<script[^>]+type="module"[^>]+src="\/?(assets\/app-[^"]+\.js)"/)?.[1] || '';
  return chunks.find((chunk) => chunk.file === `dist/${entryAsset}`)
    || chunks.find((chunk) => /assets\/app-[A-Za-z0-9_-]+\.js$/.test(chunk.file) && !chunk.file.includes('app-resilience-'));
}

function countGlobals() {
  const inventory = read('docs/global-api-inventory.md');
  return (inventory.match(/^\| `[^`]+` \|/gm) || []).length;
}

function sourceHasEval(file) {
  return /\beval\s*\(/.test(read(file));
}

function sourceHasNewFunction(file) {
  return /new\s+Function\s*\(/.test(read(file));
}

const chunks = assets();
const entry = entryChunk(chunks);
const entryText = entry?.text || '';
const appSource = read('src/app.js');
const classicSource = read('src/legacy/classicScripts.js');
const monitorSource = read('src/services/performanceMonitor.js');
const benchmarkSource = read('scripts/bootstrap-benchmark.mjs');
const legacy = analyzeLegacyLoader();
const globals = countGlobals();
const violations = [];

if (!entry) violations.push('ENTRY_CHUNK_NOT_FOUND');
if (entry && entry.bytes > ENTRY_BUDGET_BYTES) violations.push(`ENTRY_BUDGET_EXCEEDED:${entry.bytes}`);
if (legacy.classicScriptsAfter > CLASSIC_MAX) violations.push(`CLASSIC_SCRIPTS_EXCEEDED:${legacy.classicScriptsAfter}`);
if (legacy.evalExecutedAfter > EVAL_MAX) violations.push(`EVAL_EXECUTED_EXCEEDED:${legacy.evalExecutedAfter}`);
if (globals > GLOBALS_MAX) violations.push(`GLOBALS_EXCEEDED:${globals}`);
if (legacy.newFunction?.length) violations.push('NEW_FUNCTION_DETECTED_BY_LEGACY_ANALYZER');
if (legacy.newEval?.length) violations.push('NEW_EVAL_DETECTED_BY_LEGACY_ANALYZER');
if (!existsSync('docs/bootstrap-performance-baseline.json')) violations.push('BOOTSTRAP_BASELINE_MISSING');
if (benchmarkSource.includes('writeFile') || benchmarkSource.includes('appendFile')) violations.push('BOOTSTRAP_BENCHMARK_MAY_WRITE_BASELINE');
if (!benchmarkSource.includes("gateMetrics: ['app_bootstrap_ms', 'first_screen_ready_ms']")) violations.push('APP_BOOTSTRAP_GATE_NOT_EXPLICIT');
if (benchmarkSource.includes("gateMetrics: ['document_load_ms'")) violations.push('DOCUMENT_LOAD_USED_AS_GATE');
if (!benchmarkSource.includes("'document_load_ms', 'environment_overhead_ms'")) violations.push('DOCUMENT_LOAD_NOT_INFORMATIONAL');

REQUIRED_BOOTSTRAP_MARKS.forEach((mark) => {
  if (!appSource.includes(mark) && !classicSource.includes(mark) && !monitorSource.includes(mark)) {
    violations.push(`BOOTSTRAP_MARK_MISSING:${mark}`);
  }
});

LAZY_LIBRARY_PATTERNS.forEach((pattern) => {
  if (entryText.includes(pattern)) violations.push(`LAZY_PATTERN_IN_ENTRY:${pattern}`);
});

FORBIDDEN_SOURCE_PATTERNS.forEach(({ file, pattern, code }) => {
  if (read(file).includes(pattern)) violations.push(`${code}:${file}`);
});

[
  'src/services/libraryLoader.js',
  'src/legacy/libraryLoaderBridge.js'
].forEach((file) => {
  if (sourceHasEval(file)) violations.push(`SOURCE_EVAL:${file}`);
  if (sourceHasNewFunction(file)) violations.push(`SOURCE_NEW_FUNCTION:${file}`);
});

const report = {
  ok: violations.length === 0,
  violations,
  classicScripts: legacy.classicScriptsAfter,
  evalExecutedScripts: legacy.evalExecutedAfter,
  globals,
  entryBytes: entry?.bytes || 0,
  entryBudgetBytes: ENTRY_BUDGET_BYTES,
  lazyLibraries: ['xlsx', 'pdf', 'firebase'],
  bootstrapLibraries: ['chart', 'lucide'],
  wrote: false
};

console.log(JSON.stringify(report, null, 2));
if (!report.ok) process.exit(1);
