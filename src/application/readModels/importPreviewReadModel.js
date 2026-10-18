import { roundCurrency } from '../../core/money.js';
import { IMPORT_CANDIDATE_STATUS } from '../imports/importBatchUseCases.js';

const STATUS_BUCKETS = Object.freeze({
  [IMPORT_CANDIDATE_STATUS.READY]: 'ready',
  [IMPORT_CANDIDATE_STATUS.INVALID]: 'invalid',
  [IMPORT_CANDIDATE_STATUS.DUPLICATE_IN_FILE]: 'duplicates',
  [IMPORT_CANDIDATE_STATUS.ALREADY_IMPORTED]: 'duplicates',
  [IMPORT_CANDIDATE_STATUS.LEGACY_MATCH]: 'duplicates',
  [IMPORT_CANDIDATE_STATUS.CONFLICT]: 'conflicts'
});

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function text(value = '') {
  return String(value ?? '').trim();
}

function reasonFor(candidate = {}) {
  const validation = Array.isArray(candidate.validation_errors) ? candidate.validation_errors : [];
  if (candidate.conflict_reason) return candidate.conflict_reason;
  if (validation.length) {
    return validation.map((error) => error.message || error.code || error.field || 'Linha invalida.').join('; ');
  }
  if (candidate.status === IMPORT_CANDIDATE_STATUS.DUPLICATE_IN_FILE) return 'Duplicidade no arquivo.';
  if (candidate.status === IMPORT_CANDIDATE_STATUS.ALREADY_IMPORTED) return 'Registro ja importado.';
  if (candidate.status === IMPORT_CANDIDATE_STATUS.LEGACY_MATCH) return 'Assinatura legada ja existe.';
  return '';
}

function rowView(candidate = {}) {
  const payload = candidate.normalized_payload || {};
  return {
    id: text(candidate.candidate_id || candidate.row_index),
    rowIndex: Number(candidate.row_index || 0),
    sourceRowReference: text(candidate.source_row_reference || candidate.row_index),
    status: text(candidate.status),
    type: text(payload.type),
    person: text(payload.person),
    description: text(payload.description || payload.subcategory || payload.earning_type),
    competence: text(payload.competence),
    date: text(payload.occurred_date || payload.due_date),
    amount: roundCurrency(Number(payload.amount || 0)),
    sourceReferenceId: text(candidate.source_reference_id),
    existingEntityId: text(candidate.existing_entity_id),
    reason: reasonFor(candidate),
    validationErrors: clone(candidate.validation_errors || []),
    warnings: clone(candidate.warnings || [])
  };
}

function bucketCandidates(candidates = []) {
  return candidates.reduce((groups, candidate) => {
    const bucket = STATUS_BUCKETS[candidate.status] || 'ignored';
    groups[bucket].push(rowView(candidate));
    return groups;
  }, {
    ready: [],
    invalid: [],
    duplicates: [],
    conflicts: [],
    ignored: []
  });
}

export function buildImportPreviewReadModel(input = {}) {
  const preparedBatch = input.preparedBatch || input.prepared || {};
  const batch = preparedBatch.batch || preparedBatch.data?.batch || {};
  const candidates = clone(preparedBatch.candidates || preparedBatch.data?.candidates || []);
  const parsedWarnings = clone(input.parsed?.warnings || []);
  const pipelineWarnings = clone(preparedBatch.warnings || preparedBatch.data?.warnings || []);
  const groups = bucketCandidates(candidates);
  const summary = {
    totalRows: Number(preparedBatch.summary?.totalRows ?? preparedBatch.data?.summary?.totalRows ?? candidates.length),
    readyRows: groups.ready.length,
    invalidRows: groups.invalid.length,
    duplicateRows: groups.duplicates.length,
    conflictRows: groups.conflicts.length,
    ignoredRows: groups.ignored.length + Number(input.parsed?.ignoredRows?.length || 0),
    skippedRows: groups.invalid.length + groups.duplicates.length + groups.conflicts.length + groups.ignored.length + Number(input.parsed?.ignoredRows?.length || 0),
    readyAmountTotal: roundCurrency(groups.ready.reduce((total, row) => total + Number(row.amount || 0), 0))
  };

  return {
    summary,
    ready: groups.ready,
    invalid: groups.invalid,
    duplicates: groups.duplicates,
    conflicts: groups.conflicts,
    ignored: [
      ...groups.ignored,
      ...(input.parsed?.ignoredRows || []).map((row) => ({
        id: `ignored_${row.row_index || row.rowIndex || ''}`,
        rowIndex: Number(row.row_index || row.rowIndex || 0),
        sourceRowReference: text(row.row_index || row.rowIndex),
        status: 'ignored',
        type: '',
        person: '',
        description: '',
        competence: '',
        date: '',
        amount: 0,
        sourceReferenceId: '',
        existingEntityId: '',
        reason: text(row.reason || 'Linha ignorada.'),
        validationErrors: [],
        warnings: []
      }))
    ],
    warnings: [...pipelineWarnings, ...parsedWarnings],
    metadata: {
      source: input.source || batch.source_channel || '',
      importType: batch.import_type || '',
      batchId: batch.batch_id || '',
      idempotencyKey: batch.idempotency_key || '',
      correlationId: batch.correlation_id || '',
      fileName: input.fileMetadata?.name || batch.original_filename || '',
      fileSize: Number(input.fileMetadata?.size || 0),
      sheetName: input.parsed?.sheetName || '',
      status: batch.status || '',
      filters: clone(input.filters || {}),
      options: clone(input.options || {})
    }
  };
}
