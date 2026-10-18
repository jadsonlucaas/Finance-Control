import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const PURE_DIRS = ['src/core', 'src/domain'];
const FORBIDDEN_PATTERNS = [
  { label: 'document access', pattern: /\bdocument\s*\./ },
  { label: 'document lookup', pattern: /\bdocument\s*\[/ },
  { label: 'window access', pattern: /\bwindow\s*\./ },
  { label: 'window lookup', pattern: /\bwindow\s*\[/ },
  { label: 'localStorage', pattern: /\blocalStorage\b/ },
  { label: 'Chart.js', pattern: /\bChart\b/ },
  { label: 'lucide', pattern: /\blucide\b/i },
  { label: 'DOM getElementById', pattern: /\bgetElementById\s*\(/ },
  { label: 'DOM querySelector', pattern: /\bquerySelector(All)?\s*\(/ }
];

function collectJsFiles(relativeDir) {
  const dir = path.join(ROOT, relativeDir);
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return collectJsFiles(path.relative(ROOT, fullPath));
    }
    return entry.isFile() && entry.name.endsWith('.js') ? [fullPath] : [];
  });
}

function lineNumber(source, index) {
  return source.slice(0, index).split(/\r?\n/).length;
}

describe('core/domain purity boundary', () => {
  it('keeps core and domain modules independent from DOM, browser globals and chart libraries', () => {
    const violations = [];

    for (const file of PURE_DIRS.flatMap(collectJsFiles)) {
      const source = fs.readFileSync(file, 'utf8');
      const relative = path.relative(ROOT, file).replace(/\\/g, '/');

      for (const { label, pattern } of FORBIDDEN_PATTERNS) {
        pattern.lastIndex = 0;
        const match = pattern.exec(source);
        if (match) {
          violations.push(`${relative}:${lineNumber(source, match.index)} uses ${label}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });
});
