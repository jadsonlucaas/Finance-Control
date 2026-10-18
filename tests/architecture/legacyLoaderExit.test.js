import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { analyzeLegacyLoader } from '../../scripts/analyze-legacy-loader.mjs';

const DOCUMENTED_REMOVED_SCRIPTS = [
  'src/legacy-globals.js',
  'src/services/libraryLoader.global.js',
  'src/services/performanceMonitor.global.js',
  'src/ui/legacy-ui.js',
  'src/legacy/inline/part-21.js',
  'src/legacy/inline/part-22.js',
  'src/legacy/inline/part-23.js',
  'src/legacy/inline/part-24.js',
  'src/legacy/inline/part-25.js',
  'src/legacy/inline/part-30.js',
  'src/legacy/inline/part-31.js'
];

describe('legacy loader exit boundaries', () => {
  it('removes only documented migrated or retired scripts from the classic eval loader', () => {
    const loader = fs.readFileSync('src/legacy/classicScripts.js', 'utf8');
    DOCUMENTED_REMOVED_SCRIPTS.forEach((script) => {
      expect(loader).not.toContain(script);
    });
    expect(analyzeLegacyLoader()).toMatchObject({
      classicScriptsBefore: 33,
      classicScriptsAfter: 22,
      evalExecutedBefore: 33,
      evalExecutedAfter: 22,
      ok: true
    });
  });

  it('keeps reusable layers independent from legacy scripts and dynamic code execution', () => {
    const result = analyzeLegacyLoader();
    expect(result.layerViolations).toEqual([]);
    expect(result.newEval).toEqual([]);
    expect(result.newFunction).toEqual([]);
    expect(result.globals).toBeLessThanOrEqual(50);
  });
});
