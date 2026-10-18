import { createApplicationDependencies } from '../src/application/dependencies/createApplicationDependencies.js';
import { buildOperationFingerprint } from '../src/application/gateway/idempotency.js';
import {
  IMPORT_TYPES,
  PrepareImportBatch,
  buildImportRowFingerprint,
  createImportDryRunFixtures
} from '../src/application/imports/importBatchUseCases.js';

const now = () => '2026-08-22T12:00:00.000Z';
const context = {
  actorUid: 'dry-run-actor',
  ownerUid: 'dry-run-owner',
  actorRole: 'admin',
  actorStatus: 'active',
  correlationId: 'dry-run-import'
};

async function buildRepositories(fixtures) {
  const existingFingerprint = buildImportRowFingerprint(fixtures.fileA[4]);
  const dependencies = createApplicationDependencies({
    mode: 'memory',
    now,
    records: [{
      ...fixtures.fileA[4],
      id: 'existing-imported-row',
      owner_uid: context.ownerUid,
      import_signature: existingFingerprint
    }]
  });

  const preview = await PrepareImportBatch({
    rows: [fixtures.fileA[5]],
    importType: IMPORT_TYPES.BANK_STATEMENT,
    originalFilename: 'seed-conflict.csv',
    fileContent: [fixtures.fileA[5]],
    context,
    repositories: dependencies.repositories,
    now
  });
  const conflictCandidate = preview.data.candidates[0];
  await dependencies.repositories.idempotency.reserve({
    ownerUid: context.ownerUid,
    commandName: 'ImportRowCommand',
    sourceChannel: conflictCandidate.source_channel,
    idempotencyKey: conflictCandidate.idempotency_key,
    requestFingerprint: buildOperationFingerprint({
      ownerUid: context.ownerUid,
      commandName: 'ImportRowCommand',
      sourceChannel: conflictCandidate.source_channel,
      payload: { simulatedConflict: true }
    }),
    correlationId: context.correlationId
  }, context);

  return dependencies.repositories;
}

function statusCounts(preview) {
  return preview.data.candidates.reduce((acc, candidate) => {
    acc[candidate.status] = (acc[candidate.status] || 0) + 1;
    return acc;
  }, {});
}

async function prepare(name, rows, repositories) {
  const result = await PrepareImportBatch({
    rows,
    importType: IMPORT_TYPES.BANK_STATEMENT,
    originalFilename: name,
    fileContent: rows,
    context,
    repositories,
    now
  });
  return {
    name,
    success: result.success,
    batch_id: result.data.batch.batch_id,
    file_fingerprint: result.data.batch.file_fingerprint,
    summary: result.data.summary,
    status_counts: statusCounts(result)
  };
}

const fixtures = createImportDryRunFixtures();
const repositories = await buildRepositories(fixtures);
const first = await prepare('extrato-original.csv', fixtures.fileA, repositories);
const sameContentDifferentName = await prepare('extrato-renomeado.csv', fixtures.fileBWithSameContentDifferentName, repositories);
const changed = await prepare('extrato-alterado.csv', fixtures.changedFile, repositories);

console.log(JSON.stringify({
  wrote: false,
  production_touched: false,
  firebase_touched: false,
  compared: {
    same_content_same_fingerprint: first.file_fingerprint === sameContentDifferentName.file_fingerprint,
    same_content_same_batch_id: first.batch_id === sameContentDifferentName.batch_id,
    changed_content_new_fingerprint: first.file_fingerprint !== changed.file_fingerprint
  },
  previews: [first, sameContentDifferentName, changed]
}, null, 2));
