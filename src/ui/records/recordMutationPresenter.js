import {
  ASYNC_VIEW_STATUS,
  createAsyncViewState,
  toErrorState,
  toSuccessState
} from '../../application/resilience/asyncViewState.js';
import {
  MUTATION_OUTCOME_STATE,
  mutationOutcomeFromResult
} from '../../application/resilience/mutationAttemptContext.js';

export function isSuccessfulMutationResult(result = {}) {
  return result.success === true || result.isOk === true;
}

export function isUncertainMutationResult(result = {}) {
  return mutationOutcomeFromResult(result) === MUTATION_OUTCOME_STATE.UNCERTAIN;
}

export function shouldClearMutationAttempt(result = {}) {
  const outcome = mutationOutcomeFromResult(result);
  return isSuccessfulMutationResult(result)
    || outcome === MUTATION_OUTCOME_STATE.RECONCILED_SUCCESS
    || outcome === MUTATION_OUTCOME_STATE.CONFIRMED_SUCCESS
    || outcome === MUTATION_OUTCOME_STATE.PARTIAL_SUCCESS;
}

export function createRecordMutationPresenter(options = {}) {
  const showToast = options.showToast || (() => {});
  const resetForm = options.resetForm || (() => {});
  const refreshAfterMutation = options.refreshAfterMutation || (() => {});
  const reopenAfterEdit = options.reopenAfterEdit || (() => {});
  const now = options.now || (() => new Date().toISOString());

  function present(result = {}, presentation = {}) {
    if (isSuccessfulMutationResult(result)) {
      if (presentation.successMessage) showToast(presentation.successMessage, false);
      if (presentation.reopenAfterEdit) reopenAfterEdit();
      if (presentation.refreshAfterMutation) refreshAfterMutation();
      if (presentation.resetForm) resetForm(presentation.resetForm);
      return toSuccessState(result, now);
    }

    if (isUncertainMutationResult(result)) {
      if (presentation.uncertainMessage) showToast(presentation.uncertainMessage, true);
      return createAsyncViewState({
        status: ASYNC_VIEW_STATUS.STALE,
        data: result,
        lastUpdatedAt: now(),
        retryAvailable: true
      });
    }

    if (presentation.errorMessage) showToast(presentation.errorMessage, true);
    return toErrorState(result.applicationError || result, null);
  }

  return { present };
}
