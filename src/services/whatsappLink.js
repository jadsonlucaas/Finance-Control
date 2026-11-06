import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where
} from 'firebase/firestore';

/**
 * Vinculo conta <-> WhatsApp pelo Dashboard.
 *
 * - Gera um codigo aleatorio de 8 caracteres e grava apenas o hash SHA-256 dele em
 *   whatsapp_link_codes/{hash}, ligado ao usuario autenticado, com validade de 10 minutos.
 * - O usuario envia o codigo pelo WhatsApp; a whatsapp-api confere e grava whatsapp_links/{telefone}.
 * - O usuario consulta e revoga os proprios vinculos. As regras do Firestore garantem o isolamento.
 */

// Mesmo alfabeto da whatsapp-api: sem 0/O e 1/I/L para evitar erro de digitacao.
export const LINK_CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
export const LINK_CODE_LENGTH = 8;
export const LINK_CODE_TTL_MS = 10 * 60 * 1000;
const CODES = 'whatsapp_link_codes';
const LINKS = 'whatsapp_links';

function defaultRandomBytes(size) {
  return globalThis.crypto.getRandomValues(new Uint8Array(size));
}

/** Sorteio sem vies de modulo (descarta bytes acima do maior multiplo do alfabeto). */
export function generateLinkCode(randomBytes = defaultRandomBytes) {
  const size = LINK_CODE_ALPHABET.length;
  const limit = 256 - (256 % size);
  let code = '';
  while (code.length < LINK_CODE_LENGTH) {
    const bytes = randomBytes(LINK_CODE_LENGTH * 2);
    for (const byte of bytes) {
      if (byte < limit && code.length < LINK_CODE_LENGTH) code += LINK_CODE_ALPHABET[byte % size];
    }
  }
  return code;
}

export function formatLinkCode(code) {
  const value = String(code || '');
  return value.length === LINK_CODE_LENGTH ? `${value.slice(0, 4)}-${value.slice(4)}` : value;
}

export async function hashLinkCode(code, subtle = globalThis.crypto?.subtle) {
  if (!subtle) throw new Error('WHATSAPP_LINK_CRYPTO_UNAVAILABLE');
  const digest = await subtle.digest('SHA-256', new TextEncoder().encode(code));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** "+34637210215" -> "+34 ••• ••• 215" (o numero completo nao aparece na tela). */
export function maskPhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length < 6) return '';
  return `+${digits.slice(0, 2)} ••• ••• ${digits.slice(-3)}`;
}

function toDate(value) {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function createWhatsAppLinkService(db, {
  now = () => Date.now(),
  randomBytes = defaultRandomBytes,
  subtle = globalThis.crypto?.subtle
} = {}) {
  async function listActiveLinks(uid) {
    const snapshot = await getDocs(query(collection(db, LINKS), where('uid', '==', uid), where('status', '==', 'active')));
    return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
  }

  async function deletePendingCodes(uid) {
    const snapshot = await getDocs(query(collection(db, CODES), where('owner_uid', '==', uid), where('status', '==', 'pending')));
    await Promise.all(snapshot.docs.map((item) => deleteDoc(item.ref)));
  }

  return {
    async getStatus(uid) {
      if (!uid) throw new Error('WHATSAPP_LINK_UID_REQUIRED');
      const [link] = await listActiveLinks(uid);
      if (!link) return { linked: false };
      return {
        linked: true,
        phoneId: link.id,
        maskedPhone: maskPhone(link.telefone || link.id),
        linkedAt: toDate(link.linked_at)
      };
    },

    /** Cria um codigo novo e descarta os pendentes anteriores do mesmo usuario. */
    async createCode(uid) {
      if (!uid) throw new Error('WHATSAPP_LINK_UID_REQUIRED');
      await deletePendingCodes(uid);
      const code = generateLinkCode(randomBytes);
      const codeId = await hashLinkCode(code, subtle);
      const expiresAt = new Date(now() + LINK_CODE_TTL_MS);
      await setDoc(doc(db, CODES, codeId), {
        owner_uid: uid,
        status: 'pending',
        created_at: serverTimestamp(),
        expires_at: Timestamp.fromDate(expiresAt)
      });
      return { code, formatted: formatLinkCode(code), expiresAt };
    },

    async cancelCode(uid) {
      if (!uid) return;
      await deletePendingCodes(uid);
    },

    /** Revoga todos os vinculos ativos do usuario; a whatsapp-api deixa de atender na proxima mensagem. */
    async revoke(uid) {
      if (!uid) throw new Error('WHATSAPP_LINK_UID_REQUIRED');
      const links = await listActiveLinks(uid);
      await Promise.all(links.map((link) => updateDoc(doc(db, LINKS, link.id), {
        status: 'revoked',
        revoked_at: serverTimestamp(),
        revoked_by: 'user'
      })));
      return { revoked: links.length };
    }
  };
}
