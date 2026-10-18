import { expect, test } from '@playwright/test';

test('local E2E is fail-closed on emulators with zero Firebase cloud requests', async ({ page }) => {
  const requests = [];
  page.on('request', (request) => requests.push(request.url()));
  await page.goto('/', { waitUntil: 'load' });
  await page.waitForFunction(() => window.__financeFirebaseRuntime?.projectId);

  expect(await page.evaluate(() => window.__financeFirebaseRuntime)).toEqual({
    environment: 'local-e2e',
    projectId: 'demo-finance-control-local-e2e',
    useEmulators: true,
    authEmulatorUrl: 'http://127.0.0.1:9099',
    firestoreEmulatorHost: '127.0.0.1',
    firestoreEmulatorPort: 8080
  });
  expect(requests.some((url) => /finance-control-cce4f|finance-control-staging-260919/.test(url))).toBe(false);
  expect(requests.some((url) => /firestore\.googleapis\.com|identitytoolkit\.googleapis\.com|securetoken\.googleapis\.com/.test(url))).toBe(false);
});
