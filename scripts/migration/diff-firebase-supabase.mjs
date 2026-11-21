import { readFile } from 'node:fs/promises';
const left = process.argv[process.argv.indexOf('--firebase-summary') + 1];
const right = process.argv[process.argv.indexOf('--supabase-summary') + 1];
if (!left || !right) throw new Error('SANITIZED_SUMMARIES_REQUIRED');
const [firebase, supabase] = await Promise.all([left, right].map(async (path) => JSON.parse(await readFile(path, 'utf8'))));
const dimensions = ['total', 'by_type', 'by_competence', 'amount_cents', 'installments', 'paid', 'recurrence', 'hours', 'percentage_rules', 'settings', 'audit'];
const differences = dimensions.filter((key) => JSON.stringify(firebase[key]) !== JSON.stringify(supabase[key]));
console.log(JSON.stringify({ parity: differences.length === 0, differences }));
if (differences.length) process.exitCode = 1;
