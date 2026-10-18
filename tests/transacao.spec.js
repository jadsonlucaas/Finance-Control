import { test, expect } from '@playwright/test';

test.describe('Fluxos Transacionais Básicos', () => {
  test('Deve ser possível abrir o modal de nova transação e preencher', async ({ page }) => {
    // Navigates to app
    await page.goto('/');

    // Wait for the app to be mounted
    await page.waitForSelector('#app', { state: 'attached' });

    // Assuming we bypass auth or auth is mocked in e2e config,
    // we click on new record.
    // If the login screen is present, we fill it:
    const authScreenVisible = await page.isVisible('#auth-screen');
    if (authScreenVisible) {
      await page.fill('#auth-email', 'test@test.com');
      await page.fill('#auth-password', '123456');
      await page.click('#auth-submit');
      await page.waitForSelector('#auth-screen', { state: 'hidden' });
    }

    // Now inside the app
    await page.click('#btn-new-record-header');

    // Wait for the form overlay/view
    await page.waitForSelector('#view-novo:not(.hidden)');

    // Select input
    await page.selectOption('#form-type', 'saida');
    await page.fill('#form-desc', 'Compra no mercado automatizada');
    await page.fill('#form-amount', '150.50');

    // Check if the submit button exists
    const submitBtn = page.locator('#btn-submit');
    await expect(submitBtn).toBeVisible();

    // End test without submitting effectively protecting remote DB during simple E2E, 
    // or we could submit if using a mock FIREBASE_ENV.
  });
});
