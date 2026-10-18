import { readFileSync } from 'node:fs';
import {
  initializeTestEnvironment
} from '@firebase/rules-unit-testing';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  runTransaction,
  setDoc,
  updateDoc
} from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { FirebaseAuditRepository, FirebaseFinanceRecordRepository } from '../../src/application/repositories/firebaseRepositories.js';
import { FirebaseWebIdempotencyRepository } from '../../src/application/repositories/idempotencyRepositories.js';
import { MaterializePercentageRulesForCompetence } from '../../src/application/useCases/percentageRuleMaterializationUseCases.js';
import {
  buildPercentageOccurrenceEntityId,
  buildPercentageOccurrenceKey
} from '../../src/domain/percentage-rules.js';

const PROJECT_ID = 'finance-control-pct-materialization-race';
const OWNER_UID = 'pct-owner';
const OWNER_EMAIL = `${OWNER_UID}@example.test`;
const COMPETENCE = '2026-06';
const NOW = '2026-08-22T12:00:00.000Z';

let testEnv;

function profile(uid = OWNER_UID, overrides = {}) {
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

function personRecord(overrides = {}) {
  return {
    id: 'person-ana',
    type: 'pessoa',
    person: 'Ana',
    salary_base: 5000,
    receiving_type: 'mensal',
    owner_uid: OWNER_UID,
    owner_email: OWNER_EMAIL,
    ...overrides
  };
}

function percentageRule(overrides = {}) {
  return {
    id: 'rule-reserva-ana',
    type: 'percentage_rule',
    name: 'Reserva Ana',
    person: 'Ana',
    percentage: 10,
    base: 'salario',
    macro: 'RESERVA',
    category: 'Investimentos',
    cycle: 'INICIO_MES',
    status: 'active',
    startCompetence: '2026-01',
    endCompetence: '',
    active: true,
    owner_uid: OWNER_UID,
    owner_email: OWNER_EMAIL,
    ...overrides
  };
}

function dbFor(uid = OWNER_UID) {
  return testEnv.authenticatedContext(uid, { email: `${uid}@example.test` }).firestore();
}

function financeCollection(db, uid = OWNER_UID) {
  return collection(db, 'users', uid, 'finance_records');
}

function financeDoc(db, id, uid = OWNER_UID) {
  return doc(db, 'users', uid, 'finance_records', id);
}

function auditCollection(db, uid = OWNER_UID) {
  return collection(db, 'users', uid, 'audit_logs');
}

function idempotencyCollection(db, uid = OWNER_UID) {
  return collection(db, 'users', uid, 'idempotency_receipts');
}

async function seedBaseRecords() {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, `users/${OWNER_UID}`), profile());
    await setDoc(financeDoc(db, 'person-ana'), personRecord());
    await setDoc(financeDoc(db, 'rule-reserva-ana'), percentageRule());
  });
}

async function listFinanceRecords(db, uid = OWNER_UID) {
  const snapshot = await getDocs(financeCollection(db, uid));
  return snapshot.docs.map((recordDoc) => ({ id: recordDoc.id, ...recordDoc.data() }));
}

async function listAuditLogs(db, uid = OWNER_UID) {
  const snapshot = await getDocs(auditCollection(db, uid));
  return snapshot.docs.map((recordDoc) => ({ id: recordDoc.id, ...recordDoc.data() }));
}

async function listReceipts(db, uid = OWNER_UID) {
  const snapshot = await getDocs(idempotencyCollection(db, uid));
  return snapshot.docs.map((recordDoc) => ({ id: recordDoc.id, ...recordDoc.data() }));
}

function createFirestoreDataSdk({ db, auth }) {
  async function createIfAbsent(record = {}) {
    const user = auth.currentUser;
    if (!user) throw new Error('AUTH_REQUIRED');
    const { id, ...data } = record;
    if (!id) throw new Error('Documento precisa de um ID deterministico');
    const payload = {
      ...data,
      owner_uid: user.uid,
      owner_email: user.email || ''
    };
    const ref = financeDoc(db, id, user.uid);
    const result = await runTransaction(db, async (transaction) => {
      const snapshot = await transaction.get(ref);
      if (snapshot.exists()) return { alreadyExists: true, data: snapshot.data() };
      transaction.set(ref, payload);
      return { created: true };
    });
    if (result.alreadyExists) return { isOk: false, error: 'ALREADY_EXISTS', id, data: result.data };
    await addDoc(auditCollection(db, user.uid), {
      action: 'finance_record.create',
      actor_uid: user.uid,
      actor_email: user.email || '',
      created_at: NOW,
      status: 'success',
      source: payload.source_channel || 'system',
      details: {
        entity_id: id,
        type: payload.type,
        source_channel: payload.source_channel || '',
        correlation_id: payload.correlation_id || ''
      }
    });
    return { isOk: true, id, data: { ...payload, id } };
  }

  return {
    async list(query = {}, context = {}) {
      const records = await listFinanceRecords(db, context.ownerUid || context.actorUid || auth.currentUser.uid);
      return records.filter((record) => {
        if (query.type && record.type !== query.type) return false;
        if (query.competence && record.competence !== query.competence) return false;
        if (query.sourceChannel && record.source_channel !== query.sourceChannel) return false;
        if (query.sourceReferenceId && record.source_reference_id !== query.sourceReferenceId) return false;
        return true;
      });
    },
    createIfAbsent,
    async create(record = {}) {
      return createIfAbsent(record);
    },
    async update(record = {}) {
      const user = auth.currentUser;
      if (!user) throw new Error('AUTH_REQUIRED');
      const { id, ...data } = record;
      if (!id) throw new Error('Documento precisa de um ID');
      await updateDoc(financeDoc(db, id, user.uid), {
        ...data,
        owner_uid: user.uid,
        owner_email: user.email || ''
      });
      return { isOk: true, id };
    }
  };
}

function createFirestoreAuditSdk({ db, auth }) {
  return {
    async log(action, details = {}, context = {}) {
      const uid = context.ownerUid || context.actorUid || auth.currentUser?.uid || '';
      if (!uid) return { isOk: false, error: 'AUDIT_AUTH_REQUIRED' };
      const docRef = await addDoc(auditCollection(db, uid), {
        action,
        actor_uid: context.actorUid || uid,
        actor_email: auth.currentUser?.email || `${uid}@example.test`,
        created_at: NOW,
        status: 'success',
        source: context.sourceChannel || 'system',
        details
      });
      return { isOk: true, id: docRef.id };
    }
  };
}

function context(correlationId = 'pct-race') {
  return {
    actorUid: OWNER_UID,
    ownerUid: OWNER_UID,
    actorType: 'user',
    accountStatus: 'active',
    correlationId,
    sourceChannel: 'system'
  };
}

function dependencies(db, options = {}) {
  const auth = { currentUser: { uid: OWNER_UID, email: OWNER_EMAIL } };
  const dataSdk = createFirestoreDataSdk({ db, auth });
  return {
    repositories: {
      financeRecords: new FirebaseFinanceRecordRepository({ dataSdk }),
      idempotency: new FirebaseWebIdempotencyRepository({ db, now: () => NOW }),
      audit: new FirebaseAuditRepository({ auditSdk: createFirestoreAuditSdk({ db, auth }) })
    },
    hooks: options.hooks || {}
  };
}

async function materialize(db, correlationId = 'pct-race', options = {}) {
  return MaterializePercentageRulesForCompetence({
    input: { competence: COMPETENCE },
    context: context(correlationId),
    dependencies: dependencies(db, options),
    now: () => NOW
  });
}

function expectedOccurrence() {
  const base = {
    ownerUid: OWNER_UID,
    ruleId: 'rule-reserva-ana',
    personId: 'person-ana',
    competence: COMPETENCE
  };
  return {
    key: buildPercentageOccurrenceKey(base),
    id: buildPercentageOccurrenceEntityId(base)
  };
}

function materialized(records = []) {
  return records.filter((record) =>
    record.type === 'saida' &&
    record.generated_percentage_rule === true &&
    record.percentage_rule_id === 'rule-reserva-ana' &&
    record.competence === COMPETENCE
  );
}

function createdCount(results = []) {
  return results.reduce((total, result) => total + Number(result.data?.created || 0), 0);
}

function occurrenceStatuses(results = []) {
  return results.flatMap((result) => result.data?.occurrences || []).map((occurrence) => occurrence.status);
}

async function expectSingleOccurrence(db, { amount = 500, status = 'Em aberto', paidAt = '' } = {}) {
  const { id, key } = expectedOccurrence();
  const records = await listFinanceRecords(db);
  const occurrences = materialized(records);
  const directSnapshot = await getDoc(financeDoc(db, id));

  expect(occurrences).toHaveLength(1);
  expect(directSnapshot.exists()).toBe(true);
  expect(occurrences[0].id).toBe(id);
  expect(occurrences[0].percentage_occurrence_key).toBe(key);
  expect(occurrences[0].amount).toBe(amount);
  expect(occurrences[0].status).toBe(status);
  expect(occurrences[0].paid_at || '').toBe(paidAt);
  expect(records.filter((record) => record.percentage_occurrence_key === key)).toHaveLength(1);
  expect(records.filter((record) =>
    record.type === 'saida' &&
    record.generated_percentage_rule === true &&
    record.percentage_rule_id === 'rule-reserva-ana' &&
    record.id !== id
  )).toHaveLength(0);
  return occurrences[0];
}

async function expectSingleCreationAudit(db) {
  const logs = await listAuditLogs(db);
  expect(logs.filter((log) => log.action === 'finance_record.create')).toHaveLength(1);
  expect(logs.filter((log) => log.action === 'PERCENTAGE_RULE_OCCURRENCE_CREATED').length).toBeLessThanOrEqual(1);
  expect(logs.filter((log) => log.action === 'PERCENTAGE_RULE_MATERIALIZATION_STARTED').length).toBeGreaterThanOrEqual(1);
  expect(JSON.stringify(logs)).not.toMatch(/password|accessToken|refreshToken|token/i);
  return logs;
}

async function expectCompletedReceipt(db) {
  const receipts = await listReceipts(db);
  expect(receipts).toHaveLength(1);
  expect(receipts[0]).toMatchObject({
    status: 'completed',
    entity_id: expectedOccurrence().id,
    idempotency_key: `percentage-materialization:rule-reserva-ana:person-ana:${COMPETENCE}`,
    source_channel: 'system'
  });
  expect(receipts[0].request_fingerprint).toBeTruthy();
  return receipts[0];
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
  await seedBaseRecords();
});

afterAll(async () => {
  await testEnv.cleanup();
});

describe('percentage rule materialization concurrency with Firestore Emulator', () => {
  it('keeps one deterministic occurrence for two concurrent executions', async () => {
    const db = dbFor();
    const { id, key } = expectedOccurrence();
    const results = await Promise.all([
      materialize(db, 'pct-race-2a'),
      materialize(db, 'pct-race-2b')
    ]);

    expect(results.every((result) => result.success)).toBe(true);
    expect(createdCount(results)).toBe(1);
    expect(occurrenceStatuses(results)).toEqual(expect.arrayContaining(['created']));
    expect(occurrenceStatuses(results).filter((status) => status === 'created')).toHaveLength(1);
    expect(occurrenceStatuses(results).some((status) =>
      ['idempotency_conflict', 'idempotent_replay', 'already_existing_race', 'already_existing'].includes(status)
    )).toBe(true);
    await expectSingleOccurrence(db);
    await expectSingleCreationAudit(db);
    const receipt = await expectCompletedReceipt(db);
    expect(receipt.correlation_id).toMatch(/^pct-race-2/);
    expect((await listFinanceRecords(db)).filter((record) => record.percentage_occurrence_key === key)).toHaveLength(1);
  });

  it('keeps one deterministic occurrence for three concurrent executions', async () => {
    const db = dbFor();
    const results = await Promise.all([
      materialize(db, 'pct-race-3a'),
      materialize(db, 'pct-race-3b'),
      materialize(db, 'pct-race-3c')
    ]);

    expect(results.every((result) => result.success)).toBe(true);
    expect(createdCount(results)).toBe(1);
    expect(occurrenceStatuses(results).filter((status) => status === 'created')).toHaveLength(1);
    await expectSingleOccurrence(db);
    await expectSingleCreationAudit(db);
    expect(await listReceipts(db)).toHaveLength(1);
  });

  it('recovers a processing receipt after a controlled crash between create and complete', async () => {
    const db = dbFor();
    await expect(materialize(db, 'pct-crash', {
      hooks: {
        afterCreateBeforeReceiptComplete: async () => {
          throw new Error('CONTROLLED_CRASH_AFTER_CREATE');
        }
      }
    })).rejects.toThrow('CONTROLLED_CRASH_AFTER_CREATE');

    const afterCrashReceipt = (await listReceipts(db))[0];
    const afterCrashOccurrence = await expectSingleOccurrence(db);
    expect(afterCrashOccurrence.source_channel).toBe('system');
    expect(afterCrashReceipt.status).toBe('processing');

    const retry = await materialize(db, 'pct-crash-retry');
    expect(retry.success).toBe(true);
    expect(retry.data).toMatchObject({ created: 0, alreadyExisting: 1 });
    expect(retry.data.occurrences[0].status).toBe('already_existing');

    const completed = await expectCompletedReceipt(db);
    expect(completed.result_code).toBe('RECONCILED_EXISTING');
    await expectSingleOccurrence(db);
    const logs = await expectSingleCreationAudit(db);
    expect(logs.filter((log) => log.action === 'PERCENTAGE_RULE_RECEIPT_RECONCILED')).toHaveLength(1);
  });

  it('keeps two concurrent retries safe after an orphan processing receipt', async () => {
    const db = dbFor();
    await expect(materialize(db, 'pct-crash-concurrent', {
      hooks: {
        afterCreateBeforeReceiptComplete: async () => {
          throw new Error('CONTROLLED_CRASH_AFTER_CREATE');
        }
      }
    })).rejects.toThrow('CONTROLLED_CRASH_AFTER_CREATE');

    const results = await Promise.all([
      materialize(db, 'pct-crash-concurrent-retry-a'),
      materialize(db, 'pct-crash-concurrent-retry-b')
    ]);

    expect(results.every((result) => result.success)).toBe(true);
    expect(results.reduce((total, result) => total + Number(result.data?.created || 0), 0)).toBe(0);
    expect(results.reduce((total, result) => total + Number(result.data?.alreadyExisting || 0), 0)).toBe(2);
    await expectSingleOccurrence(db);
    await expectCompletedReceipt(db);
    const logs = await expectSingleCreationAudit(db);
    expect(logs.filter((log) => log.action === 'PERCENTAGE_RULE_RECEIPT_RECONCILED').length).toBeLessThanOrEqual(1);
  });

  it('does not reconcile a processing receipt with an incompatible deterministic occurrence', async () => {
    const db = dbFor();
    await expect(materialize(db, 'pct-conflict-seed', {
      hooks: {
        afterCreateBeforeReceiptComplete: async () => {
          throw new Error('CONTROLLED_CRASH_AFTER_CREATE');
        }
      }
    })).rejects.toThrow('CONTROLLED_CRASH_AFTER_CREATE');

    const { id, key } = expectedOccurrence();
    await testEnv.withSecurityRulesDisabled(async (contextWithoutRules) => {
      const adminDb = contextWithoutRules.firestore();
      await setDoc(financeDoc(adminDb, id), {
        ...personRecord({
          id,
          type: 'saida',
          person: 'Ana',
          amount: 999,
          status: 'Em aberto',
          competence: COMPETENCE,
          generated_percentage_rule: true,
          percentage_rule_id: 'other-rule',
          percentage_occurrence_key: `${key}:mismatch`,
          owner_uid: OWNER_UID,
          owner_email: OWNER_EMAIL
        })
      });
    });

    const retry = await materialize(db, 'pct-conflict-retry');
    const receipts = await listReceipts(db);
    const snapshot = await getDoc(financeDoc(db, id));

    expect(retry.success).toBe(false);
    expect(retry.code).toBe('CONFLICT');
    expect(retry.data.occurrences[0].status).toBe('existing_mismatch');
    expect(receipts).toHaveLength(1);
    expect(receipts[0].status).toBe('processing');
    expect(snapshot.data()).toMatchObject({
      amount: 999,
      percentage_rule_id: 'other-rule',
      percentage_occurrence_key: `${key}:mismatch`
    });
  });

  it('retries after a completed materialization without overwriting the occurrence', async () => {
    const db = dbFor();
    const first = await materialize(db, 'pct-retry-first');
    const second = await materialize(db, 'pct-retry-second');

    expect(first.data).toMatchObject({ created: 1, alreadyExisting: 0 });
    expect(second.data).toMatchObject({ created: 0, alreadyExisting: 1 });
    expect(second.data.occurrences[0].status).toBe('already_existing');
    await expectSingleOccurrence(db);
    await expectSingleCreationAudit(db);
    expect(await listReceipts(db)).toHaveLength(1);
  });

  it('preserves a paid occurrence on later materialization', async () => {
    const db = dbFor();
    const repositories = dependencies(db).repositories;
    await materialize(db, 'pct-paid-first');
    const { id } = expectedOccurrence();
    const current = await expectSingleOccurrence(db);
    const update = await repositories.financeRecords.update(id, {
      ...current,
      status: 'Pago',
      paid_at: '2026-06-05',
      amount: 700
    }, context('pct-paid-update'));
    const retry = await materialize(db, 'pct-paid-retry');

    expect(update.ok).toBe(true);
    expect(retry.data).toMatchObject({ created: 0, alreadyExisting: 1 });
    expect(retry.data.occurrences[0].warnings).toEqual(expect.arrayContaining([
      'PAID_OCCURRENCE_PRESERVED',
      'DIVERGENT_AMOUNT_PRESERVED'
    ]));
    await expectSingleOccurrence(db, { amount: 700, status: 'Pago', paidAt: '2026-06-05' });
    await expectSingleCreationAudit(db);
  });

  it('preserves a manually edited occurrence on later materialization', async () => {
    const db = dbFor();
    const repositories = dependencies(db).repositories;
    await materialize(db, 'pct-edit-first');
    const { id } = expectedOccurrence();
    const current = await expectSingleOccurrence(db);
    const update = await repositories.financeRecords.update(id, {
      ...current,
      amount: 321.45,
      subcategory: 'Investimentos editado',
      category_name: 'Investimentos editado',
      percentage_materialization_manual_edit: true
    }, context('pct-edit-update'));
    const retry = await materialize(db, 'pct-edit-retry');

    expect(update.ok).toBe(true);
    expect(retry.data).toMatchObject({ created: 0, alreadyExisting: 1 });
    expect(retry.data.occurrences[0].status).toBe('existing_preserved_with_warning');
    expect(retry.data.occurrences[0].warnings).toEqual(expect.arrayContaining([
      'MANUALLY_EDITED_OCCURRENCE_PRESERVED',
      'DIVERGENT_AMOUNT_PRESERVED',
      'DIVERGENT_CATEGORY_PRESERVED'
    ]));
    await expectSingleOccurrence(db, { amount: 321.45 });
    await expectSingleCreationAudit(db);
  });
});
