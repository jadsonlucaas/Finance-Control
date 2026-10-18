import { readFileSync } from 'node:fs';
import {
  initializeTestEnvironment
} from '@firebase/rules-unit-testing';
import {
  collection,
  doc,
  getDocs,
  setDoc
} from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { FirebaseWebIdempotencyRepository } from '../../src/application/repositories/idempotencyRepositories.js';

const PROJECT_ID = 'finance-control-idempotency-test';
const NOW = '2026-08-22T12:00:00.000Z';

let testEnv;

function profile(uid, status = 'active') {
  return {
    uid,
    email: `${uid}@example.test`,
    role: 'user',
    status,
    created_at: NOW,
    updated_at: NOW,
    last_login_at: NOW
  };
}

function dbFor(uid) {
  return testEnv.authenticatedContext(uid, { email: `${uid}@example.test` }).firestore();
}

async function seedProfile(uid, status = 'active') {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), `users/${uid}`), profile(uid, status));
  });
}

function repositoryFor(uid) {
  return new FirebaseWebIdempotencyRepository({
    db: dbFor(uid),
    now: () => NOW
  });
}

function input(overrides = {}) {
  return {
    ownerUid: 'active-user',
    commandName: 'CreateExpenseCommand',
    sourceChannel: 'web',
    idempotencyKey: 'idem-emulator-1',
    requestFingerprint: 'fnv1a32:emulator',
    correlationId: 'corr-emulator',
    ...overrides
  };
}

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync('firestore.rules', 'utf8')
    }
  });
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

afterAll(async () => {
  await testEnv.cleanup();
});

describe('FirebaseWebIdempotencyRepository with emulator', () => {
  it('reserves atomically, completes, replays and does not create finance records', async () => {
    await seedProfile('active-user');
    const repository = repositoryFor('active-user');
    const first = await repository.reserve(input(), { ownerUid: 'active-user', actorUid: 'active-user' });
    const processing = await repository.reserve(input(), { ownerUid: 'active-user', actorUid: 'active-user' });
    await repository.complete(first.id, { success: true, code: 'OK', entityId: 'expense-1', entityIds: ['expense-1'] }, {
      ownerUid: 'active-user',
      actorUid: 'active-user',
      correlationId: 'corr-emulator'
    });
    const replay = await repository.reserve(input(), { ownerUid: 'active-user', actorUid: 'active-user' });
    const conflict = await repository.reserve(input({ requestFingerprint: 'fnv1a32:other' }), { ownerUid: 'active-user', actorUid: 'active-user' });
    const financeRecords = await getDocs(collection(dbFor('active-user'), 'users/active-user/finance_records'));

    expect(first.ok).toBe(true);
    expect(first.data.reservation_status).toBe('reserved');
    expect(processing.ok).toBe(false);
    expect(replay.ok).toBe(true);
    expect(replay.data.reservation_status).toBe('replay');
    expect(replay.data.entity_id).toBe('expense-1');
    expect(conflict.ok).toBe(false);
    expect(financeRecords.empty).toBe(true);
  });

  it('allows only one winner for concurrent reserves', async () => {
    await seedProfile('active-user');
    const repository = repositoryFor('active-user');
    const results = await Promise.all([
      repository.reserve(input({ idempotencyKey: 'idem-race' }), { ownerUid: 'active-user', actorUid: 'active-user' }),
      repository.reserve(input({ idempotencyKey: 'idem-race' }), { ownerUid: 'active-user', actorUid: 'active-user' })
    ]);
    const winners = results.filter((result) => result.ok && result.data.reservation_status === 'reserved');
    const blocked = results.filter((result) => !result.ok);

    expect(winners).toHaveLength(1);
    expect(blocked).toHaveLength(1);
  });
});
