import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { APPLICATION_RESULT_CODES } from '../../../src/application/gateway/applicationResult.js';
import {
  ArchiveExpense,
  ConsolidateMonthlyIncome,
  CreateExpense,
  CreateHourEntry,
  CreateIncome,
  CreateInstallmentSeries,
  CreateRecurrenceSeries,
  DeleteExpense,
  MarkExpenseAsPaid,
  UpdateExpense,
  UpdateHourEntry
} from '../../../src/application/useCases/financeRecordUseCases.js';
import {
  InMemoryAuditRepository,
  InMemoryFinanceRecordRepository
} from '../../../src/application/repositories/inMemoryRepositories.js';
import { REPOSITORY_ERROR_CODES } from '../../../src/application/repositories/repositoryResult.js';

const NOW = '2026-07-18T12:00:00.000Z';
const now = () => NOW;

function context(overrides = {}) {
  return {
    actorUid: 'user-1',
    actorType: 'user',
    role: 'user',
    accountStatus: 'active',
    ownerUid: 'user-1',
    sourceChannel: 'web',
    sourceReferenceId: 'test',
    correlationId: 'corr-use-case',
    idempotencyKey: 'idem-use-case',
    requestedAt: NOW,
    ...overrides
  };
}

function envelope(overrides = {}) {
  return {
    actor: { type: 'user', id: 'user-1', role: 'user' },
    source: { channel: 'web', referenceId: 'test' },
    correlationId: 'corr-use-case',
    idempotencyKey: 'idem-use-case',
    requestedAt: NOW,
    ...overrides
  };
}

function expenseInput(overrides = {}) {
  return {
    person: 'Jadson',
    macro: 'Casa',
    subcategory: 'Energia',
    description: 'Conta de luz',
    amount: 150.25,
    status: 'Em aberto',
    paymentMethod: 'Pix',
    occurredDate: '2026-07-10',
    dueDate: '2026-07-20',
    competence: '2026-07',
    ...overrides
  };
}

function incomeInput(overrides = {}) {
  return {
    person: 'Jadson',
    amount: 1000,
    competence: '2026-07',
    earningType: 'Salario',
    ...overrides
  };
}

function deps(records = [], options = {}) {
  const financeRecords = options.financeRecords || new InMemoryFinanceRecordRepository({
    records,
    idGenerator: (() => {
      let sequence = 0;
      return () => `uc-${++sequence}`;
    })(),
    now
  });
  const audit = options.audit || new InMemoryAuditRepository({ idGenerator: () => `audit-${Date.now()}` });
  return {
    repositories: { financeRecords, audit },
    services: options.services || {}
  };
}

async function auditEvents(audit) {
  return (await audit.list()).items;
}

describe('financial use case layer structure', () => {
  it('does not import DOM, window, Firebase or external messaging providers', () => {
    const source = readFileSync('src/application/useCases/financeRecordUseCases.js', 'utf8');
    expect(source).not.toMatch(/\bwindow\b|\bdocument\b|dataSdk|firebase|firestore|toast|modal|css/i);
    expect(source).not.toMatch(/webhook|whatsapp|telefone|phone|firebase-admin|admin sdk/i);
  });

  it('keeps command handlers thin and free from persistence or business engines', () => {
    const source = readFileSync('src/application/gateway/financeCommandHandlers.js', 'utf8');
    expect(source).toMatch(/runUseCase/);
    expect(source).not.toMatch(/dataSdk|firebase|firestore|CalculateWorkSession|buildInstallmentSaidaPayloads|buildRecurringSaidaPayloads|consolidatePersonMonthlyEntry/);
  });
});

describe('base financial use case contract', () => {
  it('rejects missing, pending and inactive contexts while allowing active users', async () => {
    const dependencies = deps();
    await expect(CreateExpense({ input: expenseInput(), context: context({ actorUid: '', ownerUid: '' }), dependencies, now }))
      .resolves.toMatchObject({ success: false, code: APPLICATION_RESULT_CODES.FORBIDDEN });
    await expect(CreateExpense({ input: expenseInput(), context: context({ accountStatus: 'pending' }), dependencies, now }))
      .resolves.toMatchObject({ success: false, code: APPLICATION_RESULT_CODES.FORBIDDEN });
    await expect(CreateExpense({ input: expenseInput(), context: context({ accountStatus: 'inactive' }), dependencies, now }))
      .resolves.toMatchObject({ success: false, code: APPLICATION_RESULT_CODES.FORBIDDEN });
    await expect(CreateExpense({ input: expenseInput(), context: context(), dependencies, now }))
      .resolves.toMatchObject({ success: true, correlationId: '' });
  });

  it('derives owner and source metadata from context, preserving correlation and idempotency values', async () => {
    const dependencies = deps();
    const result = await CreateExpense({
      input: expenseInput({ owner_uid: 'other', source_channel: 'future_integration' }),
      context: context({ ownerUid: 'owner-from-context', sourceChannel: 'future_integration', sourceReferenceId: 'server-job' }),
      envelope: envelope({ source: { channel: 'future_integration', referenceId: 'server-job' } }),
      dependencies,
      now
    });
    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({
      owner_uid: 'owner-from-context',
      source_channel: 'future_integration',
      source_reference_id: 'server-job',
      correlation_id: 'corr-use-case',
      idempotency_key: 'idem-use-case'
    });
    expect(result.data.amount).toBe(150.25);
  });
});

describe('expense use cases', () => {
  it('creates valid expenses, blocks invalid input, normalizes repository errors and audits only after persistence', async () => {
    const dependencies = deps();
    const created = await CreateExpense({ input: expenseInput(), context: context(), dependencies, now });
    expect(created).toMatchObject({ success: true, entityId: 'uc-1' });
    expect(created.data.schema_version).toBe(1);
    expect(await auditEvents(dependencies.repositories.audit)).toHaveLength(1);

    const invalid = await CreateExpense({ input: expenseInput({ amount: 'abc' }), context: context(), dependencies, now });
    expect(invalid).toMatchObject({ success: false, code: APPLICATION_RESULT_CODES.VALIDATION_ERROR });
    expect((await dependencies.repositories.financeRecords.list({}, context())).items).toHaveLength(1);

    dependencies.repositories.financeRecords.failNext('create', REPOSITORY_ERROR_CODES.UNAVAILABLE);
    const failed = await CreateExpense({ input: expenseInput({ description: 'Falha repo' }), context: context(), dependencies, now });
    expect(failed).toMatchObject({ success: false, code: APPLICATION_RESULT_CODES.PERSISTENCE_ERROR });
    expect(await auditEvents(dependencies.repositories.audit)).toHaveLength(1);
  });

  it('updates only the target expense, preserves owner/type/series metadata and audits before after', async () => {
    const dependencies = deps([
      { id: 's1', type: 'saida', amount: 100, description: 'A', parent_id: 'p1', owner_uid: 'user-1' },
      { id: 's2', type: 'saida', amount: 200, description: 'B', parent_id: 'p1', owner_uid: 'user-1' }
    ]);
    const result = await UpdateExpense({
      input: { id: 's1', fields: { amount: 111, owner_uid: 'user-1' } },
      context: context(),
      dependencies,
      now
    });
    expect(result).toMatchObject({ success: true, entityId: 's1' });
    expect(result.data.amount).toBe(111);
    expect((await dependencies.repositories.financeRecords.getById('s2', context())).data.amount).toBe(200);
    expect((await auditEvents(dependencies.repositories.audit))[0]).toMatchObject({
      action: 'finance_record.update',
      entityId: 's1'
    });

    await expect(UpdateExpense({ input: { id: 's1', fields: { type: 'entrada' } }, context: context(), dependencies, now }))
      .resolves.toMatchObject({ success: false, code: APPLICATION_RESULT_CODES.BUSINESS_RULE_ERROR });
    await expect(UpdateExpense({ input: { id: 's1', fields: { owner_uid: 'other' } }, context: context(), dependencies, now }))
      .resolves.toMatchObject({ success: false, code: APPLICATION_RESULT_CODES.BUSINESS_RULE_ERROR });
    await expect(UpdateExpense({ input: { id: 's1', fields: { parent_id: 'p2' } }, context: context(), dependencies, now }))
      .resolves.toMatchObject({ success: false, code: APPLICATION_RESULT_CODES.BUSINESS_RULE_ERROR });
    await expect(UpdateExpense({ input: { id: 's1', fields: { amount: 222 } }, context: context({ ownerUid: 'other' }), dependencies, now }))
      .resolves.toMatchObject({ success: false, code: APPLICATION_RESULT_CODES.NOT_FOUND });
  });

  it('marks as paid idempotently without changing siblings or duplicating audit', async () => {
    const dependencies = deps([
      { id: 's1', type: 'saida', amount: 100, status: 'Em aberto', parent_id: 'p1', owner_uid: 'user-1' },
      { id: 's2', type: 'saida', amount: 200, status: 'Em aberto', parent_id: 'p1', owner_uid: 'user-1' }
    ]);
    const paid = await MarkExpenseAsPaid({ input: { expenseId: 's1', paidAt: '2026-07-25' }, context: context(), dependencies, now });
    expect(paid.data).toMatchObject({ status: 'Pago', paid_at: '2026-07-25', amount: 100 });
    expect((await dependencies.repositories.financeRecords.getById('s2', context())).data.status).toBe('Em aberto');
    expect(await auditEvents(dependencies.repositories.audit)).toHaveLength(1);

    const replay = await MarkExpenseAsPaid({ input: { expenseId: 's1', paidAt: '2026-07-25' }, context: context(), dependencies, now });
    expect(replay).toMatchObject({ success: true, idempotentReplay: true });
    expect(await auditEvents(dependencies.repositories.audit)).toHaveLength(1);
  });

  it('archives idempotently and deletes only one occurrence from a series', async () => {
    const dependencies = deps([
      { id: 's1', type: 'saida', amount: 100, status: 'Em aberto', parent_id: 'p1', owner_uid: 'user-1' },
      { id: 's2', type: 'saida', amount: 200, status: 'Em aberto', parent_id: 'p1', owner_uid: 'user-1' }
    ]);
    expect(await ArchiveExpense({ input: { id: 's1' }, context: context(), dependencies, now }))
      .toMatchObject({ success: true, entityId: 's1' });
    expect(await ArchiveExpense({ input: { id: 's1' }, context: context(), dependencies, now }))
      .toMatchObject({ success: true, idempotentReplay: true });
    expect(await DeleteExpense({ input: { id: 's1' }, context: context(), dependencies, now }))
      .toMatchObject({ success: true, entityId: 's1' });
    expect((await dependencies.repositories.financeRecords.getById('s2', context())).data.id).toBe('s2');
    dependencies.repositories.financeRecords.failNext('delete', REPOSITORY_ERROR_CODES.PERMISSION_DENIED);
    expect(await DeleteExpense({ input: { id: 's2' }, context: context(), dependencies, now }))
      .toMatchObject({ success: false, code: APPLICATION_RESULT_CODES.FORBIDDEN });
  });
});

describe('income, consolidation, installments and recurrence use cases', () => {
  it('creates income with metadata and rejects invalid income without persistence', async () => {
    const dependencies = deps();
    expect(await CreateIncome({ input: incomeInput(), context: context(), dependencies, now }))
      .toMatchObject({ success: true, data: { type: 'entrada', source_channel: 'web' } });
    expect(await CreateIncome({ input: incomeInput({ amount: Number.NaN }), context: context(), dependencies, now }))
      .toMatchObject({ success: false, code: APPLICATION_RESULT_CODES.VALIDATION_ERROR });
    expect((await dependencies.repositories.financeRecords.findByType('entrada', {}, context())).items).toHaveLength(1);
  });

  it('consolidates explicit competence with versioned tax engine and without historical mutation', async () => {
    const dependencies = deps([
      { id: 'p1', type: 'pessoa', person: 'Jadson', salary_base: 5000, owner_uid: 'user-1' },
      { id: 'other-1', type: 'entrada', person: 'Jadson', competence: '2026-07', amount: 300, earning_type: 'Outras receitas', subcategory: 'Outras receitas', owner_uid: 'user-1' }
    ]);
    const before = (await dependencies.repositories.financeRecords.list({}, context())).items.length;
    const result = await ConsolidateMonthlyIncome({ input: { person: 'Jadson', competence: '2026-07' }, context: context(), dependencies, now });
    expect(result.success).toBe(true);
    expect(result.data.competencia).toBe('2026-07');
    expect(result.data.baseTrabalho).toBe(5000);
    expect(result.data.inss_parameter_version || result.data.irrf_parameter_version).toBeTruthy();
    expect((await dependencies.repositories.financeRecords.list({}, context())).items).toHaveLength(before);
  });

  it('delegates installment and recurrence generation to domain builders and persists atomically with createMany', async () => {
    const financeRecords = new InMemoryFinanceRecordRepository({ idGenerator: (() => { let id = 0; return () => `series-${++id}`; })() });
    const dependencies = deps([], { financeRecords });
    const createManySpy = vi.spyOn(financeRecords, 'createMany');
    const installment = await CreateInstallmentSeries({
      input: { ...expenseInput({ amount: 300 }), installments: 3, totalAmount: 300, baseDueDate: '2026-07-10', parentId: 'p1' },
      context: context(),
      dependencies,
      now
    });
    expect(installment.entityIds).toHaveLength(3);
    expect(createManySpy).toHaveBeenCalled();
    expect(installment.data.reduce((sum, record) => sum + record.amount, 0)).toBe(300);

    financeRecords.failNext('createMany', REPOSITORY_ERROR_CODES.UNAVAILABLE);
    const before = (await financeRecords.list({}, context())).items.length;
    const failed = await CreateRecurrenceSeries({
      input: { ...expenseInput({ amount: 80 }), recurrence: 'Mensal', frequency: 'monthly', recurrence_count: 2, baseDueDate: '2026-07-15', seriesId: 'r1' },
      context: context(),
      dependencies,
      now
    });
    expect(failed).toMatchObject({ success: false, code: APPLICATION_RESULT_CODES.PERSISTENCE_ERROR });
    expect((await financeRecords.list({}, context())).items).toHaveLength(before);

    const recurrence = await CreateRecurrenceSeries({
      input: { ...expenseInput({ amount: 80 }), recurrence: 'Mensal', frequency: 'monthly', recurrence_count: 2, baseDueDate: '2026-07-15', seriesId: 'r1' },
      context: context(),
      dependencies,
      now
    });
    expect(recurrence.entityIds).toHaveLength(2);
  });
});

describe('hour entry use cases and server-side simulation', () => {
  it('creates and updates hour records through CalculateWorkSession and effective salary records', async () => {
    const dependencies = deps([
      { id: 'p1', type: 'pessoa', person: 'Jadson', salary_base: 2200, owner_uid: 'user-1' }
    ]);
    const created = await CreateHourEntry({
      input: { person: 'Jadson', competence: '2026-07', occurredDate: '2026-07-22', startTime: '18:00', endTime: '20:00', hourControlType: 'Hora Extra', overtimePercentage: 0.5 },
      context: context(),
      dependencies,
      now
    });
    expect(created).toMatchObject({ success: true, data: { type: 'controle_horas', net_minutes: 120 } });
    expect(created.data.amount).toBeGreaterThan(0);

    const updated = await UpdateHourEntry({
      input: { id: created.entityId, fields: { endTime: '21:00', overtimePercentage: 0.5 } },
      context: context(),
      dependencies,
      now
    });
    expect(updated).toMatchObject({ success: true, data: { net_minutes: 180 } });
    expect((await auditEvents(dependencies.repositories.audit)).map((event) => event.action))
      .toEqual(expect.arrayContaining(['finance_record.create_hour_entry', 'finance_record.update_hour_entry']));
  });

  it('keeps the hour record persisted when audit append fails after the financial commit', async () => {
    const dependencies = deps([
      { id: 'p1', type: 'pessoa', person: 'Jadson', salary_base: 2200, owner_uid: 'user-1' }
    ]);
    dependencies.repositories.audit.failNext('append', REPOSITORY_ERROR_CODES.UNAVAILABLE);

    const created = await CreateHourEntry({
      input: { person: 'Jadson', competence: '2026-07', occurredDate: '2026-07-22', startTime: '08:00', endTime: '17:00', hourControlType: 'Banco de Horas' },
      context: context(),
      dependencies,
      now
    });
    const records = await dependencies.repositories.financeRecords.findByType('controle_horas', {}, context());
    const audits = await auditEvents(dependencies.repositories.audit);

    expect(created).toMatchObject({ success: true, data: { type: 'controle_horas', net_minutes: 540 } });
    expect(created.warnings).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: 'audit', code: REPOSITORY_ERROR_CODES.UNAVAILABLE })
    ]));
    expect(records).toMatchObject({ count: 1 });
    expect(audits).toHaveLength(0);
  });

  it('runs principal use cases with future integration context and no external identity fields', async () => {
    const dependencies = deps([
      { id: 'p1', type: 'pessoa', person: 'Jadson', salary_base: 2200, owner_uid: 'user-1' }
    ]);
    const serverContext = context({
      actorType: 'integration',
      trusted: true,
      sourceChannel: 'future_integration',
      sourceReferenceId: 'server-command'
    });
    const createdExpense = await CreateExpense({ input: expenseInput(), context: serverContext, dependencies, now });
    const createdIncome = await CreateIncome({ input: incomeInput(), context: serverContext, dependencies, now });
    const createdHour = await CreateHourEntry({
      input: { person: 'Jadson', competence: '2026-07', occurredDate: '2026-07-22', startTime: '18:00', endTime: '20:00', hourControlType: 'Hora Extra', overtimePercentage: 0.5 },
      context: serverContext,
      dependencies,
      now
    });
    expect([createdExpense.success, createdIncome.success, createdHour.success]).toEqual([true, true, true]);
    expect(JSON.stringify([createdExpense.data, createdIncome.data, createdHour.data])).not.toMatch(/whatsapp|telefone|phone/i);
  });
});
