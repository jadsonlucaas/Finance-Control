import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { createDefaultApplicationGateway } from '../../../src/application/gateway/defaultApplicationGateway.js';
import { createApplicationDependencies } from '../../../src/application/dependencies/createApplicationDependencies.js';
import {
  AUDIT_REPOSITORY_METHODS,
  FINANCE_RECORD_REPOSITORY_METHODS,
  LOCAL_SETTINGS_REPOSITORY_METHODS,
  SHARED_REFERENCE_REPOSITORY_METHODS,
  USER_PROFILE_REPOSITORY_METHODS,
  assertRepositoryMethods
} from '../../../src/application/repositories/repositoryContracts.js';
import {
  FirebaseAuditRepository,
  FirebaseFinanceRecordRepository,
  FirebaseLocalSettingsRepository,
  FirebaseSharedReferenceRepository,
  FirebaseUserProfileRepository
} from '../../../src/application/repositories/firebaseRepositories.js';
import {
  InMemoryAuditRepository,
  InMemoryFinanceRecordRepository,
  InMemoryLocalSettingsRepository,
  InMemorySharedReferenceRepository,
  InMemoryUserProfileRepository
} from '../../../src/application/repositories/inMemoryRepositories.js';
import { REPOSITORY_ERROR_CODES, RepositoryError, mapUnknownRepositoryError } from '../../../src/application/repositories/repositoryResult.js';

const context = { actorUid: 'user-1', ownerUid: 'user-1', accountStatus: 'active' };

function command(payload = {}) {
  return {
    commandName: 'CreateExpenseCommand',
    schemaVersion: 1,
    actor: { type: 'user', id: 'user-1', role: 'user' },
    source: { channel: 'web', referenceId: 'repo-test' },
    correlationId: 'corr-repo',
    requestedAt: '2026-07-18T12:00:00.000Z',
    payload: {
      person: 'Jadson',
      amount: 10,
      competence: '2026-07',
      occurredDate: '2026-07-10',
      dueDate: '2026-07-10',
      ...payload
    }
  };
}

describe('repository interface contracts', () => {
  it('contracts do not import Firebase, DOM or window and expose expected methods', () => {
    const source = readFileSync('src/application/repositories/repositoryContracts.js', 'utf8');
    expect(source).not.toMatch(/firebase|firestore|window|document|localStorage/i);
    expect(FINANCE_RECORD_REPOSITORY_METHODS).toContain('createMany');
    expect(USER_PROFILE_REPOSITORY_METHODS).toContain('updateStatus');
    expect(SHARED_REFERENCE_REPOSITORY_METHODS).toContain('listEffectiveReferences');
    expect(LOCAL_SETTINGS_REPOSITORY_METHODS).toContain('remove');
    expect(AUDIT_REPOSITORY_METHODS).toContain('getByCorrelationId');
  });

  it('all in-memory repositories satisfy their interfaces', () => {
    assertRepositoryMethods(new InMemoryFinanceRecordRepository(), FINANCE_RECORD_REPOSITORY_METHODS, 'FinanceRecordRepository');
    assertRepositoryMethods(new InMemoryUserProfileRepository(), USER_PROFILE_REPOSITORY_METHODS, 'UserProfileRepository');
    assertRepositoryMethods(new InMemorySharedReferenceRepository(), SHARED_REFERENCE_REPOSITORY_METHODS, 'SharedReferenceRepository');
    assertRepositoryMethods(new InMemoryLocalSettingsRepository(), LOCAL_SETTINGS_REPOSITORY_METHODS, 'LocalSettingsRepository');
    assertRepositoryMethods(new InMemoryAuditRepository(), AUDIT_REPOSITORY_METHODS, 'AuditRepository');
  });
});

describe('in-memory repositories', () => {
  it('supports create/get/update/delete/list queries with owner isolation and deterministic ids', async () => {
    const repository = new InMemoryFinanceRecordRepository({ idGenerator: () => 'fixed-1' });
    const created = await repository.create({ type: 'saida', amount: 10, competence: '2026-07' }, context);
    expect(created).toMatchObject({ ok: true, id: 'fixed-1' });
    expect((await repository.getById('fixed-1', context)).data.amount).toBe(10);
    expect((await repository.update('fixed-1', { amount: 12 }, context)).data.amount).toBe(12);
    expect((await repository.findByType('saida', {}, context)).items).toHaveLength(1);
    expect((await repository.findByCompetence('2026-07', {}, context)).items).toHaveLength(1);
    expect((await repository.list({}, { ownerUid: 'other' })).items).toHaveLength(0);
    expect(await repository.delete('fixed-1', context)).toMatchObject({ ok: true });
    expect(await repository.getById('fixed-1', context)).toMatchObject({ ok: false, code: REPOSITORY_ERROR_CODES.NOT_FOUND });
  });

  it('createMany is atomic under injected failure and returns clones', async () => {
    const repository = new InMemoryFinanceRecordRepository({ idGenerator: (() => { let id = 0; return () => `r${++id}`; })() });
    repository.failNext('createMany', REPOSITORY_ERROR_CODES.UNAVAILABLE);
    const failed = await repository.createMany([{ type: 'saida', amount: 1 }, { type: 'saida', amount: 2 }], context);
    expect(failed).toMatchObject({ ok: false, code: REPOSITORY_ERROR_CODES.UNAVAILABLE });
    expect((await repository.list({}, context)).items).toHaveLength(0);

    const created = await repository.createMany([{ type: 'saida', amount: 1, parent_id: 'serie-1' }, { type: 'saida', amount: 2, parent_id: 'serie-1' }], context);
    created.items[0].amount = 999;
    expect((await repository.findBySeriesId('serie-1', context)).items[0].amount).toBe(1);
  });

  it('covers profile, references, local settings, subscriptions and audit in memory', async () => {
    const profiles = new InMemoryUserProfileRepository();
    expect((await profiles.ensureProfile({ uid: 'user-1', email: 'u@example.test' })).data.status).toBe('pending');
    expect((await profiles.updateStatus('user-1', { status: 'active' })).data.status).toBe('active');
    expect((await profiles.updateRole('user-1', 'admin')).data.role).toBe('admin');

    const refs = new InMemorySharedReferenceRepository();
    await refs.createGlobalReference({ type: 'macro', macro_category: 'Casa' }, context);
    expect((await refs.listEffectiveReferences(context)).items).toHaveLength(1);

    const settings = new InMemoryLocalSettingsRepository();
    await settings.set('theme', 'dark', context);
    expect((await settings.get('theme', context)).data).toBe('dark');
    expect((await settings.list('the', context)).items).toHaveLength(1);
    await settings.remove('theme', context);

    const audit = new InMemoryAuditRepository();
    await audit.append({ action: 'x', correlationId: 'c1' }, context);
    expect((await audit.getByCorrelationId('c1')).items).toHaveLength(1);
  });
});

describe('Firebase Web adapters over current facades', () => {
  it('finance adapter calls dataSdk facade, normalizes query and does not leak FirebaseError', async () => {
    const calls = [];
    const dataSdk = {
      create: vi.fn(async (record) => { calls.push(['create', record]); return { isOk: true, id: 'f1' }; }),
      createMany: vi.fn(async (records) => { calls.push(['createMany', records]); return { isOk: true, ids: ['f2', 'f3'], count: 2 }; }),
      update: vi.fn(async (record) => { calls.push(['update', record]); return { isOk: false, error: 'PERMISSION_DENIED' }; }),
      delete: vi.fn(async () => { throw Object.assign(new Error('FirebaseError: permission-denied'), { code: 'permission-denied' }); })
    };
    const adapter = new FirebaseFinanceRecordRepository({
      dataSdk,
      recordsProvider: () => [{ id: 'f1', type: 'saida', amount: 10, competence: '2026-07', owner_uid: 'user-1', source_channel: 'web', source_reference_id: 'form' }]
    });

    expect(await adapter.create({ type: 'saida', amount: 10 }, context)).toMatchObject({ ok: true, id: 'f1' });
    expect(await adapter.createMany([{ type: 'saida' }, { type: 'saida' }], context)).toMatchObject({ ok: true, ids: ['f2', 'f3'] });
    expect(await adapter.getById('f1', context)).toMatchObject({ ok: true, data: { id: 'f1' } });
    expect(await adapter.update('f1', { amount: 11 }, context)).toMatchObject({ ok: false, code: REPOSITORY_ERROR_CODES.PERMISSION_DENIED });
    expect(await adapter.delete('f1', context)).toMatchObject({ ok: false, code: REPOSITORY_ERROR_CODES.PERMISSION_DENIED });
    expect((await adapter.findBySourceReference('web', 'form', context)).items).toHaveLength(1);
    expect(calls[0][1].owner_uid).toBe('user-1');
  });

  it('finance adapter accepts static facade classes without invoking them as getters', async () => {
    class StaticFinanceFacade {
      static async create(record) {
        return { isOk: true, id: record.id || 'static-1' };
      }
    }

    const adapter = new FirebaseFinanceRecordRepository({
      dataSdk: StaticFinanceFacade,
      recordsProvider: () => []
    });

    await expect(adapter.create({ type: 'saida', amount: 10 }, context))
      .resolves.toMatchObject({ ok: true, id: 'static-1' });
  });

  it('profile, reference, local settings and audit adapters wrap current web facades', async () => {
    const userAdminSdk = {
      getProfile: vi.fn(async (uid) => ({ uid, status: 'active' })),
      ensureProfile: vi.fn(async (user) => ({ uid: user.uid, status: 'pending' })),
      listUsers: vi.fn(async () => [{ uid: 'u1' }]),
      updateUser: vi.fn(async (uid, patch) => ({ isOk: true, uid, ...patch }))
    };
    const profiles = new FirebaseUserProfileRepository({ userAdminSdk });
    expect(await profiles.getByUid('u1')).toMatchObject({ ok: true });
    expect(await profiles.updateStatus('u1', { status: 'inactive' }, context)).toMatchObject({ ok: true });
    expect(await profiles.updateRole('u1', 'admin', context)).toMatchObject({ ok: true });

    const financeRecords = new InMemoryFinanceRecordRepository();
    const refs = new FirebaseSharedReferenceRepository({ financeRecords });
    await refs.createGlobalReference({ type: 'macro', macro_category: 'Global' }, context);
    expect((await refs.listMacros(context)).items).toHaveLength(1);

    const cloudLocalStorageSync = { set: vi.fn(), remove: vi.fn() };
    const localSettings = new FirebaseLocalSettingsRepository({
      cloudLocalStorageSync,
      localSettingsProvider: { length: 1, key: () => 'finance-control-theme-v1', getItem: () => 'dark' }
    });
    expect(await localSettings.set('finance-control-theme-v1', 'dark')).toMatchObject({ ok: true });
    expect((await localSettings.list('finance-control')).items).toHaveLength(1);

    const auditSdk = { log: vi.fn(async () => ({ isOk: true, id: 'audit-1' })) };
    expect(await new FirebaseAuditRepository({ auditSdk }).append({ action: 'x', correlationId: 'corr' }, context))
      .toMatchObject({ ok: true, id: 'audit-1' });
  });
});

describe('dependency composition and gateway repository use', () => {
  it('web mode uses Firebase adapter and missing web dependency fails explicitly', () => {
    expect(() => createApplicationDependencies({ mode: 'web' })).toThrow(/financeRecordDataSdk/);
    const dependencies = createApplicationDependencies({ mode: 'web', financeRecordDataSdk: { create: vi.fn() }, target: { allRecords: [] } });
    expect(dependencies.repositories.financeRecords.adapterType).toBe('firebase-web');
  });

  it('test mode uses in-memory explicitly and future implementations can be injected', async () => {
    const memory = createApplicationDependencies({ mode: 'test', records: [] });
    expect(memory.repositories.financeRecords).toBeInstanceOf(InMemoryFinanceRecordRepository);

    const alternative = {
      create: vi.fn(async (record) => ({ ok: true, id: 'alt-1', data: { ...record, id: 'alt-1' } })),
      createMany: vi.fn(),
      getById: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      list: vi.fn(async () => ({ ok: true, items: [], data: [] })),
      findByType: vi.fn(),
      findByCompetence: vi.fn(),
      findBySeriesId: vi.fn(),
      findBySourceReference: vi.fn()
    };
    const appGateway = createDefaultApplicationGateway({
      dependencies: { repositories: { financeRecords: alternative }, services: {}, clock: { now: () => '2026-07-18T12:00:00.000Z' } },
      now: () => '2026-07-18T12:00:00.000Z',
      authContextProvider: () => context
    });
    const result = await appGateway.executeCommand(command(), { authContext: context });
    expect(result).toMatchObject({ success: true, entityId: 'alt-1' });
    expect(alternative.create).toHaveBeenCalled();
  });

  it('source_channel does not select repository or elevate privileges', async () => {
    const repository = new InMemoryFinanceRecordRepository();
    const appGateway = createDefaultApplicationGateway({ repository, now: () => '2026-07-18T12:00:00.000Z', authContextProvider: () => context });
    const result = await appGateway.executeCommand(command({ source_channel: 'future_integration', owner_uid: 'other' }), { authContext: context });
    expect(result.success).toBe(true);
    expect(result.data.owner_uid).toBe('user-1');
  });

  it('repository errors preserve cause internally without exposing stack as UI message', () => {
    const cause = new Error('FirebaseError: permission-denied with stack');
    const mapped = mapUnknownRepositoryError(new RepositoryError(REPOSITORY_ERROR_CODES.PERMISSION_DENIED, 'Negado', { cause }));
    expect(mapped).toMatchObject({ ok: false, code: REPOSITORY_ERROR_CODES.PERMISSION_DENIED, message: 'Negado' });
    expect(mapped.cause).toBe(cause);
    expect(mapped.message).not.toContain('stack');
  });
});
