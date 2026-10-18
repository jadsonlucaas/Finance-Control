export async function loadAndInstallPlannerActiveUi(target = globalThis, options = {}) {
  const { installPlannerActiveUi } = await import('./plannerActiveUi.js');
  return installPlannerActiveUi(target, options);
}
