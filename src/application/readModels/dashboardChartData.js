import { roundCurrency } from '../../core/money.js';
import { getRecordCompetence } from '../selectors/dashboardFilters.js';
import { dashboardAggregationItems } from '../../domain/dashboard.js';

function getDaysInCompetenceMonth(competence = '') {
  const [year, month] = String(competence || '').split('-').map(Number);
  if (!year || !month) return 31;
  return new Date(year, month, 0).getDate();
}

function getSaidaTrendDate(record = {}, targetMonth = '') {
  const candidates = [
    record.status === 'Pago' ? record.paid_at : '',
    record.due_date,
    record.occurred_date,
    record.competence ? `${record.competence}-01` : ''
  ].filter(Boolean);

  if (targetMonth) {
    const inTargetMonth = candidates.find((dateValue) => String(dateValue).startsWith(`${targetMonth}-`));
    if (inTargetMonth) return inTargetMonth;
  }

  return candidates[0] || '';
}

export function buildDashboardDailyExpenseTrendData(records = [], month = '') {
  const daysInMonth = getDaysInCompetenceMonth(month);
  const dailyData = {};
  const recordsByDate = {};

  for (let day = 1; day <= daysInMonth; day += 1) {
    const dateKey = `${month}-${String(day).padStart(2, '0')}`;
    dailyData[dateKey] = 0;
    recordsByDate[dateKey] = [];
  }

  records.forEach((record) => {
    if (record.type !== 'saida' || (record.status !== 'Pago' && record.status !== 'Em aberto')) return;
    const trendDate = getSaidaTrendDate(record, month);
    if (dailyData[trendDate] === undefined) return;
    dailyData[trendDate] = roundCurrency(dailyData[trendDate] + (Number(record.amount) || 0));
    recordsByDate[trendDate].push(record);
  });

  const detailKeys = Object.keys(dailyData);
  const labels = detailKeys.map((dateKey) => dateKey.slice(-2));
  const values = Object.values(dailyData);
  const activeValues = values.filter((value) => value > 0);
  let peakDayIndex = 0;
  values.forEach((value, index) => {
    if (value > values[peakDayIndex]) peakDayIndex = index;
  });

  const weeklyTotals = Array.from({ length: Math.ceil(daysInMonth / 7) }, (_, weekIndex) => {
    const startIndex = weekIndex * 7;
    const endIndex = Math.min(daysInMonth - 1, startIndex + 6);
    return {
      label: `Sem ${weekIndex + 1}`,
      total: roundCurrency(values.slice(startIndex, endIndex + 1).reduce((sum, value) => sum + value, 0))
    };
  });
  const peakWeek = weeklyTotals.reduce((best, item) => item.total > best.total ? item : best, weeklyTotals[0] || { label: 'Sem 1', total: 0 });

  return {
    month,
    labels,
    detailKeys,
    values,
    recordsByDate,
    insights: {
      total: roundCurrency(values.reduce((sum, value) => sum + value, 0)),
      peakLabel: labels[peakDayIndex] || '-',
      peakValue: values[peakDayIndex] || 0,
      averageActive: activeValues.length ? roundCurrency(activeValues.reduce((sum, value) => sum + value, 0) / activeValues.length) : 0,
      activeDays: activeValues.length,
      peakWeekLabel: peakWeek.label,
      peakWeekValue: peakWeek.total
    }
  };
}

function getEntradaTrendValue(record = {}, isFinancialEntradaRecord = () => true) {
  if (record.type === 'entrada' && isFinancialEntradaRecord(record)) {
    const value = Number(record.amount) || 0;
    return String(record.macro_category || '').toUpperCase().includes('DEDU') ? -value : value;
  }

  return Number(record.cardLiquido ?? record.liquido ?? record.amount ?? 0) || 0;
}

function normalizeTrendSources(source = []) {
  if (Array.isArray(source)) {
    return {
      entradas: source.filter((record) => record?.type === 'entrada'),
      saidas: source.filter((record) => record?.type === 'saida')
    };
  }

  return {
    entradas: Array.isArray(source?.entradas) ? source.entradas : [],
    saidas: Array.isArray(source?.saidas) ? source.saidas : []
  };
}

export function buildDashboardMonthlyFinancialTrendData(source = [], months = [], options = {}) {
  const { entradas, saidas } = normalizeTrendSources(source);
  const formatCompetence = typeof options.formatCompetence === 'function' ? options.formatCompetence : (value) => value;
  const isFinancialEntradaRecord = typeof options.isFinancialEntradaRecord === 'function' ? options.isFinancialEntradaRecord : () => true;
  const monthlyData = Object.fromEntries(months.map((month) => [month, { entrada: 0, saida: 0 }]));

  entradas.forEach((record) => {
    const competence = getRecordCompetence(record);
    if (monthlyData[competence] === undefined) return;
    monthlyData[competence].entrada = roundCurrency(monthlyData[competence].entrada + getEntradaTrendValue(record, isFinancialEntradaRecord));
  });

  saidas.forEach((record) => {
    const competence = getRecordCompetence(record);
    if (monthlyData[competence] === undefined) return;
    if (record.type === 'saida' && (record.status === 'Pago' || record.status === 'Em aberto')) {
      monthlyData[competence].saida = roundCurrency(monthlyData[competence].saida + (Number(record.amount) || 0));
    }
  });

  const labels = months.map((month) => formatCompetence(month));
  const entradasValues = months.map((month) => roundCurrency(monthlyData[month].entrada));
  const saidasValues = months.map((month) => roundCurrency(monthlyData[month].saida));
  const balance = months.map((month) => roundCurrency(monthlyData[month].entrada - monthlyData[month].saida));
  const average = balance.length ? roundCurrency(balance.reduce((sum, value) => sum + value, 0) / balance.length) : 0;
  let bestIndex = 0;
  let worstIndex = 0;
  balance.forEach((value, index) => {
    if (value > balance[bestIndex]) bestIndex = index;
    if (value < balance[worstIndex]) worstIndex = index;
  });

  return {
    months,
    labels,
    entradas: entradasValues,
    saidas: saidasValues,
    balance,
    insights: {
      average,
      bestLabel: labels[bestIndex] || '-',
      bestValue: balance[bestIndex] || 0,
      worstLabel: labels[worstIndex] || '-',
      worstValue: balance[worstIndex] || 0,
      currentLabel: labels[labels.length - 1] || '-',
      currentValue: balance[balance.length - 1] || 0
    }
  };
}

export function buildCategoryChartData(aggregations = {}) {
  const items = dashboardAggregationItems(aggregations.porCategoria || {}, aggregations.registrosPorCategoria || {});
  return {
    labels: items.length ? items.map((item) => item.label) : ['Sem dados'],
    values: items.length ? items.map((item) => item.value) : [1],
    items
  };
}

export function buildStatusChartData(records = []) {
  const totals = records.reduce((acc, record) => {
    const status = record.status || 'Sem status';
    acc[status] = roundCurrency((acc[status] || 0) + (Number(record.amount) || 0));
    return acc;
  }, {});
  return {
    labels: Object.keys(totals),
    values: Object.values(totals),
    totals
  };
}

export function buildMonthlyChartData(source = [], months = [], options = {}) {
  return buildDashboardMonthlyFinancialTrendData(source, months, options);
}
