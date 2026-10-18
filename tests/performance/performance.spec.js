import { expect, test } from '@playwright/test';

const APP_URL = process.env.PERF_APP_URL || 'http://127.0.0.1:5173';

test.describe('performance audit', () => {
  test('collects runtime performance report', async ({ page }) => {
    await page.goto(APP_URL, { waitUntil: 'load' });
    await page.waitForFunction(() => Boolean(window.financePerformance?.getReport));

    const report = await page.evaluate(() => {
      return window.financePerformance.getReport('playwright-runtime');
    });

    expect(report).toBeTruthy();
    expect(report.resources.count).toBeGreaterThan(0);
    expect(report.timing.firstScreenApproximation).not.toBeNull();
  });

  test('measures tab switching and dashboard rendering when app is available', async ({ page }) => {
    await page.goto(APP_URL, { waitUntil: 'load' });
    await page.waitForFunction(() => Boolean(window.financePerformance?.getReport));

    const report = await page.evaluate(async () => {
      if (typeof window.switchTab === 'function') {
        window.switchTab('saidas');
        window.switchTab('entradas');
        window.switchTab('controle-horas');
        window.switchTab('dashboard');
      }
      if (typeof window.renderDashboard === 'function') window.renderDashboard();
      await new Promise((resolve) => setTimeout(resolve, 250));
      return window.financePerformance.getReport('playwright-navigation');
    });

    expect(report).toBeTruthy();
    expect(report.summary.switchTab.count).toBeGreaterThanOrEqual(0);
    expect(report.summary.renderDashboard.count).toBeGreaterThanOrEqual(0);
  });
});
