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
  const define = (body, phone = PHONE_BR) => app.handle({ method: 'POST', path: '/internal/whatsapp/orcamento/definir', headers: { 'x-api-key': API_KEY }, body: { telefone: phone, accountId: 3, ...body } });
  return { base, call, define };
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

describe('whatsapp-api: definir orcamento pelo chat', () => {
  it('cria limite de categoria a partir do mes pedido e a consulta enxerga na hora', async () => {
    const { define, call, base } = setup({ cache: true });
    const response = await define({ categoria: 'saúde', valor: 357, competencia: '2026-11' });
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ status: 'orcamento_definido', orcamento_id: 'cat_saude', limite: 357 });
    expect(response.body.resposta_usuario).toBe('Pronto: limite de Saúde em R$ 357,00 a partir de 11/2026 (vale também para os meses seguintes). Este mês você já usou R$ 45,00 (12,6%).');
    const saved = (await base.listBudgets(UID)).find((item) => item.id === 'cat_saude');
    expect(saved).toMatchObject({ scope: 'category', category_name: 'Saúde', owner_uid: UID, limits: { '2026-11': 357 }, schema_version: 1 });
    expect(saved.updated_at).toBe(NOW.toISOString());
    expect((await call({ categoria: 'saude' })).body.categoria_consultada).toMatchObject({ limite: 357 });
  });

  it('altera limite existente sem apagar meses anteriores e entende palavra do dia a dia', async () => {
    const { define, base } = setup();
    const response = await define({ categoria: 'uber', valor: '120,50', competencia: '2026-11' });
    expect(response.body.orcamento_id).toBe('cat_transporte');
    const saved = (await base.listBudgets(UID)).find((item) => item.id === 'cat_transporte');
    expect(saved.limits).toEqual({ '2026-10': 50, '2026-11': 120.5 });
  });

  it('total do mes quando nao ha categoria ou o usuario diz "total"', async () => {
    const { define, base } = setup();
    expect((await define({ valor: 2000 })).body.orcamento_id).toBe('total');
    expect((await define({ categoria: 'geral', valor: 2500, competencia: '2026-12' })).body.orcamento_id).toBe('total');
    const total = (await base.listBudgets(UID)).find((item) => item.id === 'total');
    expect(total).toMatchObject({ scope: 'total', limits: { '2026-11': 2000, '2026-12': 2500 } });
    expect(total.category_name).toBeUndefined();
  });

  it('nao inventa categoria nem lanca despesa quando nao reconhece o nome', async () => {
    const { define, base } = setup();
    const before = await base.listFinanceRecords(UID);
    const response = await define({ categoria: 'Meta de gasto xyz', valor: 357 });
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('categoria_nao_encontrada');
    expect(response.body.resposta_usuario).toMatch(/^Não encontrei a categoria "Meta de gasto xyz"\. Me diga uma destas: /);
    expect((await base.listBudgets(UID)).map((item) => item.id).sort()).toEqual(['cat_alimentacao', 'cat_transporte', 'total']);
    expect(await base.listFinanceRecords(UID)).toHaveLength(before.length);
  });

  it('responde em espanhol e euro para +34 e grava so na conta dele', async () => {
    const { define, base } = setup();
    const response = await define({ categoria: 'transporte', valor: 357, competencia: '2026-11' }, PHONE_ES);
    expect(response.body.resposta_usuario).toBe('Listo: límite de Transporte en 357,00 € desde 11/2026 (sigue igual en los meses siguientes).');
    expect((await base.listBudgets(UID_ES)).map((item) => item.id).sort()).toEqual(['cat_alimentacao', 'cat_transporte']);
    expect((await base.listBudgets(UID)).find((item) => item.id === 'cat_transporte').limits).toEqual({ '2026-10': 50 });
  });

  it('recusa valor invalido e mes fora do formato', async () => {
    const { define } = setup();
    expect((await define({ categoria: 'transporte', valor: 0 })).status).toBe(400);
    expect((await define({ categoria: 'transporte', valor: 'abc' })).status).toBe(400);
    expect((await define({ categoria: 'transporte', valor: 10, competencia: 'novembro' })).status).toBe(400);
  });
});
