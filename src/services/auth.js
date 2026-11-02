import {
  browserSessionPersistence,
  createUserWithEmailAndPassword,
  getIdTokenResult,
  onAuthStateChanged,
  setPersistence,
  signInWithEmailAndPassword,
  signOut
} from 'firebase/auth';
import { normalizeAuthError } from './authErrors.js';
import {
  captureError,
  captureMessage,
  clearUserContext,
  setUserContext,
  traceOperation
} from './observability/index.js';

export { normalizeAuthError };

export function createAuthService(auth, auditService = null) {
  return {
    signIn: async (email, password) => traceOperation('auth.sign_in', { operation: 'auth.sign_in' }, async () => {
      try {
        const credential = await signInWithEmailAndPassword(auth, email, password);
        auditService?.logLater?.('auth.login', { email });
        setUserContext(credential.user);
        captureMessage('auth.sign_in.success', { operation: 'auth.sign_in', authenticated: true });
        return credential;
      } catch (error) {
        captureMessage('auth.sign_in.failure', {
          operation: 'auth.sign_in',
          authenticated: false,
          error_code: error?.code || 'AUTH_SIGN_IN_FAILED'
        });
        throw error;
      }
    }),
    signUp: async (email, password) => traceOperation('auth.sign_up', { operation: 'auth.sign_up' }, async () => {
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      auditService?.logLater?.('auth.signup', { email });
      setUserContext(credential.user);
      return credential;
    }),
    signOut: async () => traceOperation('auth.sign_out', { operation: 'auth.sign_out' }, async () => {
      auditService?.logLater?.('auth.logout', { email: auth.currentUser?.email || '' });
      const result = await signOut(auth);
      clearUserContext();
      return result;
    }),
    getCurrentUser: () => auth.currentUser,
    getClaims: async (forceRefresh = false) => traceOperation('auth.get_claims', {
      operation: 'auth.get_claims',
      force_refresh: Boolean(forceRefresh)
    }, async () => {
      if (!auth.currentUser) return {};
      const token = await getIdTokenResult(auth.currentUser, forceRefresh);
      return token.claims || {};
    }),
    normalizeError: normalizeAuthError
  };
}

export function persistAuthSession(auth) {
  return traceOperation('auth.persist_session', { operation: 'auth.persist_session' }, () => (
    setPersistence(auth, browserSessionPersistence)
  ));
}

export function subscribeAuthState(auth, callback) {
  return onAuthStateChanged(auth, (user) => {
    if (user) setUserContext(user);
    else clearUserContext();
    callback(user);
  }, (error) => {
    captureError(error, { operation: 'auth.state_subscription' });
  });
}
