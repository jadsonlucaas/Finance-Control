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
 * Resolve o usuario dono do telefone.
 * 1. Vinculo gravado pelo proprio usuario (whatsapp_links/{telefone}, status active), conferido a cada
 *    requisicao: revogar no Dashboard corta o acesso na hora. A conta precisa estar ativa.
 * 2. Reserva legada: WHATSAPP_PHONE_LINKS (configuracao manual do servidor), so durante a migracao.
 */
export function createPhoneResolver(links = new Map(), { store } = {}) {
  return {
    async resolve({ telefone, accountId } = {}) {
      const phone = normalizePhone(telefone);
      if (!phone) throw new ApiError(400, 'INVALID_PHONE', 'Telefone invalido.');
      const phoneHash = hashPhone(phone);

      const stored = store?.getActiveLinkByPhone ? await store.getActiveLinkByPhone(phone) : null;
      if (stored) {
        if (stored.chatwoot_account_id && String(accountId ?? '') !== String(stored.chatwoot_account_id)) {
          throw new ApiError(403, 'ACCOUNT_MISMATCH', 'Conta de atendimento nao corresponde ao vinculo.');
        }
        const profile = await store.getUserProfile(stored.uid);
        if (!profile || profile.status !== 'active') {
          throw new ApiError(403, 'ACCOUNT_NOT_ACTIVE', 'A conta vinculada nao esta ativa.');
        }
        return { uid: stored.uid, phoneHash, source: 'link' };
      }

      const link = links.get(phone);
      if (!link) throw new ApiError(403, 'PHONE_NOT_LINKED', 'Telefone nao vinculado a nenhum usuario.');
      if (link.chatwootAccountId && String(accountId ?? '') !== link.chatwootAccountId) {
        throw new ApiError(403, 'ACCOUNT_MISMATCH', 'Conta de atendimento nao corresponde ao vinculo.');
      }
      return { uid: link.uid, phoneHash, source: 'legacy' };
    }
  };
}
