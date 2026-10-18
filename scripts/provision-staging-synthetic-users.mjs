import { randomBytes } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { assertStagingTarget } from './assert-staging-target.mjs';

const projectId = process.env.STAGING_FIREBASE_PROJECT_ID;
const apiKey = process.env.STAGING_FIREBASE_API_KEY;
const productionProjectId = 'finance-control-cce4f';
const outputFile = process.env.STAGING_CREDENTIALS_FILE || '.env.staging.local';

assertStagingTarget(projectId);
if (!apiKey) throw new Error('STAGING_FIREBASE_API_KEY_REQUIRED');
if (projectId === productionProjectId) throw new Error('PRODUCTION_TARGET_DENIED');

const firebaseConfigPath = `${process.env.USERPROFILE}\\.config\\configstore\\firebase-tools.json`;
const firebaseConfig = JSON.parse(await readFile(firebaseConfigPath, 'utf8'));
const operatorToken = firebaseConfig?.tokens?.access_token;
if (!operatorToken) throw new Error('FIREBASE_CLI_ACCESS_TOKEN_REQUIRED');

const runId = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
const password = `Stg!${randomBytes(18).toString('base64url')}9a`;
const definitions = [
  ['A', 'user.a', 'active'],
  ['B', 'user.b', 'active'],
  ['PENDING', 'pending', 'pending'],
  ['INACTIVE', 'inactive', 'inactive']
];
const accounts = {};

for (const [label, prefix, status] of definitions) {
  const email = `${prefix}.staging.${runId}@example.test`;
  const signupResponse = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true })
  });
  const signup = await signupResponse.json();
  if (!signupResponse.ok) throw new Error(`SIGNUP_FAILED:${label}:${signup?.error?.message || signupResponse.status}`);

  const now = new Date().toISOString();
  const profileResponse = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users?documentId=${encodeURIComponent(signup.localId)}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${signup.idToken}` },
    body: JSON.stringify({ fields: {
      uid: { stringValue: signup.localId }, email: { stringValue: email }, role: { stringValue: 'user' },
      status: { stringValue: 'pending' }, created_at: { stringValue: now }, updated_at: { stringValue: now },
      last_login_at: { stringValue: now }
    } })
  });
  if (!profileResponse.ok) throw new Error(`PROFILE_CREATE_FAILED:${label}:${profileResponse.status}`);

  if (status !== 'pending') {
    const statusResponse = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${encodeURIComponent(signup.localId)}?updateMask.fieldPaths=status&updateMask.fieldPaths=updated_at`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${operatorToken}` },
      body: JSON.stringify({ fields: { status: { stringValue: status }, updated_at: { stringValue: now } } })
    });
    if (!statusResponse.ok) throw new Error(`STATUS_UPDATE_FAILED:${label}:${statusResponse.status}`);
  }
  accounts[label] = { email, password, uid: signup.localId, idToken: signup.idToken, status };
}

const a = accounts.A;
const referenceRecords = [
  ['reference-person-staging', { type: 'pessoa', person: 'Pessoa Sintetica A', salary_base: 5000, receiving_type: 'mensal' }],
  ['reference-macro-staging', { type: 'macro', macro_category: 'STAGING FIXO', shared_scope: 'personal' }],
  ['reference-category-staging', { type: 'categoria', macro_category: 'STAGING FIXO', category_name: 'Moradia Staging', category_color: '#38bdf8', category_icon: 'home', shared_scope: 'personal' }]
];
for (const [id, record] of referenceRecords) {
  const fields = Object.fromEntries(Object.entries({ ...record, owner_uid: a.uid, owner_email: a.email, created_at: new Date().toISOString() }).map(([key, value]) => [key, typeof value === 'number' ? { doubleValue: value } : { stringValue: value }]));
  const response = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${a.uid}/finance_records?documentId=${id}`, {
    method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${a.idToken}` }, body: JSON.stringify({ fields })
  });
  if (!response.ok) throw new Error(`REFERENCE_CREATE_FAILED:${id}:${response.status}`);
}

const lines = [
  `STAGING_BASE_URL=https://${projectId}.web.app`,
  `STAGING_FIREBASE_PROJECT_ID=${projectId}`,
  ...Object.entries(accounts).flatMap(([label, account]) => [
    `STAGING_${label}_EMAIL=${account.email}`,
    `STAGING_${label}_PASSWORD=${account.password}`,
    `STAGING_${label}_UID=${account.uid}`
  ])
];
await writeFile(outputFile, `${lines.join('\n')}\n`, { mode: 0o600 });
console.log(JSON.stringify({ ok: true, projectId, productionTouched: false, outputFile, accounts: Object.fromEntries(Object.entries(accounts).map(([label, account]) => [label, { email: account.email, uid: account.uid, status: account.status }])) }, null, 2));
