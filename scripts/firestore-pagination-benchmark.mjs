import { readFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc, writeBatch } from 'firebase/firestore';
import { FirebaseAuditRepository, FirebaseUserProfileRepository } from '../src/application/repositories/firebaseRepositories.js';
import { FirebaseWebIdempotencyRepository } from '../src/application/repositories/idempotencyRepositories.js';

const projectId = process.env.FIRESTORE_PAGINATION_PROJECT_ID || 'finance-control-pagination-benchmark';
const now = '2026-08-23T12:00:00.000Z';

function profile(uid, overrides = {}) {
  return {
    uid,
    email: `${uid}@example.test`,
    role: 'user',
    status: 'active',
    created_at: now,
    updated_at: now,
    last_login_at: now,
    ...overrides
  };
}

function auditEvent(uid, index) {
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
    result_status: 'success',
    created_at: `2026-08-23T12:${String(Math.floor(index / 60)).padStart(2, '0')}:${String(index % 60).padStart(2, '0')}.000Z`,
    schema_version: 1
  };
}

function receipt(uid, index) {
  return {
    owner_uid: uid,
    command_name: index % 2 === 0 ? 'CreateExpenseCommand' : 'CommitImportBatch',
    source_channel: 'web',
    idempotency_key: `idem-${index}`,
    request_fingerprint: `fnv1a32:${index}`,
    logical_key: `logical-${index}`,
    status: 'completed',
    correlation_id: index % 4 === 0 ? 'corr-a' : 'corr-b',
    created_at: `2026-08-23T13:${String(Math.floor(index / 60)).padStart(2, '0')}:${String(index % 60).padStart(2, '0')}.000Z`,
    expires_at: '2026-08-24T13:00:00.000Z',
    schema_version: 1
  };
}

async function seedMany(testEnv, entries = []) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    for (let offset = 0; offset < entries.length; offset += 400) {
      const batch = writeBatch(db);
      entries.slice(offset, offset + 400).forEach(([path, data]) => batch.set(doc(db, path), data));
      await batch.commit();
    }
  });
}

async function seed(testEnv) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'users/owner-a'), profile('owner-a'));
    await setDoc(doc(context.firestore(), 'users/admin-user'), profile('admin-user', { role: 'admin' }));
  });
  await seedMany(testEnv, [
    ...Array.from({ length: 1000 }, (_, index) => [
      `users/owner-a/audit_logs/audit-${String(index).padStart(4, '0')}`,
      auditEvent('owner-a', index)
    ]),
    ...Array.from({ length: 1000 }, (_, index) => [
      `users/owner-a/idempotency_receipts/receipt-${String(index).padStart(4, '0')}`,
      receipt('owner-a', index)
    ]),
    ...Array.from({ length: 1000 }, (_, index) => [
      `users/user-${String(index).padStart(4, '0')}`,
      profile(`user-${String(index).padStart(4, '0')}`, {
        created_at: `2026-08-23T14:${String(Math.floor(index / 60)).padStart(2, '0')}:${String(index % 60).padStart(2, '0')}.000Z`
      })
    ])
  ]);
}

function cursorIsOpaque(cursor = '') {
  return Boolean(cursor) && !/DocumentSnapshot|QueryDocumentSnapshot|firebase|owner-a|audit-|receipt-/i.test(cursor);
}

async function pageThrough(repository, method, query, context, pages = 10) {
  const started = performance.now();
  const counts = [];
  let cursor = '';
  let last;
  for (let pageNumber = 1; pageNumber <= pages; pageNumber += 1) {
    last = await repository[method]({ ...query, cursor }, context);
    counts.push(last.items?.length || 0);
    cursor = last.nextCursor || '';
  }
  return {
    counts,
    page1: counts[0],
    page2: counts[1],
    page10: counts[9],
    source: last?.pageInfo?.source,
    cursorOpaque: cursorIsOpaque(cursor),
    durationMs: Number((performance.now() - started).toFixed(3))
  };
}

const testEnv = await initializeTestEnvironment({
  projectId,
  firestore: { rules: readFileSync('firestore.rules', 'utf8') }
});

try {
  await testEnv.clearFirestore();
  await seed(testEnv);
  const userDb = testEnv.authenticatedContext('owner-a', { email: 'owner-a@example.test' }).firestore();
  const adminDb = testEnv.authenticatedContext('admin-user', { email: 'admin-user@example.test', admin: true }).firestore();
  const context = { actorUid: 'owner-a', ownerUid: 'owner-a', role: 'user', accountStatus: 'active' };
  const adminContext = { actorUid: 'admin-user', ownerUid: 'admin-user', role: 'admin', accountStatus: 'active' };

  const audit = await pageThrough(
    new FirebaseAuditRepository({ db: userDb }),
    'listByOwner',
    { ownerUid: 'owner-a', limit: 50, orderBy: 'created_at', direction: 'asc' },
    context
  );
  const idempotency = await pageThrough(
    new FirebaseWebIdempotencyRepository({ db: userDb, now: () => now }),
    'list',
    { limit: 50, orderBy: 'created_at', direction: 'asc' },
    context
  );
  const users = await pageThrough(
    new FirebaseUserProfileRepository({ db: adminDb }),
    'listUsers',
    { limit: 50, orderBy: 'created_at', direction: 'asc' },
    adminContext
  );

  console.log(JSON.stringify({
    ok: [audit, idempotency, users].every((item) =>
      item.page1 === 50 && item.page2 === 50 && item.page10 === 50 && item.source === 'firestore' && item.cursorOpaque
    ),
    wrote: false,
    emulator: 'firestore',
    pageLimit: 50,
    auditLogs: audit,
    idempotencyReceipts: idempotency,
    userAdministration: users
  }, null, 2));
} finally {
  await testEnv.cleanup();
}
