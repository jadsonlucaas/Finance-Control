import { toMillis } from './links.js';
import { hashPhone } from './phoneLinks.js';

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
  const linkCodes = db.collection('whatsapp_link_codes');
  const links = db.collection('whatsapp_links');
  const linkAttempts = db.collection('whatsapp_link_attempts');
  const compAccess = db.collection('whatsapp_comp_access');
  const subscriptions = db.collection('billing_subscriptions');
  const billingEvents = db.collection('billing_webhook_events');
  const inboundMessages = db.collection('whatsapp_inbound_messages');
  const billingCustomers = db.collection('billing_customers');
  const stripeSubscriptions = db.collection('billing_stripe_subscriptions');
  const readData = async (ref) => {
    const snapshot = await ref.get();
    return snapshot.exists ? snapshot.data() : null;
  };

  const onboardingCol = db.collection('user_onboarding');
  const deletions = db.collection('account_deletions');
  const SHARED_REFERENCE_COLLECTIONS = ['shared_macros', 'shared_categories'];

  async function deleteRefs(refs) {
    for (let index = 0; index < refs.length; index += 400) {
      const batch = db.batch();
      refs.slice(index, index + 400).forEach((ref) => batch.delete(ref));
      await batch.commit();
    }
    return refs.length;
  }

  // Logs de auditoria de admins que citam a conta (aprovacao, cortesia...).
  // Consulta por grupo de colecoes (indice em firestore.indexes.json); sem o indice,
  // varre os logs de cada admin/owner.
  async function auditMentions(uid) {
    try {
      const snapshot = await db.collectionGroup('audit_logs').where('details.target_uid', '==', uid).get();
      return snapshot.docs;
    } catch (error) {
      if (error?.code !== 9 && error?.code !== 'failed-precondition') throw error;
      const admins = await db.collection('users').where('role', 'in', ['admin', 'owner']).get();
      const perAdmin = await Promise.all(admins.docs.map((admin) => audits(admin.id).where('details.target_uid', '==', uid).get()));
      return perAdmin.flatMap((snapshot) => snapshot.docs);
    }
  }

  async function countUserTree(uid) {
    const counts = {};
    const [profile, subcollections] = await Promise.all([userDoc(uid).get(), userDoc(uid).listCollections()]);
    if (profile.exists) counts.users = 1;
    for (const sub of subcollections) {
      const snapshot = await sub.count().get();
      const total = snapshot.data().count;
      if (total) counts[`users/${sub.id}`] = total;
    }
    return counts;
  }

  return {
    // --- Exclusao de conta (accountDeletion.js) ---
    async markAccountDeleting(uid, nowIso) {
      const snapshot = await userDoc(uid).get();
      if (snapshot.exists) await userDoc(uid).set({ status: 'inactive', deletion_started_at: nowIso, updated_at: nowIso }, { merge: true });
    },
    async getAccountFootprint(uid) {
      const [subscription, onboarding, customers, ownLinks] = await Promise.all([
        readData(subscriptions.doc(uid)),
        readData(onboardingCol.doc(uid)),
        billingCustomers.where('uid', '==', uid).get(),
        links.where('uid', '==', uid).get()
      ]);
      return {
        customerIds: [...customers.docs.map((doc) => doc.id), subscription?.customer_id || ''].filter(Boolean),
        phones: [...ownLinks.docs.flatMap((doc) => [doc.id, doc.data().telefone]), onboarding?.whatsapp_phone, subscription?.phone].filter(Boolean)
      };
    },
    async purgeAccountData(uid, { customerIds = [], phoneKeys = [], marker = 'conta-excluida' } = {}) {
      const counts = {};
      const add = (name, total) => { if (total) counts[name] = (counts[name] || 0) + total; };
      const deleteQuery = async (name, query) => add(name, await deleteRefs((await query.get()).docs.map((doc) => doc.ref)));
      const deleteDoc = async (name, ref) => {
        if ((await ref.get()).exists) {
          await ref.delete();
          add(name, 1);
        }
      };

      await deleteQuery('whatsapp_links', links.where('uid', '==', uid));
      await deleteQuery('whatsapp_link_codes', linkCodes.where('owner_uid', '==', uid));
      for (const key of phoneKeys) await deleteDoc('whatsapp_link_attempts', linkAttempts.doc(key));
      await deleteDoc('whatsapp_comp_access', compAccess.doc(uid));
      await deleteDoc('user_onboarding', onboardingCol.doc(uid));
      await deleteDoc('billing_subscriptions', subscriptions.doc(uid));
      await deleteQuery('billing_customers', billingCustomers.where('uid', '==', uid));
      for (const customerId of customerIds) {
        await deleteDoc('billing_customers', billingCustomers.doc(customerId));
        await deleteQuery('billing_stripe_subscriptions', stripeSubscriptions.where('customer_id', '==', customerId));
      }

      // Dados de terceiros que citam a conta: o registro fica, sem identificar a pessoa.
      const mentions = (await auditMentions(uid)).filter((doc) => !doc.ref.path.startsWith(`users/${uid}/`));
      for (const doc of mentions) {
        await doc.ref.update({ 'details.target_uid': marker, 'details.target_email': '', 'details.target_deleted': true });
      }
      add('audit_logs_anonimizados', mentions.length);
      for (const name of SHARED_REFERENCE_COLLECTIONS) {
        const owned = await db.collection(name).where('owner_uid', '==', uid).get();
        for (const doc of owned.docs) await doc.ref.update({ owner_uid: marker, owner_email: '' });
        add(`${name}_anonimizados`, owned.size);
      }

      // Perfil e TODAS as subcolecoes, inclusive as que surgirem no futuro.
      Object.entries(await countUserTree(uid)).forEach(([name, total]) => add(name, total));
      await db.recursiveDelete(userDoc(uid));
      return counts;
    },
    async findAccountLeftovers(uid, { customerIds = [], phoneKeys = [] } = {}) {
      const leftovers = [];
      const check = async (name, promise) => {
        const result = await promise;
        const found = typeof result?.exists === 'boolean' ? result.exists : (result?.size || 0) > 0;
        if (found) leftovers.push(name);
      };
      Object.keys(await countUserTree(uid)).forEach((name) => leftovers.push(name));
      await Promise.all([
        check('user_onboarding', onboardingCol.doc(uid).get()),
        check('whatsapp_comp_access', compAccess.doc(uid).get()),
        check('billing_subscriptions', subscriptions.doc(uid).get()),
        check('whatsapp_links', links.where('uid', '==', uid).limit(1).get()),
        check('whatsapp_link_codes', linkCodes.where('owner_uid', '==', uid).limit(1).get()),
        check('billing_customers', billingCustomers.where('uid', '==', uid).limit(1).get()),
        ...phoneKeys.map((key) => check('whatsapp_link_attempts', linkAttempts.doc(key).get())),
        ...customerIds.flatMap((id) => [
          check('billing_customers', billingCustomers.doc(id).get()),
          check('billing_stripe_subscriptions', stripeSubscriptions.where('customer_id', '==', id).limit(1).get())
        ]),
        ...SHARED_REFERENCE_COLLECTIONS.map((name) => check(name, db.collection(name).where('owner_uid', '==', uid).limit(1).get()))
      ]);
      if ((await auditMentions(uid)).length) leftovers.push('audit_logs');
      return [...new Set(leftovers)];
    },
    async recordAccountDeletion(id, data) {
      await deletions.doc(id).set(data);
    },

    async getWhatsAppAccess(uid) {
      const [comp, subscription] = await Promise.all([compAccess.doc(uid).get(), subscriptions.doc(uid).get()]);
      return {
        comp: comp.exists ? comp.data() : null,
        subscription: subscription.exists ? subscription.data() : null
      };
    },

    // --- Cobranca (Stripe), gravada so pelo servidor ---
    async reserveBillingEvent(eventId, data) {
      try {
        await billingEvents.doc(eventId).create(data);
        return { created: true };
      } catch (error) {
        if (error?.code === 6 || error?.code === 'already-exists') return { created: false };
        throw error;
      }
    },
    async releaseBillingEvent(eventId) {
      await billingEvents.doc(eventId).delete();
    },
    // --- Mensagens recebidas do WhatsApp (deduplicacao), gravadas so pelo servidor ---
    async reserveInboundMessage(messageKey, data) {
      try {
        await inboundMessages.doc(messageKey).create(data);
        return { created: true };
      } catch (error) {
        if (error?.code === 6 || error?.code === 'already-exists') return { created: false };
        throw error;
      }
    },
    getBillingCustomer: (customerId) => readData(billingCustomers.doc(customerId)),
    async setBillingCustomer(customerId, data) {
      await billingCustomers.doc(customerId).set(data, { merge: true });
    },
    getStripeSubscription: (subscriptionId) => readData(stripeSubscriptions.doc(subscriptionId)),
    async saveStripeSubscription(subscriptionId, data) {
      await stripeSubscriptions.doc(subscriptionId).set(data, { merge: true });
    },
    getBillingSubscription: (uid) => readData(subscriptions.doc(uid)),
    getOnboarding: (uid) => readData(db.collection('user_onboarding').doc(uid)),
    async mergeBillingSubscription(uid, patch) {
      await subscriptions.doc(uid).set(patch, { merge: true });
    },
    async listFinanceRecords(uid) {
      const snapshot = await records(uid).where('type', 'in', ['saida', 'entrada']).get();
      return snapshot.docs.map((doc) => ({ ...doc.data(), id: doc.id }));
    },
    async listReferenceRecords(uid) {
      // Referencias globais (shared_macros/shared_categories) + pessoais do proprio usuario.
      const [macros, categories, personal] = await Promise.all([
        db.collection('shared_macros').get(),
        db.collection('shared_categories').get(),
        records(uid).where('type', 'in', ['macro', 'categoria']).get()
      ]);
      const toRecords = (snapshot, type) => snapshot.docs.map((doc) => ({ type, ...doc.data(), id: doc.id }));
      return [...toRecords(macros, 'macro'), ...toRecords(categories, 'categoria'), ...toRecords(personal)];
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
    async cancelPendingActions(uid, nowIso) {
      const snapshot = await pending(uid).where('status', '==', 'pending').get();
      await Promise.all(snapshot.docs.map((doc) => doc.ref.set({ status: 'cancelled', cancelled_at: nowIso }, { merge: true })));
    },
    async getLatestPendingAction(uid) {
      // Filtro simples por status (sem indice composto); poucas acoes pendentes por usuario.
      const snapshot = await pending(uid).where('status', '==', 'pending').get();
      const list = snapshot.docs.map((doc) => doc.data());
      list.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
      return list[0] || null;
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
    },

    // --- Vinculo conta <-> WhatsApp (colecoes de topo, gravadas so pelo servidor) ---
    async getUserProfile(uid) {
      const snapshot = await userDoc(uid).get();
      return snapshot.exists ? snapshot.data() : null;
    },
    async getActiveLinkByPhone(phone) {
      const snapshot = await links.doc(phone).get();
      if (!snapshot.exists) return null;
      const data = snapshot.data();
      return data.status === 'active' ? data : null;
    },
    async getLinkCode(codeId) {
      const snapshot = await linkCodes.doc(codeId).get();
      return snapshot.exists ? snapshot.data() : null;
    },
    async getLinkAttempts(phoneKey) {
      const snapshot = await linkAttempts.doc(phoneKey).get();
      return snapshot.exists ? snapshot.data() : null;
    },
    async saveLinkAttempts(phoneKey, data) {
      await linkAttempts.doc(phoneKey).set(data, { merge: true });
    },
    async clearLinkAttempts(phoneKey) {
      await linkAttempts.doc(phoneKey).delete();
    },
    /**
     * Consome o codigo e grava o vinculo numa transacao. Resultado:
     * 'linked' | 'already_linked' | 'code_invalid' | 'phone_taken'.
     */
    async completeLink({ codeId, phone, uid, chatwootAccountId, nowIso, nowMs }) {
      return db.runTransaction(async (tx) => {
        const codeRef = linkCodes.doc(codeId);
        const linkRef = links.doc(phone);
        const [codeSnap, linkSnap, ownLinks] = await Promise.all([
          tx.get(codeRef),
          tx.get(linkRef),
          tx.get(links.where('uid', '==', uid).where('status', '==', 'active'))
        ]);
        const code = codeSnap.exists ? codeSnap.data() : null;
        if (!code || code.status !== 'pending' || code.owner_uid !== uid || !(toMillis(code.expires_at) > nowMs)) return 'code_invalid';
        const existing = linkSnap.exists ? linkSnap.data() : null;
        if (existing && existing.status === 'active' && existing.uid !== uid) return 'phone_taken';

        tx.update(codeRef, { status: 'used', used_at: nowIso, used_by_phone_hash: hashPhone(phone) });
        if (existing && existing.status === 'active' && existing.uid === uid) {
          if (String(existing.chatwoot_account_id || '') !== chatwootAccountId) {
            tx.update(linkRef, { chatwoot_account_id: chatwootAccountId, updated_at: nowIso });
          }
          return 'already_linked';
        }
        ownLinks.docs
          .filter((doc) => doc.id !== phone)
          .forEach((doc) => tx.update(doc.ref, { status: 'revoked', revoked_at: nowIso, revoked_by: 'relink' }));
        tx.set(linkRef, {
          uid,
          telefone: phone,
          chatwoot_account_id: chatwootAccountId,
          status: 'active',
          linked_at: nowIso,
          link_method: 'whatsapp_code',
          schema_version: 1
        });
        return 'linked';
      });
    }
  };
}
