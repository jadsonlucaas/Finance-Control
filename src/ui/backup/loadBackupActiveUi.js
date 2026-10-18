export async function loadAndInstallBackupActiveUi(target = globalThis, options = {}) {
  const { installBackupActiveUi } = await import('./backupActiveUi.js');
  return installBackupActiveUi(target, options);
}
