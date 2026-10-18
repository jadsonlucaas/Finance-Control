import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = process.cwd();
const OUT = path.join(ROOT, 'docs', 'release-candidate-manifest.json');

function commandName(name) {
  return process.platform === 'win32' ? `${name}.cmd` : name;
}

function run(command, args = []) {
  try {
    const executable = process.platform === 'win32' ? 'cmd.exe' : command;
    const executableArgs = process.platform === 'win32'
      ? ['/d', '/s', '/c', [command, ...args].join(' ')]
      : args;
    return execFileSync(executable, executableArgs, {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    }).trim();
  } catch {
    return null;
  }
}

export function sha256Text(value = '') {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function sha256File(relativePath) {
  const file = path.join(ROOT, relativePath);
  if (!existsSync(file)) return null;
  return crypto.createHash('sha256').update(readFileSync(file)).digest('hex');
}

function walkFiles(relativeDir) {
  const dir = path.join(ROOT, relativeDir);
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const rel = path.posix.join(relativeDir.replace(/\\/g, '/'), entry.name);
    const full = path.join(ROOT, rel);
    if (entry.isDirectory()) return walkFiles(rel);
    if (!entry.isFile()) return [];
    return [{ rel, bytes: statSync(full).size, hash: sha256File(rel) }];
  }).sort((a, b) => a.rel.localeCompare(b.rel));
}

function distSummary() {
  const files = walkFiles('dist');
  const html = existsSync(path.join(ROOT, 'dist', 'index.html'))
    ? readFileSync(path.join(ROOT, 'dist', 'index.html'), 'utf8')
    : '';
  const entryAsset = html.match(/<script[^>]+type="module"[^>]+src="\/?(assets\/app-[^"]+\.js)"/)?.[1] || '';
  const entry = files.find((file) => file.rel === `dist/${entryAsset}`)
    || files.find((file) => /dist\/assets\/app-[A-Za-z0-9_-]+\.js$/.test(file.rel) && !file.rel.includes('app-resilience-'));
  const firebaseChunk = files.find((file) => /dist\/assets\/services-firebase-.*\.js$/.test(file.rel));
  const largest = [...files].sort((a, b) => b.bytes - a.bytes)[0] || null;
  const directoryHash = sha256Text(files.map((file) => `${file.rel}:${file.bytes}:${file.hash}`).join('\n'));
  return { directoryHash, files, entry, firebaseChunk, largest };
}

function globalApiCount() {
  const file = path.join(ROOT, 'docs', 'global-api-inventory.md');
  if (!existsSync(file)) return null;
  return (readFileSync(file, 'utf8').match(/^\| `[^`]+` \|/gm) || []).length;
}

function legacyLoaderSummary() {
  const output = run(process.execPath, ['scripts/analyze-legacy-loader.mjs']);
  if (!output) return null;
  try {
    const parsed = JSON.parse(output);
    return {
      ok: parsed.ok,
      classicScripts: parsed.classicScripts,
      evalExecutedScripts: parsed.evalExecutedScripts,
      globals: parsed.globals,
      legacyBytesAfter: parsed.legacyBytesAfter
    };
  } catch {
    return null;
  }
}

function gitSummary() {
  const short = run('git', ['rev-parse', '--short', 'HEAD']);
  const full = run('git', ['rev-parse', 'HEAD']);
  const branch = run('git', ['branch', '--show-current']);
  const status = run('git', ['status', '--short']);
  return {
    branch,
    commitShort: short,
    commit: full,
    dirty: Boolean(status),
    statusShort: status ? status.split(/\r?\n/) : []
  };
}

function packageScript(name) {
  const pkg = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  return pkg.scripts?.[name] || null;
}

function versionOnly(output) {
  if (!output) return null;
  const versions = output.match(/\b\d+\.\d+\.\d+\b/g);
  return versions?.at(-1) || output.split(/\r?\n/).at(-1) || output;
}

export function assertNoLocalSecrets(value) {
  const source = typeof value === 'string' ? value : JSON.stringify(value);
  return !/([A-Z]:\\\\Users\\\\|[A-Z]:\\Users\\|\/Users\/|private_key|client_email|service_account|FIREBASE_TOKEN|GOOGLE_APPLICATION_CREDENTIALS)/i.test(source);
}

export function buildReleaseManifest({ generatedAt = new Date().toISOString() } = {}) {
  const dist = distSummary();
  const legacy = legacyLoaderSummary();
  const git = gitSummary();
  const manifest = {
    schemaVersion: 1,
    generatedAt,
    purpose: 'local-staging-release-candidate-manifest',
    constraints: {
      deployExecuted: false,
      firebaseRealTouched: false,
      adminSdkInClient: false,
      restoreRealEnabled: false,
      whatsappProviderEnabled: false,
      financialRulesChanged: false,
      firestoreRulesChangedByThisStep: false
    },
    repository: git,
    toolchain: {
      node: process.version,
      npm: versionOnly(run(commandName('npm'), ['--version'])),
      vite: versionOnly(run(commandName('npx'), ['vite', '--version'])),
      firebaseTools: versionOnly(run(commandName('npx'), ['firebase', '--version'])),
      playwright: versionOnly(run(commandName('npx'), ['playwright', '--version']))
    },
    firebase: {
      defaultProjectInFirebaserc: 'finance-control-cce4f',
      requiredStagingProject: 'finance-control-staging-260919',
      stagingProjectNumber: '945561850688',
      stagingWebAppId: '1:945561850688:web:8a00895f04d01d5aa860a5',
      stagingHostingUrl: 'https://finance-control-staging-260919.web.app',
      stagingValidationStatus: 'not_validated',
      dataClassification: 'synthetic-only-pending',
      emulatorProjectForRehearsal: 'demo-finance-control-local-e2e',
      rulesFile: {
        path: 'firestore.rules',
        sha256: sha256File('firestore.rules')
      },
      indexesFile: {
        path: 'firestore.indexes.json',
        sha256: sha256File('firestore.indexes.json'),
        compositeIndexCount: JSON.parse(readFileSync(path.join(ROOT, 'firestore.indexes.json'), 'utf8')).indexes?.length || 0
      }
    },
    packageLock: {
      path: 'package-lock.json',
      sha256: sha256File('package-lock.json')
    },
    scripts: {
      build: packageScript('build'),
      smoke: packageScript('smoke'),
      test: packageScript('test'),
      rules: packageScript('test:rules'),
      authFlow: packageScript('test:auth-flow')
    },
    budgets: {
      entryChunkBytes: 430080,
      globalsMax: 50,
      classicScriptsMax: 23,
      evalExecutedScriptsMax: 23
    },
    inventory: {
      globalApiCount: globalApiCount(),
      legacyLoader: legacy
    },
    dist,
    testTotalsKnown: {
      vitestFiles: 112,
      vitestTests: 661,
      source: 'docs/release-readiness-checkpoint.md'
    }
  };
  if (!assertNoLocalSecrets(manifest)) {
    throw new Error('RELEASE_MANIFEST_CONTAINS_LOCAL_SECRET_OR_PATH');
  }
  return manifest;
}

export function writeReleaseManifest(file = OUT) {
  const manifest = buildReleaseManifest();
  writeFileSync(file, `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const manifest = writeReleaseManifest();
  console.log(JSON.stringify({
    ok: true,
    output: path.relative(ROOT, OUT).replace(/\\/g, '/'),
    commit: manifest.repository.commitShort,
    distHash: manifest.dist.directoryHash,
    entryBytes: manifest.dist.entry?.bytes || 0,
    globalApiCount: manifest.inventory.globalApiCount
  }, null, 2));
}
