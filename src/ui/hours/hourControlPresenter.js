export function createHourControlPresenter(dependencies = {}) {
  const renderState = dependencies.renderState || (() => {});
  const renderSummary = dependencies.renderSummary || (() => {});
  const renderBank = dependencies.renderBank || (() => {});
  const renderEntries = dependencies.renderEntries || (() => {});
  const renderSalary = dependencies.renderSalary || (() => {});
  const presentMutation = dependencies.presentMutation || (() => {});

  return {
    render(viewState) {
      renderState(viewState);
      if (!viewState?.data) return;
      const model = viewState.data;
      renderSummary(model.summary, model);
      renderBank(model.bank, model);
      renderEntries(model.entries, model);
      renderSalary(model.effectiveSalary, model);
    },
    presentMutation
  };
}
