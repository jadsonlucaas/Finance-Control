import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SEARCH_DIRS = ['index.html', 'src'];
const DOC_PATH = path.join(ROOT, 'docs', 'global-api-inventory.md');

const CRITICAL_GLOBALS = [
  'renderDashboard',
  'renderEntradas',
  'renderSaidas',
  'switchTab',
  'handleSubmit',
  'consolidarEntradaMensal',
  'calcularINSS',
  'calcularIRRF',
  'calcularLiquido',
  'openEntryDetailModal',
  'exportPDF'
];

const EVENT_ATTR_PATTERN = /\b(onclick|onchange|onsubmit)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
const CALL_PATTERN = /(?:^|[^\w$.])(?:window\.)?([A-Za-z_$][\w$]*)\s*\(/g;
const WINDOW_ASSIGN_PATTERN = /\bwindow\.([A-Za-z_$][\w$]*)\s*=/g;
const GLOBAL_ASSIGN_PATTERN = /(?:^|\n)\s*([A-Za-z_$][\w$]*)\s*=\s*function\b/g;
const FUNCTION_DECL_PATTERN = /(?:^|\n)\s*(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/g;

const IGNORE_CALLS = new Set([
  'if', 'for', 'while', 'switch', 'catch', 'function', 'return',
  'Number', 'String', 'Boolean', 'Date', 'JSON', 'Math', 'Object',
  'Array', 'Promise', 'setTimeout', 'setInterval', 'clearTimeout',
  'requestAnimationFrame', 'cancelAnimationFrame', 'parseFloat',
  'parseInt', 'encodeURIComponent', 'decodeURIComponent'
]);

function walkFiles(entry) {
  const full = path.join(ROOT, entry);
  if (!fs.existsSync(full)) return [];
  const stat = fs.statSync(full);
  if (stat.isFile()) return [full];

  const files = [];
  for (const dirent of fs.readdirSync(full, { withFileTypes: true })) {
    if (dirent.name === 'node_modules' || dirent.name === 'dist') continue;
    const child = path.join(full, dirent.name);
    if (dirent.isDirectory()) files.push(...walkFiles(path.relative(ROOT, child)));
    if (dirent.isFile() && /\.(js|html|css)$/.test(dirent.name)) files.push(child);
  }
  return files;
}

function lineNumber(source, index) {
  return source.slice(0, index).split(/\r?\n/).length;
}

function compact(value = '') {
  return value.replace(/\s+/g, ' ').trim();
}

function addRef(map, name, ref) {
  if (!name || IGNORE_CALLS.has(name)) return;
  if (!map.has(name)) map.set(name, []);
  map.get(name).push(ref);
}

const files = SEARCH_DIRS.flatMap(walkFiles);
const handlers = new Map();
const definitions = new Map();
const windowAssignments = new Map();

for (const file of files) {
  const rel = path.relative(ROOT, file).replace(/\\/g, '/');
  const source = fs.readFileSync(file, 'utf8');

  let eventMatch;
  while ((eventMatch = EVENT_ATTR_PATTERN.exec(source))) {
    const attr = eventMatch[1];
    const expr = eventMatch[2] || eventMatch[3] || '';
    const line = lineNumber(source, eventMatch.index);
    let callMatch;
    while ((callMatch = CALL_PATTERN.exec(expr))) {
      addRef(handlers, callMatch[1], {
        attr,
        file: rel,
        line,
        expr: compact(expr).slice(0, 140)
      });
    }
  }

  let functionMatch;
  while ((functionMatch = FUNCTION_DECL_PATTERN.exec(source))) {
    addRef(definitions, functionMatch[1], {
      kind: 'function declaration',
      file: rel,
      line: lineNumber(source, functionMatch.index)
    });
  }

  let assignmentMatch;
  while ((assignmentMatch = WINDOW_ASSIGN_PATTERN.exec(source))) {
    addRef(windowAssignments, assignmentMatch[1], {
      kind: 'window assignment',
      file: rel,
      line: lineNumber(source, assignmentMatch.index)
    });
  }

  let globalAssignmentMatch;
  while ((globalAssignmentMatch = GLOBAL_ASSIGN_PATTERN.exec(source))) {
    addRef(definitions, globalAssignmentMatch[1], {
      kind: 'global function assignment',
      file: rel,
      line: lineNumber(source, globalAssignmentMatch.index)
    });
  }
}

const names = [...new Set([
  ...CRITICAL_GLOBALS,
  ...handlers.keys(),
  ...windowAssignments.keys()
])].sort((a, b) => {
  const aCritical = CRITICAL_GLOBALS.includes(a) ? 0 : 1;
  const bCritical = CRITICAL_GLOBALS.includes(b) ? 0 : 1;
  return aCritical - bCritical || a.localeCompare(b);
});

function firstOrigin(name) {
  const refs = [
    ...(windowAssignments.get(name) || []),
    ...(definitions.get(name) || [])
  ];
  if (!refs.length) return 'Nao localizado diretamente; provavel funcao global gerada por script legado.';
  const ref = refs[0];
  return `${ref.file}:${ref.line} (${ref.kind})`;
}

function users(name) {
  const refs = handlers.get(name) || [];
  if (!refs.length) return CRITICAL_GLOBALS.includes(name) ? 'Chamado por scripts legados e/ou testes; sem handler inline direto encontrado.' : 'Sem handler inline direto encontrado.';
  const grouped = refs.slice(0, 4).map((ref) => `${ref.file}:${ref.line} ${ref.attr}`).join('<br>');
  const extra = refs.length > 4 ? `<br>+ ${refs.length - 4} uso(s)` : '';
  return grouped + extra;
}

function typeFor(name) {
  if (/render|open|close|toggle|switch|setFocused|show|hide|modal|tab/i.test(name)) return 'renderizacao / evento';
  if (/calcular|consolid|format|normalize|parse|round|build|get/i.test(name)) return 'calculo / dados';
  if (/save|delete|remove|import|export|handle|submit|add|edit|archive|restore/i.test(name)) return 'evento / operacao';
  return 'evento / global';
}

function migrationReadiness(name) {
  if (CRITICAL_GLOBALS.includes(name)) return 'Nao migrar nesta fase; exige bridge global e smoke test cobrindo.';
  const refs = handlers.get(name) || [];
  if (refs.length > 0) return 'Candidato preliminar somente apos mover handler inline para legacy-events/globalBridge.';
  return 'Candidato preliminar somente se busca completa confirmar ausencia de consumidores legados.';
}

const generatedAt = new Date().toISOString();
const lines = [];
lines.push('# Inventario de API Global');
lines.push('');
lines.push(`Gerado em: ${generatedAt}`);
lines.push('');
lines.push('Este documento congela as funcoes globais e handlers inline conhecidos antes da migracao para modulos. A regra de seguranca e: qualquer item usado por HTML, template string ou outro script legado deve continuar disponivel ate que o uso seja migrado para imports explicitos.');
lines.push('');
lines.push('## Baseline de Comandos');
lines.push('');
lines.push('Executar e atualizar esta secao sempre que uma fase de migracao terminar:');
lines.push('');
lines.push('```powershell');
lines.push('npm.cmd test');
lines.push('npm.cmd run build');
lines.push('npm.cmd run smoke');
lines.push('```');
lines.push('');
lines.push('## Criterio de leitura');
lines.push('');
lines.push('A coluna "Situacao preliminar de migracao" nao autoriza migracao por si so. Qualquer item marcado como candidato ainda exige busca completa de consumidores, testes de regressao especificos, smoke aprovado e preservacao de bridge de compatibilidade enquanto houver consumo legado.');
lines.push('');
lines.push('## Globais Criticos');
lines.push('');
lines.push('| Nome | Origem atual | Quem usa | Tipo | Situacao preliminar de migracao |');
lines.push('| --- | --- | --- | --- | --- |');
for (const name of CRITICAL_GLOBALS) {
  lines.push(`| \`${name}\` | ${firstOrigin(name)} | ${users(name)} | ${typeFor(name)} | ${migrationReadiness(name)} |`);
}
lines.push('');
lines.push('## Handlers e APIs Globais Detectados');
lines.push('');
lines.push('| Nome | Origem atual | Quem usa | Tipo | Situacao preliminar de migracao |');
lines.push('| --- | --- | --- | --- | --- |');
for (const name of names.filter((name) => !CRITICAL_GLOBALS.includes(name))) {
  lines.push(`| \`${name}\` | ${firstOrigin(name)} | ${users(name)} | ${typeFor(name)} | ${migrationReadiness(name)} |`);
}
lines.push('');
lines.push('## Observacoes de Migracao');
lines.push('');
lines.push('- Itens com uso em `onclick`, `onchange` ou `onsubmit` devem continuar em `window` ate que o handler seja movido para `src/ui/legacy-events.js` ou modulo equivalente.');
lines.push('- Funcoes criticas de calculo devem ser migradas primeiro para `src/domain`/`src/core`, mas expostas por uma bridge global enquanto scripts legados dependerem delas.');
lines.push('- Antes de remover qualquer global, procurar pelo nome em `index.html`, `src/legacy/inline`, `src/ui` e nos testes de smoke.');

fs.mkdirSync(path.dirname(DOC_PATH), { recursive: true });
fs.writeFileSync(DOC_PATH, `${lines.join('\n')}\n`, 'utf8');
console.log(`Wrote ${path.relative(ROOT, DOC_PATH)} with ${names.length} global/API entries.`);
