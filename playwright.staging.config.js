import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.STAGING_BASE_URL;
const expectedProjectId = process.env.STAGING_FIREBASE_PROJECT_ID;
const productionProjectId = 'finance-control-cce4f';

if (!baseURL) {
  throw new Error('STAGING_BASE_URL_REQUIRED');
}

if (!expectedProjectId) {
  throw new Error('STAGING_FIREBASE_PROJECT_ID_REQUIRED');
}

if (expectedProjectId === productionProjectId || baseURL.includes(productionProjectId)) {
  throw new Error('STAGING_TARGET_POINTS_TO_PRODUCTION');
}

if (!baseURL.includes(expectedProjectId)) {
  throw new Error('STAGING_BASE_URL_PROJECT_MISMATCH');
}

export default defineConfig({
  testDir: './tests/playwright',
  testMatch: /staging-critical\.spec\.js/,
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL,
    channel: 'chrome',
    trace: 'on-first-retry',
    expectedProjectId,
    productionProjectId,
    ...devices['Desktop Chrome']
  }
});
