const SENSITIVE_TEXT = /password|token|authorization|cookie|private.?key|service.?account|credential|secret|telefone|phone|whatsapp|raw.?file|raw.?xlsx|raw.?bank/i;

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function collectionEntries(collections = {}) {
  return Object.entries(collections || {}).map(([name, records]) => [name, Array.isArray(records) ? records : []]);
}

function countRecords(collections = {}) {
  return Object.fromEntries(collectionEntries(collections).map(([name, records]) => [name, records.length]));
}

function typeCounts(collections = {}) {
  const counts = {};
  collectionEntries(collections).forEach(([, records]) => {
    records.forEach((record) => {
      const type = record?.type || 'sem_tipo';
      counts[type] = (counts[type] || 0) + 1;
    });
  });
  return Object.keys(counts).sort().reduce((acc, key) => ({ ...acc, [key]: counts[key] }), {});
}

function hasSensitiveKey(value, path = '') {
  if (!value || typeof value !== 'object') return false;
  return Object.entries(value).some(([key, item]) => {
    const nextPath = path ? `${path}.${key}` : key;
    return SENSITIVE_TEXT.test(nextPath) || hasSensitiveKey(item, nextPath);
  });
}

export function buildBackupPreviewReadModel({ backupEnvelope = null, validation = null, options = {} } = {}) {
  const backup = backupEnvelope?.data || backupEnvelope || {};
  const collections = backup.collections || {};
  const validationModel = validation ? {
    isValid: validation.isValid === true,
    compatible: validation.compatible !== false,
    checksumValid: validation.checksumValid === true,
    errors: clone(validation.errors || []),
    warnings: clone(validation.warnings || []),
    detectedVersion: validation.detectedVersion || backup.backup_version || '',
    migrated: validation.migrated === true
  } : {
    isValid: Boolean(backup.backup_id),
    compatible: true,
    checksumValid: Boolean(backup.checksum),
    errors: [],
    warnings: [],
    detectedVersion: backup.backup_version || '',
    migrated: false
  };
  const counts = countRecords(collections);
  const warnings = [...new Set([...(backup.warnings || []), ...(validationModel.warnings || [])])].sort();
  if (hasSensitiveKey(backup)) warnings.push('BACKUP_SENSITIVE_FIELD_PRESENT');

  return {
    version: backup.backup_version || validationModel.detectedVersion || '',
    createdAt: backup.created_at || '',
    owner: {
      reference: backup.owner_reference || '',
      matchesExpected: !options.expectedOwnerReference || backup.owner_reference === options.expectedOwnerReference
    },
    counts,
    totalRecords: Object.values(counts).reduce((total, count) => total + Number(count || 0), 0),
    recordTypes: typeCounts(collections),
    warnings: [...new Set(warnings)].sort(),
    validation: validationModel,
    metadata: {
      backupId: backup.backup_id || '',
      checksum: backup.checksum || '',
      checksumPreview: String(backup.checksum || '').slice(0, 24),
      sourceChannel: backup.source_channel || '',
      appVersion: backup.app_version || '',
      format: backup.metadata?.format || 'FinanceBackupSnapshot',
      confidentiality: backup.metadata?.confidentiality || 'local_sensitive_file'
    }
  };
}
