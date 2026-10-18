import { normalizeCompetenceKey } from '../../core/dates.js';
import {
  buildPercentageOccurrenceRecord,
  buildPercentageOccurrenceKey,
  CalculatePercentageRuleOccurrence,
  PERCENTAGE_RULE_MATERIALIZATION_SOURCE,
  PERCENTAGE_RULE_SOURCE_CHANNEL
} from '../../domain/percentage-rules.js';
import { normalizeFinanceRecord, validateFinanceRecord } from '../../domain/records/index.js';
import { consolidatePersonMonthlyEntry } from '../entries/consolidatePersonMonthlyEntry.js';
import { APPLICATION_RESULT_CODES, createErrorResult, createSuccessResult } from '../gateway/applicationResult.js';
import { buildOperationFingerprint } from '../gateway/idempotency.js';
import { normalizeOperationMetadata } from '../gateway/operationMetadata.js';
import { REPOSITORY_ERROR_CODES } from '../repositories/repositoryResult.js';
import { appendAuditEvent, buildAuditEvent } from './auditUseCaseEvents.js';
import { createUseCaseContext, validateFinancialUseCaseContext } from './useCaseContext.js';
import { requireRepository, validationErrorResult } from './useCaseResult.js';

const COMMAND_NAME = 'MaterializePercentageRulesForCompetence';
const MAX_RANGE_MONTHS = 24;

function getFinanceRecordsRepository(dependencies = {}) {
  return dependencies.repositories?.financeRecords || dependencies.repository || null;
}

function getIdempotencyRepository(dependencies = {}) {
  return dependencies.repositories?.idempotency || null;
}

function getAuditRepository(dependencies = {}) {
  return dependencies.repositories?.audit || null;
}

async function listRecords(repository, context = {}) {
  const result = await repository.list({}, context);
  if (Array.isArray(result)) return result;
  return result?.ok ? result.items || result.data || [] : [];
}

function normalizeRuleRecord(record = {}) {
  return {
    ...record,
    id: record.id || record.rule_id || '',
    name: record.name || record.description || '',
    person: record.person || '',
    percentage: record.percentage ?? record.percentual ?? 0,
    base: record.base || record.base_type || 'liquido',
    macro: record.macro || record.macro_category || 'RESERVA',
    category: record.category || record.category_name || record.subcategory || '',
    cycle: record.cycle === 'QUINZENA' ? 'QUINZENA' : 'INICIO_MES',
    startCompetence: record.startCompetence || record.start_competence || '',
    endCompetence: record.endCompetence || record.end_competence || '',
    active: record.active !== false
  };
}

function ruleIsActive(rule = {}) {
  if (rule.active === false) return false;
  return !['inactive', 'inativo', 'cancelado'].includes(String(rule.status || '').trim().toLowerCase());
}

function findExistingOccurrence(records = [], occurrence = {}, rule = {}) {
  const ruleId = String(occurrence.ruleId || rule.id || '').trim();
  return records.find((record) => {
    if (record?.type !== 'saida' || record?.generated_percentage_rule !== true) return false;
    if (occurrence.entityId && record.id === occurrence.entityId) return true;
    if (occurrence.occurrenceKey && record.percentage_occurrence_key === occurrence.occurrenceKey) return true;
    return ruleId &&
      String(record.percentage_rule_id || '').trim() === ruleId &&
      String(record.person || '').trim() === occurrence.personName &&
      normalizeCompetenceKey(record.competence || record.due_date || '') === occurrence.competence;
  }) || null;
}

function classifyExistingOccurrence(existing = {}, occurrence = {}) {
  const warnings = [];
  if (existing.status === 'Pago' || existing.paid_at) warnings.push('PAID_OCCURRENCE_PRESERVED');
  if (existing.archived === true) warnings.push('ARCHIVED_OCCURRENCE_PRESERVED');
  if (existing.percentage_materialization_manual_edit === true || existing.manual_edit === true) {
    warnings.push('MANUALLY_EDITED_OCCURRENCE_PRESERVED');
  }
  if (Number(existing.amount || 0) !== occurrence.amount) warnings.push('DIVERGENT_AMOUNT_PRESERVED');
  if (String(existing.subcategory || existing.category_name || '') !== occurrence.category) {
    warnings.push('DIVERGENT_CATEGORY_PRESERVED');
  }
  if (existing.status && !['Em aberto', 'Pago'].includes(existing.status)) warnings.push('DIVERGENT_STATUS_PRESERVED');
  return warnings;
}

function buildIdempotencyInput({ context = {}, occurrence = {}, payload = {} } = {}) {
  const idempotencyKey = `percentage-materialization:${occurrence.ruleId}:${occurrence.personId}:${occurrence.competence}`;
  const sourceChannel = PERCENTAGE_RULE_SOURCE_CHANNEL;
  return {
    ownerUid: context.ownerUid || context.actorUid || '',
    commandName: COMMAND_NAME,
    sourceChannel,
    idempotencyKey,
    requestFingerprint: buildOperationFingerprint({
      ownerUid: context.ownerUid || context.actorUid || '',
      commandName: COMMAND_NAME,
      sourceChannel,
      payload: {
        id: payload.id,
        occurrenceKey: occurrence.occurrenceKey,
        amount: payload.amount,
        ruleId: occurrence.ruleId,
        personId: occurrence.personId,
        competence: occurrence.competence
      }
    }),
    correlationId: context.correlationId || ''
  };
}

function normalizeMaterializationSourceChannel(sourceChannel = '') {
  return sourceChannel === 'web' ? 'web' : PERCENTAGE_RULE_SOURCE_CHANNEL;
}

function sameText(left = '', right = '') {
  return String(left || '').trim() === String(right || '').trim();
}

function isDeterministicOccurrenceMatch(existing = {}, occurrence = {}, context = {}) {
  if (!existing || existing.type !== 'saida' || existing.generated_percentage_rule !== true) return false;
  if (existing.id && !sameText(existing.id, occurrence.entityId)) return false;
  if (!sameText(existing.owner_uid, context.ownerUid || context.actorUid || '')) return false;
  if (!sameText(existing.percentage_rule_id, occurrence.ruleId)) return false;
  if (!sameText(existing.percentage_occurrence_key, occurrence.occurrenceKey)) return false;
  if (!sameText(existing.person, occurrence.personName)) return false;
  return sameText(normalizeCompetenceKey(existing.competence || existing.due_date || ''), occurrence.competence);
}

async function findDeterministicOccurrence(repository, records = [], occurrence = {}, context = {}) {
  if (typeof repository.getById === 'function') {
    const byId = await repository.getById(occurrence.entityId, context);
    if (byId?.ok && byId.data) return { ...byId.data, id: byId.data.id || byId.id || occurrence.entityId };
  }
  return findExistingOccurrence(records, occurrence, {}) || null;
}

function receiptFingerprintMatches(receipt = {}, idemInput = {}) {
  return sameText(receipt.request_fingerprint, idemInput.requestFingerprint);
}

async function reconcileProcessingReceipt({
  idempotency,
  financeRecords,
  records,
  idemInput,
  occurrence,
  context,
  auditRepository,
  now
} = {}) {
  if (!idempotency?.find) return { reconciled: false, conflict: false };
  const found = await idempotency.find(idemInput, context);
  const receipt = found?.data || {};
  if (!found?.ok || receipt.status !== 'processing' || !receiptFingerprintMatches(receipt, idemInput)) {
    return { reconciled: false, conflict: false };
  }

  const existing = await findDeterministicOccurrence(financeRecords, records, occurrence, context);
  if (!existing) return { reconciled: false, conflict: false };
  if (!isDeterministicOccurrenceMatch(existing, occurrence, context)) {
    return { reconciled: false, conflict: true, existing };
  }

  const completed = await idempotency.complete(found.id, {
    success: true,
    code: 'RECONCILED_EXISTING',
    entityId: occurrence.entityId,
    correlationId: receipt.correlation_id || context.correlationId
  }, context);
  if (!completed?.ok && completed?.code === REPOSITORY_ERROR_CODES.CONFLICT) {
    const replay = await idempotency.find(idemInput, context);
    if (replay?.ok && replay.data?.status === 'completed') {
      return { reconciled: true, existing, completed: replay };
    }
    return { reconciled: false, conflict: true, existing };
  }
  if (!completed?.ok) return { reconciled: false, conflict: false, existing };

  await auditSummary({
    action: 'PERCENTAGE_RULE_RECEIPT_RECONCILED',
    auditRepository,
    context,
    entityId: occurrence.entityId,
    after: {
      operation: PERCENTAGE_RULE_MATERIALIZATION_SOURCE,
      occurrenceKey: occurrence.occurrenceKey,
      resultCode: 'RECONCILED_EXISTING'
    },
    now
  });
  return { reconciled: true, existing, completed };
}

async function auditSummary({ action, auditRepository, context, entityId = '', after = null, now }) {
  return appendAuditEvent(auditRepository, buildAuditEvent({
    action,
    context,
    entityType: 'percentage_rule_materialization',
    entityId,
    after,
    occurredAt: now()
  }), context);
}

function createSummary(competence = '', correlationId = '') {
  return {
    success: true,
    competence,
    evaluated: 0,
    created: 0,
    alreadyExisting: 0,
    skippedInactive: 0,
    skippedOutOfRange: 0,
    conflicts: 0,
    errors: [],
    occurrences: [],
    correlationId,
    wrote: true
  };
}

export async function MaterializePercentageRulesForCompetence({
  input = {},
  context = {},
  envelope = {},
  dependencies = {},
  now = () => new Date().toISOString()
} = {}) {
  const useCaseContext = createUseCaseContext({ context, envelope, now });
  useCaseContext.sourceChannel = normalizeMaterializationSourceChannel(useCaseContext.sourceChannel);
  const contextError = validateFinancialUseCaseContext(useCaseContext);
  if (contextError) return contextError;

  const competence = normalizeCompetenceKey(input.competence || input.competencia || '');
  if (!competence) {
    return createErrorResult({ code: APPLICATION_RESULT_CODES.VALIDATION_ERROR, message: 'competence obrigatoria.' });
  }

  const financeRecords = getFinanceRecordsRepository(dependencies);
  const repositoryError = requireRepository(financeRecords, 'FinanceRecordRepository');
  if (repositoryError) return repositoryError;
  const idempotency = getIdempotencyRepository(dependencies);
  const auditRepository = getAuditRepository(dependencies);
  const records = await listRecords(financeRecords, useCaseContext);
  const optionalRuleIds = new Set(input.optionalRuleIds || input.ruleIds || []);
  const rules = records
    .filter((record) => record?.type === 'percentage_rule' || record?.type === 'regra_percentual_saida')
    .map(normalizeRuleRecord)
    .filter((rule) => !optionalRuleIds.size || optionalRuleIds.has(rule.id));
  const people = records.filter((record) => record?.type === 'pessoa' && record.person);
  const summary = createSummary(competence, useCaseContext.correlationId);

  await auditSummary({
    action: 'PERCENTAGE_RULE_MATERIALIZATION_STARTED',
    auditRepository,
    context: useCaseContext,
    after: { competence, ruleCount: rules.length },
    now
  });

  for (const rule of rules) {
    if (!ruleIsActive(rule)) {
      summary.skippedInactive += 1;
      continue;
    }

    const targetPeople = rule.person
      ? people.filter((person) => String(person.person || '').trim() === rule.person)
      : people;

    for (const person of targetPeople) {
      const consolidated = consolidatePersonMonthlyEntry(person.person, competence, {
        records,
        target: {},
        getSalaryInfo: () => ({ salario: Number(person.salary_base ?? person.amount ?? 0) || 0 }),
        getPersonReceivingType: () => person.receiving_type || 'mensal',
        calculateInss: dependencies.services?.calculateInss,
        calculateIrrf: dependencies.services?.calculateIrrf,
        isReferenceSalaryRecord: dependencies.services?.isReferenceSalaryRecord
      });
      const occurrence = CalculatePercentageRuleOccurrence({
        rule,
        person,
        competence,
        baseContext: consolidated,
        calculationContext: {
          ownerUid: useCaseContext.ownerUid || useCaseContext.actorUid || '',
          legacyContext: input.legacyContext || {}
        }
      });
      summary.evaluated += 1;
      if (!occurrence.isValid) {
        if (occurrence.errors.some((error) => error.code === 'RULE_OUT_OF_RANGE')) summary.skippedOutOfRange += 1;
        else summary.errors.push({ ruleId: rule.id, person: person.person, errors: occurrence.errors });
        continue;
      }

      const metadata = normalizeOperationMetadata({
        ...input.metadata,
        source_channel: PERCENTAGE_RULE_SOURCE_CHANNEL,
        source_reference_id: occurrence.occurrenceKey,
        correlation_id: useCaseContext.correlationId || `pct_${occurrence.entityId}`,
        idempotency_key: `percentage-materialization:${occurrence.ruleId}:${occurrence.personId}:${occurrence.competence}`
      }, useCaseContext);
      const payload = normalizeFinanceRecord(buildPercentageOccurrenceRecord({ occurrence, rule, now, metadata }));
      const validation = validateFinanceRecord(payload, { allowLegacy: true });
      if (!validation.isValid) return validationErrorResult(validation);

      const idemInput = buildIdempotencyInput({ context: useCaseContext, occurrence, payload });
      const existing = findExistingOccurrence(records, occurrence, rule);
      if (existing) {
        const recovered = await reconcileProcessingReceipt({
          idempotency,
          financeRecords,
          records,
          idemInput,
          occurrence,
          context: useCaseContext,
          auditRepository,
          now
        });
        if (recovered.conflict) {
          summary.conflicts += 1;
          summary.occurrences.push({
            status: 'existing_mismatch',
            id: occurrence.entityId,
            occurrenceKey: occurrence.occurrenceKey,
            ruleId: occurrence.ruleId,
            personId: occurrence.personId,
            competence
          });
          return createErrorResult({
            code: APPLICATION_RESULT_CODES.CONFLICT,
            message: 'Ocorrencia deterministica existente e incompativel.',
            data: summary,
            correlationId: useCaseContext.correlationId
          });
        }
        const warnings = classifyExistingOccurrence(existing, occurrence);
        summary.alreadyExisting += 1;
        summary.occurrences.push({
          status: warnings.length ? 'existing_preserved_with_warning' : 'already_existing',
          id: existing.id,
          occurrenceKey: occurrence.occurrenceKey,
          ruleId: occurrence.ruleId,
          personId: occurrence.personId,
          competence,
          warnings
        });
        await auditSummary({
          action: 'PERCENTAGE_RULE_OCCURRENCE_ALREADY_EXISTS',
          auditRepository,
          context: useCaseContext,
          entityId: existing.id,
          after: { occurrenceKey: occurrence.occurrenceKey, warnings },
          now
        });
        continue;
      }
      let reservation = null;
      if (idempotency?.reserve) {
        reservation = await idempotency.reserve(idemInput, useCaseContext);
        if (!reservation.ok) {
          const recovered = await reconcileProcessingReceipt({
            idempotency,
            financeRecords,
            records,
            idemInput,
            occurrence,
            context: useCaseContext,
            auditRepository,
            now
          });
          if (recovered.reconciled) {
            summary.alreadyExisting += 1;
            summary.occurrences.push({
              status: 'idempotent_reconciled_existing',
              id: occurrence.entityId,
              occurrenceKey: occurrence.occurrenceKey,
              ruleId: occurrence.ruleId,
              personId: occurrence.personId,
              competence
            });
            continue;
          }
          summary.conflicts += 1;
          summary.occurrences.push({
            status: recovered.conflict ? 'idempotency_conflict_mismatch' : 'idempotency_conflict',
            id: occurrence.entityId,
            occurrenceKey: occurrence.occurrenceKey,
            ruleId: occurrence.ruleId,
            personId: occurrence.personId,
            competence
          });
          if (recovered.conflict) {
            return createErrorResult({
              code: APPLICATION_RESULT_CODES.CONFLICT,
              message: 'Receipt processing possui ocorrencia deterministica incompativel.',
              data: summary,
              correlationId: useCaseContext.correlationId
            });
          }
          continue;
        }
        if (reservation.data?.reservation_status === 'replay') {
          summary.alreadyExisting += 1;
          summary.occurrences.push({
            status: 'idempotent_replay',
            id: reservation.data.entity_id || occurrence.entityId,
            occurrenceKey: occurrence.occurrenceKey,
            ruleId: occurrence.ruleId,
            personId: occurrence.personId,
            competence
          });
          continue;
        }
      }

      const createResult = typeof financeRecords.createIfAbsent === 'function'
        ? await financeRecords.createIfAbsent(payload, useCaseContext)
        : await financeRecords.create(payload, useCaseContext);
      if (!createResult?.ok && createResult?.code === REPOSITORY_ERROR_CODES.CONFLICT) {
        const existingAfterConflict = await findDeterministicOccurrence(financeRecords, records, occurrence, useCaseContext);
        if (existingAfterConflict && !isDeterministicOccurrenceMatch(existingAfterConflict, occurrence, useCaseContext)) {
          summary.conflicts += 1;
          summary.occurrences.push({
            status: 'already_existing_race_mismatch',
            id: occurrence.entityId,
            occurrenceKey: occurrence.occurrenceKey,
            ruleId: occurrence.ruleId,
            personId: occurrence.personId,
            competence
          });
          return createErrorResult({
            code: APPLICATION_RESULT_CODES.CONFLICT,
            message: 'Ocorrencia deterministica existente e incompativel.',
            data: summary,
            correlationId: useCaseContext.correlationId
          });
        }
        summary.alreadyExisting += 1;
        summary.conflicts += 1;
        await idempotency?.complete?.(reservation?.id || '', {
          success: true,
          code: 'ALREADY_EXISTS',
          entityId: occurrence.entityId,
          correlationId: useCaseContext.correlationId
        }, useCaseContext);
        summary.occurrences.push({
          status: 'already_existing_race',
          id: occurrence.entityId,
          occurrenceKey: occurrence.occurrenceKey,
          ruleId: occurrence.ruleId,
          personId: occurrence.personId,
          competence
        });
        continue;
      }
      if (!createResult?.ok) {
        await idempotency?.fail?.(reservation?.id || '', {
          code: createResult?.code || 'CREATE_FAILED',
          correlationId: useCaseContext.correlationId
        }, useCaseContext);
        summary.errors.push({ ruleId: rule.id, person: person.person, error: createResult?.message || 'CREATE_FAILED' });
        continue;
      }

      if (typeof dependencies.hooks?.afterCreateBeforeReceiptComplete === 'function') {
        await dependencies.hooks.afterCreateBeforeReceiptComplete({
          occurrence,
          payload,
          createResult,
          reservation,
          context: useCaseContext
        });
      }

      await idempotency?.complete?.(reservation?.id || '', {
        success: true,
        code: 'CREATED',
        entityId: createResult.id || occurrence.entityId,
        correlationId: useCaseContext.correlationId
      }, useCaseContext);
      summary.created += 1;
      summary.occurrences.push({
        status: 'created',
        id: createResult.id || occurrence.entityId,
        occurrenceKey: occurrence.occurrenceKey,
        ruleId: occurrence.ruleId,
        personId: occurrence.personId,
        competence,
        amount: payload.amount
      });
      await auditSummary({
        action: 'PERCENTAGE_RULE_OCCURRENCE_CREATED',
        auditRepository,
        context: useCaseContext,
        entityId: createResult.id || occurrence.entityId,
        after: {
          occurrenceKey: occurrence.occurrenceKey,
          operation: PERCENTAGE_RULE_MATERIALIZATION_SOURCE,
          ruleId: occurrence.ruleId,
          personId: occurrence.personId,
          competence,
          amount: payload.amount
        },
        now
      });
    }
  }

  if (summary.errors.length) {
    await auditSummary({
      action: 'PERCENTAGE_RULE_MATERIALIZATION_FAILED',
      auditRepository,
      context: useCaseContext,
      after: { competence, errors: summary.errors.length },
      now
    });
  }

  return createSuccessResult({
    message: 'Materializacao percentual avaliada.',
    data: summary,
    warnings: summary.occurrences.flatMap((item) => item.warnings || []),
    correlationId: useCaseContext.correlationId
  });
}

function shiftCompetence(competence = '', offset = 0) {
  const normalized = normalizeCompetenceKey(competence);
  const [year, month] = normalized.split('-').map(Number);
  if (!year || !month) return '';
  const date = new Date(year, month - 1 + offset, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export async function MaterializePercentageRulesForRange(args = {}) {
  const input = args.input || {};
  const start = normalizeCompetenceKey(input.startCompetence || input.start || input.competence || '');
  const end = normalizeCompetenceKey(input.endCompetence || input.end || start);
  if (!start || !end || start > end) {
    return createErrorResult({ code: APPLICATION_RESULT_CODES.VALIDATION_ERROR, message: 'Intervalo de competencias invalido.' });
  }
  const months = [];
  for (let current = start; current && current <= end; current = shiftCompetence(current, 1)) {
    months.push(current);
    if (months.length > MAX_RANGE_MONTHS) {
      return createErrorResult({ code: APPLICATION_RESULT_CODES.VALIDATION_ERROR, message: `Intervalo maximo de ${MAX_RANGE_MONTHS} meses excedido.` });
    }
  }
  const results = [];
  for (const competence of months) {
    results.push(await MaterializePercentageRulesForCompetence({
      ...args,
      input: { ...input, competence }
    }));
  }
  const summary = results.reduce((acc, result) => {
    const data = result.data || {};
    acc.evaluated += data.evaluated || 0;
    acc.created += data.created || 0;
    acc.alreadyExisting += data.alreadyExisting || 0;
    acc.skippedInactive += data.skippedInactive || 0;
    acc.skippedOutOfRange += data.skippedOutOfRange || 0;
    acc.conflicts += data.conflicts || 0;
    acc.errors.push(...(data.errors || []));
    acc.occurrences.push(...(data.occurrences || []));
    return acc;
  }, {
    success: results.every((result) => result.success),
    startCompetence: start,
    endCompetence: end,
    evaluated: 0,
    created: 0,
    alreadyExisting: 0,
    skippedInactive: 0,
    skippedOutOfRange: 0,
    conflicts: 0,
    errors: [],
    occurrences: [],
    wrote: true
  });
  return createSuccessResult({ message: 'Materializacao percentual de intervalo avaliada.', data: summary });
}

export function createPercentageRuleMaterializationRunner(dependencies = {}) {
  return {
    async runForCompetence({ competence, ownerUid, executionContext = {}, optionalRuleIds = [] } = {}) {
      return MaterializePercentageRulesForCompetence({
        input: { competence, optionalRuleIds },
        context: {
          ...executionContext,
          ownerUid: ownerUid || executionContext.ownerUid || executionContext.actorUid || '',
          actorUid: executionContext.actorUid || ownerUid || '',
          sourceChannel: executionContext.sourceChannel || PERCENTAGE_RULE_SOURCE_CHANNEL
        },
        dependencies,
        now: dependencies.clock?.now || (() => new Date().toISOString())
      });
    },
    async runForRange({ startCompetence, endCompetence, ownerUid, executionContext = {}, optionalRuleIds = [] } = {}) {
      return MaterializePercentageRulesForRange({
        input: { startCompetence, endCompetence, optionalRuleIds },
        context: {
          ...executionContext,
          ownerUid: ownerUid || executionContext.ownerUid || executionContext.actorUid || '',
          actorUid: executionContext.actorUid || ownerUid || '',
          sourceChannel: executionContext.sourceChannel || PERCENTAGE_RULE_SOURCE_CHANNEL
        },
        dependencies,
        now: dependencies.clock?.now || (() => new Date().toISOString())
      });
    }
  };
}

export function buildPercentageRuleMaterializationPreview({ records = [], competence = '', context = {}, now = () => new Date().toISOString() } = {}) {
  const normalizedCompetence = normalizeCompetenceKey(competence);
  const ownerUid = context.ownerUid || context.actorUid || 'dry-run-user';
  const rules = records.filter((record) => record?.type === 'percentage_rule').map(normalizeRuleRecord);
  const people = records.filter((record) => record?.type === 'pessoa' && record.person);
  const preview = createSummary(normalizedCompetence, context.correlationId || 'dry-run');
  preview.wrote = false;

  rules.forEach((rule) => {
    if (!ruleIsActive(rule)) {
      preview.skippedInactive += 1;
      return;
    }
    const targetPeople = rule.person ? people.filter((person) => person.person === rule.person) : people;
    targetPeople.forEach((person) => {
      const consolidated = consolidatePersonMonthlyEntry(person.person, normalizedCompetence, {
        records,
        target: {},
        getSalaryInfo: () => ({ salario: Number(person.salary_base ?? person.amount ?? 0) || 0 }),
        getPersonReceivingType: () => person.receiving_type || 'mensal'
      });
      const occurrence = CalculatePercentageRuleOccurrence({
        rule,
        person,
        competence: normalizedCompetence,
        baseContext: consolidated,
        calculationContext: { ownerUid }
      });
      preview.evaluated += 1;
      if (!occurrence.isValid) {
        if (occurrence.errors.some((error) => error.code === 'RULE_OUT_OF_RANGE')) preview.skippedOutOfRange += 1;
        else preview.errors.push({ ruleId: rule.id, person: person.person, errors: occurrence.errors });
        return;
      }
      const existing = findExistingOccurrence(records, occurrence, rule);
      if (existing) {
        preview.alreadyExisting += 1;
        preview.occurrences.push({
          status: 'already_existing',
          id: existing.id,
          occurrenceKey: occurrence.occurrenceKey,
          warnings: classifyExistingOccurrence(existing, occurrence)
        });
        return;
      }
      const record = buildPercentageOccurrenceRecord({
        occurrence,
        rule,
        now,
        metadata: {
          source_channel: PERCENTAGE_RULE_SOURCE_CHANNEL,
          source_reference_id: occurrence.occurrenceKey,
          idempotency_key: `percentage-materialization:${occurrence.ruleId}:${occurrence.personId}:${occurrence.competence}`
        }
      });
      preview.occurrences.push({
        status: 'would_create',
        id: record.id,
        occurrenceKey: buildPercentageOccurrenceKey({
          ownerUid,
          ruleId: occurrence.ruleId,
          personId: occurrence.personId,
          competence: occurrence.competence
        }),
        amount: record.amount,
        wrote: false
      });
    });
  });
  preview.created = preview.occurrences.filter((item) => item.status === 'would_create').length;
  return preview;
}
