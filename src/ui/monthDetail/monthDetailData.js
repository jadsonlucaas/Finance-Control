import { normalizeCompetenceKey } from '../../core/dates.js';

const monthlyDetailCache = {
  filteredRecords: { key: '', value: [] },
  consolidatedEntradas: { key: '', value: [] },
  viewModel: { key: '', value: null }
};

function getMonthlyDetailDataVersion(target = window) {
  return target.__financeDataVersion || 0;
}

function setMonthlyDetailCache(bucket, key, factory) {
  const entry = monthlyDetailCache[bucket];
  if (entry && entry.key === key && entry.value) return entry.value;
  const value = factory();
  if (entry) {
    entry.key = key;
    entry.value = value;
  }
  return value;
}

function getMonthlyDetailRecordKey(record = {}) {
  if (record?.id) return `id:${record.id}`;
  return [
    record?.type || '',
    record?.person || '',
    record?.competence || '',
    record?.description || '',
    record?.subcategory || '',
    record?.amount || 0,
    record?.status || '',
    record?.cycle || ''
  ].join('|');
}

function mergeMonthlyDetailRecords(baseRecords = [], extraRecords = []) {
  const merged = new Map();
  [...baseRecords, ...extraRecords].forEach((record) => {
    if (!record) return;
    merged.set(getMonthlyDetailRecordKey(record), record);
  });
  return [...merged.values()];
}

function getMonthlyDetailOfficialSaidas(competence, target = window) {
  const normalizedCompetence = normalizeCompetenceKey(competence);
  if (!normalizedCompetence || typeof target.getDashboardBaseSaidas !== 'function') return [];

  try {
    return target.getDashboardBaseSaidas()
      .filter((record) => normalizeCompetenceKey(record?.competence || '') === normalizedCompetence);
  } catch (error) {
    console.warn('Falha ao reutilizar saidas oficiais do dashboard no detalhe mensal', error);
    return [];
  }
}

export function getMonthlyDetailFilteredRecords(competence, target = window) {
  const normalizedCompetence = normalizeCompetenceKey(competence);
  if (!normalizedCompetence || typeof target.getTransactionRecords !== 'function') return [];

  const person = target.document?.getElementById('f-person')?.value || '';
  const macro = target.document?.getElementById('f-macro')?.value || '';
  const cycle = target.document?.getElementById('f-cycle')?.value || '';
  const cacheKey = JSON.stringify({
    v: getMonthlyDetailDataVersion(target),
    competence: normalizedCompetence,
    person,
    macro,
    cycle
  });

  return setMonthlyDetailCache('filteredRecords', cacheKey, () => {
    const transactionRecords = target.getTransactionRecords({
      archiveMode: 'active',
      competenceStart: normalizedCompetence,
      competenceEnd: normalizedCompetence,
      person,
      macro,
      cycle
    }).filter((record) => record.competence === normalizedCompetence);

    const officialSaidas = getMonthlyDetailOfficialSaidas(normalizedCompetence, target);
    return mergeMonthlyDetailRecords(transactionRecords, officialSaidas);
  });
}

function fallbackFinancialEntradaRecords(competence, target = window) {
  const isFinancialEntradaRecord = typeof target.isFinancialEntradaRecord === 'function'
    ? target.isFinancialEntradaRecord
    : (record) => record?.type === 'entrada' && record?.macro_category !== 'Referência Salarial';

  return getMonthlyDetailFilteredRecords(competence, target)
    .filter((record) => record.type === 'entrada' && isFinancialEntradaRecord(record))
    .map((record) => ({
      ...record,
      cardLiquido: record.macro_category === 'Dedução'
        ? -(Number(record.amount) || 0)
        : Number(record.amount) || 0
    }));
}

export function getMonthlyDetailConsolidatedEntradas(competence, target = window) {
  const normalizedCompetence = normalizeCompetenceKey(competence);
  const selectedPerson = target.document?.getElementById('f-person')?.value || '';

  if (!normalizedCompetence) return [];
  const cacheKey = JSON.stringify({
    v: getMonthlyDetailDataVersion(target),
    competence: normalizedCompetence,
    person: selectedPerson
  });

  return setMonthlyDetailCache('consolidatedEntradas', cacheKey, () => {
    if (typeof target.getDashboardBaseEntradas === 'function') {
      try {
        const entries = target.getDashboardBaseEntradas()
          .filter((entry) => normalizeCompetenceKey(entry.competencia || entry.competence || '') === normalizedCompetence)
          .filter((entry) => !selectedPerson || entry.person === selectedPerson);
        if (entries.length) return entries;
      } catch (error) {
        console.warn('Falha ao reutilizar entradas consolidadas do dashboard no detalhe mensal', error);
      }
    }

    if (
      typeof target.getPeopleRecords !== 'function'
      || typeof target.consolidarEntradaMensal !== 'function'
      || typeof target.mapEntradaToCycleView !== 'function'
    ) {
      return fallbackFinancialEntradaRecords(normalizedCompetence, target);
    }

    const getEntryValue = target.financeMonthlyDetailSelectors?.getMonthlyDetailEntradaValue
      || ((entry) => Number(entry.cardLiquido ?? entry.liquido ?? entry.amount ?? 0) || 0);

    return target.getPeopleRecords()
      .filter((personRecord) => {
        const personName = personRecord.person || '';
        return personName && (!selectedPerson || personName === selectedPerson);
      })
      .flatMap((personRecord) => {
        const consolidated = target.consolidarEntradaMensal(personRecord.person, normalizedCompetence);
        if (!consolidated) return [];
        return [
          target.mapEntradaToCycleView(consolidated, 'INICIO_MES'),
          target.mapEntradaToCycleView(consolidated, 'QUINZENA')
        ];
      })
      .filter(Boolean)
      .filter((entry) => {
        const value = getEntryValue(entry);
        return value !== 0
          || Number(entry.salaryBase || 0) > 0
          || Number(entry.hourExtra || 0) > 0
          || Number(entry.outrosProventos || 0) > 0
          || Number(entry.outrosDescontos || 0) > 0
          || Number(entry.inss || 0) > 0
          || Number(entry.irrf || 0) > 0;
      });
  });
}

export function buildMonthlyDetailViewModel(competence, target = window) {
  const normalizedCompetence = normalizeCompetenceKey(competence);
  const person = target.document?.getElementById('f-person')?.value || '';
  const macro = target.document?.getElementById('f-macro')?.value || '';
  const cycle = target.document?.getElementById('f-cycle')?.value || '';
  const cacheKey = JSON.stringify({
    v: getMonthlyDetailDataVersion(target),
    competence: normalizedCompetence,
    person,
    macro,
    cycle
  });

  return setMonthlyDetailCache('viewModel', cacheKey, () => {
    const records = getMonthlyDetailFilteredRecords(normalizedCompetence, target);
    const consolidatedEntradas = getMonthlyDetailConsolidatedEntradas(normalizedCompetence, target);
    return target.financeMonthlyDetailSelectors.selectMonthlyDetail({
      competence: normalizedCompetence,
      records,
      consolidatedEntradas
    });
  });
}
