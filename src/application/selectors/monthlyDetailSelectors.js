import { roundCurrency } from '../../core/money.js';
import {
  selectDashboardTotals,
  splitFinancialSaidas
} from './financialSelectors.js';

export function getMonthlyDetailEntradaValue(entry = {}) {
  return roundCurrency(Number(entry.cardLiquido ?? entry.liquido ?? entry.amount ?? 0) || 0);
}

export function getMonthlyDetailEntradaLabel(entry = {}) {
  return entry.description
    || entry.subcategory
    || entry.earning_type
    || entry.receivingType
    || entry.cycleView
    || entry.person
    || 'Entrada consolidada';
}

export function getFinancialStatusTone(value) {
  return (Number(value) || 0) >= 0
    ? {
        text: 'Positivo',
        valueClass: 'text-success',
        badgeClass: 'bg-success/10 text-success border-success/20'
      }
    : {
        text: 'Negativo',
        valueClass: 'text-danger',
        badgeClass: 'bg-danger/10 text-danger border-danger/20'
      };
}

function buildTopCategories(paidSaidas = []) {
  const byCategory = {};
  paidSaidas.forEach((record) => {
    const key = record.macro_category || 'Outros';
    byCategory[key] = roundCurrency((byCategory[key] || 0) + (Number(record.amount) || 0));
  });

  return Object.entries(byCategory)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([label, value]) => ({ label, value }));
}

function buildPersonFinancialSummary({ entradas = [], saidas = [] } = {}) {
  const personFinancialMap = {};

  const ensurePerson = (person) => {
    const key = person || 'Sem pessoa';
    if (!personFinancialMap[key]) personFinancialMap[key] = { label: key, receber: 0, pagar: 0, sobra: 0 };
    return personFinancialMap[key];
  };

  entradas.forEach((entry) => {
    ensurePerson(entry.person).receber = roundCurrency(
      ensurePerson(entry.person).receber + getMonthlyDetailEntradaValue(entry)
    );
  });

  saidas
    .filter((record) => record.status !== 'Cancelado')
    .forEach((record) => {
      ensurePerson(record.person).pagar = roundCurrency(
        ensurePerson(record.person).pagar + (Number(record.amount) || 0)
      );
    });

  return Object.values(personFinancialMap)
    .map((item) => ({
      ...item,
      sobra: roundCurrency(item.receber - item.pagar)
    }))
    .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));
}

function getTopRecordByAmount(records = []) {
  return records.reduce((best, record) => (
    !best || (Number(record.amount) || 0) > (Number(best.amount) || 0) ? record : best
  ), null);
}

function getTopEntryByValue(entries = []) {
  return entries.reduce((best, entry) => (
    !best || getMonthlyDetailEntradaValue(entry) > getMonthlyDetailEntradaValue(best) ? entry : best
  ), null);
}

export function selectMonthlyDetail({ competence = '', records = [], consolidatedEntradas = [] } = {}) {
  const saidas = records.filter((record) => record.type === 'saida');
  const { paidSaidas, openSaidas } = splitFinancialSaidas(saidas);
  const officialTotals = selectDashboardTotals({ baseEntradas: consolidatedEntradas, baseSaidas: saidas });
  const totalEntradas = officialTotals.totalEntradas;
  const totalSaidas = officialTotals.totalSaidasPagas;
  const totalAberto = officialTotals.totalAberto;
  const sobra = officialTotals.saldoRealizado;
  const saldoProjetado = officialTotals.saldoProjetado;
  const comprometimento = officialTotals.comprometimento;

  return {
    competence,
    records,
    saidas,
    financialEntradas: consolidatedEntradas,
    paidSaidas,
    openSaidas,
    totals: {
      totalEntradas,
      totalSaidas,
      totalAberto,
      sobra,
      saldoProjetado,
      comprometimento
    },
    statusTone: getFinancialStatusTone(saldoProjetado),
    topCategories: buildTopCategories(paidSaidas),
    personFinancialSummary: buildPersonFinancialSummary({ entradas: consolidatedEntradas, saidas }),
    topExpense: getTopRecordByAmount(paidSaidas),
    topEntry: getTopEntryByValue(consolidatedEntradas)
  };
}

export function installMonthlyDetailSelectorGlobals(target = globalThis) {
  Object.assign(target, {
    selectMonthlyDetail,
    getMonthlyDetailEntradaValue,
    getMonthlyDetailEntradaLabel,
    getFinancialStatusTone
  });

  target.financeMonthlyDetailSelectors = {
    selectMonthlyDetail,
    getMonthlyDetailEntradaValue,
    getMonthlyDetailEntradaLabel,
    getFinancialStatusTone
  };

  return target.financeMonthlyDetailSelectors;
}
