import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const SEARCH_ROOTS = ['src', 'scripts'];
const ALLOWED = new Set([
  'src/legacy/classicScripts.js'
]);

function walk(entry) {
  const full = path.join(ROOT, entry);
  if (!fs.existsSync(full)) return [];
  const stat = fs.statSync(full);
  if (stat.isFile()) return [full];
  return fs.readdirSync(full, { withFileTypes: true }).flatMap((dirent) => {
    if (['node_modules', 'dist', 'coverage'].includes(dirent.name)) return [];
    const child = path.join(full, dirent.name);
    if (dirent.isDirectory()) return walk(path.relative(ROOT, child));
    return /\.(js|mjs|html)$/.test(dirent.name) ? [child] : [];
  });
}

describe('no new dynamic code execution', () => {
  it('keeps eval/new Function limited to the documented legacy loader', () => {
    const pattern = /\beval\s*\(|new\s+Function\s*\(|(?:^|[^\w.])Function\s*\(/;
    const offenders = SEARCH_ROOTS
      .flatMap(walk)
      .map((file) => path.relative(ROOT, file).replace(/\\/g, '/'))
      .filter((file) => !ALLOWED.has(file))
      .filter((file) => pattern.test(fs.readFileSync(path.join(ROOT, file), 'utf8')));

    expect(offenders).toEqual([]);
  });

  it('does not keep the migrated legacy-events module in the classic eval loader', () => {
    const loader = fs.readFileSync(path.join(ROOT, 'src/legacy/classicScripts.js'), 'utf8');
    expect(loader).not.toContain('src/ui/legacy-events.js');
  });
});
