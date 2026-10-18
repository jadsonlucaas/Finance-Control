import {
  normalizeCommandEnvelope,
  normalizeQueryEnvelope,
  validateApplicationEnvelope
} from './applicationEnvelope.js';
import {
  APPLICATION_RESULT_CODES,
  createErrorResult,
  createSuccessResult,
  normalizeApplicationResult
} from './applicationResult.js';
import { authorizeApplicationAction, normalizeApplicationAuthContext } from './authorization.js';
import { buildRequestFingerprint, InMemoryIdempotencyStore } from './idempotency.js';
import { InMemoryIdempotencyRepository } from '../repositories/inMemoryIdempotencyRepository.js';
import { REPOSITORY_ERROR_CODES } from '../repositories/repositoryResult.js';
import {
  APPLICATION_ERROR_CATEGORIES,
  APPLICATION_ERROR_CODES,
  APPLICATION_ERROR_SEVERITIES,
  createApplicationError
} from '../resilience/applicationError.js';
import { normalizeApplicationError, normalizeRepositoryError } from '../resilience/errorNormalization.js';
import {
  MUTATION_ATTEMPT_STATUS,
  MUTATION_OUTCOME_STATE
} from '../resilience/mutationAttemptContext.js';

function idempotencyInput(envelope = {}, authContext = {}) {
  return {
    ownerUid: authContext.ownerUid || authContext.actorUid || '',
    commandName: envelope.commandName || '',
    sourceChannel: envelope.source?.channel || '',
    idempotencyKey: envelope.idempotencyKey || '',
    requestFingerprint: buildRequestFingerprint(envelope, authContext),
    correlationId: envelope.correlationId || ''
  };
}

export class ApplicationCommandGateway {
  constructor({
    commandRegistry,
    queryRegistry,
    repository,
    dependencies = null,
    now = () => new Date().toISOString(),
    authorize = authorizeApplicationAction,
    idempotencyStore = new InMemoryIdempotencyStore(now),
    idempotencyRepository = null,
    errorReporter = null,
    authContextProvider = () => ({ actorUid: '', actorType: 'user', accountStatus: 'active', permissions: [] })
  } = {}) {
    this.commandRegistry = commandRegistry;
    this.queryRegistry = queryRegistry;
    this.repository = repository;
    this.dependencies = dependencies || (repository ? { repositories: { financeRecords: repository } } : null);
    this.now = now;
    this.authorize = authorize;
    this.idempotencyStore = idempotencyStore;
    this.idempotencyRepository = idempotencyRepository || this.dependencies?.repositories?.idempotency || new InMemoryIdempotencyRepository({ now });
    this.errorReporter = errorReporter || this.dependencies?.services?.errorReporter || null;
    this.authContextProvider = authContextProvider;
  }

  async executeCommand(input = {}, options = {}) {
    const processedAt = this.now();
    const envelope = normalizeCommandEnvelope(input, { now: this.now });
    const envelopeValidation = validateApplicationEnvelope(envelope, 'command');
    if (!envelopeValidation.isValid) {
      return createErrorResult({
        code: APPLICATION_RESULT_CODES.VALIDATION_ERROR,
        message: 'Envelope de comando invalido.',
        validationErrors: envelopeValidation.errors,
        correlationId: envelope.correlationId,
        processedAt
      });
    }

    const handler = this.commandRegistry?.resolve(envelope.commandName);
    if (!handler) {
      return normalizeApplicationResult(this.commandRegistry?.unknown(envelope.commandName) || createErrorResult({
        code: APPLICATION_RESULT_CODES.NOT_FOUND,
        message: `Comando nao registrado: ${envelope.commandName}.`
      }), { correlationId: envelope.correlationId, processedAt });
    }

    const authContext = normalizeApplicationAuthContext(options.authContext || this.authContextProvider(envelope));
    authContext.correlationId = envelope.correlationId || authContext.correlationId || '';
    authContext.idempotencyKey = envelope.idempotencyKey || authContext.idempotencyKey || '';
    authContext.sourceChannel = envelope.source?.channel || authContext.sourceChannel || '';
    authContext.sourceReferenceId = envelope.source?.referenceId || authContext.sourceReferenceId || '';
    authContext.requestedAt = envelope.requestedAt || authContext.requestedAt || '';
    authContext.processedAt = processedAt;
    const resource = { ownerUid: authContext.ownerUid || authContext.actorUid };
    const authResult = this.authorize(authContext, envelope.commandName, resource);
    if (!authResult.success) {
      return normalizeApplicationResult(authResult, { correlationId: envelope.correlationId, processedAt });
    }

    const idempotency = envelope.idempotencyKey ? idempotencyInput(envelope, authContext) : null;
    let reservationId = '';
    if (idempotency) {
      const reservation = await this.idempotencyRepository.reserve(idempotency, authContext);
      if (!reservation.ok) {
        const applicationError = normalizeRepositoryError(reservation, {
          operation: envelope.commandName,
          correlationId: envelope.correlationId
        });
        this.errorReporter?.report?.({ error: applicationError, operation: envelope.commandName, correlationId: envelope.correlationId, context: authContext });
        return createErrorResult({
          code: reservation.code === REPOSITORY_ERROR_CODES.CONFLICT
            ? APPLICATION_RESULT_CODES.CONFLICT
            : APPLICATION_RESULT_CODES.PERSISTENCE_ERROR,
          message: reservation.message || 'Nao foi possivel reservar idempotencia.',
          applicationError,
          correlationId: envelope.correlationId,
          processedAt
        });
      }
      reservationId = reservation.id || '';
      if (reservation.data?.reservation_status === 'replay') {
        return normalizeApplicationResult({
          ...(reservation.data.result_reference || {}),
          code: APPLICATION_RESULT_CODES.IDEMPOTENT_REPLAY,
          idempotentReplay: true
        }, { correlationId: envelope.correlationId, processedAt });
      }
    }

    try {
      const result = await handler({
        envelope,
        payload: envelope.payload,
        repository: options.repository || this.repository,
        repositories: options.repositories || options.dependencies?.repositories || this.dependencies?.repositories || {},
        dependencies: options.dependencies || this.dependencies || {},
        authContext,
        now: this.now
      });
      const normalized = normalizeApplicationResult(result, {
        correlationId: envelope.correlationId,
        processedAt
      });
      let completedReceipt = null;
      if (idempotency && reservationId && normalized.success) {
        completedReceipt = await this.idempotencyRepository.complete(reservationId, normalized, authContext);
        try {
          await (options.afterMutationBeforeApplicationResult || this.dependencies?.services?.afterMutationBeforeApplicationResult)?.({
            envelope,
            authContext,
            result: normalized,
            idempotency,
            reservationId,
            receipt: completedReceipt?.data || null
          });
        } catch (postCommitError) {
          const applicationError = createApplicationError({
            code: APPLICATION_ERROR_CODES.POST_COMMIT_RESPONSE_LOST,
            category: APPLICATION_ERROR_CATEGORIES.TIMEOUT,
            severity: APPLICATION_ERROR_SEVERITIES.WARNING,
            message: postCommitError?.message || 'Resposta perdida apos commit confirmado.',
            userMessage: 'A operacao pode ter sido concluida. Verifique antes de enviar novamente.',
            retryable: false,
            operation: envelope.commandName,
            correlationId: envelope.correlationId,
            causeCode: postCommitError?.code || '',
            details: {
              reservationId,
              idempotencyKey: envelope.idempotencyKey,
              resultCode: normalized.code,
              entityId: normalized.entityId,
              entityIds: normalized.entityIds
            },
            cause: postCommitError
          });
          this.errorReporter?.report?.({
            error: applicationError,
            operation: envelope.commandName,
            correlationId: envelope.correlationId,
            context: authContext
          });
          return createErrorResult({
            code: APPLICATION_RESULT_CODES.PERSISTENCE_ERROR,
            message: 'Resposta perdida apos commit. Reconciliacao necessaria antes de reenviar.',
            applicationError,
            warnings: ['POST_COMMIT_RESPONSE_LOST'],
            data: {
              status: MUTATION_ATTEMPT_STATUS.UNCERTAIN,
              mutationOutcome: MUTATION_OUTCOME_STATE.UNCERTAIN,
              reconciled: false,
              retryAllowed: false,
              reservationId,
              idempotencyKey: envelope.idempotencyKey,
              requestFingerprint: idempotency.requestFingerprint
            },
            correlationId: envelope.correlationId,
            processedAt
          });
        }
      }
      if (idempotency && reservationId && !normalized.success) await this.idempotencyRepository.fail(reservationId, normalized, authContext);
      return normalized;
    } catch (error) {
      const applicationError = normalizeApplicationError(error, {
        operation: envelope.commandName,
        correlationId: envelope.correlationId
      });
      this.errorReporter?.report?.({ error: applicationError, operation: envelope.commandName, correlationId: envelope.correlationId, context: authContext });
      const failure = createErrorResult({
        code: error?.code === 'FINANCE_RECORD_CONTRACT_INVALID'
          ? APPLICATION_RESULT_CODES.VALIDATION_ERROR
          : APPLICATION_RESULT_CODES.PERSISTENCE_ERROR,
        message: error?.message || 'Erro ao executar comando.',
        applicationError,
        validationErrors: error?.validation?.errors || [],
        correlationId: envelope.correlationId,
        processedAt
      });
      if (idempotency && reservationId) await this.idempotencyRepository.fail(reservationId, failure, authContext);
      return failure;
    }
  }

  async executeQuery(input = {}, options = {}) {
    const processedAt = this.now();
    const envelope = normalizeQueryEnvelope(input, { now: this.now });
    const envelopeValidation = validateApplicationEnvelope(envelope, 'query');
    if (!envelopeValidation.isValid) {
      return createErrorResult({
        code: APPLICATION_RESULT_CODES.VALIDATION_ERROR,
        message: 'Envelope de consulta invalido.',
        validationErrors: envelopeValidation.errors,
        correlationId: envelope.correlationId,
        processedAt
      });
    }

    const handler = this.queryRegistry?.resolve(envelope.queryName);
    if (!handler) {
      return normalizeApplicationResult(this.queryRegistry?.unknown(envelope.queryName) || createErrorResult({
        code: APPLICATION_RESULT_CODES.NOT_FOUND,
        message: `Consulta nao registrada: ${envelope.queryName}.`
      }), { correlationId: envelope.correlationId, processedAt });
    }

    const authContext = normalizeApplicationAuthContext(options.authContext || this.authContextProvider(envelope));
    const authResult = this.authorize(authContext, envelope.queryName, { ownerUid: authContext.ownerUid || authContext.actorUid });
    if (!authResult.success) {
      return normalizeApplicationResult(authResult, { correlationId: envelope.correlationId, processedAt });
    }

    try {
      const result = await handler({
        envelope,
        payload: envelope.payload,
        repository: options.repository || this.repository,
        repositories: options.repositories || options.dependencies?.repositories || this.dependencies?.repositories || {},
        dependencies: options.dependencies || this.dependencies || {},
        authContext,
        now: this.now
      });
      return normalizeApplicationResult(result, {
        correlationId: envelope.correlationId,
        processedAt
      });
    } catch (error) {
      const applicationError = normalizeApplicationError(error, {
        operation: envelope.queryName,
        correlationId: envelope.correlationId
      });
      this.errorReporter?.report?.({ error: applicationError, operation: envelope.queryName, correlationId: envelope.correlationId, context: authContext });
      return createErrorResult({
        code: APPLICATION_RESULT_CODES.PERSISTENCE_ERROR,
        message: error?.message || 'Erro ao executar consulta.',
        applicationError,
        correlationId: envelope.correlationId,
        processedAt
      });
    }
  }
}

export function createGatewayReplayResult(result = {}) {
  return createSuccessResult({
    ...result,
    code: APPLICATION_RESULT_CODES.IDEMPOTENT_REPLAY,
    idempotentReplay: true
  });
}
