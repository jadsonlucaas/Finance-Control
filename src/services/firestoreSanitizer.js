import { normalizeFinanceRecord } from '../domain/normalizers/financeRecordNormalizer.js';

function sanitizeValue(value) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (Array.isArray(value)) {
    return value
      .map((item) => sanitizeValue(item))
      .filter((item) => item !== undefined);
  }
  if (value instanceof Date) return value;
  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .map(([key, item]) => [key, sanitizeValue(item)])
        .filter(([, item]) => item !== undefined)
    );
  }
  return value;
}

export function sanitizeFirestoreRecord(record = {}) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    throw new Error('Registro invalido para persistencia.');
  }
  return normalizeFinanceRecord(sanitizeValue(record));
}
