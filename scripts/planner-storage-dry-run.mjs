import {
  buildPlannerStorageDryRunReport,
  CUSTOM_HOLIDAYS_V1_KEY,
  customHolidaysStorageKey,
  createCustomHolidayStore,
  createPlannerLocalEventStore,
  PLANNER_EVENTS_V1_KEY,
  plannerEventsStorageKey
} from '../src/application/planner/plannerLocalEventStore.js';

function createMemoryStorage(seed = {}) {
  const values = new Map(Object.entries(seed));
  return {
    getItem: (key) => values.get(key) || null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key)
  };
}

const ownerA = 'dry-run-owner-a';
const ownerB = 'dry-run-owner-b';
const storage = createMemoryStorage({
  [PLANNER_EVENTS_V1_KEY]: JSON.stringify([
    { id: 'legacy-1', date: '2026-06-12', type: 'holiday', title: 'Legado sem owner' }
  ]),
  [CUSTOM_HOLIDAYS_V1_KEY]: '2026-06-12',
  [plannerEventsStorageKey({ ownerUid: ownerA })]: JSON.stringify([
    { id: 'a-1', date: '2026-06-10', type: 'holiday', title: 'Owner A', owner_uid: ownerA }
  ]),
  [plannerEventsStorageKey({ ownerUid: ownerB })]: JSON.stringify([
    { id: 'b-1', date: '2026-06-11', type: 'commitment', title: 'Owner B', owner_uid: ownerB }
  ]),
  [customHolidaysStorageKey({ ownerUid: ownerA })]: '2026-06-10',
  [customHolidaysStorageKey({ ownerUid: ownerB })]: ''
});

const eventStore = createPlannerLocalEventStore({
  storage,
  holidayStore: createCustomHolidayStore({ storage })
});
eventStore.save({ id: 'a-2', date: '2026-06-15', type: 'commitment', title: 'A extra' }, { ownerUid: ownerA });

console.log(JSON.stringify(buildPlannerStorageDryRunReport({ storage, ownerA, ownerB }), null, 2));
