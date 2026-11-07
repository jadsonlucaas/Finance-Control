import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { icons } from '../../src/services/icons.js';

function sourceFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(js|html)$/.test(name) ? [path] : [];
  });
}

describe('lucide icon registry', () => {
  it('registers every static data-lucide icon used by the app', () => {
    const missing = new Set();
    for (const file of [...sourceFiles('src'), 'index.html']) {
      for (const match of readFileSync(file, 'utf8').matchAll(/data-lucide="([a-z0-9-]+)"/g)) {
        if (!icons[match[1]]) missing.add(`${match[1]} (${file})`);
      }
    }
    // Icone ausente no registro e renderizado como espaco vazio, sem erro visivel.
    expect([...missing]).toEqual([]);
  });
});
