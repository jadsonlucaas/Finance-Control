import { randomUUID } from 'node:crypto';

const clone = (value) => (value === undefined ? undefined : structuredClone(value));

/** Store em memoria com a mesma interface do Firestore; usado em testes e em desenvolvimento local. */
export function createMemoryStore(seed = {}, { shared = [], profiles = {} } = {}) {
  const users = new Map();
  const bucket = (uid) => {
    if (!users.has(uid)) users.set(uid, { records: new Map(), pending: new Map(), receipts: new Map(), audit: [] });
    return users.get(uid);
  };
  const userProfiles = new Map(Object.entries(profiles).map(([uid, profile]) => [uid, clone(profile)]));
  const linkCodes = new Map();
  const links = new Map();
  const linkAttempts = new Map();
  const compAccess = new Map();
  const subscriptions = new Map();
  const billingEvents = new Map();
  const billingCustomers = new Map();
  const stripeSubscriptions = new Map();
  const onboarding = new Map();
  Object.entries(seed).forEach(([uid, records]) => {
    records.forEach((record) => bucket(uid).records.set(record.id, clone(record)));
  });

  return {
    async getWhatsAppAccess(uid) {
      return { comp: clone(compAccess.get(uid)) || null, subscription: clone(subscriptions.get(uid)) || null };
    },
    _setComp(uid, data) {
      if (data) compAccess.set(uid, clone(data));
      else compAccess.delete(uid);
    },
    _setSubscription(uid, data) {
      if (data) subscriptions.set(uid, clone(data));
      else subscriptions.delete(uid);
    },
    async reserveBillingEvent(eventId, data) {
      if (billingEvents.has(eventId)) return { created: false };
      billingEvents.set(eventId, clone(data));
      return { created: true };
    },
    async releaseBillingEvent(eventId) {
      billingEvents.delete(eventId);
    },
    async getBillingCustomer(customerId) {
      return clone(billingCustomers.get(customerId)) || null;
    },
    async setBillingCustomer(customerId, data) {
      billingCustomers.set(customerId, { ...(billingCustomers.get(customerId) || {}), ...clone(data) });
    },
    async getStripeSubscription(subscriptionId) {
      return clone(stripeSubscriptions.get(subscriptionId)) || null;
    },
    async saveStripeSubscription(subscriptionId, data) {
      stripeSubscriptions.set(subscriptionId, { ...(stripeSubscriptions.get(subscriptionId) || {}), ...clone(data) });
    },
    async getOnboarding(uid) {
      return clone(onboarding.get(uid)) || null;
    },
    _setOnboarding(uid, data) {
      onboarding.set(uid, clone(data));
    },
    async getBillingSubscription(uid) {
      return clone(subscriptions.get(uid)) || null;
    },
    async mergeBillingSubscription(uid, patch) {
      subscriptions.set(uid, { ...(subscriptions.get(uid) || {}), ...clone(patch) });
    },
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
    async getUserProfile(uid) {
      return clone(userProfiles.get(uid)) || null;
    },
    async getActiveLinkByPhone(phone) {
      const link = links.get(phone);
      return link && link.status === 'active' ? clone(link) : null;
    },
    async getLinkCode(codeId) {
      return clone(linkCodes.get(codeId)) || null;
    },
    async getLinkAttempts(phoneKey) {
      return clone(linkAttempts.get(phoneKey)) || null;
    },
    async saveLinkAttempts(phoneKey, data) {
      linkAttempts.set(phoneKey, { ...(linkAttempts.get(phoneKey) || {}), ...clone(data) });
    },
    async clearLinkAttempts(phoneKey) {
      linkAttempts.delete(phoneKey);
    },
    async completeLink({ codeId, phone, uid, chatwootAccountId, nowIso, nowMs }) {
      const code = linkCodes.get(codeId);
      if (!code || code.status !== 'pending' || code.owner_uid !== uid || !(Date.parse(code.expires_at) > nowMs)) return 'code_invalid';
      const existing = links.get(phone);
      if (existing && existing.status === 'active' && existing.uid !== uid) return 'phone_taken';
      linkCodes.set(codeId, { ...code, status: 'used', used_at: nowIso });
      if (existing && existing.status === 'active') {
        links.set(phone, { ...existing, chatwoot_account_id: chatwootAccountId });
        return 'already_linked';
      }
      links.forEach((link, key) => {
        if (link.uid === uid && link.status === 'active' && key !== phone) {
          links.set(key, { ...link, status: 'revoked', revoked_at: nowIso, revoked_by: 'relink' });
        }
      });
      links.set(phone, { uid, telefone: phone, chatwoot_account_id: chatwootAccountId, status: 'active', linked_at: nowIso, link_method: 'whatsapp_code', schema_version: 1 });
      return 'linked';
    },
    // Apenas para testes: simula o Dashboard e o estado das colecoes de vinculo.
    _setProfile(uid, profile) {
      userProfiles.set(uid, clone(profile));
    },
    _putLinkCode(codeId, data) {
      linkCodes.set(codeId, clone(data));
    },
    _revokeLink(phone) {
      const link = links.get(phone);
      if (link) links.set(phone, { ...link, status: 'revoked', revoked_by: 'user' });
    },
    _links() {
      return [...links.values()].map(clone);
    },
    _linkCode(codeId) {
      return clone(linkCodes.get(codeId)) || null;
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
