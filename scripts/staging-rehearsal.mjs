import { execFileSync } from 'node:child_process';

function commandName(name) {
  return process.platform === 'win32' ? `${name}.cmd` : name;
}

function quoteWindowsArg(value) {
  const text = String(value);
  if (!/[\s&()^|<>"]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

function run(label, command, args = []) {
  console.log(`[staging-rehearsal] ${label}`);
  if (process.platform === 'win32' && command === process.execPath) {
    execFileSync(command, args, { stdio: 'inherit' });
    return;
  }
  const executable = process.platform === 'win32' ? 'cmd.exe' : command;
  const executableArgs = process.platform === 'win32'
    ? ['/d', '/c', [command, ...args].map(quoteWindowsArg).join(' ')]
    : args;
  execFileSync(executable, executableArgs, { stdio: 'inherit' });
}

function runCommandLine(label, commandLine) {
  console.log(`[staging-rehearsal] ${label}`);
  if (process.platform === 'win32') {
    execFileSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', commandLine], { stdio: 'inherit' });
    return;
  }
  execFileSync(commandLine, { stdio: 'inherit', shell: true });
}

run('build local release candidate', commandName('npm'), ['run', 'build']);
run('generate release manifest', process.execPath, ['scripts/generate-release-manifest.mjs']);
run('smoke local without deploy', commandName('npm'), ['run', 'smoke']);
runCommandLine(
  'release readiness smoke with Auth/Firestore Emulator',
  `${commandName('npx')} firebase emulators:exec --project demo-finance-control-local-e2e --only auth,firestore "${commandName('npx')} playwright test tests/playwright/release-readiness-smoke.spec.js --config=playwright.e2e-local.config.js --reporter=line"`
);

console.log(JSON.stringify({
  ok: true,
  mode: 'local-only',
  deployExecuted: false,
  firebaseRealTouched: false,
  project: 'demo-finance-control-local-e2e'
}, null, 2));
