import { RESTORE_STATUS } from '../backup/financeBackupUseCases.js';

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function groupItems(items = [], status = '') {
  return items
    .filter((item) => item.status === status)
    .map((item) => ({
      id: item.id || item.record?.id || '',
      collection: item.collection || '',
      type: item.record?.type || '',
      status: item.status || '',
      description: item.record?.description || item.record?.person || item.record?.category_name || item.record?.macro_category || '',
      amount: Number(item.record?.amount || 0),
      reason: item.reason || item.conflict_reason || ''
    }));
}

export function buildRestorePreviewReadModel({
  backupEnvelope = null,
  restoreDryRunResult = null,
  conflictPolicy = {},
  options = {}
} = {}) {
  const backup = backupEnvelope?.data || backupEnvelope || {};
  const plan = restoreDryRunResult?.data || restoreDryRunResult || {};
  const items = Array.isArray(plan.items) ? plan.items : [];
  const validation = restoreDryRunResult?.data?.validation || restoreDryRunResult?.validation || null;
  const summary = {
    total: items.length,
    wouldCreate: groupItems(items, RESTORE_STATUS.NEW).length,
    wouldUpdate: 0,
    wouldIgnore: groupItems(items, RESTORE_STATUS.IDENTICAL).length,
    conflicts: groupItems(items, RESTORE_STATUS.CONFLICT).length,
    invalid: groupItems(items, RESTORE_STATUS.INCOMPATIBLE).length + groupItems(items, RESTORE_STATUS.ORPHANED).length,
    skipped: groupItems(items, RESTORE_STATUS.SKIPPED_OPERATIONAL).length,
    wrote: false
  };
  const warnings = [
    ...(backup.warnings || []),
    ...(restoreDryRunResult?.warnings || []),
    ...(validation?.warnings || [])
  ];
  if (options.expectedOwnerReference && backup.owner_reference && backup.owner_reference !== options.expectedOwnerReference) {
    warnings.push('BACKUP_OWNER_REFERENCE_MISMATCH');
  }

  return {
    summary,
    valid: restoreDryRunResult?.success === true && summary.invalid === 0,
    invalid: [
      ...groupItems(items, RESTORE_STATUS.INCOMPATIBLE),
      ...groupItems(items, RESTORE_STATUS.ORPHANED)
    ],
    conflicts: groupItems(items, RESTORE_STATUS.CONFLICT),
    skipped: [
      ...groupItems(items, RESTORE_STATUS.SKIPPED_OPERATIONAL),
      ...groupItems(items, RESTORE_STATUS.IDENTICAL)
    ],
    wouldCreate: groupItems(items, RESTORE_STATUS.NEW),
    wouldUpdate: [],
    wouldIgnore: groupItems(items, RESTORE_STATUS.IDENTICAL),
    warnings: [...new Set(warnings)].sort(),
    metadata: {
      restoreId: plan.restore_id || '',
      backupId: plan.backup_id || backup.backup_id || '',
      checksum: plan.snapshot_checksum || backup.checksum || '',
      checksumPreview: String(plan.snapshot_checksum || backup.checksum || '').slice(0, 24),
      sourceChannel: plan.source_channel || backup.source_channel || '',
      ownerUid: plan.owner_uid || '',
      conflictPolicy: clone(conflictPolicy),
      restoreExecutionAvailable: false,
      wrote: false
    }
  };
}
