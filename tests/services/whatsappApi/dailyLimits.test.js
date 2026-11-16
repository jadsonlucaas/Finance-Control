import { describe, expect, it } from 'vitest';
import { createApp } from '../../../services/whatsapp-api/src/app.js';
import { createMemoryStore } from '../../../services/whatsapp-api/src/memoryStore.js';
import { createPhoneResolver, parsePhoneLinks } from '../../../services/whatsapp-api/src/phoneLinks.js';
import { createDailyLimiter, normalizeDailyLimit } from '../../../services/whatsapp-api/src/dailyLimits.js';

// Etapa 5, item 4: teto diario de uso do assistente por usuario.

const API_KEY = 'test-key-123';
const PHONE = '+55 92 99999-0000';
const UID = 'user-a';

function setup({ limits = { messages: 2, tool_calls: 3 }, now = new Date('2026-11-16T15:00:00Z'), store = createMemoryStore({ [UID]: [] }) } = {}) {
  let clock = now;
  const resolver = createPhoneResolver(parsePhoneLinks(JSON.stringify([{ telefone: PHONE, uid: UID, chatwootAccountId: '3' }])));
  const app = createApp({ store, resolver, apiKey: API_KEY, now: () => clock, dailyLimits: limits, logger: { info() {}, warn() {}, error() {} } });
  const call = async (route, body = {}) => {
    const response = await app.handle({ method: 'POST', path: `/internal/whatsapp/${route}`, headers: { 'x-api-key': API_KEY }, body: { telefone: PHONE, accountId: 3, ...body } });
    await app.flushUsage();
    return response;
  };
  return { call, store, setNow: (value) => { clock = value; } };
}

describe('whatsapp-api: limite diario por usuario', () => {
  it('mensagem acima do limite volta com limite_atingido e texto pronto; duplicada nao conta', async () => {
    const { call } = setup();
    expect((await call('mensagem/registrar', { mensagemId: '1' })).body).toEqual({ duplicada: false });
    expect((await call('mensagem/registrar', { mensagemId: '1' })).body).toEqual({ duplicada: true });
    expect((await call('mensagem/registrar', { mensagemId: '2' })).body).toEqual({ duplicada: false });
    const third = await call('mensagem/registrar', { mensagemId: '3' });
    expect(third.status).toBe(200);
    expect(third.body).toMatchObject({ duplicada: false, limite_atingido: true });
    expect(third.body.mensagem).toMatch(/limite de uso do assistente por hoje/);
  });

  it('ferramentas acima do limite respondem 429 DAILY_LIMIT_REACHED e o dia seguinte libera', async () => {
    const { call, setNow } = setup();
    for (let index = 0; index < 3; index += 1) expect((await call('resumo', { competencia: '2026-11' })).status).toBe(200);
    const blocked = await call('resumo', { competencia: '2026-11' });
    expect(blocked.status).toBe(429);
    expect(blocked.body.erro).toMatchObject({ codigo: 'DAILY_LIMIT_REACHED', detalhes: { limite: 3, tipo: 'tool_calls' } });

    setNow(new Date('2026-11-17T00:01:00Z'));
    expect((await call('resumo', { competencia: '2026-11' })).status).toBe(200);
  });

  it('reiniciar a API nao zera: parte do consumo ja gravado no dia', async () => {
    const store = createMemoryStore({ [UID]: [] });
    await store.incrementUsage(UID, '2026-11', { 'by_day.16.messages': 2, 'by_day.16.tool_calls': 1 }, '2026-11-16T10:00:00Z');
    const { call } = setup({ store });
    expect((await call('mensagem/registrar', { mensagemId: '9' })).body.limite_atingido).toBe(true);
    expect((await call('resumo', { competencia: '2026-11' })).status).toBe(200);
  });

  it('limite 0 desliga, valor vazio ou invalido usa o padrao', async () => {
    expect(normalizeDailyLimit('', 100)).toBe(100);
    expect(normalizeDailyLimit(undefined, 100)).toBe(100);
    expect(normalizeDailyLimit('abc', 100)).toBe(100);
    expect(normalizeDailyLimit('-1', 100)).toBe(100);
    expect(normalizeDailyLimit('0', 100)).toBe(0);
    expect(normalizeDailyLimit('250', 100)).toBe(250);

    const limiter = createDailyLimiter({ limits: { messages: 0, tool_calls: 0 } });
    for (let index = 0; index < 1000; index += 1) expect((await limiter.hit('messages', UID)).allowed).toBe(true);
    expect(createDailyLimiter().limits).toEqual({ messages: 100, tool_calls: 400 });
  });

  it('falha ao ler o consumo do dia nao bloqueia ninguem', async () => {
    const limiter = createDailyLimiter({ store: { getUsage: async () => { throw new Error('quota'); } }, limits: { messages: 5, tool_calls: 5 }, logger: { warn() {} } });
    expect(await limiter.hit('messages', UID)).toMatchObject({ allowed: true, used: 1 });
  });
});
