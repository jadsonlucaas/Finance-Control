import { centsToMoney, moneyToCents, roundCurrency } from '../core/money.js';
import {
  CalculateINSS,
  CalculateIRRF,
  TAX_CALCULATION_SCHEMA_VERSION,
  calcularINSS,
  calcularIRRF,
  calcularLiquido
} from './taxes.js';

function normalizeLookupText(value = '') {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
}

function getEntryDiscountHistoryItems(record = {}) {
  return Array.isArray(record?.entry_discount_history) ? record.entry_discount_history : [];
}

function isMonthlyDiscountRecord(record = {}) {
  if (record?.entry_discount_adjustment === true) return true;

  const macro = normalizeLookupText(record?.macro_category || '');
  if (macro.includes('DEDU')) return true;

  const text = normalizeLookupText([
    record?.earning_type,
    record?.subcategory,
    record?.description
  ].filter(Boolean).join(' '));

  return text.includes('DESCONTO') || text.includes('INSS') || text.includes('IRRF') || text.includes('IRPF');
}

function expandEntryDiscountRecord(record = {}) {
  const history = getEntryDiscountHistoryItems(record);
  if (record?.entry_discount_adjustment !== true || !history.length) return [record];

  return history.map((item, index) => ({
    ...record,
    id: `${record.id || 'entry_discount'}_history_${item?.id || index}`,
    amount: roundCurrency(Number(item?.amount) || 0),
    description: String(
      item?.observation ||
      record?.description ||
      record?.subcategory ||
      record?.earning_type ||
      'Desconto'
    ).trim(),
    observation: String(item?.observation || '').trim(),
    entry_discount_history_item_id: item?.id || '',
    entry_discount_history_index: index,
    updated_at: item?.saved_at || record?.updated_at || record?.created_at || '',
    created_at: item?.saved_at || record?.created_at || record?.updated_at || ''
  }));
}

export function getMonthlyDiscountRecords(records = [], person = '', competencia = '') {
  return (Array.isArray(records) ? records : [])
    .filter((record) =>
      record?.type === 'entrada' &&
      record.person === person &&
      record.competence === competencia &&
      isMonthlyDiscountRecord(record)
    )
    .flatMap((record) => expandEntryDiscountRecord(record));
}

export function getMonthlyEntryRecords(records = [], person = '', competencia = '', isReferenceSalaryRecord = () => false) {
  return (Array.isArray(records) ? records : []).filter((record) =>
    record?.type === 'entrada' &&
    record.person === person &&
    record.competence === competencia &&
    !isReferenceSalaryRecord(record)
  );
}

export function getMonthlyHourExtraRecords(records = [], person = '', competencia = '') {
  return (Array.isArray(records) ? records : []).filter((record) =>
    record?.type === 'controle_horas' &&
    record.person === person &&
    record.competence === competencia &&
    (record.hour_entry_type === 'Hora Extra' || record.hour_control_type === 'Hora Extra')
  );
}

function getHourExtraRecordFinancialValue(record = {}, salaryBase = 0) {
  const storedValue = Number(record.financial_total ?? record.valorTotalCalculado ?? record.amount ?? 0) || 0;
  if (storedValue > 0) return storedValue;

  const hours = Number(record.hours_quantity ?? record.quantidadeHoras ?? 0) || 0;
  const base = Number(record.salary_base_snapshot ?? record.salary_base_reference ?? salaryBase ?? 0) || 0;
  const percentage = Number(record.overtime_percentage ?? record.percentualUsado ?? 0) || 0;
  if (hours <= 0 || base <= 0 || percentage <= 0) return 0;

  const normalHourValue = roundCurrency(base / 220);
  const rate = percentage > 1 ? percentage / 100 : percentage;
  return roundCurrency(hours * roundCurrency(normalHourValue + roundCurrency(normalHourValue * rate)));
}

export function consolidateMonthlyEntry({
  records = [],
  person = '',
  competencia = '',
  salaryInfo = {},
  banco = null,
  isReferenceSalaryRecord = () => false,
  calculateInss = calcularINSS,
  calculateIrrf = calcularIRRF
} = {}) {
  const salaryBase = roundCurrency(salaryInfo?.salario || salaryInfo?.salary_base || salaryInfo?.amount || 0);
  const hourEntries = getMonthlyHourExtraRecords(records, person, competencia);
  const monthlyEntries = getMonthlyEntryRecords(records, person, competencia, isReferenceSalaryRecord);
  const horaExtra = roundCurrency(hourEntries.reduce((sum, item) =>
    sum + getHourExtraRecordFinancialValue(item, salaryBase), 0));
  const descontoRecords = getMonthlyDiscountRecords(records, person, competencia);
  const proventoRecords = monthlyEntries.filter((item) => {
    const label = String(item.subcategory || item.earning_type || '').toUpperCase();
    const macro = String(item.macro_category || '').toUpperCase();
    if (label.includes('HORA EXTRA')) return false;
    if (label.includes('INSS') || label.includes('IRRF') || label.includes('IRPF')) return false;
    if (macro.includes('DEDU')) return false;
    return true;
  });
  const salarioManual = salaryBase > 0 ? 0 : roundCurrency(proventoRecords
    .filter((item) => String(item.subcategory || item.earning_type || '').toUpperCase().includes('SAL'))
    .reduce((sum, item) => sum + (Number(item.amount) || 0), 0));
  const dsrProventos = roundCurrency(proventoRecords
    .filter((item) => String(item.subcategory || item.earning_type || item.description || '').toUpperCase().includes('DSR'))
    .reduce((sum, item) => sum + (Number(item.amount) || 0), 0));
  const outrosProventos = roundCurrency(proventoRecords
    .filter((item) => {
      const label = String(item.subcategory || item.earning_type || item.description || '').toUpperCase();
      return !label.includes('SAL') && !label.includes('DSR');
    })
    .reduce((sum, item) => sum + (Number(item.amount) || 0), 0));
  const outrosDescontos = roundCurrency(descontoRecords
    .filter((item) => {
      const label = String(item.subcategory || item.earning_type || '').toUpperCase();
      return !label.includes('INSS') && !label.includes('IRRF') && !label.includes('IRPF');
    })
    .reduce((sum, item) => sum + (Number(item.amount) || 0), 0));
  const salarioBaseFinal = roundCurrency(salaryBase + salarioManual);
  const baseTrabalho = roundCurrency(salarioBaseFinal + horaExtra + dsrProventos);
  const baseTotal = roundCurrency(baseTrabalho + outrosProventos);
  const inssRegistrado = descontoRecords.find((item) => String(item.subcategory || item.earning_type || '').toUpperCase().includes('INSS'));
  const irrfRegistrado = descontoRecords.find((item) => {
    const label = String(item.subcategory || item.earning_type || '').toUpperCase();
    return label.includes('IRRF') || label.includes('IRPF');
  });
  const useVersionedTaxEngine = calculateInss === calcularINSS && calculateIrrf === calcularIRRF;
  const inssCalculation = !inssRegistrado && useVersionedTaxEngine
    ? CalculateINSS({
      competence: competencia,
      grossIncomeCents: moneyToCents(baseTrabalho)
    })
    : null;
  const inss = roundCurrency(
    inssRegistrado
      ? Number(inssRegistrado.amount || 0)
      : inssCalculation
        ? centsToMoney(inssCalculation.amountCents)
        : calculateInss(baseTrabalho)
  );
  const irrfCalculation = !irrfRegistrado && useVersionedTaxEngine
    ? CalculateIRRF({
      competence: competencia,
      grossIncomeCents: moneyToCents(baseTrabalho),
      inssCents: moneyToCents(inss)
    })
    : null;
  const irrf = roundCurrency(
    irrfRegistrado
      ? Number(irrfRegistrado.amount || 0)
      : irrfCalculation
        ? centsToMoney(irrfCalculation.amountCents)
        : calculateIrrf(baseTrabalho, inss)
  );
  const liquido = calcularLiquido({
    salarioBase: salarioBaseFinal,
    horaExtra: roundCurrency(horaExtra + dsrProventos),
    outrosProventos,
    inss,
    irrf,
    outrosDescontos
  });

  return {
    person,
    competencia,
    salaryBase: salarioBaseFinal,
    hourExtra: horaExtra,
    dsrProventos,
    outrosProventos,
    baseTrabalho,
    baseTotal,
    inss,
    irrf,
    inss_parameter_version: inssCalculation?.parameterVersion || '',
    irrf_parameter_version: irrfCalculation?.parameterVersion || '',
    tax_calculated_at: (inssCalculation || irrfCalculation) ? new Date().toISOString() : '',
    tax_calculation_schema_version: (inssCalculation || irrfCalculation) ? TAX_CALCULATION_SCHEMA_VERSION : null,
    tax_warnings: [
      ...(inssCalculation?.warnings || []),
      ...(irrfCalculation?.warnings || [])
    ],
    outrosDescontos,
    liquido,
    banco,
    salaryInfo,
    hourEntries,
    descontoRecords
  };
}
