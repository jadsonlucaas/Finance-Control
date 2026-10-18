import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = dirname(dirname(dirname(fileURLToPath(import.meta.url))));

function listSourceFiles() {
  const files = [];
  function walk(dir) {
    for (const name of readdirSync(dir)) {
      const path = `${dir}/${name}`;
      if (path.includes('/node_modules/') || path.includes('/dist/')) continue;
      if (statSync(path).isDirectory()) walk(path);
      else if (/\.(js|mjs)$/.test(name)) files.push(path);
    }
  }
  walk(`${root}/src`);
  return files;
}

describe('resilience architecture', () => {
  it('keeps browser online/offline detection inside the connectivity adapter', () => {
    const offenders = listSourceFiles()
      .filter((file) => /\bonLine\b/.test(readFileSync(file, 'utf8')))
      .map((file) => relative(root, file).replace(/\\/g, '/'));
    expect(offenders).toEqual(['src/services/connectivity/connectivityService.js']);
  });

  it('does not introduce WhatsApp/provider/phone/Admin SDK or new eval in resilience code', () => {
    const source = [
      'src/application/resilience/applicationError.js',
      'src/application/resilience/errorNormalization.js',
      'src/application/resilience/retryPolicy.js',
      'src/application/resilience/executeWithResilience.js',
      'src/application/resilience/errorReporter.js',
      'src/services/connectivity/connectivityService.js'
    ].map((file) => readFileSync(file, 'utf8')).join('\n');
    expect(source).not.toMatch(/twilio|z-api|whatsapp-web|wppconnect|baileys|firebase-admin|new Function|eval\(/i);
  });
});
