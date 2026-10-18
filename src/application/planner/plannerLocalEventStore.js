export const PLANNER_EVENTS_V1_KEY = 'finance-control-planner-events-v1';
export const CUSTOM_HOLIDAYS_V1_KEY = 'finance-control-custom-holidays-v1';
export const PLANNER_EVENTS_V2_PREFIX = 'finance-control-planner-events-v2';
export const CUSTOM_HOLIDAYS_V2_PREFIX = 'finance-control-custom-holidays-v2';

function requireOwnerUid(ownerUid = '') {
  const normalized = String(ownerUid || '').trim();
  if (!normalized) throw new Error('PLANNER_OWNER_UID_REQUIRED');
  return normalized;
}

function stableOwnerHash(ownerUid = '') {
  const value = requireOwnerUid(ownerUid);
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36).padStart(7, '0');
}

export function plannerEventsStorageKey({ ownerUid } = {}) {
  return `${PLANNER_EVENTS_V2_PREFIX}:${stableOwnerHash(ownerUid)}`;
}

export function customHolidaysStorageKey({ ownerUid } = {}) {
  return `${CUSTOM_HOLIDAYS_V2_PREFIX}:${stableOwnerHash(ownerUid)}`;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function parseJsonList(value = '') {
  try {
    const parsed = JSON.parse(value || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function normalizeEvent(event = {}, { ownerUid } = {}) {
  const owner = requireOwnerUid(ownerUid);
  return {
    id: String(event.id || ''),
    date: String(event.date || ''),
    type: event.type === 'holiday' ? 'holiday' : 'commitment',
    title: String(event.title || '').trim() || (event.type === 'holiday' ? 'Feriado' : 'Compromisso'),
    note: String(event.note || '').trim(),
    created_at: String(event.created_at || event.createdAt || ''),
    owner_uid: owner
  };
}

function validEvent(event = {}) {
  return Boolean(event.id) && /^\d{4}-\d{2}-\d{2}$/.test(event.date || '');
}

function normalizeEvents(events = [], context = {}) {
  return (Array.isArray(events) ? events : [])
    .map((event) => normalizeEvent(event, context))
    .filter(validEvent)
    .sort((a, b) => `${a.date}${a.title}${a.id}`.localeCompare(`${b.date}${b.title}${b.id}`));
}

function serializeHolidayDates(events = []) {
  return [...new Set(events
    .filter((event) => event.type === 'holiday' && /^\d{4}-\d{2}-\d{2}$/.test(event.date || ''))
    .map((event) => event.date))]
    .sort()
    .join('\n');
}

export function createCustomHolidayStore({ storage } = {}) {
  return {
    keyForOwner: customHolidaysStorageKey,
    list({ ownerUid } = {}) {
      const key = customHolidaysStorageKey({ ownerUid });
      const raw = storage?.getItem?.(key) || '';
      return raw
        .split(/[\n,;]+/)
        .map((item) => item.trim())
        .filter((item) => /^\d{4}-\d{2}-\d{2}$/.test(item));
    },
    replaceAll(dates = [], { ownerUid } = {}) {
      const owner = requireOwnerUid(ownerUid);
      const normalized = [...new Set((Array.isArray(dates) ? dates : [])
        .map((item) => String(item || '').trim())
        .filter((item) => /^\d{4}-\d{2}-\d{2}$/.test(item)))]
        .sort();
      storage?.setItem?.(customHolidaysStorageKey({ ownerUid: owner }), normalized.join('\n'));
      return normalized;
    },
    clearOwner({ ownerUid } = {}) {
      storage?.removeItem?.(customHolidaysStorageKey({ ownerUid }));
    }
  };
}

export function createPlannerLocalEventStore({ storage, holidayStore = null } = {}) {
  const customHolidays = holidayStore || createCustomHolidayStore({ storage });

  function persist(events = [], context = {}) {
    const owner = requireOwnerUid(context.ownerUid);
    const normalized = normalizeEvents(events, { ownerUid: owner });
    storage?.setItem?.(plannerEventsStorageKey({ ownerUid: owner }), JSON.stringify(normalized));
    customHolidays.replaceAll(serializeHolidayDates(normalized).split('\n'), { ownerUid: owner });
    return normalized;
  }

  return {
    keyForOwner: plannerEventsStorageKey,
    list({ ownerUid } = {}) {
      const owner = requireOwnerUid(ownerUid);
      const events = parseJsonList(storage?.getItem?.(plannerEventsStorageKey({ ownerUid: owner })) || '[]');
      return normalizeEvents(events, { ownerUid: owner }).map(clone);
    },
    save(event = {}, { ownerUid } = {}) {
      const owner = requireOwnerUid(ownerUid);
      const current = this.list({ ownerUid: owner });
      const normalized = normalizeEvent(event, { ownerUid: owner });
      return persist([...current.filter((item) => item.id !== normalized.id), normalized], { ownerUid: owner });
    },
    remove(eventId = '', { ownerUid } = {}) {
      const owner = requireOwnerUid(ownerUid);
      return persist(this.list({ ownerUid: owner }).filter((event) => event.id !== String(eventId)), { ownerUid: owner });
    },
    replaceAll(events = [], { ownerUid } = {}) {
      return persist(events, { ownerUid });
    },
    clearOwner({ ownerUid } = {}) {
      storage?.removeItem?.(plannerEventsStorageKey({ ownerUid }));
      customHolidays.clearOwner({ ownerUid });
    },
    getLegacyUnassigned() {
      return {
        plannerEvents: parseJsonList(storage?.getItem?.(PLANNER_EVENTS_V1_KEY) || '[]'),
        customHolidays: String(storage?.getItem?.(CUSTOM_HOLIDAYS_V1_KEY) || '')
          .split(/[\n,;]+/)
          .map((item) => item.trim())
          .filter(Boolean)
      };
    }
  };
}

export function buildPlannerStorageDryRunReport({ storage, ownerA = 'owner-a', ownerB = 'owner-b' } = {}) {
  const eventStore = createPlannerLocalEventStore({ storage });
  const holidayStore = createCustomHolidayStore({ storage });
  const legacy = eventStore.getLegacyUnassigned();
  return {
    ok: true,
    wrote: false,
    firebase_touched: false,
    legacyUnassigned: {
      plannerEvents: legacy.plannerEvents.length,
      customHolidays: legacy.customHolidays.length
    },
    ownerACount: eventStore.list({ ownerUid: ownerA }).length,
    ownerBCount: eventStore.list({ ownerUid: ownerB }).length,
    ownerAHolidays: holidayStore.list({ ownerUid: ownerA }).length,
    ownerBHolidays: holidayStore.list({ ownerUid: ownerB }).length,
    collisions: plannerEventsStorageKey({ ownerUid: ownerA }) === plannerEventsStorageKey({ ownerUid: ownerB }) ? ['owner_storage_key_collision'] : [],
    warnings: legacy.plannerEvents.length || legacy.customHolidays.length
      ? ['V1_LEGACY_UNASSIGNED_NOT_MIGRATED']
      : []
  };
}
