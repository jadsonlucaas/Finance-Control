import { readFileSync } from 'node:fs';

const files = [
  'src/ui/records/expenseFormController.js',
  'src/ui/records/incomeFormController.js',
  'src/ui/records/recordMutationPresenter.js',
  'src/ui/records/mutationAttemptStore.js'
];

const forbidden = [
  /\bwindow\b/,
  /globalThis\.financeApp/,
  /financeApp\.applicationGateway/,
  /dataSdk/,
  /firebase\//,
  /from ['"]firebase/,
  /calcularINSS/,
  /calcularIRRF/,
  /calcularLiquido/,
  /calcularHoraExtra/,
  /calcularDSR/,
  /CreateInstallmentSeriesCommand/,
  /CreateRecurrenceSeriesCommand/
];

const violations = [];
for (const file of files) {
  const source = readFileSync(file, 'utf8');
  for (const pattern of forbidden) {
    if (pattern.test(source)) {
      violations.push({ file, pattern: pattern.source });
    }
  }
}

const classicScriptsSource = readFileSync('src/legacy/classicScripts.js', 'utf8');
const classicScriptCount = (classicScriptsSource.match(/\[\s*['"]src\//g) || []).length;
const inventory = readFileSync('docs/global-api-inventory.md', 'utf8');
const globalApiCount = (inventory.match(/^\| `[^`]+` \|/gm) || []).length;

const result = {
  ok: violations.length === 0 && classicScriptCount <= 33 && globalApiCount <= 58,
  violations,
  classicScriptCount,
  globalApiCount,
  limits: {
    classicScripts: 33,
    globalApis: 58
  }
};

console.log(JSON.stringify(result, null, 2));
if (!result.ok) process.exit(1);
