import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../../../services/whatsapp-api/src/app.js';
import { createMemoryStore } from '../../../services/whatsapp-api/src/memoryStore.js';
import { createPhoneResolver, hashPhone, normalizePhone, parsePhoneLinks } from '../../../services/whatsapp-api/src/phoneLinks.js';
import { parseAmount } from '../../../services/whatsapp-api/src/money.js';
import { DEFAULT_CATEGORIES } from '../../../services/whatsapp-api/src/references.js';

const API_KEY = 'test-key-123';
const PHONE = '+34 637 210 215';
const UID = 'user-a';
const OTHER_UID = 'user-b';
const NOW = new Date('2026-11-05T15:00:00Z');

function seed() {
  return {
    [UID]: [
      { id: 'r1', type: 'saida', description: 'Aluguel', amount: 2000, category_name: 'Moradia', payment_method: 'Cartão Nubank', status: 'Pago', competence: '2026-11', due_date: '2026-11-05', paid_at: '2026-11-04', updated_at: '2026-11-01T10:00:00.000Z' },
      { id: 'r2', type: 'saida', description: 'Internet', amount: 120.5, category_name: 'Moradia', status: 'Em aberto', competence: '2026-11', due_date: '2026-11-03', updated_at: '2026-11-01T10:00:00.000Z' },
      { id: 'r3', type: 'saida', description: 'Mercado', amount: 450.25, category_name: 'Alimentacao', status: 'Em aberto', competence: '2026-11', due_date: '2026-11-10', updated_at: '2026-11-01T10:00:00.000Z' },
      { id: 'r4', type: 'saida', description: 'Academia', amount: 99.9, category_name: 'Saude', status: 'Cancelado', competence: '2026-11' },
      { id: 'r5', type: 'saida', description: 'Antiga', amount: 50, status: 'Pago', competence: '2026-11', archived: true },
      { id: 'r6', type: 'entrada', description: 'Salario', amount: 5000, liquido: 5000, status: 'Pago', competence: '2026-11', updated_at: '2026-11-01T10:00:00.000Z' },
      { id: 'r7', type: 'entrada', description: 'Freela', amount: 800, status: 'Pendente', competence: '2026-11', updated_at: '2026-11-01T10:00:00.000Z' },
      { id: 'r8', type: 'saida', description: 'Luz', amount: 300, category_name: 'Moradia', status: 'Pago', competence: '2026-10', due_date: '2026-10-10' },
      { id: 'r9', type: 'categoria', category_name: 'Moradia' }
    ],
    [OTHER_UID]: [
      { id: 'x1', type: 'saida', description: 'Segredo', amount: 9999, status: 'Pago', competence: '2026-11' }
    ]
  };
}

function setup({ links } = {}) {
  const shared = DEFAULT_CATEGORIES.map((item, index) => ({ id: `cat_${index}`, type: 'categoria', category_name: item.nome, macro_category: item.macro }));
  const store = createMemoryStore(seed(), { shared });
  const resolver = createPhoneResolver(parsePhoneLinks(links ?? JSON.stringify([{ telefone: PHONE, uid: UID, chatwootAccountId: '3' }])));
  const logger = { info: vi.fn(), error: vi.fn(), warn: vi.fn() };
  let counter = 0;
  const app = createApp({ store, resolver, apiKey: API_KEY, now: () => NOW, logger, newId: () => `id-${++counter}` });
  const call = (route, body, headers = { 'x-api-key': API_KEY }) =>
    app.handle({ method: 'POST', path: `/internal/whatsapp/${route}`, headers, body: { telefone: PHONE, accountId: 3, ...body } });
  return { store, app, call, logger };
}

describe('whatsapp-api: autenticacao e vinculo', () => {
  it('rejeita chamada sem chave ou com chave errada', async () => {
    const { call } = setup();
    expect((await call('resumo', {}, {})).status).toBe(401);
    expect((await call('resumo', {}, { 'x-api-key': 'errada' })).status).toBe(401);
    expect((await call('resumo', {}, { authorization: `Bearer ${API_KEY}` })).status).toBe(200);
  });

  it('rejeita telefone nao vinculado e conta de atendimento diferente', async () => {
    const { call } = setup();
    const unknown = await call('resumo', { telefone: '+5511999999999' });
    expect(unknown.status).toBe(403);
    expect(unknown.body.erro.codigo).toBe('PHONE_NOT_LINKED');
    const mismatch = await call('resumo', { accountId: 9 });
    expect(mismatch.status).toBe(403);
    expect(mismatch.body.erro.codigo).toBe('ACCOUNT_MISMATCH');
  });

  it('normaliza telefones e valida a configuracao', () => {
    expect(normalizePhone('+34 637-210-215')).toBe('+34637210215');
    expect(normalizePhone('123')).toBe('');
    expect(parsePhoneLinks('{"+34637210215":"u1"}').get('+34637210215').uid).toBe('u1');
    expect(() => parsePhoneLinks('nao-json')).toThrow();
    expect(() => parsePhoneLinks('[{"telefone":"+34637210215"}]')).toThrow();
    expect(() => parsePhoneLinks('{"+34637210215":"a","34637210215":"b"}')).toThrow(/duplicado/);
  });

  it('nao registra telefone, corpo nem valores no log', async () => {
    const { call, logger } = setup();
    await call('resumo', { competencia: '2026-11' });
    const logged = logger.info.mock.calls.map((args) => args.join(' ')).join('\n');
    expect(logged).not.toMatch(/637/);
    expect(logged).not.toMatch(/2000|5000|R\$/);
    expect(logged).toContain(hashPhone(PHONE));
  });

  it('responde health sem autenticacao e 404 para rota desconhecida', async () => {
    const { app } = setup();
    expect((await app.handle({ method: 'GET', path: '/health', headers: {} })).status).toBe(200);
    const res = await app.handle({ method: 'POST', path: '/internal/whatsapp/nada', headers: { 'x-api-key': API_KEY }, body: { telefone: PHONE, accountId: 3 } });
    expect(res.status).toBe(404);
  });
});

describe('whatsapp-api: leitura', () => {
  it('mantem o contrato da API readonly em /despesas', async () => {
    const { call } = setup();
    const res = await call('despesas', { competencia: '2026-11' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ competencia: '2026-11', totalDespesas: 2570.75, despesasPagas: 2000, quantidadeDespesas: 3, quantidadePagas: 1 });
  });

  it('calcula resumo com receitas, despesas e saldo sem cancelados nem arquivados', async () => {
    const { call } = setup();
    const res = await call('resumo', { competencia: '2026-11' });
    expect(res.body).toMatchObject({
      total_despesas: 2570.75,
      despesas_pagas: 2000,
      despesas_em_aberto: 570.75,
      total_receitas: 5800,
      receitas_recebidas: 5000,
      receitas_pendentes: 800,
      saldo_realizado: 3000,
      saldo_previsto: 3229.25
    });
    expect(res.body.formatado.despesas_em_aberto).toBe('R$ 570,75');
  });

  it('usa a competencia atual quando nao informada e valida o formato', async () => {
    const { call } = setup();
    expect((await call('despesas', {})).body.competencia).toBe('2026-11');
    expect((await call('despesas', { competencia: '11/2026' })).status).toBe(400);
  });

  it('lista lancamentos com filtros e nunca devolve dados de outro usuario', async () => {
    const { call } = setup();
    const all = await call('lancamentos', {});
    expect(all.body.lancamentos.map((item) => item.id)).not.toContain('x1');
    expect(all.body.lancamentos.map((item) => item.id)).not.toContain('r5');
    const open = await call('lancamentos', { competencia: '2026-11', tipo: 'despesa', status: 'em aberto' });
    expect(open.body.lancamentos.map((item) => item.id).sort()).toEqual(['r2', 'r3']);
    expect(open.body.valor_total).toBe(570.75);
    const byCategory = await call('lancamentos', { categoria: 'moradia' });
    expect(byCategory.body.quantidade_encontrada).toBe(3);
    const search = await call('lancamentos', { busca: 'mércado' });
    expect(search.body.lancamentos[0].descricao).toBe('Mercado');
    const limited = await call('lancamentos', { limite: 2 });
    expect(limited.body.lancamentos).toHaveLength(2);
    expect(limited.body.truncado).toBe(true);
    expect((await call('lancamentos', { tipo: 'outro' })).status).toBe(400);
  });

  it('calcula resumo e categorias de um periodo de varios meses', async () => {
    const { call } = setup();
    const resumo = await call('resumo', { competencia_inicio: '2026-10', competencia_fim: '2026-11' });
    expect(resumo.status).toBe(200);
    expect(resumo.body.periodo).toMatchObject({ inicio: '2026-10', fim: '2026-11', quantidade_meses: 2 });
    expect(resumo.body.total_despesas).toBe(2870.75);
    expect(resumo.body.despesas_pagas).toBe(2300);
    expect(resumo.body.por_mes.map((item) => [item.competencia, item.total_despesas])).toEqual([['2026-10', 300], ['2026-11', 2570.75]]);
    expect(resumo.body.formatado.total_despesas).toBe('R$ 2.870,75');

    const categorias = await call('categorias', { competencia_inicio: '2026-10', competencia_fim: '2026-11' });
    expect(categorias.body.periodo.meses).toEqual(['2026-10', '2026-11']);
    expect(categorias.body.total_despesas).toBe(2870.75);
    expect(categorias.body.categorias[0]).toMatchObject({ categoria: 'Moradia', total: 2420.5, quantidade: 3 });
  });

  it('usa o mes atual como fim do periodo e valida limites', async () => {
    const { call } = setup();
    const open = await call('resumo', { competencia_inicio: '2025-12' });
    expect(open.body.periodo).toMatchObject({ inicio: '2025-12', fim: '2026-11', quantidade_meses: 12 });
    expect(open.body.total_despesas).toBe(2870.75);
    expect((await call('resumo', { competencia_inicio: '2026-11', competencia_fim: '2026-10' })).status).toBe(400);
    expect((await call('categorias', { competencia_inicio: '2024-01', competencia_fim: '2026-11' })).status).toBe(400);
    expect((await call('resumo', { competencia_inicio: '10/2026' })).status).toBe(400);
    const single = await call('resumo', { competencia_inicio: '2026-11', competencia_fim: '2026-11' });
    expect(single.body.competencia).toBe('2026-11');
    expect(single.body.por_mes).toBeUndefined();
  });

  it('agrupa despesas por categoria', async () => {
    const { call } = setup();
    const res = await call('categorias', { competencia: '2026-11' });
    expect(res.body.categorias[0]).toMatchObject({ categoria: 'Moradia', total: 2120.5, pago: 2000, em_aberto: 120.5, quantidade: 2 });
  });

  it('separa contas atrasadas e a vencer', async () => {
    const { call } = setup();
    const res = await call('vencimentos', { dias: 3 });
    expect(res.body.hoje).toBe('2026-11-05');
    expect(res.body.atrasadas.itens.map((item) => item.id)).toEqual(['r2']);
    expect(res.body.a_vencer.itens.map((item) => item.id)).toEqual([]);
    const longer = await call('vencimentos', { dias: 7 });
    expect(longer.body.a_vencer.itens.map((item) => item.id)).toEqual(['r3']);
    expect((await call('vencimentos', { dias: 365 })).status).toBe(400);
  });
});

describe('whatsapp-api: escrita com confirmacao', () => {
  it('registra despesa somente apos confirmar e com metadados de integracao', async () => {
    const { call, store } = setup();
    const prepared = await call('acoes/preparar', { acao: 'registrar_despesa', dados: { descricao: 'Farmacia', valor: '1.234,56', categoria: 'cuidados pessoais', forma_pagamento: 'cartao nubank', vencimento: '2026-11-20' } });
    expect(prepared.status).toBe(200);
    expect(prepared.body.status).toBe('aguardando_confirmacao');
    expect(prepared.body.resumo).toContain('R$ 1.234,56');
    expect(store._dump(UID).records).toHaveLength(9);

    const confirmed = await call('acoes/confirmar', { confirmation_id: prepared.body.confirmation_id });
    expect(confirmed.status).toBe(200);
    expect(confirmed.body.status).toBe('executado');
    const created = store._dump(UID).records.find((record) => record.description === 'Farmacia');
    expect(created).toMatchObject({
      type: 'saida', amount: 1234.56, status: 'Em aberto', competence: '2026-11', due_date: '2026-11-20',
      category_name: 'Cuidados pessoais', macro_category: 'VARIAVEL', payment_method: 'Cartão Nubank',
      owner_uid: UID, source_channel: 'future_integration', created_by_type: 'integration', archived: false
    });
    expect(created).not.toHaveProperty('telefone');
    expect(created).not.toHaveProperty('phone');
    const audit = store._dump(UID).audit;
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({ actor_type: 'integration', result_status: 'success', operation: 'create', source_channel: 'future_integration' });
    expect(JSON.stringify(audit[0])).not.toMatch(/637/);
  });

  it('e idempotente: confirmar duas vezes cria um unico lancamento', async () => {
    const { call, store } = setup();
    const prepared = await call('acoes/preparar', { acao: 'registrar_receita', dados: { descricao: 'Bonus', valor: 300 } });
    const first = await call('acoes/confirmar', { confirmation_id: prepared.body.confirmation_id });
    const second = await call('acoes/confirmar', { confirmation_id: prepared.body.confirmation_id });
    expect(first.body.status).toBe('executado');
    expect(second.body.status).toBe('ja_executado');
    expect(second.body.lancamento.id).toBe(first.body.lancamento.id);
    const bonus = store._dump(UID).records.filter((record) => record.description === 'Bonus');
    expect(bonus).toHaveLength(1);
    expect(bonus[0]).toMatchObject({ type: 'entrada', amount: 300, liquido: 300, status: 'Pago' });
  });

  it('marca como pago, edita e arquiva (exclusao reversivel)', async () => {
    const { call, store } = setup();
    const pay = await call('acoes/preparar', { acao: 'marcar_pago', dados: { lancamento_id: 'r2' } });
    await call('acoes/confirmar', { confirmation_id: pay.body.confirmation_id });
    expect(await store.getRecord(UID, 'r2')).toMatchObject({ status: 'Pago', paid_at: '2026-11-05' });

    const edit = await call('acoes/preparar', { acao: 'editar', dados: { lancamento_id: 'r3', alteracoes: { valor: 500, categoria: 'alimentacao' } } });
    expect(edit.status).toBe(200);
    await call('acoes/confirmar', { confirmation_id: edit.body.confirmation_id });
    expect(await store.getRecord(UID, 'r3')).toMatchObject({ amount: 500, category_name: 'Alimentação', macro_category: 'VARIAVEL' });

    const del = await call('acoes/preparar', { acao: 'excluir', dados: { lancamento_id: 'r3' } });
    await call('acoes/confirmar', { confirmation_id: del.body.confirmation_id });
    const archived = await store.getRecord(UID, 'r3');
    expect(archived.archived).toBe(true);
    expect(archived.amount).toBe(500);
  });

  it('nao permite agir sobre lancamento de outro usuario', async () => {
    const { call, store } = setup();
    const res = await call('acoes/preparar', { acao: 'marcar_pago', dados: { lancamento_id: 'x1' } });
    expect(res.status).toBe(404);
    expect((await store.getRecord(OTHER_UID, 'x1')).status).toBe('Pago');
  });

  it('nao confirma acao preparada por outro usuario', async () => {
    const links = JSON.stringify([{ telefone: PHONE, uid: UID }, { telefone: '+5511988887777', uid: OTHER_UID }]);
    const { call } = setup({ links });
    const prepared = await call('acoes/preparar', { acao: 'registrar_despesa', dados: { descricao: 'Teste', valor: 10, categoria: 'Outros' } });
    const res = await call('acoes/confirmar', { telefone: '+5511988887777', confirmation_id: prepared.body.confirmation_id });
    expect(res.status).toBe(404);
  });

  it('detecta conflito quando o lancamento mudou depois do resumo', async () => {
    const { call, store } = setup();
    const prepared = await call('acoes/preparar', { acao: 'marcar_pago', dados: { lancamento_id: 'r3' } });
    await store.updateRecord(UID, 'r3', { amount: 999, updated_at: '2026-11-05T14:59:00.000Z' });
    const res = await call('acoes/confirmar', { confirmation_id: prepared.body.confirmation_id });
    expect(res.status).toBe(409);
    expect(res.body.erro.codigo).toBe('RECORD_CHANGED');
    expect((await store.getRecord(UID, 'r3')).status).toBe('Em aberto');
    expect(store._dump(UID).audit[0]).toMatchObject({ result_status: 'conflict' });
  });

  it('expira confirmacoes antigas e permite cancelar', async () => {
    const shared = DEFAULT_CATEGORIES.map((item, index) => ({ id: `cat_${index}`, type: 'categoria', category_name: item.nome, macro_category: item.macro }));
  const store = createMemoryStore(seed(), { shared });
    const resolver = createPhoneResolver(parsePhoneLinks(JSON.stringify({ [PHONE]: UID })));
    let current = NOW;
    const app = createApp({ store, resolver, apiKey: API_KEY, now: () => current, logger: { info() {}, error() {}, warn() {} } });
    const call = (route, body) => app.handle({ method: 'POST', path: `/internal/whatsapp/${route}`, headers: { 'x-api-key': API_KEY }, body: { telefone: PHONE, ...body } });

    const prepared = await call('acoes/preparar', { acao: 'registrar_despesa', dados: { descricao: 'Velha', valor: 10, categoria: 'Outros' } });
    current = new Date(NOW.getTime() + 11 * 60 * 1000);
    expect((await call('acoes/confirmar', { confirmation_id: prepared.body.confirmation_id })).status).toBe(410);

    current = NOW;
    const other = await call('acoes/preparar', { acao: 'registrar_despesa', dados: { descricao: 'Cancelar', valor: 10, categoria: 'Outros' } });
    expect((await call('acoes/cancelar', { confirmation_id: other.body.confirmation_id })).body.status).toBe('cancelado');
    expect((await call('acoes/confirmar', { confirmation_id: other.body.confirmation_id })).status).toBe(409);
    expect(store._dump(UID).records.some((record) => record.description === 'Cancelar')).toBe(false);
  });

  it('valida entradas da IA antes de preparar', async () => {
    const { call } = setup();
    expect((await call('acoes/preparar', { acao: 'apagar_tudo' })).status).toBe(400);
    expect((await call('acoes/preparar', { acao: 'registrar_despesa', dados: { valor: 10 } })).body.erro.codigo).toBe('DESCRIPTION_REQUIRED');
    expect((await call('acoes/preparar', { acao: 'registrar_despesa', dados: { descricao: 'X', valor: -5 } })).body.erro.codigo).toBe('INVALID_AMOUNT');
    expect((await call('acoes/preparar', { acao: 'registrar_despesa', dados: { descricao: 'X', valor: 5, vencimento: '2026-02-30' } })).body.erro.codigo).toBe('INVALID_DATE');
    expect((await call('acoes/preparar', { acao: 'editar', dados: { lancamento_id: 'r3', alteracoes: { owner_uid: 'hack' } } })).body.erro.codigo).toBe('FIELD_NOT_EDITABLE');
    expect((await call('acoes/preparar', { acao: 'editar', dados: { lancamento_id: 'r3', alteracoes: { status: 'Qualquer' } } })).status).toBe(422);
    expect((await call('acoes/preparar', { acao: 'marcar_pago', dados: { lancamento_id: 'r1' } })).body.erro.codigo).toBe('ALREADY_PAID');
  });

  it('confirma a acao pendente mais recente quando nao recebe confirmation_id', async () => {
    const { call, store } = setup();
    await call('acoes/preparar', { acao: 'registrar_despesa', dados: { descricao: 'Primeira', valor: 10, categoria: 'Outros' } });
    const second = await call('acoes/preparar', { acao: 'registrar_despesa', dados: { descricao: 'Segunda', valor: 20, categoria: 'Outros' } });
    const confirmed = await call('acoes/confirmar', {});
    expect(confirmed.status).toBe(200);
    expect(confirmed.body.lancamento.descricao).toBe('Segunda');
    expect(store._dump(UID).pending.find((item) => item.id === second.body.confirmation_id).status).toBe('executed');
    expect(store._dump(UID).records.some((record) => record.description === 'Primeira')).toBe(false);
    expect(store._dump(UID).pending.find((item) => item.status === 'cancelled')).toBeTruthy();
    await call('acoes/preparar', { acao: 'registrar_despesa', dados: { descricao: 'Terceira', valor: 30, categoria: 'Outros' } });
    const cancelled = await call('acoes/cancelar', { confirmation_id: 'ultima' });
    expect(cancelled.body.status).toBe('cancelado');
    expect((await call('acoes/confirmar', {})).status).toBe(404);
  });

  it('exige categoria cadastrada em despesas e preenche a macro pela categoria', async () => {
    const { call } = setup();
    const missing = await call('acoes/preparar', { acao: 'registrar_despesa', dados: { descricao: 'X', valor: 5 } });
    expect(missing.body.erro.codigo).toBe('CATEGORY_REQUIRED');
    const unknown = await call('acoes/preparar', { acao: 'registrar_despesa', dados: { descricao: 'X', valor: 5, categoria: 'Inexistente' } });
    expect(unknown.body.erro.codigo).toBe('CATEGORY_NOT_FOUND');
    expect(unknown.body.erro.mensagem).toContain('Transporte');
    const mismatch = await call('acoes/preparar', { acao: 'registrar_despesa', dados: { descricao: 'X', valor: 5, categoria: 'Lazer', macro_categoria: 'FIXO' } });
    expect(mismatch.body.erro.codigo).toBe('CATEGORY_MACRO_MISMATCH');
    const ok = await call('acoes/preparar', { acao: 'registrar_despesa', dados: { descricao: 'Cinema', valor: 30, categoria: 'lazer', forma_pagamento: 'Pix' } });
    expect(ok.status).toBe(200);
    expect(ok.body.resumo).toContain('categoria Lazer (VARIAVEL)');
    expect(ok.body.resumo).toContain('pagamento Pix');
    const receita = await call('acoes/preparar', { acao: 'registrar_receita', dados: { descricao: 'Venda', valor: 50 } });
    expect(receita.status).toBe(200);
  });

  it('lista opcoes de macro, categoria e forma de pagamento', async () => {
    const { call } = setup();
    const res = await call('opcoes', {});
    expect(res.status).toBe(200);
    expect(res.body.macros.slice(0, 3)).toEqual(['FIXO', 'VARIAVEL', 'RESERVA']);
    expect(res.body.categorias).toContainEqual({ nome: 'Transporte', macro: 'FIXO' });
    expect(res.body.categorias.map((item) => item.nome)).toContain('Moradia');
    expect(res.body.formas_pagamento).toEqual(['Cartão Nubank']);
    const fixed = await call('opcoes', { macro: 'fixo' });
    expect(fixed.body.categorias.every((item) => item.macro === 'FIXO')).toBe(true);
    const byPayment = await call('lancamentos', { forma_pagamento: 'nubank' });
    expect(byPayment.body.lancamentos.map((item) => item.id)).toEqual(['r1']);
  });

  it('interpreta valores em formato brasileiro', () => {
    expect(parseAmount('150')).toBe(150);
    expect(parseAmount('150,9')).toBe(150.9);
    expect(parseAmount('R$ 1.234,56')).toBe(1234.56);
    expect(parseAmount('1.234')).toBe(1234);
    expect(parseAmount('12.5')).toBe(12.5);
    expect(Number.isNaN(parseAmount('1,234.56'))).toBe(true);
    expect(Number.isNaN(parseAmount('abc'))).toBe(true);
  });
});
