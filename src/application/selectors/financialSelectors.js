import {
  buildDashboardEntradasSummary,
  buildDashboardPersonBalances
} from '../../domain/dashboard.js';
import { roundCurrency } from '../../core/money.js';

export function getConsolidatedEntryAmount(entry = {}) {
  return roundCurrency(Number(entry.cardLiquido ?? entry.liquido ?? entry.amount ?? 0) || 0);
}

export function splitFinancialSaidas(baseSaidas = []) {
  const saidas = Array.isArray(baseSaidas) ? baseSaidas : [];
  return {
    saidas,
    paidSaidas: saidas.filter((record) => record.status === 'Pago'),
    openSaidas: saidas.filter((record) => record.status === 'Em aberto')
  };
}

export function selectDashboardTotals({ baseEntradas = [], baseSaidas = [] } = {}) {
  const entradasSummary = buildDashboardEntradasSummary(baseEntradas);
  const { paidSaidas, openSaidas } = splitFinancialSaidas(baseSaidas);
  const totalEntradas = roundCurrency(Number(entradasSummary.totalEntradas || 0));
  const totalSaidasPagas = roundCurrency(paidSaidas.reduce((sum, record) => sum + (Number(record.amount) || 0), 0));
  const totalAberto = roundCurrency(openSaidas.reduce((sum, record) => sum + (Number(record.amount) || 0), 0));
  const saldoRealizado = roundCurrency(totalEntradas - totalSaidasPagas);
  const saldoProjetado = roundCurrency(saldoRealizado - totalAberto);
  const comprometimento = totalEntradas > 0 ? (totalSaidasPagas / totalEntradas) * 100 : 0;

  return {
    entradasSummary,
    totalEntradas,
    totalSaidasPagas,
    totalAberto,
    saldoRealizado,
    saldoProjetado,
    comprometimento,
    aliases: {
      receitas: totalEntradas,
      despesas: totalSaidasPagas,
      emAberto: totalAberto,
      saldoLiquido: saldoProjetado,
      saldo: saldoProjetado
    }
  };
}

export function selectPersonBalances({ baseEntradas = [], baseSaidas = [] } = {}) {
  return buildDashboardPersonBalances(baseEntradas, baseSaidas);
}

export function selectEntryConsolidation({
  person = '',
  competence = '',
  consolidate,
  mapCycleView
} = {}) {
  if (typeof consolidate !== 'function') return { consolidated: null, cycleViews: [] };
  const consolidated = consolidate(person, competence);
  const cycleViews = typeof mapCycleView === 'function'
    ? [
        mapCycleView(consolidated, 'INICIO_MES'),
        mapCycleView(consolidated, 'QUINZENA')
      ].filter(Boolean)
    : [];

  return {
    person,
    competence,
    consolidated,
    cycleViews
  };
}

export function selectPdfFinancialReport({
  detailedRecords = [],
  dashboardEntradas = [],
  saidas = [],
  focusedDashboardCard = ''
} = {}) {
  const { paidSaidas, openSaidas } = splitFinancialSaidas(saidas);
  const totals = selectDashboardTotals({ baseEntradas: dashboardEntradas, baseSaidas: saidas });

  return {
    detailedRecords: focusedDashboardCard === 'aberto'
      ? openSaidas
      : [...dashboardEntradas, ...saidas],
    fallbackDetailedRecords: detailedRecords,
    financialEntradas: dashboardEntradas,
    saidas,
    dashboardEntradas,
    paidSaidas,
    openSaidas,
    totals: {
      receitas: totals.totalEntradas,
      despesas: totals.totalSaidasPagas,
      emAberto: totals.totalAberto,
      saldoRealizado: totals.saldoRealizado,
      saldoLiquido: totals.saldoProjetado,
      saldoProjetado: totals.saldoProjetado,
      comprometimento: totals.comprometimento
    }
  };
}

export function installFinancialSelectorGlobals(target = globalThis) {
  Object.assign(target, {
    selectDashboardTotals,
    selectEntryConsolidation,
    selectPersonBalances,
    selectPdfFinancialReport
  });

  target.financeFinancialSelectors = {
    getConsolidatedEntryAmount,
    splitFinancialSaidas,
    selectDashboardTotals,
    selectEntryConsolidation,
    selectPersonBalances,
    selectPdfFinancialReport
  };

  return target.financeFinancialSelectors;
}
