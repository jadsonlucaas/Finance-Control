import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../../../services/whatsapp-api/src/app.js';
import { createMemoryStore } from '../../../services/whatsapp-api/src/memoryStore.js';
import { createPhoneResolver, parsePhoneLinks } from '../../../services/whatsapp-api/src/phoneLinks.js';
import { createPreferenceResolver } from '../../../services/whatsapp-api/src/preferences.js';

const API_KEY = 'test-key-123';
const PHONE = '+34 637 210 215';
const UID = 'user-es';
// 30/11 23:30 UTC: em Madri ja e 01/12 00:30; em Sao Paulo ainda e 30/11 20:30.
const NOW = new Date('2026-11-30T23:30:00Z');

function setup(onboarding) {
  const store = createMemoryStore({
    [UID]: [{ id: 'r1', type: 'saida', description: 'Aluguel', amount: 800, status: 'Em aberto', competence: '2026-11', due_date: '2026-11-30' }]
  }, { shared: [] });
  if (onboarding) store._setOnboarding(UID, onboarding);
  const resolver = createPhoneResolver(parsePhoneLinks(JSON.stringify([{ telefone: PHONE, uid: UID, chatwootAccountId: '3' }])));
  let counter = 0;
  const app = createApp({ store, resolver, apiKey: API_KEY, now: () => NOW, logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }, newId: () => `id-${++counter}` });
  const call = (route, body = {}) => app.handle({ method: 'POST', path: `/internal/whatsapp/${route}`, headers: { 'x-api-key': API_KEY }, body: { telefone: PHONE, accountId: 3, ...body } });
  return { store, call };
}

describe('whatsapp-api: fuso horario do usuario', () => {
  it('usuario na Espanha: "hoje" e "este mes" seguem Madri', async () => {
    const { call } = setup({ country: 'ES' });
    const venc = await call('vencimentos', { dias: 0 });
    expect(venc.body.hoje).toBe('2026-12-01');
    const resumo = await call('resumo');
    expect(resumo.body.competencia).toBe('2026-12');
  });

  it('fuso escolhido em Configuracoes vale mais que o pais', async () => {
    const { call } = setup({ country: 'ES', time_zone: 'America/Sao_Paulo' });
    expect((await call('vencimentos', { dias: 0 })).body.hoje).toBe('2026-11-30');
  });

  it('conta sem cadastro continua no horario de Brasilia', async () => {
    const { call } = setup(null);
    expect((await call('vencimentos', { dias: 0 })).body.hoje).toBe('2026-11-30');
    expect((await call('resumo')).body.competencia).toBe('2026-11');
  });

  it('lancamento registrado pelo WhatsApp recebe a data do fuso do usuario', async () => {
    const { call, store } = setup({ country: 'ES' });
    const prepared = await call('acoes/preparar', { acao: 'registrar_despesa', dados: { descricao: 'Cafe', valor: 3, categoria: 'Outros', forma_pagamento: 'Pix' } });
    expect(prepared.status).toBe(200);
    await call('acoes/confirmar', { confirmation_id: prepared.body.confirmation_id });
    const created = store._dump(UID).records.find((record) => record.description === 'Cafe');
    expect(created.competence).toBe('2026-12');
  });
});

describe('whatsapp-api: leitura das preferencias', () => {
  it('guarda por pouco tempo e cai no padrao se a leitura falhar', async () => {
    let clock = 0;
    const getOnboarding = vi.fn(async () => ({ country: 'ES' }));
    const resolver = createPreferenceResolver({ store: { getOnboarding }, ttlMs: 1000, nowMs: () => clock });
    expect((await resolver.forUser('u1')).time_zone).toBe('Europe/Madrid');
    await resolver.forUser('u1');
    expect(getOnboarding).toHaveBeenCalledTimes(1);
    clock = 2000;
    await resolver.forUser('u1');
    expect(getOnboarding).toHaveBeenCalledTimes(2);

    const failing = createPreferenceResolver({ store: { getOnboarding: async () => { throw new Error('quota'); } }, logger: { warn: vi.fn() } });
    expect((await failing.forUser('u2')).time_zone).toBe('America/Sao_Paulo');
  });
});
