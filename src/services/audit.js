import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { buildAuditEvent as buildCanonicalAuditEvent } from '../application/audit/auditEvents.js';
export { classifyFinanceRecordAuditAction, summarizeFinanceRecord } from '../domain/audit/financeRecordAudit.js';

const MAX_DETAIL_STRING_LENGTH = 300;
const BLOCKED_DETAIL_KEYS = Object.freeze([
  'password',
  'token',
  'accesstoken',
  'refreshtoken',
  'credential',
  'secret',
  'phone',
  'telefone',
  'raw_message',
  'raw_file',
  'file_bytes',
  'authorization',
  'cookies',
  'serviceaccount',
  'privatekey'
]);

function truncate(value) {
  const text = String(value ?? '');
  return text.length > MAX_DETAIL_STRING_LENGTH
    ? `${text.slice(0, MAX_DETAIL_STRING_LENGTH)}...`
    : text;
}

function sanitizeDetails(value, depth = 0) {
  if (depth > 3) return '[truncated]';
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return truncate(value);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.slice(0, 25).map((item) => sanitizeDetails(item, depth + 1));
  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !BLOCKED_DETAIL_KEYS.includes(String(key || '').replace(/[^a-zA-Z0-9_]/g, '').toLowerCase()))
        .map(([key, item]) => [key, sanitizeDetails(item, depth + 1)])
    );
  }
  return truncate(value);
}

export function buildAuditLogEntry(action, details = {}, context = {}) {
  if (details?.event_type || details?.event_id) {
    const built = buildCanonicalAuditEvent({
      ...details,
      action: details.action || action,
      context: {
        actorUid: context.uid || context.actorUid || details.actor_uid || '',
        actorType: context.actorType || details.actor_type || 'user',
        role: context.role || details.actor_role || '',
        ownerUid: context.ownerUid || context.uid || details.owner_uid || '',
        sourceChannel: context.sourceChannel || details.source_channel || details.source || 'web',
        correlationId: context.correlationId || details.correlation_id || ''
      }
    }, {
      now: () => details.occurred_at || details.created_at || new Date().toISOString(),
      idGenerator: () => details.event_id || details.id || `audit_${Date.now()}`
    });
    return built.event;
  }
  const user = context.user || null;
  const now = context.now instanceof Date ? context.now.toISOString() : new Date().toISOString();
  return {
    action: String(action || 'unknown'),
    actor_uid: context.uid || user?.uid || '',
    actor_email: context.email || user?.email || '',
    created_at: now,
    status: context.status || 'success',
    source: context.source || 'web',
    details: sanitizeDetails(details)
  };
}

export function createAuditService({ auth, db, target = globalThis } = {}) {
  async function log(action, details = {}, context = {}) {
    const user = context.user || auth?.currentUser || null;
    const uid = context.uid || user?.uid || '';
    if (!uid || !db) return { isOk: false, error: 'AUDIT_AUTH_REQUIRED' };

    const entry = buildAuditLogEntry(action, details, {
      ...context,
      user,
      uid,
      email: context.email || user?.email || ''
    });

    try {
      const docRef = await addDoc(collection(db, 'users', uid, 'audit_logs'), {
        ...entry,
        created_server_at: serverTimestamp()
      });
      return { isOk: true, id: docRef.id };
    } catch (error) {
      target?.console?.warn?.('Falha ao registrar auditoria', error);
      return { isOk: false, error: error.message };
    }
  }

  function logLater(action, details = {}, context = {}) {
    log(action, details, context).catch((error) => {
      target?.console?.warn?.('Falha inesperada na auditoria', error);
    });
  }

  return {
    log,
    logLater
  };
}

export function installAuditGlobals(target = globalThis, auditService = null) {
  if (auditService) target.auditSdk = auditService;
  target.auditAction = (action, details = {}, context = {}) =>
    target.auditSdk?.logLater?.(action, details, context);
  return target.auditSdk || null;
}
