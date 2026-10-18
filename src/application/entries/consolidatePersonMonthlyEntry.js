import { normalizeCompetenceKey } from '../../core/dates.js';
import { centsToMoney, moneyToCents, roundCurrency } from '../../core/money.js';
import { consolidateMonthlyEntry } from '../../domain/entries.js';
import {
  CalculateINSS,
  CalculateIRRF,
  TAX_CALCULATION_SCHEMA_VERSION,
  calcularINSS,
  calcularIRRF,
  calcularLiquido
} from '../../domain/taxes.js';
import { isEntryDiscountRecord } from './getEntryDiscountHistory.js';

function normalizeLookupText(value = '') {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
}

function isTaxDiscount(record = {}) {
  const text = normalizeLookupText([
    record?.subcategory,
    record?.earning_type,
    record?.description
  ].filter(Boolean).join(' '));
  return text.includes('INSS') || text.includes('IRRF') || text.includes('IRPF');
}

function isInssDiscount(record = {}) {
  const text = normalizeLookupText([
    record?.subcategory,
    record?.earning_type,
    record?.description
  ].filter(Boolean).join(' '));
  return text.includes('INSS');
}

function getPreviousCompetenceKey(competencia = '') {
  const normalized = normalizeCompetenceKey(competencia);
  const [year, month] = normalized.split('-').map(Number);
  if (!year || !month) return normalized;
  const previous = new Date(year, month - 2, 1);
  return `${previous.getFullYear()}-${String(previous.getMonth() + 1).padStart(2, '0')}`;
}

export function getPersonReceivingTypeFromRecords(records = [], personName = '') {
  const personRecord = (Array.isArray(records) ? records : []).find((record) =>
    record?.type === 'pessoa' &&
    String(record.person || '').trim() === String(personName || '').trim()
  );
  return personRecord?.receiving_type === 'quinzenal' ? 'quinzenal' : 'mensal';
}

export function calculateSalaryAdvance(receivingType = 'mensal', salaryBase = 0) {
  return receivingType === 'quinzenal'
    ? roundCurrency((Number(salaryBase) || 0) * 0.4)
    : 0;
}

export function buildPersonMonthlyEntryConsolidation({
  records = [],
  person = '',
  competencia = '',
  salaryInfo = {},
  banco = null,
  receivingType = 'mensal',
  dsrInfo = null,
  isReferenceSalaryRecord = () => false,
  calculateInss = calcularINSS,
  calculateIrrf = calcularIRRF
} = {}) {
  const normalizedCompetence = normalizeCompetenceKey(competencia);
  const base = consolidateMonthlyEntry({
    records,
    person,
    competencia: normalizedCompetence,
    salaryInfo,
    banco,
    isReferenceSalaryRecord,
    calculateInss,
    calculateIrrf
  });

  const descontoRecords = Array.isArray(base.descontoRecords) ? base.descontoRecords : [];
  const inssRegistrado = descontoRecords.find((record) => isInssDiscount(record));
  const irrfRegistrado = descontoRecords.find((record) => {
    const text = normalizeLookupText([record.subcategory, record.earning_type, record.description].filter(Boolean).join(' '));
    return text.includes('IRRF') || text.includes('IRPF');
  });
  const descontosManuais = roundCurrency(descontoRecords
    .filter((record) => !isTaxDiscount(record))
    .reduce((sum, record) => sum + (Number(record.amount) || 0), 0));
  const adiantamentoQuinzena = calculateSalaryAdvance(receivingType, base.salaryBase);
  const dsrHoraExtra = roundCurrency(Number(dsrInfo?.dsr || 0));
  const horaExtraComDsr = roundCurrency(Number(base.hourExtra || 0) + dsrHoraExtra);
  const baseTrabalho = roundCurrency(
    Number(base.salaryBase || 0) +
    horaExtraComDsr +
    Number(base.dsrProventos || 0)
  );
  const baseTotal = roundCurrency(baseTrabalho + Number(base.outrosProventos || 0));
  const useVersionedTaxEngine = calculateInss === calcularINSS && calculateIrrf === calcularIRRF;
  const inssCalculation = !inssRegistrado && useVersionedTaxEngine
    ? CalculateINSS({
      competence: normalizedCompetence,
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
      competence: normalizedCompetence,
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
  const outrosDescontos = roundCurrency(descontosManuais + adiantamentoQuinzena);
  const liquido = calcularLiquido({
    salarioBase: base.salaryBase,
    horaExtra: roundCurrency(horaExtraComDsr + Number(base.dsrProventos || 0)),
    outrosProventos: base.outrosProventos,
    inss,
    irrf,
    outrosDescontos
  });

  return {
    ...base,
    competencia: normalizedCompetence,
    descontoRecords,
    receivingType,
    adiantamentoQuinzena,
    outrosDescontos,
    outrosDescontosManuais: descontosManuais,
    dsrHoraExtra,
    dsrProventos: base.dsrProventos,
    dsrInfo: dsrInfo || {
      totalHoraExtra: base.hourExtra,
      competenciaCalendario: getPreviousCompetenceKey(normalizedCompetence),
      dsr: 0,
      diasUteis: 0,
      diasDescanso: 0
    },
    baseTrabalho,
    baseTotal,
    inss,
    irrf,
    inss_parameter_version: inssCalculation?.parameterVersion || base.inss_parameter_version || '',
    irrf_parameter_version: irrfCalculation?.parameterVersion || base.irrf_parameter_version || '',
    tax_calculated_at: (inssCalculation || irrfCalculation) ? new Date().toISOString() : base.tax_calculated_at || '',
    tax_calculation_schema_version: (inssCalculation || irrfCalculation)
      ? TAX_CALCULATION_SCHEMA_VERSION
      : base.tax_calculation_schema_version || null,
    tax_warnings: [
      ...(base.tax_warnings || []),
      ...(inssCalculation?.warnings || []),
      ...(irrfCalculation?.warnings || [])
    ],
    liquido
  };
}

export function consolidatePersonMonthlyEntry(person = '', competencia = '', context = {}) {
  const target = context.target || globalThis;
  const records = context.records || target.allRecords || [];
  const normalizedCompetence = normalizeCompetenceKey(competencia || target.thisMonth || '');
  const salaryInfo = context.salaryInfo || (
    typeof context.getSalaryInfo === 'function'
      ? context.getSalaryInfo(person, normalizedCompetence)
      : typeof target.getSalarioVigente === 'function'
        ? target.getSalarioVigente(person, normalizedCompetence)
        : {}
  );
  const banco = context.banco || (
    typeof context.getBancoSummary === 'function'
      ? context.getBancoSummary(person, normalizedCompetence)
      : typeof target.calcularSaldoBanco === 'function'
        ? target.calcularSaldoBanco(person, normalizedCompetence)
        : null
  );
  const receivingType = context.receivingType || (
    typeof context.getPersonReceivingType === 'function'
      ? context.getPersonReceivingType(person)
      : getPersonReceivingTypeFromRecords(records, person)
  );
  const dsrInfo = context.dsrInfo || (
    typeof context.calculateDsr === 'function'
      ? context.calculateDsr({ person, competencia: normalizedCompetence })
      : typeof target.calcularDSRHoraExtra === 'function'
        ? target.calcularDSRHoraExtra({ person, competencia: normalizedCompetence })
        : null
  );

  return buildPersonMonthlyEntryConsolidation({
    records,
    person,
    competencia: normalizedCompetence,
    salaryInfo,
    banco,
    receivingType,
    dsrInfo,
    isReferenceSalaryRecord: context.isReferenceSalaryRecord || target.isReferenceSalaryRecord || (() => false),
    calculateInss: context.calculateInss || target.calcularINSS || calcularINSS,
    calculateIrrf: context.calculateIrrf || target.calcularIRRF || calcularIRRF
  });
}

export function getConsolidatedMonthlyEntries({
  records = [],
  target = globalThis,
  competenceFilter = '',
  archiveMode = 'active',
  searchTerm = '',
  normalizeSearch = (value) => String(value || '').trim().toLowerCase(),
  isArchived = (record) => Boolean(record?.archived)
} = {}) {
  const normalizedCompetenceFilter = normalizeCompetenceKey(competenceFilter || '');
  const normalizedSearchTerm = normalizeSearch(searchTerm || '');
  const keys = new Set();

  records.forEach((record) => {
    if (isArchived(record) && archiveMode === 'active') return;
    if (!isArchived(record) && archiveMode === 'archived') return;
    if (!record?.person || !record?.competence) return;
    if (!['entrada', 'controle_horas'].includes(record.type)) return;
    keys.add(`${record.person}|${normalizeCompetenceKey(record.competence)}`);
  });

  const salaryCompetences = new Set([normalizeCompetenceKey(target.thisMonth || '')].filter(Boolean));
  if (normalizedCompetenceFilter) salaryCompetences.add(normalizedCompetenceFilter);
  records
    .filter((record) => record?.type === 'pessoa')
    .forEach((record) => {
      salaryCompetences.forEach((competence) => {
        const salaryInfo = typeof target.getSalarioVigente === 'function'
          ? target.getSalarioVigente(record.person, competence)
          : { salario: record.salary_base || 0 };
        if (Number(salaryInfo?.salario || 0) > 0) keys.add(`${record.person}|${competence}`);
      });
    });

  return [...keys]
    .map((key) => {
      const [entryPerson, entryCompetence] = key.split('|');
      return consolidatePersonMonthlyEntry(entryPerson, entryCompetence, { target, records });
    })
    .filter((item) =>
      item.salaryBase > 0 ||
      item.hourExtra > 0 ||
      item.dsrHoraExtra > 0 ||
      item.outrosProventos > 0 ||
      item.outrosDescontos > 0 ||
      item.inss > 0 ||
      item.irrf > 0
    )
    .filter((item) => !normalizedSearchTerm || normalizeSearch(`${item.person} ${item.competencia}`).includes(normalizedSearchTerm))
    .sort((a, b) => `${b.competencia}|${b.person}`.localeCompare(`${a.competencia}|${a.person}`));
}
