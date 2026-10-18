export function validateEntradaForm(values = {}, options = {}) {
  const parseTimeToMinutes = options.parseTimeToMinutes || (() => null);

  if (!values.formCycle) return 'Selecione o ciclo';

  if (values.isHourExtra) {
    const input = values.hourExtraInput || {};
    if (!input.selectedType || !input.selectedType.active) return 'Selecione um tipo de H.E. ativo';
    if (!input.quantidadeHoras || input.quantidadeHoras <= 0) return 'Informe a quantidade de horas';
    if (!input.valorBaseHora || input.valorBaseHora <= 0) return 'Informe o valor base da hora';
    if ((input.horaInicial && !input.horaFinal) || (!input.horaInicial && input.horaFinal)) {
      return 'Preencha hora inicial e final juntas';
    }

    const startMinutes = parseTimeToMinutes(input.horaInicial);
    const endMinutes = parseTimeToMinutes(input.horaFinal);
    const allowCrossMidnight = options.allowCrossMidnight === true;
    if (input.horaInicial && input.horaFinal && (startMinutes === null || endMinutes === null)) {
      return 'Informe horarios validos';
    }
    if (input.horaInicial && input.horaFinal && endMinutes <= startMinutes && !allowCrossMidnight) {
      return 'A hora final deve ser maior que a inicial';
    }
    if (input.horaInicial && input.horaFinal && endMinutes === startMinutes) {
      return 'A hora final deve ser diferente da inicial';
    }
  }

  const requiresAmount = !values.isHourExtra || values.hourExtraSnapshot?.tipoFinanceiroUsado;
  if (requiresAmount && (!values.amount || values.amount <= 0)) return 'Informe um valor válido';

  return '';
}

export function validateSaidaForm(values = {}) {
  if (!values.amount || values.amount <= 0) return 'Informe um valor válido';
  if (values.status === 'Pago' && !values.payloadInput?.paidAt) return 'Informe a data de pagamento';
  if (values.recurrence) {
    if (values.isInstallment) return 'Escolha parcelamento ou recorrencia';
    if (!values.baseDueDate) return 'Informe a primeira data da recorrencia';
    if (values.recurrenceTermination === 'count') {
      if (!Number.isInteger(values.recurrenceCount) || values.recurrenceCount <= 0) return 'Informe a quantidade de recorrencias';
    } else if (values.recurrenceTermination === 'end_date') {
      if (!values.recurrenceEndDate) return 'Informe a data final da recorrencia';
    } else {
      return 'Informe o termino da recorrencia';
    }
  }
  return '';
}

export function installRecordFormValidationGlobals(target = globalThis) {
  const api = {
    validateEntradaForm,
    validateSaidaForm
  };
  target.financeRecordFormValidation = api;
  return api;
}
