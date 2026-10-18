import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function methodBody(source = '', className = '', methodName = '') {
  const classIndex = source.indexOf(`class ${className}`);
  expect(classIndex).toBeGreaterThanOrEqual(0);
  const methodIndex = source.indexOf(`async ${methodName}(`, classIndex);
  expect(methodIndex).toBeGreaterThanOrEqual(0);
  const nextMethod = source.indexOf('\n  async ', methodIndex + 1);
  return source.slice(methodIndex, nextMethod > methodIndex ? nextMethod : source.indexOf('\n}', methodIndex));
}

describe('Firestore pagination architecture contract', () => {
  it('audit adapter has a Firestore limit/startAfter path before local fallback', () => {
    const source = readFileSync('src/application/repositories/firebaseRepositories.js', 'utf8');
    const body = methodBody(source, 'FirebaseAuditRepository', 'list');
    expect(body).toMatch(/getDocs\(firestoreQuery\(collection\(db, `users\/\$\{owner\}\/audit_logs`\)/);
    expect(body).toMatch(/orderBy\(page\.orderBy/);
    expect(body).toMatch(/startAfter\(\.\.\.decoded\.values\)/);
    expect(body).toMatch(/limit\(page\.limit\)/);
    expect(body.indexOf('getDocs(firestoreQuery')).toBeLessThan(body.indexOf('sdk.list'));
  });

  it('idempotency adapter has a Firestore limit/startAfter list path', () => {
    const source = readFileSync('src/application/repositories/idempotencyRepositories.js', 'utf8');
    const body = methodBody(source, 'FirebaseWebIdempotencyRepository', 'list');
    expect(body).toMatch(/collection\(this\.getDb\(\), `users\/\$\{owner\}\/idempotency_receipts`\)/);
    expect(body).toMatch(/where\('command_name'/);
    expect(body).toMatch(/startAfter\(\.\.\.decoded\.values\)/);
    expect(body).toMatch(/limit\(page\.limit\)/);
    expect(body).not.toMatch(/pageItems\(.*snapshot/s);
  });
});
