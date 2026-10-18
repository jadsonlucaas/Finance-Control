import { roundCurrency } from '../../core/money.js';
import { normalizeFinanceRecord, validateFinanceRecord } from '../../domain/records/index.js';
import { APPLICATION_RESULT_CODES, createErrorResult, createSuccessResult } from '../gateway/applicationResult.js';
import { buildOperationFingerprint, hashStableString, stableStringify } from '../gateway/idempotency.js';
import { normalizeOperationMetadata } from '../gateway/operationMetadata.js';
import { REPOSITORY_ERROR_CODES, repositoryOk } from '../repositories/repositoryResult.js';

export const IMPORT_TYPES = Object.freeze({
  BANK_STATEMENT: 'bank_statement',
  SPREADSHEET: 'spreadsheet'
});

export const IMPORT_SOURCE_CHANNEL = Object.freeze({
  [IMPORT_TYPES.BANK_STATEMENT]: 'bank_import',
  [IMPORT_TYPES.SPREADSHEET]: 'spreadsheet_import'
});

export const IMPORT_BATCH_STATUS = Object.freeze([
  'parsed',
  'validated',
  'ready',
  'processing',
  'completed',
  'completed_with_skips',
  'failed',
  'cancelled'
]);

export const IMPORT_CANDIDATE_STATUS = Object.freeze({
  VALID: 'valid',
  INVALID: 'invalid',
  DUPLICATE_IN_FILE: 'duplicate_in_file',
  ALREADY_IMPORTED: 'already_imported',
  LEGACY_MATCH: 'legacy_match',
  CONFLICT: 'conflict',
  READY: 'ready'
});

export const IMPORT_MAX_ATOMIC_ROWS = 100;

function text(value = '') {
  return String(value ?? '').trim();
}

function sanitizeFilename(value = '') {
  return text(value).replace(/[^\w.\- ()[\]]+/g, '_').slice(0, 160);
}

function normalizeComparableText(value = '') {
  return text(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function ownerFrom(context = {}) {
  return context.ownerUid || context.actorUid || context.uid || '';
}

function nowFrom(options = {}) {
  return options.now || (() => new Date().toISOString());
}

function sourceChannelFor(importType = '') {
  return IMPORT_SOURCE_CHANNEL[importType] || 'spreadsheet_import';
}

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function sanitizeImportPayload(payload = {}) {
  const {
    parser_errors,
    raw_row_index,
    source_row_reference,
    legacy_import_signature,
    legacy_import_core_signature,
    legacyImportSignature,
    legacyImportCoreSignature,
    ...financePayload
  } = payload || {};
  return financePayload;
}

export function buildFileFingerprint(fileBytesOrCanonicalContent = '', options = {}) {
  const canonicalContent = Array.isArray(fileBytesOrCanonicalContent) || typeof fileBytesOrCanonicalContent === 'object'
    ? stableStringify(fileBytesOrCanonicalContent)
    : String(fileBytesOrCanonicalContent ?? '');
  const hash = options.hash || hashStableString;
  return hash(canonicalContent);
}

export function buildImportRowIdentity(candidate = {}) {
  const payload = candidate.normalized_payload || candidate.payload || candidate;
  const externalId = text(candidate.external_id || candidate.externalId || candidate.source_reference_id || payload.external_transaction_id || payload.document_number || '');
  if (externalId) {
    return {
      mode: 'external_id',
      value: {
        external_id: externalId,
        amount: roundCurrency(Number(payload.amount || 0)),
        occurred_date: payload.occurred_date || payload.due_date || '',
        type: payload.type || 'saida'
      }
    };
  }
  return {
    mode: 'financial_fallback',
    value: {
      type: payload.type || 'saida',
      person: normalizeComparableText(payload.person || ''),
      occurred_date: payload.occurred_date || payload.due_date || '',
      due_date: payload.due_date || '',
      competence: payload.competence || '',
      amount: roundCurrency(Number(payload.amount || 0)),
      nature: payload.bank_nature || payload.direction || (Number(payload.amount || 0) < 0 ? 'credit' : 'debit'),
      description: normalizeComparableText(payload.description || ''),
      payment_method: normalizeComparableText(payload.payment_method || ''),
      category: normalizeComparableText(payload.category_name || payload.subcategory || '')
    }
  };
}

export function buildImportRowFingerprint(candidate = {}, options = {}) {
  const hash = options.hash || hashStableString;
  return hash(stableStringify(buildImportRowIdentity(candidate)));
}

function buildImportRowIdentityKey(candidate = {}) {
  const identity = buildImportRowIdentity(candidate);
  if (identity.mode === 'external_id') return `external_id:${identity.value.external_id}`;
  return `fingerprint:${hashStableString(stableStringify(identity))}`;
}

export function buildBatchId({ ownerUid = '', importType = '', canonicalContentFingerprint = '' } = {}) {
  return `batch_${hashStableString(`${ownerUid}|${importType}|${canonicalContentFingerprint}`).replace(':', '_')}`;
}

export function buildImportBatch(input = {}, context = {}, options = {}) {
  const now = nowFrom(options);
  const ownerUid = ownerFrom(context);
  const importType = input.importType || input.import_type || IMPORT_TYPES.SPREADSHEET;
  const sourceChannel = input.sourceChannel || input.source_channel || sourceChannelFor(importType);
  const canonicalContentFingerprint = input.canonicalContentFingerprint || input.canonical_content_fingerprint || input.fileFingerprint || input.file_fingerprint || '';
  const batchId = input.batchId || input.batch_id || buildBatchId({ ownerUid, importType, canonicalContentFingerprint });
  return {
    batch_id: batchId,
    owner_uid: ownerUid,
    import_type: importType,
    source_channel: sourceChannel,
    original_filename: sanitizeFilename(input.originalFilename || input.original_filename || ''),
    file_fingerprint: input.fileFingerprint || input.file_fingerprint || canonicalContentFingerprint,
    canonical_content_fingerprint: canonicalContentFingerprint,
    correlation_id: input.correlationId || input.correlation_id || '',
    idempotency_key: input.idempotencyKey || input.idempotency_key || `import:${importType}:${canonicalContentFingerprint}`,
    status: input.status || 'parsed',
    total_rows: Number(input.totalRows || input.total_rows || 0),
    valid_rows: Number(input.validRows || input.valid_rows || 0),
    invalid_rows: Number(input.invalidRows || input.invalid_rows || 0),
    duplicate_rows: Number(input.duplicateRows || input.duplicate_rows || 0),
    conflict_rows: Number(input.conflictRows || input.conflict_rows || 0),
    imported_rows: Number(input.importedRows || input.imported_rows || 0),
    skipped_rows: Number(input.skippedRows || input.skipped_rows || 0),
    created_at: input.createdAt || input.created_at || now(),
    processed_at: input.processedAt || input.processed_at || '',
    schema_version: Number(input.schemaVersion || input.schema_version || 1)
  };
}

function defaultMapRowToPayload(row = {}) {
  return row.normalized_payload || row.payload || row.record || row;
}

function validationErrorsFor(payload = {}) {
  const normalized = normalizeFinanceRecord(payload);
  const validation = validateFinanceRecord(normalized, { allowLegacy: true });
  return { normalized, validation };
}

function summarize(candidates = []) {
  const count = (status) => candidates.filter((candidate) => candidate.status === status).length;
  const ready = count(IMPORT_CANDIDATE_STATUS.READY);
  return {
    totalRows: candidates.length,
    validRows: candidates.filter((candidate) => candidate.status !== IMPORT_CANDIDATE_STATUS.INVALID).length,
    invalidRows: count(IMPORT_CANDIDATE_STATUS.INVALID),
    duplicateRows: count(IMPORT_CANDIDATE_STATUS.DUPLICATE_IN_FILE),
    alreadyImportedRows: count(IMPORT_CANDIDATE_STATUS.ALREADY_IMPORTED) + count(IMPORT_CANDIDATE_STATUS.LEGACY_MATCH),
    conflictRows: count(IMPORT_CANDIDATE_STATUS.CONFLICT),
    readyRows: ready,
    skippedRows: candidates.length - ready,
    readyAmountTotal: roundCurrency(candidates
      .filter((candidate) => candidate.status === IMPORT_CANDIDATE_STATUS.READY)
      .reduce((total, candidate) => total + Number(candidate.normalized_payload?.amount || 0), 0))
  };
}

async function resolveExistingImport(candidate = {}, repositories = {}, context = {}) {
  const idempotency = repositories.idempotency;
  if (idempotency?.find) {
    const found = await idempotency.find({
      ownerUid: ownerFrom(context),
      commandName: 'ImportRowCommand',
      sourceChannel: candidate.source_channel,
      idempotencyKey: candidate.idempotency_key,
      requestFingerprint: candidate.row_fingerprint
    }, context);
    if (found?.ok) {
      if (found.data.request_fingerprint && found.data.request_fingerprint !== candidate.request_fingerprint) {
        return { status: IMPORT_CANDIDATE_STATUS.CONFLICT, reason: 'Receipt existente possui fingerprint diferente.' };
      }
      if (found.data.status === 'completed') {
        return { status: IMPORT_CANDIDATE_STATUS.ALREADY_IMPORTED, entityId: found.data.entity_id || '', reason: 'Receipt completed encontrado.' };
      }
    }
  }

  const financeRecords = repositories.financeRecords;
  if (financeRecords?.list) {
    const listed = await financeRecords.list({}, context);
    const records = listed?.ok ? listed.items || listed.data || [] : [];
    const knownSignatures = new Set([
      candidate.row_fingerprint,
      candidate.legacy_import_signature,
      candidate.legacy_import_core_signature
    ].filter(Boolean));
    const legacy = records.find((record) =>
      knownSignatures.has(text(record.import_signature)) ||
      knownSignatures.has(text(record.import_core_signature)) ||
      text(record.source_reference_id) === candidate.source_reference_id
    );
    if (legacy) return { status: IMPORT_CANDIDATE_STATUS.LEGACY_MATCH, entityId: legacy.id || '', reason: 'Assinatura legada ja existe.' };
  }
  return { status: 'new' };
}

export async function PrepareImportBatch({
  rows = [],
  importType = IMPORT_TYPES.SPREADSHEET,
  originalFilename = '',
  fileContent = null,
  context = {},
  repositories = {},
  mapRowToPayload = defaultMapRowToPayload,
  now = () => new Date().toISOString()
} = {}) {
  const ownerUid = ownerFrom(context);
  if (!ownerUid) {
    return createErrorResult({ code: APPLICATION_RESULT_CODES.FORBIDDEN, message: 'owner autorizado obrigatorio.' });
  }
  if (!Array.isArray(rows)) {
    return createErrorResult({ code: APPLICATION_RESULT_CODES.VALIDATION_ERROR, message: 'rows deve ser uma lista.' });
  }
  const sourceChannel = sourceChannelFor(importType);
  const canonicalRows = rows.map((row) => sanitizeImportPayload(mapRowToPayload(row)));
  const canonicalContent = fileContent ?? canonicalRows;
  const canonicalContentFingerprint = buildFileFingerprint(canonicalContent);
  const batch = buildImportBatch({
    importType,
    sourceChannel,
    originalFilename,
    canonicalContentFingerprint,
    correlationId: context.correlationId || `import-${canonicalContentFingerprint}`,
    totalRows: rows.length
  }, context, { now });

  const candidates = [];
  const firstByIdentityKey = new Map();

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const payload = sanitizeImportPayload(mapRowToPayload(row, { batch, index }));
    const declaredSourceReferenceId = text(row.source_reference_id || row.sourceReferenceId || row.external_id || row.externalId);
    const fallbackSourceReferenceId = declaredSourceReferenceId || buildImportRowFingerprint({
      ...row,
      normalized_payload: payload
    });
    const metadata = normalizeOperationMetadata({
      source_channel: sourceChannel,
      source_reference_id: fallbackSourceReferenceId,
      idempotency_key: '',
      correlation_id: batch.correlation_id,
      received_at: batch.created_at
    }, context);
    const { normalized, validation } = validationErrorsFor({
      ...payload,
      ...metadata,
      source_channel: sourceChannel,
      import_source: payload.import_source || sourceChannel,
      import_batch_id: batch.batch_id
    });
    const rowFingerprint = buildImportRowFingerprint({
      ...row,
      source_reference_id: fallbackSourceReferenceId,
      normalized_payload: normalized
    });
    const sourceReferenceId = fallbackSourceReferenceId || rowFingerprint;
    const idempotencyKey = `import-row:${importType}:${rowFingerprint}`;
    const requestFingerprint = buildOperationFingerprint({
      ownerUid,
      commandName: 'ImportRowCommand',
      sourceChannel,
      payload: normalized
    });
    const candidate = {
      candidate_id: `row_${index + 1}`,
      row_index: index + 1,
      source_row_reference: text(row.source_row_reference || row.sourceRowReference || `${index + 1}`),
      normalized_payload: {
        ...normalized,
        source_reference_id: sourceReferenceId,
        idempotency_key: idempotencyKey,
        import_signature: rowFingerprint,
        import_core_signature: normalized.import_core_signature || rowFingerprint,
        import_batch_id: batch.batch_id
      },
      source_channel: sourceChannel,
      source_reference_id: sourceReferenceId,
      row_fingerprint: rowFingerprint,
      request_fingerprint: requestFingerprint,
      idempotency_key: idempotencyKey,
      legacy_import_signature: text(row.legacy_import_signature || row.legacyImportSignature),
      legacy_import_core_signature: text(row.legacy_import_core_signature || row.legacyImportCoreSignature),
      status: validation.isValid ? IMPORT_CANDIDATE_STATUS.READY : IMPORT_CANDIDATE_STATUS.INVALID,
      validation_errors: validation.errors || [],
      warnings: validation.warnings || [],
      existing_entity_id: '',
      conflict_reason: ''
    };

    if (Array.isArray(row.parser_errors) && row.parser_errors.length) {
      candidate.status = IMPORT_CANDIDATE_STATUS.INVALID;
      candidate.validation_errors = [
        ...candidate.validation_errors,
        ...row.parser_errors.map((error) => ({
          field: error.field || 'row',
          code: error.code || 'PARSER_ERROR',
          message: error.message || 'Linha invalida no parser de planilha.'
        }))
      ];
    }

    const identityKey = buildImportRowIdentityKey({ ...row, normalized_payload: normalized });
    const previous = firstByIdentityKey.get(identityKey);
    if (previous) {
      const previousPayload = previous.request_fingerprint;
      const currentPayload = candidate.request_fingerprint;
      candidate.status = previousPayload === currentPayload
        ? IMPORT_CANDIDATE_STATUS.DUPLICATE_IN_FILE
        : IMPORT_CANDIDATE_STATUS.CONFLICT;
      candidate.conflict_reason = previousPayload === currentPayload
        ? `Duplicidade interna com linha ${previous.row_index}.`
        : `Mesma identidade de origem com payload diferente da linha ${previous.row_index}.`;
    } else {
      firstByIdentityKey.set(identityKey, candidate);
    }

    if (candidate.status === IMPORT_CANDIDATE_STATUS.READY) {
      const existing = await resolveExistingImport(candidate, repositories, context);
      if (existing.status !== 'new') {
        candidate.status = existing.status;
        candidate.existing_entity_id = existing.entityId || '';
        candidate.conflict_reason = existing.reason || '';
      }
    }
    candidates.push(candidate);
  }

  const summary = summarize(candidates);
  const status = summary.conflictRows ? 'validated' : summary.readyRows ? 'ready' : 'validated';
  const finalBatch = {
    ...batch,
    status,
    valid_rows: summary.validRows,
    invalid_rows: summary.invalidRows,
    duplicate_rows: summary.duplicateRows,
    conflict_rows: summary.conflictRows,
    skipped_rows: summary.skippedRows
  };
  return createSuccessResult({
    message: 'Preview de importacao preparado.',
    data: {
      batch: finalBatch,
      candidates,
      summary,
      errors: candidates.flatMap((candidate) => candidate.validation_errors.map((error) => ({ row_index: candidate.row_index, ...error }))),
      warnings: candidates.flatMap((candidate) => candidate.warnings.map((warning) => ({ row_index: candidate.row_index, ...warning })))
    },
    correlationId: finalBatch.correlation_id,
    processedAt: now()
  });
}

async function appendImportAudit(auditRepository, action, payload = {}, context = {}) {
  if (!auditRepository?.append) return repositoryOk();
  return auditRepository.append({
    action,
    actor_uid: context.actorUid || '',
    actor_type: context.actorType || 'user',
    owner_uid: ownerFrom(context),
    source: payload.source_channel || '',
    source_channel: payload.source_channel || '',
    correlation_id: payload.correlation_id || context.correlationId || '',
    status: payload.status || 'success',
    created_at: payload.occurred_at || new Date().toISOString(),
    details: payload
  }, context);
}

export async function CommitImportBatch({
  preparedBatch = null,
  selectedCandidateIds = null,
  context = {},
  repositories = {},
  now = () => new Date().toISOString(),
  maxAtomicRows = IMPORT_MAX_ATOMIC_ROWS
} = {}) {
  const ownerUid = ownerFrom(context);
  if (!ownerUid) return createErrorResult({ code: APPLICATION_RESULT_CODES.FORBIDDEN, message: 'owner autorizado obrigatorio.' });
  const batch = preparedBatch?.batch || preparedBatch?.data?.batch || null;
  const candidates = preparedBatch?.candidates || preparedBatch?.data?.candidates || [];
  if (!batch || !Array.isArray(candidates)) {
    return createErrorResult({ code: APPLICATION_RESULT_CODES.VALIDATION_ERROR, message: 'preparedBatch invalido.' });
  }
  const selected = new Set(Array.isArray(selectedCandidateIds) ? selectedCandidateIds : []);
  const ready = candidates.filter((candidate) =>
    candidate.status === IMPORT_CANDIDATE_STATUS.READY &&
    (!selected.size || selected.has(candidate.candidate_id) || selected.has(candidate.row_index))
  );
  if (!ready.length) return createErrorResult({ code: APPLICATION_RESULT_CODES.VALIDATION_ERROR, message: 'Nenhuma linha ready para importar.' });
  if (ready.length > maxAtomicRows) {
    return createErrorResult({
      code: APPLICATION_RESULT_CODES.VALIDATION_ERROR,
      message: `Importacao limitada a ${maxAtomicRows} linhas por lote atomico nesta etapa.`
    });
  }

  const idempotency = repositories.idempotency;
  const financeRecords = repositories.financeRecords;
  if (!idempotency?.reserve || !financeRecords?.createMany) {
    return createErrorResult({ code: APPLICATION_RESULT_CODES.CONFIGURATION_ERROR, message: 'Repositorios de importacao nao configurados.' });
  }

  const batchFingerprint = buildOperationFingerprint({
    ownerUid,
    commandName: 'CommitImportBatch',
    sourceChannel: batch.source_channel,
    payload: { batch_id: batch.batch_id, file_fingerprint: batch.file_fingerprint, ready: ready.map((candidate) => candidate.row_fingerprint) }
  });
  const batchReservation = await idempotency.reserve({
    ownerUid,
    commandName: 'CommitImportBatch',
    sourceChannel: batch.source_channel,
    idempotencyKey: batch.idempotency_key,
    requestFingerprint: batchFingerprint,
    correlationId: batch.correlation_id
  }, context);
  if (!batchReservation.ok) {
    return createErrorResult({
      code: batchReservation.code === REPOSITORY_ERROR_CODES.CONFLICT ? APPLICATION_RESULT_CODES.CONFLICT : APPLICATION_RESULT_CODES.PERSISTENCE_ERROR,
      message: batchReservation.message || 'Batch ja esta em processamento.',
      correlationId: batch.correlation_id,
      processedAt: now()
    });
  }
  if (batchReservation.data?.reservation_status === 'replay') {
    return createSuccessResult({
      code: APPLICATION_RESULT_CODES.IDEMPOTENT_REPLAY,
      message: 'Importacao ja processada.',
      entityIds: batchReservation.data.entity_ids || [],
      idempotentReplay: true,
      data: { batch: { ...batch, status: 'completed' }, imported: 0, skipped: candidates.length },
      correlationId: batch.correlation_id,
      processedAt: now()
    });
  }

  const rowReservations = [];
  try {
    for (const candidate of ready) {
      const reservation = await idempotency.reserve({
        ownerUid,
        commandName: 'ImportRowCommand',
        sourceChannel: batch.source_channel,
        idempotencyKey: candidate.idempotency_key,
        requestFingerprint: candidate.request_fingerprint,
        correlationId: batch.correlation_id
      }, context);
      if (!reservation.ok) throw new Error(reservation.message || 'Linha ja reservada.');
      if (reservation.data?.reservation_status !== 'replay') rowReservations.push({ id: reservation.id, candidate });
    }

    const toPersist = rowReservations.map(({ candidate }) => ({
      ...candidate.normalized_payload,
      source_channel: batch.source_channel,
      source_reference_id: candidate.source_reference_id,
      idempotency_key: candidate.idempotency_key,
      correlation_id: batch.correlation_id,
      received_at: batch.created_at,
      processed_at: now()
    }));
    const result = toPersist.length
      ? await financeRecords.createMany(toPersist, { ...context, ownerUid, correlationId: batch.correlation_id })
      : repositoryOk({ ids: [], count: 0, data: [] });
    if (!result.ok) throw new Error(result.message || result.error || 'Falha ao persistir importacao.');

    const ids = result.ids || result.items?.map((item) => item.id) || [];
    for (let index = 0; index < rowReservations.length; index += 1) {
      await idempotency.complete(rowReservations[index].id, {
        success: true,
        code: APPLICATION_RESULT_CODES.OK,
        entityId: ids[index] || '',
        entityIds: ids[index] ? [ids[index]] : []
      }, context);
    }
    await idempotency.complete(batchReservation.id, {
      success: true,
      code: APPLICATION_RESULT_CODES.OK,
      entityIds: ids
    }, context);
    await appendImportAudit(repositories.audit, 'IMPORT_COMMITTED', {
      batch_id: batch.batch_id,
      source_channel: batch.source_channel,
      correlation_id: batch.correlation_id,
      status: 'success',
      counts: { imported: ids.length, skipped: candidates.length - ids.length },
      entity_ids: ids.slice(0, 50)
    }, context);
    return createSuccessResult({
      message: 'Importacao concluida.',
      entityIds: ids,
      data: {
        batch: {
          ...batch,
          status: candidates.length === ids.length ? 'completed' : 'completed_with_skips',
          imported_rows: ids.length,
          skipped_rows: candidates.length - ids.length,
          processed_at: now()
        },
        imported: ids.length,
        skipped: candidates.length - ids.length
      },
      correlationId: batch.correlation_id,
      processedAt: now()
    });
  } catch (error) {
    await idempotency.fail(batchReservation.id, { code: APPLICATION_RESULT_CODES.PERSISTENCE_ERROR, correlationId: batch.correlation_id }, context);
    await Promise.all(rowReservations.map(({ id }) => idempotency.fail(id, { code: APPLICATION_RESULT_CODES.PERSISTENCE_ERROR, correlationId: batch.correlation_id }, context)));
    await appendImportAudit(repositories.audit, 'IMPORT_FAILED', {
      batch_id: batch.batch_id,
      source_channel: batch.source_channel,
      correlation_id: batch.correlation_id,
      status: 'error',
      error: error.message || 'Falha desconhecida'
    }, context);
    return createErrorResult({
      code: APPLICATION_RESULT_CODES.PERSISTENCE_ERROR,
      message: error.message || 'Falha ao importar lote.',
      correlationId: batch.correlation_id,
      processedAt: now()
    });
  }
}

export function createImportDryRunFixtures() {
  const base = [
    { person: 'Ana', description: 'Mercado A', amount: 100, occurred_date: '2026-08-01', due_date: '2026-08-01', competence: '2026-08', status: 'Pago', type: 'saida', source_reference_id: 'tx-1' },
    { person: 'Ana', description: 'Farmacia', amount: 50, occurred_date: '2026-08-02', due_date: '2026-08-02', competence: '2026-08', status: 'Pago', type: 'saida', source_reference_id: 'tx-2' },
    { person: 'Ana', description: 'Farmacia', amount: 50, occurred_date: '2026-08-02', due_date: '2026-08-02', competence: '2026-08', status: 'Pago', type: 'saida', source_reference_id: 'tx-2' },
    { person: 'Ana', description: 'Status invalido', amount: 10, occurred_date: '2026-08-03', due_date: '2026-08-03', competence: '2026-08', status: 'Quitado', type: 'saida', source_reference_id: 'tx-invalid' },
    { person: 'Ana', description: 'Ja importada', amount: 70, occurred_date: '2026-08-04', due_date: '2026-08-04', competence: '2026-08', status: 'Pago', type: 'saida', source_reference_id: 'tx-existing' },
    { person: 'Ana', description: 'Conflito', amount: 80, occurred_date: '2026-08-05', due_date: '2026-08-05', competence: '2026-08', status: 'Pago', type: 'saida', source_reference_id: 'tx-conflict' }
  ];
  return {
    fileA: base,
    fileBWithSameContentDifferentName: clone(base),
    changedFile: base.map((row, index) => index === 0 ? { ...row, amount: 101 } : row)
  };
}
