import { readFileSync } from 'node:fs';
import { decodePageCursor, encodePageCursor, MAX_PAGE_LIMIT } from '../src/application/repositories/pagination.js';

function read(path) {
  return readFileSync(path, 'utf8');
}

const service = read('src/services/userAdmin.js');
const repository = read('src/application/repositories/firebaseRepositories.js');
const indexes = JSON.parse(read('firestore.indexes.json'));

function hasIndex(fields) {
  return indexes.indexes.some((index) =>
    index.collectionGroup === 'users'
    && fields.every((field, position) => index.fields[position]?.fieldPath === field)
  );
}

const listUsersBody = service.match(/async function listUsers\(input\) \{([\s\S]*?)\n  \}/)?.[1] || '';
const repositoryListBody = repository.match(/async listUsers\(query = \{\}, adminContext = \{\}\) \{([\s\S]*?)\n  async updateStatus/)?.[1] || '';
const cursor = encodePageCursor({ kind: 'firestore', collection: 'users', values: ['user-0049@example.test', 'user-0049'] });
const decoded = decodePageCursor(cursor);

const checks = [
  { name: 'service_modern_query_uses_limit_plus_one', ok: /firestoreLimit\(queryInput\.limit \+ 1\)/.test(service) },
  { name: 'service_status_filter_uses_where', ok: /where\('status', '==', queryInput\.status\)/.test(service) },
  { name: 'service_role_filter_uses_where', ok: /where\('role', '==', queryInput\.role\)/.test(service) },
  { name: 'service_does_not_use_search_as_firestore_filter', ok: !/where\(['"](?:name|email|search)/.test(service) && !/queryInput\.search/.test(service) },
  { name: 'repository_uses_limit_plus_one', ok: /limit\(page\.limit \+ 1\)/.test(repositoryListBody) },
  { name: 'repository_status_role_uses_where', ok: /where\('status'/.test(repositoryListBody) && /where\('role'/.test(repositoryListBody) },
  { name: 'indexes_status_email_declared', ok: hasIndex(['status', 'email']) },
  { name: 'indexes_role_email_declared', ok: hasIndex(['role', 'email']) },
  { name: 'indexes_status_role_email_declared', ok: hasIndex(['status', 'role', 'email']) },
  { name: 'cursor_is_base64url_opaque', ok: cursor && !cursor.includes('user-0049') && decoded?.kind === 'firestore' },
  { name: 'max_page_size_contract', ok: MAX_PAGE_LIMIT === 200 },
  { name: 'legacy_list_without_args_is_explicit', ok: /if \(!input \|\| Object\.keys\(input\)\.length === 0\)/.test(listUsersBody) }
];

const failedChecks = checks.filter((check) => !check.ok);
const result = {
  ok: failedChecks.length === 0,
  wrote: false,
  checks,
  failedChecks,
  supportedServerSideFilters: ['status', 'role', 'status+role'],
  unsupportedGlobalTextSearch: ['name', 'email substring'],
  cursorShape: 'base64url JSON payload, opaque to callers',
  pageSize: { default: 50, max: MAX_PAGE_LIMIT }
};

console.log(JSON.stringify(result, null, 2));
if (!result.ok) process.exit(1);

