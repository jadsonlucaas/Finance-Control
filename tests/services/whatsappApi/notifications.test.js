import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../../../services/whatsapp-api/src/app.js';
import { createMemoryStore } from '../../../services/whatsapp-api/src/memoryStore.js';
import { createPhoneResolver } from '../../../services/whatsapp-api/src/phoneLinks.js';
import { buildUserAlerts } from '../../../services/whatsapp-api/src/notifications.js';
import { localHour, parseNotificationTemplates } from '../../../services/whatsapp-api/src/notificationService.js';
import { runWithCurrency } from '../../../services/whatsapp-api/src/money.js';
import { resolveNotificationSettings } from '../../../src/core/notificationSettings.js';

const API_KEY = 'test-key-123';
const UID = 'user-a';
const UID_ES = 'user-es';
const PHONE = '+5592999990000';
const PHONE_ES = '+34637210215';
const ON = { whatsapp_consent: 'granted', whatsapp_consent_version: 'whatsapp-alerts-v1' };

const expense = (id, overrides = {}) => ({ id, type: 'saida', amount: 100, status: 'Em aberto', category_name: 'Alimentação', description: `Conta ${id}`, competence: '2026-11', ...overrides });

// 13:00 em Manaus (UTC-4) = 17:00Z; 18:00 em Madri.
function setup({ now = new Date('2026-11-14T13:00:00Z'), accessMode = 'open', templates = {}, lastInbound = '2026-11-14T12:00:00Z' } = {}) {
  let clock = now;
  const store = createMemoryStore({
    [UID]: [
      expense('hoje', { due_date: '2026-11-14', amount: 50 }),
      expense('d2', { due_date: '2026-11-16', amount: 70 }),
      expense('d5', { due_date: '2026-11-19' }),
      expense('pago', { due_date: '2026-11-15', status: 'Pago' }),
      expense('venc', { due_date: '2026-11-10', amount: 30 }),
      expense('antiga', { due_date: '2026-10-01' }),
      expense('cancel', { due_date: '2026-11-15', status: 'Cancelado' })
    ],
    [UID_ES]: [expense('es1', { due_date: '2026-11-15', amount: 12.5 })]
  }, {
    profiles: {
      [UID]: { uid: UID, status: 'active', role: 'user' },
      [UID_ES]: { uid: UID_ES, status: 'active', role: 'user' }
    }
  });
  store._putLink(PHONE, { uid: UID, telefone: PHONE, status: 'active', chatwoot_account_id: '3', last_inbound_at: lastInbound });
  store._putLink(PHONE_ES, { uid: UID_ES, telefone: PHONE_ES, status: 'active', chatwoot_account_id: '3', last_inbound_at: lastInbound });
  store._setOnboarding(UID, { country: 'BR', whatsapp_phone: PHONE, time_zone: 'America/Manaus' });
  store._setOnboarding(UID_ES, { country: 'ES', whatsapp_phone: PHONE_ES });
  store._setNotificationSettings(UID, { ...ON, send_hour: 9, monthly_summary_enabled: false, budget_enabled: false });
  let ids = 0;
  const app = createApp({
    store,
    resolver: createPhoneResolver(new Map(), { store }),
    apiKey: API_KEY,
    accessMode,
    now: () => clock,
    newId: () => `msg-${String(++ids).padStart(4, '0')}`,
    notificationTemplates: templates,
    logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() }
  });
  const post = (path, body) => app.handle({ method: 'POST', path, headers: { 'x-api-key': API_KEY }, body });
  return {
    store,
    setNow: (date) => { clock = date; },
    pending: () => post('/internal/notificacoes/pendentes', {}),
    result: (body) => post('/internal/notificacoes/resultado', body),
    whatsapp: (route, body, phone = PHONE) => post(`/internal/whatsapp/${route}`, { telefone: phone, accountId: 3, ...body })
  };
}

describe('alertas: montagem (notifications.js)', () => {
  const settings = resolveNotificationSettings({ ...ON, budget_enabled: false, monthly_summary_enabled: false });
  const records = [
    expense('hoje', { due_date: '2026-11-14', amount: 50 }),
    expense('d3', { due_date: '2026-11-17', amount: 70 }),
    expense('d4', { due_date: '2026-11-18' }),
    expense('venc', { due_date: '2026-11-07', amount: 30 }),
    expense('velha', { due_date: '2026-11-06' })
  ];

  it('a vencer: de hoje ate hoje+N; vencidas: ate 7 dias atras', () => {
    const alerts = runWithCurrency('BRL', () => buildUserAlerts({ records, settings, today: '2026-11-14', competence: '2026-11' }));
    expect(alerts.map((a) => a.tipo)).toEqual(['due_soon', 'overdue']);
    expect(alerts[0].chaves).toEqual(['due_soon:hoje:2026-11-14', 'due_soon:d3:2026-11-17']);
    expect(alerts[0].texto).toContain('Contas que vencem nos próximos 3 dias:');
    expect(alerts[0].texto).toContain('• Conta hoje: R$ 50,00 (vence hoje)');
    expect(alerts[0].texto).toContain('• Conta d3: R$ 70,00 (vence em 17/11)');
    expect(alerts[0].texto).toContain('Total: R$ 120,00');
    expect(alerts[0].texto).toContain('responda "parar alertas"');
    expect(alerts[0].parametros).toEqual(['2', 'R$ 120,00', '14/11']);
    expect(alerts[1].chaves).toEqual(['overdue:venc:2026-11-07']);
    expect(alerts[1].texto).toContain('Você tem uma conta vencida e não paga:');
  });

  it('nao repete o que ja foi enviado e respeita tipos desligados', () => {
    const alreadySent = new Set(['due_soon:hoje:2026-11-14', 'due_soon:d3:2026-11-17']);
    const alerts = runWithCurrency('BRL', () => buildUserAlerts({ records, settings: { ...settings, overdue_enabled: false }, today: '2026-11-14', competence: '2026-11', alreadySent }));
    expect(alerts).toEqual([]);
  });

  it('orcamento: um aviso por faixa; de 79% direto para 100% avisa so o de 100', () => {
    const budgetSettings = resolveNotificationSettings({ ...ON, due_soon_enabled: false, overdue_enabled: false, monthly_summary_enabled: false });
    const budgets = [{ id: 'cat_alimentacao', scope: 'category', category_name: 'Alimentação', limits: { '2026-11': 100 } }, { id: 'total', scope: 'total', limits: { '2026-11': 1000 } }];
    const at80 = [expense('x', { amount: 85, status: 'Pago' })];
    const first = runWithCurrency('BRL', () => buildUserAlerts({ records: at80, budgets, settings: budgetSettings, today: '2026-11-14', competence: '2026-11' }));
    expect(first).toHaveLength(1);
    expect(first[0].chaves).toEqual(['budget:cat_alimentacao:2026-11:80']);
    expect(first[0].texto).toContain('Você já usou 85% do orçamento de Alimentação (R$ 85,00 de R$ 100,00). Ainda restam R$ 15,00.');
    const again = runWithCurrency('BRL', () => buildUserAlerts({ records: at80, budgets, settings: budgetSettings, today: '2026-11-15', competence: '2026-11', alreadySent: new Set(first[0].chaves) }));
    expect(again).toEqual([]);
    const over = [expense('x', { amount: 130, status: 'Pago' })];
    const jump = runWithCurrency('BRL', () => buildUserAlerts({ records: over, budgets, settings: budgetSettings, today: '2026-11-15', competence: '2026-11' }));
    expect(jump[0].chaves).toEqual(['budget:cat_alimentacao:2026-11:80', 'budget:cat_alimentacao:2026-11:100']);
    expect(jump[0].texto).toContain('Você atingiu 100% do orçamento de Alimentação: usou R$ 130,00 de R$ 100,00 (passou R$ 30,00).');
  });

  it('resumo mensal so nos dias 1 a 3, em espanhol e euro', () => {
    const summarySettings = resolveNotificationSettings({ ...ON, due_soon_enabled: false, overdue_enabled: false, budget_enabled: false });
    const month = [
      { id: 'r', type: 'entrada', amount: 2000, status: 'Recebido', competence: '2026-10', category_name: 'Salário' },
      expense('o1', { competence: '2026-10', amount: 500, status: 'Pago' }),
      expense('n1', { competence: '2026-11', due_date: '2026-11-10', amount: 40 })
    ];
    const alerts = runWithCurrency('EUR', () => buildUserAlerts({ records: month, settings: summarySettings, locale: 'es-ES', today: '2026-11-02', competence: '2026-11' }));
    expect(alerts).toHaveLength(1);
    expect(alerts[0].chaves).toEqual(['summary:2026-10']);
    expect(alerts[0].texto).toContain('📅 Resumen de 10/2026:');
    expect(alerts[0].texto).toContain('• Gastos: 500,00 €');
    expect(alerts[0].texto).toContain('Compromisos de este mes: 40,00 € en 1 factura.');
    expect(alerts[0].texto).toContain('responde "parar alertas"');
    expect(runWithCurrency('EUR', () => buildUserAlerts({ records: month, settings: summarySettings, locale: 'es-ES', today: '2026-11-04', competence: '2026-11' }))).toEqual([]);
  });

  it('hora local e templates', () => {
    expect(localHour(new Date('2026-11-14T13:00:00Z'), 'America/Manaus')).toBe(9);
    expect(localHour(new Date('2026-11-14T13:00:00Z'), 'Europe/Madrid')).toBe(14);
    expect(parseNotificationTemplates('{"overdue":{"pt-BR":"fc_conta_vencida","es-ES":"Nome Ruim"}}')).toEqual({ overdue: { 'pt-BR': 'fc_conta_vencida' } });
    expect(() => parseNotificationTemplates('{x')).toThrow(/JSON/);
  });
});

describe('alertas: rotas da whatsapp-api', () => {
  it('no horario do usuario devolve as mensagens; no mesmo dia nao processa de novo', async () => {
    const ctx = setup();
    const first = await ctx.pending();
    expect(first.status).toBe(200);
    expect(first.body.mensagens.map((m) => m.tipo)).toEqual(['due_soon', 'overdue']);
    expect(first.body.mensagens[0]).toMatchObject({ id: expect.stringMatching(/^msg-/), telefone: PHONE, chatwoot_account_id: '3', idioma: 'pt-BR', janela_aberta: true, template: null });
    // Usuario es sem consentimento fica de fora.
    expect(first.body.resumo).toMatchObject({ usuarios: 1, mensagens: 2 });
    const second = await ctx.pending();
    expect(second.body.mensagens).toEqual([]);
    expect(second.body.resumo.ja_processados).toBe(1);
  });

  it('antes do horario escolhido nao envia; Premium exigido no modo entitlement', async () => {
    const early = setup({ now: new Date('2026-11-14T12:00:00Z') }); // 08:00 em Manaus
    expect((await early.pending()).body.resumo).toMatchObject({ fora_do_horario: 1, mensagens: 0 });
    const paid = setup({ accessMode: 'entitlement' });
    expect((await paid.pending()).body.resumo).toMatchObject({ sem_premium: 1, mensagens: 0 });
  });

  it('fora da janela de 24h: sem template nao envia; com template manda os parametros', async () => {
    const closed = setup({ lastInbound: '2026-11-12T10:00:00Z' });
    const none = await closed.pending();
    expect(none.body.mensagens).toEqual([]);
    expect(none.body.resumo.aguardando_template).toBe(2);

    const withTemplate = setup({ lastInbound: '', templates: { overdue: { 'pt-BR': 'fc_conta_vencida' } } });
    const res = await withTemplate.pending();
    expect(res.body.mensagens).toHaveLength(1);
    expect(res.body.mensagens[0]).toMatchObject({ tipo: 'overdue', janela_aberta: false, template: { nome: 'fc_conta_vencida', idioma: 'pt_BR', parametros: ['1', 'R$ 30,00'] } });
  });

  it('resultado: enviado marca as chaves; falhou libera para o dia seguinte', async () => {
    const ctx = setup();
    const [dueSoon, overdue] = (await ctx.pending()).body.mensagens;
    expect((await ctx.result({ id: dueSoon.id, status: 'enviado' })).body).toMatchObject({ status: 'sent', alterado: true });
    expect((await ctx.result({ id: dueSoon.id, status: 'falhou' })).body).toMatchObject({ status: 'sent', alterado: false });
    expect((await ctx.result({ id: overdue.id, status: 'falhou', erro_codigo: '131047' })).body.status).toBe('failed');
    expect((await ctx.result({ id: 'nao-existe-123', status: 'enviado' })).status).toBe(404);
    expect((await ctx.result({ id: overdue.id, status: 'talvez' })).status).toBe(400);

    ctx.setNow(new Date('2026-11-15T13:00:00Z'));
    // Dia seguinte: o usuario escreveu de novo, janela aberta.
    await ctx.whatsapp('mensagem/registrar', { mensagemId: 'dia2' });
    const next = (await ctx.pending()).body.mensagens;
    // Nada de "a vencer" repetido; a vencida que falhou volta, junto com a de ontem que venceu sem pagar.
    expect(next.map((m) => m.tipo)).toEqual(['overdue']);
    expect(next[0].texto).toContain('• Conta venc: R$ 30,00 (venceu em 10/11)');
    expect(next[0].texto).toContain('• Conta hoje: R$ 50,00 (venceu em 14/11)');
  });

  it('"parar alertas" revoga o consentimento com registro, mesmo sem Premium', async () => {
    const ctx = setup({ accessMode: 'entitlement' });
    const stop = await ctx.whatsapp('notificacoes/parar', {});
    expect(stop.status).toBe(200);
    expect(stop.body).toMatchObject({ parado: true, ja_estava: false });
    expect(stop.body.resposta_usuario).toContain('não vou mais enviar alertas');
    expect(await ctx.store.getNotificationSettings(UID)).toMatchObject({ whatsapp_consent: 'revoked', whatsapp_consent_source: 'whatsapp' });
    expect(ctx.store._consentEvents()).toEqual([expect.objectContaining({ uid: UID, action: 'revoked', source: 'whatsapp' })]);
    expect((await ctx.whatsapp('notificacoes/parar', {})).body.ja_estava).toBe(true);
    const es = await ctx.whatsapp('notificacoes/parar', {}, PHONE_ES);
    expect(es.body.resposta_usuario).toContain('ya estaban desactivadas');
    expect((await ctx.pending()).body.resumo.usuarios).toBe(0);
  });

  it('mensagem recebida atualiza a janela de 24h no vinculo', async () => {
    const ctx = setup({ lastInbound: '' });
    await ctx.whatsapp('mensagem/registrar', { mensagemId: 'abc123' });
    expect((await ctx.store.getActiveLinkByUid(UID)).last_inbound_at).toBe('2026-11-14T13:00:00.000Z');
  });

  it('rotas exigem chave e POST', async () => {
    const ctx = setup();
    const app = createApp({ store: ctx.store, resolver: createPhoneResolver(new Map(), { store: ctx.store }), apiKey: API_KEY, logger: { info() {}, error() {}, warn() {} } });
    expect((await app.handle({ method: 'POST', path: '/internal/notificacoes/pendentes', headers: {}, body: {} })).status).toBe(401);
    expect((await app.handle({ method: 'GET', path: '/internal/notificacoes/pendentes', headers: { 'x-api-key': API_KEY } })).status).toBe(405);
  });
});
