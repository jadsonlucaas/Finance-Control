import { readdirSync, readFileSync, statSync } from 'node:fs';
import { analyzeLegacyLoader } from './analyze-legacy-loader.mjs';

const ALLOWED_CDN_URLS = [
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js'
];

function read(file) {
  return readFileSync(file, 'utf8');
}

function assets() {
  try {
    return readdirSync('dist/assets')
      .filter((name) => name.endsWith('.js'))
      .map((name) => ({ file: `dist/assets/${name}`, bytes: statSync(`dist/assets/${name}`).size, text: read(`dist/assets/${name}`) }));
  } catch {
    return [];
  }
}

function entryChunk(chunks) {
  const html = read('dist/index.html');
  const entryAsset = html.match(/<script[^>]+type="module"[^>]+src="\/?(assets\/app-[^"]+\.js)"/)?.[1] || '';
  return chunks.find((chunk) => chunk.file === `dist/${entryAsset}`)
    || chunks.find((chunk) => /assets\/app-[A-Za-z0-9_-]+\.js$/.test(chunk.file) && !chunk.file.includes('app-resilience-'));
}

function findSourceEval() {
  const files = [
    'src/services/libraryLoader.js',
    'src/legacy/libraryLoaderBridge.js',
    'src/services/localVisualLibraries.js'
  ];
  return files.filter((file) => /\beval\s*\(/.test(read(file)));
}

function findSourceNewFunction() {
  const files = [
    'src/services/libraryLoader.js',
    'src/legacy/libraryLoaderBridge.js',
    'src/services/localVisualLibraries.js'
  ];
  return files.filter((file) => /new\s+Function\s*\(/.test(read(file)));
}

const chunks = assets();
const entry = entryChunk(chunks);
const entryText = entry?.text || '';
const libraryLoaderSource = read('src/services/libraryLoader.js');
const bridgeSource = read('src/legacy/libraryLoaderBridge.js');
const classicSource = read('src/legacy/classicScripts.js');
const importActiveSource = read('src/ui/imports/importActiveUi.js');
const pdfAdapterSource = read('src/ui/reports/pdfAdapter.js');
const localVisualSource = read('src/services/localVisualLibraries.js');
const cdnUrls = [...new Set([...libraryLoaderSource.matchAll(/https:\/\/cdnjs\.cloudflare\.com\/[^'"]+/g)].map((match) => match[0]))];
const violations = [];

if (classicSource.includes('src/services/libraryLoader.global.js')) violations.push('LIBRARY_LOADER_GLOBAL_STILL_IN_CLASSIC_LOADER');
if (!classicSource.includes("import('./libraryLoaderBridge.js')")) violations.push('LIBRARY_BRIDGE_NOT_DYNAMICALLY_INSTALLED');
if (!bridgeSource.includes('defineLegacyGlobalBridge')) violations.push('LIBRARY_BRIDGE_NOT_USING_BRIDGE_REGISTRY');
if (bridgeSource.includes("from '../services/libraryLoader.js'")) violations.push('LIBRARY_LOADER_STATIC_IMPORT_IN_BRIDGE');
if (!libraryLoaderSource.includes('libraryPromises')) violations.push('PROMISE_CACHE_MISSING');
if (!libraryLoaderSource.includes('catch((error)') || !libraryLoaderSource.includes('libraryPromises.delete')) violations.push('RETRY_AFTER_FAILURE_MISSING');
if (!libraryLoaderSource.includes("code: 'LAZY_LOAD_FAILED'")) violations.push('LAZY_LOAD_APPLICATION_ERROR_MISSING');
if (libraryLoaderSource.includes('applicationError.js')) violations.push('APPLICATION_ERROR_EAGER_IN_LIBRARY_LOADER');
if (!importActiveSource.includes('ensureSpreadsheetLibrary')) violations.push('SPREADSHEET_LAZY_HELPER_NOT_USED');
if (!pdfAdapterSource.includes('ensurePdfLibraries')) violations.push('PDF_LAZY_HELPER_NOT_USED');
if (!localVisualSource.includes("chart.js/auto")) violations.push('CHART_LOCAL_IMPORT_MISSING');
if (/xlsx\.full\.min\.js|jspdf\.umd\.min\.js|XLSX\.read|new jsPDF|autoTable\(/.test(entryText)) violations.push('HEAVY_LIBRARY_IN_ENTRY');
if (cdnUrls.some((url) => !ALLOWED_CDN_URLS.includes(url))) violations.push('NEW_CDN_URL_FOUND');
if (analyzeLegacyLoader().classicScriptsAfter > 23) violations.push('CLASSIC_LOADER_LIMIT_NOT_REDUCED');

const report = {
  ok: violations.length === 0,
  violations,
  libraries: {
    chart: { source: 'src/services/localVisualLibraries.js', bootstrap: true, lazy: false, loader: 'ES import chart.js/auto' },
    xlsx: { source: 'src/services/libraryLoader.js', bootstrap: false, lazy: true, loader: 'ensureSpreadsheetLibrary' },
    pdf: { source: 'src/services/libraryLoader.js', bootstrap: false, lazy: true, loader: 'ensurePdfLibraries' },
    firebase: { source: 'src/services/installFirebaseServices.js', bootstrap: false, lazy: true, loader: 'installFirebaseServicesWhenReady' }
  },
  lazyLibraries: ['xlsx', 'pdf', 'firebase'],
  bootstrapLibraries: ['chart', 'lucide'],
  newEval: findSourceEval(),
  newFunction: findSourceNewFunction(),
  cdnUrls,
  classicScriptsAfter: analyzeLegacyLoader().classicScriptsAfter,
  evalExecutedScriptsAfter: analyzeLegacyLoader().evalExecutedAfter,
  wrote: false
};

if (report.newEval.length) report.violations.push('NEW_EVAL_IN_LIBRARY_LOADERS');
if (report.newFunction.length) report.violations.push('NEW_FUNCTION_IN_LIBRARY_LOADERS');
report.ok = report.violations.length === 0;

console.log(JSON.stringify(report, null, 2));
if (!report.ok) process.exit(1);
