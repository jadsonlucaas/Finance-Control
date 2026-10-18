import { roundCurrency } from '../../core/money.js';
import {
  getEntryDiscountAdjustmentRecord,
  getEntryDiscountRecordTotal
} from './getEntryDiscountHistory.js';

export function mapEntryToCycleView(entry = {}, cycleFilter = 'INICIO_MES', options = {}) {
  const records = Array.isArray(options.records) ? options.records : [];
  const isQuinzenal = entry.receivingType === 'quinzenal';
  const quinzenaDiscount = getEntryDiscountRecordTotal(
    getEntryDiscountAdjustmentRecord(records, entry.person, entry.competencia, 'QUINZENA') || {}
  );
  const inicioMesDiscount = getEntryDiscountRecordTotal(
    getEntryDiscountAdjustmentRecord(records, entry.person, entry.competencia, 'INICIO_MES') || {}
  );

  if (cycleFilter === 'QUINZENA') {
    if (!isQuinzenal) return null;
    const quinzenaValue = roundCurrency(entry.adiantamentoQuinzena || 0);
    return {
      ...entry,
      cycle: 'QUINZENA',
      cycleView: 'QUINZENA',
      cardSalaryBase: quinzenaValue,
      cardHourExtra: 0,
      cardOutrosProventos: 0,
      cardLiquido: roundCurrency(quinzenaValue - quinzenaDiscount),
      cardDescontos: quinzenaDiscount,
      cardInss: 0,
      cardIrrf: 0,
      cycleDiscountValue: quinzenaDiscount
    };
  }

  return {
    ...entry,
    cycle: 'INICIO_MES',
    cycleView: 'INICIO_MES',
    cardSalaryBase: entry.salaryBase,
    cardHourExtra: entry.hourExtra,
    cardOutrosProventos: roundCurrency(entry.outrosProventos || 0),
    cardLiquido: entry.liquido,
    cardDescontos: entry.outrosDescontos,
    cardInss: entry.inss,
    cardIrrf: entry.irrf,
    cycleDiscountValue: inicioMesDiscount
  };
}

export function getEntryCycleViews(entry = {}, options = {}) {
  return [
    mapEntryToCycleView(entry, 'INICIO_MES', options),
    mapEntryToCycleView(entry, 'QUINZENA', options)
  ].filter(Boolean);
}
