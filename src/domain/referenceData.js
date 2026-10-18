export const REFERENCE_SCOPES = {
  GLOBAL: 'global',
  PERSONAL: 'personal'
};

export const REFERENCE_SCHEMA_VERSION = 1;

function stripAccents(value = '') {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function normalizeReferenceName(value = '') {
  return stripAccents(value)
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

export function createReferenceId(prefix = 'ref', value = '') {
  const slug = normalizeReferenceName(value)
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return `${prefix}_${slug || 'sem_nome'}`;
}

export function getReferenceScope(record = {}, fallback = REFERENCE_SCOPES.PERSONAL) {
  if (record?.shared_scope === REFERENCE_SCOPES.GLOBAL) return REFERENCE_SCOPES.GLOBAL;
  if (record?.shared_scope === REFERENCE_SCOPES.PERSONAL) return REFERENCE_SCOPES.PERSONAL;
  return fallback;
}

export function isReferenceRecord(record = {}) {
  return record?.type === 'macro' || record?.type === 'categoria';
}

export function isGlobalReference(record = {}) {
  return isReferenceRecord(record) && getReferenceScope(record) === REFERENCE_SCOPES.GLOBAL;
}

export function isPersonalReference(record = {}) {
  return isReferenceRecord(record) && getReferenceScope(record) === REFERENCE_SCOPES.PERSONAL;
}

function getOwner(user = {}) {
  return {
    owner_uid: user?.uid || user?.owner_uid || '',
    owner_email: user?.email || user?.owner_email || ''
  };
}

function resolveOwnerSource(options = {}, record = {}) {
  return options.user?.uid || options.user?.owner_uid ? options.user : record;
}

function omitIntegrationFields(record = {}) {
  const {
    phone,
    phone_number,
    whatsapp,
    whatsapp_phone,
    channel,
    ...clean
  } = record;
  return clean;
}

export function normalizeMacroReference(record = {}, options = {}) {
  const cleanRecord = omitIntegrationFields(record);
  const scope = getReferenceScope(record, options.defaultScope || REFERENCE_SCOPES.PERSONAL);
  const macroName = String(cleanRecord.macro_category || cleanRecord.name || '').trim();
  const owner = scope === REFERENCE_SCOPES.PERSONAL
    ? getOwner(resolveOwnerSource(options, cleanRecord))
    : {
        owner_uid: cleanRecord.owner_uid || options.user?.uid || '',
        owner_email: cleanRecord.owner_email || options.user?.email || ''
      };

  return {
    ...cleanRecord,
    type: 'macro',
    macro_id: record.macro_id || record.id || createReferenceId('macro', macroName),
    macro_category: macroName,
    shared_scope: scope,
    owner_uid: owner.owner_uid,
    owner_email: owner.owner_email,
    schema_version: Number(record.schema_version || REFERENCE_SCHEMA_VERSION),
    updated_at: record.updated_at || new Date().toISOString(),
    created_at: record.created_at || new Date().toISOString()
  };
}

export function normalizeCategoryReference(record = {}, options = {}) {
  const cleanRecord = omitIntegrationFields(record);
  const scope = getReferenceScope(record, options.defaultScope || REFERENCE_SCOPES.PERSONAL);
  const categoryName = String(cleanRecord.category_name || cleanRecord.subcategory || cleanRecord.description || '').trim();
  const macroName = String(cleanRecord.macro_category || '').trim();
  const owner = scope === REFERENCE_SCOPES.PERSONAL
    ? getOwner(resolveOwnerSource(options, cleanRecord))
    : {
        owner_uid: cleanRecord.owner_uid || options.user?.uid || '',
        owner_email: cleanRecord.owner_email || options.user?.email || ''
      };

  return {
    ...cleanRecord,
    type: 'categoria',
    category_id: record.category_id || record.id || createReferenceId('cat', `${macroName}_${categoryName}`),
    category_name: categoryName,
    macro_id: record.macro_id || createReferenceId('macro', macroName),
    macro_category: macroName,
    category_color: String(record.category_color || ''),
    category_icon: String(record.category_icon || ''),
    shared_scope: scope,
    owner_uid: owner.owner_uid,
    owner_email: owner.owner_email,
    schema_version: Number(record.schema_version || REFERENCE_SCHEMA_VERSION),
    updated_at: record.updated_at || new Date().toISOString(),
    created_at: record.created_at || new Date().toISOString()
  };
}

export function normalizeReferenceRecord(record = {}, options = {}) {
  if (record?.type === 'macro') return normalizeMacroReference(record, options);
  if (record?.type === 'categoria') return normalizeCategoryReference(record, options);
  return { ...record };
}

export function validateReferenceRecord(record = {}) {
  const errors = [];
  if (!isReferenceRecord(record)) errors.push('Tipo de referencia invalido.');
  const scope = getReferenceScope(record, '');
  if (![REFERENCE_SCOPES.GLOBAL, REFERENCE_SCOPES.PERSONAL].includes(scope)) errors.push('Escopo invalido.');
  if (record.type === 'macro' && !normalizeReferenceName(record.macro_category)) errors.push('Nome da macro obrigatorio.');
  if (record.type === 'categoria') {
    if (!normalizeReferenceName(record.category_name || record.subcategory)) errors.push('Nome da categoria obrigatorio.');
    if (!normalizeReferenceName(record.macro_category)) errors.push('Macro da categoria obrigatoria.');
  }
  if (scope === REFERENCE_SCOPES.PERSONAL && !record.owner_uid) errors.push('Referencia pessoal exige owner_uid.');
  return { isValid: errors.length === 0, errors };
}

function macroKey(record = {}) {
  return normalizeReferenceName(record.macro_category);
}

function categoryKey(record = {}) {
  return `${normalizeReferenceName(record.macro_category)}|${normalizeReferenceName(record.category_name || record.subcategory)}`;
}

function isExactDuplicate(left = {}, right = {}) {
  if (left.type !== right.type) return false;
  if (left.type === 'macro') return macroKey(left) === macroKey(right);
  return categoryKey(left) === categoryKey(right)
    && String(left.category_color || '') === String(right.category_color || '')
    && String(left.category_icon || '') === String(right.category_icon || '');
}

function sortReferences(records = []) {
  return [...records].sort((left, right) => {
    const type = String(left.type || '').localeCompare(String(right.type || ''), 'pt-BR');
    if (type) return type;
    const leftMacro = String(left.macro_category || '').localeCompare(String(right.macro_category || ''), 'pt-BR');
    if (leftMacro) return leftMacro;
    const leftCat = String(left.category_name || '').localeCompare(String(right.category_name || ''), 'pt-BR');
    if (leftCat) return leftCat;
    return String(left.id || left.category_id || left.macro_id || '').localeCompare(String(right.id || right.category_id || right.macro_id || ''), 'pt-BR');
  });
}

export function buildEffectiveReferences(globalReferences = [], personalReferences = [], options = {}) {
  const ownerUid = options.ownerUid || '';
  const effectiveMacros = [];
  const effectiveCategories = [];
  const collisions = [];
  const duplicateKeys = new Set();

  const all = [
    ...sortReferences(globalReferences).map((record) => normalizeReferenceRecord(record, { defaultScope: REFERENCE_SCOPES.GLOBAL })),
    ...sortReferences(personalReferences).map((record) => normalizeReferenceRecord(record, { defaultScope: REFERENCE_SCOPES.PERSONAL }))
  ].filter((record) => {
    if (!isReferenceRecord(record)) return false;
    if (record.shared_scope === REFERENCE_SCOPES.PERSONAL && ownerUid && record.owner_uid && record.owner_uid !== ownerUid) return false;
    return true;
  });

  const append = (bucket, record, key) => {
    const existing = bucket.find((item) => item.__key === key);
    const decorated = {
      ...record,
      reference_origin: record.shared_scope,
      __key: key
    };
    if (!existing) {
      bucket.push(decorated);
      return;
    }
    if (isExactDuplicate(existing, decorated)) {
      duplicateKeys.add(`${record.type}:${key}`);
      return;
    }
    collisions.push({
      type: record.type,
      key,
      existing: {
        id: existing.id || existing.macro_id || existing.category_id || '',
        scope: existing.shared_scope
      },
      incoming: {
        id: record.id || record.macro_id || record.category_id || '',
        scope: record.shared_scope
      }
    });
    bucket.push({ ...decorated, collision: true });
  };

  all.forEach((record) => {
    if (record.type === 'macro') append(effectiveMacros, record, macroKey(record));
    if (record.type === 'categoria') append(effectiveCategories, record, categoryKey(record));
  });

  const clean = (record) => {
    const { __key, ...rest } = record;
    return rest;
  };

  return {
    effectiveMacros: effectiveMacros.map(clean),
    effectiveCategories: effectiveCategories.map(clean),
    collisions,
    duplicateKeys: [...duplicateKeys].sort()
  };
}

export function resolveRecordCategory(record = {}, effectiveReferences = {}) {
  const categories = Array.isArray(effectiveReferences.effectiveCategories)
    ? effectiveReferences.effectiveCategories
    : [];
  const recordCategoryId = String(record.category_id || '').trim();
  const byId = recordCategoryId
    ? categories.find((category) => String(category.category_id || category.id || '') === recordCategoryId)
    : null;
  const byName = !byId
    ? categories.find((category) => categoryKey(category) === categoryKey({
        macro_category: record.macro_category,
        category_name: record.category_name || record.subcategory || record.description
      }))
    : null;
  const resolved = byId || byName;
  if (resolved) {
    return {
      status: 'resolved',
      category: resolved,
      source: byId ? 'id' : 'name'
    };
  }
  return {
    status: 'orphaned',
    category: {
      category_id: record.category_id || '',
      category_name: record.category_name || record.subcategory || record.description || '',
      macro_id: record.macro_id || '',
      macro_category: record.macro_category || '',
      category_color: record.category_color || '',
      category_icon: record.category_icon || ''
    },
    source: 'record_snapshot'
  };
}

export function buildReferenceDataDryRun(records = [], options = {}) {
  const safeRecords = Array.isArray(records) ? records : [];
  const report = {
    globals: { macros: 0, categories: 0 },
    personal: { macros: 0, categories: 0 },
    legacyWithoutScope: [],
    missingIds: [],
    duplicates: [],
    collisions: [],
    orphanedReferences: [],
    suggestions: []
  };

  const globalRefs = [];
  const personalRefs = [];
  safeRecords.forEach((record) => {
    if (!isReferenceRecord(record)) return;
    if (!record.shared_scope) report.legacyWithoutScope.push(record.id || record.macro_category || record.category_name || '');
    const normalized = normalizeReferenceRecord(record, {
      defaultScope: record.shared_scope || REFERENCE_SCOPES.PERSONAL,
      user: { uid: record.owner_uid || options.ownerUid || '', email: record.owner_email || '' }
    });
    if (record.type === 'macro' && !record.macro_id) report.missingIds.push(record.id || record.macro_category || '');
    if (record.type === 'categoria' && !record.category_id) report.missingIds.push(record.id || record.category_name || '');
    if (normalized.shared_scope === REFERENCE_SCOPES.GLOBAL) {
      if (normalized.type === 'macro') report.globals.macros += 1;
      if (normalized.type === 'categoria') report.globals.categories += 1;
      globalRefs.push(normalized);
    } else {
      if (normalized.type === 'macro') report.personal.macros += 1;
      if (normalized.type === 'categoria') report.personal.categories += 1;
      personalRefs.push(normalized);
    }
  });

  const effective = buildEffectiveReferences(globalRefs, personalRefs, { ownerUid: options.ownerUid || '' });
  report.duplicates = effective.duplicateKeys;
  report.collisions = effective.collisions;

  safeRecords
    .filter((record) => record?.type === 'saida' || record?.type === 'entrada')
    .forEach((record) => {
      const resolved = resolveRecordCategory(record, effective);
      if (resolved.status === 'orphaned' && (record.category_id || record.category_name || record.subcategory || record.macro_category)) {
        report.orphanedReferences.push(record.id || record.description || '');
      }
    });

  if (report.legacyWithoutScope.length) report.suggestions.push('Classificar referencias legadas como personal/global em migracao futura assistida.');
  if (report.collisions.length) report.suggestions.push('Resolver colisoes manualmente antes de migrar.');
  if (report.orphanedReferences.length) report.suggestions.push('Preservar snapshots em lancamentos orfaos; nao excluir lancamentos.');

  return report;
}
