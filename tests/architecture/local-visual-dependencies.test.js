import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { Chart } from 'chart.js/auto';
import { createIcons } from 'lucide';
import { installLocalVisualLibraries } from '../../src/services/localVisualLibraries.js';
import { icons } from '../../src/services/icons.js';

describe('local visual dependencies', () => {
  it('keeps Chart.js and Lucide out of index.html CDNs', () => {
    const html = readFileSync(resolve('index.html'), 'utf8');

    expect(html).not.toContain('lucide.min.js');
    expect(html).not.toContain('chart.min.js');
    expect(html).not.toContain('cdn.jsdelivr.net/npm/lucide');
    expect(html).not.toContain('cdnjs.cloudflare.com/ajax/libs/Chart.js');
  });

  it('installs local Chart.js and Lucide globals for legacy scripts', () => {
    const target = {};
    installLocalVisualLibraries(target);

    expect(target.Chart).toBe(Chart);
    expect(typeof target.lucide.createIcons).toBe('function');
    expect(target.lucide.icons).toBe(icons);
    expect(target.lucide.icons.wallet).toBeDefined();
    expect(target.lucide.icons['trash-2']).toBeDefined();
    expect(typeof createIcons).toBe('function');
  });
});
