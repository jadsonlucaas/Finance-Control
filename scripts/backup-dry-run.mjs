import {
  CommitFinanceRestore,
  CreateFinanceBackupSnapshot,
  PrepareFinanceRestore,
  ValidateFinanceBackupSnapshot,
  createBackupDryRunFixtures
} from '../src/application/backup/financeBackupUseCases.js';
import { createApplicationDependencies } from '../src/application/dependencies/createApplicationDependencies.js';

const now = () => '2026-08-23T12:00:00.000Z';
const fixtures = createBackupDryRunFixtures();

function deps(records = []) {
  return createApplicationDependencies({
    mode: 'memory',
    now,
    records
  });
}

const valid = ValidateFinanceBackupSnapshot({ snapshot: fixtures.validSnapshot });
const invalidChecksum = ValidateFinanceBackupSnapshot({ snapshot: fixtures.invalidChecksum });
const forbidden = ValidateFinanceBackupSnapshot({ snapshot: fixtures.forbiddenField });
const duplicate = ValidateFinanceBackupSnapshot({ snapshot: fixtures.duplicateId });
const future = ValidateFinanceBackupSnapshot({ snapshot: fixtures.futureVersion });
const legacy = ValidateFinanceBackupSnapshot({ snapshot: fixtures.legacy });

const emptyDeps = deps([]);
const identicalDeps = deps(fixtures.targetRecords.identical);
const conflictDeps = deps(fixtures.targetRecords.conflict);

const previewNew = await PrepareFinanceRestore({ snapshot: fixtures.validSnapshot, context: fixtures.context, repositories: emptyDeps.repositories, now });
const previewIdentical = await PrepareFinanceRestore({ snapshot: fixtures.validSnapshot, context: fixtures.context, repositories: identicalDeps.repositories, now });
const previewConflict = await PrepareFinanceRestore({ snapshot: fixtures.validSnapshot, context: fixtures.context, repositories: conflictDeps.repositories, now });
const committed = await CommitFinanceRestore({ restorePlan: previewNew.data, context: fixtures.context, repositories: emptyDeps.repositories, now });
const createdBackup = await CreateFinanceBackupSnapshot({ context: fixtures.context, repositories: emptyDeps.repositories, now });

const summary = {
  ok: true,
  wrote: false,
  firebase_touched: false,
  production_touched: false,
  valid_snapshot: valid.isValid,
  checksum_invalid_detected: invalidChecksum.checksumValid === false,
  forbidden_field_detected: forbidden.errors.some((error) => error.code === 'FORBIDDEN_FIELD'),
  duplicate_id_detected: duplicate.errors.some((error) => error.code === 'DUPLICATE_ID'),
  future_version_rejected: future.compatible === false,
  legacy_migrated: legacy.migrated === true,
  restore_preview: {
    new: previewNew.data?.summary?.new || 0,
    identical: previewIdentical.data?.summary?.identical || 0,
    conflict: previewConflict.data?.summary?.conflict || 0,
    operational: fixtures.validSnapshot.operational.audit_logs.length
  },
  in_memory_commit_exercised: committed.success === true,
  created_backup_checksum: createdBackup.data?.checksum || ''
};

console.log(JSON.stringify(summary, null, 2));
