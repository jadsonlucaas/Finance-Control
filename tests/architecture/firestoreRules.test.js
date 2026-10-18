import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('Firestore security rules', () => {
  const rules = readFileSync('firestore.rules', 'utf8');

  it('protects user records by authenticated uid and immutable owner fields', () => {
    expect(rules).toContain('match /users/{uid}');
    expect(rules).toContain('match /finance_records/{recordId}');
    expect(rules).toContain('isSelf(uid)');
    expect(rules).toContain('ownerIsImmutable(uid)');
    expect(rules).toContain('request.resource.data.owner_uid == resource.data.owner_uid');
    expect(rules).toContain('let d = request.resource.data');
    expect(rules).toContain("d.keys().hasAll(['type', 'owner_uid', 'owner_email'])");
  });

  it('restricts shared references to admins or owners', () => {
    expect(rules).toContain('match /shared_macros/{docId}');
    expect(rules).toContain('match /shared_categories/{docId}');
    expect(rules).toContain("request.auth.token.admin == true");
    expect(rules).toContain("role in ['admin', 'owner']");
    expect(rules).toContain('exists(userProfileRef(uid))');
  });

  it('validates known finance record types and blocks default access', () => {
    ['saida', 'entrada', 'pessoa', 'categoria', 'macro', 'controle_horas', 'salario_historico', 'percentage_rule'].forEach((type) => {
      expect(rules).toContain(`'${type}'`);
    });
    expect(rules).toContain('match /{document=**}');
    expect(rules).toContain('allow read, write: if false');
  });

  it('allows append-only user audit logs', () => {
    expect(rules).toContain('match /audit_logs/{logId}');
    expect(rules).toContain('isValidAuditLog()');
    expect(rules).toContain('allow update: if false');
  });

  it('validates local cache ownership and user profile lookups safely', () => {
    expect(rules).toContain("request.resource.data.key.matches('^finance-control-.*')");
    expect(rules).toContain('request.resource.data.owner_uid == request.auth.uid');
    expect(rules).toContain('request.resource.data.owner_email is string');
    expect(rules).toContain('userProfileExists(request.auth.uid)');
  });
});
