import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  runTransaction,
  setDoc,
  updateDoc,
  writeBatch
} from 'firebase/firestore';
import { sanitizeFirestoreRecord } from './firestoreSanitizer.js';
import {
  classifyFinanceRecordAuditAction,
  summarizeFinanceRecord
} from './audit.js';
import {
  REFERENCE_SCOPES,
  isGlobalReference,
  isReferenceRecord,
  isPersonalReference,
  normalizeReferenceRecord
} from '../domain/referenceData.js';
import {
  validateFinanceRecord
} from '../domain/records/index.js';

const CLOUD_LOCAL_STORAGE_PREFIX = 'finance-control-';
const CLOUD_LOCAL_STORAGE_RELOAD_FLAG = 'finance-control-cloud-local-storage-reloaded-v1';
const USER_RECORDS_CACHE_PREFIX = 'finance-control-user-records-cache-v1-';
const USER_RECORDS_ACTIVE_CACHE_KEY = 'finance-control-user-records-cache-active-v1';
const FINANCE_CACHE_STATE_EVENT = 'financeCacheStateChanged';
export const USER_RECORDS_CACHE_TTL_MS = 15 * 60 * 1000;

const DEFAULT_SHARED_MACROS = ['FIXO', 'VARIAVEL', 'RESERVA'];
const DEFAULT_SHARED_CATEGORIES = [
  { macro: 'FIXO', name: 'Habitação', color: '#38bdf8', icon: 'home' },
  { macro: 'FIXO', name: 'Assinaturas', color: '#0ea5e9', icon: 'repeat' },
  { macro: 'FIXO', name: 'Educação', color: '#6366f1', icon: 'book-open' },
  { macro: 'FIXO', name: 'Transporte', color: '#14b8a6', icon: 'bus' },
  { macro: 'VARIAVEL', name: 'Alimentação', color: '#22c55e', icon: 'utensils-crossed' },
  { macro: 'VARIAVEL', name: 'Lazer', color: '#f59e0b', icon: 'party-popper' },
  { macro: 'VARIAVEL', name: 'Vestuário', color: '#ec4899', icon: 'shirt' },
  { macro: 'VARIAVEL', name: 'Cuidados pessoais', color: '#8b5cf6', icon: 'sparkles' },
  { macro: 'VARIAVEL', name: 'Outros', color: '#94a3b8', icon: 'tag' },
  { macro: 'RESERVA', name: 'Investimentos', color: '#10b981', icon: 'piggy-bank' },
  { macro: 'RESERVA', name: 'Reserva de emergência', color: '#06b6d4', icon: 'shield' }
];

function slugifySharedId(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function getSharedRecordDefaults() {
  return {
    nomeTipo: '',
    percentualUsado: 0,
    valorHoraCalculado: 0,
    valorTotalCalculado: 0,
    quantidadeHoras: 0,
    quantidadeHorasFormatada: '',
    valorBaseHora: 0,
    tipoFinanceiroUsado: false,
    horaInicial: '',
    horaFinal: ''
  };
}

function shouldSyncLocalStorageKey(key) {
  return typeof key === 'string'
    && key.startsWith(CLOUD_LOCAL_STORAGE_PREFIX)
    && !key.startsWith(USER_RECORDS_CACHE_PREFIX)
    && key !== USER_RECORDS_ACTIVE_CACHE_KEY;
}

function isSharedMacroRecord(record) {
  return record?.type === 'macro' && isGlobalReference(record);
}

function isSharedCategoryRecord(record) {
  return record?.type === 'categoria' && isGlobalReference(record);
}

function isReferenceInUse(reference = {}, records = []) {
  if (!reference?.type) return false;
  if (reference.type === 'macro') {
    const macroName = String(reference.macro_category || '').trim();
    const macroId = String(reference.macro_id || reference.id || '').trim();
    return records.some((record) =>
      (record.type === 'saida' || record.type === 'entrada' || record.type === 'percentage_rule') &&
      (
        (macroId && String(record.macro_id || '') === macroId) ||
        (macroName && String(record.macro_category || '') === macroName)
      )
    );
  }
  if (reference.type === 'categoria') {
    const categoryName = String(reference.category_name || reference.subcategory || '').trim();
    const categoryId = String(reference.category_id || reference.id || '').trim();
    const macroName = String(reference.macro_category || '').trim();
    return records.some((record) =>
      (record.type === 'saida' || record.type === 'entrada' || record.type === 'percentage_rule') &&
      (
        (categoryId && String(record.category_id || '') === categoryId) ||
        (categoryName && String(record.subcategory || record.category_name || record.description || '') === categoryName &&
          (!macroName || String(record.macro_category || '') === macroName))
      )
    );
  }
  return false;
}

async function hasAdminAuthority(user, target = globalThis) {
  if (target?.isCurrentUserAdmin?.() === true) return true;
  try {
    const token = await user?.getIdTokenResult?.();
    return token?.claims?.admin === true;
  } catch {
    return false;
  }
}

function contractFailure(validation) {
  return {
    isOk: false,
    error: 'FINANCE_RECORD_CONTRACT_INVALID',
    validation
  };
}

export function getUserRecordsCacheKey(uid) {
  return `${USER_RECORDS_CACHE_PREFIX}${encodeURIComponent(uid || '')}`;
}

function isUserRecordsCacheKey(key) {
  return typeof key === 'string' && key.startsWith(USER_RECORDS_CACHE_PREFIX);
}

function setFinanceCacheState(target, detail = {}) {
  const state = {
    source: detail.source || 'none',
    uid: detail.uid || '',
    savedAt: detail.savedAt || '',
    expiresAt: detail.expiresAt || '',
    cached: detail.cached === true,
    recordCount: Number(detail.recordCount || 0),
    expired: detail.expired === true
  };
  target.__financeCacheState = state;
  target.dispatchEvent?.(new CustomEvent(FINANCE_CACHE_STATE_EVENT, { detail: state }));
  return state;
}

function clearStorageKey(target, key) {
  if (!key) return;
  if (typeof target.__financeCloudRemoveMemoryStorage === 'function' && (shouldSyncLocalStorageKey(key) || isUserRecordsCacheKey(key))) {
    target.__financeCloudRemoveMemoryStorage(key);
  }
  const nativeStorage = target.__financeCloudNativeStorage;
  if (nativeStorage?.removeItem && target.localStorage) {
    nativeStorage.removeItem.call(target.localStorage, key);
    return;
  }
  target.localStorage?.removeItem?.(key);
}

export function clearUserRecordsCache(target = globalThis, uid = '') {
  const storage = target?.localStorage;
  const keysToClear = new Set();
  if (uid) {
    keysToClear.add(getUserRecordsCacheKey(uid));
  } else {
    if (storage) {
      for (let index = 0; index < storage.length; index += 1) {
        const key = storage.key(index);
        if (isUserRecordsCacheKey(key)) keysToClear.add(key);
      }
    }
    (target.__financeCloudLocalKeys?.() || []).forEach((key) => {
      if (isUserRecordsCacheKey(key)) keysToClear.add(key);
    });
  }
  keysToClear.forEach((key) => clearStorageKey(target, key));
  clearStorageKey(target, USER_RECORDS_ACTIVE_CACHE_KEY);
}

export function clearUserScopedLocalData(target = globalThis) {
  const storage = target?.localStorage;
  const keysToClear = new Set();
  if (storage) {
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (shouldSyncLocalStorageKey(key) || isUserRecordsCacheKey(key)) {
        keysToClear.add(key);
      }
    }
  }
  (target.__financeCloudLocalKeys?.() || []).forEach((key) => {
    if (shouldSyncLocalStorageKey(key) || isUserRecordsCacheKey(key)) {
      keysToClear.add(key);
    }
  });
  keysToClear.forEach((key) => clearStorageKey(target, key));
  clearStorageKey(target, USER_RECORDS_ACTIVE_CACHE_KEY);
  target.sessionStorage?.removeItem?.(CLOUD_LOCAL_STORAGE_RELOAD_FLAG);
}

export function readCachedUserRecords(target = globalThis, uid = '', { now = Date.now(), ttlMs = USER_RECORDS_CACHE_TTL_MS } = {}) {
  try {
    const raw = target.localStorage?.getItem(getUserRecordsCacheKey(uid));
    if (!raw) return { records: [], savedAt: '', expiresAt: '', expired: false };
    const parsed = JSON.parse(raw);
    const records = Array.isArray(parsed?.records) ? parsed.records : [];
    const savedAt = typeof parsed?.saved_at === 'string' ? parsed.saved_at : '';
    const savedAtMs = savedAt ? Date.parse(savedAt) : Number.NaN;
    const expired = !savedAt || Number.isNaN(savedAtMs) || (savedAtMs + ttlMs) < now;
    if (expired) {
      clearUserRecordsCache(target, uid);
      return { records: [], savedAt, expiresAt: '', expired: true };
    }
    return {
      records,
      savedAt,
      expiresAt: new Date(savedAtMs + ttlMs).toISOString(),
      expired: false
    };
  } catch {
    clearUserRecordsCache(target, uid);
    return { records: [], savedAt: '', expiresAt: '', expired: true };
  }
}

export function writeCachedUserRecords(target = globalThis, uid = '', records = []) {
  try {
    const cacheKey = getUserRecordsCacheKey(uid);
    const savedAt = new Date().toISOString();
    target.localStorage?.setItem(cacheKey, JSON.stringify({
      saved_at: savedAt,
      records
    }));
    target.localStorage?.setItem(USER_RECORDS_ACTIVE_CACHE_KEY, cacheKey);
    return {
      savedAt,
      expiresAt: new Date(Date.parse(savedAt) + USER_RECORDS_CACHE_TTL_MS).toISOString()
    };
  } catch {
    return { savedAt: '', expiresAt: '' };
  }
}

export function createDataSdkService({ auth, db, target = window, auditService = null } = {}) {
  let unsubscribeRecords = null;
  let unsubscribeSharedMacros = null;
  let unsubscribeSharedCategories = null;
  let unsubscribeLocalStorageSync = null;
  let latestUserRecords = [];
  let latestSharedMacros = [];
  let latestSharedCategories = [];
  let localStorageSyncMigrated = false;
  let localStorageSnapshotApplied = false;
  let combinedRecordsEmitTimer = 0;

  const getUserCollection = (uid) => collection(db, 'users', uid, 'finance_records');
  const getUserDoc = (uid, id) => doc(db, 'users', uid, 'finance_records', id);
  const getUserLocalStorageCollection = (uid) => collection(db, 'users', uid, 'local_storage');
  const getUserLocalStorageDoc = (uid, key) => doc(db, 'users', uid, 'local_storage', encodeURIComponent(key));
  const getSharedMacrosCollection = () => collection(db, 'shared_macros');
  const getSharedMacroDoc = (id) => doc(db, 'shared_macros', id);
  const getSharedCategoriesCollection = () => collection(db, 'shared_categories');
  const getSharedCategoryDoc = (id) => doc(db, 'shared_categories', id);

  function auditWrite(operation, record, result = { isOk: true }, extra = {}) {
    if (!auditService?.logLater) return;
    const action = classifyFinanceRecordAuditAction(operation, record);
    auditService.logLater(action, {
      operation,
      result: result?.isOk === false ? 'error' : 'success',
      error: result?.error || '',
      ...summarizeFinanceRecord(record),
      ...extra
    }, {
      status: result?.isOk === false ? 'error' : 'success'
    });
  }

  function setLocalStorageFromCloud(key, value) {
    if (!shouldSyncLocalStorageKey(key)) return false;
    const nextValue = String(value ?? '');
    if (localStorage.getItem(key) === nextValue) return false;
    target.__cloudLocalStorageApplying = true;
    try {
      target.__financeCloudSetMemoryStorage?.(key, nextValue);
      localStorage.setItem(key, nextValue);
    } finally {
      target.__cloudLocalStorageApplying = false;
    }
    return true;
  }

  function removeLocalStorageFromCloud(key) {
    if (!shouldSyncLocalStorageKey(key) || localStorage.getItem(key) === null) return false;
    target.__cloudLocalStorageApplying = true;
    try {
      target.__financeCloudRemoveMemoryStorage?.(key);
      localStorage.removeItem(key);
    } finally {
      target.__cloudLocalStorageApplying = false;
    }
    return true;
  }

  async function saveLocalStorageKeyToCloud(key, value) {
    const user = auth.currentUser;
    if (!user || !shouldSyncLocalStorageKey(key)) return;
    await setDoc(getUserLocalStorageDoc(user.uid, key), {
      key,
      value: String(value ?? ''),
      updated_at: new Date().toISOString(),
      owner_uid: user.uid,
      owner_email: user.email || ''
    }, { merge: true });
  }

  async function deleteLocalStorageKeyFromCloud(key) {
    const user = auth.currentUser;
    if (!user || !shouldSyncLocalStorageKey(key)) return;
    await deleteDoc(getUserLocalStorageDoc(user.uid, key));
  }

  async function migrateLocalStorageToCloud(user) {
    if (localStorageSyncMigrated || !user) return;
    localStorageSyncMigrated = true;
    const entries = typeof target.__financeCloudLocalEntries === 'function'
      ? target.__financeCloudLocalEntries()
      : [];
    await Promise.all(entries.map(([key, value]) => saveLocalStorageKeyToCloud(key, value)));
  }

  function maybeReloadAfterCloudLocalStorageApply(changed) {
    if (!changed) return;
    if (sessionStorage.getItem(CLOUD_LOCAL_STORAGE_RELOAD_FLAG) === '1') return;
    sessionStorage.setItem(CLOUD_LOCAL_STORAGE_RELOAD_FLAG, '1');
    target.dispatchEvent?.(new CustomEvent('cloudLocalStorageApplied', {
      detail: {
        changed: true,
        source: 'firebase'
      }
    }));
  }

  function installLocalStorageCloudSyncPatch() {
    if (target.__cloudLocalStorageVirtualInstalled) {
      target.__cloudLocalStorageSyncInstalled = true;
      return;
    }
    if (target.__cloudLocalStorageSyncInstalled) return;
    target.__cloudLocalStorageSyncInstalled = true;
    const nativeSetItem = Storage.prototype.setItem;
    const nativeRemoveItem = Storage.prototype.removeItem;

    Storage.prototype.setItem = function (key, value) {
      nativeSetItem.call(this, key, value);
      if (this === target.localStorage && !target.__cloudLocalStorageApplying && shouldSyncLocalStorageKey(String(key))) {
        target.cloudLocalStorageSync?.set?.(String(key), String(value ?? ''));
      }
    };

    Storage.prototype.removeItem = function (key) {
      nativeRemoveItem.call(this, key);
      if (this === target.localStorage && !target.__cloudLocalStorageApplying && shouldSyncLocalStorageKey(String(key))) {
        target.cloudLocalStorageSync?.remove?.(String(key));
      }
    };
  }

  function emitCombinedRecords(dataHandler) {
    const macroKeys = new Set();
    const categoryKeys = new Set();
    const combined = [];

    latestSharedMacros.forEach((record) => {
      const key = String(record.macro_category || '').trim().toLowerCase();
      macroKeys.add(key);
      combined.push(record);
    });

    latestSharedCategories.forEach((record) => {
      const key = `${String(record.macro_category || '').trim().toLowerCase()}|${String(record.category_name || '').trim().toLowerCase()}`;
      categoryKeys.add(key);
      combined.push(record);
    });

    latestUserRecords.forEach((record) => {
      if (record?.type === 'macro') {
        const key = String(record.macro_category || '').trim().toLowerCase();
        if (!macroKeys.has(key)) combined.push(record);
        return;
      }

      if (record?.type !== 'categoria') {
        combined.push(record);
        return;
      }

      const key = `${String(record.macro_category || '').trim().toLowerCase()}|${String(record.category_name || '').trim().toLowerCase()}`;
      if (!categoryKeys.has(key)) combined.push(record);
    });

    dataHandler.onDataChanged(combined);
  }

  function scheduleCombinedRecordsEmit(dataHandler) {
    if (combinedRecordsEmitTimer) return;
    combinedRecordsEmitTimer = (target.setTimeout || setTimeout)(() => {
      combinedRecordsEmitTimer = 0;
      emitCombinedRecords(dataHandler);
    }, 0);
  }

  function findKnownRecordById(id) {
    if (!id) return null;
    return [
      ...latestUserRecords,
      ...latestSharedMacros,
      ...latestSharedCategories
    ].find((record) => record?.id === id) || null;
  }

  function assertPersistableFinanceRecord(record, context = {}) {
    const validation = validateFinanceRecord(record, {
      requireOwner: true,
      ...context
    });
    if (!validation.isValid) {
      const error = new Error('FINANCE_RECORD_CONTRACT_INVALID');
      error.code = 'FINANCE_RECORD_CONTRACT_INVALID';
      error.validation = validation;
      throw error;
    }
    return validation;
  }

  async function ensureDefaultSharedReferences(user) {
    if (!await hasAdminAuthority(user, target)) return;
    const ownerUid = user?.uid || '';
    const ownerEmail = user?.email || '';

    await Promise.all(DEFAULT_SHARED_MACROS.map(async (macroName) => {
      const docId = `macro_${slugifySharedId(macroName)}`;
      await setDoc(getSharedMacroDoc(docId), {
        type: 'macro',
        person: '',
        macro_category: macroName,
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
        shared_scope: 'global',
        owner_uid: ownerUid,
        owner_email: ownerEmail,
        ...getSharedRecordDefaults()
      }, { merge: true });
    }));

    await Promise.all(DEFAULT_SHARED_CATEGORIES.map(async (category) => {
      const docId = `cat_${slugifySharedId(category.macro)}_${slugifySharedId(category.name)}`;
      await setDoc(getSharedCategoryDoc(docId), {
        type: 'categoria',
        person: '',
        macro_category: category.macro,
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
        category_id: docId,
        category_name: category.name,
        category_color: category.color,
        category_icon: category.icon,
        shared_scope: 'global',
        owner_uid: ownerUid,
        owner_email: ownerEmail,
        ...getSharedRecordDefaults()
      }, { merge: true });
    }));
  }

  async function batchDeleteRecords(uid, records, batchSize = 200) {
    for (let index = 0; index < records.length; index += batchSize) {
      const chunk = records.slice(index, index + batchSize);
      const batch = writeBatch(db);
      chunk.forEach((record) => {
        if (!record?.id) return;
        batch.delete(getUserDoc(uid, record.id));
      });
      await batch.commit();
    }
  }

  function cleanupOnSignOut() {
    if (combinedRecordsEmitTimer) {
      (target.clearTimeout || clearTimeout)(combinedRecordsEmitTimer);
      combinedRecordsEmitTimer = 0;
    }
    if (unsubscribeRecords) unsubscribeRecords();
    if (unsubscribeSharedMacros) unsubscribeSharedMacros();
    if (unsubscribeSharedCategories) unsubscribeSharedCategories();
    if (unsubscribeLocalStorageSync) unsubscribeLocalStorageSync();
    unsubscribeRecords = null;
    unsubscribeSharedMacros = null;
    unsubscribeSharedCategories = null;
    unsubscribeLocalStorageSync = null;
    latestUserRecords = [];
    latestSharedMacros = [];
    latestSharedCategories = [];
    localStorageSyncMigrated = false;
    localStorageSnapshotApplied = false;
    clearUserScopedLocalData(target);
    setFinanceCacheState(target, {
      source: 'logout',
      uid: '',
      savedAt: '',
      expiresAt: '',
      cached: false,
      recordCount: 0,
      expired: false
    });
  }

  const cloudLocalStorageSync = {
    set: (key, value) => saveLocalStorageKeyToCloud(key, value).catch((error) => console.error('Erro ao sincronizar localStorage', error)),
    remove: (key) => deleteLocalStorageKeyFromCloud(key).catch((error) => console.error('Erro ao remover localStorage na nuvem', error)),
    migrate: () => migrateLocalStorageToCloud(auth.currentUser).catch((error) => console.error('Erro ao migrar localStorage', error))
  };

  const dataSdk = {
    init: async (dataHandler) => {
      const user = auth.currentUser;
      if (!user) return { isOk: false, error: 'AUTH_REQUIRED' };

      cleanupOnSignOut();

      const cachedUserRecords = readCachedUserRecords(target, user.uid);
      if (cachedUserRecords.records.length) {
        latestUserRecords = cachedUserRecords.records;
        setFinanceCacheState(target, {
          source: 'local-cache',
          uid: user.uid,
          savedAt: cachedUserRecords.savedAt,
          expiresAt: cachedUserRecords.expiresAt,
          cached: true,
          recordCount: cachedUserRecords.records.length,
          expired: false
        });
        emitCombinedRecords(dataHandler);
      } else {
        setFinanceCacheState(target, {
          source: 'firebase-pending',
          uid: user.uid,
          savedAt: '',
          expiresAt: '',
          cached: false,
          recordCount: 0,
          expired: cachedUserRecords.expired
        });
      }

      unsubscribeRecords = onSnapshot(getUserCollection(user.uid), (snapshot) => {
        latestUserRecords = snapshot.docs.map((recordDoc) => ({ id: recordDoc.id, ...recordDoc.data() }));
        const cacheInfo = writeCachedUserRecords(target, user.uid, latestUserRecords);
        setFinanceCacheState(target, {
          source: 'firebase',
          uid: user.uid,
          savedAt: cacheInfo.savedAt,
          expiresAt: cacheInfo.expiresAt,
          cached: false,
          recordCount: latestUserRecords.length,
          expired: false
        });
        scheduleCombinedRecordsEmit(dataHandler);
      });

      unsubscribeSharedMacros = onSnapshot(getSharedMacrosCollection(), (snapshot) => {
        latestSharedMacros = snapshot.docs.map((recordDoc) => ({ id: recordDoc.id, ...recordDoc.data(), shared_scope: 'global' }));
        scheduleCombinedRecordsEmit(dataHandler);
      });

      unsubscribeSharedCategories = onSnapshot(getSharedCategoriesCollection(), (snapshot) => {
        latestSharedCategories = snapshot.docs.map((recordDoc) => ({ id: recordDoc.id, ...recordDoc.data(), shared_scope: 'global' }));
        scheduleCombinedRecordsEmit(dataHandler);
      });

      unsubscribeLocalStorageSync = onSnapshot(getUserLocalStorageCollection(user.uid), (snapshot) => {
        let changedLocalStorage = false;
        snapshot.docChanges().forEach((change) => {
          const data = change.doc.data() || {};
          const key = data.key || decodeURIComponent(change.doc.id);
          if (!shouldSyncLocalStorageKey(key)) return;
          if (change.type === 'removed') {
            changedLocalStorage = removeLocalStorageFromCloud(key) || changedLocalStorage;
            return;
          }
          changedLocalStorage = setLocalStorageFromCloud(key, data.value ?? '') || changedLocalStorage;
        });

        migrateLocalStorageToCloud(user).catch((error) => console.error('Erro ao migrar localStorage', error));
        const isFirstLocalStorageSnapshot = !localStorageSnapshotApplied;
        localStorageSnapshotApplied = true;
        target.dispatchEvent(new CustomEvent('cloudLocalStorageChanged', { detail: { changed: changedLocalStorage } }));
        if (isFirstLocalStorageSnapshot) maybeReloadAfterCloudLocalStorageApply(changedLocalStorage);
      });

      ensureDefaultSharedReferences(user).catch((error) => {
        console.warn('Referencias globais nao foram inicializadas; acesso administrativo pode ser necessario.', error);
      });

      return { isOk: true };
    },
    create: async (record) => {
      try {
        const user = auth.currentUser;
        if (!user) throw new Error('AUTH_REQUIRED');
        const safeRecord = sanitizeFirestoreRecord(record);

        if (safeRecord?.type === 'macro' && isGlobalReference(safeRecord)) {
          const normalized = normalizeReferenceRecord(safeRecord, { defaultScope: REFERENCE_SCOPES.GLOBAL, user });
          assertPersistableFinanceRecord(normalized, { operation: 'create' });
          const docRef = await addDoc(getSharedMacrosCollection(), {
            ...normalized,
            shared_scope: 'global',
            owner_uid: normalized.owner_uid || user.uid,
            owner_email: normalized.owner_email || user.email || ''
          });
          auditWrite('create', { ...safeRecord, id: docRef.id }, { isOk: true, id: docRef.id });
          return { isOk: true, id: docRef.id };
        }
        if (safeRecord?.type === 'categoria' && isGlobalReference(safeRecord)) {
          const normalized = normalizeReferenceRecord(safeRecord, { defaultScope: REFERENCE_SCOPES.GLOBAL, user });
          assertPersistableFinanceRecord(normalized, { operation: 'create' });
          const docRef = await addDoc(getSharedCategoriesCollection(), {
            ...normalized,
            shared_scope: 'global',
            owner_uid: normalized.owner_uid || user.uid,
            owner_email: normalized.owner_email || user.email || ''
          });
          auditWrite('create', { ...safeRecord, id: docRef.id }, { isOk: true, id: docRef.id });
          return { isOk: true, id: docRef.id };
        }

        const personalRecord = isPersonalReference(safeRecord) || safeRecord?.type === 'macro' || safeRecord?.type === 'categoria'
          ? normalizeReferenceRecord(safeRecord, { defaultScope: REFERENCE_SCOPES.PERSONAL, user })
          : safeRecord;
        const persistable = {
          ...personalRecord,
          owner_uid: user.uid,
          owner_email: user.email || ''
        };
        assertPersistableFinanceRecord(persistable, { operation: 'create', existingRecords: latestUserRecords });
        const docRef = await addDoc(getUserCollection(user.uid), persistable);
        auditWrite('create', { ...safeRecord, id: docRef.id }, { isOk: true, id: docRef.id });
        return { isOk: true, id: docRef.id };
      } catch (e) {
        console.error(e);
        auditWrite('create', record || {}, { isOk: false, error: e.message });
        if (e.code === 'FINANCE_RECORD_CONTRACT_INVALID') return contractFailure(e.validation);
        return { isOk: false, error: e.message };
      }
    },
    createMany: async (records = []) => {
      try {
        const user = auth.currentUser;
        if (!user) throw new Error('AUTH_REQUIRED');
        if (!Array.isArray(records) || records.length === 0) {
          throw new Error('Registros devem ser uma lista nao vazia');
        }

        const prepared = records.map((record) => {
          const safeRecord = sanitizeFirestoreRecord(record);
          if (isGlobalReference(safeRecord)) {
            throw new Error('CREATE_MANY_GLOBAL_REFERENCE_NOT_SUPPORTED');
          }
          const personalRecord = isPersonalReference(safeRecord) || safeRecord?.type === 'macro' || safeRecord?.type === 'categoria'
            ? normalizeReferenceRecord(safeRecord, { defaultScope: REFERENCE_SCOPES.PERSONAL, user })
            : safeRecord;
          const persistable = {
            ...personalRecord,
            owner_uid: user.uid,
            owner_email: user.email || ''
          };
          assertPersistableFinanceRecord(persistable, { operation: 'create', existingRecords: latestUserRecords });
          return persistable;
        });

        const batch = writeBatch(db);
        const refs = prepared.map(() => doc(getUserCollection(user.uid)));
        prepared.forEach((record, index) => {
          batch.set(refs[index], record);
        });
        await batch.commit();
        const ids = refs.map((ref) => ref.id);
        prepared.forEach((record, index) => {
          auditWrite('create', { ...record, id: ids[index] }, { isOk: true, id: ids[index] }, { batch: true });
        });
        return { isOk: true, ids, count: ids.length };
      } catch (e) {
        console.error(e);
        if (e.code === 'FINANCE_RECORD_CONTRACT_INVALID') return contractFailure(e.validation);
        auditWrite('create', { type: 'batch' }, { isOk: false, error: e.message }, { batch: true });
        return { isOk: false, error: e.message };
      }
    },
    createIfAbsent: async (record = {}) => {
      try {
        const user = auth.currentUser;
        const safeRecord = sanitizeFirestoreRecord(record);
        const { id, ...data } = safeRecord;
        if (!user) throw new Error('AUTH_REQUIRED');
        if (!id) throw new Error('Documento precisa de um ID deterministico');
        const persistable = {
          ...data,
          owner_uid: user.uid,
          owner_email: user.email || ''
        };
        assertPersistableFinanceRecord({ ...persistable, id }, { operation: 'create', existingRecords: latestUserRecords });
        const ref = getUserDoc(user.uid, id);
        const txResult = await runTransaction(db, async (transaction) => {
          const snapshot = await transaction.get(ref);
          if (snapshot.exists()) return { alreadyExists: true, data: snapshot.data() };
          transaction.set(ref, persistable);
          return { created: true };
        });
        if (txResult.alreadyExists) {
          return { isOk: false, error: 'ALREADY_EXISTS', id, data: txResult.data };
        }
        auditWrite('create', { ...safeRecord, id }, { isOk: true, id });
        return { isOk: true, id, data: { ...persistable, id } };
      } catch (e) {
        console.error(e);
        auditWrite('create', record || {}, { isOk: false, error: e.message });
        if (e.code === 'FINANCE_RECORD_CONTRACT_INVALID') return contractFailure(e.validation);
        return { isOk: false, error: e.message };
      }
    },
    update: async (record) => {
      try {
        const user = auth.currentUser;
        const safeRecord = sanitizeFirestoreRecord(record);
        const { id, ...data } = safeRecord;
        if (!user) throw new Error('AUTH_REQUIRED');
        if (!id) throw new Error('Documento precisa de um ID');
        if (safeRecord.owner_uid && safeRecord.owner_uid !== user.uid && !isGlobalReference(safeRecord)) {
          const validation = validateFinanceRecord(safeRecord, { requireOwner: true });
          validation.errors.push({
            field: 'owner_uid',
            code: 'OWNER_IMMUTABLE',
            message: 'owner_uid nao pode ser alterado.',
            severity: 'error'
          });
          return contractFailure(validation);
        }
        const currentRecord = findKnownRecordById(id);
        if (isSharedMacroRecord(safeRecord)) {
          const payload = {
            ...data,
            shared_scope: 'global',
            owner_uid: data.owner_uid || currentRecord?.owner_uid || user.uid,
            owner_email: data.owner_email || currentRecord?.owner_email || user.email || ''
          };
          assertPersistableFinanceRecord({ ...payload, id }, { operation: 'update', currentRecord });
          await updateDoc(getSharedMacroDoc(id), payload);
        } else if (isSharedCategoryRecord(safeRecord)) {
          const payload = {
            ...data,
            shared_scope: 'global',
            owner_uid: data.owner_uid || currentRecord?.owner_uid || user.uid,
            owner_email: data.owner_email || currentRecord?.owner_email || user.email || ''
          };
          assertPersistableFinanceRecord({ ...payload, id }, { operation: 'update', currentRecord });
          await updateDoc(getSharedCategoryDoc(id), payload);
        } else {
          const nextData = isReferenceRecord(safeRecord)
            ? {
                ...normalizeReferenceRecord({ ...data, id }, { defaultScope: REFERENCE_SCOPES.PERSONAL, user }),
                owner_uid: user.uid,
                owner_email: user.email || ''
              }
            : {
                ...data,
                owner_uid: data.owner_uid || user.uid,
                owner_email: data.owner_email || user.email || ''
              };
          assertPersistableFinanceRecord({ ...nextData, id }, { operation: 'update', currentRecord, existingRecords: latestUserRecords });
          const { id: _ignoredId, ...personalData } = nextData;
          await updateDoc(getUserDoc(user.uid, id), personalData);
        }
        auditWrite('update', safeRecord, { isOk: true });
        return { isOk: true };
      } catch (e) {
        console.error(e);
        auditWrite('update', record || {}, { isOk: false, error: e.message });
        if (e.code === 'FINANCE_RECORD_CONTRACT_INVALID') return contractFailure(e.validation);
        return { isOk: false, error: e.message };
      }
    },
    upsert: async (record) => {
      try {
        const user = auth.currentUser;
        const safeRecord = sanitizeFirestoreRecord(record);
        const { id, ...data } = safeRecord;
        if (!user) throw new Error('AUTH_REQUIRED');
        if (!id) throw new Error('Documento precisa de um ID');
        const persistable = {
          ...data,
          owner_uid: user.uid,
          owner_email: user.email || ''
        };
        const currentRecord = findKnownRecordById(id);
        assertPersistableFinanceRecord({ ...persistable, id }, { operation: currentRecord ? 'update' : 'create', currentRecord, existingRecords: latestUserRecords });
        await setDoc(getUserDoc(user.uid, id), persistable, { merge: true });
        auditWrite('upsert', safeRecord, { isOk: true, id });
        return { isOk: true, id };
      } catch (e) {
        console.error(e);
        auditWrite('upsert', record || {}, { isOk: false, error: e.message });
        if (e.code === 'FINANCE_RECORD_CONTRACT_INVALID') return contractFailure(e.validation);
        return { isOk: false, error: e.message };
      }
    },
    delete: async (record) => {
      try {
        const user = auth.currentUser;
        if (!user) throw new Error('AUTH_REQUIRED');
        if (!record.id) throw new Error('Documento precisa de um ID');
        if (isReferenceRecord(record) && isReferenceInUse(record, latestUserRecords)) {
          throw new Error('REFERENCE_IN_USE');
        }
        if (isSharedMacroRecord(record)) {
          await deleteDoc(getSharedMacroDoc(record.id));
        } else if (isSharedCategoryRecord(record)) {
          await deleteDoc(getSharedCategoryDoc(record.id));
        } else {
          await deleteDoc(getUserDoc(user.uid, record.id));
        }
        auditWrite('delete', record, { isOk: true });
        return { isOk: true };
      } catch (e) {
        console.error(e);
        auditWrite('delete', record || {}, { isOk: false, error: e.message });
        return { isOk: false, error: e.message };
      }
    }
  };

  installLocalStorageCloudSyncPatch();

  return {
    dataSdk,
    cloudLocalStorageSync,
    batchDeleteRecords,
    cleanupOnSignOut
  };
}
