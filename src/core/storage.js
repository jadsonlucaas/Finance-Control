import { FINANCE_STORAGE_PREFIX } from './constants.js';

export function isFinanceStorageKey(key) {
  return typeof key === 'string' && key.startsWith(FINANCE_STORAGE_PREFIX);
}

export function readJsonStorage(storage, key, fallback) {
  try {
    const raw = storage?.getItem?.(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export function writeJsonStorage(storage, key, value) {
  storage?.setItem?.(key, JSON.stringify(value));
}
