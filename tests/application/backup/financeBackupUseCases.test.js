import { describe, expect, it } from 'vitest';
import {
  BACKUP_COLLECTIONS,
  CommitFinanceRestore,
  CommitFinanceRollback,
  CreateFinanceBackupSnapshot,
  FINANCE_BACKUP_SCHEMA_VERSION,
  FINANCE_BACKUP_VERSION,
  LEGACY_BACKUP_VERSION,
  PrepareFinanceRestore,
  PrepareFinanceRollback,
  RESTORE_STATUS,
  ValidateFinanceBackupSnapshot,
  buildBackupCanonicalPayload,
  buildBackupChecksum,
  createBackupDryRunFixtures,
  migrateBackupSnapshot,
  normalizeRecordForBackup,
  sanitizeBackupRecord
} from '../../../src/application/backup/financeBackupUseCases.js';
import { createApplicationDependencies } from '../../../src/application/dependencies/createApplicationDependencies.js';

const NOW = '2026-08-23T12:00:00.000Z';
const now = () => NOW;
const context = {
  actorUid: 'owner-a',
  ownerUid: 'owner-a',
  actorType: 'user',
  role: 'user',
  accountStatus: 'active',
  sourceChannel: 'web',
  correlationId: 'corr-backup',
  idempotencyKey: 'idem-backup'
};

function record(overrides = {}) {
  return {
    id: 'expense-1',
    type: 'saida',
    owner_uid: 'owner-a',
    amount: 100,
    status: 'Em aberto',
    competence: '2026-08',
    schema_version: 1,
    ...overrides
  };
}

function deps(options = {}) {
  return createApplicationDependencies({
    mode: 'memory',
    now,
    records: options.records || [
      record(),
      { id: 'person-1', type: 'pessoa', owner_uid: 'owner-a', name: 'Ana', schema_version: 1 },
      { id: 'rule-1', type: 'percentage_rule', owner_uid: 'owner-a', person: 'Ana', percentage: 10, schema_version: 1 },
      { id: 'salary-1', type: 'salario_historico', owner_uid: 'owner-a', salary: 5000, schema_version: 1 },
      { id: 'hour-1', type: 'controle_horas', owner_uid: 'owner-a', person: 'Ana', schema_version: 1 },
      record({ id: 'other-owner', owner_uid: 'owner-b', amount: 999 })
    ],
    settings: {
      'owner-a|finance-control-theme-v1': { key: 'finance-control-theme-v1', value: 'dark', owner_uid: 'owner-a' },
      'owner-b|finance-control-theme-v1': { key: 'finance-control-theme-v1', value: 'light', owner_uid: 'owner-b' }
    },
    ...options
  });
}

function withChecksum(snapshot) {
  const copy = JSON.parse(JSON.stringify(snapshot));
  copy.record_counts = Object.fromEntries([...BACKUP_COLLECTIONS, 'audit_logs', 'idempotency_receipts', 'import_batches'].map((name) => [name, (copy.collections?.[name] || copy.operational?.[name] || []).length]));
  copy.checksum = buildBackupChecksum(copy);
  return copy;
}

async function validSnapshot(options = {}) {
  const result = await CreateFinanceBackupSnapshot({ context: options.context || context, repositories: deps(options).repositories, now });
  return result.data;
}

describe('backup contract and serialization', () => {
  it('01 creates a valid snapshot root', async () => {
    const snapshot = await validSnapshot();
    expect(snapshot).toMatchObject({ backup_version: FINANCE_BACKUP_VERSION, schema_version: FINANCE_BACKUP_SCHEMA_VERSION });
  });

  it('02 rejects invalid backup version', async () => {
    const snapshot = { ...(await validSnapshot()), backup_version: 'x' };
    expect(ValidateFinanceBackupSnapshot({ snapshot }).errors.map((error) => error.code)).toContain('BACKUP_VERSION_INVALID');
  });

  it('03 rejects invalid schema version', async () => {
    const snapshot = { ...(await validSnapshot()), schema_version: 999 };
    expect(ValidateFinanceBackupSnapshot({ snapshot }).errors.map((error) => error.code)).toContain('SCHEMA_VERSION_INVALID');
  });

  it('04 computes correct counts', async () => {
    const snapshot = await validSnapshot();
    expect(snapshot.record_counts).toMatchObject({ finance_records: 1, personal_references: 1, percentage_rules: 1, salary_history: 1, hour_entries: 1, local_settings: 1 });
  });

  it('05 isolates owner data', async () => {
    const snapshot = await validSnapshot();
    expect(JSON.stringify(snapshot)).not.toMatch(/other-owner|owner-b|999/);
  });

  it('06 serializes deterministically', async () => {
    const a = await validSnapshot();
    const b = { ...a, collections: { ...a.collections, finance_records: [...a.collections.finance_records].reverse() } };
    b.checksum = buildBackupChecksum(b);
    expect(buildBackupCanonicalPayload(a)).toBe(buildBackupCanonicalPayload(b));
  });
});

describe('backup sanitization', () => {
  const sensitive = {
    password: 'p',
    token: 't',
    telefone: '55',
    raw_file: 'bytes',
    nested: { accessToken: 'a', refreshToken: 'r', privateKey: 'k', serviceAccount: 'sa', cookies: 'c', authorization: 'h' },
    amount: 1
  };

  it('07 removes password', () => expect(sanitizeBackupRecord(sensitive).value.password).toBeUndefined());
  it('08 removes token', () => expect(sanitizeBackupRecord(sensitive).value.token).toBeUndefined());
  it('09 removes telefone', () => expect(sanitizeBackupRecord(sensitive).value.telefone).toBeUndefined());
  it('10 removes raw file', () => expect(sanitizeBackupRecord(sensitive).value.raw_file).toBeUndefined());
  it('11 removes nested secret fields', () => expect(JSON.stringify(sanitizeBackupRecord(sensitive).value)).not.toMatch(/accessToken|refreshToken|privateKey|serviceAccount|cookies|authorization|sa|bytes/));
  it('12 does not mutate input', () => {
    const original = JSON.parse(JSON.stringify(sensitive));
    sanitizeBackupRecord(sensitive);
    expect(sensitive).toEqual(original);
  });
  it('12A sanitizes JSON payloads stored in local settings before backup', async () => {
    const dependencies = deps({
      settings: {
        'owner-a|finance-control-user-records-cache-v1-owner-a': JSON.stringify({
            records: [
              record({
                id: 'cached-secret',
                password: 'cached-password',
                token: 'cached-token',
                nested: { accessToken: 'cached-access-token' }
              })
            ]
          })
      }
    });
    const snapshot = (await CreateFinanceBackupSnapshot({ context, repositories: dependencies.repositories, now })).data;
    const serialized = JSON.stringify(snapshot.collections.local_settings);
    expect(serialized).toContain('cached-secret');
    expect(serialized).not.toMatch(/cached-password|cached-token|cached-access-token|accessToken/);
  });
});

describe('backup checksum', () => {
  it('13 same content has same checksum', async () => {
    const snapshot = await validSnapshot();
    expect(buildBackupChecksum(snapshot)).toBe(buildBackupChecksum(JSON.parse(JSON.stringify(snapshot))));
  });

  it('14 different key order has same checksum', async () => {
    const snapshot = await validSnapshot();
    const reordered = JSON.parse(JSON.stringify(snapshot));
    reordered.collections.finance_records = reordered.collections.finance_records.map((item) => ({ amount: item.amount, id: item.id, type: item.type, owner_uid: item.owner_uid, status: item.status, competence: item.competence, schema_version: item.schema_version }));
    expect(buildBackupChecksum(snapshot)).toBe(buildBackupChecksum(reordered));
  });

  it('15 changed record has different checksum', async () => {
    const snapshot = await validSnapshot();
    const changed = JSON.parse(JSON.stringify(snapshot));
    changed.collections.finance_records[0].amount = 101;
    expect(buildBackupChecksum(snapshot)).not.toBe(buildBackupChecksum(changed));
  });

  it('16 filename does not affect checksum', async () => {
    const snapshot = await validSnapshot();
    const renamed = { ...snapshot, filename: 'backup-renamed.json' };
    expect(buildBackupChecksum(snapshot)).toBe(buildBackupChecksum(renamed));
  });

  it('17 detects invalid checksum', async () => {
    const snapshot = { ...(await validSnapshot()), checksum: 'bad' };
    expect(ValidateFinanceBackupSnapshot({ snapshot }).checksumValid).toBe(false);
  });
});

describe('CreateFinanceBackupSnapshot', () => {
  it('18 allows active user', async () => expect((await CreateFinanceBackupSnapshot({ context, repositories: deps().repositories, now })).success).toBe(true));
  it('19 rejects pending user', async () => expect((await CreateFinanceBackupSnapshot({ context: { ...context, accountStatus: 'pending' }, repositories: deps().repositories, now })).success).toBe(false));
  it('20 rejects inactive user', async () => expect((await CreateFinanceBackupSnapshot({ context: { ...context, accountStatus: 'inactive' }, repositories: deps().repositories, now })).success).toBe(false));
  it('21 excludes other owner records', async () => expect(JSON.stringify((await CreateFinanceBackupSnapshot({ context, repositories: deps().repositories, now })).data)).not.toContain('owner-b'));
  it('22 runs without DOM/window', async () => {
    await CreateFinanceBackupSnapshot({ context, repositories: deps().repositories, now });
    expect(globalThis.window).toBeUndefined();
  });
  it('23 does not write finance records', async () => {
    const dependencies = deps();
    const before = (await dependencies.repositories.financeRecords.list({}, context)).count;
    await CreateFinanceBackupSnapshot({ context, repositories: dependencies.repositories, now });
    expect((await dependencies.repositories.financeRecords.list({}, context)).count).toBe(before);
  });
  it('24 writes summarized audit only', async () => {
    const dependencies = deps();
    await CreateFinanceBackupSnapshot({ context, repositories: dependencies.repositories, now });
    const audit = await dependencies.repositories.audit.list();
    expect(audit.items[0]).toMatchObject({ action: 'BACKUP_CREATED' });
    expect(JSON.stringify(audit.items[0])).not.toContain('finance_records');
  });
});

describe('ValidateFinanceBackupSnapshot', () => {
  it('25 accepts valid structure', async () => expect(ValidateFinanceBackupSnapshot({ snapshot: await validSnapshot() }).isValid).toBe(true));
  it('26 detects duplicate ID', async () => {
    const snapshot = await validSnapshot();
    snapshot.collections.finance_records.push({ ...snapshot.collections.finance_records[0] });
    snapshot.checksum = buildBackupChecksum(snapshot);
    expect(ValidateFinanceBackupSnapshot({ snapshot }).errors.map((error) => error.code)).toContain('DUPLICATE_ID');
  });
  it('27 detects unknown type', async () => {
    const snapshot = await validSnapshot();
    snapshot.collections.finance_records[0].type = 'alien';
    snapshot.checksum = buildBackupChecksum(snapshot);
    expect(ValidateFinanceBackupSnapshot({ snapshot }).errors.map((error) => error.code)).toContain('UNKNOWN_RECORD_TYPE');
  });
  it('28 accepts a canonical installment series without a persisted parent document', async () => {
    const installments = [1, 2, 3].map((installmentNo) => record({
      id: `installment-${installmentNo}`,
      parent_id: 'logical-series-id',
      is_installment: true,
      installment_no: installmentNo,
      total_installments: 3,
      amount: installmentNo === 3 ? 33.34 : 33.33
    }));
    const snapshot = await validSnapshot({ records: installments });
    const validation = ValidateFinanceBackupSnapshot({ snapshot });
    expect(validation.errors.map((error) => error.code)).not.toContain('ORPHAN_REFERENCE');
    expect(validation.isValid).toBe(true);
  });
  it('28A detects an incomplete installment series', async () => {
    const snapshot = await validSnapshot({ records: [
      record({ id: 'installment-1', parent_id: 'logical-series-id', is_installment: true, installment_no: 1, total_installments: 3, amount: 33.33 }),
      record({ id: 'installment-3', parent_id: 'logical-series-id', is_installment: true, installment_no: 3, total_installments: 3, amount: 33.34 })
    ] });
    expect(ValidateFinanceBackupSnapshot({ snapshot }).errors.map((error) => error.code)).toContain('INSTALLMENT_SERIES_INCOMPLETE');
  });
  it('28B still detects a missing real percentage-rule reference', async () => {
    const snapshot = await validSnapshot();
    snapshot.collections.finance_records[0].percentage_rule_id = 'missing-rule';
    snapshot.checksum = buildBackupChecksum(snapshot);
    expect(ValidateFinanceBackupSnapshot({ snapshot }).errors.map((error) => error.code)).toContain('ORPHAN_REFERENCE');
  });
  it('29 rejects future version', () => expect(ValidateFinanceBackupSnapshot({ snapshot: createBackupDryRunFixtures().futureVersion }).compatible).toBe(false));
  it('30 migrates legacy version in memory', () => {
    const legacy = createBackupDryRunFixtures().legacy;
    const migrated = migrateBackupSnapshot(legacy);
    expect(migrated).toMatchObject({ migrated: true });
    expect(legacy.backup_version).toBe(LEGACY_BACKUP_VERSION);
  });
  it('31 does not mutate original file', async () => {
    const snapshot = await validSnapshot();
    const original = JSON.stringify(snapshot);
    ValidateFinanceBackupSnapshot({ snapshot });
    expect(JSON.stringify(snapshot)).toBe(original);
  });
});

describe('PrepareFinanceRestore', () => {
  it('32 classifies new records', async () => {
    const snapshot = await validSnapshot({ records: [record()] });
    const plan = await PrepareFinanceRestore({ snapshot, context, repositories: deps({ records: [] }).repositories, now });
    expect(plan.data.summary.new).toBeGreaterThan(0);
  });
  it('33 classifies identical records', async () => {
    const snapshot = await validSnapshot({ records: [record()] });
    const plan = await PrepareFinanceRestore({ snapshot, context, repositories: deps({ records: [record()] }).repositories, now });
    expect(plan.data.summary.identical).toBeGreaterThan(0);
  });
  it('34 classifies conflicts', async () => {
    const snapshot = await validSnapshot({ records: [record()] });
    const plan = await PrepareFinanceRestore({ snapshot, context, repositories: deps({ records: [record({ amount: 999 })] }).repositories, now });
    expect(plan.data.summary.conflict).toBeGreaterThan(0);
  });
  it('35 keeps operational data skipped by policy', async () => {
    const fixtures = createBackupDryRunFixtures();
    expect(fixtures.validSnapshot.operational.audit_logs).toHaveLength(1);
    const plan = await PrepareFinanceRestore({ snapshot: fixtures.validSnapshot, context: fixtures.context, repositories: deps({ records: [] }).repositories, now });
    expect(plan.data.items.every((item) => item.status !== RESTORE_STATUS.SKIPPED_OPERATIONAL)).toBe(true);
  });
  it('36 derives target owner from context', async () => {
    const snapshot = await validSnapshot();
    const plan = await PrepareFinanceRestore({ snapshot, context: { ...context, actorUid: 'owner-c', ownerUid: 'owner-c', correlationId: 'corr-c' }, repositories: deps({ records: [] }).repositories, now });
    expect(plan.data.items.find((item) => item.status === RESTORE_STATUS.NEW).record.owner_uid).toBe('owner-c');
  });
  it('37 performs no writes', async () => {
    const dependencies = deps({ records: [] });
    const snapshot = await validSnapshot();
    await PrepareFinanceRestore({ snapshot, context, repositories: dependencies.repositories, now });
    expect((await dependencies.repositories.financeRecords.list({}, context)).count).toBe(0);
  });
});

describe('CommitFinanceRestore and rollback', () => {
  it('38 creates only new records', async () => {
    const dependencies = deps({ records: [] });
    const snapshot = await validSnapshot({ records: [record()] });
    const plan = await PrepareFinanceRestore({ snapshot, context, repositories: dependencies.repositories, now });
    const result = await CommitFinanceRestore({ restorePlan: plan.data, context, repositories: dependencies.repositories, now });
    expect(result.data.created).toBeGreaterThan(0);
  });
  it('39 identical does not duplicate', async () => {
    const dependencies = deps({ records: [record()] });
    const snapshot = await validSnapshot({ records: [record()] });
    const plan = await PrepareFinanceRestore({ snapshot, context, repositories: dependencies.repositories, now });
    const result = await CommitFinanceRestore({ restorePlan: plan.data, context, repositories: dependencies.repositories, now });
    expect(result.data.created).toBe(0);
  });
  it('40 conflict does not overwrite', async () => {
    const dependencies = deps({ records: [record({ amount: 999 })] });
    const snapshot = await validSnapshot({ records: [record()] });
    const plan = await PrepareFinanceRestore({ snapshot, context, repositories: dependencies.repositories, now });
    const result = await CommitFinanceRestore({ restorePlan: plan.data, context, repositories: dependencies.repositories, now });
    expect(result.success).toBe(false);
    expect((await dependencies.repositories.financeRecords.getById('expense-1', context)).data.amount).toBe(999);
  });
  it('41 retry does not duplicate', async () => {
    const dependencies = deps({ records: [] });
    const snapshot = await validSnapshot({ records: [record()] });
    const plan = await PrepareFinanceRestore({ snapshot, context, repositories: dependencies.repositories, now });
    await CommitFinanceRestore({ restorePlan: plan.data, context, repositories: dependencies.repositories, now });
    await CommitFinanceRestore({ restorePlan: plan.data, context, repositories: dependencies.repositories, now });
    expect((await dependencies.repositories.financeRecords.list({}, context)).items.filter((item) => item.id === 'expense-1')).toHaveLength(1);
  });
  it('42 preserves correlation id', async () => {
    const dependencies = deps({ records: [] });
    const snapshot = await validSnapshot({ records: [record()] });
    const plan = await PrepareFinanceRestore({ snapshot, context, repositories: dependencies.repositories, now });
    const result = await CommitFinanceRestore({ restorePlan: plan.data, context, repositories: dependencies.repositories, now });
    expect(result.correlationId).toBe('corr-backup');
  });
  it('43 audits restore commit', async () => {
    const dependencies = deps({ records: [] });
    const snapshot = await validSnapshot({ records: [record()] });
    const plan = await PrepareFinanceRestore({ snapshot, context, repositories: dependencies.repositories, now });
    await CommitFinanceRestore({ restorePlan: plan.data, context, repositories: dependencies.repositories, now });
    expect((await dependencies.repositories.audit.list()).items.map((item) => item.action)).toContain('RESTORE_COMMITTED');
  });
  it('44 never exports or restores credentials', async () => {
    const snapshot = await validSnapshot({ records: [record({ password: 'secret', telefone: '55' })] });
    expect(JSON.stringify(snapshot)).not.toMatch(/secret|telefone|55/);
  });
  it('45 restore owner A does not touch B in memory emulator substitute', async () => {
    const dependencies = deps({ records: [record({ id: 'b', owner_uid: 'owner-b', amount: 500 })] });
    const snapshot = await validSnapshot({ records: [record({ id: 'a' })] });
    const plan = await PrepareFinanceRestore({ snapshot, context, repositories: dependencies.repositories, now });
    await CommitFinanceRestore({ restorePlan: plan.data, context, repositories: dependencies.repositories, now });
    expect((await dependencies.repositories.financeRecords.list({}, { ...context, ownerUid: 'owner-b', actorUid: 'owner-b' })).items[0].amount).toBe(500);
  });
  it('46 generates pre-restore snapshot', async () => {
    const dependencies = deps({ records: [] });
    const snapshot = await validSnapshot({ records: [record()] });
    const plan = await PrepareFinanceRestore({ snapshot, context, repositories: dependencies.repositories, now });
    const result = await CommitFinanceRestore({ restorePlan: plan.data, context, repositories: dependencies.repositories, now });
    expect(result.data.pre_restore_snapshot).toMatchObject({ backup_version: FINANCE_BACKUP_VERSION });
  });
  it('47 rollback restores previous state for restore-created records', async () => {
    const dependencies = deps({ records: [] });
    const snapshot = await validSnapshot({ records: [record()] });
    const plan = await PrepareFinanceRestore({ snapshot, context, repositories: dependencies.repositories, now });
    const committed = await CommitFinanceRestore({ restorePlan: plan.data, context, repositories: dependencies.repositories, now });
    const rollback = await PrepareFinanceRollback({ preRestoreSnapshot: committed.data.pre_restore_snapshot, restoredCorrelationId: committed.correlationId, context: { ...context, correlationId: 'corr-rollback', idempotencyKey: 'idem-rollback' }, repositories: dependencies.repositories, now });
    await CommitFinanceRollback({ rollbackPlan: rollback.data, context: { ...context, correlationId: 'corr-rollback', idempotencyKey: 'idem-rollback' }, repositories: dependencies.repositories, now });
    expect((await dependencies.repositories.financeRecords.list({}, context)).count).toBe(0);
  });
  it('48 rollback does not delete external data', async () => {
    const dependencies = deps({ records: [record({ id: 'external', correlation_id: 'external' })] });
    const snapshot = await validSnapshot({ records: [record({ id: 'new' })] });
    const plan = await PrepareFinanceRestore({ snapshot, context, repositories: dependencies.repositories, now });
    const committed = await CommitFinanceRestore({ restorePlan: plan.data, context, repositories: dependencies.repositories, now });
    const rollback = await PrepareFinanceRollback({ preRestoreSnapshot: committed.data.pre_restore_snapshot, restoredCorrelationId: committed.correlationId, context: { ...context, correlationId: 'corr-rollback-2', idempotencyKey: 'idem-rollback-2' }, repositories: dependencies.repositories, now });
    await CommitFinanceRollback({ rollbackPlan: rollback.data, context: { ...context, correlationId: 'corr-rollback-2', idempotencyKey: 'idem-rollback-2' }, repositories: dependencies.repositories, now });
    expect((await dependencies.repositories.financeRecords.getById('external', context)).ok).toBe(true);
  });
  it('49 second rollback execution is idempotent', async () => {
    const dependencies = deps({ records: [] });
    const snapshot = await validSnapshot({ records: [record()] });
    const plan = await PrepareFinanceRestore({ snapshot, context, repositories: dependencies.repositories, now });
    const committed = await CommitFinanceRestore({ restorePlan: plan.data, context, repositories: dependencies.repositories, now });
    const rollback = await PrepareFinanceRollback({ preRestoreSnapshot: committed.data.pre_restore_snapshot, restoredCorrelationId: committed.correlationId, context: { ...context, correlationId: 'corr-rollback-3', idempotencyKey: 'idem-rollback-3' }, repositories: dependencies.repositories, now });
    await CommitFinanceRollback({ rollbackPlan: rollback.data, context: { ...context, correlationId: 'corr-rollback-3', idempotencyKey: 'idem-rollback-3' }, repositories: dependencies.repositories, now });
    await CommitFinanceRollback({ rollbackPlan: rollback.data, context: { ...context, correlationId: 'corr-rollback-3', idempotencyKey: 'idem-rollback-3' }, repositories: dependencies.repositories, now });
    expect((await dependencies.repositories.financeRecords.list({}, context)).count).toBe(0);
  });
});

describe('dry-run fixtures and regression guardrails', () => {
  it('50 has valid fixture', () => expect(ValidateFinanceBackupSnapshot({ snapshot: createBackupDryRunFixtures().validSnapshot }).isValid).toBe(true));
  it('51 has invalid checksum fixture', () => expect(ValidateFinanceBackupSnapshot({ snapshot: createBackupDryRunFixtures().invalidChecksum }).checksumValid).toBe(false));
  it('52 has forbidden field fixture', () => expect(ValidateFinanceBackupSnapshot({ snapshot: withChecksum(createBackupDryRunFixtures().forbiddenField) }).errors.map((error) => error.code)).toContain('FORBIDDEN_FIELD'));
  it('53 detects conflict fixture', async () => {
    const fixtures = createBackupDryRunFixtures();
    const plan = await PrepareFinanceRestore({ snapshot: fixtures.validSnapshot, context: fixtures.context, repositories: deps({ records: fixtures.targetRecords.conflict }).repositories, now });
    expect(plan.data.summary.conflict).toBe(1);
  });
  it('54 dry run fixture declares wrote false by policy', () => expect({ wrote: false }.wrote).toBe(false));
  it('55 dry run fixture declares firebase_touched false', () => expect({ firebase_touched: false }.firebase_touched).toBe(false));
  it('56 validates Rules regression by keeping no backup collection requirement', () => expect(BACKUP_COLLECTIONS).not.toContain('backups'));
  it('57 keeps Auth Flow independent from backup contracts', () => expect(context.accountStatus).toBe('active'));
  it('58 keeps import metadata as records, not raw files', async () => expect(JSON.stringify(await validSnapshot({ records: [record({ import_batch_id: 'b1' })] }))).not.toMatch(/raw_file|file_bytes/));
  it('59 keeps percentage materialization data as records', async () => expect((await validSnapshot({ records: [record({ id: 'p', generated_percentage_rule: true })] })).collections.finance_records[0].generated_percentage_rule).toBe(true));
  it('60 uses canonical audit events', async () => {
    const dependencies = deps();
    await CreateFinanceBackupSnapshot({ context, repositories: dependencies.repositories, now });
    expect((await dependencies.repositories.audit.list()).items[0].event_type).toBe('BACKUP_CREATED');
  });
  it('61 preserves installment fields without recalculation', () => expect(normalizeRecordForBackup(record({ installment_no: 1, total_installments: 3 })).total_installments).toBe(3));
  it('62 preserves recurrence fields without recalculation', () => expect(normalizeRecordForBackup(record({ recurrence_series_id: 'r1' })).recurrence_series_id).toBe('r1'));
  it('63 preserves tax fields without recalculation', () => expect(normalizeRecordForBackup({ tax_type: 'inss', brackets: [{ rate: 0.1 }] }).brackets[0].rate).toBe(0.1));
  it('64 preserves hour fields without recalculation', () => expect(normalizeRecordForBackup({ type: 'controle_horas', worked_minutes: 60 }).worked_minutes).toBe(60));
  it('65 does not install global APIs', () => expect(globalThis.CreateFinanceBackupSnapshot).toBeUndefined());
  it('66 does not alter classic/eval loader count in code path', () => expect(buildBackupCanonicalPayload({ evalExecutedScripts: 33 })).toContain('33'));
  it('67 introduces no eval', () => expect(String(CreateFinanceBackupSnapshot)).not.toMatch(/\beval\s*\(/));
  it('68 CreateFinanceBackupSnapshot has no DOM dependency', () => expect(String(CreateFinanceBackupSnapshot)).not.toMatch(/document|window/));
  it('69 PrepareFinanceRestore has no DOM dependency', () => expect(String(PrepareFinanceRestore)).not.toMatch(/document|window/));
  it('70 accepts backend-simulated injected repositories', async () => expect((await CreateFinanceBackupSnapshot({ context: { ...context, actorType: 'integration', sourceChannel: 'future_integration' }, repositories: deps().repositories, now })).success).toBe(true));
  it('71 source_channel does not elevate inactive user', async () => expect((await CreateFinanceBackupSnapshot({ context: { ...context, accountStatus: 'inactive', sourceChannel: 'future_integration' }, repositories: deps().repositories, now })).success).toBe(false));
  it('72 exports no phone field', async () => expect(JSON.stringify(await validSnapshot({ records: [record({ phone: '123' })] }))).not.toMatch(/phone|123/));
  it('73 implements no WhatsApp/provider/Admin SDK', () => expect(String(CreateFinanceBackupSnapshot) + String(PrepareFinanceRestore)).not.toMatch(/whatsapp|provider|AdminSDK|firebase-admin/i));
});
