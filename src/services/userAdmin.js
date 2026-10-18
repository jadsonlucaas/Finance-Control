import {
  collection,
  doc,
  documentId,
  getDoc,
  getDocs,
  limit as firestoreLimit,
  orderBy as firestoreOrderBy,
  query as firestoreQuery,
  setDoc,
  startAfter,
  updateDoc,
  where
} from 'firebase/firestore';
import {
  ACCOUNT_ROLE,
  ACCOUNT_STATUS,
  buildAdminUpdatePlan,
  buildInitialUserProfile,
  normalizeAccountRole,
  normalizeAccountStatus
} from '../domain/accountLifecycle.js';
import {
  decodePageCursor,
  encodePageCursor,
  MAX_PAGE_LIMIT
} from '../application/repositories/pagination.js';

function mapUserDoc(item) {
  const data = item.data();
  return {
    uid: item.id,
    ...data,
    role: normalizeAccountRole(data.role, ACCOUNT_ROLE.USER),
    status: normalizeAccountStatus(data.status, ACCOUNT_STATUS.ACTIVE)
  };
}

function normalizeUserAdminQuery(input = {}) {
  const filters = input.filters || input;
  const requestedLimit = input.pageSize ?? input.limit ?? 50;
  const limit = Math.max(1, Math.min(Number(requestedLimit) || 50, MAX_PAGE_LIMIT));
  const status = Object.values(ACCOUNT_STATUS).includes(filters.status) ? filters.status : '';
  const role = Object.values(ACCOUNT_ROLE).includes(filters.role) ? filters.role : '';
  return {
    limit,
    cursor: input.cursor || '',
    orderBy: 'email',
    direction: 'asc',
    status,
    role
  };
}

export function createUserAdminService(db, auditService = null) {
  async function ensureProfile(user) {
    const userRef = doc(db, 'users', user.uid);
    const snapshot = await getDoc(userRef);
    const now = new Date().toISOString();

    if (!snapshot.exists()) {
      const profile = buildInitialUserProfile(user, { now });
      await setDoc(userRef, profile, { merge: true });
      auditService?.logLater?.('admin.profile_create', {
        target_uid: user.uid,
        role: profile.role,
        status: profile.status
      }, { user });
      return profile;
    }

    const profile = {
      uid: user.uid,
      ...snapshot.data()
    };
    profile.role = normalizeAccountRole(profile.role, ACCOUNT_ROLE.USER);
    profile.status = normalizeAccountStatus(profile.status, ACCOUNT_STATUS.ACTIVE);
    const updates = {
      email: user.email || profile.email || '',
      updated_at: now,
      last_login_at: now
    };
    setDoc(userRef, updates, { merge: true }).catch((error) => console.error('Erro ao atualizar perfil', error));
    return { ...profile, ...updates };
  }

  async function getProfile(uid) {
    const snapshot = await getDoc(doc(db, 'users', uid));
    if (!snapshot.exists()) return null;
    const data = snapshot.data();
    return {
      uid,
      ...data,
      role: normalizeAccountRole(data.role, ACCOUNT_ROLE.USER),
      status: normalizeAccountStatus(data.status, ACCOUNT_STATUS.ACTIVE)
    };
  }

  async function listUsers(input) {
    if (!input || Object.keys(input).length === 0) {
      const snapshot = await getDocs(collection(db, 'users'));
      return snapshot.docs
        .map(mapUserDoc)
        .sort((a, b) => (a.email || '').localeCompare(b.email || ''));
    }

    const queryInput = normalizeUserAdminQuery(input);
    const constraints = [];
    if (queryInput.status) constraints.push(where('status', '==', queryInput.status));
    if (queryInput.role) constraints.push(where('role', '==', queryInput.role));
    constraints.push(
      firestoreOrderBy('email', 'asc'),
      firestoreOrderBy(documentId(), 'asc')
    );
    const decodedCursor = decodePageCursor(queryInput.cursor);
    if (decodedCursor?.email !== undefined && decodedCursor?.uid) {
      constraints.push(startAfter(decodedCursor.email, decodedCursor.uid));
    }
    constraints.push(firestoreLimit(queryInput.limit + 1));

    const snapshot = await getDocs(firestoreQuery(collection(db, 'users'), ...constraints));
    const users = snapshot.docs.map(mapUserDoc);
    const pageUsers = users.slice(0, queryInput.limit);
    const last = pageUsers.at(-1);
    const hasMore = snapshot.docs.length > queryInput.limit;

    return {
      items: pageUsers,
      count: pageUsers.length,
      hasMore,
      nextCursor: hasMore && last ? encodePageCursor({ email: last.email || '', uid: last.uid }) : '',
      totalKnown: undefined,
      pageInfo: {
        limit: queryInput.limit,
        orderBy: 'email',
        direction: 'asc',
        filters: {
          status: queryInput.status,
          role: queryInput.role
        },
        source: 'firestore',
        searchMode: 'local_page'
      }
    };
  }

  async function updateUser(uid, payload) {
    const userRef = doc(db, 'users', uid);
    const beforeSnapshot = await getDoc(userRef);
    if (!beforeSnapshot.exists()) throw new Error('USER_PROFILE_NOT_FOUND');

    const previous = { uid, ...beforeSnapshot.data() };
    const plan = buildAdminUpdatePlan(previous, payload || {});
    if (!plan.isOk) throw new Error(plan.error);

    const updatePayload = {
      ...plan.patch,
      updated_at: new Date().toISOString()
    };

    await updateDoc(userRef, updatePayload);

    const action = plan.previousStatus !== plan.nextStatus
      ? plan.statusAction
      : plan.previousRole !== plan.nextRole
        ? 'admin.user_role_change'
        : 'admin.user_update';

    const auditDetails = {
      target_uid: uid,
      target_email: previous.email || '',
      updated_fields: Object.keys(plan.patch),
      previous_role: plan.previousRole,
      next_role: plan.nextRole,
      previous_status: plan.previousStatus,
      next_status: plan.nextStatus
    };
    const auditContext = {
      status: 'success',
      source: 'web_admin'
    };

    auditService?.logLater?.(action, auditDetails, auditContext);

    return {
      isOk: true,
      action,
      updated_fields: Object.keys(plan.patch),
      previous_role: plan.previousRole,
      next_role: plan.nextRole,
      previous_status: plan.previousStatus,
      next_status: plan.nextStatus
    };
  }

  return {
    ensureProfile,
    getProfile,
    listUsers,
    updateUser
  };
}
