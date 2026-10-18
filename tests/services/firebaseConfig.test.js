import { describe, expect, it } from 'vitest';
import { environmentConfig, resolveFirebaseEnvironment } from '../../src/services/firebase.js';

describe('Firebase environment config', () => {
  it('fails closed when the environment is absent', () => {
    expect(environmentConfig({})).toBe(null);
    expect(() => resolveFirebaseEnvironment({})).toThrow('FIREBASE_ENVIRONMENT_REQUIRED');
  });

  it('enforces the explicit environment matrix', () => {
    const local = resolveFirebaseEnvironment({
      VITE_FINANCE_ENV: 'local-e2e',
      VITE_FINANCE_USE_FIREBASE_EMULATORS: 'true',
      VITE_FIREBASE_PROJECT_ID: 'demo-finance-control-local-e2e'
    });
    expect(local).toMatchObject({ environment: 'local-e2e', useEmulators: true, config: { projectId: 'demo-finance-control-local-e2e' } });
    expect(resolveFirebaseEnvironment({
      VITE_FINANCE_ENV: 'production',
      VITE_FINANCE_USE_FIREBASE_EMULATORS: 'false',
      VITE_FIREBASE_API_KEY: 'key', VITE_FIREBASE_AUTH_DOMAIN: 'x', VITE_FIREBASE_PROJECT_ID: 'finance-control-cce4f',
      VITE_FIREBASE_STORAGE_BUCKET: 'x', VITE_FIREBASE_MESSAGING_SENDER_ID: '1', VITE_FIREBASE_APP_ID: 'x'
    }).config.projectId).toBe('finance-control-cce4f');
  });

  it('rejects cross-environment project IDs and emulator modes', () => {
    expect(() => resolveFirebaseEnvironment({
      VITE_FINANCE_ENV: 'local-e2e',
      VITE_FINANCE_USE_FIREBASE_EMULATORS: 'true',
      VITE_FIREBASE_PROJECT_ID: 'finance-control-cce4f'
    })).toThrow('FIREBASE_EMULATOR_PROJECT_ID_REQUIRED');
    expect(() => resolveFirebaseEnvironment({
      VITE_FINANCE_ENV: 'staging',
      VITE_FINANCE_USE_FIREBASE_EMULATORS: 'false',
      VITE_FIREBASE_API_KEY: 'key', VITE_FIREBASE_AUTH_DOMAIN: 'x', VITE_FIREBASE_PROJECT_ID: 'finance-control-cce4f',
      VITE_FIREBASE_STORAGE_BUCKET: 'x', VITE_FIREBASE_MESSAGING_SENDER_ID: '1', VITE_FIREBASE_APP_ID: 'x'
    })).toThrow('FIREBASE_PROJECT_ID_MISMATCH:staging:finance-control-cce4f');
    expect(() => resolveFirebaseEnvironment({
      VITE_FINANCE_ENV: 'production',
      VITE_FINANCE_USE_FIREBASE_EMULATORS: 'true'
    })).toThrow('FIREBASE_EMULATOR_MODE_MISMATCH:production');
    expect(() => resolveFirebaseEnvironment({
      VITE_FINANCE_ENV: 'local-e2e',
      VITE_FINANCE_USE_FIREBASE_EMULATORS: 'false'
    })).toThrow('FIREBASE_EMULATOR_MODE_MISMATCH:local-e2e');
  });

  it('builds a complete staging config from Vite env without production identifiers', () => {
    expect(environmentConfig({
      VITE_FIREBASE_API_KEY: 'public-staging-api-key',
      VITE_FIREBASE_AUTH_DOMAIN: 'finance-control-staging-260919.firebaseapp.com',
      VITE_FIREBASE_PROJECT_ID: 'finance-control-staging-260919',
      VITE_FIREBASE_STORAGE_BUCKET: 'finance-control-staging-260919.firebasestorage.app',
      VITE_FIREBASE_MESSAGING_SENDER_ID: '945561850688',
      VITE_FIREBASE_APP_ID: '1:945561850688:web:8a00895f04d01d5aa860a5'
    })).toEqual({
      apiKey: 'public-staging-api-key',
      authDomain: 'finance-control-staging-260919.firebaseapp.com',
      projectId: 'finance-control-staging-260919',
      storageBucket: 'finance-control-staging-260919.firebasestorage.app',
      messagingSenderId: '945561850688',
      appId: '1:945561850688:web:8a00895f04d01d5aa860a5'
    });
  });

  it('fails closed when only part of the staging config is provided', () => {
    expect(() => environmentConfig({
      VITE_FIREBASE_PROJECT_ID: 'finance-control-staging-260919'
    })).toThrow('FIREBASE_ENV_CONFIG_INCOMPLETE:');
  });
});
