import { readFileSync } from 'node:fs';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc, writeBatch } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { FirebaseAuditRepository, FirebaseUserProfileRepository } from '../../src/application/repositories/firebaseRepositories.js';
import { FirebaseWebIdempotencyRepository } from '../../src/application/repositories/idempotencyRepositories.js';

const PROJECT_ID = 'finance-control-pagination-test';
const NOW = '2026-08-23T12:00:00.000Z';

let testEnv;

function profile(uid, overrides = {}) {
  return {
    uid,
    email: `${uid}@example.test`,
    role: 'user',
    status: 'active',
    created_at: NOW,
    updated_at: NOW,
    last_login_at: NOW,
    ...overrides
  };
}

function dbFor(uid, claims = {}) {
  return testEnv.authenticatedContext(uid, { email: `${uid}@example.test`, ...claims }).firestore();
}

async function seed(path, data) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), path), data);
  });
}

async function seedMany(entries = []) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    for (let offset = 0; offset < entries.length; offset += 400) {
      const batch = writeBatch(db);
      entries.slice(offset, offset + 400).forEach(([path, data]) => {
        batch.set(doc(db, path), data);
      });
      await batch.commit();
    }
  });
}

async function seedOwner(uid = 'owner-a') {
  await seed(`users/${uid}`, profile(uid));
}

async function seedAdmin(uid = 'admin-user') {
  await seed(`users/${uid}`, profile(uid, { role: 'admin' }));
}

function auditEvent(uid, index, overrides = {}) {
  return {
    event_id: `audit-${String(index).padStart(4, '0')}`,
    event_type: index % 2 === 0 ? 'EXPENSE_CREATED' : 'RESTORE_PREPARED',
    category: index % 5 === 0 ? 'security' : 'finance',
    actor_uid: uid,
    actor_type: 'user',
    actor_role: 'user',
    owner_uid: uid,
    source_channel: 'web',
    correlation_id: index % 3 === 0 ? 'corr-a' : 'corr-b',
    result_status: index % 7 === 0 ? 'failure' : 'success',
    created_at: `2026-08-23T12:${String(Math.floor(index / 60)).padStart(2, '0')}:${String(index % 60).padStart(2, '0')}.000Z`,
    schema_version: 1,
    ...overrides
  };
}

function receipt(uid, index, overrides = {}) {
  return {
    owner_uid: uid,
    command_name: index % 2 === 0 ? 'CreateExpenseCommand' : 'CommitImportBatch',
    source_channel: 'web',
    idempotency_key: `idem-${index}`,
    request_fingerprint: `fnv1a32:${index}`,
    logical_key: `logical-${index}`,
    status: index % 3 === 0 ? 'completed' : 'processing',
    correlation_id: index % 4 === 0 ? 'corr-a' : 'corr-b',
    created_at: `2026-08-23T13:${String(Math.floor(index / 60)).padStart(2, '0')}:${String(index % 60).padStart(2, '0')}.000Z`,
    expires_at: '2026-08-24T13:00:00.000Z',
    schema_version: 1,
    ...overrides
  };
}

async function seedAuditLogs(uid, count = 1000) {
  await seedOwner(uid);
  await seedMany(Array.from({ length: count }, (_, index) => [
    `users/${uid}/audit_logs/audit-${String(index).padStart(4, '0')}`,
    auditEvent(uid, index)
  ]));
}

async function seedReceipts(uid, count = 1000) {
  await seedOwner(uid);
  await seedMany(Array.from({ length: count }, (_, index) => [
    `users/${uid}/idempotency_receipts/receipt-${String(index).padStart(4, '0')}`,
    receipt(uid, index)
  ]));
}

async function seedUsers(count = 1000) {
  await seedAdmin();
  await seedMany(Array.from({ length: count }, (_, index) => [
    `users/user-${String(index).padStart(4, '0')}`,
    profile(`user-${String(index).padStart(4, '0')}`, {
      created_at: `2026-08-23T14:${String(Math.floor(index / 60)).padStart(2, '0')}:${String(index % 60).padStart(2, '0')}.000Z`
    })
  ]));
}

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: readFileSync('firestore.rules', 'utf8') }
  });
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

afterAll(async () => {
  await testEnv.cleanup();
});

describe('Firestore server-side pagination', () => {
  it('audit_logs uses limit and cursor without leaking Firebase snapshots', async () => {
    await seedAuditLogs('owner-a');
    await seedAuditLogs('owner-b', 20);
    const repository = new FirebaseAuditRepository({ db: dbFor('owner-a') });
    const context = { actorUid: 'owner-a', ownerUid: 'owner-a', role: 'user' };
    const first = await repository.listByOwner({ ownerUid: 'owner-a', limit: 50, orderBy: 'created_at', direction: 'asc' }, context);
    const second = await repository.listByOwner({ ownerUid: 'owner-a', limit: 50, orderBy: 'created_at', direction: 'asc', cursor: first.nextCursor }, context);
    let page = first;
    for (let index = 1; index < 10; index += 1) {
      page = await repository.listByOwner({ ownerUid: 'owner-a', limit: 50, orderBy: 'created_at', direction: 'asc', cursor: page.nextCursor }, context);
    }

    expect(first.items).toHaveLength(50);
    expect(second.items).toHaveLength(50);
    expect(page.items).toHaveLength(50);
    expect(first.pageInfo.source).toBe('firestore');
    expect(first.pageInfo.returned).toBe(50);
    expect(new Set(first.items.map((item) => item.id)).intersection?.(new Set(second.items.map((item) => item.id)))?.size || first.items.filter((item) => second.items.some((other) => other.id === item.id)).length).toBe(0);
    expect(first.items.every((item) => item.owner_uid === 'owner-a')).toBe(true);
    expect(second.items.every((item) => item.owner_uid === 'owner-a')).toBe(true);
    expect(first.nextCursor).toBeTruthy();
    expect(first.nextCursor).not.toMatch(/DocumentSnapshot|QueryDocumentSnapshot|firebase|owner-a|audit-/i);
  });

  it('audit_logs sends filters to Firestore and blocks cross-owner pagination', async () => {
    await seedAuditLogs('owner-a');
    await seedAuditLogs('owner-b');
    const repository = new FirebaseAuditRepository({ db: dbFor('owner-a') });
    const filtered = await repository.listByCorrelationId('corr-a', { actorUid: 'owner-a', ownerUid: 'owner-a', role: 'user' }, {
      limit: 50,
      orderBy: 'created_at',
      direction: 'asc'
    });
    const blocked = await repository.listByOwner({ ownerUid: 'owner-b', limit: 50 }, { actorUid: 'owner-a', ownerUid: 'owner-a', role: 'user' });

    expect(filtered.items).toHaveLength(50);
    expect(filtered.items.every((item) => item.correlation_id === 'corr-a')).toBe(true);
    expect(filtered.pageInfo.source).toBe('firestore');
    expect(blocked.ok).toBe(false);
  });

  it('idempotency_receipts uses limit, filters and cursor server-side', async () => {
    await seedReceipts('owner-a');
    await seedReceipts('owner-b', 20);
    const repository = new FirebaseWebIdempotencyRepository({ db: dbFor('owner-a'), now: () => NOW });
    const context = { actorUid: 'owner-a', ownerUid: 'owner-a', role: 'user' };
    const first = await repository.list({ limit: 50, orderBy: 'created_at', direction: 'asc' }, context);
    const second = await repository.list({ limit: 50, orderBy: 'created_at', direction: 'asc', cursor: first.nextCursor }, context);
    const filtered = await repository.list({ limit: 50, orderBy: 'created_at', direction: 'asc', commandName: 'CommitImportBatch' }, context);

    expect(first.items).toHaveLength(50);
    expect(second.items).toHaveLength(50);
    expect(first.pageInfo.source).toBe('firestore');
    expect(second.items.some((item) => first.items.some((previous) => previous.id === item.id))).toBe(false);
    expect(filtered.items).toHaveLength(50);
    expect(filtered.items.every((item) => item.command_name === 'CommitImportBatch')).toBe(true);
    expect(first.nextCursor).not.toMatch(/DocumentSnapshot|QueryDocumentSnapshot|firebase|owner-a|receipt-/i);
    expect(first.items.every((item) => item.owner_uid === 'owner-a')).toBe(true);
  });

  it('user administration list uses Firestore limit and cursor when db is available', async () => {
    await seedUsers();
    const repository = new FirebaseUserProfileRepository({ db: dbFor('admin-user') });
    const first = await repository.listUsers({ limit: 50, orderBy: 'created_at', direction: 'asc' }, {
      actorUid: 'admin-user',
      ownerUid: 'admin-user',
      role: 'admin',
      accountStatus: 'active'
    });
    const second = await repository.listUsers({ limit: 50, orderBy: 'created_at', direction: 'asc', cursor: first.nextCursor }, {
      actorUid: 'admin-user',
      ownerUid: 'admin-user',
      role: 'admin',
      accountStatus: 'active'
    });

    expect(first.items).toHaveLength(50);
    expect(second.items).toHaveLength(50);
    expect(first.pageInfo.source).toBe('firestore');
    expect(second.items.some((item) => first.items.some((previous) => previous.uid === item.uid))).toBe(false);
  });
});
