import { describe, expect, it } from 'vitest';
import { validateEntradaForm, validateSaidaForm } from '../../src/ui/records/recordFormValidation.js';

describe('record form validation', () => {
  it('keeps legacy validation order for entrada hour extra', () => {
    expect(validateEntradaForm({ formCycle: '' })).toBe('Selecione o ciclo');
    expect(validateEntradaForm({
      formCycle: 'INICIO_MES',
      isHourExtra: true,
      hourExtraInput: { selectedType: null }
    })).toBe('Selecione um tipo de H.E. ativo');
    expect(validateEntradaForm({
      formCycle: 'INICIO_MES',
      isHourExtra: true,
      hourExtraInput: { selectedType: { active: true }, quantidadeHoras: 0 }
    })).toBe('Informe a quantidade de horas');
    expect(validateEntradaForm({
      formCycle: 'INICIO_MES',
      isHourExtra: true,
      hourExtraInput: { selectedType: { active: true }, quantidadeHoras: 1, valorBaseHora: 0 }
    })).toBe('Informe o valor base da hora');
    expect(validateEntradaForm({
      formCycle: 'INICIO_MES',
      isHourExtra: true,
      hourExtraInput: { selectedType: { active: true }, quantidadeHoras: 1, valorBaseHora: 10, horaInicial: '08:00', horaFinal: '' }
    })).toBe('Preencha hora inicial e final juntas');
  });

  it('validates entrada amounts and time ranges', () => {
    const parseTimeToMinutes = (value) => {
      if (!value) return null;
      const [hour, minute] = value.split(':').map(Number);
      return hour * 60 + minute;
    };

    expect(validateEntradaForm({
      formCycle: 'INICIO_MES',
      isHourExtra: true,
      amount: 100,
      hourExtraSnapshot: { tipoFinanceiroUsado: true },
      hourExtraInput: {
        selectedType: { active: true },
        quantidadeHoras: 1,
        valorBaseHora: 10,
        horaInicial: '10:00',
        horaFinal: '09:00'
      }
    }, { parseTimeToMinutes })).toBe('A hora final deve ser maior que a inicial');

    expect(validateEntradaForm({
      formCycle: 'INICIO_MES',
      isHourExtra: false,
      amount: 0
    })).toBe('Informe um valor válido');

    expect(validateEntradaForm({
      formCycle: 'INICIO_MES',
      isHourExtra: true,
      amount: 0,
      hourExtraSnapshot: { tipoFinanceiroUsado: false },
      hourExtraInput: {
        selectedType: { active: true },
        quantidadeHoras: 1,
        valorBaseHora: 10
      }
    })).toBe('');
  });

  it('validates saida amount and paid date', () => {
    expect(validateSaidaForm({ amount: 0 })).toBe('Informe um valor válido');
    expect(validateSaidaForm({ amount: 10, status: 'Pago', payloadInput: { paidAt: '' } })).toBe('Informe a data de pagamento');
    expect(validateSaidaForm({ amount: 10, status: 'Pago', payloadInput: { paidAt: '2026-04-17' } })).toBe('');
  });

  it('requires explicit recurrence termination for saida', () => {
    expect(validateSaidaForm({
      amount: 10,
      status: 'Em aberto',
      recurrence: 'mensal',
      isInstallment: true,
      payloadInput: {}
    })).toBe('Escolha parcelamento ou recorrencia');

    expect(validateSaidaForm({
      amount: 10,
      status: 'Em aberto',
      recurrence: 'mensal',
      recurrenceTermination: 'count',
      recurrenceCount: 0,
      baseDueDate: '2026-01-10',
      payloadInput: {}
    })).toBe('Informe a quantidade de recorrencias');

    expect(validateSaidaForm({
      amount: 10,
      status: 'Em aberto',
      recurrence: 'anual',
      recurrenceTermination: 'end_date',
      recurrenceEndDate: '',
      baseDueDate: '2026-01-10',
      payloadInput: {}
    })).toBe('Informe a data final da recorrencia');
  });
});
