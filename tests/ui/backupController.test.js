import { describe, expect, it, vi } from 'vitest';
import { createApplicationDependencies } from '../../src/application/dependencies/createApplicationDependencies.js';
import { createBackupController } from '../../src/ui/backup/backupController.js';
import { createBackupDryRunFixtures } from '../../src/application/backup/financeBackupUseCases.js';
import { buildBackupFileName } from '../../src/ui/backup/backupDownloadAdapter.js';

const now = () => '2026-09-06T12:00:00.000Z';
const contextA = { actorUid: 'owner-a', ownerUid: 'owner-a', accountStatus: 'active', sourceChannel: 'web', correlationId: 'backup-ui-test' };
const contextB = { actorUid: 'owner-b', ownerUid: 'owner-b', accountStatus: 'active', sourceChannel: 'web', correlationId: 'backup-ui-test-b' };

function presenter() {
  return {
    renderShell: vi.fn(),
    renderBackupPreview: vi.fn(),
    renderRestorePreview: vi.fn(),
    renderError: vi.fn(),
    setBusy: vi.fn()
  };
}

function controller(options = {}) {
  const deps = createApplicationDependencies({
    mode: 'memory',
    now,
    records: options.records || [
      { id: 'expense-a', type: 'saida', owner_uid: 'owner-a', amount: 10, status: 'Em aberto', competence: '2026-09', schema_version: 1 },
      { id: 'expense-b', type: 'saida', owner_uid: 'owner-b', amount: 99, status: 'Em aberto', competence: '2026-09', schema_version: 1 }
    ]
  });
  return createBackupController({
    presenter: options.presenter || presenter(),
    repositoriesProvider: () => deps.repositories,
    contextProvider: options.contextProvider || (() => contextA),
    downloadAdapter: options.downloadAdapter || { downloadJson: vi.fn(() => ({ ok: true, fileName: 'finance-control-backup-20260906-1200-v1.0.0.json', bytes: 1 })) },
    fileReader: options.fileReader,
    connectivity: options.connectivity,
    now
  });
}

function fileFrom(snapshot, name = 'backup.json') {
  const text = JSON.stringify(snapshot);
  return { name, size: text.length, text: async () => text };
}

describe('backup controller', () => {
  it('generates owner-scoped backup and calls isolated download adapter', async () => {
    const downloadJson = vi.fn(() => ({ ok: true, fileName: 'finance-control-backup-20260906-1200-v1.0.0.json', bytes: 10 }));
    const sut = controller({ downloadAdapter: { downloadJson } });

    const generated = await sut.generateBackupPreview();
    const downloaded = sut.downloadBackup();

    expect(generated.success).toBe(true);
    expect(JSON.stringify(generated.backup)).toContain('expense-a');
    expect(JSON.stringify(generated.backup)).not.toContain('expense-b');
    expect(downloaded.success).toBe(true);
    expect(downloadJson).toHaveBeenCalledTimes(1);
  });

  it('validates invalid and unsupported restore files without writes', async () => {
    const sut = controller();
    const invalidJson = await sut.validateRestoreFile({ name: 'bad.json', size: 3, text: async () => '{x}' });
    const future = createBackupDryRunFixtures().futureVersion;
    future.checksum = 'bad';
    const unsupported = await sut.validateRestoreFile(fileFrom(future));

    expect(invalidJson.success).toBe(false);
    expect(unsupported.success).toBe(false);
    expect(sut.getState().restorePreview.metadata.restoreExecutionAvailable).toBe(false);
  });

  it('runs restore dry-run and never exposes real restore execution', async () => {
    const fixtures = createBackupDryRunFixtures();
    const sut = controller({
      records: [],
      contextProvider: () => fixtures.context
    });
    const result = await sut.runRestoreDryRun(fileFrom(fixtures.validSnapshot));
    const blocked = sut.restoreRealUnavailable();

    expect(result.success).toBe(true);
    expect(result.wrote).toBe(false);
    expect(result.preview.summary.wouldCreate).toBe(1);
    expect(blocked).toMatchObject({ success: false, wrote: false });
  });

  it('clears backup and restore state when owner changes', async () => {
    let activeContext = contextA;
    const sut = controller({ contextProvider: () => activeContext });
    await sut.generateBackupPreview();
    expect(sut.getState().backupPreview.metadata.backupId).toContain('backup_');

    activeContext = contextB;
    await sut.generateBackupPreview();

    expect(sut.getState().ownerKey).toBe('owner-b');
    expect(JSON.stringify(sut.getState().backupEnvelope)).not.toContain('expense-a');
  });

  it('builds file names without uid email or phone', () => {
    const fileName = buildBackupFileName({ now: new Date(2026, 8, 6, 12, 0, 0), version: '1.0.0' });
    expect(fileName).toBe('finance-control-backup-20260906-1200-v1.0.0.json');
    expect(fileName).not.toMatch(/owner|@|telefone|phone|whatsapp/);
  });
});
