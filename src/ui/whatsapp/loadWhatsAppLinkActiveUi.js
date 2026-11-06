export async function loadAndInstallWhatsAppLinkActiveUi(target = globalThis, options = {}) {
  const { installWhatsAppLinkActiveUi } = await import('./whatsappLinkActiveUi.js');
  return installWhatsAppLinkActiveUi(target, options);
}
