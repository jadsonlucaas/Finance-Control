export async function loadAndInstallSettingsActiveUi(target = globalThis, options = {}) {
  const [
    { installSettingsActiveUi },
    { createSettingsWebAdapter },
    { loadAndInstallUserAdminActiveUi },
    { loadAndInstallBackupActiveUi }
  ] = await Promise.all([
    import('./settingsActiveUi.js'),
    import('./settingsWebAdapter.js'),
    import('../admin/loadUserAdminActiveUi.js'),
    import('../backup/loadBackupActiveUi.js')
  ]);
  const settings = installSettingsActiveUi(target, {
    ...createSettingsWebAdapter(target),
    ...options
  });
  const userAdmin = await loadAndInstallUserAdminActiveUi(target, options.userAdmin || {});
  const backup = await loadAndInstallBackupActiveUi(target, options.backup || {});
  return {
    ...settings,
    userAdmin,
    backup
  };
}
