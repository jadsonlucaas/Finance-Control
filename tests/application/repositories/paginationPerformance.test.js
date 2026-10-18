import { describe, expect, it, vi } from 'vitest';
import {
  InMemoryAuditRepository,
  InMemoryFinanceRecordRepository,
  InMemoryFinanceRecordSubscriptionRepository,
  InMemoryUserProfileRepository
} from '../../../src/application/repositories/inMemoryRepositories.js';
import { createApplicationDependencies } from '../../../src/application/dependencies/createApplicationDependencies.js';
import { MAX_PAGE_LIMIT, normalizePaginationQuery, pageItems } from '../../../src/application/repositories/pagination.js';

const context = { actorUid: 'owner-a', ownerUid: 'owner-a', role: 'user' };
const admin = { actorUid: 'admin', ownerUid: 'admin', role: 'admin' };

function event(index, overrides = {}) {
  return {
    id: `audit-${index}`,
    event_id: `audit-${index}`,
    event_type: index % 2 === 0 ? 'EXPENSE_CREATED' : 'RESTORE_PREPARED',
    entity_type: 'finance_record',
    entity_id: `record-${index}`,
    owner_uid: index % 3 === 0 ? 'owner-b' : 'owner-a',
    correlation_id: index % 2 === 0 ? 'corr-a' : 'corr-b',
    created_at: `2026-08-${String((index % 28) + 1).padStart(2, '0')}T00:00:00.000Z`,
    ...overrides
  };
}

describe('repository pagination contract', () => {
  it('returns first page with opaque nextCursor', async () => {
    const repository = new InMemoryAuditRepository({ events: Array.from({ length: 12 }, (_, index) => event(index, { owner_uid: 'owner-a' })) });
    const result = await repository.listByOwner({ ownerUid: 'owner-a', limit: 5, orderBy: 'event_id', direction: 'asc' }, context);
    expect(result.items).toHaveLength(5);
    expect(result.hasMore).toBe(true);
    expect(result.nextCursor).toBeTruthy();
    expect(result.nextCursor).not.toMatch(/audit|created_at|owner/);
  });

  it('returns the last page without nextCursor', async () => {
    const repository = new InMemoryAuditRepository({ events: Array.from({ length: 6 }, (_, index) => event(index, { owner_uid: 'owner-a' })) });
    const first = await repository.listByOwner({ ownerUid: 'owner-a', limit: 4, orderBy: 'event_id', direction: 'asc' }, context);
    const last = await repository.listByOwner({ ownerUid: 'owner-a', limit: 4, cursor: first.nextCursor, orderBy: 'event_id', direction: 'asc' }, context);
    expect(last.items).toHaveLength(2);
    expect(last.hasMore).toBe(false);
    expect(last.nextCursor).toBe('');
  });

  it('enforces maximum limit', () => {
    expect(normalizePaginationQuery({ limit: 9999 }).limit).toBe(MAX_PAGE_LIMIT);
  });

  it('combines filters and pagination', async () => {
    const repository = new InMemoryAuditRepository({ events: Array.from({ length: 20 }, (_, index) => event(index, { owner_uid: 'owner-a' })) });
    const result = await repository.listByCorrelationId('corr-a', context, { limit: 3, orderBy: 'event_id', direction: 'asc' });
    expect(result.items).toHaveLength(3);
    expect(result.items.every((item) => item.correlation_id === 'corr-a')).toBe(true);
  });

  it('keeps order stable across pages', () => {
    const source = [{ id: 'b' }, { id: 'a' }, { id: 'c' }];
    const first = pageItems(source, { limit: 2, orderBy: 'id', direction: 'asc' });
    const second = pageItems(source, { limit: 2, cursor: first.nextCursor, orderBy: 'id', direction: 'asc' });
    expect(first.items.map((item) => item.id)).toEqual(['a', 'b']);
    expect(second.items.map((item) => item.id)).toEqual(['c']);
  });

  it('isolates owner in paginated audit queries', async () => {
    const repository = new InMemoryAuditRepository({ events: Array.from({ length: 9 }, (_, index) => event(index)) });
    const result = await repository.listByOwner({ ownerUid: 'owner-a', limit: 20 }, context);
    expect(result.items.every((item) => item.owner_uid === 'owner-a')).toBe(true);
  });

  it('blocks cross-owner audit pagination for common user', async () => {
    const repository = new InMemoryAuditRepository({ events: [event(1)] });
    const result = await repository.listByOwner({ ownerUid: 'owner-b', limit: 5 }, context);
    expect(result.ok).toBe(false);
  });

  it('allows admin security event pagination', async () => {
    const repository = new InMemoryAuditRepository({ events: Array.from({ length: 10 }, (_, index) => event(index, { category: 'admin' })) });
    const result = await repository.listSecurityEvents({ limit: 4 }, admin);
    expect(result.items).toHaveLength(4);
    expect(result.hasMore).toBe(true);
  });

  it('paginates user administration list', async () => {
    const repository = new InMemoryUserProfileRepository({
      users: Array.from({ length: 7 }, (_, index) => ({ uid: `u${index}`, created_at: `2026-08-0${index}` }))
    });
    const first = await repository.listUsers({ limit: 3, orderBy: 'uid', direction: 'asc' });
    expect(first.items.map((item) => item.uid)).toEqual(['u0', 'u1', 'u2']);
    expect(first.nextCursor).toBeTruthy();
  });

  it('subscription unsubscribe closes active listener', async () => {
    const records = new InMemoryFinanceRecordRepository({ records: [{ id: 'r1', type: 'saida', owner_uid: 'owner-a', amount: 1 }] });
    const subscriptions = new InMemoryFinanceRecordSubscriptionRepository(records);
    const unsubscribe = subscriptions.subscribe({}, () => {}, context);
    expect(subscriptions.activeCount()).toBe(1);
    unsubscribe();
    expect(subscriptions.activeCount()).toBe(0);
  });

  it('unsubscribeAll can close owner listeners on logout or owner switch', () => {
    const records = new InMemoryFinanceRecordRepository({ records: [] });
    const subscriptions = new InMemoryFinanceRecordSubscriptionRepository(records);
    subscriptions.subscribe({}, () => {}, context);
    subscriptions.subscribe({}, () => {}, { ...context, ownerUid: 'owner-b', actorUid: 'owner-b' });
    const closed = subscriptions.unsubscribeAll((subscription) => subscription.context.ownerUid === 'owner-a');
    expect(closed).toBe(1);
    expect(subscriptions.activeCount()).toBe(1);
  });

  it('pagination helper does not depend on DOM or browser globals', () => {
    expect(String(pageItems)).not.toMatch(/document|window|firebase-admin|whatsapp|provider/i);
  });

  it('lazy web subscription returns unsubscribe synchronously', async () => {
    let closed = 0;
    const dependencies = createApplicationDependencies({
      target: {},
      financeRecordDataSdk: {},
      subscriptionSdk: {
        subscribe: () => () => {
          closed += 1;
        }
      }
    });
    const unsubscribe = dependencies.repositories.financeRecords.subscribe({}, () => {}, context);
    expect(typeof unsubscribe).toBe('function');
    unsubscribe();
    await vi.waitFor(() => expect(closed).toBe(1));
  });
});
