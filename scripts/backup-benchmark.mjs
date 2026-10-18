import { performance } from 'node:perf_hooks';
import {
  CreateFinanceBackupSnapshot,
  PrepareFinanceRestore,
  ValidateFinanceBackupSnapshot
} from '../src/application/backup/financeBackupUseCases.js';
import { createApplicationDependencies } from '../src/application/dependencies/createApplicationDependencies.js';
import { buildBackupPreviewReadModel } from '../src/application/readModels/backupPreviewReadModel.js';
import { buildRestorePreviewReadModel } from '../src/application/readModels/restorePreviewReadModel.js';

function records(count) {
  return Array.from({ length: count }, (_, index) => ({
    id: `backup-record-${index}`,
    type: index % 4 === 0 ? 'entrada' : 'saida',
    owner_uid: 'backup-bench',
    amount: (index % 31) + 1,
    competence: '2026-08',
    status: 'Em aberto',
    schema_version: 1
  }));
}

const context = { actorUid: 'backup-bench', ownerUid: 'backup-bench', accountStatus: 'active', sourceChannel: 'web', correlationId: 'backup-benchmark' };
const now = () => '2026-08-23T12:00:00.000Z';
const results = [];

for (const size of [100, 1000, 5000]) {
  const dependencies = createApplicationDependencies({ mode: 'memory', records: records(size), now });
  const buildStarted = performance.now();
  const snapshot = await CreateFinanceBackupSnapshot({ context, repositories: dependencies.repositories, now });
  const buildBackupMs = performance.now() - buildStarted;

  const serializationStarted = performance.now();
  const serialized = JSON.stringify(snapshot.data);
  const serializationMs = performance.now() - serializationStarted;

  const validationStarted = performance.now();
  const validation = ValidateFinanceBackupSnapshot({ snapshot: snapshot.data });
  const validationMs = performance.now() - validationStarted;

  const backupPreviewStarted = performance.now();
  const backupPreview = buildBackupPreviewReadModel({ backupEnvelope: snapshot.data, validation });
  const backupPreviewMs = performance.now() - backupPreviewStarted;

  const restoreStarted = performance.now();
  const restore = await PrepareFinanceRestore({ snapshot: snapshot.data, context, repositories: createApplicationDependencies({ mode: 'memory', records: [], now }).repositories, now });
  const restoreDryRunMs = performance.now() - restoreStarted;

  const restorePreviewStarted = performance.now();
  const restorePreview = buildRestorePreviewReadModel({ backupEnvelope: snapshot.data, restoreDryRunResult: restore });
  const restorePreviewMs = performance.now() - restorePreviewStarted;
  const totalMs = buildBackupMs + serializationMs + validationMs + backupPreviewMs + restoreDryRunMs + restorePreviewMs;
  results.push({
    size,
    buildBackupMs: Number(buildBackupMs.toFixed(3)),
    serializationMs: Number(serializationMs.toFixed(3)),
    validationMs: Number(validationMs.toFixed(3)),
    backupPreviewReadModelMs: Number(backupPreviewMs.toFixed(3)),
    restoreDryRunMs: Number(restoreDryRunMs.toFixed(3)),
    restorePreviewReadModelMs: Number(restorePreviewMs.toFixed(3)),
    totalMs: Number(totalMs.toFixed(3)),
    snapshotSuccess: snapshot.success,
    validationValid: validation.isValid,
    restorePrepared: restore.success,
    serializedBytes: serialized.length,
    backupPreviewTotal: backupPreview.totalRecords,
    restoreWouldCreate: restorePreview.summary.wouldCreate,
    wrote: false
  });
}

console.log(JSON.stringify({ ok: results.every((item) => item.snapshotSuccess && item.validationValid && item.restorePrepared), wrote: false, results }, null, 2));
