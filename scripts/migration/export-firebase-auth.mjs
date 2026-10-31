import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { firebaseCliApplicationDefaultPath } from './firebase-admin-credential.mjs';

const PROJECT_ID = 'finance-control-cce4f';
const arg = (name) => { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : ''; };
const inside = (child, parent) => { const value = relative(resolve(parent), resolve(child)); return value === '' || (!value.startsWith('..') && !isAbsolute(value)); };
if (!process.argv.includes('--allow-sensitive-auth-export')) throw new Error('SENSITIVE_AUTH_EXPORT_ACK_REQUIRED');
if (arg('--project') !== PROJECT_ID) throw new Error('AUTH_EXPORT_PROJECT_MISMATCH');
const output = resolve(arg('--output') || '');
if (!arg('--output') || inside(output, process.cwd())) throw new Error('AUTH_EXPORT_OUTPUT_MUST_BE_OUTSIDE_REPOSITORY');

process.env.GOOGLE_APPLICATION_CREDENTIALS ||= await firebaseCliApplicationDefaultPath();
const app = getApps()[0] || initializeApp({ projectId: PROJECT_ID, credential: applicationDefault() }, 'production-auth-read-only-export');
const auth = getAuth(app);
const users = [];
let pageToken;
do {
  const page = await auth.listUsers(1000, pageToken);
  for (const user of page.users) users.push({
    uid: user.uid,
    email: user.email || null,
    emailVerified: user.emailVerified,
    disabled: user.disabled,
    metadata: user.metadata.toJSON(),
    providerData: user.providerData.map((provider) => provider.toJSON()),
    customClaims: user.customClaims || {},
    passwordHash: user.passwordHash ? Buffer.from(user.passwordHash).toString('base64') : null,
    passwordSalt: user.passwordSalt ? Buffer.from(user.passwordSalt).toString('base64') : null
  });
  pageToken = page.pageToken;
} while (pageToken);
users.sort((a, b) => a.uid.localeCompare(b.uid));
await mkdir(dirname(output), { recursive: true });
const content = JSON.stringify({ project_id: PROJECT_ID, exported_at: new Date().toISOString(), users }, null, 2);
await writeFile(output, content, { flag: 'wx', mode: 0o600 });
const providers = {};
for (const user of users) for (const provider of user.providerData) providers[provider.providerId] = (providers[provider.providerId] || 0) + 1;
console.log(JSON.stringify({ total_users: users.length, enabled: users.filter((u) => !u.disabled).length, disabled: users.filter((u) => u.disabled).length, providers, with_admin_claim: users.filter((u) => u.customClaims?.admin === true).length, without_admin_claim: users.filter((u) => u.customClaims?.admin !== true).length, sha256: createHash('sha256').update(content).digest('hex'), sensitive_values_logged: false }));
