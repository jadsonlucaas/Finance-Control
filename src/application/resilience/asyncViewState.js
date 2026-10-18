import { APPLICATION_ERROR_CATEGORIES, isApplicationError, serializeApplicationError } from './applicationError.js';
import { normalizeApplicationError } from './errorNormalization.js';

export const ASYNC_VIEW_STATUS = Object.freeze({
  IDLE: 'idle',
  LOADING: 'loading',
  SUCCESS: 'success',
  EMPTY: 'empty',
  ERROR: 'error',
  STALE: 'stale',
  OFFLINE: 'offline'
});

export function createAsyncViewState(input = {}) {
  const status = input.status || ASYNC_VIEW_STATUS.IDLE;
  if (!Object.values(ASYNC_VIEW_STATUS).includes(status)) throw new Error(`ASYNC_VIEW_STATUS_INVALID:${status}`);
  const error = input.error
    ? serializeApplicationError(isApplicationError(input.error) ? input.error : normalizeApplicationError(input.error, input.context))
    : null;
  return {
    status,
    data: input.data ?? null,
    error,
    lastUpdatedAt: input.lastUpdatedAt || '',
    isRefreshing: input.isRefreshing === true,
    retryAvailable: input.retryAvailable === true
  };
}

export function toLoadingState(previous = null) {
  return createAsyncViewState({
    status: previous?.data ? ASYNC_VIEW_STATUS.STALE : ASYNC_VIEW_STATUS.LOADING,
    data: previous?.data ?? null,
    lastUpdatedAt: previous?.lastUpdatedAt || '',
    isRefreshing: Boolean(previous?.data),
    retryAvailable: false
  });
}

export function toSuccessState(data, now = () => new Date().toISOString()) {
  const empty = Array.isArray(data) ? data.length === 0 : data === null || data === undefined;
  return createAsyncViewState({
    status: empty ? ASYNC_VIEW_STATUS.EMPTY : ASYNC_VIEW_STATUS.SUCCESS,
    data,
    lastUpdatedAt: now(),
    isRefreshing: false,
    retryAvailable: false
  });
}

export function toErrorState(error, previous = null) {
  const normalized = isApplicationError(error) ? error : normalizeApplicationError(error);
  return createAsyncViewState({
    status: previous?.data ? ASYNC_VIEW_STATUS.STALE : ASYNC_VIEW_STATUS.ERROR,
    data: previous?.data ?? null,
    error: normalized,
    lastUpdatedAt: previous?.lastUpdatedAt || '',
    isRefreshing: false,
    retryAvailable: normalized.retryable === true
  });
}

export function toOfflineState(previous = null) {
  return createAsyncViewState({
    status: ASYNC_VIEW_STATUS.OFFLINE,
    data: previous?.data ?? null,
    error: {
      code: 'CLIENT_OFFLINE',
      category: APPLICATION_ERROR_CATEGORIES.OFFLINE,
      severity: 'warning',
      message: 'Client is offline.',
      userMessage: 'Voce esta offline. Os dados nao foram salvos.',
      retryable: true,
      operation: '',
      correlationId: '',
      causeCode: '',
      details: {},
      occurredAt: new Date().toISOString(),
      schemaVersion: 1
    },
    lastUpdatedAt: previous?.lastUpdatedAt || '',
    isRefreshing: false,
    retryAvailable: true
  });
}

export function createViewStatePilot(name, initialData = null) {
  let state = createAsyncViewState({ status: ASYNC_VIEW_STATUS.IDLE, data: initialData });
  return {
    name,
    getState: () => state,
    loading: () => {
      state = toLoadingState(state);
      return state;
    },
    success: (data) => {
      state = toSuccessState(data);
      return state;
    },
    error: (error) => {
      state = toErrorState(error, state);
      return state;
    },
    offline: () => {
      state = toOfflineState(state);
      return state;
    }
  };
}
