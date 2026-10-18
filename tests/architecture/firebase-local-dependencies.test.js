import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

function listFiles(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? listFiles(path) : [path];
  });
}

describe('Firebase local dependencies', () => {
  it('does not import Firebase from CDN inside src', () => {
    const offenders = listFiles('src')
      .filter((file) => file.endsWith('.js'))
      .filter((file) => /gstatic\.com\/firebasejs|https:\/\/www\.gstatic\.com\/firebasejs/.test(readFileSync(file, 'utf8')));

    expect(offenders).toEqual([]);
  });

  it('keeps Firebase services on package imports', () => {
    expect(readFileSync('src/services/firebase.js', 'utf8')).toContain("from 'firebase/app'");
    expect(readFileSync('src/services/auth.js', 'utf8')).toContain("from 'firebase/auth'");
    expect(readFileSync('src/services/dataSdk.js', 'utf8')).toContain("from 'firebase/firestore'");
    expect(readFileSync('src/services/userAdmin.js', 'utf8')).toContain("from 'firebase/firestore'");
  });
});
