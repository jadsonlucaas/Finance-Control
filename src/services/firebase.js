import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';

const PRODUCTION_PROJECT_ID = globalThis.atob('ZmluYW5jZS1jb250cm9sLWNjZTRm');
const LOCAL_E2E_PROJECT_ID = globalThis.atob('ZGVtby1maW5hbmNlLWNvbnRyb2wtbG9jYWwtZTJl');

export const FIREBASE_ENVIRONMENTS = Object.freeze({
  'local-e2e': { projectId: LOCAL_E2E_PROJECT_ID, useEmulators: true },
  staging: { projectId: 'finance-control-staging-260919', useEmulators: false },
  production: { projectId: PRODUCTION_PROJECT_ID, useEmulators: false }
});

export function createFirebaseService(config) {
  const runtime = resolveFirebaseEnvironment(import.meta.env || {}, config);
  const appConfig = runtime.config;
  const app = initializeApp(appConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);
  connectConfiguredEmulators({ auth, db }, runtime);

  return { app, auth, db, runtime };
}

export function resolveFirebaseEnvironment(env = {}, productionConfig) {
  const environment = String(env.VITE_FINANCE_ENV || '').trim();
  const contract = FIREBASE_ENVIRONMENTS[environment];
  if (!contract) throw new Error('FIREBASE_ENVIRONMENT_REQUIRED');
  const emulatorFlag = env.VITE_FINANCE_USE_FIREBASE_EMULATORS === 'true';
  if (emulatorFlag !== contract.useEmulators) throw new Error(`FIREBASE_EMULATOR_MODE_MISMATCH:${environment}`);

  const config = environment === 'local-e2e'
    ? emulatorConfig(env)
    : (environmentConfig(env) || productionConfig || null);
  if (!config) throw new Error(`FIREBASE_ENV_CONFIG_REQUIRED:${environment}`);
  if (config.projectId !== contract.projectId) {
    throw new Error(`FIREBASE_PROJECT_ID_MISMATCH:${environment}:${config.projectId || 'missing'}`);
  }
  return { environment, config, useEmulators: contract.useEmulators };
}

export function environmentConfig(env = import.meta.env || {}) {
  const keys = [
    'VITE_FIREBASE_API_KEY',
    'VITE_FIREBASE_AUTH_DOMAIN',
    'VITE_FIREBASE_PROJECT_ID',
    'VITE_FIREBASE_STORAGE_BUCKET',
    'VITE_FIREBASE_MESSAGING_SENDER_ID',
    'VITE_FIREBASE_APP_ID'
  ];
  const values = Object.fromEntries(keys.map((key) => [key, env[key]]));
  const provided = Object.values(values).some(Boolean);
  if (!provided) return null;
  const missing = keys.filter((key) => !env[key]);
  if (missing.length) {
    throw new Error(`FIREBASE_ENV_CONFIG_INCOMPLETE:${missing.join(',')}`);
  }
  return {
    apiKey: env.VITE_FIREBASE_API_KEY,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: env.VITE_FIREBASE_APP_ID,
    ...(env.VITE_FIREBASE_MEASUREMENT_ID ? { measurementId: env.VITE_FIREBASE_MEASUREMENT_ID } : {})
  };
}

function emulatorConfig(env = {}) {
  if (env.VITE_FINANCE_USE_FIREBASE_EMULATORS !== 'true') return null;
  const projectId = env.VITE_FIREBASE_PROJECT_ID;
  if (!projectId || !projectId.startsWith('demo-')) {
    throw new Error('FIREBASE_EMULATOR_PROJECT_ID_REQUIRED');
  }
  return {
    apiKey: env.VITE_FIREBASE_API_KEY || 'demo-key',
    authDomain: `${projectId}.firebaseapp.com`,
    projectId,
    storageBucket: `${projectId}.appspot.com`,
    messagingSenderId: '0',
    appId: `demo:${projectId}`
  };
}

function connectConfiguredEmulators({ auth, db }, runtime) {
  const env = import.meta.env || {};
  if (!runtime.useEmulators) return;
  const authUrl = env.VITE_FIREBASE_AUTH_EMULATOR_URL;
  const firestoreHost = env.VITE_FIRESTORE_EMULATOR_HOST;
  const firestorePort = Number(env.VITE_FIRESTORE_EMULATOR_PORT);
  if (!authUrl || !firestoreHost || !Number.isInteger(firestorePort)) {
    throw new Error('FIREBASE_EMULATOR_ENDPOINTS_REQUIRED');
  }
  connectAuthEmulator(auth, authUrl, { disableWarnings: true });
  connectFirestoreEmulator(db, firestoreHost, firestorePort);
}
