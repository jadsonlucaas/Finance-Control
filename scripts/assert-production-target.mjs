const PRODUCTION_PROJECT_ID = 'finance-control-cce4f';
const DENIED_PROJECT_IDS = new Set([
  'finance-control-staging-260919',
  'demo-finance-control-local-e2e'
]);
const AMBIGUOUS_ALIASES = new Set(['default', 'prod', 'production']);
const REQUIRED_FIREBASE_ENV_KEYS = Object.freeze([
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID'
]);

function normalize(value = '') {
  return String(value).trim();
}

function projectFromArgs(args = process.argv.slice(2), env = process.env) {
  const projectFlagIndex = args.findIndex((arg) => arg === '--project' || arg === '-P');
  if (projectFlagIndex >= 0) return normalize(args[projectFlagIndex + 1]);
  const inlineProject = args.find((arg) => arg.startsWith('--project='));
  if (inlineProject) return normalize(inlineProject.slice('--project='.length));
  const positional = args.find((arg) => !arg.startsWith('-'));
  if (positional) return normalize(positional);
  return normalize(env.TARGET_PROJECT_ID || '');
}

export function assertProductionTarget(projectId, env = process.env) {
  const normalizedProjectId = normalize(projectId);
  if (!normalizedProjectId) throw new Error('PRODUCTION_TARGET_REQUIRED');
  if (AMBIGUOUS_ALIASES.has(normalizedProjectId.toLowerCase())) {
    throw new Error(`PRODUCTION_TARGET_AMBIGUOUS_ALIAS:${normalizedProjectId}`);
  }
  if (DENIED_PROJECT_IDS.has(normalizedProjectId) || normalizedProjectId.startsWith('demo-')) {
    throw new Error(`PRODUCTION_TARGET_DENIED:${normalizedProjectId}`);
  }
  if (normalizedProjectId !== PRODUCTION_PROJECT_ID) {
    throw new Error(`PRODUCTION_TARGET_NOT_ALLOWLISTED:${normalizedProjectId}`);
  }
  if (normalize(env.VITE_FINANCE_ENV) !== 'production') {
    throw new Error('PRODUCTION_ENVIRONMENT_REQUIRED');
  }
  if (normalize(env.VITE_FINANCE_USE_FIREBASE_EMULATORS) !== 'false') {
    throw new Error('PRODUCTION_EMULATORS_MUST_BE_DISABLED');
  }
  const missing = REQUIRED_FIREBASE_ENV_KEYS.filter((key) => !normalize(env[key]));
  if (missing.length) throw new Error(`PRODUCTION_ENV_CONFIG_INCOMPLETE:${missing.join(',')}`);
  if (normalize(env.VITE_FIREBASE_PROJECT_ID) !== PRODUCTION_PROJECT_ID) {
    throw new Error(`PRODUCTION_PROJECT_ID_MISMATCH:${normalize(env.VITE_FIREBASE_PROJECT_ID) || 'missing'}`);
  }
  if (normalize(env.VITE_FIREBASE_AUTH_DOMAIN) !== `${PRODUCTION_PROJECT_ID}.firebaseapp.com`) {
    throw new Error('PRODUCTION_AUTH_DOMAIN_MISMATCH');
  }
  return {
    ok: true,
    projectId: normalizedProjectId,
    environment: 'production',
    useEmulators: false,
    authorizesDeploy: false
  };
}

export function assertProductionTargetFromCli(args = process.argv.slice(2), env = process.env) {
  return assertProductionTarget(projectFromArgs(args, env), env);
}

if (process.argv[1] && process.argv[1].endsWith('assert-production-target.mjs')) {
  try {
    console.log(JSON.stringify(assertProductionTargetFromCli(), null, 2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
