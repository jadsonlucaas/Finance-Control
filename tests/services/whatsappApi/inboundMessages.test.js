import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../../../services/whatsapp-api/src/app.js';
import { createMemoryStore } from '../../../services/whatsapp-api/src/memoryStore.js';
import { createPhoneResolver, parsePhoneLinks } from '../../../services/whatsapp-api/src/phoneLinks.js';
import { inboundMessageKey, INBOUND_MESSAGE_TTL_MS } from '../../../services/whatsapp-api/src/inboundMessages.js';

const API_KEY = 'test-key-123';
const NOW = new Date('2026-11-09T15:00:00Z');

function setup() {
  const store = createMemoryStore({});
  const app = createApp({ store, resolver: createPhoneResolver(parsePhoneLinks('[]')), apiKey: API_KEY, now: () => NOW, logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() } });
  const register = (body) => app.handle({
    method: 'POST',
    path: '/internal/whatsapp/mensagem/registrar',
    headers: { 'x-api-key': API_KEY },
    body: { telefone: '+34637210215', accountId: 3, ...body }
  });
  return { store, register };
}

describe('whatsapp-api: deduplicacao de mensagens', () => {
  it('a primeira entrega segue; a repetida volta como duplicada', async () => {
    const { register } = setup();
    expect((await register({ mensagemId: 4711 })).body).toEqual({ duplicada: false });
    expect((await register({ mensagemId: 4711 })).body).toEqual({ duplicada: true });
    expect((await register({ mensagemId: 4712 })).body).toEqual({ duplicada: false });
  });

  it('mesmo id em outra conta do Chatwoot nao colide', async () => {
    const { register } = setup();
    await register({ mensagemId: 10 });
    expect((await register({ mensagemId: 10, accountId: 4 })).body.duplicada).toBe(false);
  });

  it('nao funciona sem chave de API e valida os campos', async () => {
    const { register } = setup();
    expect((await register({ mensagemId: '' })).body.erro.codigo).toBe('INVALID_MESSAGE_ID');
    expect((await register({ mensagemId: 'a b' })).body.erro.codigo).toBe('INVALID_MESSAGE_ID');
    expect((await register({ mensagemId: 1, telefone: 'x' })).body.erro.codigo).toBe('INVALID_PHONE');
    expect((await register({ mensagemId: 1, accountId: 'abc' })).body.erro.codigo).toBe('INVALID_ACCOUNT');
  });

  it('guarda so hashes e a validade, nunca o texto da mensagem', async () => {
    const { store, register } = setup();
    await register({ mensagemId: 99, conteudo: 'gastei 50 no mercado' });
    const saved = store._getInboundMessage(inboundMessageKey('3', '99'));
    expect(JSON.stringify(saved)).not.toContain('mercado');
    expect(JSON.stringify(saved)).not.toContain('637210215');
    expect(new Date(saved.expires_at).getTime()).toBe(NOW.getTime() + INBOUND_MESSAGE_TTL_MS);
  });
});
