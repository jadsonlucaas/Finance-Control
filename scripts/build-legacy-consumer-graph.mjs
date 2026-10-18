import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyzeFinanceUiConsumers } from './finance-ui-consumers-check.mjs';

const ROOT = process.cwd();
const LOADER_PATH = path.join(ROOT, 'src', 'legacy', 'classicScripts.js');
const OUTPUT_PATH = path.join(ROOT, 'docs', 'legacy-consumer-graph.md');

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

function read(file) {
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
}

function normalizeSlash(value = '') {
  return value.replace(/\\/g, '/');
}

function resolveProjectPath(projectPath = '') {
  return path.join(ROOT, projectPath.replace(/^src\//, 'src/'));
}

function loaderEntries() {
  const source = read(LOADER_PATH);
  return [...source.matchAll(/\[\s*['"]([^'"]+)['"]\s*,\s*\(\)\s*=>\s*import\([^)]*\?raw['"]\)\s*\]/g)]
    .map((match) => match[1]);
}

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

function searchableFiles() {
  return [
    ...walk('src'),
    ...walk('tests'),
    ...walk('scripts'),
    ...walk('docs'),
    path.join(ROOT, 'index.html'),
    path.join(ROOT, 'package.json')
  ].filter((file) => /\.(js|mjs|html|md|json)$/.test(file))
    .filter((file) => path.resolve(file) !== OUTPUT_PATH);
}

function lineNumber(source, index) {
  return source.slice(0, index).split(/\r?\n/).length;
}

function extractProducers(script) {
  const full = resolveProjectPath(script);
  const source = read(full);
  const names = new Set();
  for (const match of source.matchAll(/\bwindow\.([A-Za-z_$][\w$]*)\s*=/g)) names.add(match[1]);
  for (const match of source.matchAll(/(?:^|\n)\s*(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/g)) names.add(match[1]);
  return [...names].sort();
}

function fileKind(rel = '') {
  if (rel.startsWith('docs/')) return 'documentacao';
  if (rel.startsWith('tests/')) return 'teste';
  if (rel.startsWith('src/legacy/inline/')) return 'script legado';
  if (rel.startsWith('src/application/') || rel.startsWith('src/domain/')) return 'modulo reutilizavel';
  if (rel.startsWith('src/ui/') || rel === 'index.html') return 'ui/template';
  if (rel.startsWith('scripts/')) return 'script de tooling';
  return 'codigo';
}

function findConsumers(name, producerScript) {
  const consumers = [];
  const producerRel = normalizeSlash(producerScript);
  const pattern = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g');
  for (const file of searchableFiles()) {
    const rel = normalizeSlash(path.relative(ROOT, file));
    if (rel === producerRel) continue;
    const source = read(file);
    for (const match of source.matchAll(pattern)) {
      consumers.push({
        file: rel,
        line: lineNumber(source, match.index),
        kind: fileKind(rel)
      });
    }
  }
  return consumers;
}

export function buildLegacyConsumerGraph() {
  const currentEntries = loaderEntries();
  const financeUiAnalysis = analyzeFinanceUiConsumers();
  const rows = BASELINE_CLASSIC_SCRIPTS.map((script) => {
    const producers = extractProducers(script);
    const consumers = producers.flatMap((name) =>
      findConsumers(name, script).map((consumer) => ({ name, ...consumer }))
    );
    return {
      script,
      inCurrentLoader: currentEntries.includes(script),
      producers,
      consumers
    };
  });

  const lines = [
    '# Grafo de Consumidores do Loader Legado',
    '',
    `Gerado em: ${new Date().toISOString()}`,
    '',
    'Este grafo combina produtores conhecidos nos scripts classicos com busca textual em codigo, testes, templates e documentacao. Referencias documentais nao autorizam migracao nem bloqueiam remocao por si so; consumidores em runtime devem prevalecer.',
    '',
    '## Resumo',
    '',
    `- Scripts baseline analisados: ${BASELINE_CLASSIC_SCRIPTS.length}`,
    `- Scripts no loader atual: ${currentEntries.length}`,
    `- Scripts removidos do loader atual: ${BASELINE_CLASSIC_SCRIPTS.filter((script) => !currentEntries.includes(script)).length}`,
    '',
    '## Producer -> Consumer(s)',
    ''
  ];

  rows.forEach((row) => {
    lines.push(`### ${row.script}`);
    lines.push('');
    lines.push(`- No loader atual: ${row.inCurrentLoader ? 'sim' : 'nao'}`);
    lines.push(`- Produtores detectados: ${row.producers.length ? row.producers.map((name) => `\`${name}\``).join(', ') : 'nenhum'}`);
    if (!row.consumers.length) {
      lines.push('- Consumidores detectados: nenhum consumidor runtime/textual fora do proprio arquivo.');
    } else {
      lines.push('| Producer | Consumer | Tipo |');
      lines.push('| --- | --- | --- |');
      row.consumers.slice(0, 80).forEach((consumer) => {
        lines.push(`| \`${consumer.name}\` | ${consumer.file}:${consumer.line} | ${consumer.kind} |`);
      });
      if (row.consumers.length > 80) lines.push(`| ... | ${row.consumers.length - 80} consumidores adicionais omitidos no relatorio | ... |`);
    }
    lines.push('');
  });

  lines.push('## Migracao dos consumidores modernos `financeUI` - 12/09/2026');
  lines.push('');
  lines.push('`src/ui/importacao.js`, `src/ui/monthDetail/monthDetailEvents.js` e `src/ui/records/financialCrudControllerInstaller.js` deixaram de consumir `window.financeUI`/`financeUiAdapters`. `part-07.js` tambem deixou de chamar `window.financeUI` diretamente e usa o adapter visual temporario enquanto permanecer classico.');
  lines.push('');
  lines.push('| Item | Antes | Depois |');
  lines.push('| --- | ---: | ---: |');
  lines.push('| Consumidores modernos de `financeUI`/`financeUiAdapters` | 3 arquivos | 0 |');
  lines.push('| `window.financeUI` em `part-07.js` | 5 | 0 |');
  lines.push('| `window.financeUI` em `part-08.js` | 9 | 0 |');
  lines.push('| `window.financeUI` em `part-14.js` | 4 | 0 |');
  lines.push('| `part-08.js` navegacao via `financeUI/financeUiAdapters.activateTab` | 1 | 0 |');
  lines.push('| `part-08.js` helper visual classico duplicado | 1 | 0 |');
  lines.push('| Coordenador ES de navegacao | 0 | 1 |');
  lines.push('| Scripts classic/eval | 22/22 | 22/22 |');
  lines.push('| APIs globais | 50 | 50 |');
  lines.push('| Novo `eval` | 0 | 0 |');
  lines.push('| `new Function` | 0 | 0 |');
  lines.push('');
  lines.push('Consumidores runtime remanescentes relacionados a `financeUI`:');
  lines.push('');
  financeUiAnalysis.remainingRuntimeConsumers.forEach((file) => {
    const count = financeUiAnalysis.adapterAliasCallsByFile[file] || financeUiAnalysis.directFinanceUiCallsByFile[file] || 0;
    lines.push(`- \`${file}\` ainda possui ${count} consumidor(es) runtime de \`financeUI\` ou \`financeUiAdapters\`.`);
  });
  lines.push('- `src/ui/legacy-ui.js` continua sendo a implementacao ES canonica dos helpers visuais e do adapter de compatibilidade.');
  lines.push('');
  lines.push('### Inventario de bridges diretas e indiretas');
  lines.push('');
  lines.push(`- Consumidores diretos de \`window.financeUI\`: ${financeUiAnalysis.directFinanceUiConsumers.length ? financeUiAnalysis.directFinanceUiConsumers.map((item) => `\`${item}\``).join(', ') : 'nenhum'}.`);
  lines.push(`- Consumidores de \`window.financeApp.financeUiAdapters\`: ${financeUiAnalysis.financeUiAdapterConsumers.length}.`);
  lines.push(`- Aliases/dinamicos nao resolvidos: ${financeUiAnalysis.unresolvedConsumers.length ? financeUiAnalysis.unresolvedConsumers.map((item) => `\`${item}\``).join(', ') : 'nenhum'}.`);
  lines.push(`- Consumidores runtime consolidados: ${financeUiAnalysis.remainingRuntimeConsumers.map((item) => `\`${item}\``).join(', ') || 'nenhum'}.`);
  lines.push(`- Implementacao visual canonica de navegacao: \`${financeUiAnalysis.navigationCanonicalImplementation}\`.`);
  lines.push(`- Evidencia de navegacao: ${financeUiAnalysis.navigationEvidenceStatus}.`);
  lines.push(`- \`window.financeUI\` instalada em runtime: ${financeUiAnalysis.financeUiInstalled ? 'sim' : 'nao'}.`);
  lines.push(`- \`window.financeApp.financeUiAdapters\` instalada em runtime: ${financeUiAnalysis.financeUiAdaptersInstalled ? 'sim' : 'nao'}.`);
  lines.push(`- Superficie global removida: ${financeUiAnalysis.removedGlobalSurface.map((item) => `\`${item}\``).join(', ') || 'nenhuma'}.`);
  lines.push(`- Superficie global adicionada: ${financeUiAnalysis.addedGlobalSurface.length ? financeUiAnalysis.addedGlobalSurface.map((item) => `\`${item}\``).join(', ') : 'nenhuma'}.`);
  lines.push('');
  lines.push('`window.financeUI` nao e mais instalada no runtime apos a comprovacao de ausencia de consumidores diretos efetivos. `window.financeApp.financeUiAdapters` permanece instalada por compatibilidade com `part-03.js`, `part-07.js` e `part-29.js`. A navegacao efetiva de `part-08.js:switchTab` nao chama mais `financeUI.activateTab` nem `financeUiAdapters.activateTab`, e a ativacao visual e coordenada por `src/ui/navigation/navigationCoordinator.js` delegando para `src/ui/navigationTabs.js:activateTab`. Nenhuma regra financeira, auth, Firestore Rule, importacao, backup/restore, PDF, horas, parcelamentos, recorrencias, tributos ou materializacao percentual foi migrada nesta etapa.');
  lines.push('');

  fs.writeFileSync(OUTPUT_PATH, `${lines.join('\n').replace(/\n+$/, '')}\n`);
  return {
    ok: true,
    output: normalizeSlash(path.relative(ROOT, OUTPUT_PATH)),
    scripts: rows.length,
    currentLoaderScripts: currentEntries.length,
    removedFromLoader: BASELINE_CLASSIC_SCRIPTS.filter((script) => !currentEntries.includes(script)),
    rows
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const graph = buildLegacyConsumerGraph();
  console.log(JSON.stringify({
    ok: graph.ok,
    output: graph.output,
    scripts: graph.scripts,
    currentLoaderScripts: graph.currentLoaderScripts,
    removedFromLoader: graph.removedFromLoader
  }, null, 2));
}
