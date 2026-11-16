import { beforeEach, describe, expect, it, vi } from 'vitest';

// Firestore falso: cada onSnapshot fica registrado para o teste responder quando quiser.
const fake = vi.hoisted(() => {
  const listeners = [];
  return {
    listeners,
    api: {
      addDoc: vi.fn(async () => ({ id: 'new-id' })),
      collection: vi.fn((db, ...parts) => ({ path: parts.join('/') })),
      deleteDoc: vi.fn(async () => {}),
      doc: vi.fn((db, ...parts) => ({ id: parts.at(-1), path: parts.join('/') })),
      onSnapshot: vi.fn((ref, onNext, onError) => {
        const entry = { ref, onNext, onError, active: true };
        listeners.push(entry);
        return vi.fn(() => { entry.active = false; });
      }),
      query: vi.fn((ref, ...constraints) => ({ ...ref, constraints })),
      runTransaction: vi.fn(),
      setDoc: vi.fn(async () => {}),
      updateDoc: vi.fn(async () => {}),
      where: vi.fn((field, op, value) => ({ field, op, value })),
      writeBatch: vi.fn(() => ({ delete: vi.fn(), set: vi.fn(), commit: vi.fn(async () => {}) }))
    }
  };
});

vi.mock('firebase/firestore', () => fake.api);

const RECORDS_PATH = 'users/uid-a/finance_records';

function createStorage() {
  const store = new Map();
  return {
    get length() { return store.size; },
    key(index) { return Array.from(store.keys())[index] || null; },
    getItem(key) { return store.has(String(key)) ? store.get(String(key)) : null; },
    setItem(key, value) { store.set(String(key), String(value)); },
    removeItem(key) { store.delete(String(key)); }
  };
}

async function createService(options = {}) {
  const { createDataSdkService } = await import('../../src/services/dataSdk.js');
  const events = [];
  const target = {
    __cloudLocalStorageVirtualInstalled: true,
    localStorage: createStorage(),
    sessionStorage: createStorage(),
    dispatchEvent: vi.fn((event) => events.push(event)),
    isCurrentUserAdmin: vi.fn(() => false),
    setTimeout,
    clearTimeout
  };
  const service = createDataSdkService({
    auth: { currentUser: { uid: 'uid-a', email: 'a@example.test' } },
    db: {},
    target,
    auditService: { logLater: vi.fn() },
    currentCompetence: () => '2026-11',
    historyWindowMonths: 12,
    ...options
  });
  return { ...service, target, events };
}

function recordListeners({ activeOnly = true } = {}) {
  return fake.listeners.filter((entry) => entry.ref.path === RECORDS_PATH && (!activeOnly || entry.active));
}

function snapshot(records) {
  return {
    docs: records.map(({ id, ...data }) => ({ id, data: () => data })),
    docChanges: () => []
  };
}

function answerAll(listeners, recordsFor = () => []) {
  listeners.forEach((entry) => entry.onNext(snapshot(recordsFor(entry))));
}

function constraintOf(entry) {
  return entry.ref.constraints?.[0] || null;
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('dataSdk history window', () => {
  beforeEach(() => {
    fake.listeners.length = 0;
    Object.values(fake.api).forEach((fn) => fn?.mockClear?.());
  });

  it('subscribes only to the recent window instead of the whole collection', async () => {
    const { dataSdk } = await createService();
    await dataSdk.init({ onDataChanged: vi.fn() });

    const listeners = recordListeners();
    expect(listeners).toHaveLength(6);
    expect(listeners.every((entry) => entry.ref.constraints?.length === 1)).toBe(true);
    expect(listeners.map(constraintOf)).toContainEqual({ field: 'competence', op: '>=', value: '2025-12' });
    expect(dataSdk.getHistoryState()).toMatchObject({ mode: 'window', start: '2025-12', loading: true });
  });

  it('emits merged records only after every window query answered', async () => {
    const onDataChanged = vi.fn();
    const { dataSdk } = await createService();
    await dataSdk.init({ onDataChanged });
    const listeners = recordListeners();
    const recent = { id: 'recent', type: 'saida', competence: '2026-10', amount: 10 };
    const person = { id: 'p1', type: 'pessoa', person: 'Ana' };

    listeners.slice(0, 5).forEach((entry) => entry.onNext(snapshot(constraintOf(entry).field === 'competence' ? [recent] : [])));
    await flush();
    expect(onDataChanged.mock.calls.flatMap(([records]) => records).find((record) => record.id === 'recent')).toBeUndefined();

    listeners[5].onNext(snapshot([person, recent]));
    const lastCall = onDataChanged.mock.calls.at(-1)[0];
    expect(lastCall.filter((record) => record.id === 'recent')).toHaveLength(1);
    expect(lastCall.map((record) => record.id)).toContain('p1');
    expect(dataSdk.getHistoryState()).toMatchObject({ mode: 'window', loading: false });
  });

  it('widens the window when an older month is requested and keeps current data until it loads', async () => {
    const onDataChanged = vi.fn();
    const { dataSdk } = await createService();
    await dataSdk.init({ onDataChanged });
    answerAll(recordListeners(), () => [{ id: 'recent', type: 'saida', competence: '2026-10' }]);

    const ready = dataSdk.ensureHistoryFrom('2024-03-15');
    expect(dataSdk.getHistoryState()).toMatchObject({ mode: 'window', start: '2024-03', loading: true });
    const old = recordListeners({ activeOnly: false }).slice(0, 6);
    expect(old.every((entry) => !entry.active)).toBe(true);

    const widened = recordListeners();
    expect(widened.map(constraintOf)).toContainEqual({ field: 'competence', op: '>=', value: '2024-03' });
    answerAll(widened, (entry) => (constraintOf(entry).field === 'competence'
      ? [{ id: 'recent', type: 'saida', competence: '2026-10' }, { id: 'old', type: 'saida', competence: '2024-03' }]
      : []));
    const state = await ready;

    expect(state).toMatchObject({ mode: 'window', start: '2024-03', loading: false });
    expect(onDataChanged.mock.calls.at(-1)[0].map((record) => record.id)).toEqual(expect.arrayContaining(['recent', 'old']));
  });

  it('does not resubscribe for months already loaded', async () => {
    const { dataSdk } = await createService();
    await dataSdk.init({ onDataChanged: vi.fn() });
    answerAll(recordListeners());
    const before = fake.api.onSnapshot.mock.calls.length;

    await dataSdk.ensureHistoryFrom('2026-01');

    expect(fake.api.onSnapshot.mock.calls.length).toBe(before);
  });

  it('loads the whole collection on ensureFullHistory', async () => {
    const { dataSdk } = await createService();
    await dataSdk.init({ onDataChanged: vi.fn() });
    answerAll(recordListeners());

    const ready = dataSdk.ensureFullHistory();
    const full = recordListeners();
    expect(full).toHaveLength(1);
    expect(full[0].ref.constraints).toBeUndefined();
    full[0].onNext(snapshot([{ id: 'ancient', type: 'saida', competence: '2019-01' }]));

    expect(await ready).toMatchObject({ mode: 'full', loading: false });
    await dataSdk.ensureHistoryFrom('2001-01');
    expect(recordListeners()).toHaveLength(1);
  });

  it('checks category usage against the full history before deleting it', async () => {
    const { dataSdk } = await createService();
    await dataSdk.init({ onDataChanged: vi.fn() });
    answerAll(recordListeners());
    const category = { id: 'cat1', type: 'categoria', category_name: 'Viagem', macro_category: 'VARIAVEL', shared_scope: 'personal' };

    const pending = dataSdk.delete(category);
    await flush();
    const full = recordListeners();
    expect(full).toHaveLength(1);
    full[0].onNext(snapshot([category, { id: 'old-trip', type: 'saida', competence: '2020-05', category_name: 'Viagem', subcategory: 'Viagem', macro_category: 'VARIAVEL' }]));
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = await pending;
    consoleError.mockRestore();

    expect(result).toMatchObject({ isOk: false, error: 'REFERENCE_IN_USE' });
    expect(fake.api.deleteDoc).not.toHaveBeenCalled();
  });

  it('falls back to the whole collection when a window query fails', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { dataSdk } = await createService();
    await dataSdk.init({ onDataChanged: vi.fn() });
    const ready = dataSdk.ensureHistoryFrom('2025-12');
    recordListeners()[2].onError({ code: 'failed-precondition' });

    const full = recordListeners();
    expect(full).toHaveLength(1);
    expect(full[0].ref.constraints).toBeUndefined();
    full[0].onNext(snapshot([]));
    expect(dataSdk.getHistoryState()).toMatchObject({ mode: 'full', loading: false });
    await ready;
    consoleError.mockRestore();
  });

  it('keeps the old behavior when the window is disabled (0 months)', async () => {
    const { dataSdk } = await createService({ historyWindowMonths: 0 });
    await dataSdk.init({ onDataChanged: vi.fn() });

    const listeners = recordListeners();
    expect(listeners).toHaveLength(1);
    expect(listeners[0].ref.constraints).toBeUndefined();
  });

  it('stops record listeners and resets the window on sign-out', async () => {
    const { dataSdk, cleanupOnSignOut } = await createService();
    await dataSdk.init({ onDataChanged: vi.fn() });
    cleanupOnSignOut();

    expect(recordListeners()).toHaveLength(0);
    expect(dataSdk.getHistoryState()).toMatchObject({ mode: 'full', start: '', uid: '' });
  });
});
