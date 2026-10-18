import { beforeEach, describe, expect, it, vi } from 'vitest';

const firestoreCalls = vi.hoisted(() => {
  let autoId = 1;
  return ({
  addDoc: vi.fn(async (collectionRef, data) => ({ id: `${collectionRef.path}-id`, data })),
  collection: vi.fn((db, ...parts) => ({ db, path: parts.join('/') })),
  deleteDoc: vi.fn(async () => {}),
  doc: vi.fn((db, ...parts) => {
    if (parts.length === 0 && db?.path) {
      const id = `auto_${autoId++}`;
      return { db, id, path: `${db.path}/${id}` };
    }
    return { db, id: parts.at(-1), path: parts.join('/') };
  }),
  onSnapshot: vi.fn((ref, callback) => {
    callback({ docs: [], docChanges: () => [] });
    return vi.fn();
  }),
  setDoc: vi.fn(async () => {}),
  updateDoc: vi.fn(async () => {}),
  writeBatch: vi.fn(() => ({ delete: vi.fn(), set: vi.fn(), commit: vi.fn(async () => {}) }))
  });
});

vi.mock('firebase/firestore', () => firestoreCalls);

function createStorage() {
  const store = new Map();
  return {
    get length() { return store.size; },
    key(index) { return Array.from(store.keys())[index] || null; },
    getItem(key) { return store.get(String(key)) || null; },
    setItem(key, value) { store.set(String(key), String(value)); },
    removeItem(key) { store.delete(String(key)); }
  };
}

function createService({ user = { uid: 'uid-a', email: 'a@example.test' } } = {}) {
  return import('../../src/services/dataSdk.js').then(({ createDataSdkService }) => createDataSdkService({
    auth: { currentUser: user },
    db: {},
    target: {
      __cloudLocalStorageVirtualInstalled: true,
      localStorage: createStorage(),
      sessionStorage: createStorage(),
      dispatchEvent: vi.fn(),
      isCurrentUserAdmin: vi.fn(() => false),
      setTimeout,
      clearTimeout
    },
    auditService: { logLater: vi.fn() }
  }));
}

describe('dataSdk reference data routing', () => {
  beforeEach(() => {
    Object.values(firestoreCalls).forEach((fn) => fn?.mockClear?.());
  });

  it('creates macro/category as personal by default in finance_records', async () => {
    const { dataSdk } = await createService();

    await expect(dataSdk.create({ type: 'macro', macro_category: 'Projetos' }))
      .resolves.toMatchObject({ isOk: true });
    await expect(dataSdk.create({ type: 'categoria', macro_category: 'Projetos', category_name: 'Freela' }))
      .resolves.toMatchObject({ isOk: true });

    expect(firestoreCalls.addDoc.mock.calls[0][0].path).toBe('users/uid-a/finance_records');
    expect(firestoreCalls.addDoc.mock.calls[0][1]).toMatchObject({ shared_scope: 'personal', owner_uid: 'uid-a' });
    expect(firestoreCalls.addDoc.mock.calls[1][0].path).toBe('users/uid-a/finance_records');
    expect(firestoreCalls.addDoc.mock.calls[1][1]).toMatchObject({ shared_scope: 'personal', category_name: 'Freela' });
  });

  it('creates explicit global references in shared collections', async () => {
    const { dataSdk } = await createService();

    await dataSdk.create({ type: 'macro', macro_category: 'Global', shared_scope: 'global' });
    await dataSdk.create({ type: 'categoria', macro_category: 'Global', category_name: 'Todas', shared_scope: 'global' });

    expect(firestoreCalls.addDoc.mock.calls[0][0].path).toBe('shared_macros');
    expect(firestoreCalls.addDoc.mock.calls[1][0].path).toBe('shared_categories');
  });

  it('updates references without silently changing scope', async () => {
    const { dataSdk } = await createService();

    await dataSdk.update({ id: 'personal-1', type: 'macro', macro_category: 'Pessoal', shared_scope: 'personal' });
    await dataSdk.update({ id: 'global-1', type: 'macro', macro_category: 'Global', shared_scope: 'global' });

    expect(firestoreCalls.updateDoc.mock.calls[0][0].path).toBe('users/uid-a/finance_records/personal-1');
    expect(firestoreCalls.updateDoc.mock.calls[0][1]).toMatchObject({ shared_scope: 'personal' });
    expect(firestoreCalls.updateDoc.mock.calls[1][0].path).toBe('shared_macros/global-1');
    expect(firestoreCalls.updateDoc.mock.calls[1][1]).toMatchObject({ shared_scope: 'global' });
  });

  it('does not initialize shared defaults for common users', async () => {
    const { dataSdk } = await createService({
      user: {
        uid: 'uid-a',
        email: 'a@example.test',
        getIdTokenResult: async () => ({ claims: {} })
      }
    });

    await dataSdk.init({ onDataChanged: vi.fn() });

    expect(firestoreCalls.setDoc).not.toHaveBeenCalled();
  });

  it('allows already validated admin profile context to initialize shared defaults', async () => {
    const { createDataSdkService } = await import('../../src/services/dataSdk.js');
    const target = {
      __cloudLocalStorageVirtualInstalled: true,
      localStorage: createStorage(),
      sessionStorage: createStorage(),
      dispatchEvent: vi.fn(),
      isCurrentUserAdmin: vi.fn(() => true),
      setTimeout,
      clearTimeout
    };
    const { dataSdk } = createDataSdkService({
      auth: { currentUser: { uid: 'admin-user', email: 'admin@example.test' } },
      db: {},
      target,
      auditService: { logLater: vi.fn() }
    });

    await dataSdk.init({ onDataChanged: vi.fn() });

    expect(firestoreCalls.setDoc).toHaveBeenCalled();
    expect(firestoreCalls.setDoc.mock.calls[0][0].path).toContain('shared_macros/');
  });

  it('blocks destructive deletion when a reference is in use', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    let recordsCallback;
    firestoreCalls.onSnapshot.mockImplementation((ref, callback) => {
      if (ref.path === 'users/uid-a/finance_records') recordsCallback = callback;
      callback({ docs: [], docChanges: () => [] });
      return vi.fn();
    });
    const { dataSdk } = await createService();
    await dataSdk.init({ onDataChanged: vi.fn() });
    recordsCallback({
      docs: [
        { id: 'expense-1', data: () => ({ type: 'saida', macro_category: 'Pessoal', subcategory: 'Casa' }) }
      ],
      docChanges: () => []
    });

    await expect(dataSdk.delete({
      id: 'cat-1',
      type: 'categoria',
      macro_category: 'Pessoal',
      category_name: 'Casa',
      shared_scope: 'personal'
    })).resolves.toMatchObject({ isOk: false, error: 'REFERENCE_IN_USE' });
    expect(firestoreCalls.deleteDoc).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it('rejects invalid finance records before Firestore write with structured errors', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { dataSdk } = await createService();

    const result = await dataSdk.create({ type: 'saida', amount: Number.NaN, status: 'Em aberto' });

    expect(result).toMatchObject({
      isOk: false,
      error: 'FINANCE_RECORD_CONTRACT_INVALID'
    });
    expect(result.validation.errors[0]).toMatchObject({ field: 'amount', code: 'INVALID_FIELD_TYPE' });
    expect(firestoreCalls.addDoc).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it('creates installment series with write batch only after all records pass contracts', async () => {
    const { dataSdk } = await createService();
    const financeRecord = (overrides = {}) => ({
      type: 'saida',
      person: 'Ana',
      status: 'Em aberto',
      due_date: '2026-07-10',
      competence: '2026-07',
      ...overrides
    });
    const validSeries = [
      financeRecord({ id: undefined, amount: 33.33, installment_no: 1, total_installments: 2, parent_id: 'series-ok', is_installment: true, schema_version: 1 }),
      financeRecord({ id: undefined, amount: 66.67, installment_no: 2, total_installments: 2, parent_id: 'series-ok', is_installment: true, schema_version: 1 })
    ];

    await expect(dataSdk.createMany(validSeries)).resolves.toMatchObject({ isOk: true, count: 2 });
    expect(firestoreCalls.writeBatch).toHaveBeenCalled();
    expect(firestoreCalls.addDoc).not.toHaveBeenCalled();

    firestoreCalls.writeBatch.mockClear();
    const invalidResult = await dataSdk.createMany([
      financeRecord({ id: undefined, amount: 10, installment_no: 1, total_installments: 2, parent_id: '', is_installment: true, schema_version: 1 })
    ]);

    expect(invalidResult).toMatchObject({
      isOk: false,
      error: 'FINANCE_RECORD_CONTRACT_INVALID'
    });
    expect(firestoreCalls.writeBatch).not.toHaveBeenCalled();
  });

  it('blocks update when caller tries to change owner before Firestore write', async () => {
    const { dataSdk } = await createService();

    const result = await dataSdk.update({
      id: 'r1',
      type: 'saida',
      amount: 10,
      owner_uid: 'other-user',
      owner_email: 'other@example.test'
    });

    expect(result).toMatchObject({ isOk: false, error: 'FINANCE_RECORD_CONTRACT_INVALID' });
    expect(result.validation.errors.map((error) => error.code)).toContain('OWNER_IMMUTABLE');
    expect(firestoreCalls.updateDoc).not.toHaveBeenCalled();
  });

  it('blocks update when cached current record has a different type', async () => {
    let recordsCallback;
    firestoreCalls.onSnapshot.mockImplementation((ref, callback) => {
      if (ref.path === 'users/uid-a/finance_records') recordsCallback = callback;
      callback({ docs: [], docChanges: () => [] });
      return vi.fn();
    });
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { dataSdk } = await createService();
    await dataSdk.init({ onDataChanged: vi.fn() });
    recordsCallback({
      docs: [{ id: 'r1', data: () => ({ type: 'saida', amount: 10, owner_uid: 'uid-a', owner_email: 'a@example.test' }) }],
      docChanges: () => []
    });

    const result = await dataSdk.update({ id: 'r1', type: 'entrada', amount: 10 });

    expect(result).toMatchObject({ isOk: false, error: 'FINANCE_RECORD_CONTRACT_INVALID' });
    expect(result.validation.errors.map((error) => error.code)).toContain('TYPE_IMMUTABLE');
    expect(firestoreCalls.updateDoc).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it('rejects upsert without id before shape validation or Firestore write', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { dataSdk } = await createService();

    const result = await dataSdk.upsert({ type: 'saida', amount: 10 });

    expect(result).toMatchObject({ isOk: false, error: 'Documento precisa de um ID' });
    expect(firestoreCalls.setDoc).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
