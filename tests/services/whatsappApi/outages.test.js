import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../../../services/whatsapp-api/src/app.js';
import { createMemoryStore } from '../../../services/whatsapp-api/src/memoryStore.js';
import { createPhoneResolver, parsePhoneLinks } from '../../../services/whatsapp-api/src/phoneLinks.js';
import { withReadCache } from '../../../services/whatsapp-api/src/readCache.js';
import { classifyDependencyError } from '../../../services/whatsapp-api/src/errors.js';
import { DEFAULT_CATEGORIES } from '../../../services/whatsapp-api/src/references.js';
import { createN8nConversation } from './n8nFlowHarness.js';

// Etapa 5, item 6: o que acontece quando uma dependencia cai.
// Firestore fora e simulado com os erros reais do SDK (codigo gRPC 8, 14, 4) ou com uma leitura travada.

const API_KEY = 'outage-key';
const UID = 'uid-outage';
const PHONE = '+5592999990000';
const PHONE_ES = '+34600000009';

const quota = () => Object.assign(new Error('8 RESOURCE_EXHAUSTED: Quota exceeded.'), { code: 8 });
const unavailable = () => Object.assign(new Error('14 UNAVAILABLE: No connection established'), { code: 14 });

/** Firestore com defeito: cada metodo listado em `failing` lanca o erro (ou trava, com 'hang'). */
function faultyStore(base) {
  const failing = new Map();
  const proxy = new Proxy(base, {
    get(target, prop) {
      const value = target[prop];
      if (typeof value !== 'function' || !failing.has(prop)) return typeof value === 'function' ? value.bind(target) : value;
      return async () => {
        const fault = failing.get(prop);
        if (fault === 'hang') return new Promise(() => {});
        throw fault();
      };
    }
  });
  return {
    store: proxy,
    fail: (names, fault) => names.forEach((name) => failing.set(name, fault)),
    heal: () => failing.clear()
  };
}

const READS = ['listFinanceRecords', 'listReferenceRecords', 'listBudgets'];

function setup({ cache = false, nowMs = () => 0, readTimeoutMs = 10_000, phone = PHONE } = {}) {
  const shared = DEFAULT_CATEGORIES.map((item, index) => ({ id: `cat_${index}`, type: 'categoria', category_name: item.nome, macro_category: item.macro }));
  const base = createMemoryStore({
    [UID]: [{ id: 'luz', type: 'saida', description: 'Luz', amount: 300, status: 'Em aberto', competence: '2026-11', due_date: '2026-11-18' }]
  }, { shared, profiles: { [UID]: { uid: UID, status: 'active' } } });
  base._setComp(UID, { uid: UID, status: 'active' });
  const faults = faultyStore(base);
  const onStale = vi.fn();
  const store = cache ? withReadCache(faults.store, { ttlMs: 30_000, staleMs: 10 * 60_000, nowMs, onStale }) : faults.store;
  const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
  const links = JSON.stringify([{ telefone: phone, uid: UID, chatwootAccountId: '3' }]);
  let counter = 0;
  const app = createApp({
    store,
    resolver: createPhoneResolver(parsePhoneLinks(links), { store }),
    apiKey: API_KEY,
    accessMode: 'entitlement',
    now: () => new Date('2026-11-16T15:00:00Z'),
    newId: () => `id-${++counter}`,
    logger,
    readTimeoutMs
  });
  const chat = createN8nConversation({ app, apiKey: API_KEY, telefone: phone });
  const records = () => base._dump(UID).records;
  return { app, base, faults, chat, logger, onStale, records };
}

describe('indisponibilidade: classificacao dos erros', () => {
  it('reconhece cota, rede e prazo do Firestore; erro de programacao nao vira 503', () => {
    expect(classifyDependencyError(quota())).toBe('COTA_ESGOTADA');
    expect(classifyDependencyError(unavailable())).toBe('INDISPONIVEL');
    expect(classifyDependencyError(Object.assign(new Error('4 DEADLINE_EXCEEDED'), { code: 4 }))).toBe('TIMEOUT');
    expect(classifyDependencyError(Object.assign(new Error('connect ECONNREFUSED 10.0.0.1:443'), { code: 'ECONNREFUSED' }))).toBe('INDISPONIVEL');
    expect(classifyDependencyError(new Error('TIMEOUT'))).toBe('TIMEOUT');
    expect(classifyDependencyError(new TypeError('x is not a function'))).toBe('');
  });
});

describe('indisponibilidade: Firestore fora', () => {
  it('consulta sem cache: o agente recebe 503 com mensagem pronta (pt e es) e o log registra o motivo', async () => {
    const { chat, faults, logger } = setup();
    faults.fail(READS, quota);
    const result = await chat.tool('resumo_financeiro_mes', { competencia: '2026-11' });
    expect(result).toMatchObject({ ok: false, statusCode: 503, erro: { codigo: 'SERVICO_INDISPONIVEL', detalhes: { motivo: 'COTA_ESGOTADA' } } });
    expect(result.erro.mensagem).toMatch(/instabilidade/);
    expect(logger.warn.mock.calls.map(([line]) => JSON.parse(line).event)).toContain('dependency_unavailable');

    const es = setup({ phone: PHONE_ES });
    es.faults.fail(READS, unavailable);
    const resultEs = await es.chat.tool('contas_a_vencer', { dias: 7 });
    expect(resultEs.erro).toMatchObject({ codigo: 'SERVICO_INDISPONIVEL', detalhes: { motivo: 'INDISPONIVEL' } });
    expect(resultEs.erro.mensagem).toMatch(/Inténtalo/);
  });

  it('com leitura recente no cache, responde com ela por ate 10 minutos', async () => {
    let clock = 0;
    const { chat, faults, onStale } = setup({ cache: true, nowMs: () => clock });
    expect((await chat.tool('contas_a_vencer', { dias: 7 })).ok).toBe(true);

    clock = 5 * 60_000;
    faults.fail(READS, quota);
    const stale = await chat.tool('contas_a_vencer', { dias: 7 });
    expect(stale.ok).toBe(true);
    expect(stale.dados.a_vencer.itens.map((item) => item.id)).toEqual(['luz']);
    expect(onStale).toHaveBeenCalledWith(expect.objectContaining({ kind: 'records', motivo: 'COTA_ESGOTADA' }));

    clock = 20 * 60_000;
    const old = await chat.tool('contas_a_vencer', { dias: 7 });
    expect(old).toMatchObject({ ok: false, statusCode: 503 });
  });

  it('leitura travada vira 503 TIMEOUT antes do limite de 15 s do n8n', async () => {
    const { chat, faults } = setup({ readTimeoutMs: 30 });
    faults.fail(['listFinanceRecords'], 'hang');
    const result = await chat.tool('resumo_financeiro_mes', { competencia: '2026-11' });
    expect(result).toMatchObject({ ok: false, statusCode: 503, erro: { detalhes: { motivo: 'TIMEOUT' } } });
  });

  it('cadastro com o banco fora nao grava nada; quando volta, grava uma vez so', async () => {
    const { chat, faults, records } = setup();
    const before = records().length;
    faults.fail(['createRecord', 'createRecords', 'savePendingAction', 'reserveReceipt'], unavailable);
    const failed = await chat.tool('preparar_acao', { acao: 'registrar_despesa', dados: { descricao: 'Pao', valor: 5 } });
    expect(failed).toMatchObject({ ok: false, statusCode: 503 });
    expect(records()).toHaveLength(before);

    faults.heal();
    const saved = await chat.tool('preparar_acao', { acao: 'registrar_despesa', dados: { descricao: 'Pao', valor: 5 } });
    expect(saved.ok).toBe(true);
    expect(records().filter((record) => record.description === 'Pao')).toHaveLength(1);
  });

  it('registro da mensagem falhando nao derruba o atendimento (o n8n segue o fluxo)', async () => {
    const { chat, faults } = setup();
    faults.fail(['reserveInboundMessage'], unavailable);
    const received = await chat.receive('resumo do mes', 900);
    expect(received.response.status).toBe(503);
    expect(received.nova).toBe(true);
  });

  it('status do vinculo falhando: o n8n nao trata como "numero nao vinculado"', async () => {
    const { chat, faults } = setup();
    faults.fail(['getWhatsAppAccess', 'getLink', 'getUserProfile'], quota);
    await chat.receive('oi', 901);
    const status = await chat.linkStatus();
    expect(status.vinculado).toBe(false);
    // ok: false leva o n8n para "Não consegui verificar seu cadastro agora", nao para o pedido de vinculo.
    expect(status.ok).toBe(false);
  });

  it('erro desconhecido continua 500 INTERNAL_ERROR (nao mascarado como indisponibilidade)', async () => {
    const { chat, faults, logger } = setup();
    faults.fail(['listFinanceRecords'], () => new TypeError('boom'));
    const result = await chat.tool('resumo_financeiro_mes', { competencia: '2026-11' });
    expect(result).toMatchObject({ ok: false, statusCode: 500, erro: { codigo: 'INTERNAL_ERROR' } });
    expect(logger.error).toHaveBeenCalled();
  });
});
