import { createHash } from 'node:crypto';
import { mkdir, writeFile, appendFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const PROJECT_ID = 'finance-control-cce4f';
const COLLECTIONS = ['users', 'finance_records', 'local_storage', 'audit_logs', 'idempotency_receipts', 'shared_macros', 'shared_categories', 'tax_parameters'];

function option(name) { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : ''; }
function assertAuthorized() {
  if (!process.argv.includes('--allow-production-read')) throw new Error('PRODUCTION_READ_ACK_REQUIRED');
  if (option('--project') !== PROJECT_ID) throw new Error('PRODUCTION_PROJECT_MISMATCH');
  if (!process.env.GOOGLE_OAUTH_ACCESS_TOKEN) throw new Error('GOOGLE_OAUTH_ACCESS_TOKEN_REQUIRED');
  const out = resolve(option('--output') || '');
  if (!out || out.startsWith(resolve('.'))) throw new Error('OUTPUT_MUST_BE_OUTSIDE_REPOSITORY');
  return out;
}

async function request(path, body) {
  const response = await fetch(`https://firestore.googleapis.com/v1/${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { authorization: `Bearer ${process.env.GOOGLE_OAUTH_ACCESS_TOKEN}`, 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });
  if (!response.ok) throw new Error(`FIRESTORE_EXPORT_HTTP_${response.status}`);
  return response.json();
}

function checksum(content) { return createHash('sha256').update(content).digest('hex'); }

async function listCollection(collectionId, allDescendants) {
  const query = { structuredQuery: { from: [{ collectionId, allDescendants }], orderBy: [{ field: { fieldPath: '__name__' }, direction: 'ASCENDING' }] } };
  return request(`projects/${PROJECT_ID}/databases/(default)/documents:runQuery`, query);
}

async function main() {
  const out = assertAuthorized();
  await mkdir(resolve(out, 'metadata'), { recursive: true });
  const manifest = { format_version: 1, project_id: PROJECT_ID, created_at: new Date().toISOString(), files: {} };
  for (const name of COLLECTIONS) {
    const rows = await listCollection(name, !['users', 'shared_macros', 'shared_categories', 'tax_parameters'].includes(name));
    const documents = rows.filter((row) => row.document).map((row) => ({ document_path: row.document.name, fields: row.document.fields || {}, create_time: row.document.createTime, update_time: row.document.updateTime }));
    const content = documents.map((row) => JSON.stringify(row)).join('\n') + (documents.length ? '\n' : '');
    const fileName = `${name}.jsonl`;
    await writeFile(resolve(out, fileName), content, { flag: 'wx' });
    manifest.files[fileName] = { count: documents.length, sha256: checksum(content) };
    console.log(JSON.stringify({ collection: name, count: documents.length }));
  }
  manifest.global_sha256 = checksum(Object.entries(manifest.files)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, metadata]) => `${name}:${metadata.count}:${metadata.sha256}`)
    .join('\n'));
  await writeFile(resolve(out, 'manifest.json'), JSON.stringify(manifest, null, 2), { flag: 'wx' });
  await appendFile(resolve(out, 'metadata', 'README.txt'), 'Auth export must be produced separately by a trusted operator. Do not commit this directory.\n');
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
