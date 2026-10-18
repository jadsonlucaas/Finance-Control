export async function loadAndInstallImportActiveUi(target = globalThis, options = {}) {
  const { installImportActiveUi } = await import('./importActiveUi.js');
  return installImportActiveUi(target, options);
}
