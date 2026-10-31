import { createAuthService, persistAuthSession, subscribeAuthState } from './auth.js';
import { createAuditService, installAuditGlobals } from './audit.js';
import { createDataSdkService } from './dataSdk.js';
import { createFirebaseService } from './firebase.js';
import { createUserAdminService } from './userAdmin.js';
import { captureError, captureMessage, clearUserContext, setUserContext } from './observability/index.js';

export function installFirebaseServices({ target = window, config } = {}) {
  const { auth, db, runtime } = createFirebaseService(config);
  const auditService = createAuditService({ auth, db, target });
  const dataServices = createDataSdkService({ auth, db, target, auditService });

  target.__financeDataServices = dataServices;
  target.__financeFirestoreDb = db;
  target.__financeFirebaseRuntime = Object.freeze({
    environment: runtime.environment,
    projectId: runtime.config.projectId,
    useEmulators: runtime.useEmulators,
    authEmulatorUrl: runtime.useEmulators ? String(import.meta.env.VITE_FIREBASE_AUTH_EMULATOR_URL || '') : '',
    firestoreEmulatorHost: runtime.useEmulators ? String(import.meta.env.VITE_FIRESTORE_EMULATOR_HOST || '') : '',
    firestoreEmulatorPort: runtime.useEmulators ? Number(import.meta.env.VITE_FIRESTORE_EMULATOR_PORT || 0) : 0
  });
  target.__financeRawDataSdk = dataServices.dataSdk;
  target.dataSdk = dataServices.dataSdk;
  target.authSdk = createAuthService(auth, auditService);
  target.userAdminSdk = createUserAdminService(db, auditService);
  installAuditGlobals(target, auditService);
  target.cloudLocalStorageSync = dataServices.cloudLocalStorageSync;
  target.firebaseBatchDeleteRecords = dataServices.batchDeleteRecords;

  persistAuthSession(auth).catch((error) => {
    captureError(error, { operation: 'auth.persist_session' });
    console.error('Erro ao persistir sessão', error?.code || error?.name || 'AUTH_SESSION_ERROR');
  });

  subscribeAuthState(auth, (user) => {
    if (!user) {
      clearUserContext();
      dataServices.cleanupOnSignOut();
    } else {
      setUserContext(user);
    }
    captureMessage(user ? 'auth.state.authenticated' : 'auth.state.signed_out', {
      operation: 'auth.state_change',
      authenticated: Boolean(user)
    });

    target.dispatchEvent(new CustomEvent('authStateChanged', {
      detail: user ? { uid: user.uid, email: user.email || '' } : null
    }));
  });

  target.dispatchEvent(new Event('firebasePronto'));

  return {
    auth,
    db,
    auditService,
    dataServices
  };
}
