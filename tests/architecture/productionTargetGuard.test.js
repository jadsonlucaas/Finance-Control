import { describe, expect, it } from 'vitest';
import { assertProductionTarget } from '../../scripts/assert-production-target.mjs';

const validEnv = Object.freeze({
  VITE_FINANCE_ENV: 'production',
  VITE_FINANCE_USE_FIREBASE_EMULATORS: 'false',
  VITE_FIREBASE_API_KEY: 'public-web-config',
  VITE_FIREBASE_AUTH_DOMAIN: 'finance-control-cce4f.firebaseapp.com',
  VITE_FIREBASE_PROJECT_ID: 'finance-control-cce4f',
  VITE_FIREBASE_STORAGE_BUCKET: 'finance-control-cce4f.firebasestorage.app',
  VITE_FIREBASE_MESSAGING_SENDER_ID: '1050867234579',
  VITE_FIREBASE_APP_ID: '1:1050867234579:web:c0e9456b8e45d3e5fc4ce6'
});

describe('production target guard', () => {
  it('allows only the explicit production target with a complete isolated environment', () => {
    expect(assertProductionTarget('finance-control-cce4f', validEnv)).toEqual({
      ok: true,
      projectId: 'finance-control-cce4f',
      environment: 'production',
      useEmulators: false,
      authorizesDeploy: false
    });
  });

  it('rejects staging, demo, ambiguous and unknown targets', () => {
    expect(() => assertProductionTarget('finance-control-staging-260919', validEnv)).toThrow('PRODUCTION_TARGET_DENIED');
    expect(() => assertProductionTarget('demo-project', validEnv)).toThrow('PRODUCTION_TARGET_DENIED');
    expect(() => assertProductionTarget('default', validEnv)).toThrow('PRODUCTION_TARGET_AMBIGUOUS_ALIAS');
    expect(() => assertProductionTarget('other-project', validEnv)).toThrow('PRODUCTION_TARGET_NOT_ALLOWLISTED');
  });

  it('rejects staging environment, active emulators and incomplete config', () => {
    expect(() => assertProductionTarget('finance-control-cce4f', { ...validEnv, VITE_FINANCE_ENV: 'staging' })).toThrow('PRODUCTION_ENVIRONMENT_REQUIRED');
    expect(() => assertProductionTarget('finance-control-cce4f', { ...validEnv, VITE_FINANCE_USE_FIREBASE_EMULATORS: 'true' })).toThrow('PRODUCTION_EMULATORS_MUST_BE_DISABLED');
    expect(() => assertProductionTarget('finance-control-cce4f', { ...validEnv, VITE_FIREBASE_APP_ID: '' })).toThrow('PRODUCTION_ENV_CONFIG_INCOMPLETE');
  });

  it('rejects cross-project Firebase config', () => {
    expect(() => assertProductionTarget('finance-control-cce4f', {
      ...validEnv,
      VITE_FIREBASE_PROJECT_ID: 'finance-control-staging-260919'
    })).toThrow('PRODUCTION_PROJECT_ID_MISMATCH');
  });
});
