/**
 * Adaptador Firestore (Firebase Admin SDK). Mesma interface do memoryStore.
 * Tudo fica sob users/{uid}/..., entao um uid nunca enxerga dados de outro.
 */
export function createFirestoreStore(db) {
  const userDoc = (uid) => db.collection('users').doc(uid);
  const records = (uid) => userDoc(uid).collection('finance_records');
  const pending = (uid) => userDoc(uid).collection('whatsapp_pending_actions');
  const receipts = (uid) => userDoc(uid).collection('idempotency_receipts');
  const audits = (uid) => userDoc(uid).collection('audit_logs');

  return {
    async listFinanceRecords(uid) {
      const snapshot = await records(uid).where('type', 'in', ['saida', 'entrada']).get();
      return snapshot.docs.map((doc) => ({ ...doc.data(), id: doc.id }));
    },
    async getRecord(uid, id) {
      const snapshot = await records(uid).doc(id).get();
      return snapshot.exists ? { ...snapshot.data(), id: snapshot.id } : null;
    },
    async createRecord(uid, data) {
      const ref = records(uid).doc();
      await ref.create({ ...data, owner_uid: uid });
      return ref.id;
    },
    async updateRecord(uid, id, patch) {
      await records(uid).doc(id).update(patch);
    },
    async savePendingAction(uid, id, data) {
      await pending(uid).doc(id).create(data);
    },
    async getPendingAction(uid, id) {
      const snapshot = await pending(uid).doc(id).get();
      return snapshot.exists ? snapshot.data() : null;
    },
    async updatePendingAction(uid, id, patch) {
      await pending(uid).doc(id).set(patch, { merge: true });
    },
    async reserveReceipt(uid, id, data) {
      const ref = receipts(uid).doc(id);
      try {
        await ref.create(data);
        return { created: true };
      } catch (error) {
        // 6 = ALREADY_EXISTS: outra chamada ja reservou esta confirmacao.
        if (error?.code === 6 || error?.code === 'already-exists') {
          const existing = await ref.get();
          return { created: false, existing: existing.exists ? existing.data() : null };
        }
        throw error;
      }
    },
    async completeReceipt(uid, id, patch) {
      await receipts(uid).doc(id).set(patch, { merge: true });
    },
    async writeAudit(uid, entry) {
      await audits(uid).add(entry);
    }
  };
}
