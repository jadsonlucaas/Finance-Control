import { normalizeCommandEnvelope } from '../../application/gateway/applicationEnvelope.js';
import {
  createViewStatePilot,
  toOfflineState
} from '../../application/resilience/asyncViewState.js';
import { normalizeApplicationError } from '../../application/resilience/errorNormalization.js';
import {
  MUTATION_OUTCOME_STATE,
  mutationOutcomeFromResult
} from '../../application/resilience/mutationAttemptContext.js';
import { buildHourControlReadModel } from '../../application/readModels/hourControlReadModel.js';
import { createHourControlPresenter } from './hourControlPresenter.js';

const SOURCE_REFERENCE_ID = 'hour-control';
const UNCERTAIN_MESSAGE = 'Nao foi possivel confirmar o lancamento de horas. Verifique antes de reenviar.';

function success(result = {}) {
  return result.success === true || result.isOk === true;
}

function needsAttempt(result = {}) {
  return mutationOutcomeFromResult(result) === MUTATION_OUTCOME_STATE.UNCERTAIN;
}

function actorFrom(authContext = {}) {
  const role = authContext.role || 'user';
  return {
    type: role === 'admin' ? 'admin' : 'user',
    id: authContext.actorUid || authContext.uid || authContext.ownerUid || 'web-user',
    role
  };
}

function createEnvelope({ commandName, payload, authContext, attempt, now }) {
  return normalizeCommandEnvelope({
    commandName,
    schemaVersion: 1,
    actor: actorFrom(authContext),
    source: {
      channel: 'web',
      referenceId: SOURCE_REFERENCE_ID
    },
    idempotencyKey: attempt?.idempotencyKey || '',
    correlationId: attempt?.correlationId || '',
    requestedAt: attempt?.createdAt || now(),
    payload
  }, { now });
}

export function createHourControlController(dependencies = {}) {
  const readSource = dependencies.readSource || { read: () => [] };
  const readModel = dependencies.readModel || buildHourControlReadModel;
  const presenter = dependencies.presenter || createHourControlPresenter();
  const connectivity = dependencies.connectivity || { isOnline: () => true };
  const errorReporter = dependencies.errorReporter || { capture: () => {} };
  const viewState = dependencies.viewState || createViewStatePilot('hour-control');
  const gatewayProvider = dependencies.gatewayProvider || (() => dependencies.gateway || null);
  const authContextProvider = dependencies.authContextProvider || (() => dependencies.authContext || {});
  const attemptStore = dependencies.attemptStore || null;
  const reconciler = dependencies.reconciler || null;
  const now = dependencies.now || (() => new Date().toISOString());
  const subscriptions = new Set();
  const submittingKeys = new Set();
  let currentFilters = {};

  function cleanupSubscriptions() {
    for (const unsubscribe of subscriptions) {
      if (typeof unsubscribe === 'function') unsubscribe();
    }
    subscriptions.clear();
  }

  async function load(filters = currentFilters) {
    currentFilters = { ...filters };
    if (typeof connectivity.isOnline === 'function' && connectivity.isOnline() === false) {
      const offline = toOfflineState(viewState.getState());
      presenter.render(offline);
      return offline;
    }

    presenter.render(viewState.loading());
    try {
      const payload = await readSource.read(currentFilters);
      const model = readModel({
        records: payload?.records || [],
        hourEntries: payload?.hourEntries || undefined,
        salaryHistory: payload?.salaryHistory || undefined,
        filters: currentFilters,
        referenceData: payload?.referenceData || {},
        metadata: payload?.metadata || {},
        options: payload?.options || {}
      });
      const state = viewState.success(model);
      presenter.render(state);
      return state;
    } catch (error) {
      const normalized = normalizeApplicationError(error, { operation: 'hourControl.load' });
      errorReporter.capture?.(normalized);
      const state = viewState.error(normalized);
      presenter.render(state);
      return state;
    }
  }

  function setFilters(filters = {}) {
    currentFilters = { ...currentFilters, ...filters };
    return load(currentFilters);
  }

  function subscribe(factory) {
    const unsubscribe = typeof factory === 'function' ? factory((payload = {}) => load(payload.filters || currentFilters)) : null;
    if (typeof unsubscribe === 'function') subscriptions.add(unsubscribe);
    return unsubscribe;
  }

  async function executeHourCommand(commandName, payload = {}, options = {}) {
    const attemptKey = options.attemptKey || `${commandName}:${payload.id || payload.person || SOURCE_REFERENCE_ID}:${payload.competence || payload.occurredDate || ''}`;
    if (submittingKeys.has(attemptKey) && options.blockConcurrent !== false) {
      return { success: false, code: 'CLIENT_SUBMIT_IN_PROGRESS', message: 'Operacao de horas ja em andamento.' };
    }
    submittingKeys.add(attemptKey);
    try {
      const gateway = options.gateway || gatewayProvider();
      const authContext = options.authContext || authContextProvider();
      if (options.useGateway === false || !gateway) {
        return typeof options.fallback === 'function' ? options.fallback() : { success: false, code: 'GATEWAY_UNAVAILABLE' };
      }

      const attempt = attemptStore?.getOrCreate?.({
        key: attemptKey,
        commandName,
        payload,
        authContext,
        sourceReferenceId: SOURCE_REFERENCE_ID
      });
      const envelope = createEnvelope({ commandName, payload, authContext, attempt, now });
      const result = await gateway.executeCommand(envelope, { authContext });
      if (success(result) || !needsAttempt(result)) attemptStore?.clear?.(attemptKey);
      presenter.presentMutation(result, {
        commandName,
        attemptKey,
        successMessage: options.successMessage || 'Lancamento de horas salvo!',
        errorMessage: options.errorMessage || 'Erro ao salvar lancamento de horas',
        uncertainMessage: options.uncertainMessage || UNCERTAIN_MESSAGE,
        resetForm: options.resetForm,
        refreshAfterMutation: options.refreshAfterMutation
      });
      return result;
    } finally {
      submittingKeys.delete(attemptKey);
    }
  }

  function createHourEntry(payload = {}, options = {}) {
    return executeHourCommand('CreateHourEntryCommand', payload, options);
  }

  function updateHourEntry(input = {}, options = {}) {
    return executeHourCommand('UpdateHourEntryCommand', input, options);
  }

  async function reconcileAttempt(attempt = {}, options = {}) {
    if (!reconciler?.reconcile) return { success: false, code: 'RECONCILER_UNAVAILABLE' };
    return reconciler.reconcile(attempt, options);
  }

  return {
    load,
    setFilters,
    subscribe,
    destroy: cleanupSubscriptions,
    createHourEntry,
    updateHourEntry,
    reconcileAttempt,
    isSubmitting: (key = '') => key ? submittingKeys.has(key) : submittingKeys.size > 0,
    getSubscriptionCount: () => subscriptions.size,
    getState: viewState.getState
  };
}
