import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = process.cwd();
const LOADER_PATH = path.join(ROOT, 'src', 'legacy', 'classicScripts.js');
const BASELINE_CLASSIC_SCRIPTS = [
  'src/legacy-globals.js',
  'src/services/libraryLoader.global.js',
  'src/services/performanceMonitor.global.js',
  'src/ui/legacy-ui.js',
  'src/legacy/inline/part-03.js',
  'src/legacy/inline/part-04.js',
  'src/legacy/inline/part-05.js',
  'src/legacy/inline/part-06.js',
  'src/legacy/inline/part-07.js',
  'src/legacy/inline/part-08.js',
  'src/legacy/inline/part-09.js',
  'src/legacy/inline/part-10.js',
  'src/legacy/inline/part-11.js',
  'src/legacy/inline/part-12.js',
  'src/legacy/inline/part-13.js',
  'src/legacy/inline/part-14.js',
  'src/legacy/inline/part-15.js',
  'src/legacy/inline/part-16.js',
  'src/legacy/inline/part-17.js',
  'src/legacy/inline/part-18.js',
  'src/legacy/inline/part-19.js',
  'src/legacy/inline/part-20.js',
  'src/legacy/inline/part-21.js',
  'src/legacy/inline/part-22.js',
  'src/legacy/inline/part-23.js',
  'src/legacy/inline/part-24.js',
  'src/legacy/inline/part-25.js',
  'src/legacy/inline/part-26.js',
  'src/legacy/inline/part-27.js',
  'src/legacy/inline/part-28.js',
  'src/legacy/inline/part-29.js',
  'src/legacy/inline/part-30.js',
  'src/legacy/inline/part-31.js'
];
const BASELINE_CLASSIC_COUNT = 33;
const BASELINE_EVAL_EXECUTED_COUNT = 33;
const BASELINE_LEGACY_BYTES = 776933;
const TARGET_CLASSIC_COUNT_MAX = 23;
const TARGET_EVAL_EXECUTED_COUNT_MAX = 23;
const SAFE_REMOVED_SCRIPTS = [
  'src/legacy-globals.js',
  'src/services/libraryLoader.global.js',
  'src/services/performanceMonitor.global.js',
  'src/ui/legacy-ui.js',
  'src/legacy/inline/part-21.js',
  'src/legacy/inline/part-22.js',
  'src/legacy/inline/part-23.js',
  'src/legacy/inline/part-24.js',
  'src/legacy/inline/part-25.js',
  'src/legacy/inline/part-30.js',
  'src/legacy/inline/part-31.js'
];

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

function normalizeSlash(value = '') {
  return value.replace(/\\/g, '/');
}

function resolveLegacyEntry(entry = '') {
  const withoutSrc = entry.replace(/^src\//, '');
  return path.join(ROOT, 'src', withoutSrc);
}

function countMatches(source = '', pattern) {
  return [...source.matchAll(pattern)].length;
}

const loaderSource = read(LOADER_PATH);
const entries = [...loaderSource.matchAll(/\[\s*['"]([^'"]+)['"]\s*,\s*\(\)\s*=>\s*import\([^)]*\?raw['"]\)\s*\]/g)]
  .map((match) => match[1]);

const stats = entries.map((entry) => {
  const file = resolveLegacyEntry(entry);
  const exists = fs.existsSync(file);
  const source = exists ? read(file) : '';
  return {
    script: entry,
    exists,
    bytes: exists ? fs.statSync(file).size : 0,
    lines: exists ? source.split(/\r?\n/).length : 0,
    windowAssignments: countMatches(source, /\bwindow\.[A-Za-z_$][\w$]*\s*=/g),
    functionDeclarations: countMatches(source, /(?:^|\n)\s*(?:async\s+)?function\s+[A-Za-z_$][\w$]*\s*\(/g),
    directDataSdkCalls: countMatches(source, /\bdataSdk\.(create|update|delete|upsert|createMany)\s*\(/g),
    documentReferences: countMatches(source, /\bdocument\./g),
    windowReferences: countMatches(source, /\bwindow\./g)
  };
});

const total = stats.reduce((acc, item) => ({
  bytes: acc.bytes + item.bytes,
  lines: acc.lines + item.lines,
  windowAssignments: acc.windowAssignments + item.windowAssignments,
  functionDeclarations: acc.functionDeclarations + item.functionDeclarations,
  directDataSdkCalls: acc.directDataSdkCalls + item.directDataSdkCalls,
  documentReferences: acc.documentReferences + item.documentReferences,
  windowReferences: acc.windowReferences + item.windowReferences
}), {
  bytes: 0,
  lines: 0,
  windowAssignments: 0,
  functionDeclarations: 0,
  directDataSdkCalls: 0,
  documentReferences: 0,
  windowReferences: 0
});

function walk(entry) {
  const full = path.join(ROOT, entry);
  if (!fs.existsSync(full)) return [];
  const stat = fs.statSync(full);
  if (stat.isFile()) return [full];
  return fs.readdirSync(full, { withFileTypes: true }).flatMap((dirent) => {
    if (['node_modules', 'dist', 'coverage', 'test-results'].includes(dirent.name)) return [];
    return walk(path.relative(ROOT, path.join(full, dirent.name)));
  });
}

function sourceFiles(entry) {
  return walk(entry).filter((file) => /\.(js|mjs)$/.test(file));
}

function findRuntimeReferences(needle, exclude = new Set()) {
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(escaped);
  return [
    ...sourceFiles('src'),
    path.join(ROOT, 'index.html')
  ].filter((file) => {
    const rel = normalizeSlash(path.relative(ROOT, file));
    if (exclude.has(rel)) return false;
    return pattern.test(read(file));
  }).map((file) => normalizeSlash(path.relative(ROOT, file)));
}

function findLayerViolations() {
  return sourceFiles('src').map((file) => {
    const rel = normalizeSlash(path.relative(ROOT, file));
    const source = read(file);
    const importsLegacy = /from\s+['"][^'"]*legacy\//.test(source) || /import\(['"][^'"]*legacy\//.test(source);
    const importsPart = /from\s+['"][^'"]*part-\d+\.js/.test(source) || /import\(['"][^'"]*part-\d+\.js/.test(source);
    return { rel, importsLegacy, importsPart };
  }).filter((item) =>
    ((item.rel.startsWith('src/application/') || item.rel.startsWith('src/domain/')) && item.importsLegacy) ||
    (!item.rel.startsWith('src/legacy/') && item.importsPart)
  );
}

function findEvalViolations() {
  return sourceFiles('src').filter((file) => {
    const rel = normalizeSlash(path.relative(ROOT, file));
    if (rel === 'src/legacy/classicScripts.js') return false;
    return /\beval\s*\(/.test(read(file));
  }).map((file) => normalizeSlash(path.relative(ROOT, file)));
}

function findNewFunctionViolations() {
  return sourceFiles('src').filter((file) => /new\s+Function\s*\(/.test(read(file)))
    .map((file) => normalizeSlash(path.relative(ROOT, file)));
}

function findLegacyUiImportViolations() {
  return sourceFiles('src').filter((file) => {
    const rel = normalizeSlash(path.relative(ROOT, file));
    if (rel === 'src/legacy/classicScripts.js' || rel === 'src/ui/legacy-ui.js') return false;
    return /legacy-ui\.js/.test(read(file));
  }).map((file) => normalizeSlash(path.relative(ROOT, file)));
}

const removedScripts = BASELINE_CLASSIC_SCRIPTS.filter((script) => !entries.includes(script));
const removedScriptConsumers = removedScripts.map((script) => ({
  script,
  consumers: findRuntimeReferences(script, new Set([
    'src/legacy/classicScripts.js',
    'scripts/analyze-legacy-loader.mjs',
    'scripts/build-legacy-consumer-graph.mjs',
    script
  ]))
})).filter((item) => item.consumers.length);

const evalViolations = findEvalViolations();
const newFunctionViolations = findNewFunctionViolations();
const layerViolations = findLayerViolations();
const legacyUiImportViolations = findLegacyUiImportViolations();
const unexpectedRemovedScripts = removedScripts.filter((script) => !SAFE_REMOVED_SCRIPTS.includes(script));
const globalsInventory = read(path.join(ROOT, 'docs', 'global-api-inventory.md'));
const globals = [...globalsInventory.matchAll(/\| `([^`]+)` \|/g)].length;
const violations = [
  entries.length > TARGET_CLASSIC_COUNT_MAX ? 'CLASSIC_SCRIPTS_INCREASED' : '',
  entries.length > TARGET_EVAL_EXECUTED_COUNT_MAX ? 'EVAL_EXECUTED_SCRIPTS_INCREASED' : '',
  total.bytes > BASELINE_LEGACY_BYTES ? 'LEGACY_BYTES_INCREASED' : '',
  evalViolations.length ? 'NEW_EVAL_OUTSIDE_LEGACY_LOADER' : '',
  newFunctionViolations.length ? 'NEW_FUNCTION_FOUND' : '',
  layerViolations.length ? 'LAYER_IMPORTS_LEGACY' : '',
  entries.includes('src/ui/legacy-ui.js') ? 'LEGACY_UI_STILL_IN_CLASSIC_LOADER' : '',
  legacyUiImportViolations.length ? 'MODERN_MODULE_IMPORTS_LEGACY_UI' : '',
  unexpectedRemovedScripts.length ? 'UNEXPECTED_REMOVED_SCRIPT' : '',
  removedScriptConsumers.length ? 'REMOVED_SCRIPT_STILL_REFERENCED_AT_RUNTIME' : '',
  globals > 50 ? 'GLOBALS_INCREASED' : ''
].filter(Boolean);

export const result = {
  loader: normalizeSlash(path.relative(ROOT, LOADER_PATH)),
  classicScriptsBefore: BASELINE_CLASSIC_COUNT,
  classicScriptsAfter: entries.length,
  evalExecutedBefore: BASELINE_EVAL_EXECUTED_COUNT,
  evalExecutedAfter: entries.length,
  classicScriptsMax: TARGET_CLASSIC_COUNT_MAX,
  evalExecutedScriptsMax: TARGET_EVAL_EXECUTED_COUNT_MAX,
  legacyBytesBefore: BASELINE_LEGACY_BYTES,
  legacyBytesAfter: total.bytes,
  removedScripts,
  migratedScripts: [
    'src/legacy/globalBridge.js',
    'src/legacy/libraryLoaderBridge.js',
    'src/services/libraryLoader.js',
    'src/services/performanceMonitor.js',
    'src/ui/legacy-ui.js'
  ],
  blockedScripts: BASELINE_CLASSIC_SCRIPTS.filter((script) => entries.includes(script)),
  globals,
  newEval: evalViolations,
  newFunction: newFunctionViolations,
  legacyUiImportViolations,
  layerViolations,
  removedScriptConsumers,
  ok: violations.length === 0,
  violations,
  classicScripts: entries.length,
  evalExecutedScripts: entries.length,
  loaderEvalOccurrences: countMatches(loaderSource, /\beval\b/g),
  loaderNewFunctionOccurrences: countMatches(loaderSource, /new\s+Function\s*\(/g),
  total,
  scripts: stats
};

export function analyzeLegacyLoader() {
  return result;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(result, null, 2));
  if (process.argv.includes('--check') && !result.ok) process.exit(1);
}
