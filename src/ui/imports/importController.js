import {
  CommitImportBatch,
  IMPORT_TYPES,
  PrepareImportBatch
} from '../../application/imports/importBatchUseCases.js';
import { APPLICATION_RESULT_CODES } from '../../application/gateway/applicationResult.js';
import { createMutationAttemptContext } from '../../application/resilience/mutationAttemptContext.js';
import { ReconcileMutationAttempt } from '../../application/resilience/reconcileMutationAttempt.js';
import {
  ASYNC_VIEW_STATUS,
  createAsyncViewState,
  toErrorState,
  toLoadingState,
  toOfflineState,
  toSuccessState
} from '../../application/resilience/asyncViewState.js';
import { normalizeApplicationError, normalizeLazyLoadError } from '../../application/resilience/errorNormalization.js';
import { buildImportPreviewReadModel } from '../../application/readModels/importPreviewReadModel.js';
import { startTrace } from '../../services/observability/index.js';

function noop() {}

function isOnline(connectivity = null) {
  if (connectivity && typeof connectivity.isOnline === 'function') return connectivity.isOnline() !== false;
  return true;
}

function fileMetadata(file = null) {
  return {
    name: file?.name || '',
    size: Number(file?.size || 0),
    type: file?.type || '',
    lastModified: Number(file?.lastModified || 0)
  };
}

function getReadyIds(prepared = null) {
  return (prepared?.candidates || [])
    .filter((candidate) => candidate.status === 'ready')
    .map((candidate) => candidate.candidate_id);
}

function normalizePrepareError(error) {
  const message = String(error?.message || error || '');
  if (/XLSX|workbook|chunk|lazy|Failed to fetch dynamically imported module|Loading chunk/i.test(message)) {
    return normalizeLazyLoadError(error, { operation: 'prepare_import_xlsx' });
  }
  return normalizeApplicationError(error, { operation: 'prepare_import' });
}

export function createImportController({
  presenter,
  repositoriesProvider,
  contextProvider,
  parseSpreadsheet,
  loadWorkbook,
  connectivity = null,
  now = () => new Date().toISOString(),
  onAfterCommit = noop,
  errorReporter = null
} = {}) {
  if (!presenter) throw new Error('IMPORT_PRESENTER_REQUIRED');
  if (typeof repositoriesProvider !== 'function') throw new Error('IMPORT_REPOSITORIES_PROVIDER_REQUIRED');
  if (typeof contextProvider !== 'function') throw new Error('IMPORT_CONTEXT_PROVIDER_REQUIRED');
  if (typeof parseSpreadsheet !== 'function') throw new Error('IMPORT_SPREADSHEET_PARSER_REQUIRED');
  if (typeof loadWorkbook !== 'function') throw new Error('IMPORT_WORKBOOK_LOADER_REQUIRED');

  let viewState = createAsyncViewState({ status: ASYNC_VIEW_STATUS.IDLE });
  let selectedFile = null;
  let selectedKind = 'expenses';
  let preparedEnvelope = null;
  let previewModel = null;
  let committing = false;
  let preparing = false;
  let ownerKey = '';
  let attempt = null;

  function publish() {
    presenter.renderPreview(previewModel, viewState);
  }

  function resetForOwner(nextOwnerKey = '') {
    ownerKey = nextOwnerKey;
    selectedFile = null;
    preparedEnvelope = null;
    previewModel = null;
    attempt = null;
    viewState = createAsyncViewState({ status: ASYNC_VIEW_STATUS.IDLE });
    publish();
  }

  function ensureOwner() {
    const context = contextProvider() || {};
    const nextOwner = context.ownerUid || context.actorUid || context.uid || '';
    if (ownerKey && nextOwner && ownerKey !== nextOwner) resetForOwner(nextOwner);
    if (!ownerKey) ownerKey = nextOwner;
    return context;
  }

  async function prepare({ file = selectedFile, kind = selectedKind } = {}) {
    if (preparing) return { ignored: true, reason: 'PREPARE_IN_PROGRESS' };
    const context = ensureOwner();
    if (!context.ownerUid && !context.actorUid && !context.uid) {
      const error = normalizeApplicationError(new Error('AUTH_REQUIRED'), { operation: 'prepare_import' });
      viewState = toErrorState(error, viewState);
      publish();
      return { success: false, error };
    }
    if (!isOnline(connectivity)) {
      viewState = toOfflineState(viewState);
      publish();
      return { success: false, error: viewState.error };
    }
    if (!file) {
      const error = normalizeApplicationError(new Error('NO_FILE'), { operation: 'prepare_import' });
      viewState = toErrorState(error, viewState);
      publish();
      return { success: false, error };
    }

    preparing = true;
    const importTrace = startTrace('import.xlsx.prepare', {
      operation: 'import.xlsx.prepare',
      import_kind: kind || 'expenses'
    });
    presenter.setBusy(true);
    viewState = toLoadingState(viewState);
    publish();

    try {
      selectedFile = file;
      selectedKind = kind || 'expenses';
      const workbook = await loadWorkbook(file);
      const parsed = await parseSpreadsheet(workbook, { kind: selectedKind });
      if (!parsed.ok && !parsed.rows.length) {
        throw new Error(parsed.errors?.[0]?.message || 'Planilha invalida para importacao.');
      }
      const repositories = repositoriesProvider();
      const prepared = await PrepareImportBatch({
        rows: parsed.rows,
        importType: IMPORT_TYPES.SPREADSHEET,
        originalFilename: file.name || 'importacao.xlsx',
        fileContent: parsed.rows,
        context,
        repositories,
        mapRowToPayload: (row) => row,
        now
      });
      if (!prepared.success) throw new Error(prepared.message || 'PREPARE_FAILED');
      preparedEnvelope = {
        parsed,
        prepared: prepared.data,
        result: prepared,
        context,
        repositories,
        fileMetadata: fileMetadata(file)
      };
      previewModel = buildImportPreviewReadModel({
        preparedBatch: prepared.data,
        parsed,
        source: 'spreadsheet_import',
        fileMetadata: fileMetadata(file),
        options: { kind: selectedKind }
      });
      attempt = createMutationAttemptContext({
        commandName: 'CommitImportBatch',
        sourceChannel: 'spreadsheet_import',
        idempotencyKey: prepared.data?.batch?.idempotency_key || '',
        correlationId: prepared.data?.batch?.correlation_id || context.correlationId || '',
        payload: {
          batch_id: prepared.data?.batch?.batch_id || '',
          file_fingerprint: prepared.data?.batch?.file_fingerprint || '',
          ready: getReadyIds(prepared.data)
        },
        context
      }, { now });
      viewState = toSuccessState(previewModel, now);
      publish();
      importTrace.finish('ok', {
        ready_count: previewModel?.ready?.length || 0,
        invalid_count: previewModel?.invalid?.length || 0,
        duplicate_count: previewModel?.duplicates?.length || 0
      });
      return { success: true, preview: previewModel, prepared: prepared.data };
    } catch (error) {
      importTrace.finish('error', { stage: 'parse_or_prepare' });
      const normalized = normalizePrepareError(error);
      errorReporter?.report?.({ error: normalized, operation: normalized.operation || 'prepare_import', context });
      viewState = toErrorState(normalized, viewState);
      publish();
      return { success: false, error: normalized };
    } finally {
      preparing = false;
      presenter.setBusy(false);
    }
  }

  async function reconcile() {
    if (!attempt || !preparedEnvelope) return { success: false, message: 'Tentativa sem dados para reconciliar.' };
    const result = await ReconcileMutationAttempt({
      attempt,
      context: preparedEnvelope.context,
      repositories: preparedEnvelope.repositories,
      payload: {
        batch_id: preparedEnvelope.prepared?.batch?.batch_id || '',
        file_fingerprint: preparedEnvelope.prepared?.batch?.file_fingerprint || '',
        ready: getReadyIds(preparedEnvelope.prepared)
      },
      now
    });
    if (result.success) {
      presenter.renderCommitResult({ replay: true, result });
      viewState = toSuccessState(previewModel, now);
    }
    return result;
  }

  async function commit() {
    if (committing) return { ignored: true, reason: 'COMMIT_IN_PROGRESS' };
    ensureOwner();
    if (!preparedEnvelope?.prepared) {
      const error = normalizeApplicationError(new Error('NO_PREVIEW'), { operation: 'commit_import' });
      viewState = toErrorState(error, viewState);
      publish();
      return { success: false, error };
    }
    if (!previewModel?.ready?.length) {
      const error = normalizeApplicationError(new Error('VALIDATION_NO_READY_ROWS'), { operation: 'commit_import' });
      viewState = toErrorState(error, viewState);
      publish();
      return { success: false, error };
    }
    if (!isOnline(connectivity)) {
      viewState = toOfflineState(viewState);
      publish();
      return { success: false, error: viewState.error };
    }

    committing = true;
    const commitTrace = startTrace('import.commit', {
      operation: 'import.commit',
      ready_count: previewModel.ready.length
    });
    presenter.setBusy(true);
    viewState = toLoadingState(viewState);
    publish();

    try {
      const reconciled = await reconcile();
      if (reconciled.success && reconciled.code === APPLICATION_RESULT_CODES.IDEMPOTENT_REPLAY) {
        commitTrace.finish('ok', { idempotent_replay: true });
        onAfterCommit(reconciled);
        return reconciled;
      }
      const result = await CommitImportBatch({
        preparedBatch: preparedEnvelope.prepared,
        selectedCandidateIds: previewModel.ready.map((row) => row.id),
        context: preparedEnvelope.context,
        repositories: preparedEnvelope.repositories,
        now
      });
      if (!result.success) throw new Error(result.message || 'COMMIT_FAILED');
      presenter.renderCommitResult({ replay: result.idempotentReplay, result });
      viewState = toSuccessState(previewModel, now);
      onAfterCommit(result);
      commitTrace.finish('ok', { idempotent_replay: Boolean(result.idempotentReplay) });
      return result;
    } catch (error) {
      commitTrace.finish('error', { mutation_outcome: 'uncertain' });
      const normalized = normalizeApplicationError(error, { operation: 'commit_import' });
      errorReporter?.report?.({ error: normalized, operation: 'commit_import', context: preparedEnvelope.context });
      viewState = toErrorState(normalized, viewState);
      publish();
      return { success: false, data: { mutationOutcome: 'uncertain' }, error: normalized };
    } finally {
      committing = false;
      presenter.setBusy(false);
    }
  }

  function clear() {
    resetForOwner(ownerKey);
  }

  return {
    prepare,
    commit,
    reconcile,
    clear,
    setFile(file) {
      selectedFile = file || null;
    },
    setKind(kind) {
      selectedKind = kind || 'expenses';
    },
    resetForOwner,
    getState: () => ({
      viewState,
      previewModel,
      preparedEnvelope,
      committing,
      preparing,
      ownerKey,
      selectedFile: fileMetadata(selectedFile),
      selectedKind
    })
  };
}
