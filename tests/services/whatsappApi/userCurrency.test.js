import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../../../services/whatsapp-api/src/app.js';
import { createMemoryStore } from '../../../services/whatsapp-api/src/memoryStore.js';
import { createPhoneResolver, parsePhoneLinks } from '../../../services/whatsapp-api/src/phoneLinks.js';
import { formatMoney, parseAmount, runWithCurrency } from '../../../services/whatsapp-api/src/money.js';

const API_KEY = 'test-key-123';
const PHONE = '+34 637 210 215';
const UID = 'user-es';
const NOW = new Date('2026-11-13T12:00:00Z');

function setup(onboarding) {
  const store = createMemoryStore({
    [UID]: [{ id: 'r1', type: 'saida', description: 'Aluguel', amount: 1234.5, status: 'Em aberto', competence: '2026-11', due_date: '2026-11-30' }]
  }, { shared: [] });
  if (onboarding) store._setOnboarding(UID, onboarding);
  const resolver = createPhoneResolver(parsePhoneLinks(JSON.stringify([{ telefone: PHONE, uid: UID, chatwootAccountId: '3' }])));
  let counter = 0;
  const app = createApp({ store, resolver, apiKey: API_KEY, now: () => NOW, logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }, newId: () => `id-${++counter}` });
  return (route, body = {}) => app.handle({ method: 'POST', path: `/internal/whatsapp/${route}`, headers: { 'x-api-key': API_KEY }, body: { telefone: PHONE, accountId: 3, ...body } });
}

describe('whatsapp-api: moeda e idioma do usuario', () => {
  it('conta em euro recebe valores formatados em euro e as preferencias na resposta', async () => {
    const call = setup({ country: 'ES' });
    const res = await call('lancamentos', { competencia: '2026-11' });
    expect(res.status).toBe(200);
    expect(JSON.stringify(res.body)).toContain('1.234,50 €');
    expect(JSON.stringify(res.body)).not.toContain('R$');
    expect(res.body.preferencias).toEqual({ idioma: 'es-ES', moeda: 'EUR', fuso: 'Europe/Madrid' });
  });

  it('conta sem cadastro continua em reais; o idioma segue o DDI do numero (+34 = espanhol)', async () => {
    const call = setup(null);
    const res = await call('lancamentos', { competencia: '2026-11' });
    expect(JSON.stringify(res.body)).toContain('R$ 1.234,50');
    expect(res.body.preferencias).toEqual({ idioma: 'es-ES', moeda: 'BRL', fuso: 'America/Sao_Paulo' });
  });

  it('idioma do WhatsApp vem do DDI do numero vinculado, nunca de um idioma salvo', async () => {
    // Numero vinculado +34 vale mais que o +55 do cadastro e que um locale antigo salvo.
    const linked = setup({ country: 'BR', locale: 'pt-BR', whatsapp_phone: '+5592981327903' });
    expect((await linked('resumo')).body.preferencias.idioma).toBe('es-ES');
    // Conta +34 cadastrada: espanhol, mesmo com locale antigo pt-BR salvo.
    const es = setup({ country: 'BR', locale: 'pt-BR', whatsapp_phone: '+34637210215' });
    expect((await es('resumo')).body.preferencias.idioma).toBe('es-ES');
  });

  it('cadastro automatico devolve a frase de confirmacao pronta no idioma do numero', async () => {
    const call = setup({ country: 'ES' });
    const prepared = await call('acoes/preparar', { acao: 'registrar_despesa', dados: { descricao: 'Almuerzo', valor: '20' } });
    const confirmed = await call('acoes/confirmar', { confirmation_id: prepared.body.confirmation_id });
    expect(confirmed.body.resposta_usuario).toMatch(/^Apuntado: 20,00 € en Almuerzo/);
    expect(confirmed.body.resposta_usuario).not.toMatch(/Em aberto|Pago:|despesa/i);
    const due = await call('acoes/preparar', { acao: 'registrar_despesa', dados: { descricao: 'Cena', valor: '50', forma_pagamento: 'Tarjeta', vencimento: '2026-12-05' } });
    const dueConfirmed = await call('acoes/confirmar', { confirmation_id: due.body.confirmation_id });
    expect(dueConfirmed.body.resposta_usuario).toContain('Vence el 05/12/2026.');
  });

  it('formatacao isolada por requisicao e leitura de valores em euro', async () => {
    const [eur, brl] = await Promise.all([
      runWithCurrency('EUR', async () => { await new Promise((r) => setTimeout(r, 5)); return formatMoney(10); }),
      runWithCurrency('BRL', async () => formatMoney(10))
    ]);
    expect(eur).toBe('10,00 €');
    expect(brl).toBe('R$ 10,00');
    expect(formatMoney(10)).toBe('R$ 10,00');
    expect(parseAmount('12,50 €')).toBe(12.5);
    expect(parseAmount('EUR 7')).toBe(7);
  });
});

describe('whatsapp-api: frase de confirmacao em portugues', () => {
  it('numero +55 recebe a frase em portugues, sem status nem pagamento inventado', async () => {
    const { registrationConfirmation } = await import('../../../services/whatsapp-api/src/confirmationText.js');
    expect(registrationConfirmation({ tipo: 'despesa', descricao: 'Almoço', valor_formatado: 'R$ 20,00', categoria: 'Alimentação', status: 'Em aberto' }, 'pt-BR'))
      .toBe('Anotado: R$ 20,00 em Almoço (Alimentação).');
    expect(registrationConfirmation({ tipo: 'receita', descricao: 'Salário', valor_formatado: 'R$ 3.000,00', categoria: '', forma_pagamento: 'bank:mercado_pago', vencimento: '2026-12-05' }, 'pt-BR'))
      .toBe('Anotado: receita de R$ 3.000,00 em Salário. Pagamento: Mercado pago. Vence em 05/12/2026.');
  });
});
