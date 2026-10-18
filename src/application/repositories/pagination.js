export const DEFAULT_PAGE_LIMIT = 50;
export const MAX_PAGE_LIMIT = 200;

function base64UrlEncode(text = '') {
  if (typeof btoa === 'function') return btoa(text).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  if (typeof Buffer !== 'undefined') return Buffer.from(text, 'utf8').toString('base64url');
  return text;
}

function base64UrlDecode(text = '') {
  if (typeof atob === 'function') {
    const normalized = String(text).replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    return atob(padded);
  }
  if (typeof Buffer !== 'undefined') return Buffer.from(text, 'base64url').toString('utf8');
  return text;
}

export function encodePageCursor(payload = {}) {
  return base64UrlEncode(JSON.stringify({ v: 1, ...payload }));
}

export function decodePageCursor(cursor = '') {
  if (!cursor) return null;
  try {
    if (String(cursor).startsWith('offset:')) {
      return { v: 1, offset: Math.max(0, Number(String(cursor).slice(7)) || 0) };
    }
    const parsed = JSON.parse(base64UrlDecode(cursor));
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function encodeCursor(offset = 0) {
  return encodePageCursor({ offset: Math.max(0, Number(offset) || 0) });
}

function decodeCursor(cursor = '') {
  if (!cursor) return 0;
  const parsed = decodePageCursor(cursor);
  return Math.max(0, Number(parsed?.offset) || 0);
}

export function normalizePaginationQuery(query = {}) {
  const requestedLimit = query.limit === undefined ? DEFAULT_PAGE_LIMIT : Number(query.limit);
  const limit = Math.max(1, Math.min(Number.isFinite(requestedLimit) ? requestedLimit : DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT));
  const offset = query.cursor ? decodeCursor(query.cursor) : Math.max(0, Number(query.offset || 0));
  const orderBy = query.orderBy || 'created_at';
  const direction = String(query.direction || 'desc').toLowerCase() === 'asc' ? 'asc' : 'desc';
  return { limit, offset, orderBy, direction };
}

function compareValues(a, b, direction) {
  const av = a === undefined || a === null ? '' : a;
  const bv = b === undefined || b === null ? '' : b;
  const compared = String(av).localeCompare(String(bv), 'en', { numeric: true, sensitivity: 'base' });
  return direction === 'asc' ? compared : -compared;
}

export function sortForPagination(items = [], query = {}) {
  const { orderBy, direction } = normalizePaginationQuery(query);
  return [...items].sort((a, b) =>
    compareValues(a?.[orderBy], b?.[orderBy], direction) ||
    compareValues(a?.event_id || a?.id || '', b?.event_id || b?.id || '', direction)
  );
}

export function pageItems(items = [], query = {}) {
  const { limit, offset, orderBy, direction } = normalizePaginationQuery(query);
  const sorted = query.preserveOrder ? [...items] : sortForPagination(items, { ...query, orderBy, direction });
  const paged = sorted.slice(offset, offset + limit);
  const nextOffset = offset + paged.length;
  const hasMore = nextOffset < sorted.length;
  return {
    items: paged,
    count: paged.length,
    nextCursor: hasMore ? encodeCursor(nextOffset) : '',
    hasMore,
    totalKnown: sorted.length,
    pageInfo: {
      limit,
      orderBy,
      direction
    }
  };
}
