import { createHash, timingSafeEqual } from 'node:crypto';

function digest(value) {
  return createHash('sha256').update(String(value)).digest();
}

export function extractApiKey(headers = {}) {
  const direct = headers['x-api-key'];
  if (direct) return String(direct);
  const authorization = String(headers.authorization || '');
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : '';
}

export function isAuthorized(headers, expectedKey) {
  if (!expectedKey) return false;
  const provided = extractApiKey(headers);
  if (!provided) return false;
  return timingSafeEqual(digest(provided), digest(expectedKey));
}
