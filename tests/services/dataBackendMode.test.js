import { describe, expect, it } from 'vitest';
import { resolveDataBackendMode } from '../../src/services/data/backendMode.js';

describe('data backend migration mode', () => {
  it('defaults to firebase without enabling migration behavior', () => {
    expect(resolveDataBackendMode({})).toEqual({ mode: 'firebase', primary: 'firebase', shadow: false, dualWrite: false });
  });

  it('requires an explicit migration gate for shadow and supabase', () => {
    expect(() => resolveDataBackendMode({ VITE_DATA_BACKEND: 'shadow' })).toThrow('DATA_BACKEND_MODE_NOT_ENABLED');
    expect(resolveDataBackendMode({ VITE_DATA_BACKEND: 'shadow', VITE_ENABLE_SUPABASE_MIGRATION: 'true' })).toMatchObject({ primary: 'firebase', shadow: true, dualWrite: false });
  });

  it('rejects unknown or dual-write modes', () => {
    expect(() => resolveDataBackendMode({ VITE_DATA_BACKEND: 'dual-write', VITE_ENABLE_SUPABASE_MIGRATION: 'true' })).toThrow('DATA_BACKEND_MODE_INVALID');
  });
});
