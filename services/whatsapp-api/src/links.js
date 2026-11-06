import { createHash } from 'node:crypto';
import { ApiError, badRequest } from './errors.js';
import { hashPhone, normalizePhone } from './phoneLinks.js';

/**
 * Vinculo seguro conta <-> WhatsApp.
 *
 * O Dashboard (usuario autenticado e ativo) grava em whatsapp_link_codes/{sha256(codigo)}
 * um pedido com validade curta. O usuario envia o codigo pelo WhatsApp; o n8n repassa o
 * codigo junto com o telefone verificado do remetente (webhook assinado do Chatwoot).
 * Aqui o codigo e conferido e o vinculo whatsapp_links/{telefone} e gravado.
 */

// Sem 0/O, 1/I/L para evitar confusao ao digitar. Mesmo alfabeto do Dashboard.
export const LINK_CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
export const LINK_CODE_LENGTH = 8;
export const MAX_LINK_FAILURES = 5;
export const LINK_FAILURE_WINDOW_MS = 60 * 60 * 1000;

const CODE_PATTERN = new RegExp(`^[${LINK_CODE_ALPHABET}]{${LINK_CODE_LENGTH}}$`);

export function normalizeLinkCode(value) {
  const cleaned = String(value ?? '').toUpperCase().replace(/[\s-]/g, '');
  return CODE_PATTERN.test(cleaned) ? cleaned : '';
}

export function hashLinkCode(code) {
  return createHash('sha256').update(code).digest('hex');
}

export function toMillis(value) {
  if (!value) return NaN;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  return Date.parse(String(value));
}

function invalidCode() {
  return badRequest('LINK_CODE_INVALID', 'Codigo invalido ou expirado. Gere um novo codigo no app (Configuracoes > WhatsApp).');
}

export function createLinkService({ store, now = () => new Date() }) {
  async function failuresInWindow(phoneKey, current) {
    const attempts = await store.getLinkAttempts(phoneKey);
    if (!attempts) return 0;
    const start = toMillis(attempts.window_start);
    if (!Number.isFinite(start) || current.getTime() - start > LINK_FAILURE_WINDOW_MS) return 0;
    return Number(attempts.failures || 0);
  }

  async function registerFailure(phoneKey, current) {
    const failures = await failuresInWindow(phoneKey, current);
    await store.saveLinkAttempts(phoneKey, failures === 0
      ? { failures: 1, window_start: current.toISOString(), last_failure_at: current.toISOString() }
      : { failures: failures + 1, last_failure_at: current.toISOString() });
  }

  async function confirm(body = {}) {
    const phone = normalizePhone(body.telefone);
    if (!phone) throw badRequest('INVALID_PHONE', 'Telefone invalido.');
    const accountId = String(body.accountId ?? '').trim();
    if (!/^\d+$/.test(accountId)) throw badRequest('INVALID_ACCOUNT', 'Conta de atendimento invalida.');
    const current = now();
    const phoneKey = hashPhone(phone);

    if (await failuresInWindow(phoneKey, current) >= MAX_LINK_FAILURES) {
      throw new ApiError(429, 'LINK_TOO_MANY_ATTEMPTS', 'Muitas tentativas com codigo invalido. Tente de novo em 1 hora.');
    }

    const code = normalizeLinkCode(body.codigo);
    const codeId = code ? hashLinkCode(code) : '';
    const request = codeId ? await store.getLinkCode(codeId) : null;
    if (!request || request.status !== 'pending' || !(toMillis(request.expires_at) > current.getTime())) {
      await registerFailure(phoneKey, current);
      throw invalidCode();
    }

    const uid = String(request.owner_uid || '');
    const profile = uid ? await store.getUserProfile(uid) : null;
    if (!profile || profile.status !== 'active') {
      throw new ApiError(403, 'ACCOUNT_NOT_ACTIVE', 'A conta deste codigo nao esta ativa.');
    }

    const outcome = await store.completeLink({
      codeId,
      phone,
      uid,
      chatwootAccountId: accountId,
      nowIso: current.toISOString(),
      nowMs: current.getTime()
    });
    if (outcome === 'code_invalid') {
      await registerFailure(phoneKey, current);
      throw invalidCode();
    }
    if (outcome === 'phone_taken') {
      throw new ApiError(409, 'PHONE_LINKED_OTHER_ACCOUNT', 'Este WhatsApp ja esta vinculado a outra conta. Desvincule pelo app da outra conta antes.');
    }

    await store.clearLinkAttempts(phoneKey);
    try {
      await store.writeAudit(uid, {
        event_id: `whatsapp_link_${codeId.slice(0, 16)}`,
        event_type: 'whatsapp.link_created',
        actor_type: 'integration',
        actor_id: 'whatsapp-api',
        phone_hash: phoneKey,
        chatwoot_account_id: accountId,
        created_at: current.toISOString(),
        schema_version: 1
      });
    } catch {
      console.warn(JSON.stringify({ level: 'warn', event: 'audit_write_failed', action: 'whatsapp_link' }));
    }
    return { vinculado: true, ja_vinculado: outcome === 'already_linked', phoneHash: phoneKey };
  }

  return { confirm };
}
