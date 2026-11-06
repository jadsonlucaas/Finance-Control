import { randomUUID } from 'node:crypto';

const clone = (value) => (value === undefined ? undefined : structuredClone(value));

/** Store em memoria com a mesma interface do Firestore; usado em testes e em desenvolvimento local. */
export function createMemoryStore(seed = {}, { shared = [] } = {}) {
  const users = new Map();
  const bucket = (uid) => {
    if (!users.has(uid)) users.set(uid, { records: new Map(), pending: new Map(), receipts: new Map(), audit: [] });
    return users.get(uid);
  };
  Object.entries(seed).forEach(([uid, records]) => {
    records.forEach((record) => bucket(uid).records.set(record.id, clone(record)));
  });

  return {
    async listFinanceRecords(uid) {
      return [...bucket(uid).records.values()]
        .filter((record) => record.type === 'saida' || record.type === 'entrada')
        .map(clone);
    },
    async listReferenceRecords(uid) {
      const personal = [...bucket(uid).records.values()].filter((record) => record.type === 'macro' || record.type === 'categoria');
      return [...shared, ...personal].map(clone);
    },
    async getRecord(uid, id) {
      return clone(bucket(uid).records.get(id)) || null;
    },
    async createRecord(uid, data) {
      const id = randomUUID();
      bucket(uid).records.set(id, { ...clone(data), id, owner_uid: uid });
      return id;
    },
    async updateRecord(uid, id, patch) {
      const current = bucket(uid).records.get(id);
      if (!current) throw new Error('record not found');
      bucket(uid).records.set(id, { ...current, ...clone(patch) });
    },
    async savePendingAction(uid, id, data) {
      bucket(uid).pending.set(id, clone(data));
    },
    async getPendingAction(uid, id) {
      return clone(bucket(uid).pending.get(id)) || null;
    },
    async cancelPendingActions(uid, nowIso) {
      bucket(uid).pending.forEach((item, id) => {
        if (item.status === 'pending') bucket(uid).pending.set(id, { ...item, status: 'cancelled', cancelled_at: nowIso });
      });
    },
    async getLatestPendingAction(uid) {
      const list = [...bucket(uid).pending.values()].filter((item) => item.status === 'pending');
      list.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
      return clone(list[0]) || null;
    },
    async updatePendingAction(uid, id, patch) {
      const current = bucket(uid).pending.get(id);
      if (current) bucket(uid).pending.set(id, { ...current, ...clone(patch) });
    },
    async reserveReceipt(uid, id, data) {
      const receipts = bucket(uid).receipts;
      if (receipts.has(id)) return { created: false, existing: clone(receipts.get(id)) };
      receipts.set(id, clone(data));
      return { created: true };
    },
    async completeReceipt(uid, id, patch) {
      const current = bucket(uid).receipts.get(id);
      if (current) bucket(uid).receipts.set(id, { ...current, ...clone(patch) });
    },
    async writeAudit(uid, entry) {
      bucket(uid).audit.push(clone(entry));
    },
    // Apenas para testes.
    _dump(uid) {
      const data = bucket(uid);
      return {
        records: [...data.records.values()].map(clone),
        pending: [...data.pending.values()].map(clone),
        receipts: [...data.receipts.values()].map(clone),
        audit: data.audit.map(clone)
      };
    }
  };
}
