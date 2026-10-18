export function createDashboardPresenter(dependencies = {}) {
  const renderSummary = dependencies.renderSummary || (() => {});
  const renderBalances = dependencies.renderBalances || (() => {});
  const renderRecentList = dependencies.renderRecentList || (() => {});
  const renderCharts = dependencies.renderCharts || (() => {});
  const renderTrend = dependencies.renderTrend || (() => {});
  const renderState = dependencies.renderState || (() => {});

  return {
    render(viewState) {
      renderState(viewState);
      if (!viewState?.data) return;
      const model = viewState.data;
      renderSummary(model.summary.aggregations, model);
      renderBalances(model.summary.personBalances, model);
      renderRecentList(model.expenses, model);
      renderCharts(model.summary.aggregations, model);
      renderTrend(model.charts.trend, model);
    }
  };
}
