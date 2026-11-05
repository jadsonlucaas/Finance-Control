import { createHash } from 'node:crypto';
import { ApiError } from './errors.js';

export function normalizePhone(value) {
  const digits = String(value ?? '').replace(/\D/g, '');
  if (digits.length < 8 || digits.length > 15) return '';
  return `+${digits}`;
}

// Identificador estavel para logs: nunca registrar o telefone em claro.
export function hashPhone(phone) {
  return createHash('sha256').update(normalizePhone(phone)).digest('hex').slice(0, 12);
}

/**
 * Aceita dois formatos em WHATSAPP_PHONE_LINKS:
 * - objeto: {"+5511999999999": "firebaseUid"}
 * - lista:  [{"telefone": "+55...", "uid": "...", "chatwootAccountId": "3"}]
 */
export function parsePhoneLinks(raw) {
  const links = new Map();
  if (!raw || !String(raw).trim()) return links;

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('WHATSAPP_PHONE_LINKS deve ser JSON valido.');
  }

  const entries = Array.isArray(parsed)
    ? parsed
    : Object.entries(parsed || {}).map(([telefone, uid]) => ({ telefone, uid }));

  entries.forEach((entry, index) => {
    const phone = normalizePhone(entry?.telefone ?? entry?.phone);
    const uid = String(entry?.uid ?? '').trim();
    if (!phone || !uid) {
      throw new Error(`WHATSAPP_PHONE_LINKS: item ${index} sem telefone ou uid validos.`);
    }
    if (links.has(phone)) {
      throw new Error(`WHATSAPP_PHONE_LINKS: telefone duplicado no item ${index}.`);
    }
    const accountId = entry?.chatwootAccountId ?? entry?.accountId;
    links.set(phone, {
      uid,
      chatwootAccountId: accountId === undefined || accountId === null || accountId === '' ? '' : String(accountId)
    });
  });

  return links;
}

/**
 * Resolve o usuario dono do telefone. A fase de teste usa a configuracao do servidor;
 * no futuro, o cadastro do usuario passa a ser a fonte (mesma interface).
 */
export function createPhoneResolver(links) {
  return {
    async resolve({ telefone, accountId } = {}) {
      const phone = normalizePhone(telefone);
      if (!phone) throw new ApiError(400, 'INVALID_PHONE', 'Telefone invalido.');
      const link = links.get(phone);
      if (!link) throw new ApiError(403, 'PHONE_NOT_LINKED', 'Telefone nao vinculado a nenhum usuario.');
      if (link.chatwootAccountId && String(accountId ?? '') !== link.chatwootAccountId) {
        throw new ApiError(403, 'ACCOUNT_MISMATCH', 'Conta de atendimento nao corresponde ao vinculo.');
      }
      return { uid: link.uid, phoneHash: hashPhone(phone) };
    }
  };
}
