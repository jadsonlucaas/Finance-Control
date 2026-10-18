import { describe, expect, it } from 'vitest';
import {
  buildEditedSaidaPayload,
  buildEntradaPayload,
  buildInstallmentSaidaPayloads,
  buildRecurringSaidaPayloads,
  buildSaidaPayload,
  resolveEntradaClassification
} from '../../src/domain/recordPayloads.js';

const fixedNow = new Date('2026-04-17T10:00:00.000Z');

describe('record payload builders', () => {
  it('builds entrada payloads and classifies hour bank entries', () => {
    const hourExtraSnapshot = {
      nomeTipo: 'Banco teste',
      percentualUsado: 0,
      valorHoraCalculado: 0,
      valorTotalCalculado: 0,
      quantidadeHoras: 2.5,
      quantidadeHorasFormatada: '02:30',
      valorBaseHora: 0,
      tipoFinanceiroUsado: false,
      horaInicial: '08:00',
      horaFinal: '10:30'
    };

    expect(resolveEntradaClassification('Hora Extra', hourExtraSnapshot)).toMatchObject({
      isHourBank: true,
      macro: 'Banco de Horas',
      subcategory: 'Banco teste'
    });

    expect(buildEntradaPayload({
      person: 'Jadson',
      earningType: 'Hora Extra',
      amount: 0,
      competence: '2026-04',
      cycle: 'INICIO_MES',
      hourExtraSnapshot,
      now: fixedNow
    })).toMatchObject({
      type: 'entrada',
      person: 'Jadson',
      macro_category: 'Banco de Horas',
      subcategory: 'Banco teste',
      description: 'Banco teste • 02:30',
      competence: '2026-04',
      created_at: '2026-04-17T10:00:00.000Z',
      tipoFinanceiroUsado: false
    });
  });

  it('builds saida payloads with paid date only for paid records', () => {
    expect(buildSaidaPayload({
      person: 'Luana',
      macro: 'FIXO',
      subcategory: 'Moradia',
      description: 'Aluguel',
      amount: 1500,
      status: 'Pago',
      paymentMethod: 'Pix',
      occurredDate: '2026-04-01',
      dueDate: '2026-04-10',
      competence: '2026-04',
      paidAt: '2026-04-09',
      cycle: 'INICIO_MES',
      now: fixedNow
    })).toMatchObject({
      type: 'saida',
      person: 'Luana',
      macro_category: 'FIXO',
      subcategory: 'Moradia',
      amount: 1500,
      status: 'Pago',
      paid_at: '2026-04-09',
      created_at: '2026-04-17T10:00:00.000Z'
    });
  });

  it('preserves edit-only fields when building edited saida payloads', () => {
    const edited = buildEditedSaidaPayload({
      id: 'r1',
      created_at: '2026-01-01T00:00:00.000Z',
      category_id: 'cat-1',
      installment_no: 3,
      total_installments: 5
    }, {
      person: 'Jadson',
      macro: 'VARIAVEL',
      subcategory: 'Mercado',
      description: 'Compra editada',
      amount: 222.22,
      status: 'Em aberto',
      paidAt: '2026-04-17',
      recurrence: 'mensal'
    });

    expect(edited).toMatchObject({
      id: 'r1',
      created_at: '2026-01-01T00:00:00.000Z',
      category_id: 'cat-1',
      installment_no: 3,
      total_installments: 5,
      description: 'Compra editada',
      amount: 222.22,
      paid_at: ''
    });
  });

  it('builds installment payloads matching the legacy cadence', () => {
    const payloads = buildInstallmentSaidaPayloads({
      person: 'Jadson',
      macro: 'FIXO',
      subcategory: 'Seguro',
      description: 'Seguro anual',
      amount: 100,
      totalAmount: 300,
      installments: 3,
      status: 'Pago',
      paymentMethod: 'Cartao',
      occurredDate: '2026-04-01',
      baseDueDate: '2026-04-10',
      paidAt: '2026-04-10',
      cycle: 'INICIO_MES',
      parentId: 'p_1',
      now: fixedNow
    });

    expect(payloads.map((payload) => ({
      description: payload.description,
      amount: payload.amount,
      status: payload.status,
      due_date: payload.due_date,
      competence: payload.competence,
      paid_at: payload.paid_at,
      installment_no: payload.installment_no,
      total_installments: payload.total_installments
    }))).toEqual([
      { description: 'Seguro anual (1/3)', amount: 100, status: 'Pago', due_date: '2026-04-10', competence: '2026-04', paid_at: '2026-04-10', installment_no: 1, total_installments: 3 },
      { description: 'Seguro anual (2/3)', amount: 100, status: 'Em aberto', due_date: '2026-05-10', competence: '2026-05', paid_at: '', installment_no: 2, total_installments: 3 },
      { description: 'Seguro anual (3/3)', amount: 100, status: 'Em aberto', due_date: '2026-06-10', competence: '2026-06', paid_at: '', installment_no: 3, total_installments: 3 }
    ]);
  });

  it('builds installment payloads with exact cent reconciliation', () => {
    const payloads = buildInstallmentSaidaPayloads({
      description: 'Compra centavos',
      totalAmount: 100,
      installments: 3,
      baseDueDate: '2026-01-31',
      parentId: 'p_cents',
      now: fixedNow
    });

    expect(payloads.map((payload) => payload.amount)).toEqual([33.33, 33.33, 33.34]);
    expect(payloads.reduce((sum, payload) => sum + Math.round(payload.amount * 100), 0)).toBe(10000);
    expect(payloads.map((payload) => payload.due_date)).toEqual(['2026-01-31', '2026-02-28', '2026-03-31']);
  });

  it('builds recurring payloads with monthly or annual cadence', () => {
    const monthly = buildRecurringSaidaPayloads({
      person: 'Jadson',
      macro: 'FIXO',
      subcategory: 'Assinatura',
      description: 'Streaming',
      amount: 30,
      status: 'Em aberto',
      baseDueDate: '2026-04-05',
      recurrence: 'mensal',
      parentId: 'p_2',
      count: 2,
      now: fixedNow
    });
    const annual = buildRecurringSaidaPayloads({
      description: 'Anuidade',
      amount: 90,
      baseDueDate: '2026-04-05',
      recurrence: 'anual',
      count: 2,
      now: fixedNow
    });

    expect(monthly.map((payload) => payload.due_date)).toEqual(['2026-04-05', '2026-05-05']);
    expect(annual.map((payload) => payload.due_date)).toEqual(['2026-04-05', '2027-04-05']);
  });

  it('does not create annual recurrence without explicit termination', () => {
    const annual = buildRecurringSaidaPayloads({
      description: 'Anuidade',
      amount: 90,
      baseDueDate: '2026-04-05',
      recurrence: 'anual',
      now: fixedNow
    });

    expect(annual).toEqual([]);
  });
});
