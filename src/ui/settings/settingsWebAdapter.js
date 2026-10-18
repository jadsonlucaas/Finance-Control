import {
  REFERENCE_WRITE_SCOPE_ERRORS,
  resolveReferenceWriteScope
} from '../../application/settings/referenceWriteScope.js';

function actionUnavailable() {
  return { success: false, isOk: false, ok: false, code: 'SETTINGS_ACTION_UNAVAILABLE' };
}

function forbidden(result) {
  return {
    success: false,
    isOk: false,
    ok: false,
    code: result.errorCode,
    error: result.errorCode,
    reason: result.reason,
    effectiveScope: result.effectiveScope
  };
}

function createSettingsAuthContext(target = globalThis) {
  const uid = target.currentUser?.uid
    || target.auth?.currentUser?.uid
    || target.authSdk?.getCurrentUser?.()?.uid
    || target.currentUserProfile?.uid
    || '';
  const profile = target.currentUserProfile || {};
  const role = target.currentUserRole || profile.role || 'user';
  return {
    actorUid: uid,
    uid,
    actorType: role === 'admin' || role === 'owner' ? 'admin' : 'user',
    role,
    accountStatus: target.currentAccountStatus || profile.status || 'active',
    ownerUid: uid,
    permissions: target.currentUserPermissions || profile.permissions || []
  };
}

function isCurrentUserAdmin(target = globalThis) {
  const profile = target.currentUserProfile || {};
  const role = target.currentUserRole || profile.role || '';
  return target.isCurrentUserAdmin?.() === true || role === 'admin' || role === 'owner';
}

function settingsPermissions(target = globalThis) {
  const profile = target.currentUserProfile || {};
  const status = target.currentAccountStatus || profile.status || 'active';
  const active = status === 'active';
  const admin = active && isCurrentUserAdmin(target);
  return {
    canReadSettings: active,
    canManagePersonalReferences: active,
    canManagePeople: active,
    canManageLocalSettings: active,
    canManagePercentageRules: active,
    canManageSharedReferences: admin,
    canManageAdminConfig: admin,
    isAdmin: admin
  };
}

function createSettingsReadSource(target = globalThis) {
  const repository = target.financeApp?.applicationDependencies?.repositories?.financeRecords;
  return {
    read: async () => {
      const authContext = createSettingsAuthContext(target);
      const result = repository?.list
        ? await repository.list({}, authContext)
        : { items: Array.isArray(target.allRecords) ? target.allRecords : [] };
      const records = result.items || result.data || [];
      const references = records.filter((record) => record?.type === 'macro' || record?.type === 'categoria');
      return {
        personalReferences: references.filter((record) => record.shared_scope !== 'global'),
        sharedReferences: references.filter((record) => record.shared_scope === 'global'),
        people: records.filter((record) => record?.type === 'pessoa'),
        percentageRules: records.filter((record) => record?.type === 'percentage_rule'),
        taxParameters: [],
        localSettings: readSettingsLocalStorage(target),
        userProfile: target.currentUserProfile || { uid: authContext.uid, status: 'active', role: 'user' },
        permissions: settingsPermissions(target)
      };
    }
  };
}

function readSettingsLocalStorage(target = globalThis) {
  const storage = target.localStorage;
  if (!storage) return {};
  const keys = [
    'finance-control-tax-settings-v1',
    'finance-control-overtime-types-v1'
  ];
  return Object.fromEntries(keys.map((key) => [key, storage.getItem?.(key) || '']).filter(([, value]) => value));
}

function settingsBaseRecord(target = globalThis) {
  return {
    person: '',
    macro_category: '',
    subcategory: '',
    description: '',
    amount: 0,
    status: '',
    payment_method: '',
    occurred_date: '',
    due_date: '',
    competence: '',
    paid_at: '',
    installment_no: 0,
    total_installments: 0,
    parent_id: '',
    earning_type: '',
    recurrence: '',
    created_at: new Date().toISOString(),
    category_id: '',
    category_name: '',
    category_color: '',
    category_icon: '',
    ...(target.getHourExtraRecordDefaults?.() || {})
  };
}

function resolveForWrite(target, input, operation) {
  return resolveReferenceWriteScope({
    requestedScope: input?.shared_scope,
    permissions: settingsPermissions(target),
    operation,
    allowDefaultPersonal: true
  });
}

function createSettingsActions(target = globalThis) {
  const mutations = target.financeRecordMutations;
  const updateRecord = async (record) => mutations?.updateRecord?.(record) || target.dataSdk?.update?.(record);
  return {
    createPerson: async (input = {}) => mutations?.createRecord?.({
      ...settingsBaseRecord(target),
      type: 'pessoa',
      person: input.person || '',
      salary_base: input.salary_base || 0,
      receiving_type: input.receiving_type === 'quinzenal' ? 'quinzenal' : 'mensal'
    }) || actionUnavailable(),
    updatePerson: async (input = {}) => {
      const current = (target.allRecords || []).find((record) => record.type === 'pessoa' && String(record.id) === String(input.id));
      if (!current) return { success: false, code: 'SETTINGS_PERSON_NOT_FOUND' };
      return updateRecord({ ...current, ...(input.fields || {}), id: current.id }) || actionUnavailable();
    },
    createMacro: async (input = {}) => {
      const scope = resolveForWrite(target, input, 'createMacro');
      if (!scope.allowed) return forbidden(scope);
      return mutations?.createRecord?.({
        ...settingsBaseRecord(target),
        type: 'macro',
        macro_category: input.macro_category || '',
        shared_scope: scope.effectiveScope
      }) || actionUnavailable();
    },
    createCategory: async (input = {}) => {
      const scope = resolveForWrite(target, input, 'createCategory');
      if (!scope.allowed) return forbidden(scope);
      return mutations?.createRecord?.({
        ...settingsBaseRecord(target),
        type: 'categoria',
        macro_category: input.macro_category || '',
        category_name: input.category_name || '',
        category_color: input.category_color || '#38bdf8',
        category_icon: input.category_icon || 'tag',
        category_id: input.category_id || `cat_${Date.now()}`,
        shared_scope: scope.effectiveScope
      }) || actionUnavailable();
    },
    updateCategory: async (input = {}) => {
      const current = (target.allRecords || []).find((record) => record.type === 'categoria' && String(record.id || record.category_id) === String(input.id));
      if (!current) return { success: false, code: 'SETTINGS_CATEGORY_NOT_FOUND' };
      if (current.shared_scope === 'global' && !settingsPermissions(target).canManageSharedReferences) {
        return forbidden({
          allowed: false,
          effectiveScope: 'global',
          reason: 'SHARED_SCOPE_REQUIRES_ADMIN',
          errorCode: REFERENCE_WRITE_SCOPE_ERRORS.SHARED_FORBIDDEN
        });
      }
      const requestedScope = input.shared_scope || current.shared_scope || 'personal';
      const scope = resolveReferenceWriteScope({
        requestedScope,
        permissions: settingsPermissions(target),
        operation: 'updateCategory',
        allowDefaultPersonal: true
      });
      if (!scope.allowed) return forbidden(scope);
      return updateRecord({
        ...current,
        category_name: input.category_name || current.category_name,
        macro_category: input.macro_category || current.macro_category,
        category_color: input.category_color || current.category_color,
        category_icon: input.category_icon || current.category_icon,
        shared_scope: scope.effectiveScope,
        id: current.id
      }) || actionUnavailable();
    }
  };
}

function createSettingsSupplementaryRenderers(target = globalThis) {
  return [
    () => target.financeApp?.settingsLegacySupplementals?.renderEntrySourcesAndPercentage?.(),
    () => target.renderImportReport?.(),
    () => target.renderEntradasImportReport?.(),
    () => target.renderOvertimeTypesSettings?.(),
    () => target.renderTaxSettingsPanel?.()
  ];
}

export function createSettingsWebAdapter(target = globalThis) {
  return {
    readSource: createSettingsReadSource(target),
    actions: createSettingsActions(target),
    supplementaryRenderers: createSettingsSupplementaryRenderers(target),
    connectivity: target.financeApp?.applicationDependencies?.services?.connectivity
  };
}
