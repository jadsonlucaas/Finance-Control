import {
  DISALLOWED_FINANCE_RECORD_FIELDS,
  FINANCE_RECORD_SCHEMA_VERSION,
  FINANCE_RECORD_TYPES,
  getFinanceRecordSchema,
  isKnownFinanceRecordType
} from './financeRecordSchemas.js';
import { validateFinanceRecord } from './financeRecordValidation.js';

function toStringValue(value) {
  return value === null || value === undefined ? '' : String(value);
}

function toNumberValue(value) {
  if (value === '' || value === null || value === undefined) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : value;
}

function toIntegerValue(value) {
  if (value === '' || value === null || value === undefined) return 0;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : value;
}

function toBooleanValue(value) {
  if (value === '') return false;
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (value === 1) return true;
  if (value === 0) return false;
  return typeof value === 'boolean' ? value : value;
}

function normalizeKind(value, kind) {
  if (value === undefined) return undefined;
  if (['number', 'numberNonNegative', 'money', 'moneyNonNegative', 'positiveMoney', 'percentageReasonable', 'percentageLimit'].includes(kind)) {
    return toNumberValue(value);
  }
  if (['integerNonNegative', 'positiveInteger'].includes(kind)) return toIntegerValue(value);
  if (kind === 'boolean') return toBooleanValue(value);
  if (['string', 'nonEmptyString', 'date', 'dateOrIso', 'dateOrCompetence', 'competence', 'isoDateTime', 'enum'].includes(kind)) {
    return toStringValue(value).trim();
  }
  return value;
}

function stripDisallowedFields(record = {}) {
  return Object.fromEntries(
    Object.entries(record).filter(([key]) => !DISALLOWED_FINANCE_RECORD_FIELDS.includes(key))
  );
}

function applyAliases(record = {}, schema = null, warnings = []) {
  const aliases = schema?.aliases || {};
  const normalized = { ...record };
  Object.entries(aliases).forEach(([canonical, aliasList]) => {
    if (normalized[canonical] !== undefined && normalized[canonical] !== '') return;
    const alias = aliasList.find((field) => normalized[field] !== undefined && normalized[field] !== '');
    if (!alias) return;
    normalized[canonical] = normalized[alias];
    warnings.push({
      field: canonical,
      code: 'ALIAS_NORMALIZED',
      message: `Alias legado ${alias} normalizado para ${canonical}.`,
      severity: 'warning'
    });
  });
  return normalized;
}

function applySchemaKinds(record = {}, schema = null) {
  if (!schema) return { ...record };
  const normalized = { ...record };
  Object.entries(schema.fields).forEach(([field, spec]) => {
    if (normalized[field] === undefined) return;
    normalized[field] = normalizeKind(normalized[field], spec.kind);
  });
  return normalized;
}

function applyTypeDefaults(record = {}) {
  if (record.type === FINANCE_RECORD_TYPES.SAIDA) {
    return {
      status: 'Em aberto',
      installment_no: 0,
      total_installments: 0,
      archived: false,
      amount: 0,
      ...record
    };
  }
  if (record.type === FINANCE_RECORD_TYPES.ENTRADA) {
    return {
      status: 'Pago',
      installment_no: 0,
      total_installments: 0,
      archived: false,
      amount: 0,
      ...record
    };
  }
  if (record.type === FINANCE_RECORD_TYPES.PESSOA) {
    return { amount: 0, salary_base: 0, ...record };
  }
  if (record.type === FINANCE_RECORD_TYPES.MACRO) return { amount: 0, ...record };
  if (record.type === FINANCE_RECORD_TYPES.CATEGORIA) return { amount: 0, category_color: '', category_icon: '', ...record };
  if (record.type === FINANCE_RECORD_TYPES.CONTROLE_HORAS) return { amount: 0, quantidadeHoras: 0, valorTotalCalculado: 0, archived: false, ...record };
  if (record.type === FINANCE_RECORD_TYPES.SALARIO_HISTORICO) {
    const salaryBase = record.salary_base ?? record.amount ?? 0;
    return { amount: salaryBase, salary_base: salaryBase, ...record };
  }
  if (record.type === FINANCE_RECORD_TYPES.PERCENTAGE_RULE) {
    const percentage = record.percentage ?? record.percentual ?? 0;
    return { percentage, active: true, ...record };
  }
  return { ...record };
}

export function normalizeFinanceRecord(input = {}, context = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return input;
  const warnings = [];
  const stripped = stripDisallowedFields(input);
  const schema = getFinanceRecordSchema(stripped.type);
  const aliased = applyAliases(stripped, schema, warnings);
  let normalized = applySchemaKinds(applyTypeDefaults(aliased), schema);

  if (normalized.type === FINANCE_RECORD_TYPES.SAIDA && normalized.status !== 'Pago') normalized.paid_at = '';
  if ((normalized.type === FINANCE_RECORD_TYPES.MACRO || normalized.type === FINANCE_RECORD_TYPES.CATEGORIA) && !normalized.shared_scope) {
    normalized.shared_scope = context.defaultReferenceScope || 'personal';
  }

  if (context.user) {
    normalized = {
      ...normalized,
      owner_uid: normalized.owner_uid || context.user.uid || '',
      owner_email: normalized.owner_email || context.user.email || ''
    };
  }

  Object.defineProperty(normalized, '__contractWarnings', {
    value: warnings,
    enumerable: false,
    configurable: true
  });
  if (context.strict) {
    const validation = validateFinanceRecord(normalized, context);
    if (!validation.isValid) {
      throw new Error(validation.errors.map((error) => error.message).join(' '));
    }
  }
  return normalized;
}

export function migrateFinanceRecordInMemory(record = {}, context = {}) {
  const normalized = normalizeFinanceRecord(record, context);
  const validation = validateFinanceRecord(normalized, context);
  return {
    original: record,
    normalized,
    validation: {
      ...validation,
      warnings: [...(normalized.__contractWarnings || []), ...validation.warnings]
    },
    wrote: false
  };
}

export function normalizeFinanceRecords(records = [], context = {}) {
  return Array.isArray(records)
    ? records.map((record) => normalizeFinanceRecord(record, context))
    : [];
}

export function buildFinanceRecordDryRun(records = [], context = {}) {
  const source = Array.isArray(records) ? records : [];
  const analyzed = source.map((record, index) => {
    const migration = migrateFinanceRecordInMemory(record, context);
    const issues = [...migration.validation.errors, ...migration.validation.warnings];
    const classification = migration.validation.errors.length
      ? 'invalid'
      : (migration.validation.warnings.length ? 'valid_legacy_with_warning' : 'valid_current');
    return {
      index,
      id: record?.id || '',
      type: record?.type || '',
      classification,
      issues,
      normalized: migration.normalized
    };
  });

  const byType = analyzed.reduce((acc, item) => {
    const type = item.type || 'unknown';
    acc[type] ||= { total: 0, valid_current: 0, valid_legacy_with_warning: 0, invalid: 0 };
    acc[type].total += 1;
    acc[type][item.classification] += 1;
    return acc;
  }, {});

  return {
    schemaVersion: FINANCE_RECORD_SCHEMA_VERSION,
    total: analyzed.length,
    byType,
    analyzed,
    wrote: false
  };
}

export function isKnownRecordAfterNormalization(record = {}) {
  return isKnownFinanceRecordType(normalizeFinanceRecord(record)?.type);
}
