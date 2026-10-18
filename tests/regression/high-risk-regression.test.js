import { describe, expect, it, vi } from 'vitest';
import {
  clearUserScopedLocalData,
  getUserRecordsCacheKey,
  readCachedUserRecords,
  writeCachedUserRecords
} from '../../src/services/dataSdk.js';
import { createMockDataProvider } from '../../src/services/data/providers/mockDataProvider.js';
import { FinanceRepository } from '../../src/domain/FinanceRepository.js';
import {
  buildInstallmentSaidaPayloads,
  buildSaidaPayload
} from '../../src/domain/recordPayloads.js';
import { buildPaidToggleRecord } from '../../src/services/financeRecordMutations.js';
import { buildDashboardInstallmentSummary } from '../../src/ui/dashboard/dashboardCards.js';
import { consolidateMonthlyEntry } from '../../src/domain/entries.js';
import { calcularBancoHoras, calcularHoraExtra } from '../../src/domain/hours.js';
import { buildDashboardMonthlyFinancialTrend } from '../../src/ui/dashboard/dashboardData.js';
import { normalizeCycleValue, normalizeStatusValue, parseCurrencyValue } from '../../src/domain/imports.js';
import {
  ACCOUNT_ROLE,
  ACCOUNT_STATUS,
  buildInitialUserProfile,
  buildAdminUpdatePlan,
  getUserAccessState
} from '../../src/domain/accountLifecycle.js';

const firestoreMock = vi.hoisted(() => {
  const docs = new Map();
  return {
    docs,
    collection: vi.fn((db, ...segments) => ({ db, path: segments.join('/') })),
    doc: vi.fn((db, ...segments) => ({ db, path: segments.join('/') })),
    getDoc: vi.fn(async (ref) => ({
      exists: () => docs.has(ref.path),
      data: () => docs.get(ref.path)
    })),
    getDocs: vi.fn(async () => ({
      docs: [...docs.entries()]
        .filter(([key]) => key.startsWith('users/'))
        .map(([key, value]) => ({
          id: key.split('/').pop(),
          data: () => value
        }))
    })),
    setDoc: vi.fn(async (ref, payload, options = {}) => {
      const current = docs.get(ref.path) || {};
      docs.set(ref.path, options.merge ? { ...current, ...payload } : payload);
    }),
    updateDoc: vi.fn(async (ref, payload) => {
      docs.set(ref.path, { ...(docs.get(ref.path) || {}), ...payload });
    })
  };
});

vi.mock('firebase/firestore', () => firestoreMock);

function createMemoryTarget() {
  const store = new Map();
  return {
    localStorage: {
      get length() {
        return store.size;
      },
      getItem: (key) => store.has(key) ? store.get(key) : null,
      setItem: (key, value) => store.set(String(key), String(value)),
      removeItem: (key) => store.delete(String(key)),
      key: (index) => [...store.keys()][index] || null
    },
    sessionStorage: {
      removeItem: vi.fn()
    }
  };
}

describe('high-risk local regression coverage', () => {
  it('keeps account lifecycle status explicit before financial access', () => {
    const created = buildInitialUserProfile({
      uid: 'new-user',
      email: 'new-user@example.test'
    }, { now: '2026-07-18T10:00:00.000Z' });

    expect(created).toMatchObject({
      uid: 'new-user',
      email: 'new-user@example.test',
      role: ACCOUNT_ROLE.USER,
      status: ACCOUNT_STATUS.PENDING
    });
    expect(getUserAccessState(created).canAccessFinancialData).toBe(false);
    expect(getUserAccessState({ ...created, status: ACCOUNT_STATUS.ACTIVE }).canAccessFinancialData).toBe(true);
    expect(buildAdminUpdatePlan(
      { ...created, status: ACCOUNT_STATUS.PENDING },
      { status: ACCOUNT_STATUS.ACTIVE }
    ).statusAction).toBe('admin.user_approve');
    expect(buildAdminUpdatePlan(
      { ...created, status: ACCOUNT_STATUS.INACTIVE },
      { status: ACCOUNT_STATUS.PENDING }
    )).toMatchObject({ isOk: false, error: 'INVALID_STATUS_TRANSITION' });
  });

  it('isolates cached records and synced local data when switching users', () => {
    const target = createMemoryTarget();
    writeCachedUserRecords(target, 'user-a', [{ id: 'a-only', type: 'saida', amount: 10 }]);
    writeCachedUserRecords(target, 'user-b', [{ id: 'b-only', type: 'entrada', amount: 20 }]);
    target.localStorage.setItem('finance-control-theme-v1', 'dark');
    target.localStorage.setItem('unrelated-key', 'keep');

    expect(readCachedUserRecords(target, 'user-a').records.map((record) => record.id)).toEqual(['a-only']);
    expect(readCachedUserRecords(target, 'user-b').records.map((record) => record.id)).toEqual(['b-only']);

    clearUserScopedLocalData(target);

    expect(target.localStorage.getItem(getUserRecordsCacheKey('user-a'))).toBeNull();
    expect(target.localStorage.getItem(getUserRecordsCacheKey('user-b'))).toBeNull();
    expect(target.localStorage.getItem('finance-control-theme-v1')).toBeNull();
    expect(target.localStorage.getItem('unrelated-key')).toBe('keep');
  });

  it('keeps inactive user and admin permission decisions observable through mocked profile service', async () => {
    const { createUserAdminService } = await import('../../src/services/userAdmin.js');
    firestoreMock.docs.clear();
    firestoreMock.docs.set('users/inactive-user', {
      uid: 'inactive-user',
      email: 'inactive@example.test',
      role: 'user',
      status: 'inactive'
    });
    firestoreMock.docs.set('users/admin-user', {
      uid: 'admin-user',
      email: 'admin@example.test',
      role: 'admin',
      status: 'active'
    });

    const auditService = { logLater: vi.fn() };
    const service = createUserAdminService({}, auditService);

    await expect(service.ensureProfile({ uid: 'inactive-user', email: 'inactive@example.test' }))
      .resolves.toMatchObject({ role: 'user', status: 'inactive' });
    await service.updateUser('inactive-user', { status: 'active' });
    await service.updateUser('admin-user', { role: 'user' });

    expect(firestoreMock.docs.get('users/inactive-user')).toMatchObject({ status: 'active' });
    expect(firestoreMock.docs.get('users/admin-user')).toMatchObject({ role: 'user' });
    expect(auditService.logLater).toHaveBeenCalledWith(
      'admin.user_reactivate',
      expect.objectContaining({
        target_uid: 'inactive-user',
        updated_fields: ['status'],
        previous_status: 'inactive',
        next_status: 'active'
      }),
      expect.objectContaining({ status: 'success', source: 'web_admin' })
    );
  });

  it('audits approval, deactivation and reactivation after successful profile updates', async () => {
    const { createUserAdminService } = await import('../../src/services/userAdmin.js');
    firestoreMock.docs.clear();
    const order = [];
    firestoreMock.updateDoc.mockImplementationOnce(async (ref, payload) => {
      order.push('update-approve');
      firestoreMock.docs.set(ref.path, { ...(firestoreMock.docs.get(ref.path) || {}), ...payload });
    }).mockImplementationOnce(async (ref, payload) => {
      order.push('update-deactivate');
      firestoreMock.docs.set(ref.path, { ...(firestoreMock.docs.get(ref.path) || {}), ...payload });
    }).mockImplementationOnce(async (ref, payload) => {
      order.push('update-reactivate');
      firestoreMock.docs.set(ref.path, { ...(firestoreMock.docs.get(ref.path) || {}), ...payload });
    });
    firestoreMock.docs.set('users/pending-user', {
      uid: 'pending-user',
      email: 'pending@example.test',
      role: 'user',
      status: 'pending'
    });
    const auditService = {
      logLater: vi.fn((action) => order.push(`audit-${action}`))
    };
    const service = createUserAdminService({}, auditService);

    await expect(service.updateUser('pending-user', { status: 'active' }))
      .resolves.toMatchObject({ action: 'admin.user_approve' });
    await expect(service.updateUser('pending-user', { status: 'inactive' }))
      .resolves.toMatchObject({ action: 'admin.user_deactivate' });
    await expect(service.updateUser('pending-user', { status: 'active' }))
      .resolves.toMatchObject({ action: 'admin.user_reactivate' });

    expect(order).toEqual([
      'update-approve',
      'audit-admin.user_approve',
      'update-deactivate',
      'audit-admin.user_deactivate',
      'update-reactivate',
      'audit-admin.user_reactivate'
    ]);
    expect(auditService.logLater).toHaveBeenNthCalledWith(
      1,
      'admin.user_approve',
      expect.objectContaining({
        target_uid: 'pending-user',
        previous_status: 'pending',
        next_status: 'active'
      }),
      expect.objectContaining({ source: 'web_admin', status: 'success' })
    );
  });

  it('audits role changes with before and after values', async () => {
    const { createUserAdminService } = await import('../../src/services/userAdmin.js');
    firestoreMock.docs.clear();
    firestoreMock.docs.set('users/target-user', {
      uid: 'target-user',
      email: 'target@example.test',
      role: 'user',
      status: 'active'
    });
    const auditService = { logLater: vi.fn() };
    const service = createUserAdminService({}, auditService);

    await expect(service.updateUser('target-user', { role: 'admin' }))
      .resolves.toMatchObject({
        action: 'admin.user_role_change',
        previous_role: 'user',
        next_role: 'admin'
      });

    expect(auditService.logLater).toHaveBeenCalledWith(
      'admin.user_role_change',
      expect.objectContaining({
        target_uid: 'target-user',
        target_email: 'target@example.test',
        previous_role: 'user',
        next_role: 'admin',
        previous_status: 'active',
        next_status: 'active'
      }),
      expect.objectContaining({ source: 'web_admin', status: 'success' })
    );
  });

  it('does not write a success audit when the administrative update fails', async () => {
    const { createUserAdminService } = await import('../../src/services/userAdmin.js');
    firestoreMock.docs.clear();
    firestoreMock.docs.set('users/target-user', {
      uid: 'target-user',
      email: 'target@example.test',
      role: 'user',
      status: 'pending'
    });
    firestoreMock.updateDoc.mockRejectedValueOnce(new Error('NETWORK_DOWN'));
    const auditService = { logLater: vi.fn() };
    const service = createUserAdminService({}, auditService);

    await expect(service.updateUser('target-user', { status: 'active' }))
      .rejects.toThrow('NETWORK_DOWN');
    expect(auditService.logLater).not.toHaveBeenCalled();
  });

  it('reports audit failure after the profile update has already been applied', async () => {
    const { createUserAdminService } = await import('../../src/services/userAdmin.js');
    firestoreMock.docs.clear();
    firestoreMock.docs.set('users/target-user', {
      uid: 'target-user',
      email: 'target@example.test',
      role: 'user',
      status: 'pending'
    });
    const auditService = {
      logLater: vi.fn(() => {
        throw new Error('AUDIT_DOWN');
      })
    };
    const service = createUserAdminService({}, auditService);

    await expect(service.updateUser('target-user', { status: 'active' }))
      .rejects.toThrow('AUDIT_DOWN');
    expect(firestoreMock.docs.get('users/target-user')).toMatchObject({ status: 'active' });
  });

  it('creates and edits an expense through the repository using an in-memory provider', async () => {
    const provider = createMockDataProvider();
    FinanceRepository.setDataProvider(provider);
    FinanceRepository.setTarget({ auditSdk: { logLater: vi.fn() } });

    const createdPayload = buildSaidaPayload({
      person: 'Pessoa Teste',
      macro: 'FIXO',
      subcategory: 'Moradia',
      description: 'Aluguel regressao',
      amount: 1500,
      status: 'Em aberto',
      dueDate: '2026-07-10',
      competence: '2026-07',
      cycle: 'INICIO_MES',
      now: new Date('2026-07-01T00:00:00.000Z')
    });
    const created = await FinanceRepository.create(createdPayload);
    const saved = provider.list().find((record) => record.id === created.id);

    await FinanceRepository.update({ ...saved, description: 'Aluguel regressao editado', amount: 1550 });

    expect(provider.list()).toEqual([
      expect.objectContaining({
        id: created.id,
        type: 'saida',
        description: 'Aluguel regressao editado',
        amount: 1550,
        paid_at: ''
      })
    ]);
  });

  it('builds installments and marks a parcel as paid without changing sibling parcels', () => {
    const parcels = buildInstallmentSaidaPayloads({
      person: 'Pessoa Teste',
      macro: 'VARIAVEL',
      subcategory: 'Curso',
      description: 'Curso regressao',
      totalAmount: 600,
      installments: 3,
      baseDueDate: '2026-07-15',
      parentId: 'curso-regressao',
      card: 'Visa',
      now: new Date('2026-07-01T00:00:00.000Z')
    });
    const paidSecondParcel = buildPaidToggleRecord({ ...parcels[1], id: 'p2' }, {
      now: new Date('2026-08-16T00:00:00.000Z')
    });
    const summary = buildDashboardInstallmentSummary([
      { ...parcels[0], id: 'p1' },
      paidSecondParcel,
      { ...parcels[2], id: 'p3' }
    ], '2026-08');

    expect(parcels.map((parcel) => ({
      description: parcel.description,
      amount: parcel.amount,
      status: parcel.status,
      competence: parcel.competence
    }))).toEqual([
      { description: 'Curso regressao (1/3)', amount: 200, status: 'Em aberto', competence: '2026-07' },
      { description: 'Curso regressao (2/3)', amount: 200, status: 'Em aberto', competence: '2026-08' },
      { description: 'Curso regressao (3/3)', amount: 200, status: 'Em aberto', competence: '2026-09' }
    ]);
    expect(paidSecondParcel).toMatchObject({ status: 'Pago', paid_at: '2026-08-16' });
    expect(summary.monthPaidTotal).toBe(200);
    expect(summary.monthOpenTotal).toBe(0);
    expect(summary.totalFutureCommitted).toBe(200);
  });

  it('creates installment batches atomically through repository provider', async () => {
    const provider = createMockDataProvider();
    FinanceRepository.setDataProvider(provider);
    FinanceRepository.setTarget({ auditSdk: { logLater: vi.fn() } });
    const parcels = buildInstallmentSaidaPayloads({
      description: 'Lote atomico',
      totalAmount: 100,
      installments: 3,
      baseDueDate: '2026-07-10',
      parentId: 'batch-series',
      now: new Date('2026-07-01T00:00:00.000Z')
    });

    await expect(FinanceRepository.createMany(parcels)).resolves.toMatchObject({ isOk: true, count: 3 });
    expect(provider.list().map((record) => record.amount)).toEqual([33.33, 33.33, 33.34]);

    const failed = await FinanceRepository.createMany([{ ...parcels[0], __failCreateMany: true }]);
    expect(failed).toMatchObject({ isOk: false, error: 'CREATE_MANY_FAILED' });
    expect(provider.list()).toHaveLength(3);
  });

  it('consolidates entries using work income for taxes while keeping other revenue visible separately', () => {
    const inssBases = [];
    const irrfBases = [];
    const result = consolidateMonthlyEntry({
      records: [
        { id: 'he', type: 'controle_horas', person: 'Jadson', competence: '2026-07', hour_control_type: 'Hora Extra', valorTotalCalculado: 500 },
        { id: 'dsr', type: 'entrada', person: 'Jadson', competence: '2026-07', macro_category: 'Rendimento', subcategory: 'DSR H.E.', amount: 100 },
        { id: 'other', type: 'entrada', person: 'Jadson', competence: '2026-07', macro_category: 'Receita', subcategory: 'Freelance', amount: 1000 }
      ],
      person: 'Jadson',
      competencia: '2026-07',
      salaryInfo: { salario: 5000 },
      calculateInss: (base) => {
        inssBases.push(base);
        return 550;
      },
      calculateIrrf: (base) => {
        irrfBases.push(base);
        return 300;
      }
    });

    expect(result.baseTrabalho).toBe(5600);
    expect(result.outrosProventos).toBe(1000);
    expect(result.baseTotal).toBe(6600);
    expect(inssBases).toEqual([5600]);
    expect(irrfBases).toEqual([5600]);
  });

  it('calculates overtime and time bank movements with deterministic values', () => {
    expect(calcularHoraExtra({ salaryBase: 4400, quantityHours: 2.5, percentage: 50 })).toEqual({
      valorHoraNormal: 20,
      percentualAplicado: 0.5,
      adicional: 10,
      valorHoraExtra: 30,
      totalHoraExtra: 75
    });
    expect(calcularBancoHoras({ quantityHours: 1.75, natureza: 'Credito' })).toEqual({
      debito: 0,
      credito: 1.75,
      saldo: -1.75
    });
  });

  it('keeps dashboard filters restricted by month and person in monthly trend data', () => {
    globalThis.window = {
      formatCompetence: (value) => value
    };

    const trend = buildDashboardMonthlyFinancialTrend({
      entradas: [
        { type: 'entrada', person: 'Ana', competence: '2026-07', amount: 3000 },
        { type: 'entrada', person: 'Ana', competence: '2026-08', amount: 3200 },
        { type: 'entrada', person: 'Bruno', competence: '2026-08', amount: 999 }
      ].filter((record) => record.person === 'Ana'),
      saidas: [
        { type: 'saida', person: 'Ana', competence: '2026-07', status: 'Pago', amount: 1000 },
        { type: 'saida', person: 'Ana', competence: '2026-08', status: 'Em aberto', amount: 1200 },
        { type: 'saida', person: 'Ana', competence: '2026-09', status: 'Pago', amount: 900 },
        { type: 'saida', person: 'Bruno', competence: '2026-08', status: 'Pago', amount: 999 }
      ].filter((record) => record.person === 'Ana')
    }, ['2026-07', '2026-08']);

    expect(trend.months).toEqual(['2026-07', '2026-08']);
    expect(trend.entradas).toEqual([3000, 3200]);
    expect(trend.saidas).toEqual([1000, 1200]);
    expect(trend.balance).toEqual([2000, 2000]);

    delete globalThis.window;
  });

  it('normalizes imported duplicate candidates to the same stable signature fields', () => {
    const rowA = {
      competence: '2026-07',
      cycle: normalizeCycleValue('Inicio do mes'),
      status: normalizeStatusValue('PAGO'),
      amount: parseCurrencyValue('R$ 123,45'),
      description: 'Mercado Teste'
    };
    const rowB = {
      competence: '2026-07',
      cycle: normalizeCycleValue('Início do mês'),
      status: normalizeStatusValue('pago'),
      amount: parseCurrencyValue('123,45'),
      description: 'Mercado Teste'
    };
    const signature = (row) => [
      row.competence,
      row.cycle,
      row.status,
      row.amount.toFixed(2),
      row.description.toLowerCase()
    ].join('|');

    expect(signature(rowA)).toBe(signature(rowB));
  });
});
