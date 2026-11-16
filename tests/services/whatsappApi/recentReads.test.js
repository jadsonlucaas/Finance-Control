import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../../../services/whatsapp-api/src/app.js';
import { createMemoryStore } from '../../../services/whatsapp-api/src/memoryStore.js';
import { createPhoneResolver, parsePhoneLinks } from '../../../services/whatsapp-api/src/phoneLinks.js';
import { withReadCache } from '../../../services/whatsapp-api/src/readCache.js';

// Etapa 5, item 2: a whatsapp-api le so a partir do mes que a consulta precisa
// (mais as contas em aberto de qualquer epoca), nao o historico inteiro.

const API_KEY = 'test-key-123';
const PHONE = '+34 637 210 215';
const UID = 'user-a';
const NOW = new Date('2026-11-05T15:00:00Z');

function seed() {
  return {
    [UID]: [
      { id: 'atual', type: 'saida', description: 'Aluguel', amount: 2000, status: 'Pago', competence: '2026-11', due_date: '2026-11-05' },
      { id: 'mes_passado', type: 'saida', description: 'Luz', amount: 300, status: 'Pago', competence: '2026-10', due_date: '2026-10-10' },
      { id: 'antigo_pago', type: 'saida', description: 'Uber antigo', amount: 40, status: 'Pago', competence: '2024-03', due_date: '2024-03-10' },
      { id: 'antigo_aberto', type: 'saida', description: 'Boleto esquecido', amount: 75, status: 'Em aberto', competence: '2024-06', due_date: '2024-06-10' },
      { id: 'sem_competencia', type: 'saida', description: 'Padaria', amount: 12, status: 'Pago', competence: '', occurred_date: '2026-09-02' },
      { id: 'futura', type: 'saida', description: 'Seguro', amount: 90, status: 'Pago', competence: '2027-02', due_date: '2027-02-10' }
    ]
  };
}

function setup() {
  const base = createMemoryStore(seed());
  const spy = vi.spyOn(base, 'listFinanceRecords');
  const resolver = createPhoneResolver(parsePhoneLinks(JSON.stringify([{ telefone: PHONE, uid: UID, chatwootAccountId: '3' }])));
  const app = createApp({ store: base, resolver, apiKey: API_KEY, now: () => NOW, logger: { info() {}, warn() {}, error() {} } });
  const call = (route, body = {}) => app.handle({ method: 'POST', path: `/internal/whatsapp/${route}`, headers: { 'x-api-key': API_KEY }, body: { telefone: PHONE, accountId: 3, ...body } });
  const fromOfLastCall = () => spy.mock.calls.at(-1)?.[1]?.from;
  return { call, spy, fromOfLastCall };
}

describe('whatsapp-api: leituras so a partir do mes necessario', () => {
  it('memoryStore com from devolve o periodo, futuros, sem competencia e contas em aberto antigas', async () => {
    const store = createMemoryStore(seed());
    const ids = (await store.listFinanceRecords(UID, { from: '2026-09' })).map((record) => record.id).sort();
    expect(ids).toEqual(['antigo_aberto', 'atual', 'futura', 'mes_passado', 'sem_competencia']);
    expect((await store.listFinanceRecords(UID)).map((record) => record.id)).toContain('antigo_pago');
  });

  it('resumo e categorias leem a partir do inicio do periodo pedido, inclusive meses antigos', async () => {
    const { call, fromOfLastCall } = setup();
    const atual = await call('resumo', { competencia: '2026-11' });
    expect(atual.status).toBe(200);
    expect(fromOfLastCall()).toBe('2026-11');

    const antigo = await call('resumo', { competencia: '2024-03' });
    expect(fromOfLastCall()).toBe('2024-03');
    expect(antigo.body.despesas_pagas).toBe(40);

    await call('categorias', { competencia_inicio: '2026-08', competencia_fim: '2026-11' });
    expect(fromOfLastCall()).toBe('2026-08');
  });

  it('lancamentos sem competencia buscam nos ultimos 12 meses e futuros', async () => {
    const { call, fromOfLastCall } = setup();
    const response = await call('lancamentos', {});
    expect(response.status).toBe(200);
    expect(fromOfLastCall()).toBe('2025-12');
    const ids = response.body.lancamentos.map((item) => item.id);
    expect(ids).toContain('atual');
    expect(ids).not.toContain('antigo_pago');

    const old = await call('lancamentos', { competencia: '2024-03' });
    expect(fromOfLastCall()).toBe('2024-03');
    expect(old.body.lancamentos.map((item) => item.id)).toEqual(['antigo_pago']);
  });

  it('vencimentos le o mes atual e ainda enxerga contas vencidas antigas', async () => {
    const { call, fromOfLastCall } = setup();
    const response = await call('vencimentos', { dias: 7 });
    expect(response.status).toBe(200);
    expect(fromOfLastCall()).toBe('2026-11');
    expect(JSON.stringify(response.body)).toContain('antigo_aberto');
  });

  it('cache separa leituras por mes inicial e a escrita limpa todas do usuario', async () => {
    const base = createMemoryStore(seed());
    const spy = vi.spyOn(base, 'listFinanceRecords');
    const store = withReadCache(base, { ttlMs: 30_000, nowMs: () => 0 });
    await store.listFinanceRecords(UID, { from: '2026-11' });
    await store.listFinanceRecords(UID, { from: '2026-11' });
    await store.listFinanceRecords(UID, { from: '2024-01' });
    await store.listFinanceRecords(UID);
    expect(spy).toHaveBeenCalledTimes(3);
    expect(spy.mock.calls.map((args) => args[1]?.from || 'all')).toEqual(['2026-11', '2024-01', 'all']);

    await store.createRecord(UID, { type: 'saida', amount: 1, status: 'Pago', competence: '2026-11' });
    await store.listFinanceRecords(UID, { from: '2026-11' });
    await store.listFinanceRecords(UID, { from: '2024-01' });
    expect(spy).toHaveBeenCalledTimes(5);
  });
});
