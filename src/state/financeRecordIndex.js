const TRANSACTION_TYPES = new Set(['entrada', 'saida']);

let cachedIndex = null;
let cachedRecords = null;
let cachedSignature = '';

function addToMapList(map, key, record) {
  const normalizedKey = String(key ?? '');
  if (!map.has(normalizedKey)) map.set(normalizedKey, []);
  map.get(normalizedKey).push(record);
}

function getRecordCompetence(record = {}) {
  return String(record.competence || record.due_date || record.occurred_date || '').slice(0, 7);
}

function getRecordsSignature(records = [], version = 0) {
  const first = records[0]?.id || '';
  const last = records[records.length - 1]?.id || '';
  return `${version}|${records.length}|${first}|${last}`;
}

function intersectById(left = [], right = []) {
  if (left.length <= right.length) {
    const ids = new Set(left.map((record) => record?.id).filter(Boolean));
    return right.filter((record) => record?.id ? ids.has(record.id) : left.includes(record));
  }
  return intersectById(right, left);
}

function chooseIndexedBase(index, filters = {}) {
  const candidates = [];
  if (filters.type) candidates.push(index.byType.get(String(filters.type)) || []);
  if (filters.person) candidates.push(index.byPerson.get(String(filters.person)) || []);
  if (filters.status) candidates.push(index.byStatus.get(String(filters.status)) || []);
  if (filters.competence) candidates.push(index.byCompetence.get(String(filters.competence)) || []);

  if (!candidates.length) return index.records;
  candidates.sort((a, b) => a.length - b.length);
  return candidates.reduce((base, next) => intersectById(base, next));
}

function matchesArchiveMode(record, archiveMode = 'all') {
  if (archiveMode === 'active') return record?.archived !== true;
  if (archiveMode === 'archived') return record?.archived === true;
  return true;
}

function matchesFilters(record, filters = {}) {
  if (filters.transactionOnly && !TRANSACTION_TYPES.has(record?.type)) return false;
  if (filters.type && record?.type !== filters.type) return false;
  if (filters.person && record?.person !== filters.person) return false;
  if (filters.status && record?.status !== filters.status) return false;
  if (filters.macro && record?.macro_category !== filters.macro) return false;
  if (filters.cycle && record?.cycle !== filters.cycle) return false;
  if (!matchesArchiveMode(record, filters.archiveMode || 'all')) return false;

  const competence = getRecordCompetence(record);
  if (filters.competence && competence !== filters.competence) return false;
  if (filters.competenceStart && competence < filters.competenceStart) return false;
  if (filters.competenceEnd && competence > filters.competenceEnd) return false;

  return true;
}

function getQueryKey(filters = {}) {
  return JSON.stringify({
    transactionOnly: Boolean(filters.transactionOnly),
    type: filters.type || '',
    person: filters.person || '',
    status: filters.status || '',
    macro: filters.macro || '',
    cycle: filters.cycle || '',
    archiveMode: filters.archiveMode || 'all',
    competence: filters.competence || '',
    competenceStart: filters.competenceStart || '',
    competenceEnd: filters.competenceEnd || ''
  });
}

export function createFinanceRecordIndex(records = [], options = {}) {
  const safeRecords = Array.isArray(records) ? records : [];
  const index = {
    records: safeRecords,
    version: options.version || 0,
    byType: new Map(),
    byCompetence: new Map(),
    byPerson: new Map(),
    byStatus: new Map(),
    queryCache: new Map()
  };

  safeRecords.forEach((record) => {
    addToMapList(index.byType, record?.type, record);
    addToMapList(index.byCompetence, getRecordCompetence(record), record);
    addToMapList(index.byPerson, record?.person, record);
    addToMapList(index.byStatus, record?.status, record);
  });

  return index;
}

export function getFinanceRecordIndex(records = [], options = {}) {
  const version = options.version || 0;
  const signature = getRecordsSignature(records, version);
  if (cachedIndex && cachedRecords === records && cachedSignature === signature) return cachedIndex;

  cachedRecords = records;
  cachedSignature = signature;
  cachedIndex = createFinanceRecordIndex(records, { version });
  return cachedIndex;
}

export function queryFinanceRecords(index, filters = {}) {
  if (!index) return [];
  const queryKey = getQueryKey(filters);
  if (index.queryCache.has(queryKey)) return index.queryCache.get(queryKey);

  const base = chooseIndexedBase(index, filters);
  const result = base.filter((record) => matchesFilters(record, filters));
  index.queryCache.set(queryKey, result);
  return result;
}

export function getFinanceRecordIndexForTarget(target = globalThis) {
  const records = Array.isArray(target?.allRecords) ? target.allRecords : [];
  return getFinanceRecordIndex(records, { version: target?.__financeDataVersion || 0 });
}

export function queryFinanceRecordsForTarget(filters = {}, target = globalThis) {
  return queryFinanceRecords(getFinanceRecordIndexForTarget(target), filters);
}

export function installFinanceRecordIndexGlobals(target = globalThis) {
  Object.assign(target, {
    createFinanceRecordIndex,
    getFinanceRecordIndex: () => getFinanceRecordIndexForTarget(target),
    getFinanceRecordsByType: (type) => queryFinanceRecordsForTarget({ type }, target),
    queryFinanceRecords: (filters = {}) => queryFinanceRecordsForTarget(filters, target)
  });
}
