import { normalizeCommandEnvelope } from '../../application/gateway/applicationEnvelope.js';
import {
  MUTATION_OUTCOME_STATE,
  mutationOutcomeFromResult
} from '../../application/resilience/mutationAttemptContext.js';

const DEFAULT_SOURCE = 'record-form';
const UNCERTAIN_MESSAGE = 'Nao foi possivel confirmar a gravacao. Verifique novamente antes de reenviar.';

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

function createEnvelope({ commandName, payload, authContext, attempt, sourceReferenceId, now }) {
  return normalizeCommandEnvelope({
    commandName,
    schemaVersion: 1,
    actor: actorFrom(authContext),
    source: {
      channel: 'web',
      referenceId: sourceReferenceId || DEFAULT_SOURCE
    },
    idempotencyKey: attempt?.idempotencyKey || '',
    correlationId: attempt?.correlationId || '',
    requestedAt: attempt?.createdAt || now(),
    payload
  }, { now });
}

export function createIncomeFormController(dependencies = {}) {
  const gatewayProvider = dependencies.gatewayProvider || (() => dependencies.gateway || null);
  const authContextProvider = dependencies.authContextProvider || (() => dependencies.authContext || {});
  const attemptStore = dependencies.attemptStore;
  const presenter = dependencies.presenter || { present: () => null };
  const now = dependencies.now || (() => new Date().toISOString());
  let submitting = false;

  async function createIncome(payload = {}, options = {}) {
    if (submitting && options.blockConcurrent !== false) {
      return { success: false, code: 'CLIENT_SUBMIT_IN_PROGRESS', message: 'Operacao ja em andamento.' };
    }
    submitting = true;
    const attemptKey = options.attemptKey || DEFAULT_SOURCE;
    try {
      const gateway = options.gateway || gatewayProvider();
      const authContext = options.authContext || authContextProvider();
      if (options.useGateway === false || !gateway) {
        return typeof options.fallback === 'function' ? options.fallback() : { success: false, code: 'GATEWAY_UNAVAILABLE' };
      }
      const attempt = attemptStore?.getOrCreate?.({
        key: attemptKey,
        commandName: 'CreateIncomeCommand',
        payload,
        authContext,
        sourceReferenceId: options.sourceReferenceId || DEFAULT_SOURCE
      });
      const result = await gateway.executeCommand(createEnvelope({
        commandName: 'CreateIncomeCommand',
        payload,
        authContext,
        attempt,
        sourceReferenceId: options.sourceReferenceId,
        now
      }), { authContext });
      if (success(result) || mutationOutcomeFromResult(result) !== MUTATION_OUTCOME_STATE.UNCERTAIN) {
        attemptStore?.clear?.(attemptKey);
      }
      presenter.present(result, {
        successMessage: options.successMessage || 'Entrada salva!',
        errorMessage: options.errorMessage || 'Erro ao salvar',
        uncertainMessage: options.uncertainMessage || UNCERTAIN_MESSAGE,
        resetForm: options.resetForm
      });
      return result;
    } finally {
      submitting = false;
    }
  }

  return {
    createIncome,
    isSubmitting: () => submitting,
    needsAttempt
  };
}
