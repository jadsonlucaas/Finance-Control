import { createAuthService, persistAuthSession, subscribeAuthState } from './auth.js';
import { createAuditService, installAuditGlobals } from './audit.js';
import { createDataSdkService } from './dataSdk.js';
import { createFirebaseService } from './firebase.js';
import { createUserAdminService } from './userAdmin.js';
import { createWhatsAppLinkService } from './whatsappLink.js';
import { createWhatsAppAccessService } from './whatsappAccess.js';
import { createAccountOnboardingService, validateSignupDetails } from './accountOnboarding.js';
import { createProfileAccessService } from './profileAccess.js';
import { getProfileAccessErrorMessage } from './profileAccessErrors.js';
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
  const authService = createAuthService(auth, auditService);
  target.userAdminSdk = createUserAdminService(db, auditService);
  target.whatsappLinkSdk = createWhatsAppLinkService(db);
  target.whatsappAccessSdk = createWhatsAppAccessService(db, auditService);
  // Alias neutro de canal para o painel de usuarios.
  target.assistantAccessSdk = target.whatsappAccessSdk;
  target.__financeWhatsAppConfig = Object.freeze({
    botNumber: String(import.meta.env?.VITE_WHATSAPP_BOT_NUMBER || '').trim(),
    // Links publicos do Stripe (Payment Links e portal do cliente); nao sao segredos.
    billing: Object.freeze({
      premiumLinkBrl: String(import.meta.env?.VITE_STRIPE_PREMIUM_LINK_BRL || '').trim(),
      premiumLinkEur: String(import.meta.env?.VITE_STRIPE_PREMIUM_LINK_EUR || '').trim(),
      portalUrl: String(import.meta.env?.VITE_STRIPE_PORTAL_URL || '').trim()
    })
  });
  const profileAccessService = createProfileAccessService({
    authService,
    userAdminService: target.userAdminSdk
  });
  target.accountOnboardingSdk = createAccountOnboardingService(db);
  target.authSdk = {
    ...authService,
    validateSignupDetails,
    // Cria a conta e guarda pais/WhatsApp. Se essa gravacao falhar, a conta continua criada
    // e os dados podem ser completados depois (antes do checkout).
    signUp: async (email, password, details = null) => {
      const credential = await authService.signUp(email, password);
      if (details && credential?.user?.uid) {
        try {
          await target.accountOnboardingSdk.saveSignupDetails(credential.user.uid, details);
        } catch (error) {
          captureError(error, { operation: 'auth.sign_up.onboarding_details' });
        }
      }
      return credential;
    },
    loadProfileAccess: profileAccessService.load,
    getProfileAccessErrorMessage
  };
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
