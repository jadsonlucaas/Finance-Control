import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/playwright',
  testMatch: /(?:environment-isolation|integration-local-(finance|installments|recurrences|import-xlsx|hours|backup-restore|settings-references|user-admin)|release-readiness-smoke)\.spec\.js/,
  timeout: 90_000,
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:5178',
    channel: 'chrome',
    trace: 'on-first-retry',
    ...devices['Desktop Chrome']
  },
  webServer: {
    command: 'node scripts/start-e2e-local-vite.mjs',
    env: {
      ...process.env,
      E2E_LOCAL_PORT: '5178',
      VITE_FINANCE_ENV: 'local-e2e',
      VITE_FINANCE_USE_FIREBASE_EMULATORS: 'true',
      VITE_FIREBASE_PROJECT_ID: 'demo-finance-control-local-e2e',
      VITE_FIREBASE_API_KEY: 'demo-key',
      VITE_FIREBASE_AUTH_EMULATOR_URL: 'http://127.0.0.1:9099',
      VITE_FIRESTORE_EMULATOR_HOST: '127.0.0.1',
      VITE_FIRESTORE_EMULATOR_PORT: '8080'
    },
    url: 'http://127.0.0.1:5178',
    reuseExistingServer: false,
    timeout: 120_000
  }
});
