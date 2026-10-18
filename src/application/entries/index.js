import { consolidatePersonMonthlyEntry, getConsolidatedMonthlyEntries } from './consolidatePersonMonthlyEntry.js';
import { getEntryCycleViews, mapEntryToCycleView } from './getEntryCycleViews.js';
import {
  getEntryDiscountAdjustmentRecord,
  getEntryDiscountHistoryItems,
  getEntryDiscountHistoryTotal,
  getEntryDiscountRecordTotal,
  getEntryPeriodDiscountRecords,
  isDeductionLikeMacro,
  normalizeEntryDiscountCycle
} from './getEntryDiscountHistory.js';

export {
  consolidatePersonMonthlyEntry,
  getConsolidatedMonthlyEntries,
  getEntryCycleViews,
  mapEntryToCycleView,
  getEntryDiscountAdjustmentRecord,
  getEntryDiscountHistoryItems,
  getEntryDiscountHistoryTotal,
  getEntryDiscountRecordTotal,
  getEntryPeriodDiscountRecords,
  isDeductionLikeMacro,
  normalizeEntryDiscountCycle
};

export function installEntryApplicationGlobals(target = globalThis) {
  const getRecords = () => target.allRecords || [];

  target.consolidarEntradaMensal = function consolidarEntradaMensal(person = '', competencia = '') {
    return consolidatePersonMonthlyEntry(person, competencia, {
      target,
      records: getRecords()
    });
  };

  target.mapEntradaToCycleView = function mapEntradaToCycleView(entry = {}, cycleFilter = 'INICIO_MES') {
    return mapEntryToCycleView(entry, cycleFilter, {
      records: getRecords()
    });
  };

  target.getEntradasConsolidadas = function getEntradasConsolidadas() {
    const archiveMode = target.listArchiveFilters?.entradas || 'active';
    const searchTerm = typeof target.normalizeListSearchValue === 'function'
      ? target.normalizeListSearchValue(target.listSearchFilters?.entradas || '')
      : String(target.listSearchFilters?.entradas || '').trim().toLowerCase();
    const competenceFilter = target.document?.getElementById('entradas-competence-filter')?.value || '';

    return getConsolidatedMonthlyEntries({
      records: getRecords(),
      target,
      competenceFilter,
      archiveMode,
      searchTerm,
      normalizeSearch: typeof target.normalizeListSearchValue === 'function'
        ? target.normalizeListSearchValue
        : (value) => String(value || '').trim().toLowerCase(),
      isArchived: typeof target.isArchivedRecord === 'function'
        ? target.isArchivedRecord
        : (record) => Boolean(record?.archived)
    });
  };

  Object.assign(target, {
    getEntryCycleViews,
    getEntryDiscountAdjustmentRecord: function getEntryDiscountAdjustmentRecordGlobal(person = '', competencia = '', cycle = 'INICIO_MES') {
      return getEntryDiscountAdjustmentRecord(getRecords(), person, competencia, cycle);
    },
    getEntryDiscountHistoryItems,
    getEntryDiscountHistoryTotal,
    getEntryDiscountRecordTotal,
    getEntryPeriodDiscountRecords: function getEntryPeriodDiscountRecordsGlobal(person = '', competencia = '') {
      return getEntryPeriodDiscountRecords(getRecords(), person, competencia);
    },
    isDeductionLikeMacro,
    normalizeEntryDiscountCycle
  });

  target.financeEntryApplication = {
    consolidatePersonMonthlyEntry,
    getConsolidatedMonthlyEntries,
    getEntryCycleViews,
    mapEntryToCycleView,
    getEntryDiscountAdjustmentRecord,
    getEntryDiscountHistoryItems,
    getEntryDiscountHistoryTotal,
    getEntryDiscountRecordTotal,
    getEntryPeriodDiscountRecords,
    isDeductionLikeMacro,
    normalizeEntryDiscountCycle
  };

  return target.financeEntryApplication;
}

