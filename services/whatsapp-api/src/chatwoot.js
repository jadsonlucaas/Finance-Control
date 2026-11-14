/**
 * Cliente minimo da API do Chatwoot, usado so para os direitos do titular:
 * - excluir conta: apaga os contatos com o telefone da pessoa (o Chatwoot apaga junto as conversas);
 * - exportar dados: le as conversas e mensagens desses contatos.
 *
 * Configuracao (opcional; sem ela as duas acoes pulam o Chatwoot e dizem isso no resultado):
 *   CHATWOOT_API_URL      ex.: https://eurochat.exemplo.com
 *   CHATWOOT_ACCOUNT_ID   ex.: 3
 *   CHATWOOT_API_TOKEN    token de acesso de um agente/admin (use CHATWOOT_API_TOKEN_FILE com secret)
 * O header vai como `api-access-token` (com hifen): proxies costumam descartar headers com "_".
 */
const MAX_CONVERSATIONS = 50;
const MAX_MESSAGES = 2000;

const digitsOf = (phone) => String(phone || '').replace(/\D/g, '');

export function createChatwootClient({ baseUrl = '', accountId = '', token = '', fetchImpl = globalThis.fetch } = {}) {
  const url = String(baseUrl || '').trim().replace(/\/+$/, '');
  const account = String(accountId || '').trim();
  if (!url || !/^\d+$/.test(account) || !token) return null;
  const api = `${url}/api/v1/accounts/${account}`;

  async function request(method, path) {
    const response = await fetchImpl(`${api}${path}`, { method, headers: { 'api-access-token': token, accept: 'application/json' } });
    if (response.status === 404) return null;
    if (!response.ok) {
      const error = new Error(`Chatwoot ${method} ${path.split('?')[0]}: ${response.status}`);
      error.chatwoot = { status: response.status };
      throw error;
    }
    return response.status === 204 ? {} : response.json().catch(() => ({}));
  }

  /** Contatos cujo telefone e exatamente um dos informados (a busca do Chatwoot e por trecho). */
  async function findContactsByPhones(phones = []) {
    const wanted = new Set(phones.map(digitsOf).filter((digits) => digits.length >= 8));
    const found = new Map();
    for (const digits of wanted) {
      const data = await request('GET', `/contacts/search?q=${encodeURIComponent(`+${digits}`)}`);
      for (const contact of data?.payload || []) {
        if (digitsOf(contact?.phone_number) === digits && contact?.id !== undefined) found.set(String(contact.id), contact);
      }
    }
    return [...found.values()];
  }

  async function deleteContactsByPhones(phones = []) {
    const contacts = await findContactsByPhones(phones);
    for (const contact of contacts) await request('DELETE', `/contacts/${encodeURIComponent(contact.id)}`);
    return contacts.length;
  }

  async function listMessages(conversationId, budget) {
    const out = [];
    let before = '';
    while (out.length < budget) {
      const data = await request('GET', `/conversations/${encodeURIComponent(conversationId)}/messages${before ? `?before=${encodeURIComponent(before)}` : ''}`);
      const page = Array.isArray(data?.payload) ? data.payload : [];
      if (!page.length) break;
      out.push(...page);
      const oldest = page.reduce((min, message) => (Number(message?.id) < Number(min) ? message.id : min), page[0].id);
      if (String(oldest) === String(before)) break;
      before = oldest;
    }
    return out.slice(0, budget);
  }

  /** Conversas e mensagens (texto, direcao, data) dos contatos com esses telefones. */
  async function exportByPhones(phones = []) {
    const contacts = await findContactsByPhones(phones);
    const conversations = [];
    let remaining = MAX_MESSAGES;
    for (const contact of contacts) {
      const data = await request('GET', `/contacts/${encodeURIComponent(contact.id)}/conversations`);
      for (const conversation of (data?.payload || []).slice(0, MAX_CONVERSATIONS)) {
        if (remaining <= 0) break;
        const messages = await listMessages(conversation.id, remaining);
        remaining -= messages.length;
        conversations.push({
          id: conversation.id,
          status: conversation.status || '',
          criada_em: toIso(conversation.created_at),
          mensagens: messages
            .filter((message) => message?.private !== true && [0, 1].includes(Number(message?.message_type)))
            .sort((a, b) => Number(a.created_at || 0) - Number(b.created_at || 0))
            .map((message) => ({
              de: Number(message.message_type) === 0 ? 'voce' : 'assistente',
              texto: String(message.content || ''),
              em: toIso(message.created_at)
            }))
        });
      }
    }
    return {
      contatos: contacts.map((contact) => ({ nome: contact.name || '', telefone: contact.phone_number || '', email: contact.email || '' })),
      conversas: conversations,
      limite_atingido: remaining <= 0
    };
  }

  return { findContactsByPhones, deleteContactsByPhones, exportByPhones };
}

function toIso(value) {
  if (value === undefined || value === null || value === '') return null;
  const ms = typeof value === 'number' ? value * 1000 : Date.parse(value);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}
