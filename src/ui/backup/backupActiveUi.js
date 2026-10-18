import { createBackupController } from './backupController.js';
import { createBackupPresenter } from './backupPresenter.js';
import { createBackupDownloadAdapter } from './backupDownloadAdapter.js';

function currentContext(target = globalThis) {
  const profile = target.currentUserProfile || {};
  const uid = target.currentUser?.uid
    || target.auth?.currentUser?.uid
    || target.authSdk?.getCurrentUser?.()?.uid
    || profile.uid
    || '';
  const role = target.currentUserRole || profile.role || 'user';
  return {
    actorUid: uid,
    uid,
    ownerUid: uid,
    actorType: role === 'admin' || role === 'owner' ? 'admin' : 'user',
    role,
    accountStatus: target.currentAccountStatus || profile.status || 'active',
    sourceChannel: 'web',
    correlationId: `backup-ui-${Date.now()}`
  };
}

function repositories(target = globalThis) {
  return target.financeApp?.applicationDependencies?.repositories;
}

function bind(target, controller) {
  const documentRef = target.document;
  if (!documentRef || documentRef.documentElement.dataset.financeBackupModernActionsBound) return;
  documentRef.addEventListener('click', (event) => {
    const action = event.target.closest?.('[id]')?.id || '';
    if (action === 'btn-backup-preview') controller.generateBackupPreview();
    if (action === 'btn-backup-download') controller.downloadBackup();
    if (action === 'btn-backup-validate-restore') {
      controller.validateRestoreFile(documentRef.getElementById('backup-restore-file')?.files?.[0] || null);
    }
    if (action === 'btn-backup-restore-dry-run') {
      controller.runRestoreDryRun(documentRef.getElementById('backup-restore-file')?.files?.[0] || null);
    }
    if (action === 'btn-backup-restore-real') controller.restoreRealUnavailable();
  });
  documentRef.documentElement.dataset.financeBackupModernActionsBound = 'true';
}

export function installBackupActiveUi(target = globalThis, options = {}) {
  if (!target?.document) return null;
  const presenter = options.presenter || createBackupPresenter({ documentRef: target.document });
  const controller = options.controller || createBackupController({
    presenter,
    repositoriesProvider: options.repositoriesProvider || (() => repositories(target)),
    contextProvider: options.contextProvider || (() => currentContext(target)),
    downloadAdapter: options.downloadAdapter || createBackupDownloadAdapter(target),
    fileReader: options.fileReader,
    connectivity: options.connectivity || target.financeApp?.applicationDependencies?.services?.connectivity,
    now: options.now,
    appVersion: options.appVersion || target.financeApp?.version || '',
    errorReporter: options.errorReporter || target.financeApp?.applicationDependencies?.services?.errorReporter
  });

  presenter.renderShell();
  bind(target, controller);

  const state = target.financeApp || {};
  target.financeApp = state;
  state.backupActiveUi = {
    installed: true,
    controller,
    presenter,
    render: () => presenter.renderShell()
  };

  return state.backupActiveUi;
}
