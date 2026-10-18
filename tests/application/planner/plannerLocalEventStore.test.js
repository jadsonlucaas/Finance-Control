import { describe, expect, it } from 'vitest';
import {
  buildPlannerStorageDryRunReport,
  CUSTOM_HOLIDAYS_V1_KEY,
  customHolidaysStorageKey,
  createCustomHolidayStore,
  createPlannerLocalEventStore,
  PLANNER_EVENTS_V1_KEY,
  plannerEventsStorageKey
} from '../../../src/application/planner/plannerLocalEventStore.js';

function storage(seed = {}) {
  const values = new Map(Object.entries(seed));
  return {
    getItem: (key) => values.get(key) || null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
    dump: () => Object.fromEntries(values.entries())
  };
}

describe('PlannerLocalEventStore', () => {
  it('isolates owner A and owner B for save, list and remove', () => {
    const localStorage = storage();
    const store = createPlannerLocalEventStore({ storage: localStorage });

    store.save({ id: 'a-1', date: '2026-06-10', type: 'holiday', title: 'A holiday' }, { ownerUid: 'owner-a' });
    store.save({ id: 'b-1', date: '2026-06-11', type: 'holiday', title: 'B holiday' }, { ownerUid: 'owner-b' });
    store.remove('a-1', { ownerUid: 'owner-a' });

    expect(store.list({ ownerUid: 'owner-a' })).toEqual([]);
    expect(store.list({ ownerUid: 'owner-b' }).map((event) => event.id)).toEqual(['b-1']);
  });

  it('requires owner for every read and write path', () => {
    const store = createPlannerLocalEventStore({ storage: storage() });

    expect(() => store.list()).toThrow('PLANNER_OWNER_UID_REQUIRED');
    expect(() => store.save({ id: 'x', date: '2026-06-10' })).toThrow('PLANNER_OWNER_UID_REQUIRED');
    expect(() => store.remove('x')).toThrow('PLANNER_OWNER_UID_REQUIRED');
    expect(() => store.replaceAll([])).toThrow('PLANNER_OWNER_UID_REQUIRED');
    expect(() => store.clearOwner()).toThrow('PLANNER_OWNER_UID_REQUIRED');
  });

  it('derives stable owner keys without raw email or phone data', () => {
    const keyA = plannerEventsStorageKey({ ownerUid: 'user@example.test' });
    const keyB = plannerEventsStorageKey({ ownerUid: 'user@example.test' });
    const phoneKey = plannerEventsStorageKey({ ownerUid: '+5592999999999' });

    expect(keyA).toBe(keyB);
    expect(keyA).toMatch(/^finance-control-planner-events-v2:/);
    expect(keyA).not.toContain('user@example.test');
    expect(phoneKey).not.toContain('+5592999999999');
    expect(keyA).not.toBe(plannerEventsStorageKey({ ownerUid: 'other@example.test' }));
  });

  it('does not assign V1 legacy data automatically to the current owner', () => {
    const localStorage = storage({
      [PLANNER_EVENTS_V1_KEY]: JSON.stringify([{ id: 'legacy', date: '2026-06-10', type: 'holiday' }]),
      [CUSTOM_HOLIDAYS_V1_KEY]: '2026-06-10'
    });
    const store = createPlannerLocalEventStore({ storage: localStorage });

    expect(store.list({ ownerUid: 'owner-a' })).toEqual([]);
    expect(store.getLegacyUnassigned()).toMatchObject({
      plannerEvents: [{ id: 'legacy', date: '2026-06-10', type: 'holiday' }],
      customHolidays: ['2026-06-10']
    });
  });

  it('does not mutate the input payload', () => {
    const event = { id: 'x', date: '2026-06-10', type: 'holiday', title: 'Original' };
    const store = createPlannerLocalEventStore({ storage: storage() });

    store.save(event, { ownerUid: 'owner-a' });

    expect(event).toEqual({ id: 'x', date: '2026-06-10', type: 'holiday', title: 'Original' });
  });
});

describe('CustomHolidayStore', () => {
  it('isolates custom holidays by owner and feeds owner-scoped DSR sources', () => {
    const localStorage = storage();
    const holidays = createCustomHolidayStore({ storage: localStorage });

    holidays.replaceAll(['2026-06-10'], { ownerUid: 'owner-a' });
    holidays.replaceAll(['2026-06-11'], { ownerUid: 'owner-b' });

    expect(holidays.list({ ownerUid: 'owner-a' })).toEqual(['2026-06-10']);
    expect(holidays.list({ ownerUid: 'owner-b' })).toEqual(['2026-06-11']);
    expect(customHolidaysStorageKey({ ownerUid: 'owner-a' })).not.toBe(customHolidaysStorageKey({ ownerUid: 'owner-b' }));
  });

  it('dry-run reports V1 as unassigned and never writes production data', () => {
    const localStorage = storage({
      [PLANNER_EVENTS_V1_KEY]: JSON.stringify([{ id: 'legacy', date: '2026-06-10', type: 'holiday' }]),
      [CUSTOM_HOLIDAYS_V1_KEY]: '2026-06-10',
      [plannerEventsStorageKey({ ownerUid: 'owner-a' })]: JSON.stringify([{ id: 'a', date: '2026-06-11', type: 'holiday', owner_uid: 'owner-a' }])
    });

    expect(buildPlannerStorageDryRunReport({ storage: localStorage, ownerA: 'owner-a', ownerB: 'owner-b' })).toMatchObject({
      ok: true,
      wrote: false,
      firebase_touched: false,
      legacyUnassigned: { plannerEvents: 1, customHolidays: 1 },
      ownerACount: 1,
      ownerBCount: 0,
      collisions: [],
      warnings: ['V1_LEGACY_UNASSIGNED_NOT_MIGRATED']
    });
  });
});
