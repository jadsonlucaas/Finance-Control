import { roundCurrency } from '../../core/money.js';
import { normalizeCompetenceKey } from '../../core/dates.js';
import { applyDashboardFilters, getRecordCompetence, sortRecordsNewestFirst } from '../selectors/dashboardFilters.js';
import { selectPdfFinancialReport } from '../selectors/financialSelectors.js';

const SENSITIVE_KEY_PATTERN = /(password|senha|token|authorization|cookie|private|secret|service.?account|idempotency|receipt|telefone|phone|whatsapp|owner_uid|ownerUid|owner_email|ownerEmail)/i;

function cloneRecord(record = {}) {
  return Object.fromEntries(
    Object.entries(record || {})
      .filter(([key]) => !SENSITIVE_KEY_PATTERN.test(key))
      .map(([key, value]) => [key, value])
  );
}

function belongsToOwner(record = {}, ownerUid = '') {
  return !ownerUid || !record.owner_uid || record.owner_uid === ownerUid;
}

function scopeReportDataByOwner(reportData = null, ownerUid = '', focusedDashboardCard = '') {
  if (!reportData || typeof reportData !== 'object') return reportData;
  const hasReportCollections = [
    reportData.detailedRecords,
    reportData.financialEntradas,
    reportData.dashboardEntradas,
    reportData.saidas,
    reportData.paidSaidas,
    reportData.openSaidas
  ].some(Array.isArray);
  if (!hasReportCollections) return null;
  const scopeArray = (value) => Array.isArray(value) ? value.filter((record) => belongsToOwner(record, ownerUid)) : [];
  const scopedSaidas = scopeArray(reportData.saidas);
  const scopedEntradas = scopeArray(reportData.financialEntradas || reportData.dashboardEntradas);
  const scopedPaid = scopeArray(reportData.paidSaidas);
  const scopedOpen = scopeArray(reportData.openSaidas);
  const scopedDetailed = scopeArray(reportData.detailedRecords);
  if (!ownerUid) return reportData;
  return selectPdfFinancialReport({
    detailedRecords: scopedDetailed,
    dashboardEntradas: scopedEntradas,
    saidas: scopedSaidas,
    focusedDashboardCard: focusedDashboardCard || reportData.focusedDashboardCard || ''
  }) || {
    ...reportData,
    detailedRecords: scopedDetailed,
    financialEntradas: scopedEntradas,
    dashboardEntradas: scopedEntradas,
    saidas: scopedSaidas,
    paidSaidas: scopedPaid,
    openSaidas: scopedOpen
  };
}

function normalizeText(value = '') {
  return String(value || '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function expenseText(record = {}) {
  return normalizeText([
    record.macro_category,
    record.subcategory,
    record.category_name,
    record.description
  ].filter(Boolean).join(' '));
}

function isTransfer(record = {}) {
  const text = expenseText(record);
  return text.includes('TRANSFER') || text.includes('TRANSF');
}

function isInvestment(record = {}) {
  const text = expenseText(record);
  return text.includes('INVEST') || text.includes('APLICACAO') || text.includes('TESOURO') || text.includes('RENDA FIXA');
}

function isReserve(record = {}) {
  return expenseText(record).includes('RESERVA');
}

function isFixedExpense(record = {}) {
  const text = expenseText(record);
  return text.includes('FIXO') || text.includes('ALUGUEL') || text.includes('FINANCIAMENTO') || text.includes('ASSINATURA');
}

function isNonEssential(record = {}) {
  const text = expenseText(record);
  return text.includes('SUPERFLUO') || text.includes('LAZER') || text.includes('DELIVERY') || text.includes('IFOOD') || text.includes('RESTAURANTE') || text.includes('SHOPPING');
}

function classifyExpenseGroup(record = {}) {
  const text = expenseText(record);
  if (text.includes('FIXO')) return 'Despesas fixas';
  if (text.includes('VARIAVEL')) return 'Despesas variaveis';
  if (text.includes('RESERVA')) return 'Reservas';
  if (text.includes('INVEST')) return 'Investimentos';
  if (text.includes('SUPERFLUO') || text.includes('LAZER') || text.includes('DELIVERY')) return 'Superfluos';
  return 'Despesas variaveis';
}

function getAmount(record = {}) {
  return roundCurrency(Number(record.cardLiquido ?? record.liquido ?? record.amount ?? 0) || 0);
}

function getRecordDate(record = {}) {
  return record.occurred_date || record.due_date || record.competence || record.competencia || '';
}

export function buildFinancialReportSummary({ reportData = {}, hourSummary = null } = {}) {
  const totals = reportData.totals || {};
  const receitas = roundCurrency(Number(totals.receitas || 0));
  const despesas = roundCurrency(Number(totals.despesas || 0));
  const emAberto = roundCurrency(Number(totals.emAberto || 0));
  const saldoRealizado = roundCurrency(Number(totals.saldoRealizado ?? receitas - despesas));
  const saldoProjetado = roundCurrency(Number(totals.saldoProjetado ?? totals.saldoLiquido ?? saldoRealizado - emAberto));
  const comprometimento = receitas > 0 ? (despesas / receitas) * 100 : 0;
  const saidas = Array.isArray(reportData.saidas) ? reportData.saidas : [];
  const paidSaidas = Array.isArray(reportData.paidSaidas) ? reportData.paidSaidas : saidas.filter((item) => item.status === 'Pago');
  const openSaidas = Array.isArray(reportData.openSaidas) ? reportData.openSaidas : saidas.filter((item) => item.status === 'Em aberto');
  const operationalExpenses = paidSaidas.filter((item) => !isTransfer(item) && !isInvestment(item) && !isReserve(item));
  const fixedExpenses = operationalExpenses.filter(isFixedExpense);
  const nonEssentialExpenses = operationalExpenses.filter(isNonEssential);

  return {
    receitas,
    despesas,
    emAberto,
    saldoRealizado,
    saldoProjetado,
    comprometimento: roundCurrency(comprometimento),
    totalRegistros: Array.isArray(reportData.detailedRecords) ? reportData.detailedRecords.length : 0,
    entradas: Array.isArray(reportData.financialEntradas) ? reportData.financialEntradas.length : 0,
    saidas: saidas.length,
    saidasPagas: paidSaidas.length,
    saidasEmAberto: openSaidas.length,
    despesaOperacional: roundCurrency(operationalExpenses.reduce((sum, item) => sum + getAmount(item), 0)),
    despesaFixa: roundCurrency(fixedExpenses.reduce((sum, item) => sum + getAmount(item), 0)),
    despesaNaoEssencial: roundCurrency(nonEssentialExpenses.reduce((sum, item) => sum + getAmount(item), 0)),
    horas: hourSummary || null
  };
}

export function buildFinancialReportTables({ records = [], summary = {} } = {}) {
  const detailedRows = sortRecordsNewestFirst(records).map((record) => {
    const safe = cloneRecord(record);
    return {
      id: String(safe.id || ''),
      data: getRecordDate(safe),
      tipo: safe.type === 'entrada' ? 'Entrada' : 'Saida',
      pessoa: safe.person || '-',
      categoria: safe.macro_category || safe.subcategory || safe.category_name || safe.receivingType || '-',
      descricao: safe.description || safe.subcategory || safe.earning_type || (safe.type === 'entrada' ? 'Entrada consolidada' : '-'),
      valor: getAmount(safe),
      status: safe.status || '-',
      competencia: getRecordCompetence(safe)
    };
  });

  return {
    summaryRows: [
      ['Receitas', summary.receitas],
      ['Saidas pagas', summary.despesas],
      ['Em aberto', summary.emAberto],
      ['Saldo realizado', summary.saldoRealizado],
      ['Saldo projetado', summary.saldoProjetado],
      ['Comprometimento', summary.comprometimento]
    ],
    detailedRows
  };
}

export function buildFinancialReportSections({ reportData = {}, summary = {} } = {}) {
  const byGroup = {
    'Despesas fixas': 0,
    'Despesas variaveis': 0,
    Investimentos: 0,
    Superfluos: 0,
    Reservas: 0
  };
  const byCategory = {};
  const saidas = Array.isArray(reportData.saidas) ? reportData.saidas : [];
  saidas.filter((item) => item.status === 'Pago' && !isTransfer(item)).forEach((item) => {
    const amount = getAmount(item);
    byGroup[classifyExpenseGroup(item)] = roundCurrency((byGroup[classifyExpenseGroup(item)] || 0) + amount);
    const category = item.macro_category || item.subcategory || 'Outros';
    byCategory[category] = roundCurrency((byCategory[category] || 0) + amount);
  });
  const topSaidas = [...saidas]
    .filter((item) => item.status === 'Pago' && !isTransfer(item))
    .sort((a, b) => getAmount(b) - getAmount(a))
    .slice(0, 5)
    .map(cloneRecord);

  return [
    {
      id: 'executive-summary',
      title: 'Resumo executivo',
      items: [
        { label: 'Receitas', value: summary.receitas },
        { label: 'Saidas pagas', value: summary.despesas },
        { label: 'Em aberto', value: summary.emAberto },
        { label: 'Saldo projetado', value: summary.saldoProjetado }
      ]
    },
    {
      id: 'expense-structure',
      title: 'Estrutura de gastos',
      byGroup,
      byCategory,
      topSaidas
    }
  ];
}

export function buildReportFilename({ reportType = 'financial', period = {}, generatedAt = '' } = {}) {
  const type = String(reportType || 'financial').toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, '') || 'financial';
  const start = normalizeCompetenceKey(period.start || '') || 'inicio';
  const end = normalizeCompetenceKey(period.end || '') || start || 'fim';
  const date = String(generatedAt || new Date().toISOString()).slice(0, 10).replaceAll('-', '');
  return `relatorio-${type}-${start}-${end}-${date}.pdf`;
}

export function buildFinancialReportReadModel(input = {}) {
  const records = Array.isArray(input.financeRecords) ? input.financeRecords.map(cloneRecord) : [];
  const filters = {
    start: normalizeCompetenceKey(input.filters?.start || input.filters?.competenceStart || '') || '',
    end: normalizeCompetenceKey(input.filters?.end || input.filters?.competenceEnd || input.filters?.start || '') || '',
    person: input.filters?.person || '',
    macro: input.filters?.macro || '',
    category: input.filters?.category || '',
    cycle: input.filters?.cycle || '',
    status: input.filters?.status || '',
    archiveMode: input.filters?.archiveMode || 'active'
  };
  const focusedDashboardCard = input.options?.focusedDashboardCard || input.filters?.focusedDashboardCard || '';
  const ownerUid = input.userContext?.ownerUid || '';
  const generatedAt = input.options?.generatedAt || new Date().toISOString();
  const providedReportData = scopeReportDataByOwner(input.options?.pdfFinancialData, ownerUid, focusedDashboardCard);
  const baseReportData = providedReportData || selectPdfFinancialReport({
    detailedRecords: applyDashboardFilters(records, filters).filter((record) => record.type === 'entrada' || record.type === 'saida'),
    dashboardEntradas: applyDashboardFilters(records, { ...filters, type: 'entrada', archiveMode: 'active' }),
    saidas: applyDashboardFilters(records, { ...filters, type: 'saida', archiveMode: 'active' }).filter((record) => record.status !== 'Cancelado'),
    focusedDashboardCard
  });
  const reportData = {
    ...baseReportData,
    detailedRecords: (baseReportData.detailedRecords || []).map(cloneRecord),
    financialEntradas: (baseReportData.financialEntradas || []).map(cloneRecord),
    dashboardEntradas: (baseReportData.dashboardEntradas || []).map(cloneRecord),
    saidas: (baseReportData.saidas || []).map(cloneRecord),
    paidSaidas: (baseReportData.paidSaidas || []).map(cloneRecord),
    openSaidas: (baseReportData.openSaidas || []).map(cloneRecord)
  };
  const summary = buildFinancialReportSummary({ reportData, hourSummary: input.options?.hourSummary || null });
  const tables = buildFinancialReportTables({ records: reportData.detailedRecords, summary });
  const sections = buildFinancialReportSections({ reportData, summary });
  const period = { start: filters.start, end: filters.end || filters.start };

  return {
    title: focusedDashboardCard === 'aberto' ? 'Relatorio Financeiro Gerencial - Em Aberto' : 'Relatorio Financeiro Gerencial',
    reportType: input.reportType || 'financial',
    period,
    generatedAt,
    summary,
    sections,
    tables,
    charts: {
      byCategory: sections.find((section) => section.id === 'expense-structure')?.byCategory || {},
      byGroup: sections.find((section) => section.id === 'expense-structure')?.byGroup || {}
    },
    metadata: {
      filters,
      focusedDashboardCard,
      sourceRecordCount: records.length,
      detailedRecordCount: tables.detailedRows.length,
      ownerKey: input.userContext?.ownerKey || input.userContext?.ownerUid ? 'owner-scoped' : '',
      filename: buildReportFilename({ reportType: input.reportType || 'financial', period, generatedAt })
    },
    warnings: []
  };
}
