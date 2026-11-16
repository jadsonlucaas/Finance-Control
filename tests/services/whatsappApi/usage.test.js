import { describe, expect, it } from 'vitest';
import { createApp } from '../../../services/whatsapp-api/src/app.js';
import { createMemoryStore } from '../../../services/whatsapp-api/src/memoryStore.js';
import { createPhoneResolver, parsePhoneLinks } from '../../../services/whatsapp-api/src/phoneLinks.js';
import { withReadCache } from '../../../services/whatsapp-api/src/readCache.js';
import { usageIncrement, withReadCounting } from '../../../services/whatsapp-api/src/usage.js';

// Etapa 5, item 3: consumo por cliente em users/{uid}/usage/{AAAA-MM}.

const API_KEY = 'test-key-123';
const PHONE = '+34 637 210 215';
const UID = 'user-a';
const NOW = new Date('2026-11-16T15:00:00Z');

function seed() {
  return {
    [UID]: [
      { id: 'r1', type: 'saida', description: 'Aluguel', amount: 2000, status: 'Pago', competence: '2026-11', due_date: '2026-11-05' },
      { id: 'r2', type: 'saida', description: 'Luz', amount: 300, status: 'Em aberto', competence: '2026-11', due_date: '2026-11-20' }
    ]
  };
}

function setup() {
  const base = createMemoryStore(seed());
  const store = withReadCache(withReadCounting(base), { ttlMs: 30_000, nowMs: () => 0 });
  const resolver = createPhoneResolver(parsePhoneLinks(JSON.stringify([{ telefone: PHONE, uid: UID, chatwootAccountId: '3' }])));
  const app = createApp({ store, resolver, apiKey: API_KEY, now: () => NOW, logger: { info() {}, warn() {}, error() {} } });
  const call = async (route, body = {}, telefone = PHONE) => {
    const response = await app.handle({ method: 'POST', path: `/internal/whatsapp/${route}`, headers: { 'x-api-key': API_KEY }, body: { telefone, accountId: 3, ...body } });
    await app.flushUsage();
    return response;
  };
  return { base, call };
}

describe('whatsapp-api: consumo por cliente', () => {
  it('conta mensagens, ferramentas, gravacoes e documentos lidos no mes do usuario', async () => {
    const { base, call } = setup();
    expect((await call('mensagem/registrar', { mensagemId: '101' })).status).toBe(200);
    expect((await call('mensagem/registrar', { mensagemId: '101' })).body.duplicada).toBe(true);
    await call('resumo', { competencia: '2026-11' });
    await call('resumo', { competencia: '2026-11' });
    await call('acoes/preparar', { acao: 'registrar_despesa', dados: { descricao: 'Pao', valor: 5 } });

    const usage = await base.getUsage(UID, '2026-11');
    expect(usage).toMatchObject({ uid: UID, month: '2026-11', messages: 1, tool_calls: 3, writes: 1 });
    expect(usage.by_route).toMatchObject({ resumo: 2, acoes_preparar: 1 });
    expect(usage.by_day['16']).toMatchObject({ messages: 1, tool_calls: 3 });
    // 2 lancamentos lidos uma vez; o segundo resumo veio do cache.
    expect(usage.records_read).toBeGreaterThanOrEqual(2);
    expect(usage.by_day['16'].records_read).toBe(usage.records_read);
    const asText = JSON.stringify(usage);
    expect(asText).not.toMatch(/637|Aluguel|2000/);
  });

  it('telefone sem vinculo nao gera consumo e falha ao gravar nao derruba a resposta', async () => {
    const { base, call } = setup();
    await call('mensagem/registrar', { mensagemId: '102' }, '+5511999999999');
    expect(await base.getUsage(UID, '2026-11')).toBeNull();

    base.incrementUsage = async () => { throw new Error('quota'); };
    const response = await call('resumo', { competencia: '2026-11' });
    expect(response.status).toBe(200);
  });

  it('monta o incremento com caminhos de campo seguros', () => {
    const { month, fields } = usageIncrement({ messages: 1, tool_calls: 2, writes: 0, records_read: 7, routes: { 'orcamento/definir': 1 } }, NOW);
    expect(month).toBe('2026-11');
    expect(fields).toEqual({
      messages: 1,
      tool_calls: 2,
      records_read: 7,
      'by_route.orcamento_definir': 1,
      'by_day.16.messages': 1,
      'by_day.16.tool_calls': 2,
      'by_day.16.records_read': 7
    });
  });
});
