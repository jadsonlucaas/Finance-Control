export async function loadAndInstallReportExportActiveUi(target = globalThis, options = {}) {
  const module = await import('./reportExportActiveUi.js');
  return module.installReportExportActiveUi(target, options);
}
