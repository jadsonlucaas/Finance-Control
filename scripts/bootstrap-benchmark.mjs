import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { chromium } from '@playwright/test';

const previewPort = Number(process.env.BOOTSTRAP_BENCHMARK_PORT || 5177);
const devPort = previewPort + 1;
const sampleSize = Number(process.env.BOOTSTRAP_BENCHMARK_RUNS || 10);
const includeDev = process.env.BOOTSTRAP_BENCHMARK_INCLUDE_DEV !== 'false';
const baselinePath = 'docs/bootstrap-performance-baseline.json';
const localFirebaseEnvironment = {
  VITE_FINANCE_ENV: 'local-e2e',
  VITE_FINANCE_USE_FIREBASE_EMULATORS: 'true',
  VITE_FIREBASE_PROJECT_ID: 'demo-finance-control-local-e2e',
  VITE_FIREBASE_API_KEY: 'demo-key',
  VITE_FIREBASE_AUTH_EMULATOR_URL: 'http://127.0.0.1:9099',
  VITE_FIRESTORE_EMULATOR_HOST: '127.0.0.1',
  VITE_FIRESTORE_EMULATOR_PORT: '8080'
};

const APP_CONTROLLED_METRICS = [
  'app_bootstrap_ms',
  'legacy_loader_ms',
  'bridge_install_ms',
  'auth_init_ms',
  'first_screen_ready_ms',
  'lazy_registration_ms'
];
const ENVIRONMENT_ONLY_METRICS = ['document_load_ms', 'environment_overhead_ms'];

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function median(values = []) {
  const sorted = [...values].sort((a, b) => a - b);
  if (!sorted.length) return 0;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

function percentile(values = [], percentileValue = 0.75) {
  const sorted = [...values].sort((a, b) => a - b);
  if (!sorted.length) return 0;
  const index = Math.ceil(percentileValue * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(sorted.length - 1, index))];
}

function average(values = []) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function standardDeviation(values = []) {
  if (!values.length) return 0;
  const avg = average(values);
  return Math.sqrt(values.reduce((sum, value) => sum + ((value - avg) ** 2), 0) / values.length);
}

function round(value) {
  return Number((Number(value) || 0).toFixed(3));
}

function summarize(values = []) {
  const numeric = values.filter((value) => typeof value === 'number' && Number.isFinite(value));
  if (!numeric.length) {
    return {
      samples: 0,
      median: null,
      average: null,
      p75: null,
      p95: null,
      min: null,
      max: null,
      standardDeviation: null,
      coefficientOfVariation: null
    };
  }
  const avg = average(numeric);
  const stdev = standardDeviation(numeric);
  return {
    samples: numeric.length,
    median: round(median(numeric)),
    average: round(avg),
    p75: round(percentile(numeric, 0.75)),
    p95: round(percentile(numeric, 0.95)),
    min: round(Math.min(...numeric)),
    max: round(Math.max(...numeric)),
    standardDeviation: round(stdev),
    coefficientOfVariation: avg ? round(stdev / avg) : 0
  };
}

function summarizeSamples(samples = []) {
  const metricNames = [...APP_CONTROLLED_METRICS, ...ENVIRONMENT_ONLY_METRICS];
  return Object.fromEntries(metricNames.map((name) => [
    name,
    summarize(samples.map((sample) => sample.metrics?.[name]).filter((value) => value !== null && value !== undefined))
  ]));
}

function readBaseline() {
  if (!existsSync(baselinePath)) return null;
  return JSON.parse(readFileSync(baselinePath, 'utf8'));
}

async function waitForServer(url, timeoutMs = 120000) {
  const started = performance.now();
  while (performance.now() - started < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Server is still starting.
    }
    await wait(500);
  }
  throw new Error(`Servidor nao respondeu em ${url}`);
}

function serverConfig(kind, port) {
  if (kind === 'preview') {
    return process.platform === 'win32'
      ? { command: 'cmd.exe', args: ['/d', '/s', '/c', `npm.cmd run preview -- --port ${port} --strictPort`] }
      : { command: 'npm', args: ['run', 'preview', '--', '--port', String(port), '--strictPort'] };
  }
  return process.platform === 'win32'
    ? { command: 'cmd.exe', args: ['/d', '/s', '/c', `npm.cmd run dev -- --port ${port} --strictPort`] }
    : { command: 'npm', args: ['run', 'dev', '--', '--port', String(port), '--strictPort'] };
}

function startServer(kind, port) {
  const config = serverConfig(kind, port);
  return spawn(config.command, config.args, {
    stdio: 'ignore',
    windowsHide: true,
    env: { ...process.env, ...localFirebaseEnvironment }
  });
}

async function stopServer(server) {
  if (!server?.pid || server.killed) return;
  if (process.platform === 'win32') {
    await new Promise((resolve) => {
      const killer = spawn('taskkill.exe', ['/pid', String(server.pid), '/t', '/f'], {
        stdio: 'ignore',
        windowsHide: true
      });
      killer.once('exit', resolve);
      killer.once('error', resolve);
    });
    return;
  }
  server.kill();
}

async function collectSample(page, url, run, mode) {
  await page.goto(`${url}?bootstrapMode=${mode}&bootstrapRun=${run}`, { waitUntil: 'load' });
  await page.waitForFunction(() => {
    const report = window.financePerformance?.getReport?.('bootstrap-benchmark');
    return Boolean(report?.bootstrap?.requiredMarksPresent);
  }, null, { timeout: 30000 });

  return page.evaluate(({ run: currentRun, mode: currentMode }) => {
    const report = window.financePerformance.getReport('bootstrap-benchmark');
    const navigation = performance.getEntriesByType('navigation')[0];
    const resources = performance.getEntriesByType('resource');
    const hasResource = (pattern) => resources.some((entry) => pattern.test(entry.name));
    return {
      run: currentRun,
      mode: currentMode,
      metrics: report.bootstrap.metrics,
      marks: report.bootstrap.marks,
      resources: report.resources.count,
      libraryLoaderSetupCount: report.bootstrap.libraryLoaderSetupCount,
      lazyLibrariesTouched: {
        xlsx: hasResource(/xlsx|spreadsheetImportParser|loadImportActiveUi/),
        pdf: hasResource(/jspdf|autotable|pdfAdapter|loadReportExportActiveUi/),
        firebase: hasResource(/services-firebase|firebase\/|@firebase/)
      }
    };
  }, { run, mode });
}

async function collectColdRuns(browser, url) {
  const samples = [];
  for (let index = 0; index < sampleSize; index += 1) {
    const context = await browser.newContext();
    const page = await context.newPage();
    samples.push(await collectSample(page, url, index + 1, 'cold'));
    await context.close();
  }
  return samples;
}

async function collectWarmRuns(browser, url) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await collectSample(page, url, 0, 'warmup');
  const samples = [];
  for (let index = 0; index < sampleSize; index += 1) {
    samples.push(await collectSample(page, url, index + 1, 'warm'));
  }
  await context.close();
  return samples;
}

function evaluateRegression(summary, baseline) {
  if (!baseline) {
    return {
      ok: false,
      status: 'missing-baseline',
      violations: ['BOOTSTRAP_BASELINE_MISSING']
    };
  }

  const checks = [
    ['app_bootstrap_ms', baseline.appBootstrapMedianMs],
    ['first_screen_ready_ms', baseline.firstScreenMedianMs]
  ];
  const violations = [];
  const warnings = [];
  checks.forEach(([metric, baselineValue]) => {
    const current = summary?.warm?.[metric]?.median;
    if (typeof current !== 'number' || typeof baselineValue !== 'number') {
      violations.push(`BASELINE_OR_CURRENT_MISSING:${metric}`);
      return;
    }
    if (current > baselineValue * 1.2) violations.push(`FAIL:${metric}:${current}>${round(baselineValue * 1.2)}`);
    else if (current > baselineValue * 1.1) warnings.push(`WARN:${metric}:${current}>${round(baselineValue * 1.1)}`);
  });

  return {
    ok: violations.length === 0,
    status: violations.length ? 'failed' : warnings.length ? 'warning' : 'ok',
    warningThreshold: '+10%',
    failureThreshold: '+20%',
    gateMetrics: ['app_bootstrap_ms', 'first_screen_ready_ms'],
    informativeMetrics: ENVIRONMENT_ONLY_METRICS,
    warnings,
    violations
  };
}

async function runEnvironment(kind, port) {
  if (kind === 'preview' && !existsSync('dist/index.html')) {
    throw new Error('dist/index.html nao encontrado. Execute npm.cmd run build antes do benchmark preview.');
  }
  const url = `http://127.0.0.1:${port}/`;
  const server = startServer(kind, port);
  try {
    await waitForServer(url);
    const browser = await chromium.launch(process.platform === 'win32' ? { channel: 'chrome' } : {});
    const cold = await collectColdRuns(browser, url);
    const warm = await collectWarmRuns(browser, url);
    await browser.close();
    return {
      kind,
      url,
      cold,
      warm,
      summary: {
        cold: summarizeSamples(cold),
        warm: summarizeSamples(warm)
      }
    };
  } finally {
    await stopServer(server);
    await wait(500);
  }
}

const baseline = readBaseline();
const preview = await runEnvironment('preview', previewPort);
const dev = includeDev ? await runEnvironment('dev', devPort) : null;
const regressionAgainstBaseline = evaluateRegression(preview.summary, baseline);

const report = {
  ok: regressionAgainstBaseline.ok,
  wrote: false,
  environment: {
    gate: 'vite preview local build',
    comparison: includeDev ? 'vite dev local server' : 'disabled',
    sampleSize,
    coldDefinition: 'new browser context per sample',
    warmDefinition: 'same browser context after one warmup navigation'
  },
  baseline,
  appControlled: APP_CONTROLLED_METRICS,
  environmentOnly: ENVIRONMENT_ONLY_METRICS,
  preview,
  dev,
  regressionAgainstBaseline
};

console.log(JSON.stringify(report, null, 2));
if (!report.ok) process.exit(1);
