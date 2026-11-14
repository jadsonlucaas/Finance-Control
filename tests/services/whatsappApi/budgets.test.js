import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../../../services/whatsapp-api/src/app.js';
import { createMemoryStore } from '../../../services/whatsapp-api/src/memoryStore.js';
import { createPhoneResolver, parsePhoneLinks } from '../../../services/whatsapp-api/src/phoneLinks.js';
import { withReadCache } from '../../../services/whatsapp-api/src/readCache.js';

const API_KEY = 'test-key-123';
const PHONE_BR = '+55 92 99999-0000';
const PHONE_ES = '+34 637 210 215';
const UID = 'user-a';
const UID_ES = 'user-es';
const OTHER = 'user-b';
const NOW = new Date('2026-11-14T15:00:00Z');

const expense = (id, overrides = {}) => ({ id, type: 'saida', amount: 100, status: 'Pago', category_name: 'Alimentação', competence: '2026-11', ...overrides });

function setup({ cache = false } = {}) {
  const base = createMemoryStore({
    [UID]: [
      expense('a1', { amount: 300 }),
      expense('a2', { amount: 100, status: 'Em aberto' }),
      expense('a3', { amount: 999, status: 'Cancelado' }),
      expense('t1', { amount: 80, category_name: 'Transporte' }),
      expense('s1', { amount: 45, category_name: 'Saúde' })
    ],
    [UID_ES]: [expense('e1', { amount: 50 })],
    [OTHER]: [expense('x1', { amount: 5000 })]
  });
  base._setBudget(UID, 'cat_alimentacao', { scope: 'category', category_name: 'Alimentação', limits: { '2026-11': 500 } });
  base._setBudget(UID, 'cat_transporte', { scope: 'category', category_name: 'Transporte', limits: { '2026-10': 50 } });
  base._setBudget(UID, 'total', { scope: 'total', limits: { '2026-11': 1000 } });
  base._setBudget(UID_ES, 'cat_alimentacao', { scope: 'category', category_name: 'Alimentação', limits: { '2026-11': 200 } });
  base._setBudget(OTHER, 'cat_alimentacao', { scope: 'category', category_name: 'Alimentação', limits: { '2026-11': 1 } });
  base._setOnboarding(UID_ES, { country: 'ES', currency: 'EUR', whatsapp_phone: '+34637210215' });
  const store = cache ? withReadCache(base) : base;
  const resolver = createPhoneResolver(parsePhoneLinks(JSON.stringify([
    { telefone: PHONE_BR, uid: UID, chatwootAccountId: '3' },
    { telefone: PHONE_ES, uid: UID_ES, chatwootAccountId: '3' }
  ])));
  const app = createApp({ store, resolver, apiKey: API_KEY, now: () => NOW, logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() } });
  const call = (body, phone = PHONE_BR) => app.handle({ method: 'POST', path: '/internal/whatsapp/orcamento', headers: { 'x-api-key': API_KEY }, body: { telefone: phone, accountId: 3, ...body } });
  return { base, call };
}

describe('whatsapp-api: consulta de orcamento', () => {
  it('responde quanto ainda pode gastar na categoria pedida (realizado + comprometido)', async () => {
    const { call } = setup();
    const response = await call({ categoria: 'alimentação' });
    expect(response.status).toBe(200);
    expect(response.body.categoria_consultada).toMatchObject({ categoria: 'Alimentação', limite: 500, realizado: 300, comprometido: 100, disponivel: 100, percentual: 80, estado: 'alerta' });
    expect(response.body.resposta_usuario).toBe('Alimentação: você ainda pode gastar R$ 100,00 este mês (usou R$ 400,00 de R$ 500,00, 80%).');
    expect(response.body.preferencias).toBeTruthy();
  });

  it('entende palavras do dia a dia e nomes em espanhol', async () => {
    const { call } = setup();
    expect((await call({ categoria: 'comida' })).body.categoria_consultada.categoria).toBe('Alimentação');
    expect((await call({ categoria: 'Alimentación' })).body.categoria_consultada.categoria).toBe('Alimentação');
    expect((await call({ categoria: 'uber' })).body.categoria_consultada.categoria).toBe('Transporte');
  });

  it('limite que vem de um mes anterior vale no mes atual; estourado vira frase de excesso', async () => {
    const { call } = setup();
    const response = await call({ categoria: 'transporte' });
    expect(response.body.categoria_consultada).toMatchObject({ limite: 50, usado: 80, disponivel: -30, estado: 'estourado' });
    expect(response.body.resposta_usuario).toBe('Transporte: você passou do limite em R$ 30,00 este mês (usou R$ 80,00 de R$ 50,00).');
  });

  it('categoria sem limite informa o gasto e onde criar', async () => {
    const { call } = setup();
    const response = await call({ categoria: 'saúde' });
    expect(response.body.categoria_consultada).toBeNull();
    expect(response.body.resposta_usuario).toBe('Você ainda não definiu um limite para Saúde. Este mês você já gastou R$ 45,00 nela. Dá para criar no Dashboard, em Orçamentos.');
  });

  it('sem categoria devolve o total e todas as categorias', async () => {
    const { call } = setup();
    const response = await call({});
    expect(response.body.total).toMatchObject({ limite: 1000, usado: 525, disponivel: 475 });
    expect(response.body.resposta_usuario.split('\n')).toEqual([
      'Total do mês: você ainda pode gastar R$ 475,00 este mês (usou R$ 525,00 de R$ 1.000,00, 52,5%).',
      '• Transporte: você passou do limite em R$ 30,00 este mês (usou R$ 80,00 de R$ 50,00).',
      '• Alimentação: você ainda pode gastar R$ 100,00 este mês (usou R$ 400,00 de R$ 500,00, 80%).'
    ]);
  });

  it('outro mes e mes sem orcamento', async () => {
    const { call } = setup();
    const october = await call({ competencia: '2026-10', categoria: 'transporte' });
    expect(october.body.resposta_usuario).toContain('em 10/2026');
    const empty = await call({ competencia: '2026-09' });
    expect(empty.body.resposta_usuario).toBe('Você ainda não tem orçamentos. Crie seus limites no Dashboard, em Orçamentos.');
    expect((await call({ competencia: 'novembro' })).status).toBe(400);
  });

  it('responde em espanhol e euro para numero +34, sem misturar contas', async () => {
    const { call } = setup();
    const response = await call({ categoria: 'comida' }, PHONE_ES);
    expect(response.body.categoria_consultada).toMatchObject({ limite: 200, usado: 50 });
    expect(response.body.resposta_usuario).toBe('Alimentación: aún puedes gastar 150,00 € este mes (usado 50,00 € de 200,00 €, 25%).');
  });

  it('mudanca de limite no Dashboard aparece na hora, mesmo com cache de lancamentos', async () => {
    const { call, base } = setup({ cache: true });
    expect((await call({ categoria: 'alimentação' })).body.categoria_consultada.limite).toBe(500);
    base._setBudget(UID, 'cat_alimentacao', { scope: 'category', category_name: 'Alimentação', limits: { '2026-11': 800 } });
    expect((await call({ categoria: 'alimentação' })).body.categoria_consultada).toMatchObject({ limite: 800, disponivel: 400 });
  });
});
