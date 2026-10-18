export async function loadAndInstallUserAdminActiveUi(target = globalThis, options = {}) {
  const { installUserAdminActiveUi } = await import('./userAdminActiveUi.js');
  return installUserAdminActiveUi(target, options);
}

