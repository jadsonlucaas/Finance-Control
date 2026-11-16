import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../../../services/whatsapp-api/src/app.js';
import { createMemoryStore } from '../../../services/whatsapp-api/src/memoryStore.js';
import { createPhoneResolver, parsePhoneLinks } from '../../../services/whatsapp-api/src/phoneLinks.js';
import { DEFAULT_CATEGORIES } from '../../../services/whatsapp-api/src/references.js';
import { analyzeInstallmentSeries } from '../../../src/domain/installmentSeries.js';
import { validateFinanceRecord } from '../../../src/domain/records/index.js';

const API_KEY = 'test-key-123';
const PHONE = '+34 637 210 215';
const UID = 'user-a';

function setup({ now = new Date('2026-11-16T12:00:00Z'), prefs = null } = {}) {
  const shared = DEFAULT_CATEGORIES.map((item, index) => ({ id: `cat_${index}`, type: 'categoria', category_name: item.nome, macro_category: item.macro }));
  const store = createMemoryStore({ [UID]: [] }, { shared });
  if (prefs) store.getUserPreferences = async () => prefs;
  const resolver = createPhoneResolver(parsePhoneLinks(JSON.stringify([{ telefone: PHONE, uid: UID, chatwootAccountId: '3' }])));
  let counter = 0;
  const app = createApp({ store, resolver, apiKey: API_KEY, now: () => now, logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() }, newId: () => `id-${++counter}` });
  const call = (route, body) => app.handle({ method: 'POST', path: `/internal/whatsapp/${route}`, headers: { 'x-api-key': API_KEY }, body: { telefone: PHONE, accountId: 3, ...body } });
  const records = async () => (await store.listFinanceRecords(UID)).filter((record) => record.type === 'saida');
  return { store, call, records };
}

describe('whatsapp-api: compra parcelada', () => {
  it('cria 21 parcelas de 290 com vencimento todo dia 05, no formato da tela Parcelamentos', async () => {
    const { call, records } = setup();
    const response = await call('acoes/preparar', { acao: 'registrar_despesa', dados: { descricao: 'Cama', parcelas: 21, valor_parcela: 290, dia_vencimento: 5 } });
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('registrado');
    expect(response.body.resposta_usuario).toContain('21 cuotas de R$ 290,00');
    expect(response.body.resposta_usuario).toContain('total R$ 6.090,00');
    expect(response.body.resposta_usuario).toContain('05/12/2026');
    expect(response.body.resposta_usuario).toContain('05/08/2028');

    const saved = (await records()).sort((a, b) => a.installment_no - b.installment_no);
    expect(saved).toHaveLength(21);
    expect(saved.every((record) => record.amount === 290 && record.total_installments === 21 && record.is_installment === true)).toBe(true);
    expect(new Set(saved.map((record) => record.parent_id)).size).toBe(1);
    expect(saved[0]).toMatchObject({ installment_no: 1, due_date: '2026-12-05', competence: '2026-12', description: 'Cama (1/21)', purchase_name: 'Cama', status: 'Em aberto', source_channel: 'future_integration' });
    expect(saved[20]).toMatchObject({ installment_no: 21, due_date: '2028-08-05', competence: '2028-08' });
    saved.forEach((record) => expect(validateFinanceRecord(record).isValid).toBe(true));
    const analysis = analyzeInstallmentSeries(saved);
    expect(analysis.series[0].status).toBe('ok');
  });

  it('divide o valor total e joga o centavo de sobra na ultima parcela', async () => {
    const { call, records } = setup();
    const response = await call('acoes/preparar', { acao: 'registrar_despesa', dados: { descricao: 'Celular', parcelas: '3x', valor_total: '100', vencimento: '2026-11-20' } });
    expect(response.body.resposta_usuario).toContain('la última de R$ 33,34');
    const amounts = (await records()).sort((a, b) => a.installment_no - b.installment_no).map((record) => [record.amount, record.due_date]);
    expect(amounts).toEqual([[33.33, '2026-11-20'], [33.33, '2026-12-20'], [33.34, '2027-01-20']]);
  });

  it('dia de vencimento ainda por vir fica neste mes; sem dia, um mes depois da compra', async () => {
    const first = setup();
    await first.call('acoes/preparar', { acao: 'registrar_despesa', dados: { descricao: 'Sofa', parcelas: 2, valor_parcela: 10, dia_vencimento: 31 } });
    // Novembro nao tem dia 31: vai para o proximo dia 31 de verdade.
    expect((await first.records()).map((record) => record.due_date).sort()).toEqual(['2026-12-31', '2027-01-31']);
    const second = setup();
    await second.call('acoes/preparar', { acao: 'registrar_despesa', dados: { descricao: 'Mesa', parcelas: 2, valor_parcela: 10, dia_vencimento: 20 } });
    expect((await second.records()).map((record) => record.due_date).sort()).toEqual(['2026-11-20', '2026-12-20']);
    const third = setup();
    await third.call('acoes/preparar', { acao: 'registrar_despesa', dados: { descricao: 'Cadeira', parcelas: 2, valor_parcela: 10 } });
    expect((await third.records()).map((record) => record.due_date).sort()).toEqual(['2026-12-16', '2027-01-16']);
  });

  it('exige valor_parcela ou valor_total e quantidade valida', async () => {
    const { call, records } = setup();
    expect((await call('acoes/preparar', { acao: 'registrar_despesa', dados: { descricao: 'Cama', parcelas: 21, valor: 290 } })).body.erro.codigo).toBe('INSTALLMENT_AMOUNT_REQUIRED');
    expect((await call('acoes/preparar', { acao: 'registrar_despesa', dados: { descricao: 'Cama', parcelas: 21, valor_parcela: 290, valor_total: 6090 } })).body.erro.codigo).toBe('INSTALLMENT_AMOUNT_REQUIRED');
    expect((await call('acoes/preparar', { acao: 'registrar_despesa', dados: { descricao: 'Cama', parcelas: 1, valor_parcela: 290 } })).body.erro.codigo).toBe('INVALID_INSTALLMENTS');
    expect((await call('acoes/preparar', { acao: 'registrar_despesa', dados: { descricao: 'Cama', parcelas: 500, valor_parcela: 290 } })).body.erro.codigo).toBe('INVALID_INSTALLMENTS');
    expect((await call('acoes/preparar', { acao: 'registrar_despesa', dados: { descricao: 'Cama', parcelas: 3, valor_parcela: 290, dia_vencimento: 40 } })).body.erro.codigo).toBe('INVALID_DUE_DAY');
    expect((await call('acoes/preparar', { acao: 'registrar_receita', dados: { descricao: 'X', valor: 10, parcelas: 3 } })).body.erro.codigo).toBe('INSTALLMENTS_ONLY_FOR_EXPENSES');
    expect(await records()).toHaveLength(0);
  });

  it('confirmar de novo nao duplica as parcelas', async () => {
    const { call, records } = setup();
    const prepared = await call('acoes/preparar', { duas_etapas: true, acao: 'registrar_despesa', dados: { descricao: 'TV', parcelas: 10, valor_total: '3.000,00' } });
    expect(prepared.body.status).toBe('aguardando_confirmacao');
    expect(prepared.body.resumo).toContain('10x');
    const first = await call('acoes/confirmar', { confirmation_id: prepared.body.confirmation_id });
    expect(first.body.parcelamento).toMatchObject({ parcelas: 10, valor_total: 3000, valor_parcela: 300 });
    const again = await call('acoes/confirmar', { confirmation_id: prepared.body.confirmation_id });
    expect(again.body.status).toBe('ja_executado');
    expect(await records()).toHaveLength(10);
  });
});

describe('installmentConfirmation', () => {
  it('monta a frase em portugues', async () => {
    const { installmentConfirmation } = await import('../../../services/whatsapp-api/src/confirmationText.js');
    const text = installmentConfirmation({ descricao: 'Cama (1/21)', categoria: 'Habitação' }, { parcelas: 21, valor_parcela: 290, ultima_parcela: 290, valor_total: 6090, primeiro_vencimento: '2026-12-05', ultimo_vencimento: '2028-08-05' }, 'pt-BR');
    expect(text).toBe('Anotado: Cama (Habitação) em 21x de R$ 290,00, total R$ 6.090,00. 1ª parcela vence em 05/12/2026 e a última em 05/08/2028.');
  });
});
