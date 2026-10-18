import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const INVENTORY = fs.readFileSync(path.join(ROOT, 'docs/global-api-inventory.md'), 'utf8');

const ALLOWED_DUPLICATE_DEFINITIONS = new Map([
  ['__financeDataVersion', 'cache invalidation flag is intentionally bumped by data mutation flows'],
  ['switchTab', 'router module replaces the legacy bridge after classic loader'],
  ['renderEntradas', 'legacy entrada renderer has staged fallback definitions inside part-03'],
  ['saveEntryDiscountAdjustmentByEntry', 'part-13 intentionally supersedes the older part-11 implementation'],
  ['openEntryDiscountHistoryModal', 'part-16 keeps a DOM fallback and a component-based implementation during modal migration'],
  ['calcularHoras', 'legacy tax/hour bridge remains while domain engine is canonical'],
  ['calcularHoraExtra', 'legacy tax/hour bridge remains while domain engine is canonical'],
  ['calcularINSS', 'legacy tax bridge remains while domain tax engine is canonical'],
  ['calcularIRRF', 'legacy tax bridge remains while domain tax engine is canonical'],
  ['calcularLiquido', 'legacy tax bridge remains while domain tax engine is canonical'],
  ['openEntryDetailModal', 'older entry detail fallback remains shadowed by current part-03 implementation'],
  ['goBackTab', 'legacy tab fallback and router bridge overlap until router migration finishes'],
  ['showToast', 'legacy UI toast fallback and modern toast bridge overlap during UI migration'],
  ['getPeopleRecords', 'legacy import/render helpers overlap while references are extracted'],
  ['getSalarioVigente', 'salary lookup exists in legacy entrada and hour bridge code'],
  ['consolidarEntradaMensal', 'critical entrada consolidation fallback remains until entry module migration'],
  ['formatCompetence', 'legacy formatter and month-detail formatter overlap while UI modules migrate'],
  ['fmt', 'legacy formatter and month-detail formatter overlap while UI modules migrate']
]);

const EXPECTED_FINANCE_APP_PROPERTIES = new Set([
  'bootstrapApp',
  'appState',
  'applicationDependencies',
  'applicationGateway',
  'percentageRuleMaterializationRunner',
  'taxEngine',
  'workSessionEngine',
  'legacyTaxParameterRepository',
  'installInitialTemplates',
  'loadLegacyClassicScripts',
  'installLocalVisualLibraries',
  'installAppStateGlobals',
  'installGlobalBridge',
  'installCloudMemoryStorage',
  'installLucideIconScheduler',
  'installRecordHelperGlobals',
  'installFinanceRecordIndexGlobals',
  'installRecordPayloadBuilderGlobals',
  'installFinanceRecordMutationGlobals',
  'installImportPipelineGlobals',
  'installRecordFormReaderGlobals',
  'installRecordFormValidationGlobals',
  'installRecordListRendererGlobals',
  'installImportacaoLazyLoader',
  'installReportExportLazyLoader',
  'installFinancialSelectorGlobals',
  'installMonthlyDetailSelectorGlobals',
  'createApplicationDependencies',
  'createDefaultApplicationGateway',
  'installThemeGlobals',
  'installAccountLifecycleGlobals',
  'installCreateElementGlobals',
  'installActionButtonGlobals',
  'installMetricCardGlobals',
  'installModalGlobals',
  'createFirebaseDataProvider',
  'FinanceRepository',
  'installFirebaseServicesWhenReady',
  'installCoreGlobals'
]);

function walkFiles(entry) {
  const full = path.join(ROOT, entry);
  const stat = fs.statSync(full);
  if (stat.isFile()) return [full];
  return fs.readdirSync(full, { withFileTypes: true }).flatMap((dirent) => {
    if (['node_modules', 'dist'].includes(dirent.name)) return [];
    const child = path.join(full, dirent.name);
    if (dirent.isDirectory()) return walkFiles(path.relative(ROOT, child));
    return /\.(js|html)$/.test(dirent.name) ? [child] : [];
  });
}

function lineNumber(source, index) {
  return source.slice(0, index).split(/\r?\n/).length;
}

function inventoryNames() {
  return [...INVENTORY.matchAll(/\| `([^`]+)` \|/g)].map((match) => match[1]);
}

function collectDefinitions() {
  const definitions = new Map();
  const add = (name, ref) => {
    if (!definitions.has(name)) definitions.set(name, []);
    definitions.get(name).push(ref);
  };

  for (const file of walkFiles('src')) {
    const rel = path.relative(ROOT, file).replace(/\\/g, '/');
    const source = fs.readFileSync(file, 'utf8');
    const canDeclareGlobals = rel === 'src/legacy-globals.js' ||
      rel.startsWith('src/legacy/inline/') ||
      rel.endsWith('.global.js') ||
      rel === 'src/ui/legacy-ui.js';
    for (const match of source.matchAll(/\bwindow\.([A-Za-z_$][\w$]*)\s*=(?!=)/g)) {
      add(match[1], { kind: 'window assignment', file: rel, line: lineNumber(source, match.index) });
    }
    if (canDeclareGlobals) {
      for (const match of source.matchAll(/(?:^|\n)\s*(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/g)) {
        add(match[1], { kind: 'function declaration', file: rel, line: lineNumber(source, match.index) });
      }
    }
  }

  return definitions;
}

function financeAppProperties() {
  const source = fs.readFileSync(path.join(ROOT, 'src/app.js'), 'utf8');
  const objectStart = source.indexOf('window.financeApp = {');
  const objectEnd = source.indexOf('\n  };\n  bootstrapApp();', objectStart);
  const objectBody = source.slice(objectStart, objectEnd);
  return [...objectBody.matchAll(/^\s{4}([A-Za-z_$][\w$]*),?$/gm)].map((match) => match[1]);
}

describe('global API collision audit', () => {
  it('keeps every direct window assignment inventoried', () => {
    const known = new Set(inventoryNames());
    const unknown = [];

    for (const [name, refs] of collectDefinitions()) {
      const hasWindowAssignment = refs.some((ref) => ref.kind === 'window assignment');
      if (hasWindowAssignment && !known.has(name)) unknown.push({ name, refs });
    }

    expect(unknown).toEqual([]);
  });

  it('blocks duplicate global definitions unless explicitly documented', () => {
    const known = new Set(inventoryNames());
    const duplicates = [];

    for (const [name, refs] of collectDefinitions()) {
      if (!known.has(name)) continue;
      const implementationFiles = new Set(refs.map((ref) => ref.file));
      if (implementationFiles.size <= 1) continue;
      if (ALLOWED_DUPLICATE_DEFINITIONS.has(name)) continue;
      duplicates.push({ name, refs });
    }

    expect(duplicates).toEqual([]);
  });

  it('documents every duplicate whitelist entry', () => {
    const defined = collectDefinitions();
    for (const [name, reason] of ALLOWED_DUPLICATE_DEFINITIONS) {
      expect(reason.length).toBeGreaterThan(12);
      expect(defined.has(name), `${name} should still exist while whitelisted`).toBe(true);
    }
  });

  it('audits window.financeApp and keeps legacy event installer out of the global app object', () => {
    const properties = financeAppProperties();
    expect(properties).toEqual([...EXPECTED_FINANCE_APP_PROPERTIES]);
    expect(properties).not.toContain('installLegacyEventBindings');
  });
});
