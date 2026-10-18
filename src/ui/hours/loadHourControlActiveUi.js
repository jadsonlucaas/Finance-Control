export async function loadAndInstallHourControlActiveUi(target = globalThis) {
  const { installHourControlActiveUi } = await import('./hourControlActiveUi.js');
  return installHourControlActiveUi(target);
}
