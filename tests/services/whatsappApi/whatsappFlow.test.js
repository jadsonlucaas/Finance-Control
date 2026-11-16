import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../../../services/whatsapp-api/src/app.js';
import { createMemoryStore } from '../../../services/whatsapp-api/src/memoryStore.js';
import { createPhoneResolver, parsePhoneLinks } from '../../../services/whatsapp-api/src/phoneLinks.js';
import { hashLinkCode, normalizeLinkCode } from '../../../services/whatsapp-api/src/links.js';
import { DEFAULT_CATEGORIES } from '../../../services/whatsapp-api/src/references.js';
import { createN8nConversation, loadAgentFixture } from './n8nFlowHarness.js';

// Etapa 5, item 5: o fluxo do WhatsApp de ponta a ponta, do jeito que o n8n chama a API.
// A IA nao entra: o teste escolhe a ferramenta e os argumentos que o agente usaria.

const API_KEY = 'flow-key';
const UID = 'uid-flow';
const PHONE = '+34637210215';
const NOW = new Date('2026-11-16T15:00:00Z');
const fixture = loadAgentFixture();

function setup({ linked = true, accessMode = 'entitlement', comp = true, seedRecords } = {}) {
  const shared = DEFAULT_CATEGORIES.map((item, index) => ({ id: `cat_${index}`, type: 'categoria', category_name: item.nome, macro_category: item.macro }));
  const store = createMemoryStore({
    [UID]: seedRecords || [
      { id: 'luz', type: 'saida', description: 'Luz', amount: 300, category_name: 'Moradia', status: 'Em aberto', competence: '2026-11', due_date: '2026-11-18' },
      { id: 'velha', type: 'saida', description: 'Boleto esquecido', amount: 75, status: 'Em aberto', competence: '2024-06', due_date: '2024-06-10' },
      { id: 'salario', type: 'entrada', description: 'Salario', amount: 5000, status: 'Pago', competence: '2026-11' }
    ]
  }, { shared, profiles: { [UID]: { uid: UID, status: 'active' } } });
  if (comp) store._setComp(UID, { uid: UID, status: 'active' });
  const legacy = linked ? JSON.stringify([{ telefone: PHONE, uid: UID, chatwootAccountId: '3' }]) : '[]';
  let counter = 0;
  const app = createApp({
    store,
    resolver: createPhoneResolver(parsePhoneLinks(legacy), { store }),
    apiKey: API_KEY,
    accessMode,
    now: () => NOW,
    newId: () => `id-${++counter}`,
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
  });
  const chat = createN8nConversation({ app, apiKey: API_KEY, telefone: PHONE, fixture });
  const issueCode = (code) => store._putLinkCode(hashLinkCode(normalizeLinkCode(code)), {
    owner_uid: UID,
    status: 'pending',
    created_at: NOW.toISOString(),
    expires_at: new Date(NOW.getTime() + 10 * 60_000).toISOString()
  });
  const records = () => store._dump(UID).records.filter((record) => !record.archived);
  return { app, store, chat, issueCode, records };
}

describe('fluxo WhatsApp: contrato com o n8n', () => {
  it('toda ferramenta do agente aponta para uma rota permitida no n8n e existente na API', async () => {
    const { chat } = setup();
    const allowed = fixture.toolApi.validaEMontaPedido.match(/const ROTAS = \[([^\]]+)\]/)[1];
    expect(fixture.tools.length).toBeGreaterThanOrEqual(11);
    for (const tool of fixture.tools) {
      expect(allowed, `${tool.name} fora da lista ROTAS do n8n`).toContain(`'${tool.rota}'`);
      const result = await chat.tool(tool.name, tool.name === 'definir_orcamento' ? { valor: 100 } : {});
      // 404 de regra de negocio (ex.: nada pendente para cancelar) e valido; rota inexistente nao.
      expect(result.erro?.codigo, `${tool.name} -> ${tool.rota}`).not.toBe('NOT_FOUND');
      expect(result.statusCode, `${tool.name} -> ${tool.rota}`).not.toBe(500);
    }
  });

  it('campos vazios da IA sao removidos e telefone/conta nunca vem da IA', async () => {
    const { chat } = setup();
    const result = await chat.tool('listar_lancamentos', { competencia: '', telefone: '+5511999999999' });
    expect(result.ok).toBe(true);
    expect(result.request).toEqual({ limite: 20, telefone: PHONE, accountId: 3 });
    expect(chat.fromAiKeys('listar_lancamentos')).toEqual(['competencia', 'tipo', 'status', 'categoria', 'forma_pagamento', 'busca', 'limite']);
  });

  it('erro da API chega ao agente como { ok: false, erro } com a mensagem pronta', async () => {
    const { chat } = setup({ comp: false });
    const result = await chat.tool('resumo_financeiro_mes', { competencia: '2026-11' });
    expect(result).toMatchObject({ ok: false, statusCode: 403, erro: { codigo: 'WHATSAPP_ACCESS_REQUIRED' } });
    expect(result.erro.mensagem).toMatch(/Premium/);
  });
});

describe('fluxo WhatsApp: conversas', () => {
  it('mensagem repetida pelo Chatwoot nao roda o agente de novo', async () => {
    const { chat } = setup();
    expect((await chat.receive('resumo do mes', 501)).nova).toBe(true);
    expect((await chat.receive('resumo do mes', 501)).nova).toBe(false);
    expect((await chat.receive('o que vence', 502)).nova).toBe(true);
  });

  it('numero novo: sem vinculo -> codigo do app -> vinculado -> consulta', async () => {
    const { chat, issueCode } = setup({ linked: false });
    await chat.receive('oi', 600);
    expect((await chat.linkStatus()).vinculado).toBe(false);

    issueCode('K7QM3XPA');
    const message = await chat.receive('vincular K7QM-3XPA', 601);
    expect(message.isLinkCode).toBe(true);
    const confirmed = await chat.confirmLink();
    expect(confirmed.ok).toBe(true);

    await chat.receive('resumo do mes', 602);
    expect((await chat.linkStatus()).vinculado).toBe(true);
    const resumo = await chat.tool('resumo_financeiro_mes', { competencia: '2026-11' });
    expect(resumo.ok).toBe(true);
    expect(resumo.dados.quantidade.despesas).toBe(1);
  });

  it('sem Premium o fluxo para no "Vinculado?" com a mensagem de assinatura', async () => {
    const { chat } = setup({ comp: false });
    await chat.receive('resumo', 700);
    const status = await chat.linkStatus();
    expect(status.vinculado).toBe(false);
    expect(status.dados).toMatchObject({ motivo: 'WHATSAPP_ACCESS_REQUIRED' });
    expect(status.dados.mensagem).toMatch(/Premium/);
  });

  it('cadastro de despesa: opcoes -> preparar grava direto -> aparece na lista; repetir o "sim" nao duplica', async () => {
    const { chat, records } = setup();
    const opcoes = await chat.tool('opcoes_cadastro', {});
    expect(opcoes.ok).toBe(true);
    expect(opcoes.dados.categorias.length).toBeGreaterThan(5);

    const before = records().length;
    const saved = await chat.tool('preparar_acao', { acao: 'registrar_despesa', dados: { descricao: 'Padaria', valor: '12,50', categoria: 'alimentacao' } });
    expect(saved.ok).toBe(true);
    expect(saved.dados.resposta_usuario).toMatch(/Padaria/);
    expect(records()).toHaveLength(before + 1);

    // O agente as vezes chama confirmar depois de um cadastro: nao pode criar outro.
    const again = await chat.tool('confirmar_acao');
    expect(again.ok).toBe(true);
    expect(records()).toHaveLength(before + 1);

    const lista = await chat.tool('listar_lancamentos', { busca: 'padaria' });
    expect(lista.dados.lancamentos.map((item) => item.descricao)).toEqual(['Padaria']);
  });

  it('compra parcelada vira uma serie de parcelas', async () => {
    const { chat, records } = setup();
    const saved = await chat.tool('preparar_acao', { acao: 'registrar_despesa', dados: { descricao: 'Cama', parcelas: 3, valor_parcela: 290, dia_vencimento: 5 } });
    expect(saved.ok).toBe(true);
    const parcelas = records().filter((record) => record.description?.startsWith('Cama'));
    expect(parcelas).toHaveLength(3);
    expect(parcelas.every((record) => Number(record.total_installments) === 3)).toBe(true);
  });

  it('marcar pago pede "sim": preparar -> confirmar; cancelar desfaz a pendencia', async () => {
    const { chat, store } = setup();
    const prepared = await chat.tool('preparar_acao', { acao: 'marcar_pago', dados: { lancamento_id: 'luz' } });
    expect(prepared.dados.status).toBe('aguardando_confirmacao');
    expect(store._dump(UID).records.find((record) => record.id === 'luz').status).toBe('Em aberto');

    expect((await chat.tool('confirmar_acao')).ok).toBe(true);
    expect(store._dump(UID).records.find((record) => record.id === 'luz').status).toBe('Pago');

    await chat.tool('preparar_acao', { acao: 'excluir', dados: { lancamento_id: 'salario' } });
    expect((await chat.tool('cancelar_acao')).ok).toBe(true);
    const confirm = await chat.tool('confirmar_acao');
    expect(store._dump(UID).records.find((record) => record.id === 'salario').archived).not.toBe(true);
    expect(confirm.ok).toBe(true);
  });

  it('contas a vencer mostra a conta da semana e a atrasada antiga', async () => {
    const { chat } = setup();
    const result = await chat.tool('contas_a_vencer', { dias: 7 });
    expect(result.ok).toBe(true);
    expect(result.dados.a_vencer.itens.map((item) => item.id)).toEqual(['luz']);
    expect(result.dados.atrasadas.itens.map((item) => item.id)).toEqual(['velha']);
  });

  it('orcamento: definir e consultar devolvem resposta_usuario pronta', async () => {
    const { chat } = setup();
    const defined = await chat.tool('definir_orcamento', { categoria: 'moradia', valor: 1000 });
    expect(defined.ok).toBe(true);
    expect(defined.dados.resposta_usuario).toBeTruthy();
    const consulted = await chat.tool('consultar_orcamento', { categoria: 'moradia' });
    expect(consulted.ok).toBe(true);
    expect(consulted.dados.resposta_usuario).toBeTruthy();
  });

  it('parar alertas funciona mesmo sem Premium', async () => {
    const { chat } = setup({ comp: false });
    const result = await chat.tool('parar_alertas');
    expect(result.ok).toBe(true);
    expect(result.dados.resposta_usuario).toBeTruthy();
  });
});
