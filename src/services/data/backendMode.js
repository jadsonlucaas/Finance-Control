const ALLOWED_DATA_BACKENDS = new Set(['firebase', 'supabase', 'shadow']);

export function resolveDataBackendMode(env = {}) {
  const mode = String(env.VITE_DATA_BACKEND || 'firebase').trim();
  if (!ALLOWED_DATA_BACKENDS.has(mode)) throw new Error(`DATA_BACKEND_MODE_INVALID:${mode}`);
  if (mode !== 'firebase' && env.VITE_ENABLE_SUPABASE_MIGRATION !== 'true') {
    throw new Error(`DATA_BACKEND_MODE_NOT_ENABLED:${mode}`);
  }
  return Object.freeze({
    mode,
    primary: mode === 'supabase' ? 'supabase' : 'firebase',
    shadow: mode === 'shadow',
    dualWrite: false
  });
}
