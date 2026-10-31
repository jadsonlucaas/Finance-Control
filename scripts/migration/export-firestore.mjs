import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, isAbsolute, relative, resolve } from 'node:path';
import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { firebaseCliApplicationDefaultPath } from './firebase-admin-credential.mjs';

const PROJECT_ID = 'finance-control-cce4f';
const EXPORTER_VERSION = 2;
const MAX_PASSES = 4;
const DISCOVERY_CONCURRENCY = 4;

function option(name) { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : ''; }
function sha(value) { return createHash('sha256').update(value).digest('hex'); }
function inside(child, parent) { const value = relative(resolve(parent), resolve(child)); return value === '' || (!value.startsWith('..') && !isAbsolute(value)); }
function assertAuthorized() {
  if (!process.argv.includes('--allow-production-read')) throw new Error('PRODUCTION_READ_ACK_REQUIRED');
  if (option('--project') !== PROJECT_ID) throw new Error('PRODUCTION_PROJECT_MISMATCH');
  const output = resolve(option('--output') || '');
  if (!option('--output') || inside(output, process.cwd())) throw new Error('OUTPUT_MUST_BE_OUTSIDE_REPOSITORY');
  return { output, dryRun: process.argv.includes('--dry-run') };
}

function jsonSafe(value) {
  if (Buffer.isBuffer(value) || value instanceof Uint8Array) return { __firestore_bytes_base64: Buffer.from(value).toString('base64') };
  if (Array.isArray(value)) return value.map(jsonSafe);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, jsonSafe(item)]));
  return value;
}

async function mapLimit(values, limit, mapper) {
  const results = new Array(values.length);
  let cursor = 0;
  async function worker() {
    while (cursor < values.length) {
      const index = cursor++;
      results[index] = await mapper(values[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, values.length) }, worker));
  return results;
}

async function walkCollection(collection, rows, collectionCounts, depth = 0) {
  const snapshot = await collection.orderBy('__name__').get();
  for (const document of snapshot.docs) {
    const path = document.ref.path;
    const collectionPath = document.ref.parent.path;
    const collectionId = document.ref.parent.id;
    collectionCounts[collectionId] = (collectionCounts[collectionId] || 0) + 1;
    rows.push({
      document_id: document.id,
      document_path: path,
      collection_id: collectionId,
      collection_path: collectionPath,
      parent_path: document.ref.parent.parent?.path || null,
      create_time: document.createTime.toDate().toISOString(),
      update_time: document.updateTime.toDate().toISOString(),
      fields: jsonSafe(document._fieldsProto || {})
    });
  }
  // The application schema permits root collections and direct subcollections only.
  // Discover every direct child dynamically, but never issue one collection-list call
  // per leaf document: that pattern exhausts the Spark-plan collection-ID quota.
  if (depth === 0) {
    const childGroups = await mapLimit(snapshot.docs, DISCOVERY_CONCURRENCY, (document) => document.ref.listCollections());
    const children = childGroups.flat().sort((a, b) => a.path.localeCompare(b.path));
    for (const child of children) await walkCollection(child, rows, collectionCounts, depth + 1);
  }
}

async function capture(db) {
  const rows = [];
  const collectionCounts = {};
  const roots = await db.listCollections();
  for (const root of roots.sort((a, b) => a.path.localeCompare(b.path))) await walkCollection(root, rows, collectionCounts, 0);
  rows.sort((a, b) => a.document_path.localeCompare(b.document_path));
  const signature = sha(rows.map(({ document_path, update_time }) => `${document_path}\t${update_time}`).join('\n'));
  return { rows, collectionCounts, rootCollections: roots.map(({ id }) => id).sort(), signature };
}

async function writeBackup(output, captureResult, startedAt, finishedAt, passes) {
  const parent = dirname(output);
  await mkdir(parent, { recursive: true });
  try { await stat(output); throw new Error('OUTPUT_ALREADY_EXISTS'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const staging = await mkdtemp(resolve(parent, `.${basename(output)}-`));
  try {
    const groups = new Map();
    for (const row of captureResult.rows) {
      const rows = groups.get(row.collection_id) || [];
      rows.push(row);
      groups.set(row.collection_id, rows);
    }
    await mkdir(resolve(staging, 'firestore'), { recursive: true });
    await mkdir(resolve(staging, 'metadata'), { recursive: true });
    const files = {};
    for (const [collectionId, rows] of [...groups].sort(([a], [b]) => a.localeCompare(b))) {
      const relativePath = `firestore/${collectionId}.jsonl`;
      const content = `${rows.map((row) => JSON.stringify(row)).join('\n')}\n`;
      await writeFile(resolve(staging, relativePath), content, { flag: 'wx' });
      files[relativePath] = { count: rows.length, sha256: sha(content) };
    }
    const counts = { total_documents: captureResult.rows.length, by_collection_id: captureResult.collectionCounts, root_collections: captureResult.rootCollections };
    await writeFile(resolve(staging, 'collection-counts.json'), JSON.stringify(counts, null, 2));
    files['collection-counts.json'] = { count: 1, sha256: sha(await readFile(resolve(staging, 'collection-counts.json'))) };
    const exportInfo = { backup_started_at: startedAt, backup_finished_at: finishedAt, reconciliation: 'two_consecutive_full_passes', stable_passes: passes, stable_signature_sha256: captureResult.signature };
    await writeFile(resolve(staging, 'metadata/export-info.json'), JSON.stringify(exportInfo, null, 2));
    files['metadata/export-info.json'] = { count: 1, sha256: sha(await readFile(resolve(staging, 'metadata/export-info.json'))) };
    const manifest = { backup_version: 2, exporter_version: EXPORTER_VERSION, created_at: finishedAt, source_project_id: PROJECT_ID, source_environment: 'production', repo_commit_sha: process.env.REPO_COMMIT_SHA || 'unknown', schema_version: 'firestore-wire-value-v1', auth_count: null, collection_counts: captureResult.collectionCounts, files };
    manifest.files_sha256 = sha(Object.entries(files).sort(([a], [b]) => a.localeCompare(b)).map(([name, meta]) => `${name}:${meta.sha256}`).join('\n'));
    await writeFile(resolve(staging, 'manifest.json'), JSON.stringify(manifest, null, 2));
    const checksums = Object.fromEntries((await Promise.all(Object.keys(files).concat('manifest.json').map(async (name) => [name, sha(await readFile(resolve(staging, name)))]))).sort(([a], [b]) => a.localeCompare(b)));
    await writeFile(resolve(staging, 'backup-checksums.json'), JSON.stringify({ algorithm: 'sha256', files: checksums, manifest_sha256: checksums['manifest.json'] }, null, 2));
    await rename(staging, output);
  } catch (error) {
    await rm(staging, { recursive: true, force: true });
    throw error;
  }
}

async function main() {
  const { output, dryRun } = assertAuthorized();
  process.env.GOOGLE_APPLICATION_CREDENTIALS ||= await firebaseCliApplicationDefaultPath();
  const app = getApps()[0] || initializeApp({ projectId: PROJECT_ID, credential: applicationDefault() }, 'production-read-only-export');
  const db = getFirestore(app);
  const startedAt = new Date().toISOString();
  let previous;
  for (let pass = 1; pass <= MAX_PASSES; pass += 1) {
    const current = await capture(db);
    console.log(JSON.stringify({ pass, total_documents: current.rows.length, collection_counts: current.collectionCounts, payloads_logged: false }));
    if (previous?.signature === current.signature) {
      if (!dryRun) await writeBackup(output, current, startedAt, new Date().toISOString(), pass);
      console.log(JSON.stringify({ consistent: true, passes: pass, dry_run: dryRun, output_logged: false }));
      return;
    }
    previous = current;
  }
  throw new Error('TEMPORAL_RECONCILIATION_DID_NOT_STABILIZE');
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
