import { createHash } from 'node:crypto';
import { ApiError } from './errors.js';
import { hashPhone, normalizePhone } from './phoneLinks.js';

/**
 * Exclusao definitiva de conta (LGPD/GDPR: direito de eliminacao).
 *
 * Duas portas, ambas com o ID token do Firebase conferido aqui (com revogacao):
 * - propria conta: exige login recente (senha digitada de novo) e o e-mail como confirmacao;
 * - admin: exige admin ativo, nunca a propria conta nem o owner; admin so o owner exclui.
 *
 * Ordem (cada passo pode ser repetido; uma falha no meio deixa a conta bloqueada e a nova
 * tentativa continua de onde parou):
 *  1. bloqueia o perfil (status inactive) e revoga as sessoes;
 *  2. apaga o cliente no Stripe (cancela a assinatura na hora; faturas ficam no Stripe para fins fiscais);
 *  3. apaga todos os dados no Firestore (ver ACCOUNT_DATA_LOCATIONS) e anonimiza referencias em dados de terceiros;
 *  4. apaga o login no Firebase Authentication;
 *  5. confere que nada sobrou e grava um registro sem dados pessoais (hash do uid).
 */
export const REAUTH_MAX_AGE_SECONDS = 10 * 60;
export const DELETED_MARKER = 'conta-excluida';
const ADMIN_ROLES = ['admin', 'owner'];
const UID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

// Tudo que guarda dado de uma conta. Ao criar colecao nova com dado de usuario, inclua aqui e no store.
export const ACCOUNT_DATA_LOCATIONS = Object.freeze([
  'users/{uid} (perfil) e todas as subcolecoes (finance_records, local_storage, audit_logs, idempotency_receipts, whatsapp_pending_actions...)',
  'user_onboarding/{uid}',
  'whatsapp_links (uid)',
  'whatsapp_link_codes (owner_uid)',
  'whatsapp_link_attempts/{hash do telefone}',
  'whatsapp_comp_access/{uid}',
  'billing_subscriptions/{uid}',
  'billing_customers (uid)',
  'billing_stripe_subscriptions (customer_id)',
  'users/*/audit_logs de admins (details.target_uid/target_email): anonimizados',
  'shared_macros/shared_categories (owner_uid/owner_email): anonimizados',
  'Firebase Authentication',
  'Stripe (cliente e assinatura)'
]);

export const hashUid = (uid) => createHash('sha256').update(String(uid)).digest('hex');
const sameEmail = (a, b) => {
  const left = String(a || '').trim().toLowerCase();
  return Boolean(left) && left === String(b || '').trim().toLowerCase();
};
const isNotFound = (error) => error?.code === 'auth/user-not-found' || error?.errorInfo?.code === 'auth/user-not-found';

export function createAccountDeletionService({ store, verifyIdToken, auth, stripe = null, now = () => new Date(), logger = console } = {}) {
  const configured = Boolean(store && verifyIdToken && auth);

  async function authenticate(body) {
    if (!configured) throw new ApiError(503, 'ACCOUNT_DELETION_NOT_CONFIGURED', 'Exclusao de conta indisponivel no momento.');
    const token = String(body?.idToken || '');
    if (!token) throw new ApiError(401, 'AUTH_REQUIRED', 'Entre na sua conta.');
    try {
      const decoded = await verifyIdToken(token);
      if (!decoded?.uid) throw new Error('no uid');
      return decoded;
    } catch {
      throw new ApiError(401, 'AUTH_INVALID', 'Sessao expirada. Entre de novo.');
    }
  }

  const isAdminAccount = (decoded, profile) => decoded?.admin === true
    || (profile?.status === 'active' && ADMIN_ROLES.includes(profile?.role));

  async function getAuthUser(uid) {
    try {
      return await auth.getUser(uid);
    } catch (error) {
      if (isNotFound(error)) return null;
      throw error;
    }
  }

  async function ignoreMissingUser(action) {
    try {
      await action();
    } catch (error) {
      if (!isNotFound(error)) throw error;
    }
  }

  async function deleteStripeCustomers(customerIds) {
    if (!customerIds.length) return 0;
    // Sem Stripe configurado a assinatura continuaria cobrando: a conta fica bloqueada e a exclusao espera.
    if (!stripe?.del) throw new ApiError(503, 'STRIPE_REQUIRED', 'Nao foi possivel cancelar a assinatura agora. A conta foi bloqueada; tente de novo.');
    for (const customerId of customerIds) {
      try {
        await stripe.del(`/customers/${encodeURIComponent(customerId)}`);
      } catch (error) {
        if (error?.stripe?.status !== 404) throw error;
      }
    }
    return customerIds.length;
  }

  async function purge(uid, { mode, actorUid }) {
    const nowIso = now().toISOString();
    const uidHash = hashUid(uid);
    await store.markAccountDeleting(uid, nowIso);
    await ignoreMissingUser(() => auth.revokeRefreshTokens(uid));

    const footprint = await store.getAccountFootprint(uid);
    const customerIds = [...new Set(footprint.customerIds.filter(Boolean))];
    const phoneKeys = [...new Set(footprint.phones.map(normalizePhone).filter(Boolean).map(hashPhone))];
    const stripeCustomers = await deleteStripeCustomers(customerIds);

    const counts = await store.purgeAccountData(uid, { customerIds, phoneKeys, marker: DELETED_MARKER });
    await ignoreMissingUser(() => auth.deleteUser(uid));

    const leftovers = await store.findAccountLeftovers(uid, { customerIds, phoneKeys });
    if (await getAuthUser(uid)) leftovers.push('firebase_auth');
    if (leftovers.length) {
      logger.error?.(JSON.stringify({ level: 'error', event: 'account_deletion_incomplete', uid_hash: uidHash.slice(0, 16), leftovers }));
      throw new ApiError(500, 'DELETION_INCOMPLETE', 'A exclusao nao terminou. Tente de novo.', { restantes: leftovers });
    }

    await store.recordAccountDeletion(uidHash, {
      uid_hash: uidHash,
      mode,
      actor: mode === 'admin' ? actorUid : 'self',
      deleted_at: nowIso,
      stripe_customers_deleted: stripeCustomers,
      counts
    });
    logger.info?.(JSON.stringify({ level: 'info', event: 'account_deleted', mode, uid_hash: uidHash.slice(0, 16), counts }));
    return { excluido: true, contagem: counts };
  }

  async function deleteOwnAccount(body) {
    const decoded = await authenticate(body);
    const authAgeSeconds = Math.floor(now().getTime() / 1000) - Number(decoded.auth_time || 0);
    if (!(authAgeSeconds >= 0 && authAgeSeconds <= REAUTH_MAX_AGE_SECONDS)) {
      throw new ApiError(401, 'REAUTH_REQUIRED', 'Confirme sua senha para excluir a conta.');
    }
    const profile = await store.getUserProfile(decoded.uid);
    if (decoded.admin === true || ADMIN_ROLES.includes(profile?.role)) {
      throw new ApiError(403, 'ADMIN_SELF_DELETE_BLOCKED', 'Contas de administrador nao podem se excluir. Peca a outro administrador.');
    }
    if (!sameEmail(body?.confirmacao, decoded.email || profile?.email)) {
      throw new ApiError(400, 'CONFIRMATION_MISMATCH', 'Digite o e-mail da conta para confirmar.');
    }
    return purge(decoded.uid, { mode: 'self', actorUid: decoded.uid });
  }

  async function deleteUserAsAdmin(body) {
    const decoded = await authenticate(body);
    const callerProfile = await store.getUserProfile(decoded.uid);
    if (!isAdminAccount(decoded, callerProfile)) throw new ApiError(403, 'ADMIN_REQUIRED', 'Apenas administradores podem excluir contas.');
    const targetUid = String(body?.uid || '').trim();
    if (!UID_PATTERN.test(targetUid)) throw new ApiError(400, 'INVALID_UID', 'Usuario invalido.');
    if (targetUid === decoded.uid) throw new ApiError(403, 'ADMIN_SELF_DELETE_BLOCKED', 'Voce nao pode excluir a propria conta pelo painel.');

    const [targetProfile, targetAuth] = await Promise.all([store.getUserProfile(targetUid), getAuthUser(targetUid)]);
    if (!targetProfile && !targetAuth) throw new ApiError(404, 'USER_NOT_FOUND', 'Usuario nao encontrado.');
    if (targetProfile?.role === 'owner') throw new ApiError(403, 'OWNER_DELETE_BLOCKED', 'A conta owner nao pode ser excluida.');
    if (targetProfile?.role === 'admin' && callerProfile?.role !== 'owner') {
      throw new ApiError(403, 'OWNER_REQUIRED', 'Apenas o owner exclui administradores.');
    }
    if (!sameEmail(body?.confirmacao, targetProfile?.email || targetAuth?.email)) {
      throw new ApiError(400, 'CONFIRMATION_MISMATCH', 'Digite o e-mail da conta para confirmar.');
    }
    return purge(targetUid, { mode: 'admin', actorUid: decoded.uid });
  }

  return { configured, deleteOwnAccount, deleteUserAsAdmin, purge };
}
