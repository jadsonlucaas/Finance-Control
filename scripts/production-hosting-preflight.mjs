import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertProductionTarget } from './assert-production-target.mjs';

const PROD = 'finance-control-cce4f';
const STAGING = 'finance-control-staging-260919';
const TEXT_EXTENSIONS = new Set(['.html', '.js', '.css', '.json', '.txt', '.xml', '.webmanifest']);
const value = (input = '') => String(input).trim();
const flag = (args, name) => {
  const index = args.indexOf(name);
  const inline = args.find((item) => item.startsWith(`${name}=`));
  return inline ? inline.slice(name.length + 1) : index >= 0 ? args[index + 1] : '';
};

export function evaluateHostingPreflight({ env, deployment, repository, build }) {
  const errors = [];
  const warnings = [];
  try { assertProductionTarget(deployment.project, env); } catch (error) { errors.push(error.message); }
  if (deployment.only !== 'hosting') errors.push('DEPLOY_SCOPE_MUST_BE_HOSTING_ONLY');
  if (value(env.VITE_DATA_BACKEND) !== 'firebase') errors.push('DATA_BACKEND_MUST_BE_FIREBASE');
  if (value(env.VITE_DATA_DUAL_WRITE) !== 'false') errors.push('DATA_DUAL_WRITE_MUST_BE_DISABLED');
  if (value(env.VITE_DATA_SHADOW_READ) !== 'false') errors.push('DATA_SHADOW_READ_MUST_BE_DISABLED');
  if (env.VITE_SUPABASE_URL || env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_SERVICE_ROLE_KEY) errors.push('SUPABASE_CONFIGURATION_FORBIDDEN');
  if (!value(env.VITE_SENTRY_DSN)) warnings.push('OPTIONAL_OBSERVABILITY:SENTRY_NOOP');
  if (repository.branch !== 'main') errors.push(`DEPLOY_BRANCH_MUST_BE_MAIN:${repository.branch}`);
  if (!repository.clean) errors.push('WORKTREE_MUST_BE_CLEAN');
  if (!repository.expectedCommit || repository.head !== repository.expectedCommit) errors.push('HEAD_COMMIT_MISMATCH');
  if (repository.ciStatus !== 'success') errors.push(`CI_NOT_GREEN:${repository.ciStatus || 'missing'}`);
  if (!repository.rollbackCommit) errors.push('ROLLBACK_COMMIT_REQUIRED');
  if (repository.rollbackCommit && !repository.rollbackIsAncestor) errors.push('ROLLBACK_COMMIT_NOT_ANCESTOR');
  if (!build.exists) errors.push('PRODUCTION_BUILD_MISSING');
  if (build.publicDirectory !== 'dist') errors.push('FIREBASE_HOSTING_PUBLIC_DIR_MUST_BE_DIST');
  for (const finding of build.forbiddenFindings || []) errors.push(`BUNDLE_FORBIDDEN:${finding}`);
  if ((build.productionProjectOccurrences || 0) === 0) errors.push('PRODUCTION_PROJECT_NOT_FOUND_IN_BUNDLE');
  if ((build.productionRuntimeMarkers || 0) === 0) errors.push('PRODUCTION_RUNTIME_MARKERS_NOT_FOUND_IN_BUNDLE');
  if ((build.stagingEndpointOccurrences || 0) > 0) errors.push('STAGING_ENDPOINT_FOUND_IN_BUNDLE');
  if ((build.stagingContractOccurrences || 0) > 0) warnings.push('STAGING_ID_PRESENT_ONLY_AS_DENYLIST_CONTRACT');
  warnings.push('BACKUP_NOT_REQUIRED_FOR_STATIC_HOSTING;REMAINS_HARD_BLOCKER_FOR_DATA_AUTH_RULES_INDEXES');
  warnings.push('SECOND_EXECUTOR_IS_OPERATIONAL_FOR_REVERSIBLE_STATIC_HOSTING');
  return { decision: errors.length ? 'NO-GO' : 'HOSTING DEPLOY GO', mode: 'HOSTING_ONLY_SAFE_DEPLOY', approvedCommand: errors.length ? null : `firebase deploy --only hosting --project ${PROD}`, errors, warnings };
}

const git = (args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
function scanBuild(directory) {
  const forbiddenFindings = [];
  let productionProjectOccurrences = 0;
  let stagingEndpointOccurrences = 0;
  let stagingContractOccurrences = 0;
  let productionRuntimeMarkers = 0;
  const patterns = [['PRIVATE_KEY', /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/i], ['SERVICE_ROLE', /service[_-]?role/i], ['SUPABASE_ENDPOINT', /https?:\/\/[^\s"']+\.supabase\.co/i]];
  const visit = (current) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) visit(full);
      else if (TEXT_EXTENSIONS.has(extname(entry.name))) {
        const content = readFileSync(full, 'utf8');
        productionProjectOccurrences += content.split(PROD).length - 1;
        stagingContractOccurrences += content.split(STAGING).length - 1;
        if (/VITE_FINANCE_ENV["']?:["']production["']/.test(content)
          && /VITE_FINANCE_USE_FIREBASE_EMULATORS["']?:["']false["']/.test(content)
          && /VITE_DATA_BACKEND["']?:["']firebase["']/.test(content)
          && /VITE_DATA_DUAL_WRITE["']?:["']false["']/.test(content)
          && /VITE_DATA_SHADOW_READ["']?:["']false["']/.test(content)) productionRuntimeMarkers += 1;
        stagingEndpointOccurrences += (content.match(new RegExp(`${STAGING}(?:\\.firebaseapp\\.com|\\.web\\.app)`, 'gi')) || []).length;
        for (const [label, pattern] of patterns) if (pattern.test(content)) forbiddenFindings.push(`${label}:${relative(directory, full)}`);
      }
    }
  };
  visit(directory);
  return { forbiddenFindings, productionProjectOccurrences, productionRuntimeMarkers, stagingEndpointOccurrences, stagingContractOccurrences };
}

export function runCli(args = process.argv.slice(2), env = process.env) {
  const rollbackCommit = flag(args, '--rollback-commit');
  let rollbackIsAncestor = false;
  try { execFileSync('git', ['merge-base', '--is-ancestor', rollbackCommit, 'HEAD']); rollbackIsAncestor = Boolean(rollbackCommit); } catch {}
  const buildDirectory = flag(args, '--build-dir') || 'dist';
  const firebase = JSON.parse(readFileSync('firebase.json', 'utf8'));
  const buildExists = existsSync(join(buildDirectory, 'index.html'));
  const result = evaluateHostingPreflight({ env, deployment: { project: flag(args, '--project'), only: flag(args, '--only') }, repository: { branch: git(['branch', '--show-current']), clean: git(['status', '--porcelain']) === '', head: git(['rev-parse', 'HEAD']), expectedCommit: flag(args, '--expected-commit'), ciStatus: flag(args, '--ci-status'), rollbackCommit, rollbackIsAncestor }, build: { exists: buildExists, publicDirectory: firebase.hosting?.public, ...(buildExists ? scanBuild(buildDirectory) : {}) } });
  console.log(JSON.stringify(result, null, 2));
  if (result.decision !== 'HOSTING DEPLOY GO') process.exitCode = 1;
  return result;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) runCli();
