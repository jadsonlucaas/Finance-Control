import { describe, expect, it } from 'vitest';
import { createFirestoreStore } from '../../../services/whatsapp-api/src/firestoreStore.js';

function fakeDb() {
  const docs = new Map();
  const calls = [];
  const docRef = (path) => ({
    id: path.split('/').pop(),
    async get() {
      return { exists: docs.has(path), id: path.split('/').pop(), data: () => ({ ...docs.get(path) }) };
    },
    async create(data) {
      calls.push(['create', path]);
      if (docs.has(path)) throw Object.assign(new Error('exists'), { code: 6 });
      docs.set(path, { ...data });
    },
    async update(data) {
      calls.push(['update', path]);
      docs.set(path, { ...docs.get(path), ...data });
    },
    async set(data) {
      calls.push(['set', path]);
      docs.set(path, { ...(docs.get(path) || {}), ...data });
    },
    collection: (name) => collectionRef(`${path}/${name}`)
  });
  let auto = 0;
  const listDocs = (path) => {
    const prefix = `${path}/`;
    return [...docs.entries()].filter(([key]) => key.startsWith(prefix) && !key.slice(prefix.length).includes('/'));
  };
  const collectionRef = (path) => ({
    doc: (id) => docRef(`${path}/${id ?? `auto${++auto}`}`),
    async get() {
      calls.push(['list', path]);
      return { docs: listDocs(path).map(([key, value]) => ({ id: key.slice(path.length + 1), ref: docRef(key), data: () => ({ ...value }) })) };
    },
    where: (field, op, values) => ({
      async get() {
        calls.push(['query', path, field, op]);
        const prefix = `${path}/`;
        const matches = [...docs.entries()].filter(([key, value]) =>
          key.startsWith(prefix) && !key.slice(prefix.length).includes('/') &&
          (op === 'in' ? values.includes(value[field]) : value[field] === values));
        return { docs: matches.map(([key, value]) => ({ id: key.slice(prefix.length), ref: docRef(key), data: () => ({ ...value }) })) };
      }
    }),
    async add(data) {
      const ref = docRef(`${path}/auto${++auto}`);
      await ref.create(data);
      return ref;
    }
  });
  return { db: { collection: collectionRef }, docs, calls };
}

describe('whatsapp-api: adaptador Firestore', () => {
  it('le referencias globais e apenas as pessoais do proprio usuario', async () => {
    const { db, docs } = fakeDb();
    docs.set('shared_macros/fixo', { macro_category: 'FIXO' });
    docs.set('shared_categories/cat_fixo_transporte', { type: 'categoria', category_name: 'Transporte', macro_category: 'FIXO' });
    docs.set('users/a/finance_records/c1', { type: 'categoria', category_name: 'Pets', macro_category: 'VARIAVEL' });
    docs.set('users/a/finance_records/r1', { type: 'saida', amount: 10 });
    docs.set('users/b/finance_records/c2', { type: 'categoria', category_name: 'Segredo' });
    const refs = await createFirestoreStore(db).listReferenceRecords('a');
    expect(refs.map((item) => item.category_name || item.macro_category).sort()).toEqual(['FIXO', 'Pets', 'Transporte']);
    expect(refs.find((item) => item.id === 'fixo').type).toBe('macro');
  });

  it('le e grava apenas sob users/{uid}', async () => {
    const { db, docs } = fakeDb();
    docs.set('users/a/finance_records/r1', { type: 'saida', amount: 10 });
    docs.set('users/a/finance_records/c1', { type: 'categoria' });
    docs.set('users/b/finance_records/r2', { type: 'saida', amount: 99 });
    const store = createFirestoreStore(db);

    const list = await store.listFinanceRecords('a');
    expect(list).toEqual([{ type: 'saida', amount: 10, id: 'r1' }]);
    const id = await store.createRecord('a', { type: 'entrada', amount: 5 });
    expect(docs.get(`users/a/finance_records/${id}`)).toMatchObject({ owner_uid: 'a' });
    await store.writeAudit('a', { event_id: 'e1' });
    expect([...docs.keys()].some((key) => key.startsWith('users/a/audit_logs/'))).toBe(true);
    expect(await store.getRecord('a', 'r2')).toBeNull();
  });

  it('reserva o recibo de idempotencia uma unica vez', async () => {
    const { db } = fakeDb();
    const store = createFirestoreStore(db);
    expect(await store.reserveReceipt('a', 'whatsapp_1', { status: 'processing' })).toEqual({ created: true });
    const second = await store.reserveReceipt('a', 'whatsapp_1', { status: 'processing' });
    expect(second.created).toBe(false);
    expect(second.existing.status).toBe('processing');
  });

  it('cancela pendencias anteriores e encontra a mais recente', async () => {
    const { db, docs } = fakeDb();
    const store = createFirestoreStore(db);
    await store.savePendingAction('a', 'p1', { id: 'p1', status: 'pending', created_at: '2026-11-05T10:00:00.000Z' });
    await store.savePendingAction('a', 'p2', { id: 'p2', status: 'pending', created_at: '2026-11-05T11:00:00.000Z' });
    expect((await store.getLatestPendingAction('a')).id).toBe('p2');
    await store.cancelPendingActions('a', '2026-11-05T12:00:00.000Z');
    expect(docs.get('users/a/whatsapp_pending_actions/p1').status).toBe('cancelled');
    expect(await store.getLatestPendingAction('a')).toBeNull();
  });
});
