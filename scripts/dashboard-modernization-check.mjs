import { readFileSync } from 'node:fs';
import { analyzeLegacyLoader } from './analyze-legacy-loader.mjs';

const modernPureFiles = [
  'src/application/selectors/dashboardFilters.js',
  'src/application/readModels/dashboardChartData.js',
  'src/application/readModels/dashboardReadModel.js',
  'src/application/readModels/expenseListReadModel.js',
  'src/application/readModels/incomeListReadModel.js'
];

const modernUiFiles = [
  'src/ui/dashboard/dashboardController.js',
  'src/ui/dashboard/dashboardPresenter.js'
];

const pureForbidden = [
  /\bwindow\b/,
  /\bdocument\b/,
  /dataSdk/,
  /firebase\//,
  /from ['"]firebase/,
  /WhatsApp|webhook|provider|Admin SDK|telefone|phone/i
];

const uiForbidden = [
  /dataSdk/,
  /firebase\//,
  /from ['"]firebase/,
  /calcularINSS|calcularIRRF|calcularLiquido|calcularHoraExtra|calcularDSR/,
  /WhatsApp|webhook|provider|Admin SDK|telefone|phone/i
];

function collectViolations(files, patterns) {
  const violations = [];
  for (const file of files) {
    const source = readFileSync(file, 'utf8');
    for (const pattern of patterns) {
      if (pattern.test(source)) violations.push({ file, pattern: pattern.source });
    }
  }
  return violations;
}

const classicScriptsSource = readFileSync('src/legacy/classicScripts.js', 'utf8');
const classicScripts = (classicScriptsSource.match(/\[\s*['"]src\//g) || []).length;
const inventory = readFileSync('docs/global-api-inventory.md', 'utf8');
const globals = (inventory.match(/^\| `[^`]+` \|/gm) || []).length;
const legacyLoader = analyzeLegacyLoader();
const evalExecutedScripts = legacyLoader.evalExecutedScripts;
const violations = [
  ...collectViolations(modernPureFiles, pureForbidden),
  ...collectViolations(modernUiFiles, uiForbidden)
];

const result = {
  ok: violations.length === 0 && globals <= 58 && classicScripts <= 33 && evalExecutedScripts <= 33,
  wrote: false,
  violations,
  globals,
  classicScripts,
  evalExecutedScripts,
  limits: {
    globals: 58,
    classicScripts: 33,
    evalExecutedScripts: 33
  }
};

console.log(JSON.stringify(result, null, 2));
if (!result.ok) process.exit(1);
