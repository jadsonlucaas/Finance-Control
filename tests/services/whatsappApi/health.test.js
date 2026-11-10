import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../../../services/whatsapp-api/src/app.js';
import { checkStoreHealth } from '../../../services/whatsapp-api/src/health.js';
import { createMemoryStore } from '../../../services/whatsapp-api/src/memoryStore.js';
import { withReadCache } from '../../../services/whatsapp-api/src/readCache.js';
import { createPhoneResolver, parsePhoneLinks } from '../../../services/whatsapp-api/src/phoneLinks.js';
import { createRateLimiter, DEFAULT_RATE_LIMITS } from '../../../services/whatsapp-api/src/rateLimit.js';

const API_KEY = 'test-key-123';

function setup({ ping, limits, healthTimeoutMs } = {}) {
  const store = createMemoryStore({});
  if (ping) store.ping = ping;
  const resolver = createPhoneResolver(parsePhoneLinks('[]'));
  const logger = { info: vi.fn(), error: vi.fn(), warn: vi.fn() };
  const rateLimiter = createRateLimiter({ limits: { ...DEFAULT_RATE_LIMITS, ...limits } });
  const app = createApp({ store: withReadCache(store), resolver, apiKey: API_KEY, logger, rateLimiter, healthTimeoutMs });
  const get = (path, headers = { 'x-api-key': API_KEY }) => app.handle({ method: 'GET', path, headers });
  return { get, store, logger };
}

describe('whatsapp-api: saude', () => {
  it('/health continua publico e sem tocar no banco', async () => {
    const ping = vi.fn(async () => true);
    const { get } = setup({ ping });
    const res = await get('/health', {});
    expect(res).toEqual({ status: 200, body: { ok: true } });
    expect(ping).not.toHaveBeenCalled();
  });

  it('/internal/health exige a chave da API', async () => {
    const ping = vi.fn(async () => true);
    const { get } = setup({ ping });
    expect((await get('/internal/health', {})).status).toBe(401);
    expect(ping).not.toHaveBeenCalled();
  });

  it('responde 200 quando o banco responde (passando pelo cache de leitura)', async () => {
    const ping = vi.fn(async () => true);
    const { get } = setup({ ping });
    const res = await get('/internal/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ok: true, banco: 'ok' });
    expect(ping).toHaveBeenCalledTimes(1);
  });

  it('responde 503 com motivo COTA_ESGOTADA quando o Firestore estoura a cota', async () => {
    const err = Object.assign(new Error('8 RESOURCE_EXHAUSTED: Quota exceeded.'), { code: 8 });
    const { get } = setup({ ping: async () => { throw err; } });
    const res = await get('/internal/health');
    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({ ok: false, banco: 'falha', motivo: 'COTA_ESGOTADA' });
    expect(JSON.stringify(res.body)).not.toMatch(/Quota exceeded/);
  });

  it('responde 503 TIMEOUT quando o banco demora demais', async () => {
    const { get } = setup({ ping: () => new Promise(() => {}), healthTimeoutMs: 20 });
    const res = await get('/internal/health');
    expect(res.status).toBe(503);
    expect(res.body.motivo).toBe('TIMEOUT');
  });

  it('limita a checagem profunda para nao gastar leituras', async () => {
    const ping = vi.fn(async () => true);
    const { get } = setup({ ping, limits: { healthDeep: { limit: 2, windowMs: 60_000 } } });
    expect((await get('/internal/health')).status).toBe(200);
    expect((await get('/internal/health')).status).toBe(200);
    expect((await get('/internal/health')).status).toBe(429);
    expect(ping).toHaveBeenCalledTimes(2);
  });

  it('checkStoreHealth classifica erros sem vazar a mensagem', async () => {
    const fail = (e) => checkStoreHealth({ ping: async () => { throw e; } });
    expect((await fail(Object.assign(new Error('x'), { code: 14 }))).motivo).toBe('INDISPONIVEL');
    expect((await fail(new Error('connect ECONNREFUSED 10.0.0.1'))).motivo).toBe('INDISPONIVEL');
    expect((await fail(new Error('algo estranho com dados'))).motivo).toBe('ERRO');
    expect(await checkStoreHealth({})).toMatchObject({ ok: true, banco: 'nao_verificado' });
  });
});
