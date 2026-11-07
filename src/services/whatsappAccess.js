import {
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc
} from 'firebase/firestore';

/**
 * Direito de uso do assistente no WhatsApp, visto pelo Dashboard.
 *
 * - whatsapp_comp_access/{uid}: cortesia concedida por um admin (ex.: socios, testes).
 * - billing_subscriptions/{uid}: assinatura do Stripe, gravada so pelo servidor.
 * As regras do Firestore garantem que so admin ativo concede/revoga e que cada usuario so le o proprio.
 */
const COMP = 'whatsapp_comp_access';
const SUBSCRIPTIONS = 'billing_subscriptions';

// Mesma regra da whatsapp-api (services/whatsapp-api/src/access.js).
export const SUBSCRIPTION_ALLOWED_STATUSES = Object.freeze(['trialing', 'active', 'past_due']);

export function evaluateWhatsAppAccess({ comp = null, subscription = null } = {}) {
  if (comp?.status === 'active') return { allowed: true, source: 'comp', status: 'active' };
  const status = String(subscription?.status || '');
  if (status && SUBSCRIPTION_ALLOWED_STATUSES.includes(status)) return { allowed: true, source: 'stripe', status };
  return { allowed: false, source: status ? 'stripe' : 'none', status: status || 'none' };
}

export function createWhatsAppAccessService(db, auditService = null) {
  async function readDoc(name, uid) {
    const snapshot = await getDoc(doc(db, name, uid));
    return snapshot.exists() ? snapshot.data() : null;
  }

  async function getMyAccess(uid) {
    if (!uid) return evaluateWhatsAppAccess();
    const [comp, subscription] = await Promise.all([readDoc(COMP, uid), readDoc(SUBSCRIPTIONS, uid)]);
    return { ...evaluateWhatsAppAccess({ comp, subscription }), comp, subscription };
  }

  // Admin: mapa uid -> cortesia (colecao pequena; uma leitura por pagina do painel).
  async function listCompGrants() {
    const snapshot = await getDocs(collection(db, COMP));
    return Object.fromEntries(snapshot.docs.map((item) => [item.id, item.data()]));
  }

  async function grantComp(adminUid, uid, { note = '', targetEmail = '' } = {}) {
    if (!adminUid || !uid) throw new Error('WHATSAPP_COMP_INVALID');
    const data = { uid, status: 'active', granted_by: adminUid, granted_at: serverTimestamp() };
    const trimmed = String(note || '').trim().slice(0, 200);
    if (trimmed) data.note = trimmed;
    await setDoc(doc(db, COMP, uid), data);
    auditService?.logLater?.('admin.whatsapp_comp_grant', { target_uid: uid, target_email: targetEmail }, { source: 'web_admin' });
    return { granted: true };
  }

  async function revokeComp(adminUid, uid, { targetEmail = '' } = {}) {
    if (!adminUid || !uid) throw new Error('WHATSAPP_COMP_INVALID');
    await updateDoc(doc(db, COMP, uid), { status: 'revoked', revoked_by: adminUid, revoked_at: serverTimestamp() });
    auditService?.logLater?.('admin.whatsapp_comp_revoke', { target_uid: uid, target_email: targetEmail }, { source: 'web_admin' });
    return { revoked: true };
  }

  return { getMyAccess, listCompGrants, grantComp, revokeComp };
}
