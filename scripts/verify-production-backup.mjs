import { createHash } from 'node:crypto';
import { createReadStream, existsSync, readFileSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function parseArgs(args) {
  const value = (name) => args[args.indexOf(name) + 1];
  return { backupDir: value('--backup-dir'), manifestPath: value('--manifest') };
}

function assertExternalDirectory(path) {
  const target = resolve(path);
  if (target === REPO_ROOT || target.startsWith(`${REPO_ROOT}\\`) || target.startsWith(`${REPO_ROOT}/`)) {
    throw new Error('BACKUP_DIRECTORY_MUST_BE_OUTSIDE_REPOSITORY');
  }
  return target;
}

async function sha256(path) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest('hex');
}

async function inspectJsonl(path) {
  const ids = new Set();
  let count = 0;
  const input = createInterface({ input: createReadStream(path), crlfDelay: Infinity });
  for await (const line of input) {
    if (!line.trim()) continue;
    let record;
    try { record = JSON.parse(line); } catch { throw new Error(`INVALID_JSONL:${path}:${count + 1}`); }
    const id = String(record.document_path || record.id || '');
    if (!id) throw new Error(`DOCUMENT_ID_REQUIRED:${path}:${count + 1}`);
    if (ids.has(id)) throw new Error(`DUPLICATE_DOCUMENT:${path}:${id}`);
    ids.add(id);
    count += 1;
  }
  return { count, uniqueIds: ids.size };
}

export async function verifyProductionBackup({ backupDir, manifestPath } = {}) {
  if (!backupDir) throw new Error('BACKUP_DIRECTORY_REQUIRED');
  const root = assertExternalDirectory(backupDir);
  const manifestFile = resolve(manifestPath || root, manifestPath ? '' : 'manifest.json');
  if (!existsSync(manifestFile)) throw new Error('BACKUP_MANIFEST_REQUIRED');
  const manifest = JSON.parse(readFileSync(manifestFile, 'utf8'));
  if (manifest.project_id !== 'finance-control-cce4f') throw new Error('BACKUP_PROJECT_MISMATCH');
  const expectedFiles = manifest.files || {};
  const actualNames = new Set(await readdir(root));
  const report = { projectId: manifest.project_id, files: {}, ok: true };
  for (const [name, expected] of Object.entries(expectedFiles)) {
    if (!actualNames.has(name)) throw new Error(`BACKUP_FILE_MISSING:${name}`);
    const path = resolve(root, name);
    const digest = await sha256(path);
    if (digest !== expected.sha256) throw new Error(`BACKUP_CHECKSUM_MISMATCH:${name}`);
    const inspected = name.endsWith('.jsonl') ? await inspectJsonl(path) : { count: expected.count };
    if (Number(expected.count) !== inspected.count) throw new Error(`BACKUP_COUNT_MISMATCH:${name}`);
    report.files[name] = { count: inspected.count, checksum: 'valid' };
  }
  const globalDigest = createHash('sha256').update(Object.entries(expectedFiles)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, metadata]) => `${name}:${metadata.count}:${metadata.sha256}`)
    .join('\n')).digest('hex');
  if (manifest.global_sha256 && manifest.global_sha256 !== globalDigest) {
    throw new Error('BACKUP_GLOBAL_CHECKSUM_MISMATCH');
  }
  report.globalChecksum = manifest.global_sha256 ? 'valid' : 'not-declared';
  return report;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  verifyProductionBackup(parseArgs(process.argv.slice(2)))
    .then((report) => console.log(JSON.stringify(report, null, 2)))
    .catch((error) => { console.error(error.message); process.exitCode = 1; });
}
