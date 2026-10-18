import {
  buildEffectiveReferences,
  getReferenceScope,
  REFERENCE_SCOPES
} from '../../domain/referenceData.js';

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeList(value) {
  return Array.isArray(value) ? value.map((item) => ({ ...item })) : [];
}

function stabilizeReferenceTimestamps(record = {}, generatedAt = '') {
  if (!generatedAt || !['macro', 'categoria'].includes(record.type)) return record;
  return {
    ...record,
    created_at: record.created_at || generatedAt,
    updated_at: record.updated_at || generatedAt
  };
}

function normalizeText(value = '') {
  return String(value || '').trim().toLowerCase();
}

function sortByText(records = [], selector = () => '') {
  return [...records].sort((left, right) => String(selector(left) || '').localeCompare(String(selector(right) || ''), 'pt-BR'));
}

function hasPermission(permissions = {}, name = '') {
  return permissions?.[name] === true;
}

function canMaintainReference(record = {}, permissions = {}) {
  return getReferenceScope(record) !== REFERENCE_SCOPES.GLOBAL || hasPermission(permissions, 'canManageSharedReferences');
}

function decorateReference(record = {}, permissions = {}) {
  const scope = getReferenceScope(record);
  return {
    ...record,
    reference_origin: scope,
    readonly: !canMaintainReference(record, permissions),
    canEdit: canMaintainReference(record, permissions),
    canDelete: canMaintainReference(record, permissions)
  };
}

function buildPermissions(input = {}) {
  const profile = input.userProfile || {};
  const incoming = input.permissions || {};
  const active = profile.status === 'active';
  const admin = incoming.canManageSharedReferences === true
    || incoming.canManageUsers === true
    || (active && ['admin', 'owner'].includes(profile.role));
  return {
    canReadSettings: active && incoming.canReadSettings !== false,
    canManagePersonalReferences: active && incoming.canManagePersonalReferences !== false,
    canManagePeople: active && incoming.canManagePeople !== false,
    canManageLocalSettings: active && incoming.canManageLocalSettings !== false,
    canManageSharedReferences: active && admin,
    canManageAdminConfig: active && (incoming.canManageAdminConfig === true || admin),
    canManagePercentageRules: active && incoming.canManagePercentageRules !== false,
    isAdmin: active && admin,
    accountStatus: profile.status || 'unknown'
  };
}

function belongsToOwner(record = {}, ownerUid = '') {
  return !ownerUid || !record.owner_uid || record.owner_uid === ownerUid;
}

function splitReferences(input = {}) {
  const ownerUid = input.userProfile?.uid || input.options?.ownerUid || '';
  const generatedAt = input.options?.generatedAt || '';
  const personal = [
    ...normalizeList(input.personalReferences),
    ...normalizeList(input.people).filter((record) => record.type === 'macro' || record.type === 'categoria')
  ]
    .filter((record) => belongsToOwner(record, ownerUid))
    .map((record) => stabilizeReferenceTimestamps(record, generatedAt));
  const shared = normalizeList(input.sharedReferences).map((record) => stabilizeReferenceTimestamps(record, generatedAt));
  return { personal, shared };
}

export function buildSettingsReadModel(input = {}) {
  const snapshot = clone(input);
  const permissions = buildPermissions(snapshot);
  const { personal, shared } = splitReferences(snapshot);
  const ownerUid = snapshot.userProfile?.uid || snapshot.options?.ownerUid || '';
  const effective = buildEffectiveReferences(shared, personal, { ownerUid });
  const people = sortByText(normalizeList(snapshot.people).filter((record) => record.type === 'pessoa' && belongsToOwner(record, ownerUid)), (record) => record.person);
  const personalMacros = sortByText(personal.filter((record) => record.type === 'macro'), (record) => record.macro_category)
    .map((record) => decorateReference(record, permissions));
  const personalCategories = sortByText(personal.filter((record) => record.type === 'categoria'), (record) => `${record.macro_category}|${record.category_name}`)
    .map((record) => decorateReference(record, permissions));
  const sharedMacros = sortByText(shared.filter((record) => record.type === 'macro'), (record) => record.macro_category)
    .map((record) => decorateReference(record, permissions));
  const sharedCategories = sortByText(shared.filter((record) => record.type === 'categoria'), (record) => `${record.macro_category}|${record.category_name}`)
    .map((record) => decorateReference(record, permissions));
  const percentageRules = normalizeList(snapshot.percentageRules).filter((record) => record.type === 'percentage_rule');
  const taxParameters = normalizeList(snapshot.taxParameters);
  const localSettings = { ...(snapshot.localSettings || {}) };
  const warnings = [];

  if (!permissions.canReadSettings) warnings.push('SETTINGS_ACCESS_BLOCKED_BY_ACCOUNT_STATUS');
  if (effective.collisions.length) warnings.push('REFERENCE_COLLISIONS_DETECTED');
  if (!permissions.canManageSharedReferences && (sharedMacros.length || sharedCategories.length)) warnings.push('SHARED_REFERENCES_READ_ONLY');

  return {
    sections: [
      { id: 'people', label: 'Pessoas', count: people.length, classification: 'PERSONAL_REFERENCE', readonly: !permissions.canManagePeople },
      { id: 'macros', label: 'Categorias Macro', count: personalMacros.length + sharedMacros.length, classification: 'PERSONAL_REFERENCE', readonly: !permissions.canManagePersonalReferences },
      { id: 'categories', label: 'Categorias Personalizadas', count: personalCategories.length + sharedCategories.length, classification: 'PERSONAL_REFERENCE', readonly: !permissions.canManagePersonalReferences },
      { id: 'local-settings', label: 'Configuracoes locais', count: Object.keys(localSettings).length, classification: 'LOCAL_SETTING', readonly: !permissions.canManageLocalSettings },
      { id: 'percentage-rules', label: 'Regras percentuais', count: percentageRules.length, classification: 'FINANCIAL_RULE_CONFIG', readonly: !permissions.canManagePercentageRules },
      { id: 'tax-parameters', label: 'Parametros tributarios', count: taxParameters.length, classification: 'ADMIN_CONFIG', readonly: !permissions.canManageAdminConfig }
    ],
    permissions,
    references: {
      personalMacros,
      personalCategories,
      sharedMacros,
      sharedCategories,
      effectiveMacros: effective.effectiveMacros,
      effectiveCategories: effective.effectiveCategories,
      collisions: effective.collisions,
      duplicateKeys: effective.duplicateKeys
    },
    people,
    localSettings,
    rules: {
      percentageRules: percentageRules.map((rule) => ({ ...rule })),
      taxParameters: taxParameters.map((parameter) => ({ ...parameter }))
    },
    warnings,
    metadata: {
      ownerUid,
      generatedAt: snapshot.options?.generatedAt || '',
      activeSection: normalizeText(snapshot.options?.activeSection || 'overview') || 'overview',
      offline: snapshot.options?.offline === true,
      counts: {
        personalReferences: personal.length,
        sharedReferences: shared.length,
        people: people.length,
        percentageRules: percentageRules.length,
        taxParameters: taxParameters.length
      }
    }
  };
}
