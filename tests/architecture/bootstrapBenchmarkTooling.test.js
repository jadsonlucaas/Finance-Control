import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('bootstrap benchmark tooling', () => {
  it('keeps the gate strict and closes Windows server process trees', () => {
    const source = readFileSync('scripts/bootstrap-benchmark.mjs', 'utf8');

    expect(source).toContain("gateMetrics: ['app_bootstrap_ms', 'first_screen_ready_ms']");
    expect(source).toContain("summary?.warm?.[metric]?.median");
    expect(source).not.toMatch(/writeFile|appendFile/);
    expect(source).toContain("spawn('taskkill.exe'");
    expect(source).toContain("'/t'");
    expect(source).toContain("'/f'");
  });
});
