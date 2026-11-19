import { expect } from '@playwright/test';

/**
 * Abre uma tela pelo menu como a pessoa faria (Etapa 6):
 * - Importação mora em Configurações (cartão "Importar planilha");
 * - Controle de horas só aparece com "Módulos avançados" ligado, então liga antes;
 * - Entradas fica na chave Saídas | Entradas de Lançamentos.
 */
export async function openTab(page, tab) {
  if (tab === 'controle-horas') {
    await page.evaluate(() => window.financeApp?.advancedModules?.setEnabled?.(true));
  }
  if (tab === 'importacao') {
    await openTab(page, 'configuracoes');
    await page.locator('#btn-settings-open-import').click();
    await expect(page.locator('#view-importacao')).toBeVisible();
    return;
  }
  if (tab === 'entradas') {
    await openTab(page, 'saidas');
    await page.locator('#view-saidas [data-ledger-tab="entradas"]').click();
    await expect(page.locator('#view-entradas')).toBeVisible();
    return;
  }
  const sidebar = page.locator('#sidebar');
  const isHidden = await sidebar.evaluate((element) => element.classList.contains('-translate-x-full')).catch(() => true);
  // No computador o menu lateral fica fixo; o botao de menu so existe em telas menores.
  if (isHidden && await page.locator('#btn-mobile-menu').isVisible()) await page.locator('#btn-mobile-menu').click();
  await expect(sidebar).toBeVisible();
  await page.locator(`#main-tabs [data-tab="${tab}"]`).click();
  await expect(page.locator(`#view-${tab}`)).toBeVisible();
}
