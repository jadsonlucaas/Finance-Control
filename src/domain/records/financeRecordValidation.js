import {
  DISALLOWED_FINANCE_RECORD_FIELDS,
  FINANCE_RECORD_SCHEMA_VERSION,
  getFinanceRecordSchema,
  isKnownFinanceRecordType
} from './financeRecordSchemas.js';

export function createRecordIssue(field, code, message, severity = 'error') {
  return { field, code, message, severity };
}

export function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

export function hasMaxTwoDecimals(value) {
  return isFiniteNumber(value) && Math.abs(value * 100 - Math.round(value * 100)) <= 1e-6;
}

export function isInteger(value) {
  return Number.isInteger(value);
}

export function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

export function isPositiveInteger(value) {
  return Number.isInteger(value) && value > 0;
}

export function isCompetence(value) {
  return typeof value === 'string' && (/^\d{4}-\d{2}$/).test(value);
}

export function isDateString(value) {
  return typeof value === 'string' && (/^\d{4}-\d{2}-\d{2}$/).test(value);
}

export function isIsoDateTime(value) {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

export function isDateOrIso(value) {
  return value === '' || isDateString(value) || isIsoDateTime(value);
}

export function isDateOrCompetence(value) {
  return value === '' || isDateString(value) || isCompetence(value);
}

function validateKind(value, spec = {}) {
  if (value === undefined || value === null) return true;
  if (value === '') {
    if (spec.kind === 'nonEmptyString') return false;
    if (spec.kind === 'enum') return spec.values.includes(value);
    return true;
  }
  if (spec.kind === 'string') return typeof value === 'string';
  if (spec.kind === 'nonEmptyString') return isNonEmptyString(value);
  if (spec.kind === 'number') return isFiniteNumber(value);
  if (spec.kind === 'numberNonNegative') return isFiniteNumber(value) && value >= 0;
  if (spec.kind === 'money') return isFiniteNumber(value) && hasMaxTwoDecimals(value);
  if (spec.kind === 'moneyNonNegative') return isFiniteNumber(value) && value >= 0 && hasMaxTwoDecimals(value);
  if (spec.kind === 'positiveMoney') return isFiniteNumber(value) && value > 0 && hasMaxTwoDecimals(value);
  if (spec.kind === 'integerNonNegative') return isInteger(value) && value >= 0;
  if (spec.kind === 'positiveInteger') return isPositiveInteger(value);
  if (spec.kind === 'boolean') return typeof value === 'boolean';
  if (spec.kind === 'competence') return isCompetence(value);
  if (spec.kind === 'date') return isDateString(value);
  if (spec.kind === 'isoDateTime') return isIsoDateTime(value);
  if (spec.kind === 'dateOrIso') return isDateOrIso(value);
  if (spec.kind === 'dateOrCompetence') return isDateOrCompetence(value);
  if (spec.kind === 'object') return isPlainObject(value);
  if (spec.kind === 'enum') return spec.values.includes(value);
  if (spec.kind === 'percentageReasonable') return isFiniteNumber(value) && value >= 0 && value <= 1000;
  if (spec.kind === 'percentageLimit') return isFiniteNumber(value) && value >= 0 && value <= 100;
  return true;
}

function expectedKindMessage(spec = {}) {
  if (spec.kind === 'enum') return `Valor deve pertencer ao enum: ${spec.values.join(', ')}.`;
  return `Valor nao corresponde ao tipo esperado: ${spec.kind}.`;
}

function normalizedCompetence(record = {}, field) {
  return String(record[field] || '').trim();
}

function compareCompetence(start = '', end = '') {
  if (!isCompetence(start) || !isCompetence(end)) return 0;
  return start.localeCompare(end);
}

function parseFormattedHoursToDecimal(value = '') {
  const raw = String(value || '').trim();
  const match = /^(\d{1,3}):(\d{2})$/.exec(raw);
  if (!match) return Number.parseFloat(raw.replace(',', '.'));
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes) || minutes > 59) return NaN;
  return hours + (minutes / 60);
}

function isClockValue(value = '') {
  if (value === undefined || value === null || value === '') return true;
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(value));
}

function validateCrossFields(record, schema, errors, warnings, context) {
  if (record.schema_version === undefined) {
    warnings.push(createRecordIssue('schema_version', 'LEGACY_SCHEMA_VERSION_MISSING', 'Registro legado sem schema_version.', 'warning'));
  }

  if (context.operation === 'update' && context.currentRecord) {
    if (record.type !== context.currentRecord.type) {
      errors.push(createRecordIssue('type', 'TYPE_IMMUTABLE', 'O tipo do registro nao pode ser alterado.'));
    }
    if (record.owner_uid !== undefined && context.currentRecord.owner_uid !== undefined && record.owner_uid !== context.currentRecord.owner_uid) {
      errors.push(createRecordIssue('owner_uid', 'OWNER_IMMUTABLE', 'owner_uid nao pode ser alterado.'));
    }
    if (record.owner_email !== undefined && context.currentRecord.owner_email !== undefined && record.owner_email !== context.currentRecord.owner_email) {
      errors.push(createRecordIssue('owner_email', 'OWNER_IMMUTABLE', 'owner_email nao pode ser alterado.'));
    }
    if (record.shared_scope !== undefined && context.currentRecord.shared_scope !== undefined && record.shared_scope !== context.currentRecord.shared_scope) {
      errors.push(createRecordIssue('shared_scope', 'SCOPE_IMMUTABLE', 'shared_scope nao pode ser alterado silenciosamente.'));
    }
  }

  if (context.requireOwner) {
    if (!isNonEmptyString(record.owner_uid)) errors.push(createRecordIssue('owner_uid', 'OWNER_REQUIRED', 'owner_uid e obrigatorio.'));
    if (typeof record.owner_email !== 'string') errors.push(createRecordIssue('owner_email', 'OWNER_EMAIL_REQUIRED', 'owner_email e obrigatorio.'));
  }

  if (record.type === 'saida') {
    if (record.status === 'Pago' && !record.paid_at) {
      warnings.push(createRecordIssue('paid_at', 'PAID_AT_MISSING', 'Saida paga sem paid_at.', 'warning'));
    }
    if (record.status !== 'Pago' && record.paid_at) {
      warnings.push(createRecordIssue('paid_at', 'PAID_AT_WITH_OPEN_STATUS', 'paid_at informado para saida nao paga.', 'warning'));
    }
    if (record.installment_no > 0 && record.total_installments > 0 && record.installment_no > record.total_installments) {
      errors.push(createRecordIssue('installment_no', 'INSTALLMENT_OUT_OF_RANGE', 'installment_no nao pode exceder total_installments.'));
    }
    if (record.total_installments > 1 && !record.parent_id) {
      if (record.schema_version || record.is_installment === true || record.source_mode === 'installment') {
        errors.push(createRecordIssue('parent_id', 'INSTALLMENT_PARENT_REQUIRED', 'parent_id e obrigatorio para serie parcelada nova.'));
      } else {
        warnings.push(createRecordIssue('parent_id', 'INSTALLMENT_PARENT_MISSING', 'Parcela sem parent_id; legado permitido ate migracao.', 'warning'));
      }
    }
    const hasRecurrenceSeries = isNonEmptyString(record.recurrence_series_id);
    const hasRecurrenceSequence = Number(record.recurrence_sequence_no || 0) > 0 || Number(record.recurrence_total_occurrences || 0) > 0;
    if (record.source_mode === 'recurring' || hasRecurrenceSeries || hasRecurrenceSequence) {
      if (!hasRecurrenceSeries) {
        errors.push(createRecordIssue('recurrence_series_id', 'RECURRENCE_SERIES_REQUIRED', 'recurrence_series_id e obrigatorio para serie recorrente nova.'));
      }
      if (!['monthly', 'yearly'].includes(record.recurrence_frequency)) {
        errors.push(createRecordIssue('recurrence_frequency', 'RECURRENCE_FREQUENCY_REQUIRED', 'recurrence_frequency deve ser monthly ou yearly para serie nova.'));
      }
      if (!isPositiveInteger(record.recurrence_sequence_no)) {
        errors.push(createRecordIssue('recurrence_sequence_no', 'RECURRENCE_SEQUENCE_REQUIRED', 'Sequencia da recorrencia deve ser inteira positiva.'));
      }
      if (!isPositiveInteger(record.recurrence_total_occurrences)) {
        errors.push(createRecordIssue('recurrence_total_occurrences', 'RECURRENCE_TOTAL_REQUIRED', 'Total da recorrencia deve ser inteiro positivo.'));
      }
      if (isPositiveInteger(record.recurrence_sequence_no) && isPositiveInteger(record.recurrence_total_occurrences) && record.recurrence_sequence_no > record.recurrence_total_occurrences) {
        errors.push(createRecordIssue('recurrence_sequence_no', 'RECURRENCE_SEQUENCE_OUT_OF_RANGE', 'Sequencia da recorrencia nao pode exceder o total.'));
      }
      if (record.parent_id || record.is_installment === true || Number(record.total_installments || 0) > 1) {
        errors.push(createRecordIssue('parent_id', 'RECURRENCE_INSTALLMENT_CONFLICT', 'Serie recorrente nova nao pode reutilizar parent_id de parcelamento.'));
      }
    }
  }

  if (record.type === 'entrada') {
    const computed = Number(record.proventos || 0) - Number(record.descontos || 0);
    if (record.proventos !== undefined && record.descontos !== undefined && record.liquido !== undefined && Number.isFinite(computed) && Math.abs(computed - record.liquido) > 0.01) {
      warnings.push(createRecordIssue('liquido', 'DERIVED_VALUE_DIVERGENCE', 'Valor liquido persistido diverge dos campos derivados.', 'warning'));
    }
  }

  if (record.type === 'pessoa' && isNonEmptyString(record.person) && context.existingRecords) {
    const normalizedName = record.person.trim().toLowerCase();
    const duplicated = context.existingRecords.some((item) =>
      item !== context.currentRecord &&
      item?.type === 'pessoa' &&
      String(item.person || '').trim().toLowerCase() === normalizedName &&
      (!record.id || item.id !== record.id)
    );
    if (duplicated) errors.push(createRecordIssue('person', 'DUPLICATE_PERSON', 'Pessoa duplicada pelo nome.'));
  }

  if (record.type === 'controle_horas') {
    const parsedFormatted = parseFormattedHoursToDecimal(record.quantidadeHorasFormatada || record.hours_formatted || '');
    if (record.quantidadeHorasFormatada && Number.isFinite(parsedFormatted) && record.quantidadeHoras !== undefined && Math.abs(parsedFormatted - record.quantidadeHoras) > 0.01) {
      warnings.push(createRecordIssue('quantidadeHorasFormatada', 'HOUR_FORMAT_DIVERGENCE', 'Quantidade formatada diverge da quantidade numerica.', 'warning'));
    }
    ['start_time', 'end_time', 'break_start_time', 'break_end_time', 'horaInicial', 'horaFinal'].forEach((field) => {
      if (!isClockValue(record[field])) errors.push(createRecordIssue(field, 'INVALID_CLOCK', 'Horario deve usar HH:MM valido.'));
    });
    if (record.net_minutes !== undefined && record.gross_minutes !== undefined && record.break_minutes !== undefined) {
      if (record.net_minutes !== Math.max(0, record.gross_minutes - record.break_minutes)) {
        warnings.push(createRecordIssue('net_minutes', 'DERIVED_MINUTES_DIVERGENCE', 'Minutos liquidos divergem de bruto menos intervalo.', 'warning'));
      }
    }
  }

  if (record.type === 'salario_historico') {
    const start = normalizedCompetence(record, 'vigencia_inicio') || String(record.start_date || '').slice(0, 7);
    const end = normalizedCompetence(record, 'vigencia_fim') || String(record.end_date || '').slice(0, 7);
    if (start && end && compareCompetence(start, end) > 0) {
      errors.push(createRecordIssue('vigencia_fim', 'INVALID_PERIOD', 'Vigencia final nao pode ser menor que a inicial.'));
    }
  }

  if (record.type === 'percentage_rule') {
    const start = normalizedCompetence(record, 'start_competence') || normalizedCompetence(record, 'startCompetence');
    const end = normalizedCompetence(record, 'end_competence') || normalizedCompetence(record, 'endCompetence');
    if (start && end && compareCompetence(start, end) > 0) {
      errors.push(createRecordIssue('end_competence', 'INVALID_PERIOD', 'Competencia final nao pode ser menor que a inicial.'));
    }
  }

  if ((record.type === 'macro' || record.type === 'categoria') && record.shared_scope && !['global', 'personal'].includes(record.shared_scope)) {
    errors.push(createRecordIssue('shared_scope', 'INVALID_SCOPE', 'Escopo de referencia invalido.'));
  }

  return { errors, warnings };
}

export function validateFinanceRecord(input = {}, context = {}) {
  const errors = [];
  const warnings = [];
  if (!isPlainObject(input)) {
    return {
      isValid: false,
      normalized: input,
      errors: [createRecordIssue('$record', 'INVALID_RECORD', 'Registro deve ser um objeto.')],
      warnings,
      schemaVersion: FINANCE_RECORD_SCHEMA_VERSION
    };
  }

  if (!input.type) {
    errors.push(createRecordIssue('type', 'TYPE_REQUIRED', 'Campo type e obrigatorio.'));
  }
  if (input.type && !isKnownFinanceRecordType(input.type)) {
    errors.push(createRecordIssue('type', 'UNKNOWN_TYPE', `Tipo financeiro desconhecido: ${input.type}.`));
  }

  const schema = getFinanceRecordSchema(input.type);
  if (!schema) {
    return {
      isValid: errors.length === 0,
      normalized: input,
      errors,
      warnings,
      schemaVersion: FINANCE_RECORD_SCHEMA_VERSION
    };
  }

  DISALLOWED_FINANCE_RECORD_FIELDS.forEach((field) => {
    if (field in input) {
      errors.push(createRecordIssue(field, 'DISALLOWED_FIELD', 'Campo nao permitido no registro financeiro.'));
    }
  });

  Object.keys(input).forEach((field) => {
    if (!(field in schema.fields)) {
      warnings.push(createRecordIssue(field, 'UNKNOWN_FIELD', 'Campo fora do contrato conhecido.', 'warning'));
    }
  });

  schema.required.forEach((field) => {
    if (input[field] === undefined || input[field] === null || input[field] === '') {
      errors.push(createRecordIssue(field, 'REQUIRED_FIELD', `Campo ${field} e obrigatorio para ${schema.type}.`));
    }
  });

  Object.entries(schema.fields).forEach(([field, spec]) => {
    if (!validateKind(input[field], spec)) {
      errors.push(createRecordIssue(field, 'INVALID_FIELD_TYPE', expectedKindMessage(spec)));
    }
  });

  validateCrossFields(input, schema, errors, warnings, context);

  return {
    isValid: errors.length === 0,
    normalized: input,
    errors,
    warnings,
    schemaVersion: input.schema_version || FINANCE_RECORD_SCHEMA_VERSION
  };
}

export function assertFinanceRecord(input = {}, context = {}) {
  const result = validateFinanceRecord(input, context);
  if (!result.isValid) {
    const error = new Error('FINANCE_RECORD_CONTRACT_INVALID');
    error.code = 'FINANCE_RECORD_CONTRACT_INVALID';
    error.validation = result;
    throw error;
  }
  return result;
}

export function validateFinanceRecordShape(record = {}) {
  const result = validateFinanceRecord(record, { allowLegacy: true });
  return {
    isValid: result.isValid,
    errors: result.errors.map((error) => error.message),
    isKnownType: isKnownFinanceRecordType(record?.type)
  };
}

export function detectLegacyFinanceRecordIssues(record = {}) {
  const result = validateFinanceRecord(record, { allowLegacy: true });
  return [...result.errors, ...result.warnings];
}
