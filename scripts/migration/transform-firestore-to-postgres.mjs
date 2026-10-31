import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';

const input = process.argv[process.argv.indexOf('--input') + 1];
const dryRun = process.argv.includes('--dry-run');
if (!input || !dryRun) throw new Error('INPUT_AND_DRY_RUN_REQUIRED');

let count = 0;
for await (const line of createInterface({ input: createReadStream(input), crlfDelay: Infinity })) {
  if (!line.trim()) continue;
  const record = JSON.parse(line);
  if (!record.document_path || !record.fields) throw new Error(`INVALID_FIRESTORE_RECORD:${count + 1}`);
  count += 1;
}
console.log(JSON.stringify({ mode: 'dry-run', recordsValidated: count, wrote: false }));
