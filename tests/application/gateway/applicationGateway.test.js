import { describe, expect, it } from 'vitest';
import {
  normalizeCommandEnvelope,
  normalizeQueryEnvelope,
  validateApplicationEnvelope
} from '../../../src/application/gateway/applicationEnvelope.js';
import { APPLICATION_RESULT_CODES, createApplicationResult } from '../../../src/application/gateway/applicationResult.js';
import { authorizeApplicationAction } from '../../../src/application/gateway/authorization.js';
import { ApplicationCommandGateway } from '../../../src/application/gateway/ApplicationCommandGateway.js';
import { createDefaultApplicationGateway } from '../../../src/application/gateway/defaultApplicationGateway.js';
import { COMMAND_CONTRACTS } from '../../../src/application/gateway/financeCommandHandlers.js';
import { QUERY_CONTRACTS } from '../../../src/application/gateway/financeQueryHandlers.js';
import { InMemoryFinanceRepository } from '../../../src/application/gateway/InMemoryFinanceRepository.js';
import { InMemoryIdempotencyStore } from '../../../src/application/gateway/idempotency.js';

const NOW = '2026-07-18T12:00:00.000Z';
const now = () => NOW;

function auth(overrides = {}) {
  return {
    actorUid: 'user-1',
    actorType: 'user',
    role: 'user',
    accountStatus: 'active',
    ownerUid: 'user-1',
    permissions: [],
    ...overrides
  };
}

function command(name, payload = {}, overrides = {}) {
  return {
    commandName: name,
    schemaVersion: 1,
    actor: { type: 'user', id: 'user-1', role: 'user' },
    source: { channel: 'web', referenceId: 'test' },
    correlationId: 'corr-1',
    requestedAt: NOW,
    payload,
    ...overrides
  };
}

function query(name, payload = {}, overrides = {}) {
  return {
    queryName: name,
    schemaVersion: 1,
    actor: { type: 'user', id: 'user-1', role: 'user' },
    source: { channel: 'web', referenceId: 'test' },
    correlationId: 'corr-q',
    requestedAt: NOW,
    payload,
    ...overrides
  };
}

function expensePayload(overrides = {}) {
  return {
    person: 'Jadson',
    macroCategory: 'Casa',
    categoryName: 'Energia',
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

function incomePayload(overrides = {}) {
  return {
    person: 'Jadson',
    amount: 1000,
    competence: '2026-07',
    occurredDate: '2026-07-05',
    earningType: 'Salario',
    ...overrides
  };
}

function gateway(repository = new InMemoryFinanceRepository(), options = {}) {
  return createDefaultApplicationGateway({
    repository,
    now,
    idempotencyStore: options.idempotencyStore || new InMemoryIdempotencyStore(now),
    authContextProvider: () => auth(options.authContext || {})
  });
}

describe('application gateway contracts', () => {
  it('normalizes command envelopes with deterministic requestedAt', () => {
    const envelope = normalizeCommandEnvelope({ commandName: 'CreateExpenseCommand' }, { now });
    expect(envelope).toMatchObject({
      commandName: 'CreateExpenseCommand',
      schemaVersion: 1,
      source: { channel: 'web', referenceId: '' },
      requestedAt: NOW
    });
  });

  it('normalizes query envelopes without idempotencyKey', () => {
    const envelope = normalizeQueryEnvelope({ queryName: 'GetMonthlySummaryQuery', idempotencyKey: 'x' }, { now });
    expect(envelope.queryName).toBe('GetMonthlySummaryQuery');
    expect(envelope.idempotencyKey).toBeUndefined();
  });

  it('rejects invalid actor type and source channel, including whatsapp', () => {
    const envelope = command('CreateExpenseCommand', {}, {
      actor: { type: 'bot', id: 'x', role: 'user' },
      source: { channel: 'whatsapp', referenceId: 'x' }
    });
    const validation = validateApplicationEnvelope(envelope, 'command');
    expect(validation.isValid).toBe(false);
    expect(validation.errors.map((item) => item.field)).toEqual(expect.arrayContaining(['actor.type', 'source.channel']));
  });

  it('standardizes application result shape and codes', () => {
    expect(createApplicationResult({ success: true, correlationId: 'c', processedAt: NOW })).toEqual({
      success: true,
      code: APPLICATION_RESULT_CODES.OK,
      message: 'Operacao concluida.',
      entityId: '',
      entityIds: [],
      data: null,
      warnings: [],
      validationErrors: [],
      applicationError: null,
      idempotentReplay: false,
      correlationId: 'c',
      processedAt: NOW
    });
  });

  it('keeps explicit command and query contract names registered in documentation source', () => {
    expect(Object.keys(COMMAND_CONTRACTS)).toEqual(expect.arrayContaining([
      'CreateExpenseCommand',
      'UpdateExpenseCommand',
      'MarkExpenseAsPaidCommand',
      'ArchiveExpenseCommand',
      'DeleteExpenseCommand',
      'CreateIncomeCommand',
      'ConsolidateMonthlyIncomeCommand',
      'CreateInstallmentSeriesCommand',
      'CreateRecurrenceSeriesCommand',
      'CreateHourEntryCommand',
      'UpdateHourEntryCommand'
    ]));
    expect(Object.keys(QUERY_CONTRACTS)).toEqual(expect.arrayContaining([
      'GetMonthlySummaryQuery',
      'GetOpenExpensesQuery',
      'GetExpenseByIdQuery',
      'GetIncomeByIdQuery',
      'GetInstallmentSeriesQuery',
      'GetRecurrenceSeriesQuery',
      'GetHourSummaryQuery',
      'GetEffectiveCategoriesQuery',
      'GetEffectiveMacrosQuery'
    ]));
  });

  it('returns structured NOT_FOUND for unknown command and query', async () => {
    const appGateway = gateway();
    await expect(appGateway.executeCommand(command('MissingCommand'), { authContext: auth() }))
      .resolves.toMatchObject({ success: false, code: APPLICATION_RESULT_CODES.NOT_FOUND, correlationId: 'corr-1' });
    await expect(appGateway.executeQuery(query('MissingQuery'), { authContext: auth() }))
      .resolves.toMatchObject({ success: false, code: APPLICATION_RESULT_CODES.NOT_FOUND, correlationId: 'corr-q' });
  });

  it('authorizes active owner and rejects pending or inactive financial commands', () => {
    expect(authorizeApplicationAction(auth(), 'CreateExpenseCommand', { ownerUid: 'user-1' }).success).toBe(true);
    expect(authorizeApplicationAction(auth({ accountStatus: 'pending' }), 'CreateExpenseCommand', { ownerUid: 'user-1' }))
      .toMatchObject({ success: false, code: APPLICATION_RESULT_CODES.FORBIDDEN });
    expect(authorizeApplicationAction(auth({ accountStatus: 'inactive' }), 'CreateExpenseCommand', { ownerUid: 'user-1' }))
      .toMatchObject({ success: false, code: APPLICATION_RESULT_CODES.FORBIDDEN });
  });

  it('does not allow source channel or payload ownerUid to elevate access', async () => {
    const appGateway = gateway(new InMemoryFinanceRepository(), { authContext: auth({ ownerUid: 'owner-a' }) });
    const result = await appGateway.executeCommand(command('CreateExpenseCommand', {
      ...expensePayload(),
      owner_uid: 'owner-b'
    }, {
      source: { channel: 'future_integration', referenceId: 'server' }
    }), { authContext: auth({ ownerUid: 'owner-a' }) });
    expect(result.success).toBe(true);
    expect(result.data.owner_uid).toBe('owner-a');
  });

  it('requires trusted integration context for future_integration', () => {
    expect(authorizeApplicationAction(auth({ actorType: 'integration' }), 'CreateExpenseCommand', { ownerUid: 'user-1' }))
      .toMatchObject({ success: false, code: APPLICATION_RESULT_CODES.FORBIDDEN });
    expect(authorizeApplicationAction(auth({ actorType: 'integration', trusted: true }), 'CreateExpenseCommand', { ownerUid: 'user-1' }).success)
      .toBe(true);
  });

  it('creates, updates and marks an expense as paid through the gateway', async () => {
    const repository = new InMemoryFinanceRepository();
    const appGateway = gateway(repository);
    const created = await appGateway.executeCommand(command('CreateExpenseCommand', expensePayload()), { authContext: auth() });
    expect(created).toMatchObject({ success: true, code: APPLICATION_RESULT_CODES.OK, correlationId: 'corr-1' });
    expect(created.data.type).toBe('saida');

    const updated = await appGateway.executeCommand(command('UpdateExpenseCommand', {
      id: created.entityId,
      fields: { amount: 175.5 }
    }), { authContext: auth() });
    expect(updated).toMatchObject({ success: true, entityId: created.entityId });
    expect(updated.data.amount).toBe(175.5);

    const paid = await appGateway.executeCommand(command('MarkExpenseAsPaidCommand', {
      id: created.entityId,
      paidAt: '2026-07-21'
    }), { authContext: auth() });
    expect(paid.data.status).toBe('Pago');
    expect(paid.data.paid_at).toBe('2026-07-21');
  });

  it('archives and deletes an expense through explicit gateway commands', async () => {
    const repository = new InMemoryFinanceRepository([
      { id: 's1', type: 'saida', amount: 100, status: 'Em aberto', owner_uid: 'user-1' },
      { id: 's2', type: 'saida', amount: 200, status: 'Em aberto', parent_id: 'p1', owner_uid: 'user-1' }
    ]);
    const appGateway = gateway(repository);
    const archived = await appGateway.executeCommand(command('ArchiveExpenseCommand', { id: 's1' }), { authContext: auth() });
    expect(archived).toMatchObject({ success: true, entityId: 's1' });
    expect(archived.data.archived).toBe(true);

    const deleted = await appGateway.executeCommand(command('DeleteExpenseCommand', { id: 's1' }), { authContext: auth() });
    expect(deleted).toMatchObject({ success: true, entityId: 's1' });
    await expect(appGateway.executeQuery(query('GetExpenseByIdQuery', { id: 's2' }), { authContext: auth() }))
      .resolves.toMatchObject({ success: true, entityId: 's2' });
  });

  it('creates income and consolidates monthly income without other revenues changing work base calculation', async () => {
    const repository = new InMemoryFinanceRepository([
      { id: 'person-1', type: 'pessoa', person: 'Jadson', salary_base: 5000, owner_uid: 'user-1' },
      { id: 'other-1', type: 'entrada', person: 'Jadson', competence: '2026-07', amount: 300, earning_type: 'Outras receitas', subcategory: 'Outras receitas', owner_uid: 'user-1' }
    ]);
    const appGateway = gateway(repository);
    const created = await appGateway.executeCommand(command('CreateIncomeCommand', incomePayload()), { authContext: auth() });
    expect(created.success).toBe(true);

    const consolidated = await appGateway.executeCommand(command('ConsolidateMonthlyIncomeCommand', {
      person: 'Jadson',
      competencia: '2026-07'
    }), { authContext: auth() });
    expect(consolidated.success).toBe(true);
    expect(consolidated.data.baseTrabalho).toBe(5000);
    expect(consolidated.data.baseTotal).toBeGreaterThan(consolidated.data.baseTrabalho);
  });

  it('creates installment and recurrence series through existing builders', async () => {
    const repository = new InMemoryFinanceRepository();
    const appGateway = gateway(repository);
    const installment = await appGateway.executeCommand(command('CreateInstallmentSeriesCommand', {
      ...expensePayload({ amount: 300 }),
      installments: 3,
      totalAmount: 300,
      baseDueDate: '2026-07-10',
      parentId: 'parcel-1'
    }), { authContext: auth() });
    expect(installment).toMatchObject({ success: true });
    expect(installment.entityIds).toHaveLength(3);

    const recurrence = await appGateway.executeCommand(command('CreateRecurrenceSeriesCommand', {
      ...expensePayload({ amount: 80 }),
      recurrence: 'Mensal',
      frequency: 'monthly',
      recurrence_count: 2,
      baseDueDate: '2026-07-15',
      seriesId: 'rec-1'
    }), { authContext: auth() });
    expect(recurrence.success).toBe(true);
    expect(recurrence.entityIds).toHaveLength(2);
  });

  it('creates and updates hour entries with versioned work-session calculation', async () => {
    const repository = new InMemoryFinanceRepository();
    const appGateway = gateway(repository);
    const created = await appGateway.executeCommand(command('CreateHourEntryCommand', {
      person: 'Jadson',
      competence: '2026-07',
      occurredDate: '2026-07-22',
      startTime: '18:00',
      endTime: '20:00',
      hourControlType: 'Hora Extra',
      salaryBase: 2200,
      overtimePercentage: 0.5
    }), { authContext: auth() });
    expect(created.success).toBe(true);
    expect(created.data.net_minutes).toBe(120);

    const updated = await appGateway.executeCommand(command('UpdateHourEntryCommand', {
      id: created.entityId,
      fields: { endTime: '21:00', salaryBase: 2200, overtimePercentage: 0.5 }
    }), { authContext: auth() });
    expect(updated.success).toBe(true);
    expect(updated.data.net_minutes).toBe(180);
  });

  it('serves all query contracts from the in-memory repository', async () => {
    const repository = new InMemoryFinanceRepository([
      { id: 's1', type: 'saida', amount: 100, status: 'Em aberto', competence: '2026-07', parent_id: 'p1', recurrence_series_id: 'r1', owner_uid: 'user-1' },
      { id: 'e1', type: 'entrada', amount: 500, competence: '2026-07', owner_uid: 'user-1' },
      { id: 'h1', type: 'controle_horas', person: 'Jadson', competence: '2026-07', net_minutes: 60, hour_control_type: 'Hora Extra', amount: 25, owner_uid: 'user-1' },
      { id: 'c1', type: 'categoria', category_name: 'Energia', shared_scope: 'personal', owner_uid: 'user-1' },
      { id: 'm1', type: 'macro', macro_category: 'Casa', shared_scope: 'global' }
    ]);
    const appGateway = gateway(repository);
    await expect(appGateway.executeQuery(query('GetMonthlySummaryQuery', { competence: '2026-07' }), { authContext: auth() }))
      .resolves.toMatchObject({ success: true, data: { expenseTotal: 100, incomeTotal: 500 } });
    await expect(appGateway.executeQuery(query('GetOpenExpensesQuery'), { authContext: auth() }))
      .resolves.toMatchObject({ data: [expect.objectContaining({ id: 's1' })] });
    await expect(appGateway.executeQuery(query('GetExpenseByIdQuery', { id: 's1' }), { authContext: auth() }))
      .resolves.toMatchObject({ entityId: 's1' });
    await expect(appGateway.executeQuery(query('GetIncomeByIdQuery', { id: 'e1' }), { authContext: auth() }))
      .resolves.toMatchObject({ entityId: 'e1' });
    await expect(appGateway.executeQuery(query('GetInstallmentSeriesQuery', { parentId: 'p1' }), { authContext: auth() }))
      .resolves.toMatchObject({ entityIds: ['s1'] });
    await expect(appGateway.executeQuery(query('GetRecurrenceSeriesQuery', { seriesId: 'r1' }), { authContext: auth() }))
      .resolves.toMatchObject({ entityIds: ['s1'] });
    await expect(appGateway.executeQuery(query('GetHourSummaryQuery', { start: '2026-07', end: '2026-07' }), { authContext: auth() }))
      .resolves.toMatchObject({ success: true, data: { recordsCount: 1 } });
    await expect(appGateway.executeQuery(query('GetEffectiveCategoriesQuery'), { authContext: auth() }))
      .resolves.toMatchObject({ data: [expect.objectContaining({ id: 'c1' })] });
    await expect(appGateway.executeQuery(query('GetEffectiveMacrosQuery'), { authContext: auth() }))
      .resolves.toMatchObject({ data: [expect.objectContaining({ id: 'm1' })] });
  });

  it('replays completed commands idempotently and rejects fingerprint conflicts', async () => {
    const store = new InMemoryIdempotencyStore(now);
    const appGateway = gateway(new InMemoryFinanceRepository(), { idempotencyStore: store });
    const first = await appGateway.executeCommand(command('CreateExpenseCommand', expensePayload(), {
      idempotencyKey: 'idem-1'
    }), { authContext: auth() });
    const replay = await appGateway.executeCommand(command('CreateExpenseCommand', expensePayload(), {
      idempotencyKey: 'idem-1'
    }), { authContext: auth() });
    const conflict = await appGateway.executeCommand(command('CreateExpenseCommand', expensePayload({ amount: 999 }), {
      idempotencyKey: 'idem-1'
    }), { authContext: auth() });

    expect(first.success).toBe(true);
    expect(replay).toMatchObject({ success: true, code: APPLICATION_RESULT_CODES.IDEMPOTENT_REPLAY, idempotentReplay: true });
    expect(conflict).toMatchObject({ success: false, code: APPLICATION_RESULT_CODES.CONFLICT });
  });

  it('simulates server-side consumer without DOM using future_integration for command and query', async () => {
    const repository = new InMemoryFinanceRepository();
    const appGateway = gateway(repository);
    const serverAuth = auth({ actorType: 'integration', trusted: true, permissions: ['trusted_integration'] });
    const created = await appGateway.executeCommand(command('CreateExpenseCommand', expensePayload({ amount: 42 }), {
      actor: { type: 'integration', id: 'integration-1', role: 'server' },
      source: { channel: 'future_integration', referenceId: 'server-test' },
      idempotencyKey: 'server-1'
    }), { authContext: serverAuth });
    expect(created).toMatchObject({ success: true });
    expect(created.data.source_channel).toBe('future_integration');

    const summary = await appGateway.executeQuery(query('GetMonthlySummaryQuery', { competence: '2026-07' }, {
      actor: { type: 'integration', id: 'integration-1', role: 'server' },
      source: { channel: 'future_integration', referenceId: 'server-test' }
    }), { authContext: serverAuth });
    expect(summary).toMatchObject({ success: true, data: { expenseTotal: 42 } });
  });

  it('does not let source_channel alter financial amount calculation', async () => {
    const webRepo = new InMemoryFinanceRepository();
    const serverRepo = new InMemoryFinanceRepository();
    const webGateway = gateway(webRepo);
    const serverGateway = gateway(serverRepo);
    const payload = expensePayload({ amount: 123.45 });
    const web = await webGateway.executeCommand(command('CreateExpenseCommand', payload), { authContext: auth() });
    const server = await serverGateway.executeCommand(command('CreateExpenseCommand', payload, {
      actor: { type: 'integration', id: 'integration-1', role: 'server' },
      source: { channel: 'future_integration', referenceId: 'server-test' }
    }), { authContext: auth({ actorType: 'integration', trusted: true, permissions: ['trusted_integration'] }) });
    expect(web.data.amount).toBe(server.data.amount);
    expect(server.data.source_channel).toBe('future_integration');
  });
});

describe('application gateway can be instantiated directly', () => {
  it('works with explicit empty registries and returns structured errors', async () => {
    const appGateway = new ApplicationCommandGateway({ now });
    await expect(appGateway.executeCommand(command('CreateExpenseCommand'), { authContext: auth() }))
      .resolves.toMatchObject({ success: false, code: APPLICATION_RESULT_CODES.NOT_FOUND });
  });
});
