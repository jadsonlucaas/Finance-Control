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

export function createExpenseFormController(dependencies = {}) {
  const gatewayProvider = dependencies.gatewayProvider || (() => dependencies.gateway || null);
  const authContextProvider = dependencies.authContextProvider || (() => dependencies.authContext || {});
  const attemptStore = dependencies.attemptStore;
  const presenter = dependencies.presenter || { present: () => null };
  const now = dependencies.now || (() => new Date().toISOString());
  let submitting = false;

  async function execute(commandName, payload = {}, options = {}) {
    if (submitting && options.blockConcurrent !== false) {
      return { success: false, code: 'CLIENT_SUBMIT_IN_PROGRESS', message: 'Operacao ja em andamento.' };
    }
    submitting = true;
    const attemptKey = options.attemptKey || DEFAULT_SOURCE;
    try {
      const gateway = options.gateway || gatewayProvider();
      const authContext = options.authContext || authContextProvider();
      const shouldUseGateway = options.useGateway !== false && Boolean(gateway);
      if (!shouldUseGateway) {
        return typeof options.fallback === 'function' ? options.fallback() : { success: false, code: 'GATEWAY_UNAVAILABLE' };
      }

      const attempt = attemptStore?.getOrCreate?.({
        key: attemptKey,
        commandName,
        payload,
        authContext,
        sourceReferenceId: options.sourceReferenceId || DEFAULT_SOURCE
      });
      const envelope = createEnvelope({
        commandName,
        payload,
        authContext,
        attempt,
        sourceReferenceId: options.sourceReferenceId,
        now
      });
      const result = await gateway.executeCommand(envelope, { authContext });
      if (success(result) || !needsAttempt(result)) attemptStore?.clear?.(attemptKey);
      return result;
    } finally {
      submitting = false;
    }
  }

  async function createExpense(payload = {}, options = {}) {
    const result = await execute('CreateExpenseCommand', payload, options);
    presenter.present(result, {
      successMessage: options.successMessage || 'Saida salva!',
      errorMessage: options.errorMessage || 'Erro ao salvar',
      uncertainMessage: options.uncertainMessage || UNCERTAIN_MESSAGE,
      resetForm: options.resetForm
    });
    return result;
  }

  async function updateExpense(input = {}, options = {}) {
    const result = await execute('UpdateExpenseCommand', input, options);
    presenter.present(result, {
      successMessage: options.successMessage || 'Saida atualizada!',
      errorMessage: options.errorMessage || 'Erro ao salvar',
      uncertainMessage: options.uncertainMessage || UNCERTAIN_MESSAGE,
      reopenAfterEdit: options.reopenAfterEdit,
      resetForm: options.resetForm
    });
    return result;
  }

  async function markExpenseAsPaid(input = {}, options = {}) {
    const result = await execute('MarkExpenseAsPaidCommand', input, options);
    presenter.present(result, {
      errorMessage: options.errorMessage || 'Erro ao atualizar',
      uncertainMessage: options.uncertainMessage || UNCERTAIN_MESSAGE,
      refreshAfterMutation: options.refreshAfterMutation
    });
    return result;
  }

  async function archiveExpense(input = {}, options = {}) {
    const result = await execute('ArchiveExpenseCommand', input, options);
    presenter.present(result, {
      successMessage: options.successMessage || 'Lancamento arquivado!',
      errorMessage: options.errorMessage || 'Erro ao atualizar historico',
      uncertainMessage: options.uncertainMessage || UNCERTAIN_MESSAGE,
      refreshAfterMutation: options.refreshAfterMutation
    });
    return result;
  }

  async function deleteExpense(input = {}, options = {}) {
    const result = await execute('DeleteExpenseCommand', input, options);
    presenter.present(result, {
      successMessage: options.successMessage || 'Excluido!',
      errorMessage: options.errorMessage || 'Erro ao excluir',
      uncertainMessage: options.uncertainMessage || UNCERTAIN_MESSAGE,
      refreshAfterMutation: options.refreshAfterMutation
    });
    return result;
  }

  return {
    createExpense,
    updateExpense,
    markExpenseAsPaid,
    archiveExpense,
    deleteExpense,
    isSubmitting: () => submitting
  };
}
