import { APPLICATION_RESULT_CODES, createErrorResult, createSuccessResult } from '../gateway/applicationResult.js';
import { buildOperationFingerprint } from '../gateway/idempotency.js';
import { repositoryFailure, repositoryOk, REPOSITORY_ERROR_CODES } from '../repositories/repositoryResult.js';
import { appendAuditEvent, buildAuditEvent } from '../useCases/auditUseCaseEvents.js';
import { createUseCaseContext, validateFinancialUseCaseContext } from '../useCases/useCaseContext.js';

export const FINANCE_BACKUP_VERSION = '1.0.0';
export const FINANCE_BACKUP_SCHEMA_VERSION = 1;
export const LEGACY_BACKUP_VERSION = '0.9.0';

export const BACKUP_COLLECTIONS = Object.freeze([
  'finance_records',
  'personal_references',
  'local_settings',
  'percentage_rules',
  'salary_history',
  'hour_entries'
]);

export const OPERATIONAL_COLLECTIONS = Object.freeze([
  'audit_logs',
  'idempotency_receipts',
  'import_batches'
]);

export const RESTORE_STATUS = Object.freeze({
  NEW: 'new',
  IDENTICAL: 'identical',
  CONFLICT: 'conflict',
  INCOMPATIBLE: 'incompatible',
  ORPHANED: 'orphaned',
  SKIPPED_OPERATIONAL: 'skipped_operational'
});

const SENSITIVE_KEYS = Object.freeze([
  'password',
  'token',
  'accesstoken',
  'refreshtoken',
  'idtoken',
  'sessiontoken',
  'cookies',
  'authorization',
  'privatekey',
  'serviceaccount',
  'credential',
  'credentials',
  'secret',
  'phone',
  'phonenumber',
  'telefone',
  'whatsapp',
  'rawmessage',
  'raw_message',
  'rawbankfile',
  'raw_bank_file',
  'rawxlsxfile',
  'raw_xlsx_file',
  'rawfile',
  'raw_file',
  'filebytes',
  'file_bytes'
]);

function ownerFrom(context = {}) {
  return context.ownerUid || context.actorUid || context.uid || '';
}

function nowIso(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value?.toDate === 'function') return value.toDate().toISOString();
  if (typeof value?.seconds === 'number') return new Date(value.seconds * 1000).toISOString();
  return String(value);
}

function keyToken(key = '') {
  return String(key || '').replace(/[^a-zA-Z0-9_]/g, '').toLowerCase();
}

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function issue(field, code, message) {
  return { field, code, message };
}

export function sanitizeBackupRecord(record = {}, policy = {}) {
  const warnings = [];
  const maxDepth = Number(policy.maxDepth || 8);
  const maxArray = Number(policy.maxArray || 2000);
  const seen = new WeakSet();

  function visit(value, path = '', depth = 0) {
    if (depth > maxDepth) {
      warnings.push(`BACKUP_DEPTH_TRUNCATED:${path || '$'}`);
      return '[truncated-depth]';
    }
    if (value === undefined || typeof value === 'function') return undefined;
    if (value === null || typeof value !== 'object') return value;
    if (seen.has(value)) {
      warnings.push(`BACKUP_CIRCULAR_REMOVED:${path || '$'}`);
      return '[circular]';
    }
    seen.add(value);
    if (Array.isArray(value)) {
      if (value.length > maxArray) warnings.push(`BACKUP_ARRAY_TRUNCATED:${path || '$'}`);
      return value.slice(0, maxArray).map((item, index) => visit(item, `${path}[${index}]`, depth + 1)).filter((item) => item !== undefined);
    }
    return Object.keys(value).sort().reduce((acc, key) => {
      if (SENSITIVE_KEYS.includes(keyToken(key))) {
        warnings.push('BACKUP_FIELD_REMOVED:SENSITIVE_FIELD');
        return acc;
      }
      const sanitized = visit(value[key], path ? `${path}.${key}` : key, depth + 1);
      if (sanitized !== undefined) acc[key] = sanitized;
      return acc;
    }, {});
  }

  return { value: visit(record), warnings: [...new Set(warnings)] };
}

function sanitizeLocalSettingRecord(setting = {}) {
  const sanitized = sanitizeBackupRecord(setting);
  const localSetting = sanitized.value || {};
  if (typeof localSetting.value !== 'string') return sanitized;

  const trimmed = localSetting.value.trim();
  if (!trimmed || !/^[{[]/.test(trimmed)) return sanitized;

  try {
    const nested = sanitizeBackupRecord(JSON.parse(trimmed));
    localSetting.value = JSON.stringify(nested.value);
    return {
      value: localSetting,
      warnings: [...new Set([...sanitized.warnings, ...nested.warnings])]
    };
  } catch {
    return sanitized;
  }
}

export function normalizeRecordForBackup(record = {}) {
  const prepared = sanitizeBackupRecord(record).value || {};
  return Object.keys(prepared).sort().reduce((acc, key) => {
    const value = prepared[key];
    if (value === undefined || typeof value === 'function') return acc;
    if (['_delegate', 'firestore', 'converter', 'metadata'].includes(key) && value && typeof value === 'object' && !Array.isArray(value)) return acc;
    if (key.endsWith('_at') || ['created_at', 'updated_at', 'paid_at', 'occurred_at', 'received_at', 'processed_at'].includes(key)) {
      acc[key] = nowIso(value);
      return acc;
    }
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      acc[key] = normalizeRecordForBackup(value);
      return acc;
    }
    if (Array.isArray(value)) {
      acc[key] = value.map((item) => (item && typeof item === 'object' ? normalizeRecordForBackup(item) : item));
      return acc;
    }
    acc[key] = value;
    return acc;
  }, {});
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.keys(value).sort().reduce((acc, key) => {
      if (['checksum', 'filename', 'file_name', 'original_filename'].includes(key)) return acc;
      const item = stable(value[key]);
      if (item !== undefined) acc[key] = item;
      return acc;
    }, {});
  }
  return value;
}

export function buildBackupCanonicalPayload(snapshot = {}) {
  return JSON.stringify(stable(snapshot));
}

export function buildBackupChecksum(snapshot = {}) {
  return buildOperationFingerprint({
    commandName: 'FinanceBackupSnapshot',
    sourceChannel: snapshot.source_channel || 'web',
    idempotencyKey: 'backup-checksum',
    payload: buildBackupCanonicalPayload({ ...snapshot, checksum: undefined })
  });
}

function emptyCollections() {
  return Object.fromEntries(BACKUP_COLLECTIONS.map((name) => [name, []]));
}

function classifyFinanceRecord(record = {}) {
  if (record.type === 'percentage_rule') return 'percentage_rules';
  if (record.type === 'salario_historico') return 'salary_history';
  if (record.type === 'controle_horas') return 'hour_entries';
  if (['pessoa', 'macro', 'categoria'].includes(record.type) && record.shared_scope !== 'global') return 'personal_references';
  return 'finance_records';
}

function sortRecords(records = []) {
  return records.map(normalizeRecordForBackup).sort((a, b) =>
    String(a.type || '').localeCompare(String(b.type || '')) ||
    String(a.id || '').localeCompare(String(b.id || '')) ||
    buildBackupCanonicalPayload(a).localeCompare(buildBackupCanonicalPayload(b))
  );
}

function recordCounts(collections = {}) {
  return Object.fromEntries([...BACKUP_COLLECTIONS, ...OPERATIONAL_COLLECTIONS].map((name) => [name, (collections[name] || []).length]));
}

async function auditSummary(repositories = {}, action = '', context = {}, after = {}) {
  if (!repositories.audit?.append) return null;
  return appendAuditEvent(repositories.audit, buildAuditEvent({
    action,
    context,
    entityType: 'finance_backup',
    entityId: after.backup_id || after.restore_id || '',
    after
  }), context);
}

async function listFinanceRecords(repositories = {}, context = {}) {
  const result = await repositories.financeRecords?.list?.({}, context);
  return result?.ok ? result.items || [] : [];
}

async function listLocalSettings(repositories = {}, context = {}) {
  const result = await repositories.localSettings?.list?.('', context);
  return result?.ok ? result.items || [] : [];
}

export async function CreateFinanceBackupSnapshot({ context = {}, envelope = {}, repositories = {}, now = () => new Date().toISOString(), appVersion = '' } = {}) {
  const useCaseContext = createUseCaseContext({ context, envelope, now });
  if (!useCaseContext.sourceChannel) useCaseContext.sourceChannel = 'web';
  if (!useCaseContext.correlationId) useCaseContext.correlationId = `backup-${now()}`;
  const invalid = validateFinancialUseCaseContext(useCaseContext);
  if (invalid) return invalid;

  const ownerUid = ownerFrom(useCaseContext);
  const collections = emptyCollections();
  const warnings = [];
  const records = await listFinanceRecords(repositories, useCaseContext);
  records.filter((record) => !record.owner_uid || record.owner_uid === ownerUid).forEach((record) => {
    const sanitized = sanitizeBackupRecord(record);
    warnings.push(...sanitized.warnings);
    collections[classifyFinanceRecord(sanitized.value)].push(sanitized.value);
  });
  collections.local_settings = (await listLocalSettings(repositories, useCaseContext)).map((setting) => {
    const sanitized = sanitizeLocalSettingRecord(setting);
    warnings.push(...sanitized.warnings);
    return sanitized.value;
  });
  BACKUP_COLLECTIONS.forEach((name) => { collections[name] = sortRecords(collections[name]); });

  const backup = {
    backup_id: `backup_${buildOperationFingerprint({ commandName: 'backup-id', sourceChannel: useCaseContext.sourceChannel, idempotencyKey: useCaseContext.correlationId, payload: `${ownerUid}:${now()}` }).slice(-12)}`,
    backup_version: FINANCE_BACKUP_VERSION,
    schema_version: FINANCE_BACKUP_SCHEMA_VERSION,
    created_at: now(),
    owner_reference: buildOperationFingerprint({ commandName: 'owner-reference', sourceChannel: 'system', idempotencyKey: ownerUid, payload: ownerUid }),
    source_channel: useCaseContext.sourceChannel,
    correlation_id: useCaseContext.correlationId,
    app_version: appVersion,
    record_counts: recordCounts(collections),
    checksum: '',
    collections,
    operational: Object.fromEntries(OPERATIONAL_COLLECTIONS.map((name) => [name, []])),
    warnings: [...new Set(warnings)],
    metadata: {
      exported_by_type: useCaseContext.actorType,
      format: 'FinanceBackupSnapshot',
      confidentiality: 'local_sensitive_file'
    }
  };
  backup.checksum = buildBackupChecksum(backup);
  await auditSummary(repositories, 'BACKUP_CREATED', useCaseContext, {
    backup_id: backup.backup_id,
    checksum: backup.checksum.slice(0, 24),
    record_count_total: Object.values(backup.record_counts).reduce((total, count) => total + Number(count || 0), 0),
    correlation_id: backup.correlation_id
  });
  return createSuccessResult({ data: backup, entityId: backup.backup_id, correlationId: useCaseContext.correlationId, warnings: backup.warnings });
}

function findForbidden(value, path = '') {
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value).flatMap(([key, item]) => {
    const current = path ? `${path}.${key}` : key;
    const own = SENSITIVE_KEYS.includes(keyToken(key)) ? [issue(current, 'FORBIDDEN_FIELD', 'Campo proibido no backup.')] : [];
    return own.concat(findForbidden(item, current));
  });
}

function idsIn(collections = {}) {
  return BACKUP_COLLECTIONS.flatMap((name) => (collections[name] || []).map((record) => ({ collection: name, id: record.id || '', record })));
}

function duplicateIdErrors(collections = {}) {
  const seen = new Set();
  return idsIn(collections).flatMap(({ collection, id }) => {
    if (!id) return [];
    const key = `${collection}:${id}`;
    if (seen.has(key)) return [issue(collection, 'DUPLICATE_ID', `ID duplicado: ${id}`)];
    seen.add(key);
    return [];
  });
}

function validateReferences(collections = {}) {
  const allIds = new Set(idsIn(collections).map((item) => item.id).filter(Boolean));
  const errors = [];
  const installmentSeries = new Map();
  (collections.finance_records || []).forEach((record) => {
    const isInstallment = record.is_installment === true || Number(record.installment_no || 0) > 0 || Number(record.total_installments || 0) > 1;
    if (isInstallment && record.parent_id) {
      if (!installmentSeries.has(record.parent_id)) installmentSeries.set(record.parent_id, []);
      installmentSeries.get(record.parent_id).push(record);
    }
    if (record.percentage_rule_id && !allIds.has(record.percentage_rule_id)) errors.push(issue('percentage_rule_id', 'ORPHAN_REFERENCE', `Regra percentual ausente: ${record.percentage_rule_id}`));
    if (Number(record.installment_no || 0) > Number(record.total_installments || 0) && Number(record.total_installments || 0) > 0) {
      errors.push(issue('installment_no', 'INSTALLMENT_INCONSISTENT', 'Parcela maior que total de parcelas.'));
    }
    if (Number(record.recurrence_sequence_no || 0) > Number(record.recurrence_total_occurrences || 0) && Number(record.recurrence_total_occurrences || 0) > 0) {
      errors.push(issue('recurrence_sequence_no', 'RECURRENCE_INCONSISTENT', 'Ocorrencia maior que total de recorrencias.'));
    }
  });
  installmentSeries.forEach((records, parentId) => {
    const totals = [...new Set(records.map((record) => Number(record.total_installments || 0)))];
    const numbers = records.map((record) => Number(record.installment_no || 0));
    const expectedTotal = totals.length === 1 ? totals[0] : 0;
    const expectedNumbers = Array.from({ length: expectedTotal }, (_, index) => index + 1);
    const uniqueNumbers = [...new Set(numbers)].sort((a, b) => a - b);
    const owners = [...new Set(records.map((record) => record.owner_uid || '').filter(Boolean))];
    if (!expectedTotal || records.length !== expectedTotal || uniqueNumbers.length !== records.length ||
      expectedNumbers.some((number, index) => uniqueNumbers[index] !== number)) {
      errors.push(issue('parent_id', 'INSTALLMENT_SERIES_INCOMPLETE', `Serie parcelada incompleta ou inconsistente: ${parentId}`));
    }
    if (totals.length !== 1) errors.push(issue('total_installments', 'INSTALLMENT_TOTAL_INCONSISTENT', `Total divergente na serie: ${parentId}`));
    if (owners.length > 1) errors.push(issue('owner_uid', 'INSTALLMENT_OWNER_INCONSISTENT', `Owner divergente na serie: ${parentId}`));
  });
  return errors;
}

export function migrateBackupSnapshot(snapshot = {}) {
  const copy = clone(snapshot);
  if (copy?.backup_version === FINANCE_BACKUP_VERSION && Number(copy.schema_version) === FINANCE_BACKUP_SCHEMA_VERSION) {
    return { snapshot: copy, migrated: false, errors: [] };
  }
  if (copy?.backup_version === LEGACY_BACKUP_VERSION && Number(copy.schema_version) === 0) {
    const migrated = {
      backup_id: copy.backup_id || 'legacy-backup',
      backup_version: FINANCE_BACKUP_VERSION,
      schema_version: FINANCE_BACKUP_SCHEMA_VERSION,
      created_at: copy.created_at || '',
      owner_reference: copy.owner_reference || '',
      source_channel: copy.source_channel || 'web',
      correlation_id: copy.correlation_id || 'legacy-correlation',
      app_version: copy.app_version || '',
      collections: {
        ...emptyCollections(),
        finance_records: sortRecords(copy.records || copy.collections?.finance_records || [])
      },
      operational: Object.fromEntries(OPERATIONAL_COLLECTIONS.map((name) => [name, []])),
      warnings: ['BACKUP_LEGACY_MIGRATED_IN_MEMORY'],
      metadata: { ...(copy.metadata || {}), migrated_from: LEGACY_BACKUP_VERSION }
    };
    migrated.record_counts = recordCounts(migrated.collections);
    migrated.checksum = buildBackupChecksum(migrated);
    return { snapshot: migrated, migrated: true, errors: [] };
  }
  return { snapshot: copy, migrated: false, errors: [issue('backup_version', 'BACKUP_VERSION_UNSUPPORTED', 'Versao de backup nao suportada.')] };
}

export function ValidateFinanceBackupSnapshot({ snapshot = {}, expectedOwnerReference = '' } = {}) {
  const original = clone(snapshot);
  const migration = migrateBackupSnapshot(snapshot);
  const target = migration.snapshot || {};
  const errors = [...migration.errors];
  const warnings = [...(target.warnings || [])];

  if (!target || typeof target !== 'object') errors.push(issue('$', 'SNAPSHOT_ROOT_INVALID', 'Snapshot deve ser objeto.'));
  if (target.backup_version !== FINANCE_BACKUP_VERSION) errors.push(issue('backup_version', 'BACKUP_VERSION_INVALID', 'Versao de backup invalida.'));
  if (Number(target.schema_version) !== FINANCE_BACKUP_SCHEMA_VERSION) errors.push(issue('schema_version', 'SCHEMA_VERSION_INVALID', 'Schema de backup invalido.'));
  if (!target.collections || typeof target.collections !== 'object') errors.push(issue('collections', 'COLLECTIONS_REQUIRED', 'Collections obrigatorio.'));
  BACKUP_COLLECTIONS.forEach((name) => {
    if (!Array.isArray(target.collections?.[name])) errors.push(issue(`collections.${name}`, 'COLLECTION_INVALID', 'Colecao deve ser lista.'));
  });
  if (expectedOwnerReference && target.owner_reference !== expectedOwnerReference) errors.push(issue('owner_reference', 'OWNER_REFERENCE_MISMATCH', 'Owner reference divergente.'));
  errors.push(...findForbidden(target));
  errors.push(...duplicateIdErrors(target.collections || {}));
  const knownTypes = new Set(['saida', 'entrada', 'pessoa', 'categoria', 'macro', 'controle_horas', 'salario_historico', 'percentage_rule']);
  idsIn(target.collections || {}).forEach(({ collection, record }) => {
    if (record.type && !knownTypes.has(record.type)) errors.push(issue(collection, 'UNKNOWN_RECORD_TYPE', `Tipo desconhecido: ${record.type}`));
  });
  errors.push(...validateReferences(target.collections || {}));
  const expected = buildBackupChecksum(target);
  const checksumValid = Boolean(target.checksum) && target.checksum === expected;
  if (!checksumValid) errors.push(issue('checksum', 'CHECKSUM_INVALID', 'Checksum invalido.'));
  const counts = recordCounts(target.collections || {});
  Object.entries(counts).forEach(([name, count]) => {
    if (Number(target.record_counts?.[name] || 0) !== count) warnings.push(`BACKUP_COUNT_MISMATCH:${name}`);
  });

  return {
    isValid: errors.length === 0,
    compatible: errors.every((error) => !['BACKUP_VERSION_UNSUPPORTED', 'BACKUP_VERSION_INVALID', 'SCHEMA_VERSION_INVALID'].includes(error.code)),
    errors,
    warnings: [...new Set(warnings)],
    counts,
    checksumValid,
    detectedVersion: target.backup_version || '',
    snapshot: target,
    migrated: migration.migrated,
    originalUnchanged: JSON.stringify(original) === JSON.stringify(snapshot)
  };
}

function comparable(record = {}) {
  const copy = normalizeRecordForBackup(record);
  delete copy.created_at;
  delete copy.updated_at;
  delete copy.processed_at;
  delete copy.received_at;
  return copy;
}

function flattenBackupRecords(collections = {}) {
  return BACKUP_COLLECTIONS.flatMap((collection) => (collections[collection] || []).map((record) => ({ collection, record: normalizeRecordForBackup(record) })));
}

export async function PrepareFinanceRestore({ snapshot = {}, context = {}, envelope = {}, repositories = {}, now = () => new Date().toISOString() } = {}) {
  const useCaseContext = createUseCaseContext({ context, envelope, now });
  if (!useCaseContext.sourceChannel) useCaseContext.sourceChannel = 'web';
  if (!useCaseContext.correlationId) useCaseContext.correlationId = `restore-${now()}`;
  const invalid = validateFinancialUseCaseContext(useCaseContext);
  if (invalid) return invalid;
  const validation = ValidateFinanceBackupSnapshot({ snapshot });
  if (!validation.isValid) {
    return createErrorResult({ code: APPLICATION_RESULT_CODES.VALIDATION_ERROR, message: 'Snapshot invalido.', validationErrors: validation.errors, data: { validation } });
  }
  const ownerUid = ownerFrom(useCaseContext);
  const current = await listFinanceRecords(repositories, useCaseContext);
  const currentById = new Map(current.map((record) => [record.id, normalizeRecordForBackup(record)]));
  const items = [];
  flattenBackupRecords(validation.snapshot.collections).forEach(({ collection, record }) => {
    if (OPERATIONAL_COLLECTIONS.includes(collection) || collection === 'local_settings') {
      items.push({ collection, id: record.id || '', status: RESTORE_STATUS.SKIPPED_OPERATIONAL, record });
      return;
    }
    if (record.owner_uid && record.owner_uid !== ownerUid) record.owner_uid = ownerUid;
    const existing = currentById.get(record.id);
    if (!record.id || !record.type) {
      items.push({ collection, id: record.id || '', status: RESTORE_STATUS.INCOMPATIBLE, record });
    } else if (!existing) {
      items.push({ collection, id: record.id, status: RESTORE_STATUS.NEW, record });
    } else if (JSON.stringify(comparable(existing)) === JSON.stringify(comparable({ ...record, owner_uid: existing.owner_uid || ownerUid }))) {
      items.push({ collection, id: record.id, status: RESTORE_STATUS.IDENTICAL, record });
    } else if (existing.status === 'Pago' || existing.percentage_materialization_manual_edit === true) {
      items.push({ collection, id: record.id, status: RESTORE_STATUS.CONFLICT, record, existing });
    } else {
      items.push({ collection, id: record.id, status: RESTORE_STATUS.CONFLICT, record, existing });
    }
  });
  const plan = {
    restore_id: `restore_${buildOperationFingerprint({ commandName: 'restore-id', sourceChannel: useCaseContext.sourceChannel, idempotencyKey: useCaseContext.correlationId, payload: validation.snapshot.checksum }).slice(-12)}`,
    snapshot_checksum: validation.snapshot.checksum,
    backup_id: validation.snapshot.backup_id,
    owner_uid: ownerUid,
    correlation_id: useCaseContext.correlationId,
    source_channel: useCaseContext.sourceChannel,
    prepared_at: now(),
    items,
    summary: Object.values(RESTORE_STATUS).reduce((acc, status) => ({ ...acc, [status]: items.filter((item) => item.status === status).length }), {})
  };
  await auditSummary(repositories, 'RESTORE_PREPARED', useCaseContext, {
    restore_id: plan.restore_id,
    backup_id: plan.backup_id,
    checksum: plan.snapshot_checksum.slice(0, 24),
    counts: plan.summary,
    correlation_id: plan.correlation_id
  });
  return createSuccessResult({ data: plan, entityId: plan.restore_id, correlationId: plan.correlation_id });
}

async function reserveRestore(repositories = {}, plan = {}, context = {}) {
  if (!repositories.idempotency?.reserve) return repositoryOk({ id: '', data: { reservation_status: 'reserved' } });
  const requestFingerprint = buildOperationFingerprint({ commandName: 'CommitFinanceRestore', sourceChannel: plan.source_channel || 'web', idempotencyKey: plan.restore_id, payload: plan });
  return repositories.idempotency.reserve({
    ownerUid: ownerFrom(context),
    commandName: 'CommitFinanceRestore',
    sourceChannel: plan.source_channel || 'web',
    idempotencyKey: context.idempotencyKey || plan.restore_id,
    requestFingerprint,
    correlationId: plan.correlation_id
  }, context);
}

export async function CommitFinanceRestore({ restorePlan = {}, context = {}, repositories = {}, now = () => new Date().toISOString() } = {}) {
  const useCaseContext = createUseCaseContext({ context, now });
  useCaseContext.sourceChannel ||= restorePlan.source_channel || 'web';
  useCaseContext.correlationId ||= restorePlan.correlation_id || `restore-commit-${now()}`;
  useCaseContext.idempotencyKey ||= restorePlan.restore_id || useCaseContext.correlationId;
  const invalid = validateFinancialUseCaseContext(useCaseContext);
  if (invalid) return invalid;
  if (!restorePlan?.items) return createErrorResult({ code: APPLICATION_RESULT_CODES.VALIDATION_ERROR, message: 'restorePlan obrigatorio.' });

  const reservation = await reserveRestore(repositories, restorePlan, useCaseContext);
  if (!reservation.ok && reservation.code === REPOSITORY_ERROR_CODES.CONFLICT) {
    return createErrorResult({ code: APPLICATION_RESULT_CODES.CONFLICT, message: reservation.message, data: { reservation } });
  }
  if (reservation.data?.reservation_status === 'replay') {
    return createSuccessResult({ code: APPLICATION_RESULT_CODES.IDEMPOTENT_REPLAY, idempotentReplay: true, data: reservation.data?.result_reference || { wrote: false }, correlationId: useCaseContext.correlationId });
  }

  const preRestore = await CreateFinanceBackupSnapshot({ context: useCaseContext, repositories, now });
  const newRecords = restorePlan.items.filter((item) => item.status === RESTORE_STATUS.NEW && item.collection !== 'local_settings').map((item) => ({
    ...item.record,
    owner_uid: ownerFrom(useCaseContext),
    correlation_id: useCaseContext.correlationId
  }));
  if (restorePlan.items.some((item) => item.status === RESTORE_STATUS.CONFLICT || item.status === RESTORE_STATUS.INCOMPATIBLE || item.status === RESTORE_STATUS.ORPHANED)) {
    await auditSummary(repositories, 'RESTORE_FAILED', useCaseContext, {
      restore_id: restorePlan.restore_id,
      checksum: String(restorePlan.snapshot_checksum || '').slice(0, 24),
      counts: restorePlan.summary,
      correlation_id: useCaseContext.correlationId
    });
    return createErrorResult({ code: APPLICATION_RESULT_CODES.CONFLICT, message: 'Restore contem conflitos ou incompatibilidades.', data: { pre_restore_snapshot: preRestore.data, restorePlan } });
  }
  let created = repositoryOk({ ids: [], count: 0, items: [] });
  if (newRecords.length) {
    created = await repositories.financeRecords.createMany(newRecords, useCaseContext);
    if (!created.ok) {
      await repositories.idempotency?.fail?.(reservation.id, { code: created.code, correlationId: useCaseContext.correlationId }, useCaseContext);
      await auditSummary(repositories, 'RESTORE_FAILED', useCaseContext, { restore_id: restorePlan.restore_id, correlation_id: useCaseContext.correlationId });
      return createErrorResult({ code: APPLICATION_RESULT_CODES.PERSISTENCE_ERROR, message: created.message, data: { pre_restore_snapshot: preRestore.data } });
    }
  }
  await repositories.idempotency?.complete?.(reservation.id, { success: true, code: 'RESTORE_COMMITTED', entityIds: created.ids || [], correlationId: useCaseContext.correlationId }, useCaseContext);
  await auditSummary(repositories, 'RESTORE_COMMITTED', useCaseContext, {
    restore_id: restorePlan.restore_id,
    checksum: String(restorePlan.snapshot_checksum || '').slice(0, 24),
    counts: { created: created.count || 0, skipped: restorePlan.summary?.identical || 0 },
    correlation_id: useCaseContext.correlationId
  });
  return createSuccessResult({
    data: { created: created.count || 0, ids: created.ids || [], pre_restore_snapshot: preRestore.data, wrote: (created.count || 0) > 0 },
    entityIds: created.ids || [],
    correlationId: useCaseContext.correlationId
  });
}

export async function PrepareFinanceRollback({ preRestoreSnapshot = {}, restoredCorrelationId = '', context = {}, repositories = {}, now = () => new Date().toISOString() } = {}) {
  const prepared = await PrepareFinanceRestore({ snapshot: preRestoreSnapshot, context, repositories, now });
  if (prepared.success) {
    const current = await listFinanceRecords(repositories, context);
    const snapshotIds = new Set(flattenBackupRecords(preRestoreSnapshot.collections || {}).map((item) => item.record.id).filter(Boolean));
    prepared.data.rollback_delete_ids = current
      .filter((record) => record.id && !snapshotIds.has(record.id) && restoredCorrelationId && record.correlation_id === restoredCorrelationId)
      .map((record) => record.id)
      .sort();
    prepared.data.restored_correlation_id = restoredCorrelationId;
    await auditSummary(repositories, 'RESTORE_ROLLBACK_PREPARED', { ...context, correlationId: prepared.data.correlation_id }, {
      restore_id: prepared.data.restore_id,
      backup_id: preRestoreSnapshot.backup_id,
      checksum: String(preRestoreSnapshot.checksum || '').slice(0, 24),
      counts: prepared.data.summary,
      correlation_id: prepared.data.correlation_id
    });
  }
  return prepared;
}

export async function CommitFinanceRollback({ rollbackPlan = {}, context = {}, repositories = {}, now = () => new Date().toISOString() } = {}) {
  const useCaseContext = createUseCaseContext({ context, now });
  useCaseContext.sourceChannel ||= rollbackPlan.source_channel || 'web';
  useCaseContext.correlationId ||= rollbackPlan.correlation_id || `rollback-${now()}`;
  const invalid = validateFinancialUseCaseContext(useCaseContext);
  if (invalid) return invalid;
  const deleted = [];
  for (const id of rollbackPlan.rollback_delete_ids || []) {
    const result = await repositories.financeRecords?.delete?.(id, useCaseContext);
    if (result?.ok) deleted.push(id);
  }
  const result = await CommitFinanceRestore({ restorePlan: rollbackPlan, context, repositories, now });
  if (result.success) {
    await auditSummary(repositories, 'RESTORE_ROLLBACK_COMMITTED', { ...context, correlationId: result.correlationId }, {
      restore_id: rollbackPlan.restore_id,
      checksum: String(rollbackPlan.snapshot_checksum || '').slice(0, 24),
      counts: rollbackPlan.summary,
      correlation_id: result.correlationId
    });
    result.data = { ...(result.data || {}), rollback_deleted_ids: deleted };
  }
  return result;
}

export function createBackupDryRunFixtures() {
  const context = { actorUid: 'dry-user', ownerUid: 'dry-user', accountStatus: 'active', sourceChannel: 'web', correlationId: 'backup-dry-run' };
  const baseRecord = { id: 'expense-1', type: 'saida', owner_uid: 'dry-user', amount: 100, status: 'Em aberto', competence: '2026-08', schema_version: 1 };
  const snapshot = {
    backup_id: 'backup-dry',
    backup_version: FINANCE_BACKUP_VERSION,
    schema_version: FINANCE_BACKUP_SCHEMA_VERSION,
    created_at: '2026-08-23T12:00:00.000Z',
    owner_reference: buildOperationFingerprint({ commandName: 'owner-reference', sourceChannel: 'system', idempotencyKey: 'dry-user', payload: 'dry-user' }),
    source_channel: 'web',
    correlation_id: 'backup-dry-run',
    app_version: '',
    record_counts: {},
    checksum: '',
    collections: { ...emptyCollections(), finance_records: [baseRecord] },
    operational: { audit_logs: [{ id: 'audit-1' }], idempotency_receipts: [], import_batches: [] },
    warnings: [],
    metadata: { fixture: true }
  };
  snapshot.record_counts = recordCounts(snapshot.collections);
  snapshot.checksum = buildBackupChecksum(snapshot);
  return {
    context,
    validSnapshot: snapshot,
    invalidChecksum: { ...snapshot, checksum: 'bad' },
    forbiddenField: { ...snapshot, collections: { ...snapshot.collections, finance_records: [{ ...baseRecord, password: 'secret' }] } },
    duplicateId: { ...snapshot, collections: { ...snapshot.collections, finance_records: [baseRecord, { ...baseRecord }] } },
    futureVersion: { ...snapshot, backup_version: '99.0.0' },
    legacy: { backup_id: 'legacy', backup_version: LEGACY_BACKUP_VERSION, schema_version: 0, records: [baseRecord], created_at: snapshot.created_at, source_channel: 'web' },
    targetRecords: {
      identical: [baseRecord],
      conflict: [{ ...baseRecord, amount: 999 }],
      empty: []
    }
  };
}
