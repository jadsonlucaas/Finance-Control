import { describe, expect, it } from 'vitest';
import {
  CreateFinanceBackupSnapshot,
  PrepareFinanceRestore,
  createBackupDryRunFixtures
} from '../../../src/application/backup/financeBackupUseCases.js';
import { createApplicationDependencies } from '../../../src/application/dependencies/createApplicationDependencies.js';
import { buildBackupPreviewReadModel } from '../../../src/application/readModels/backupPreviewReadModel.js';
import { buildRestorePreviewReadModel } from '../../../src/application/readModels/restorePreviewReadModel.js';

const now = () => '2026-09-06T12:00:00.000Z';
const context = {
  actorUid: 'owner-a',
  ownerUid: 'owner-a',
  accountStatus: 'active',
  sourceChannel: 'web',
  correlationId: 'backup-preview-test'
};

function deps(records = []) {
  return createApplicationDependencies({ mode: 'memory', records, now });
}

describe('backup and restore preview read models', () => {
  it('builds deterministic backup preview without mutating or exposing sensitive fields', async () => {
    const source = deps([
      { id: 'expense-1', type: 'saida', owner_uid: 'owner-a', amount: 10, status: 'Em aberto', competence: '2026-09', schema_version: 1, token: 'secret' },
      { id: 'person-1', type: 'pessoa', owner_uid: 'owner-a', person: 'Ana', schema_version: 1 },
      { id: 'other-owner', type: 'saida', owner_uid: 'owner-b', amount: 999, status: 'Em aberto', competence: '2026-09', schema_version: 1 }
    ]);
    const backup = await CreateFinanceBackupSnapshot({ context, repositories: source.repositories, now });
    const input = JSON.parse(JSON.stringify(backup.data));
    const first = buildBackupPreviewReadModel({ backupEnvelope: input });
    const second = buildBackupPreviewReadModel({ backupEnvelope: input });

    expect(first).toEqual(second);
    expect(input).toEqual(backup.data);
    expect(JSON.stringify(first)).not.toMatch(/secret|token|other-owner|999/);
    expect(first.counts).toMatchObject({ finance_records: 1, personal_references: 1 });
    expect(first.warnings).toContain('BACKUP_FIELD_REMOVED:SENSITIVE_FIELD');
  });

  it('classifies restore dry-run without executing writes', async () => {
    const fixtures = createBackupDryRunFixtures();
    const dryRun = await PrepareFinanceRestore({
      snapshot: fixtures.validSnapshot,
      context: fixtures.context,
      repositories: deps(fixtures.targetRecords.conflict).repositories,
      now
    });
    const model = buildRestorePreviewReadModel({
      backupEnvelope: fixtures.validSnapshot,
      restoreDryRunResult: dryRun,
      conflictPolicy: { realRestore: 'blocked' }
    });

    expect(model.summary.wrote).toBe(false);
    expect(model.metadata.restoreExecutionAvailable).toBe(false);
    expect(model.summary.conflicts).toBe(1);
    expect(model.conflicts[0]).toMatchObject({ id: 'expense-1', status: 'conflict' });
  });
});
