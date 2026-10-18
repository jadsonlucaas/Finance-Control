import { dashboardAggregationItems } from '../../domain/dashboard.js';
import { appState } from '../../state/appState.js';
import { getDashboardAggregations, getDashboardTrendData } from './dashboardData.js';

const DASHBOARD_CHART_COLORS = ['#38bdf8', '#fbbf24', '#34d399', '#fb7185', '#a78bfa', '#2dd4bf', '#f97316', '#22c55e', '#e879f9', '#94a3b8'];

function resizeDashboardSubcategoryChart(itemCount) {
  const canvas = document.getElementById('chart-category-detail');
  const container = canvas?.parentElement;
  if (!container) return;

  container.classList.add('dashboard-subcategory-chart');
  const rows = Math.max(Number(itemCount) || 1, 1);
  const rowHeight = window.innerWidth < 768 ? 44 : 38;
  const chartHeight = Math.max(300, rows * rowHeight + 76);
  container.style.height = `${chartHeight}px`;
}

function destroyDashboardChart(key) {
  if (appState.chartInstances[key]) {
    appState.chartInstances[key].destroy();
    appState.chartInstances[key] = null;
  }
}

function getFastDashboardChartConfig(config = {}) {
  return {
    ...config,
    options: {
      ...(config.options || {}),
      animation: false
    }
  };
}

export function upsertDashboardChart(key, canvas, config) {
  if (!canvas) return;

  const nextConfig = getFastDashboardChartConfig(config);
  destroyDashboardChart(key);
  appState.chartInstances[key] = new Chart(canvas, nextConfig);
}

export function renderDashboardChartsFromAggregations(aggregations = getDashboardAggregations()) {
  if (typeof Chart !== 'function') return;
  window.ensureDashboardChartLayout?.();
  const labelColor = typeof window.getThemeTextSecondaryColor === 'function' ? window.getThemeTextSecondaryColor() : '#94a3b8';
  const categoryItems = dashboardAggregationItems(aggregations.porCategoria, aggregations.registrosPorCategoria);
  const subcategoryItems = dashboardAggregationItems(aggregations.porSubcategoria, aggregations.registrosPorSubcategoria);
  const personItems = dashboardAggregationItems(aggregations.porPessoa, aggregations.registrosPorPessoa);

  const detailTitle = document.getElementById('chart-category-detail')?.closest('.glass')?.querySelector('h3');
  if (detailTitle) detailTitle.textContent = `Detalhe por Subcategoria - Total ${window.fmt(aggregations.total)}`;

  const categoryCanvas = document.getElementById('chart-category');
  if (categoryCanvas) {
    upsertDashboardChart('category', categoryCanvas, {
      type: 'doughnut',
      plugins: [window.dashboardDataLabelPlugin].filter(Boolean),
      data: {
        labels: categoryItems.length ? categoryItems.map((item) => item.label) : ['Sem dados'],
        datasets: [{
          data: categoryItems.length ? categoryItems.map((item) => item.value) : [1],
          backgroundColor: categoryItems.length ? DASHBOARD_CHART_COLORS : ['rgba(148, 163, 184, 0.18)'],
          borderWidth: 0,
          hoverOffset: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '62%',
        layout: { padding: 8 },
        plugins: {
          dashboardDataLabelPlugin: { mode: 'doughnut-percentage' },
          legend: {
            position: 'bottom',
            labels: { color: labelColor, usePointStyle: true, pointStyle: 'circle', boxWidth: 8 }
          },
          tooltip: {
            callbacks: {
              label(context) {
                if (!categoryItems.length) return 'Sem dados';
                const value = Number(context.raw) || 0;
                const percent = aggregations.total ? ((value / aggregations.total) * 100).toFixed(1).replace('.', ',') : '0,0';
                return `${context.label}: ${window.fmt(value)} (${percent}%)`;
              }
            }
          }
        },
        onClick(event, elements) {
          if (!elements.length || !categoryItems.length) return;
          const item = categoryItems[elements[0].index];
          window.openDashboardSaidasDetail?.(`Categoria: ${item.label}`, item.records);
        }
      }
    });
  }

  const subcategoryCanvas = document.getElementById('chart-category-detail');
  if (subcategoryCanvas) {
    resizeDashboardSubcategoryChart(subcategoryItems.length || 1);
    destroyDashboardChart('subcategory');
    upsertDashboardChart('categoryDetail', subcategoryCanvas, {
      type: 'bar',
      plugins: [window.dashboardDataLabelPlugin].filter(Boolean),
      data: {
        labels: subcategoryItems.length ? subcategoryItems.map((item) => item.label) : ['Sem dados'],
        datasets: [{
          label: 'Subcategorias',
          data: subcategoryItems.length ? subcategoryItems.map((item) => item.value) : [0],
          backgroundColor: subcategoryItems.length ? '#38bdf8' : 'rgba(148, 163, 184, 0.18)',
          borderRadius: 8,
          borderWidth: 0,
          barPercentage: 0.68,
          categoryPercentage: 0.8
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        layout: { padding: { top: 4, right: 42, bottom: 4, left: 4 } },
        plugins: {
          legend: { display: false },
          dashboardDataLabelPlugin: { mode: 'bar-currency-horizontal', color: '#e2e8f0' },
          tooltip: {
            callbacks: {
              label(context) {
                if (!subcategoryItems.length) return 'Sem dados';
                const value = Number(context.raw) || 0;
                const percent = aggregations.total ? ((value / aggregations.total) * 100).toFixed(1).replace('.', ',') : '0,0';
                return `${window.fmt(value)} (${percent}%)`;
              }
            }
          }
        },
        scales: {
          x: { grid: { display: false, drawBorder: false }, ticks: { display: false } },
          y: { grid: { display: false, drawBorder: false }, ticks: { color: labelColor, font: { size: 11 }, autoSkip: false } }
        },
        onClick(event, elements) {
          if (!elements.length || !subcategoryItems.length) return;
          const item = subcategoryItems[elements[0].index];
          window.openDashboardSaidasDetail?.(`Subcategoria: ${item.label}`, item.records);
        }
      }
    });
  }

  const personCanvas = document.getElementById('chart-person');
  if (personCanvas) {
    upsertDashboardChart('person', personCanvas, {
      type: 'bar',
      plugins: [window.dashboardDataLabelPlugin].filter(Boolean),
      data: {
        labels: personItems.length ? personItems.map((item) => item.label) : ['Sem dados'],
        datasets: [{
          label: 'Gastos por pessoa',
          data: personItems.length ? personItems.map((item) => item.value) : [0],
          backgroundColor: personItems.length ? '#38bdf8' : 'rgba(148, 163, 184, 0.18)',
          borderColor: personItems.length ? '#0284c7' : 'transparent',
          borderWidth: 1,
          borderRadius: 4,
          barPercentage: 0.6,
          categoryPercentage: 0.7
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        layout: { padding: { right: 18 } },
        plugins: {
          legend: { display: false },
          dashboardDataLabelPlugin: { mode: 'bar-currency-horizontal' }
        },
        scales: {
          x: { grid: { display: false, drawBorder: false }, ticks: { display: false } },
          y: { ticks: { color: labelColor, font: { size: 11 } }, grid: { display: false } }
        },
        onClick(event, elements) {
          if (!elements.length || !personItems.length) return;
          const item = personItems[elements[0].index];
          window.openDashboardSaidasDetail?.(`Pessoa: ${item.label}`, item.records);
        }
      }
    });
  }
}

function formatCurrency(value) {
  return typeof window.fmt === 'function' ? window.fmt(value) : `R$ ${Number(value || 0).toFixed(2)}`;
}

function formatCompactCurrency(value) {
  return typeof window.fmtCompactCurrency === 'function' ? window.fmtCompactCurrency(value) : formatCurrency(value);
}

function formatCompetenceLabel(value) {
  return typeof window.formatCompetence === 'function' ? window.formatCompetence(value) : value;
}

function getDashboardLabelColor() {
  return typeof window.getThemeTextSecondaryColor === 'function' ? window.getThemeTextSecondaryColor() : '#64748b';
}

function sortDashboardRecordsNewestFirst(records = []) {
  return typeof window.sortRecordsNewestFirst === 'function'
    ? window.sortRecordsNewestFirst(records)
    : [...records].sort((a, b) => String(b.due_date || b.occurred_date || b.competence || '').localeCompare(String(a.due_date || a.occurred_date || a.competence || '')));
}

function openDashboardDailyExpenseDetail(title, subtitle, records) {
  window.openDashboardExpenseRecordsModal?.(title, subtitle, sortDashboardRecordsNewestFirst(records));
}

function openDashboardMonthlyDetail(monthKey) {
  if (typeof window.openMonthlyDetailTab === 'function') {
    window.openMonthlyDetailTab(monthKey);
  }
}

function renderDashboardTrendInsights(data) {
  if (data.mode === 'daily') {
    window.renderDailyTrendInsights?.(data.daily.insights);
    return;
  }
  window.renderTrendInsights?.(data.monthly.insights);
}

function buildDashboardTrendDatasets(data) {
  if (data.mode === 'daily') {
    return [{
      type: 'bar',
      label: 'Gastos diários',
      data: data.daily.values,
      backgroundColor: 'rgba(244, 63, 94, 0.45)',
      borderColor: '#f43f5e',
      borderWidth: 1,
      borderRadius: 6,
      categoryPercentage: 0.92,
      barPercentage: 0.92
    }];
  }

  return [
    {
      type: 'bar',
      label: 'Entradas',
      data: data.monthly.entradas,
      backgroundColor: 'rgba(52, 211, 153, 0.32)',
      borderColor: 'rgba(52, 211, 153, 0.75)',
      borderWidth: 1,
      borderRadius: 8,
      categoryPercentage: 0.7,
      barPercentage: 0.82,
      order: 3
    },
    {
      type: 'bar',
      label: 'Saídas',
      data: data.monthly.saidas,
      backgroundColor: 'rgba(244, 63, 94, 0.26)',
      borderColor: 'rgba(244, 63, 94, 0.7)',
      borderWidth: 1,
      borderRadius: 8,
      categoryPercentage: 0.7,
      barPercentage: 0.82,
      order: 3
    },
    {
      type: 'line',
      label: 'Sobra',
      data: data.monthly.balance,
      borderColor: '#0369a1',
      backgroundColor: 'rgba(3, 105, 161, 0.12)',
      tension: data.monthly.labels.length <= 1 ? 0 : 0.28,
      fill: false,
      borderWidth: 3,
      pointBackgroundColor: data.monthly.balance.map((value) => value >= 0 ? '#0369a1' : '#e11d48'),
      pointBorderColor: data.monthly.balance.map((value) => value >= 0 ? '#e0f2fe' : '#ffe4e6'),
      pointBorderWidth: 2,
      pointRadius: data.monthly.balance.map((value) => value < 0 ? 5 : 4),
      pointHoverRadius: data.monthly.balance.map((value) => value < 0 ? 6 : 5),
      order: 1
    },
    {
      type: 'line',
      label: 'Média da sobra',
      data: data.monthly.balance.map(() => data.monthly.insights.average),
      borderColor: 'rgba(71, 85, 105, 0.9)',
      backgroundColor: 'transparent',
      tension: 0,
      fill: false,
      borderWidth: 1.5,
      borderDash: [5, 5],
      pointRadius: 0,
      pointHoverRadius: 0,
      order: 2
    }
  ];
}

function buildDashboardTrendConfig(data) {
  const isDaily = data.mode === 'daily';
  const labels = isDaily ? data.daily.labels : data.monthly.labels;
  const datasets = buildDashboardTrendDatasets(data);

  return {
    type: 'bar',
    plugins: [window.dashboardDataLabelPlugin].filter(Boolean),
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      layout: { padding: { top: 26, right: 14, left: 6, bottom: isDaily ? 34 : 0 } },
      interaction: { mode: 'index', intersect: false },
      onClick: (event, elements) => {
        if (!elements.length) return;
        const index = elements[0].index;
        if (isDaily) {
          const dateKey = data.daily.detailKeys[index];
          const records = data.daily.recordsByDate[dateKey] || [];
          const title = `Gastos diários: ${labels[index]}/${data.daily.month.slice(5)}`;
          openDashboardDailyExpenseDetail(title, `${records.length} despesa(s) no dia selecionado`, records);
          return;
        }

        const monthKey = data.monthly.months[index];
        if (monthKey) openDashboardMonthlyDetail(monthKey);
      },
      plugins: {
        dashboardDataLabelPlugin: isDaily ? { mode: 'daily-spend-objective', datasetIndex: 0 } : { mode: 'financial-combo-monthly', datasetIndex: 2 },
        legend: {
          labels: {
            color: getDashboardLabelColor(),
            font: { size: 10 },
            padding: 12,
            usePointStyle: true,
            pointStyle: 'line',
            boxWidth: 8
          }
        },
        tooltip: {
          callbacks: {
            label: (context) => `${context.dataset.label}: ${formatCurrency(context.parsed.y)}`
          }
        }
      },
      scales: {
        x: {
          grid: { display: false, drawBorder: false },
          ticks: { color: getDashboardLabelColor(), font: { size: 11 } }
        },
        y: {
          grid: { color: 'rgba(148, 163, 184, 0.12)', drawBorder: false },
          ticks: {
            color: getDashboardLabelColor(),
            font: { size: 11 },
            callback: (value) => formatCompactCurrency(value)
          },
          beginAtZero: true
        }
      }
    }
  };
}

function upsertDashboardTrendChart(canvas, config) {
  if (!appState.chartInstances.trend || appState.chartInstances.trend.config?.type !== config.type) {
    destroyDashboardChart('trend');
    appState.chartInstances.trend = new Chart(canvas, config);
    return;
  }

  appState.chartInstances.trend.data.labels = config.data.labels;
  appState.chartInstances.trend.data.datasets = config.data.datasets;
  appState.chartInstances.trend.options = config.options;
  appState.chartInstances.trend.update('none');
}

export function renderTrendChartByDashboardFilter() {
  if (typeof Chart !== 'function') return;
  const trendCanvas = document.getElementById('chart-trend');
  if (!trendCanvas) return;

  const data = getDashboardTrendData();
  const title = document.getElementById('chart-trend-title');
  if (title) {
    title.textContent = data.mode === 'daily'
      ? `Gastos Diários (${formatCompetenceLabel(data.start)})`
      : 'Fluxo Financeiro Mensal';
  }

  renderDashboardTrendInsights(data);
  upsertDashboardTrendChart(trendCanvas, buildDashboardTrendConfig(data));
}

export function installDashboardChartGlobals(target = window) {
  Object.assign(target, {
    upsertDashboardChart,
    renderDashboardChartsFromAggregations,
    renderTrendChartByDashboardFilter
  });
}
