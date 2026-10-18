import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

function normalizeSlash(value = '') {
  return value.replace(/\\/g, '/');
}

function walk(entry) {
  if (!fs.existsSync(entry)) return [];
  const stat = fs.statSync(entry);
  if (stat.isFile()) return [entry];
  return fs.readdirSync(entry, { withFileTypes: true }).flatMap((dirent) => {
    const full = path.join(entry, dirent.name);
    return dirent.isDirectory() ? walk(full) : [full];
  });
}

const MODERN_UI_ENTRIES = [
  'src/ui/importacao.js',
  'src/ui/monthDetail/monthDetailEvents.js',
  'src/ui/records/financialCrudControllerInstaller.js',
  'src/ui/imports',
  'src/ui/monthDetail',
  'src/ui/records',
  'src/ui/settings',
  'src/ui/admin',
  'src/ui/planner',
  'src/ui/hours',
  'src/ui/reports',
  'src/ui/backup'
];

describe('modern UI financeUI consumers', () => {
  it('does not depend on the legacy financeUI bridge or consumer adapter namespace', () => {
    const offenders = MODERN_UI_ENTRIES.flatMap((entry) => walk(entry))
      .filter((file) => /\.(js|mjs)$/.test(file))
      .flatMap((file) => {
        const source = fs.readFileSync(file, 'utf8');
        return [...source.matchAll(/\b(?:window\.)?financeUI\b|\bfinanceUiAdapters\b/g)].map((match) => {
          const line = source.slice(0, match.index).split(/\r?\n/).length;
          return `${normalizeSlash(file)}:${line}:${match[0]}`;
        });
      });

    expect(offenders).toEqual([]);
  });
});
