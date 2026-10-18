import { normalizeCompetenceKey } from '../../core/dates.js';
import { roundCurrency } from '../../core/money.js';
import { buildHourPeriodSummary } from '../../domain/hourPeriodSummary.js';
import { CalculateWorkSession, ResolveEffectiveSalary, formatMinutesToClock } from '../../domain/hours.js';
import {
  buildEntradaPayload,
  buildInstallmentSaidaPayloads,
  buildRecurringSaidaPayloads,
  buildSaidaPayload
} from '../../domain/recordPayloads.js';
import { normalizeFinanceRecord, validateFinanceRecord } from '../../domain/records/index.js';
import { consolidatePersonMonthlyEntry } from '../entries/consolidatePersonMonthlyEntry.js';
import { APPLICATION_RESULT_CODES, createErrorResult, createSuccessResult } from '../gateway/applicationResult.js';
import { buildAuditEvent, appendAuditEvent } from './auditUseCaseEvents.js';
import { actorMetadata, assertOwnRecord, createUseCaseContext, validateFinancialUseCaseContext } from './useCaseContext.js';
import { mapRepositoryResult, requireRepository, validationErrorResult } from './useCaseResult.js';

function getFinanceRecordsRepository(dependencies = {}) {
  return dependencies.repositories?.financeRecords || dependencies.repository || null;
}

function getAuditRepository(dependencies = {}) {
  return dependencies.repositories?.audit || null;
}

async function listRecords(repository, context = {}) {
  if (typeof repository?.list !== 'function') return [];
  const result = await repository.list({}, context);
  if (Array.isArray(result)) return result;
  return result?.ok ? result.items || result.data || [] : [];
}

async function findById(repository, id = '', context = {}) {
  if (typeof repository?.getById === 'function') {
    const result = await repository.getById(id, context);
    if (result?.ok) return result.data;
    return null;
  }
  const records = await listRecords(repository, context);
  return records.find((record) => record.id === id) || null;
}

function normalizeAndValidate(record = {}, context = {}) {
  const normalized = normalizeFinanceRecord({
    ...record,
    schema_version: record.schema_version || 1,
    ...actorMetadata(context)
  });
  const validation = validateFinanceRecord(normalized, { allowLegacy: true });
  return { normalized, validation };
}

function buildExpenseRecord(input = {}) {
  if (input.record) return { ...input.record, type: 'saida' };
  return buildSaidaPayload({ ...input, parentId: input.parentId || '' });
}

function buildIncomeRecord(input = {}) {
  if (input.record) return { ...input.record, type: 'entrada' };
  return buildEntradaPayload(input);
}

function immutablePatchError(field = '') {
  return createErrorResult({
    code: APPLICATION_RESULT_CODES.BUSINESS_RULE_ERROR,
    message: `${field} nao pode ser alterado por este caso de uso.`
  });
}

async function auditMutation({ auditRepository, action, context, entityId, before = null, after = null, now }) {
  return appendAuditEvent(auditRepository, buildAuditEvent({
    action,
    context,
    entityId,
    before,
    after,
    occurredAt: now()
  }), context);
}

function prepareUseCase({ context, envelope, now }) {
  const useCaseContext = createUseCaseContext({ context, envelope, now });
  const contextError = validateFinancialUseCaseContext(useCaseContext);
  return { useCaseContext, contextError };
}

export async function CreateExpense({ input = {}, context = {}, envelope = {}, dependencies = {}, now = () => new Date().toISOString() } = {}) {
  const { useCaseContext, contextError } = prepareUseCase({ context, envelope, now });
  if (contextError) return contextError;
  const financeRecords = getFinanceRecordsRepository(dependencies);
  const repositoryError = requireRepository(financeRecords, 'FinanceRecordRepository');
  if (repositoryError) return repositoryError;

  const { normalized, validation } = normalizeAndValidate(buildExpenseRecord(input), useCaseContext);
  if (!validation.isValid) return validationErrorResult(validation);

  const result = await financeRecords.create(normalized, useCaseContext);
  const mapped = mapRepositoryResult(result, 'Saida criada.');
  if (!mapped.success) return mapped;

  const auditWarning = await auditMutation({
    auditRepository: getAuditRepository(dependencies),
    action: 'finance_record.create',
    context: useCaseContext,
    entityId: mapped.entityId,
    after: mapped.data,
    now
  });
  if (auditWarning) mapped.warnings.push(auditWarning);
  return mapped;
}

export async function UpdateExpense({ input = {}, context = {}, envelope = {}, dependencies = {}, now = () => new Date().toISOString() } = {}) {
  const { useCaseContext, contextError } = prepareUseCase({ context, envelope, now });
  if (contextError) return contextError;
  const financeRecords = getFinanceRecordsRepository(dependencies);
  const repositoryError = requireRepository(financeRecords, 'FinanceRecordRepository');
  if (repositoryError) return repositoryError;

  const id = input.id || input.record?.id || '';
  if (!id) return createErrorResult({ code: APPLICATION_RESULT_CODES.VALIDATION_ERROR, message: 'id obrigatorio.' });
  const current = await findById(financeRecords, id, useCaseContext);
  if (!current) return createErrorResult({ code: APPLICATION_RESULT_CODES.NOT_FOUND, message: 'Saida nao encontrada.' });
  const ownerError = assertOwnRecord(current, useCaseContext);
  if (ownerError) return ownerError;
  if (current.type !== 'saida') return createErrorResult({ code: APPLICATION_RESULT_CODES.BUSINESS_RULE_ERROR, message: 'Registro nao e uma saida.' });

  const patch = { ...input.fields, ...input.record };
  if (patch.type && patch.type !== 'saida') return immutablePatchError('type');
  if (patch.owner_uid && patch.owner_uid !== current.owner_uid) return immutablePatchError('owner_uid');
  if (patch.parent_id !== undefined && patch.parent_id !== current.parent_id) return immutablePatchError('parent_id');
  if (patch.recurrence_series_id !== undefined && patch.recurrence_series_id !== current.recurrence_series_id) return immutablePatchError('recurrence_series_id');
  if (patch.installment_series_id !== undefined && patch.installment_series_id !== current.installment_series_id) return immutablePatchError('installment_series_id');

  const { normalized, validation } = normalizeAndValidate({ ...current, ...patch, id, type: 'saida', owner_uid: current.owner_uid }, useCaseContext);
  if (!validation.isValid) return validationErrorResult(validation);
  const result = await financeRecords.update(id, normalized, useCaseContext);
  const mapped = mapRepositoryResult(result, 'Saida atualizada.');
  if (!mapped.success) return mapped;

  const auditWarning = await auditMutation({
    auditRepository: getAuditRepository(dependencies),
    action: 'finance_record.update',
    context: useCaseContext,
    entityId: id,
    before: current,
    after: mapped.data,
    now
  });
  if (auditWarning) mapped.warnings.push(auditWarning);
  return mapped;
}

export async function MarkExpenseAsPaid({ input = {}, context = {}, envelope = {}, dependencies = {}, now = () => new Date().toISOString() } = {}) {
  const { useCaseContext, contextError } = prepareUseCase({ context, envelope, now });
  if (contextError) return contextError;
  const financeRecords = getFinanceRecordsRepository(dependencies);
  const repositoryError = requireRepository(financeRecords, 'FinanceRecordRepository');
  if (repositoryError) return repositoryError;

  const id = input.expenseId || input.id || '';
  if (!id) return createErrorResult({ code: APPLICATION_RESULT_CODES.VALIDATION_ERROR, message: 'expenseId obrigatorio.' });
  const current = await findById(financeRecords, id, useCaseContext);
  if (!current) return createErrorResult({ code: APPLICATION_RESULT_CODES.NOT_FOUND, message: 'Saida nao encontrada.' });
  const ownerError = assertOwnRecord(current, useCaseContext);
  if (ownerError) return ownerError;
  if (current.type !== 'saida') return createErrorResult({ code: APPLICATION_RESULT_CODES.BUSINESS_RULE_ERROR, message: 'Registro nao e uma saida.' });

  if (current.status === 'Pago' && current.paid_at) {
    return createSuccessResult({
      message: 'Saida ja estava paga.',
      entityId: id,
      data: current,
      idempotentReplay: true
    });
  }

  const paidAt = input.paidAt || input.paid_at || now().slice(0, 10);
  const { normalized, validation } = normalizeAndValidate({ ...current, status: 'Pago', paid_at: paidAt, type: 'saida' }, useCaseContext);
  if (!validation.isValid) return validationErrorResult(validation);
  const result = await financeRecords.update(id, normalized, useCaseContext);
  const mapped = mapRepositoryResult(result, 'Saida marcada como paga.');
  if (!mapped.success) return mapped;

  const auditWarning = await auditMutation({
    auditRepository: getAuditRepository(dependencies),
    action: 'finance_record.mark_paid',
    context: useCaseContext,
    entityId: id,
    before: current,
    after: mapped.data,
    now
  });
  if (auditWarning) mapped.warnings.push(auditWarning);
  return mapped;
}

export async function ArchiveExpense({ input = {}, context = {}, envelope = {}, dependencies = {}, now = () => new Date().toISOString() } = {}) {
  const { useCaseContext, contextError } = prepareUseCase({ context, envelope, now });
  if (contextError) return contextError;
  const financeRecords = getFinanceRecordsRepository(dependencies);
  const repositoryError = requireRepository(financeRecords, 'FinanceRecordRepository');
  if (repositoryError) return repositoryError;

  const id = input.expenseId || input.id || '';
  if (!id) return createErrorResult({ code: APPLICATION_RESULT_CODES.VALIDATION_ERROR, message: 'expenseId obrigatorio.' });
  const current = await findById(financeRecords, id, useCaseContext);
  if (!current) return createErrorResult({ code: APPLICATION_RESULT_CODES.NOT_FOUND, message: 'Saida nao encontrada.' });
  const ownerError = assertOwnRecord(current, useCaseContext);
  if (ownerError) return ownerError;
  if (current.type !== 'saida') return createErrorResult({ code: APPLICATION_RESULT_CODES.BUSINESS_RULE_ERROR, message: 'Registro nao e uma saida.' });
  if (current.archived === true) {
    return createSuccessResult({ message: 'Saida ja estava arquivada.', entityId: id, data: current, idempotentReplay: true });
  }

  const { normalized, validation } = normalizeAndValidate({ ...current, archived: true, archived_at: now(), type: 'saida' }, useCaseContext);
  if (!validation.isValid) return validationErrorResult(validation);
  const result = await financeRecords.update(id, normalized, useCaseContext);
  const mapped = mapRepositoryResult(result, 'Saida arquivada.');
  if (!mapped.success) return mapped;
  const auditWarning = await auditMutation({
    auditRepository: getAuditRepository(dependencies),
    action: 'finance_record.archive',
    context: useCaseContext,
    entityId: id,
    before: current,
    after: mapped.data,
    now
  });
  if (auditWarning) mapped.warnings.push(auditWarning);
  return mapped;
}

export async function DeleteExpense({ input = {}, context = {}, envelope = {}, dependencies = {}, now = () => new Date().toISOString() } = {}) {
  const { useCaseContext, contextError } = prepareUseCase({ context, envelope, now });
  if (contextError) return contextError;
  const financeRecords = getFinanceRecordsRepository(dependencies);
  const repositoryError = requireRepository(financeRecords, 'FinanceRecordRepository');
  if (repositoryError) return repositoryError;

  const id = input.expenseId || input.id || '';
  if (!id) return createErrorResult({ code: APPLICATION_RESULT_CODES.VALIDATION_ERROR, message: 'expenseId obrigatorio.' });
  const current = await findById(financeRecords, id, useCaseContext);
  if (!current) return createErrorResult({ code: APPLICATION_RESULT_CODES.NOT_FOUND, message: 'Saida nao encontrada.' });
  const ownerError = assertOwnRecord(current, useCaseContext);
  if (ownerError) return ownerError;
  if (current.type !== 'saida') return createErrorResult({ code: APPLICATION_RESULT_CODES.BUSINESS_RULE_ERROR, message: 'Registro nao e uma saida.' });

  const result = await financeRecords.delete(id, useCaseContext);
  const mapped = mapRepositoryResult(result, 'Saida excluida.');
  if (!mapped.success) return mapped;
  const auditWarning = await auditMutation({
    auditRepository: getAuditRepository(dependencies),
    action: 'finance_record.delete',
    context: useCaseContext,
    entityId: id,
    before: current,
    now
  });
  if (auditWarning) mapped.warnings.push(auditWarning);
  return mapped;
}

export async function CreateIncome({ input = {}, context = {}, envelope = {}, dependencies = {}, now = () => new Date().toISOString() } = {}) {
  const { useCaseContext, contextError } = prepareUseCase({ context, envelope, now });
  if (contextError) return contextError;
  const financeRecords = getFinanceRecordsRepository(dependencies);
  const repositoryError = requireRepository(financeRecords, 'FinanceRecordRepository');
  if (repositoryError) return repositoryError;

  const { normalized, validation } = normalizeAndValidate(buildIncomeRecord(input), useCaseContext);
  if (!validation.isValid) return validationErrorResult(validation);
  const result = await financeRecords.create(normalized, useCaseContext);
  const mapped = mapRepositoryResult(result, 'Entrada criada.');
  if (!mapped.success) return mapped;
  const auditWarning = await auditMutation({
    auditRepository: getAuditRepository(dependencies),
    action: 'finance_record.create_income',
    context: useCaseContext,
    entityId: mapped.entityId,
    after: mapped.data,
    now
  });
  if (auditWarning) mapped.warnings.push(auditWarning);
  return mapped;
}

export async function ConsolidateMonthlyIncome({ input = {}, context = {}, envelope = {}, dependencies = {}, now = () => new Date().toISOString() } = {}) {
  const { useCaseContext, contextError } = prepareUseCase({ context, envelope, now });
  if (contextError) return contextError;
  const financeRecords = getFinanceRecordsRepository(dependencies);
  const repositoryError = requireRepository(financeRecords, 'FinanceRecordRepository');
  if (repositoryError) return repositoryError;

  const person = input.person || '';
  const competence = normalizeCompetenceKey(input.competencia || input.competence || '');
  if (!person || !competence) {
    return createErrorResult({ code: APPLICATION_RESULT_CODES.VALIDATION_ERROR, message: 'person e competence obrigatorios.' });
  }
  const records = await listRecords(financeRecords, useCaseContext);
  const personRecord = records.find((record) => record.type === 'pessoa' && record.person === person) || null;
  const data = consolidatePersonMonthlyEntry(person, competence, {
    records,
    salaryInfo: input.salaryInfo,
    getSalaryInfo: dependencies.services?.resolveEffectiveSalary || (() => ({
      salario: Number(personRecord?.salary_base ?? personRecord?.amount ?? 0) || 0,
      competence
    })),
    banco: input.banco,
    receivingType: input.receivingType,
    dsrInfo: input.dsrInfo,
    calculateInss: dependencies.services?.calculateInss,
    calculateIrrf: dependencies.services?.calculateIrrf,
    isReferenceSalaryRecord: dependencies.services?.isReferenceSalaryRecord
  });
  return createSuccessResult({ message: 'Entrada mensal consolidada.', data });
}

async function persistSeries({ records, financeRecords, useCaseContext, auditRepository, action, message, now }) {
  if (!records.length) return createErrorResult({ code: APPLICATION_RESULT_CODES.VALIDATION_ERROR, message });
  const normalized = records.map((record) => normalizeFinanceRecord({ ...record, ...actorMetadata(useCaseContext) }));
  const invalid = normalized.map((record) => validateFinanceRecord(record, { allowLegacy: true })).find((item) => !item.isValid);
  if (invalid) return validationErrorResult(invalid);
  const result = await financeRecords.createMany(normalized, useCaseContext);
  const mapped = mapRepositoryResult(result, message);
  if (!mapped.success) return mapped;
  const auditWarning = await auditMutation({
    auditRepository,
    action,
    context: useCaseContext,
    entityId: mapped.entityIds[0] || mapped.entityId,
    after: { count: mapped.entityIds.length, ids: mapped.entityIds },
    now
  });
  if (auditWarning) mapped.warnings.push(auditWarning);
  return mapped;
}

export async function CreateInstallmentSeries({ input = {}, context = {}, envelope = {}, dependencies = {}, now = () => new Date().toISOString() } = {}) {
  const { useCaseContext, contextError } = prepareUseCase({ context, envelope, now });
  if (contextError) return contextError;
  const financeRecords = getFinanceRecordsRepository(dependencies);
  const repositoryError = requireRepository(financeRecords, 'FinanceRecordRepository');
  if (repositoryError) return repositoryError;
  return persistSeries({
    records: buildInstallmentSaidaPayloads(input),
    financeRecords,
    useCaseContext,
    auditRepository: getAuditRepository(dependencies),
    action: 'finance_record.create_installment_series',
    message: 'Parcelamento criado.',
    now
  });
}

export async function CreateRecurrenceSeries({ input = {}, context = {}, envelope = {}, dependencies = {}, now = () => new Date().toISOString() } = {}) {
  const { useCaseContext, contextError } = prepareUseCase({ context, envelope, now });
  if (contextError) return contextError;
  const financeRecords = getFinanceRecordsRepository(dependencies);
  const repositoryError = requireRepository(financeRecords, 'FinanceRecordRepository');
  if (repositoryError) return repositoryError;
  return persistSeries({
    records: buildRecurringSaidaPayloads(input),
    financeRecords,
    useCaseContext,
    auditRepository: getAuditRepository(dependencies),
    action: 'finance_record.create_recurrence_series',
    message: 'Recorrencia criada.',
    now
  });
}

function resolveSalaryBase(input = {}, records = []) {
  if (Number(input.salaryBase || 0) > 0) return Number(input.salaryBase);
  const personRecord = records.find((record) =>
    record?.type === 'pessoa' &&
    String(record.person || '').trim() === String(input.person || '').trim()
  ) || null;
  const salary = ResolveEffectiveSalary({
    person: input.person || '',
    competence: input.competence || input.competencia || input.occurredDate || input.occurred_date || '',
    salaryHistory: records,
    personRecord
  });
  return Number(salary?.salary || salary?.salario || 0);
}

function buildHourRecord(input = {}, context = {}, records = []) {
  const commandInput = {
    ...input,
    startTime: input.startTime || input.start_time || input.horaInicial || '',
    endTime: input.endTime || input.end_time || input.horaFinal || '',
    hourControlType: input.hourControlType || input.hour_control_type || input.hourEntryType || '',
    occurredDate: input.occurredDate || input.occurred_date || '',
    salaryBase: resolveSalaryBase(input, records)
  };
  const session = CalculateWorkSession(commandInput);
  if (!session.isValid) return { session, record: null };
  const hours = roundCurrency(session.netMinutes / 60);
  const amount = roundCurrency(session.calculatedValueCents / 100);
  return {
    session,
    record: {
      type: 'controle_horas',
      person: commandInput.person || '',
      competence: normalizeCompetenceKey(commandInput.competence || commandInput.occurredDate || ''),
      occurred_date: commandInput.occurredDate || '',
      hour_control_type: commandInput.hourControlType || 'Hora Extra',
      hour_entry_type: commandInput.hourEntryType || commandInput.hourControlType || 'Hora Extra',
      start_time: commandInput.startTime || '',
      end_time: commandInput.endTime || '',
      horaInicial: commandInput.startTime || '',
      horaFinal: commandInput.endTime || '',
      break_start: input.breakStartTime || input.break_start || input.breakStart || '',
      break_end: input.breakEndTime || input.break_end || input.breakEnd || '',
      break_start_time: input.breakStartTime || input.break_start_time || input.break_start || input.breakStart || '',
      break_end_time: input.breakEndTime || input.break_end_time || input.break_end || input.breakEnd || '',
      crosses_midnight: session.crossesMidnight,
      ended_date: session.endedDate || '',
      gross_minutes: session.grossMinutes,
      break_minutes: session.breakMinutes,
      net_minutes: session.netMinutes,
      quantidadeHoras: hours,
      quantidadeHorasFormatada: formatMinutesToClock(session.netMinutes),
      hours_quantity: hours,
      hours_formatted: formatMinutesToClock(session.netMinutes),
      valorTotalCalculado: amount,
      financial_total: amount,
      amount,
      observation: input.observation || input.observacao || input.notes || '',
      description: input.description || input.observation || input.observacao || input.notes || '',
      salary_base_snapshot: commandInput.salaryBase,
      salary_base_reference: commandInput.salaryBase,
      monthly_hours_reference: input.monthlyHours || input.monthly_hours_reference || 220,
      bank_nature: input.bankNature || input.bank_nature || 'Debito',
      bank_minutes: session.bankMinutes,
      overtime_percentage: input.overtimePercentage ?? input.percentual ?? input.percentage ?? 0,
      percentualUsado: input.overtimePercentage ?? input.percentual ?? input.percentage ?? 0,
      base_hourly_rate_cents: session.baseHourlyRateCents,
      calculated_value_cents: session.calculatedValueCents,
      financial_hour_value: hours > 0 ? roundCurrency(amount / hours) : 0,
      hour_value_base: roundCurrency(session.baseHourlyRateCents / 100),
      valorBaseHora: roundCurrency(session.baseHourlyRateCents / 100),
      valorHoraCalculado: hours > 0 ? roundCurrency(amount / hours) : 0,
      calculation_version: session.calculationVersion,
      ...actorMetadata(context)
    }
  };
}

export async function CreateHourEntry({ input = {}, context = {}, envelope = {}, dependencies = {}, now = () => new Date().toISOString() } = {}) {
  const { useCaseContext, contextError } = prepareUseCase({ context, envelope, now });
  if (contextError) return contextError;
  const financeRecords = getFinanceRecordsRepository(dependencies);
  const repositoryError = requireRepository(financeRecords, 'FinanceRecordRepository');
  if (repositoryError) return repositoryError;
  const records = await listRecords(financeRecords, useCaseContext);
  const built = buildHourRecord(input, useCaseContext, records);
  if (!built.session.isValid) {
    return createErrorResult({ code: APPLICATION_RESULT_CODES.VALIDATION_ERROR, message: 'Jornada invalida.', validationErrors: built.session.errors });
  }
  const { normalized, validation } = normalizeAndValidate(built.record, useCaseContext);
  if (!validation.isValid) return validationErrorResult(validation);
  const result = await financeRecords.create(normalized, useCaseContext);
  const mapped = mapRepositoryResult(result, 'Lancamento de horas criado.');
  if (!mapped.success) return mapped;
  const auditWarning = await auditMutation({
    auditRepository: getAuditRepository(dependencies),
    action: 'finance_record.create_hour_entry',
    context: useCaseContext,
    entityId: mapped.entityId,
    after: mapped.data,
    now
  });
  if (auditWarning) mapped.warnings.push(auditWarning);
  return mapped;
}

export async function UpdateHourEntry({ input = {}, context = {}, envelope = {}, dependencies = {}, now = () => new Date().toISOString() } = {}) {
  const { useCaseContext, contextError } = prepareUseCase({ context, envelope, now });
  if (contextError) return contextError;
  const financeRecords = getFinanceRecordsRepository(dependencies);
  const repositoryError = requireRepository(financeRecords, 'FinanceRecordRepository');
  if (repositoryError) return repositoryError;
  const id = input.id || '';
  if (!id) return createErrorResult({ code: APPLICATION_RESULT_CODES.VALIDATION_ERROR, message: 'id obrigatorio.' });
  const current = await findById(financeRecords, id, useCaseContext);
  if (!current) return createErrorResult({ code: APPLICATION_RESULT_CODES.NOT_FOUND, message: 'Lancamento de horas nao encontrado.' });
  const ownerError = assertOwnRecord(current, useCaseContext);
  if (ownerError) return ownerError;
  if (current.type !== 'controle_horas') {
    return createErrorResult({ code: APPLICATION_RESULT_CODES.BUSINESS_RULE_ERROR, message: 'Registro nao e lancamento de horas.' });
  }
  const records = await listRecords(financeRecords, useCaseContext);
  const built = buildHourRecord({ ...current, ...input.fields, ...input.record }, useCaseContext, records);
  if (!built.session.isValid) {
    return createErrorResult({ code: APPLICATION_RESULT_CODES.VALIDATION_ERROR, message: 'Jornada invalida.', validationErrors: built.session.errors });
  }
  const { normalized, validation } = normalizeAndValidate({ ...current, ...built.record, id, type: 'controle_horas', owner_uid: current.owner_uid }, useCaseContext);
  if (!validation.isValid) return validationErrorResult(validation);
  const result = await financeRecords.update(id, normalized, useCaseContext);
  const mapped = mapRepositoryResult(result, 'Lancamento de horas atualizado.');
  if (!mapped.success) return mapped;
  const auditWarning = await auditMutation({
    auditRepository: getAuditRepository(dependencies),
    action: 'finance_record.update_hour_entry',
    context: useCaseContext,
    entityId: id,
    before: current,
    after: mapped.data,
    now
  });
  if (auditWarning) mapped.warnings.push(auditWarning);
  return mapped;
}

export function summarizeHourRecords(records = [], options = {}) {
  return buildHourPeriodSummary(records, options);
}
