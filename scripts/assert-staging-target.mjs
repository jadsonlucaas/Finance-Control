const KNOWN_PRODUCTION_PROJECT_IDS = Object.freeze([
  'finance-control-cce4f'
]);

const ALLOWED_STAGING_PROJECT_IDS = Object.freeze([
  'finance-control-staging-260919'
]);

const AMBIGUOUS_ALIASES = new Set(['default', 'prod', 'production']);

function normalizeProjectId(value = '') {
  return String(value).trim();
}

function projectFromArgs(args = process.argv.slice(2), env = process.env) {
  const projectFlagIndex = args.findIndex((arg) => arg === '--project' || arg === '-P');
  if (projectFlagIndex >= 0) return normalizeProjectId(args[projectFlagIndex + 1]);

  const inlineProject = args.find((arg) => arg.startsWith('--project='));
  if (inlineProject) return normalizeProjectId(inlineProject.slice('--project='.length));

  const targetFlag = args.find((arg) => arg.startsWith('--target='));
  if (targetFlag) return normalizeProjectId(targetFlag.slice('--target='.length));

  const positional = args.find((arg) => !arg.startsWith('-'));
  if (positional) return normalizeProjectId(positional);

  return normalizeProjectId(
    env.TARGET_PROJECT_ID
      || env.FIREBASE_PROJECT
      || env.GCLOUD_PROJECT
      || env.VITE_FIREBASE_PROJECT_ID
      || ''
  );
}

export function assertStagingTarget(projectId, {
  productionProjectIds = KNOWN_PRODUCTION_PROJECT_IDS,
  allowedStagingProjectIds = ALLOWED_STAGING_PROJECT_IDS
} = {}) {
  const normalizedProjectId = normalizeProjectId(projectId);

  if (!normalizedProjectId) {
    throw new Error('STAGING_TARGET_REQUIRED');
  }

  if (AMBIGUOUS_ALIASES.has(normalizedProjectId.toLowerCase())) {
    throw new Error(`STAGING_TARGET_AMBIGUOUS_ALIAS:${normalizedProjectId}`);
  }

  if (productionProjectIds.includes(normalizedProjectId)) {
    throw new Error(`STAGING_TARGET_IS_PRODUCTION:${normalizedProjectId}`);
  }

  if (!allowedStagingProjectIds.includes(normalizedProjectId)) {
    throw new Error(`STAGING_TARGET_NOT_ALLOWLISTED:${normalizedProjectId}`);
  }

  return {
    ok: true,
    projectId: normalizedProjectId,
    productionProjectIds,
    allowedStagingProjectIds
  };
}

export function assertStagingTargetFromCli(args = process.argv.slice(2), env = process.env) {
  return assertStagingTarget(projectFromArgs(args, env));
}

if (process.argv[1] && process.argv[1].endsWith('assert-staging-target.mjs')) {
  try {
    const result = assertStagingTargetFromCli();
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
