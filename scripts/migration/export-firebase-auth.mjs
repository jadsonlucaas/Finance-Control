import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const PROJECT_ID = 'finance-control-cce4f';
const outputIndex = process.argv.indexOf('--output');
const projectIndex = process.argv.indexOf('--project');
const output = outputIndex >= 0 ? resolve(process.argv[outputIndex + 1]) : '';
if (!process.argv.includes('--allow-sensitive-auth-export')) throw new Error('SENSITIVE_AUTH_EXPORT_ACK_REQUIRED');
if (projectIndex < 0 || process.argv[projectIndex + 1] !== PROJECT_ID) throw new Error('AUTH_EXPORT_PROJECT_MISMATCH');
if (!output || output.startsWith(resolve('.'))) throw new Error('AUTH_EXPORT_OUTPUT_MUST_BE_OUTSIDE_REPOSITORY');
if (!process.env.GOOGLE_OAUTH_ACCESS_TOKEN) throw new Error('GOOGLE_OAUTH_ACCESS_TOKEN_REQUIRED');

const users = [];
let nextPageToken = '';
do {
  const url = new URL(`https://identitytoolkit.googleapis.com/v1/projects/${PROJECT_ID}/accounts:batchGet`);
  url.searchParams.set('maxResults', '1000');
  if (nextPageToken) url.searchParams.set('nextPageToken', nextPageToken);
  const response = await fetch(url, { headers: { authorization: `Bearer ${process.env.GOOGLE_OAUTH_ACCESS_TOKEN}` } });
  if (!response.ok) throw new Error(`AUTH_EXPORT_HTTP_${response.status}`);
  const page = await response.json();
  users.push(...(page.users || []));
  nextPageToken = page.nextPageToken || '';
} while (nextPageToken);

await writeFile(output, JSON.stringify({ project_id: PROJECT_ID, exported_at: new Date().toISOString(), users }, null, 2), { flag: 'wx', mode: 0o600 });
console.log(JSON.stringify({ users: users.length, sensitive: true, outputLogged: false }));
