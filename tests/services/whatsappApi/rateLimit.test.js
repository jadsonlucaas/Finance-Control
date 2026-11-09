import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../../../services/whatsapp-api/src/app.js';
import { createMemoryStore } from '../../../services/whatsapp-api/src/memoryStore.js';
import { createPhoneResolver, parsePhoneLinks } from '../../../services/whatsapp-api/src/phoneLinks.js';
import { createRateLimiter, DEFAULT_RATE_LIMITS } from '../../../services/whatsapp-api/src/rateLimit.js';

const API_KEY = 'test-key-123';
const PHONE_A = '+34 637 210 215';
const PHONE_B = '+55 11 99999-0000';
const NOW = new Date('2026-11-09T15:00:00Z');

function setup(limits) {
  let clock = 0;
  const rateLimiter = createRateLimiter({ limits: { ...DEFAULT_RATE_LIMITS, ...limits }, nowMs: () => clock });
  const store = createMemoryStore({ 'user-a': [], 'user-b': [] });
  const resolver = createPhoneResolver(parsePhoneLinks(JSON.stringify([
    { telefone: PHONE_A, uid: 'user-a', chatwootAccountId: '3' },
    { telefone: PHONE_B, uid: 'user-b', chatwootAccountId: '3' }
  ])));
  const logger = { info: vi.fn(), error: vi.fn(), warn: vi.fn() };
  const checkout = { configured: true, createCheckout: vi.fn(async () => ({ url: 'https://stripe.test' })), createPortal: vi.fn() };
  const app = createApp({ store, resolver, apiKey: API_KEY, now: () => NOW, logger, rateLimiter, checkout });
  const headers = { 'x-api-key': API_KEY };
  const call = (route, phone = PHONE_A, extra = {}) =>
    app.handle({ method: 'POST', path: `/internal/whatsapp/${route}`, headers, body: { telefone: phone, accountId: 3, ...extra } });
  const billing = (idToken) => app.handle({ method: 'POST', path: '/internal/billing', headers, body: { acao: 'checkout', idToken } });
  return { call, billing, checkout, advance: (ms) => { clock += ms; } };
}

describe('whatsapp-api: limite de requisicoes', () => {
  it('limita por telefone e libera de novo depois da janela', async () => {
    const { call, advance } = setup({ phone: { limit: 3, windowMs: 60_000 } });
    for (let i = 0; i < 3; i++) expect((await call('resumo')).status).toBe(200);
    const blocked = await call('resumo');
    expect(blocked.status).toBe(429);
    expect(blocked.body.erro.codigo).toBe('RATE_LIMITED');
    expect(blocked.body.erro.detalhes).toMatchObject({ limite: 'phone', tente_em_segundos: 60 });
    // Outro telefone nao e afetado.
    expect((await call('resumo', PHONE_B)).status).toBe(200);
    advance(60_000);
    expect((await call('resumo')).status).toBe(200);
  });

  it('o mesmo telefone em formatos diferentes conta junto', async () => {
    const { call } = setup({ phone: { limit: 1, windowMs: 60_000 } });
    expect((await call('resumo', '+34637210215')).status).toBe(200);
    expect((await call('resumo', '34 637-210-215')).status).toBe(429);
  });

  it('escritas tem limite proprio por usuario', async () => {
    const { call } = setup({ userWrite: { limit: 2, windowMs: 60_000 } });
    // preparar invalido responde 400, mas a chamada conta.
    expect((await call('acoes/preparar', PHONE_A, { tipo: 'x' })).status).not.toBe(429);
    expect((await call('acoes/preparar', PHONE_A, { tipo: 'x' })).status).not.toBe(429);
    const blocked = await call('acoes/cancelar', PHONE_A, {});
    expect(blocked.status).toBe(429);
    expect(blocked.body.erro.detalhes.limite).toBe('userWrite');
    // Leitura continua liberada.
    expect((await call('resumo')).status).toBe(200);
  });

  it('tentativas de codigo de vinculo sao limitadas por telefone', async () => {
    const { call } = setup({ linkConfirm: { limit: 2, windowMs: 600_000 } });
    const stranger = '+44 7700 900123';
    expect((await call('vinculo/confirmar', stranger, { codigo: 'AAAAAAAA' })).status).toBe(400);
    expect((await call('vinculo/confirmar', stranger, { codigo: 'AAAAAAAA' })).status).toBe(400);
    const blocked = await call('vinculo/confirmar', stranger, { codigo: 'AAAAAAAA' });
    expect(blocked.status).toBe(429);
    expect(blocked.body.erro.detalhes.limite).toBe('linkConfirm');
  });

  it('cobranca: limite por token e teto geral, antes de chamar o Stripe', async () => {
    const { billing, checkout } = setup({ billingToken: { limit: 2, windowMs: 60_000 }, billingGlobal: { limit: 3, windowMs: 60_000 } });
    expect((await billing('tok-1')).status).toBe(200);
    expect((await billing('tok-1')).status).toBe(200);
    expect((await billing('tok-1')).body.erro.detalhes.limite).toBe('billingToken');
    expect((await billing('tok-2')).body.erro.detalhes.limite).toBe('billingGlobal');
    expect(checkout.createCheckout).toHaveBeenCalledTimes(2);
  });

  it('nao limita chave vazia e limpa buckets vencidos', () => {
    let clock = 0;
    const limiter = createRateLimiter({ limits: { p: { limit: 1, windowMs: 10 } }, nowMs: () => clock });
    expect(limiter.hit('p', '').allowed).toBe(true);
    expect(limiter.hit('p', '').allowed).toBe(true);
    expect(limiter.hit('p', 'k').allowed).toBe(true);
    expect(limiter.hit('p', 'k').allowed).toBe(false);
    clock = 100;
    // A cada 1000 chamadas os buckets vencidos saem: sobra so o da chave nova.
    for (let i = 0; i < 1000; i++) limiter.hit('p', 'nova');
    expect(limiter.size()).toBe(1);
  });
});
