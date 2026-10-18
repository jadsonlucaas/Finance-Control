import { APPLICATION_RESULT_CODES, createErrorResult, createSuccessResult } from '../gateway/applicationResult.js';
import { buildOperationFingerprint, IDEMPOTENCY_RECEIPT_STATUS } from '../gateway/idempotency.js';
import { REPOSITORY_ERROR_CODES } from '../repositories/repositoryResult.js';
import {
  APPLICATION_ERROR_CATEGORIES,
  APPLICATION_ERROR_CODES,
  APPLICATION_ERROR_SEVERITIES,
  createApplicationError
} from './applicationError.js';
import {
  MUTATION_ATTEMPT_STATUS,
  MUTATION_OUTCOME_STATE,
  payloadMatchesMutationAttempt
} from './mutationAttemptContext.js';

function ownerFrom(context = {}) {
  return context.ownerUid || context.actorUid || context.uid || '';
}

function sourceChannelFrom(attempt = {}) {
  return attempt.sourceChannel || attempt.source_channel || 'web';
}

function commandNameFrom(attempt = {}) {
  return attempt.commandName || attempt.command_name || '';
}

function fingerprintFrom(attempt = {}, context = {}) {
  return attempt.originalPayloadFingerprint || attempt.requestFingerprint || buildOperationFingerprint({
    ownerUid: ownerFrom(context),
    commandName: commandNameFrom(attempt),
    sourceChannel: sourceChannelFrom(attempt),
    payload: attempt.payload || {}
  });
}

async function entitiesExist(financeRecords, entityIds = [], context = {}) {
  if (!entityIds.length || typeof financeRecords?.getById !== 'function') return { confirmed: true, checked: false };
  const results = await Promise.all(entityIds.map((id) => financeRecords.getById(id, context)));
  return {
    confirmed: results.every((result) => result?.ok),
    checked: true,
    missing: entityIds.filter((_, index) => !results[index]?.ok)
  };
}

function receiptInput(attempt = {}, context = {}) {
  return {
    ownerUid: ownerFrom(context),
    commandName: commandNameFrom(attempt),
    sourceChannel: sourceChannelFrom(attempt),
    idempotencyKey: attempt.idempotencyKey || attempt.idempotency_key || '',
    requestFingerprint: fingerprintFrom(attempt, context),
    correlationId: attempt.correlationId || attempt.correlation_id || context.correlationId || ''
  };
}

export async function ReconcileMutationAttempt({
  attempt = {},
  context = {},
  repositories = {},
  payload = null,
  now = () => new Date().toISOString()
} = {}) {
  const idempotency = repositories.idempotency;
  if (!attempt.idempotencyKey && !attempt.idempotency_key) {
    return createErrorResult({
      code: APPLICATION_RESULT_CODES.VALIDATION_ERROR,
      message: 'Tentativa sem idempotencyKey nao pode ser reconciliada.',
      data: {
        status: MUTATION_ATTEMPT_STATUS.UNCERTAIN,
        mutationOutcome: MUTATION_OUTCOME_STATE.UNCERTAIN,
        reconciled: false,
        retryAllowed: false
      },
      correlationId: attempt.correlationId || context.correlationId || '',
      processedAt: now()
    });
  }
  if (!idempotency?.find) {
    return createErrorResult({
      code: APPLICATION_RESULT_CODES.CONFIGURATION_ERROR,
      message: 'Repositorio de idempotencia indisponivel para reconciliacao.',
      data: {
        status: MUTATION_ATTEMPT_STATUS.UNCERTAIN,
        mutationOutcome: MUTATION_OUTCOME_STATE.UNCERTAIN,
        reconciled: false,
        retryAllowed: false
      },
      correlationId: attempt.correlationId || context.correlationId || '',
      processedAt: now()
    });
  }
  if (payload && !payloadMatchesMutationAttempt(attempt, {
    commandName: commandNameFrom(attempt),
    sourceChannel: sourceChannelFrom(attempt),
    payload,
    context
  })) {
    const applicationError = createApplicationError({
      code: APPLICATION_ERROR_CODES.IDEMPOTENCY_CONFLICT,
      category: APPLICATION_ERROR_CATEGORIES.IDEMPOTENCY,
      severity: APPLICATION_ERROR_SEVERITIES.WARNING,
      message: 'Payload da tentativa mudou antes da reconciliacao.',
      userMessage: 'Os dados mudaram. Revise antes de enviar novamente.',
      operation: commandNameFrom(attempt),
      correlationId: attempt.correlationId || context.correlationId || ''
    });
    return createErrorResult({
      code: APPLICATION_RESULT_CODES.CONFLICT,
      message: 'Payload alterado exige nova tentativa.',
      applicationError,
      data: {
        status: MUTATION_ATTEMPT_STATUS.FAILED,
        mutationOutcome: MUTATION_OUTCOME_STATE.CONFIRMED_FAILURE,
        reconciled: false,
        retryAllowed: false
      },
      correlationId: applicationError.correlationId,
      processedAt: now()
    });
  }

  repositories.errorReporter?.report?.({
    error: createApplicationError({
      code: 'RECONCILIATION_ATTEMPT',
      category: APPLICATION_ERROR_CATEGORIES.IDEMPOTENCY,
      severity: APPLICATION_ERROR_SEVERITIES.INFO,
      message: 'Tentativa de reconciliacao iniciada.',
      userMessage: 'Verificando se a operacao foi concluida.',
      operation: commandNameFrom(attempt),
      correlationId: attempt.correlationId || context.correlationId || ''
    }),
    operation: commandNameFrom(attempt),
    correlationId: attempt.correlationId || context.correlationId || '',
    context
  });

  const found = await idempotency.find(receiptInput(attempt, context), context);
  if (!found?.ok) {
    const isNotFound = found?.code === REPOSITORY_ERROR_CODES.NOT_FOUND;
    return createErrorResult({
      code: isNotFound ? APPLICATION_RESULT_CODES.NOT_FOUND : APPLICATION_RESULT_CODES.PERSISTENCE_ERROR,
      message: isNotFound ? 'Receipt nao encontrado para reconciliacao.' : (found?.message || 'Nao foi possivel consultar receipt.'),
      data: {
        status: MUTATION_ATTEMPT_STATUS.UNCERTAIN,
        mutationOutcome: MUTATION_OUTCOME_STATE.UNCERTAIN,
        reconciled: false,
        retryAllowed: false,
        receiptStatus: ''
      },
      correlationId: attempt.correlationId || context.correlationId || '',
      processedAt: now()
    });
  }

  const receipt = found.data || {};
  const expectedFingerprint = fingerprintFrom(attempt, context);
  if (receipt.request_fingerprint && receipt.request_fingerprint !== expectedFingerprint) {
    return createErrorResult({
      code: APPLICATION_RESULT_CODES.CONFLICT,
      message: 'Receipt encontrado com fingerprint diferente.',
      data: {
        status: MUTATION_ATTEMPT_STATUS.FAILED,
        mutationOutcome: MUTATION_OUTCOME_STATE.CONFIRMED_FAILURE,
        reconciled: false,
        retryAllowed: false,
        receiptStatus: receipt.status || ''
      },
      correlationId: receipt.correlation_id || attempt.correlationId || context.correlationId || '',
      processedAt: now()
    });
  }

  if (receipt.status === IDEMPOTENCY_RECEIPT_STATUS.COMPLETED) {
    const entityIds = receipt.entity_ids?.length ? receipt.entity_ids : [receipt.entity_id].filter(Boolean);
    const entityCheck = await entitiesExist(repositories.financeRecords, entityIds, context);
    const success = entityCheck.confirmed;
    repositories.errorReporter?.report?.({
      error: createApplicationError({
        code: 'RECONCILIATION_CONFIRMED',
        category: APPLICATION_ERROR_CATEGORIES.IDEMPOTENCY,
        severity: APPLICATION_ERROR_SEVERITIES.INFO,
        message: 'Receipt completed reconciliado.',
        userMessage: 'Operacao confirmada.',
        operation: commandNameFrom(attempt),
        correlationId: receipt.correlation_id || attempt.correlationId || context.correlationId || '',
        details: { entityIds, entityChecked: entityCheck.checked }
      }),
      operation: commandNameFrom(attempt),
      correlationId: receipt.correlation_id || attempt.correlationId || context.correlationId || '',
      context
    });
    return createSuccessResult({
      code: APPLICATION_RESULT_CODES.IDEMPOTENT_REPLAY,
      message: success ? 'Operacao reconciliada com sucesso.' : 'Receipt concluido, mas entidade nao foi confirmada.',
      entityId: receipt.entity_id || '',
      entityIds,
      idempotentReplay: true,
      data: {
        status: success ? MUTATION_ATTEMPT_STATUS.RECONCILED : MUTATION_ATTEMPT_STATUS.UNCERTAIN,
        mutationOutcome: success ? MUTATION_OUTCOME_STATE.RECONCILED_SUCCESS : MUTATION_OUTCOME_STATE.UNCERTAIN,
        reconciled: success,
        retryAllowed: false,
        receiptStatus: receipt.status,
        receiptId: found.id,
        entityChecked: entityCheck.checked,
        missingEntityIds: entityCheck.missing || []
      },
      correlationId: receipt.correlation_id || attempt.correlationId || context.correlationId || '',
      processedAt: now()
    });
  }

  if (receipt.status === IDEMPOTENCY_RECEIPT_STATUS.FAILED) {
    return createErrorResult({
      code: APPLICATION_RESULT_CODES.PERSISTENCE_ERROR,
      message: 'Receipt indica falha confirmada.',
      data: {
        status: MUTATION_ATTEMPT_STATUS.FAILED,
        mutationOutcome: MUTATION_OUTCOME_STATE.CONFIRMED_FAILURE,
        reconciled: false,
        retryAllowed: true,
        receiptStatus: receipt.status
      },
      correlationId: receipt.correlation_id || attempt.correlationId || context.correlationId || '',
      processedAt: now()
    });
  }

  return createErrorResult({
    code: APPLICATION_RESULT_CODES.PERSISTENCE_ERROR,
    message: 'Operacao ainda esta em processamento.',
    data: {
      status: MUTATION_ATTEMPT_STATUS.UNCERTAIN,
      mutationOutcome: MUTATION_OUTCOME_STATE.UNCERTAIN,
      reconciled: false,
      retryAllowed: false,
      receiptStatus: receipt.status || IDEMPOTENCY_RECEIPT_STATUS.PROCESSING
    },
    correlationId: receipt.correlation_id || attempt.correlationId || context.correlationId || '',
    processedAt: now()
  });
}

