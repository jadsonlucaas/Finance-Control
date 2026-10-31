const REDACTED = '[REDACTED]';
const OMITTED = '[OMITTED]';
const MAX_DEPTH = 5;
const MAX_KEYS = 40;
const MAX_STRING_LENGTH = 240;

const SENSITIVE_KEY = /(password|senha|passcode|token|authorization|credential|secret|api.?key|private.?key|session|cookie|phone|telefone|whatsapp|email|address|endereco|document|cpf|cnpj|person|pessoa|full.?name|display.?name|payload|raw|content|body|backup|restore|snapshot|import.?rows?|spreadsheet|workbook|file|filename|attachment)/i;
const FINANCIAL_KEY = /(amount|valor|value|balance|saldo|salary|salario|income|expense|entrada|saida|total|subtotal|price|preco|currency|centavos|tax|imposto|discount|desconto|financial|finance)/i;
const SAFE_NUMERIC_KEY = /(count|duration|elapsed|size|length|status.?code|attempt|index|page|limit|sample.?rate|timestamp|version|rows?.?(valid|invalid|ready|duplicate)|records?.?count)/i;

const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const BEARER_PATTERN = /\bBearer\s+[A-Za-z0-9._~+\/-]+=*/gi;
const JWT_PATTERN = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g;
const FIREBASE_KEY_PATTERN = /\bAIza[0-9A-Za-z_-]{30,}\b/g;
const PRIVATE_KEY_PATTERN = /-----BEGIN [^-]*PRIVATE KEY-----[\s\S]*?-----END [^-]*PRIVATE KEY-----/g;
const CARD_PATTERN = /\b(?:\d[ -]*?){13,19}\b/g;
const PHONE_PATTERN = /(?<!\w)(?:\+?\d{1,3}[ .-]?)?(?:\(?\d{2,3}\)?[ .-]?)?\d{4,5}[ .-]?\d{4}(?!\w)/g;
const CURRENCY_PATTERN = /(?:R\$|US\$|€|£)\s*-?\d[\d.,]*/gi;
const HOME_PATH_PATTERN = /(?:[A-Z]:\\Users\\|\/Users\/|\/home\/)[^\\/\s]+/gi;
const FINANCIAL_TEXT_PATTERN = /\b(amount|valor|saldo|salary|salario|total|price|preco|tax|imposto|desconto)\s*[:=]?\s*-?\d[\d.,]*/gi;
const STRUCTURAL_ARRAY_KEYS = /^(values|frames|breadcrumbs|spans)$/i;

function sanitizeString(value) {
  const sanitized = String(value)
    .replace(PRIVATE_KEY_PATTERN, REDACTED)
    .replace(BEARER_PATTERN, REDACTED)
    .replace(JWT_PATTERN, REDACTED)
    .replace(FIREBASE_KEY_PATTERN, REDACTED)
    .replace(EMAIL_PATTERN, REDACTED)
    .replace(CARD_PATTERN, REDACTED)
    .replace(PHONE_PATTERN, REDACTED)
    .replace(CURRENCY_PATTERN, REDACTED)
    .replace(HOME_PATH_PATTERN, (match) => `${match.slice(0, match.lastIndexOf(match.includes('\\') ? '\\' : '/') + 1)}${REDACTED}`)
    .replace(FINANCIAL_TEXT_PATTERN, '$1 [REDACTED]');
  return sanitized.length > MAX_STRING_LENGTH
    ? `${sanitized.slice(0, MAX_STRING_LENGTH)}…`
    : sanitized;
}

function sanitizeUrl(value) {
  try {
    const url = new URL(value, 'https://telemetry.invalid');
    return `${url.origin === 'https://telemetry.invalid' ? '' : url.origin}${url.pathname}` || '/';
  } catch {
    return sanitizeString(value).split(/[?#]/, 1)[0];
  }
}

function isSafeNumberKey(key) {
  return SAFE_NUMERIC_KEY.test(key) && !FINANCIAL_KEY.test(key);
}

export function sanitizeTelemetryValue(value, options = {}, state = { depth: 0, seen: new WeakSet(), key: '' }) {
  const key = String(options.key ?? state.key ?? '');
  if (SENSITIVE_KEY.test(key) || (FINANCIAL_KEY.test(key) && !isSafeNumberKey(key) && !STRUCTURAL_ARRAY_KEYS.test(key))) return REDACTED;
  if (value === null || value === undefined || typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : String(value);
  if (typeof value === 'bigint') return String(value);
  if (typeof value === 'string') return /(^|_)(url|uri|href)$/i.test(key) ? sanitizeUrl(value) : sanitizeString(value);
  if (typeof value === 'function' || typeof value === 'symbol') return OMITTED;
  if (state.depth >= (options.maxDepth || MAX_DEPTH)) return OMITTED;
  if (value instanceof Error) {
    return {
      name: sanitizeString(value.name || 'Error'),
      message: sanitizeString(value.message || 'Unexpected error'),
      ...(value.code ? { code: sanitizeString(value.code) } : {})
    };
  }
  if (typeof value !== 'object') return sanitizeString(value);
  if (state.seen.has(value)) return '[CIRCULAR]';
  state.seen.add(value);
  if (Array.isArray(value)) {
    if (STRUCTURAL_ARRAY_KEYS.test(key)) {
      return value.slice(0, 50).map((item) => sanitizeTelemetryValue(item, options, {
        depth: state.depth + 1,
        seen: state.seen,
        key: ''
      }));
    }
    return {
      item_count: value.length,
      items_omitted: true
    };
  }
  const entries = Object.entries(value).slice(0, options.maxKeys || MAX_KEYS);
  return Object.fromEntries(entries.map(([entryKey, entryValue]) => [
    entryKey,
    sanitizeTelemetryValue(entryValue, { ...options, key: entryKey }, {
      depth: state.depth + 1,
      seen: state.seen,
      key: entryKey
    })
  ]));
}

export function sanitizeTelemetryContext(context = {}) {
  return sanitizeTelemetryValue(context) || {};
}

export function sanitizeTelemetryMessage(message = '') {
  return sanitizeString(message);
}

export function sanitizeSentryEvent(event = {}) {
  return sanitizeTelemetryValue(event, { maxDepth: 8, maxKeys: 80 });
}

export function pseudonymizeUserId(value = '') {
  const input = String(value || '');
  if (!input) return '';
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `usr_${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

export const TELEMETRY_REDACTED_VALUE = REDACTED;
