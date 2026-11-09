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
  const inboundMessages = new Map();
  const billingCustomers = new Map();
  const stripeSubscriptions = new Map();
  const onboarding = new Map();
  const accountDeletions = new Map();
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
    async reserveInboundMessage(messageKey, data) {
      if (inboundMessages.has(messageKey)) return { created: false };
      inboundMessages.set(messageKey, clone(data));
      return { created: true };
    },
    _getInboundMessage(messageKey) {
      return clone(inboundMessages.get(messageKey)) || null;
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
    // --- Exclusao de conta (mesma interface do firestoreStore) ---
    async markAccountDeleting(uid, nowIso) {
      const profile = userProfiles.get(uid);
      if (profile) userProfiles.set(uid, { ...profile, status: 'inactive', deletion_started_at: nowIso, updated_at: nowIso });
    },
    async getAccountFootprint(uid) {
      const subscription = subscriptions.get(uid);
      const ownLinks = [...links.entries()].filter(([, link]) => link.uid === uid);
      return {
        customerIds: [...[...billingCustomers.entries()].filter(([, data]) => data.uid === uid).map(([id]) => id), subscription?.customer_id || ''].filter(Boolean),
        phones: [...ownLinks.flatMap(([phone, link]) => [phone, link.telefone]), onboarding.get(uid)?.whatsapp_phone, subscription?.phone].filter(Boolean)
      };
    },
    async purgeAccountData(uid, { customerIds = [], phoneKeys = [] } = {}) {
      const counts = {};
      const add = (name, total) => { if (total) counts[name] = (counts[name] || 0) + total; };
      const dropWhere = (name, map, predicate) => {
        [...map.entries()].filter(([, value]) => predicate(value)).forEach(([key]) => { map.delete(key); add(name, 1); });
      };
      const dropKey = (name, map, key) => { if (map.delete(key)) add(name, 1); };
      dropWhere('whatsapp_links', links, (link) => link.uid === uid);
      dropWhere('whatsapp_link_codes', linkCodes, (code) => code.owner_uid === uid);
      phoneKeys.forEach((key) => dropKey('whatsapp_link_attempts', linkAttempts, key));
      dropKey('whatsapp_comp_access', compAccess, uid);
      dropKey('user_onboarding', onboarding, uid);
      dropKey('billing_subscriptions', subscriptions, uid);
      dropWhere('billing_customers', billingCustomers, (data) => data.uid === uid);
      customerIds.forEach((id) => {
        dropKey('billing_customers', billingCustomers, id);
        dropWhere('billing_stripe_subscriptions', stripeSubscriptions, (data) => data.customer_id === id);
      });
      const data = users.get(uid);
      if (data) {
        add('users/finance_records', data.records.size);
        add('users/whatsapp_pending_actions', data.pending.size);
        add('users/idempotency_receipts', data.receipts.size);
        add('users/audit_logs', data.audit.length);
        users.delete(uid);
      }
      dropKey('users', userProfiles, uid);
      return counts;
    },
    async findAccountLeftovers(uid, { customerIds = [], phoneKeys = [] } = {}) {
      const leftovers = [];
      if (userProfiles.has(uid)) leftovers.push('users');
      const data = users.get(uid);
      if (data && (data.records.size || data.pending.size || data.receipts.size || data.audit.length)) leftovers.push('users/subcolecoes');
      if (onboarding.has(uid)) leftovers.push('user_onboarding');
      if (compAccess.has(uid)) leftovers.push('whatsapp_comp_access');
      if (subscriptions.has(uid)) leftovers.push('billing_subscriptions');
      if ([...links.values()].some((link) => link.uid === uid)) leftovers.push('whatsapp_links');
      if ([...linkCodes.values()].some((code) => code.owner_uid === uid)) leftovers.push('whatsapp_link_codes');
      if (phoneKeys.some((key) => linkAttempts.has(key))) leftovers.push('whatsapp_link_attempts');
      if ([...billingCustomers.entries()].some(([id, value]) => value.uid === uid || customerIds.includes(id))) leftovers.push('billing_customers');
      if ([...stripeSubscriptions.values()].some((value) => customerIds.includes(value.customer_id))) leftovers.push('billing_stripe_subscriptions');
      return leftovers;
    },
    async recordAccountDeletion(id, data) {
      accountDeletions.set(id, clone(data));
    },
    _accountDeletion(id) {
      return clone(accountDeletions.get(id)) || null;
    },
    _putLink(phone, data) {
      links.set(phone, clone(data));
    },
    _putLinkAttempts(phoneKey, data) {
      linkAttempts.set(phoneKey, clone(data));
    },
    _hasUserData(uid) {
      return users.has(uid);
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
