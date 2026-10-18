import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyzeLegacyLoader } from './analyze-legacy-loader.mjs';

const DEFAULT_MODERN_CONSUMER_ENTRIES = [
  'src/ui/importacao.js',
  'src/ui/monthDetail/monthDetailEvents.js',
  'src/ui/records/financialCrudControllerInstaller.js',
  'src/ui/imports',
  'src/ui/monthDetail',
  'src/ui/records',
  'src/ui/settings',
  'src/ui/admin',
  'src/ui/planner',
  'src/ui/hours',
  'src/ui/reports',
  'src/ui/backup'
];
const MODERN_EXCLUDE = new Set(['src/ui/legacy-ui.js']);
const CRITICAL_CLASSIC_FILES = [
  'src/legacy/inline/part-08.js',
  'src/legacy/inline/part-14.js'
];
const RUNTIME_BRIDGE_FILES = [
  'src/legacy/inline/part-03.js',
  'src/legacy/inline/part-07.js',
  'src/legacy/inline/part-08.js',
  'src/legacy/inline/part-14.js',
  'src/legacy/inline/part-29.js'
];
const NAVIGATION_COORDINATOR_FILE = 'src/ui/navigation/navigationCoordinator.js';

function normalizeSlash(value = '') {
  return value.replace(/\\/g, '/');
}

function read(file, sources = null) {
  if (sources && Object.prototype.hasOwnProperty.call(sources, file)) return sources[file];
  return fs.readFileSync(file, 'utf8');
}

function exists(file, sources = null) {
  if (sources) return Object.prototype.hasOwnProperty.call(sources, file);
  return fs.existsSync(file);
}

function walk(entry) {
  if (!fs.existsSync(entry)) return [];
  const stat = fs.statSync(entry);
  if (stat.isFile()) return [entry];
  return fs.readdirSync(entry, { withFileTypes: true }).flatMap((dirent) => {
    const full = path.join(entry, dirent.name);
    return dirent.isDirectory() ? walk(full) : [full];
  });
}

function sourceFiles(entries, sources = null) {
  if (sources) {
    const sourceKeys = Object.keys(sources).map(normalizeSlash);
    return entries.flatMap((entry) => {
      const normalized = normalizeSlash(entry);
      return sourceKeys.filter((file) => file === normalized || file.startsWith(`${normalized}/`));
    });
  }
  return entries.flatMap((entry) => walk(entry))
    .filter((file) => /\.(js|mjs)$/.test(file))
    .map((file) => normalizeSlash(file));
}

function lineNumber(source, index) {
  return source.slice(0, index).split(/\r?\n/).length;
}

function refsByPattern(file, source, pattern) {
  return [...source.matchAll(pattern)].map((match) => ({
    file,
    index: match.index,
    line: lineNumber(source, match.index),
    match: match[0],
    context: source.slice(
      Math.max(0, source.lastIndexOf('\n', match.index) + 1),
      source.indexOf('\n', match.index) === -1 ? source.length : source.indexOf('\n', match.index)
    )
  }));
}

function refsToStrings(refs = []) {
  return refs.map((ref) => `${ref.file}:${ref.line}:${ref.match}`);
}

function refsToDetailedStrings(refs = []) {
  return refs.map((ref) => `${ref.file}:${ref.line}:${ref.match}${ref.kind ? `:${ref.kind}` : ''}`);
}

function directFinanceUiRefs(file, source) {
  return refsByPattern(
    file,
    source,
    /\b(?:window|globalThis)\.financeUI\b|\b(?:window|globalThis)\[['"]financeUI['"]\]|\b(?<![.\w$])financeUI(?![\w$])/g
  ).filter((ref) => !/financeUiAdapters/.test(ref.match))
    .map((ref) => ({
      ...ref,
      kind: /defineLegacyGlobalBridge|target\.financeUI|createLegacyUiBridge/.test(ref.context || '')
        ? 'definition'
        : 'consumer'
    }));
}

function adapterRefs(file, source) {
  return refsByPattern(
    file,
    source,
    /\b(?:window|globalThis)\.financeApp\.financeUiAdapters\b|\b(?:window|globalThis)\.financeApp\[['"]financeUiAdapters['"]\]|\bfinanceApp\.financeUiAdapters\b|\bfinanceApp\[['"]financeUiAdapters['"]\]|\b(?<![.\w$])financeUiAdapters(?![\w$])/g
  ).map((ref) => ({
    ...ref,
    kind: /(?:createFinanceUiConsumerAdapters|installFinanceUiConsumerAdapters|target\.financeApp\.financeUiAdapters)/.test(ref.context || '')
      ? 'definition'
      : 'consumer'
  }));
}

function aliasRefs(file, source) {
  const refs = [
    ...refsByPattern(file, source, /\b(?:const|let|var)\s+[A-Za-z_$][\w$]*\s*=\s*(?:window|globalThis)\.financeUI\b/g),
    ...refsByPattern(file, source, /\b(?:const|let|var)\s+[A-Za-z_$][\w$]*\s*=\s*(?:window|globalThis)\.financeUI\.[A-Za-z_$][\w$]*\b/g),
    ...refsByPattern(file, source, /\b(?:const|let|var)\s*\{[^}]+\}\s*=\s*(?:window|globalThis)\.financeUI\b/g),
    ...refsByPattern(file, source, /\b(?:window|globalThis)\[['"]financeUI['"]\]/g),
    ...refsByPattern(file, source, /\b(?:const|let|var)\s+[A-Za-z_$][\w$]*\s*=\s*(?:window|globalThis)\.financeApp\.financeUiAdapters\b/g),
    ...refsByPattern(file, source, /\b(?:const|let|var)\s+[A-Za-z_$][\w$]*\s*=\s*(?:window|globalThis)\.financeApp\.financeUiAdapters\.[A-Za-z_$][\w$]*\b/g),
    ...refsByPattern(file, source, /\b(?:const|let|var)\s*\{[^}]+\}\s*=\s*(?:window|globalThis)\.financeApp\.financeUiAdapters\b/g),
    ...refsByPattern(file, source, /\b(?:window|globalThis)\.financeApp\[['"]financeUiAdapters['"]\]/g)
  ];
  return refs.map((ref) => ({ ...ref, kind: 'alias' }));
}

function groupCounts(refs = []) {
  return refs.reduce((acc, ref) => {
    acc[ref.file] = (acc[ref.file] || 0) + 1;
    return acc;
  }, {});
}

function navigationBridgeRefs(file, source) {
  return refsByPattern(
    file,
    source,
    /\b(?:window|globalThis)\.financeUI\.activateTab\b|\bfinanceUI\.activateTab\b|\b(?:window|globalThis)\.financeApp\.financeUiAdapters\.activateTab\b|\bfinanceApp\.financeUiAdapters\.activateTab\b|\bfinanceUiAdapters\.activateTab\b/g
  );
}

function globalInventoryCount(source = '') {
  return (source.match(/^\| `[^`]+` \|/gm) || []).length;
}

function nestedExports(source = '') {
  const objectMatch = source.match(/export function createFinanceUiConsumerAdapters[\s\S]*?return\s+\{([\s\S]*?)\};\n\}/);
  if (!objectMatch) return [];
  return [...objectMatch[1].matchAll(/^\s*([A-Za-z_$][\w$]*)\s*:/gm)].map((match) => match[1]).sort();
}

function installsFinanceUiGlobal(source = '') {
  return /defineLegacyGlobalBridge\s*\(\s*target\s*,\s*['"]financeUI['"]/.test(source)
    || /\b(?:window|globalThis|target)\.financeUI\s*=/.test(source);
}

function installsFinanceUiAdapters(source = '') {
  return /\btarget\.financeApp\.financeUiAdapters\s*=/.test(source);
}

function defaultSources() {
  const entries = [
    ...DEFAULT_MODERN_CONSUMER_ENTRIES,
    ...RUNTIME_BRIDGE_FILES,
    NAVIGATION_COORDINATOR_FILE,
    'src/ui/legacy-ui.js'
  ];
  return Object.fromEntries(sourceFiles(entries).map((file) => [file, read(file)]));
}

function runtimeConsumerFiles(refs = []) {
  return [...new Set(refs
    .filter((ref) => ref.kind !== 'definition')
    .map((ref) => ref.file)
    .filter((file) => RUNTIME_BRIDGE_FILES.includes(file)))]
    .sort();
}

export function analyzeFinanceUiConsumers(options = {}) {
  const sources = options.sources || defaultSources();
  const globalInventory = options.globalInventory || read('docs/global-api-inventory.md');
  const loader = options.loader || analyzeLegacyLoader();
  const files = Object.keys(sources).map(normalizeSlash).sort();

  const allDirectRefs = files.flatMap((file) => directFinanceUiRefs(file, sources[file]));
  const allAdapterRefs = files.flatMap((file) => adapterRefs(file, sources[file]));
  const allAliasRefs = files.flatMap((file) => aliasRefs(file, sources[file]));
  const directFinanceUiConsumerRefs = allDirectRefs.filter((ref) => ref.kind !== 'definition');
  const financeUiAdapterConsumerRefs = allAdapterRefs.filter((ref) => ref.kind !== 'definition');
  const bridgeDefinitionRefs = [
    ...allDirectRefs.filter((ref) => ref.kind === 'definition'),
    ...allAdapterRefs.filter((ref) => ref.kind === 'definition')
  ];

  const modernFiles = sourceFiles(options.modernEntries || DEFAULT_MODERN_CONSUMER_ENTRIES, options.sources || null)
    .filter((file) => !MODERN_EXCLUDE.has(file));
  const modernGlobalUiConsumers = modernFiles.flatMap((file) => {
    if (!exists(file, sources)) return [];
    const source = sources[file];
    return [
      ...directFinanceUiRefs(file, source),
      ...adapterRefs(file, source),
      ...aliasRefs(file, source)
    ];
  });

  const directFinanceUiCallsByFile = groupCounts(directFinanceUiConsumerRefs);
  const adapterAliasCallsByFile = groupCounts(financeUiAdapterConsumerRefs);
  const unresolvedDynamicConsumers = refsToStrings(allAliasRefs);
  const blockedCalls = CRITICAL_CLASSIC_FILES.flatMap((file) => {
    const source = sources[file];
    if (!source) return [];
    return directFinanceUiRefs(file, source).map((ref) => ({
      ...ref,
      reason: file.endsWith('part-08.js')
        ? 'switchTab navigation remains coupled to classic history/router lifecycle'
        : 'no direct financeUI calls remain in part-14.js'
    }));
  }).filter((ref) => ref.match);
  const navigationBridgeConsumers = navigationBridgeRefs(
    'src/legacy/inline/part-08.js',
    sources['src/legacy/inline/part-08.js'] || ''
  );
  const remainingRuntimeConsumers = [
    ...runtimeConsumerFiles(directFinanceUiConsumerRefs),
    ...runtimeConsumerFiles(financeUiAdapterConsumerRefs),
    ...runtimeConsumerFiles(allAliasRefs)
  ].filter((file, index, list) => list.indexOf(file) === index).sort();
  const navigationCanonicalImplementation = 'src/ui/navigationTabs.js:activateTab';
  const part08Source = sources['src/legacy/inline/part-08.js'] || '';
  const navigationCoordinatorSource = sources[NAVIGATION_COORDINATOR_FILE] || '';
  const navigationCoordinatorUsesCanonical = /from\s+['"]\.\.\/navigationTabs\.js['"]/.test(navigationCoordinatorSource)
    && /\bactivateTab\b/.test(navigationCoordinatorSource)
    && /\binstallNavigationCoordinator\b/.test(navigationCoordinatorSource);
  const part08HasClassicVisualActivation = /activateLegacyTabView/.test(part08Source)
    || /querySelectorAll\(['"]#main-tabs button['"]\)/.test(part08Source);
  const navigationEvidenceStatus = navigationCoordinatorUsesCanonical && !part08HasClassicVisualActivation
    ? 'ok: switchTab bridge is coordinated by src/ui/navigation/navigationCoordinator.js and visual activation delegates to src/ui/navigationTabs.js:activateTab'
    : 'blocked: navigation still lacks ES coordinator evidence or part-08 still contains duplicated visual tab activation';
  const migratedPresentationEntrypoints = [
    'src/legacy/inline/part-08.js:renderConfiguracoes people/macro DOM setHtml/setHidden -> local DOM',
    'src/legacy/inline/part-14.js:renderConfiguracoes people DOM setHtml/setHidden -> local DOM',
    'src/legacy/inline/part-08.js:switchTab visual activation classic helper -> ES navigation coordinator -> navigationTabs.activateTab'
  ];
  const globals = globalInventoryCount(globalInventory);
  const adapterSource = sources['src/ui/legacy-ui.js'] || read('src/ui/legacy-ui.js');
  const financeUiInstalled = installsFinanceUiGlobal(adapterSource);
  const financeUiAdaptersInstalled = installsFinanceUiAdapters(adapterSource);
  const adapterForbiddenPatterns = [
    /\bdataSdk\b/,
    /\bfirebase\b/i,
    /\bauth(Sdk)?\b/i,
    /\bFirestore\b/,
    /\bcalcular[A-Za-z0-9_$]*\b/,
    /\broundCurrency\b/,
    /\bpercentage_(base|rule|exit)\b/i,
    /\b(create|update|delete|upsert)Record\b/,
    /\btaxEngine\b/,
    /\bworkSessionEngine\b/
  ];
  const adapterViolations = adapterForbiddenPatterns
    .filter((pattern) => pattern.test(adapterSource))
    .map((pattern) => String(pattern));
  const newGlobalViolation = /\bwindow\.[A-Za-z_$][\w$]*\s*=/.test(adapterSource);
  const violations = [
    modernGlobalUiConsumers.length ? 'MODERN_GLOBAL_UI_CONSUMERS_REMAIN' : '',
    navigationBridgeConsumers.length ? 'NAVIGATION_STILL_USES_GLOBAL_UI_BRIDGE' : '',
    navigationCoordinatorUsesCanonical && !part08HasClassicVisualActivation ? '' : 'NAVIGATION_ES_COORDINATOR_NOT_PROVEN',
    adapterViolations.length ? 'ADAPTER_FORBIDDEN_DOMAIN_OR_FIREBASE_REFERENCE' : '',
    newGlobalViolation ? 'ADAPTER_CREATES_WINDOW_GLOBAL' : '',
    globals > 50 ? 'GLOBALS_INCREASED' : '',
    loader.classicScripts > 22 ? 'CLASSIC_SCRIPTS_INCREASED' : '',
    loader.evalExecutedScripts > 22 ? 'EVAL_EXECUTED_SCRIPTS_INCREASED' : '',
    loader.newEval.length ? 'NEW_EVAL_FOUND' : '',
    loader.newFunction.length ? 'NEW_FUNCTION_FOUND' : ''
  ].filter(Boolean);

  return {
    ok: violations.length === 0,
    directFinanceUiCallsByFile,
    adapterAliasCallsByFile,
    directFinanceUiConsumers: refsToDetailedStrings(directFinanceUiConsumerRefs),
    financeUiAdapterConsumers: refsToDetailedStrings(financeUiAdapterConsumerRefs),
    aliasConsumers: refsToDetailedStrings(allAliasRefs),
    unresolvedConsumers: refsToDetailedStrings(allAliasRefs),
    bridgeDefinitions: refsToDetailedStrings(bridgeDefinitionRefs),
    modernGlobalUiConsumers: refsToStrings(modernGlobalUiConsumers),
    migratedPresentationEntrypoints,
    blockedCalls: blockedCalls.map((ref) => `${ref.file}:${ref.line}:${ref.match}:${ref.reason}`),
    unresolvedDynamicConsumers,
    navigationBridgeConsumers: refsToStrings(navigationBridgeConsumers),
    navigationCanonicalImplementation,
    navigationCoordinator: NAVIGATION_COORDINATOR_FILE,
    navigationCoordinatorUsesCanonical,
    part08HasClassicVisualActivation,
    navigationEvidenceStatus,
    previouslyUntrackedGlobalExposures: [
      'window.financeApp.financeUiAdapters (nested compatibility adapter; preexisting, not counted in top-level global inventory)'
    ],
    newGlobalExposures: [],
    remainingRuntimeConsumers,
    topLevelGlobals: globals,
    nestedUiBridgeExports: nestedExports(adapterSource),
    classicScripts: loader.classicScripts,
    evalExecutedScripts: loader.evalExecutedScripts,
    newEval: loader.newEval.length,
    newFunction: loader.newFunction.length,
    wrote: false,
    adapterViolations,
    newGlobalViolation,
    violations,
    legacyLimitations: [
      'Static scan is conservative and cannot prove absence of runtime-created aliases.',
      financeUiInstalled
        ? 'window.financeUI removal remains out of scope while runtime installation remains.'
        : 'window.financeUI is not installed; financeApp.financeUiAdapters remains for classic compatibility.',
      'Nested namespace properties are reported separately from the historical top-level global count.'
    ],
    // Backward-compatible summary fields used by prior diagnostics.
    modernFinanceUiConsumers: refsToStrings(modernGlobalUiConsumers),
    part07FinanceUiCalls: directFinanceUiCallsByFile['src/legacy/inline/part-07.js'] || 0,
    part08FinanceUiCalls: directFinanceUiCallsByFile['src/legacy/inline/part-08.js'] || 0,
    part14FinanceUiCalls: directFinanceUiCallsByFile['src/legacy/inline/part-14.js'] || 0,
    remainingConsumers: remainingRuntimeConsumers,
    financeUiInstalled,
    financeUiAdaptersInstalled,
    removedGlobalSurface: financeUiInstalled ? [] : ['window.financeUI'],
    addedGlobalSurface: [],
    globals
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = analyzeFinanceUiConsumers();
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exit(1);
}
