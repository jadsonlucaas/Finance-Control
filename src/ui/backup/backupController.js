import {
  CreateFinanceBackupSnapshot,
  PrepareFinanceRestore,
  ValidateFinanceBackupSnapshot
} from '../../application/backup/financeBackupUseCases.js';
import { buildOperationFingerprint } from '../../application/gateway/idempotency.js';
import {
  ASYNC_VIEW_STATUS,
  createAsyncViewState,
  toErrorState,
  toLoadingState,
  toOfflineState,
  toSuccessState
} from '../../application/resilience/asyncViewState.js';
import { normalizeApplicationError } from '../../application/resilience/errorNormalization.js';
import { buildBackupPreviewReadModel } from '../../application/readModels/backupPreviewReadModel.js';
import { buildRestorePreviewReadModel } from '../../application/readModels/restorePreviewReadModel.js';

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function isOnline(connectivity = null) {
  if (connectivity && typeof connectivity.isOnline === 'function') return connectivity.isOnline() !== false;
  return true;
}

function ownerFrom(context = {}) {
  return context.ownerUid || context.actorUid || context.uid || '';
}

export function createBackupController({
  presenter,
  repositoriesProvider,
  contextProvider,
  downloadAdapter,
  fileReader,
  connectivity = null,
  now = () => new Date().toISOString(),
  appVersion = '',
  maxFileBytes = 5 * 1024 * 1024,
  errorReporter = null
} = {}) {
  if (!presenter) throw new Error('BACKUP_PRESENTER_REQUIRED');
  if (typeof repositoriesProvider !== 'function') throw new Error('BACKUP_REPOSITORIES_PROVIDER_REQUIRED');
  if (typeof contextProvider !== 'function') throw new Error('BACKUP_CONTEXT_PROVIDER_REQUIRED');

  let backupState = createAsyncViewState({ status: ASYNC_VIEW_STATUS.IDLE });
  let restoreState = createAsyncViewState({ status: ASYNC_VIEW_STATUS.IDLE });
  let backupEnvelope = null;
  let backupPreview = null;
  let restoreSnapshot = null;
  let restoreValidation = null;
  let restorePreview = null;
  let ownerKey = '';

  function expectedOwnerReference(context = contextProvider() || {}) {
    const owner = ownerFrom(context);
    return owner ? buildOperationFingerprint({
      commandName: 'owner-reference',
      sourceChannel: 'system',
      idempotencyKey: owner,
      payload: owner
    }) : '';
  }

  function publish() {
    presenter.renderBackupPreview(backupPreview, backupState);
    presenter.renderRestorePreview(restorePreview, restoreState);
  }

  function resetForOwner(nextOwnerKey = '') {
    ownerKey = nextOwnerKey;
    backupEnvelope = null;
    backupPreview = null;
    restoreSnapshot = null;
    restoreValidation = null;
    restorePreview = null;
    backupState = createAsyncViewState({ status: ASYNC_VIEW_STATUS.IDLE });
    restoreState = createAsyncViewState({ status: ASYNC_VIEW_STATUS.IDLE });
    publish();
  }

  function ensureOwner() {
    const context = contextProvider() || {};
    const nextOwner = ownerFrom(context);
    if (ownerKey && nextOwner && ownerKey !== nextOwner) resetForOwner(nextOwner);
    if (!ownerKey) ownerKey = nextOwner;
    return context;
  }

  async function generateBackupPreview() {
    const context = ensureOwner();
    if (!isOnline(connectivity)) {
      backupState = toOfflineState(backupState);
      publish();
      return { success: false, error: backupState.error };
    }
    presenter.setBusy(true);
    backupState = toLoadingState(backupState);
    publish();
    try {
      const result = await CreateFinanceBackupSnapshot({
        context,
        repositories: repositoriesProvider(),
        now,
        appVersion
      });
      if (!result.success) throw new Error(result.message || 'BACKUP_FAILED');
      const validation = ValidateFinanceBackupSnapshot({ snapshot: result.data });
      backupEnvelope = result.data;
      backupPreview = buildBackupPreviewReadModel({ backupEnvelope, validation });
      backupState = toSuccessState(backupPreview, now);
      publish();
      return { success: true, backup: backupEnvelope, preview: backupPreview };
    } catch (error) {
      const normalized = normalizeApplicationError(error, { operation: 'backup_preview' });
      errorReporter?.report?.({ error: normalized, operation: 'backup_preview', context });
      backupState = toErrorState(normalized, backupState);
      publish();
      return { success: false, error: normalized };
    } finally {
      presenter.setBusy(false);
    }
  }

  function downloadBackup() {
    ensureOwner();
    if (!backupEnvelope) {
      const error = normalizeApplicationError(new Error('BACKUP_NOT_READY'), { operation: 'backup_download' });
      backupState = toErrorState(error, backupState);
      publish();
      return { success: false, error };
    }
    const result = downloadAdapter?.downloadJson?.(backupEnvelope, { now: now(), version: backupEnvelope.backup_version });
    if (!result?.ok) {
      const error = normalizeApplicationError(new Error(result?.code || 'DOWNLOAD_FAILED'), { operation: 'backup_download' });
      backupState = toErrorState(error, backupState);
      publish();
      return { success: false, error };
    }
    backupState = toSuccessState(backupPreview, now);
    publish();
    return { success: true, data: result };
  }

  async function parseRestoreFile(file) {
    if (!file) throw new Error('BACKUP_FILE_REQUIRED');
    if (Number(file.size || 0) <= 0) throw new Error('BACKUP_FILE_EMPTY');
    if (Number(file.size || 0) > maxFileBytes) throw new Error('BACKUP_FILE_TOO_LARGE');
    const text = fileReader ? await fileReader(file) : await file.text();
    if (!String(text || '').trim()) throw new Error('BACKUP_FILE_EMPTY');
    try {
      return JSON.parse(text);
    } catch {
      throw new Error('BACKUP_JSON_INVALID');
    }
  }

  async function validateRestoreFile(file) {
    const context = ensureOwner();
    presenter.setBusy(true);
    restoreState = toLoadingState(restoreState);
    publish();
    try {
      const snapshot = await parseRestoreFile(file);
      const validation = ValidateFinanceBackupSnapshot({ snapshot, expectedOwnerReference: expectedOwnerReference(context) });
      restoreSnapshot = validation.snapshot || snapshot;
      restoreValidation = validation;
      restorePreview = buildRestorePreviewReadModel({
        backupEnvelope: restoreSnapshot,
        restoreDryRunResult: { success: validation.isValid, data: { items: [], validation }, validation },
        options: { expectedOwnerReference: expectedOwnerReference(context) }
      });
      restoreState = validation.isValid
        ? toSuccessState(restorePreview, now)
        : toErrorState(normalizeApplicationError(new Error(validation.errors[0]?.code || 'BACKUP_INVALID'), { operation: 'restore_validate' }), restoreState);
      publish();
      return { success: validation.isValid, validation, snapshot: restoreSnapshot, preview: restorePreview };
    } catch (error) {
      const normalized = normalizeApplicationError(error, { operation: 'restore_validate' });
      errorReporter?.report?.({ error: normalized, operation: 'restore_validate', context });
      restoreState = toErrorState(normalized, restoreState);
      publish();
      return { success: false, error: normalized };
    } finally {
      presenter.setBusy(false);
    }
  }

  async function runRestoreDryRun(file = null) {
    const context = ensureOwner();
    if (!isOnline(connectivity)) {
      restoreState = toOfflineState(restoreState);
      publish();
      return { success: false, error: restoreState.error };
    }
    presenter.setBusy(true);
    restoreState = toLoadingState(restoreState);
    publish();
    try {
      if (file || !restoreSnapshot) {
        const validated = await validateRestoreFile(file);
        if (!validated.success) return validated;
      }
      const result = await PrepareFinanceRestore({
        snapshot: restoreSnapshot,
        context,
        repositories: repositoriesProvider(),
        now
      });
      if (!result.success) throw new Error(result.message || result.code || 'RESTORE_DRY_RUN_FAILED');
      restorePreview = buildRestorePreviewReadModel({
        backupEnvelope: restoreSnapshot,
        restoreDryRunResult: result,
        options: { expectedOwnerReference: expectedOwnerReference(context) }
      });
      restoreState = toSuccessState(restorePreview, now);
      publish();
      return { success: true, dryRun: result.data, preview: restorePreview, wrote: false };
    } catch (error) {
      const normalized = normalizeApplicationError(error, { operation: 'restore_dry_run' });
      errorReporter?.report?.({ error: normalized, operation: 'restore_dry_run', context });
      restoreState = toErrorState(normalized, restoreState);
      publish();
      return { success: false, error: normalized, wrote: false };
    } finally {
      presenter.setBusy(false);
    }
  }

  function restoreRealUnavailable() {
    const error = normalizeApplicationError(new Error('RESTORE_REAL_UNAVAILABLE'), { operation: 'restore_real' });
    restoreState = toErrorState(error, restoreState);
    publish();
    return { success: false, error, wrote: false };
  }

  return {
    generateBackupPreview,
    downloadBackup,
    validateRestoreFile,
    runRestoreDryRun,
    restoreRealUnavailable,
    resetForOwner,
    getState: () => ({
      backupState,
      restoreState,
      backupEnvelope: clone(backupEnvelope),
      backupPreview: clone(backupPreview),
      restoreSnapshot: clone(restoreSnapshot),
      restoreValidation: clone(restoreValidation),
      restorePreview: clone(restorePreview),
      ownerKey
    })
  };
}
