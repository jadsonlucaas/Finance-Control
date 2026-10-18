export function summarizeFinanceRecord(record = {}) {
  return {
    record_id: record.id || '',
    record_type: record.type || '',
    person: record.person || '',
    competence: record.competence || '',
    status: record.status || '',
    amount: Number.isFinite(Number(record.amount)) ? Number(record.amount) : 0,
    macro_category: record.macro_category || '',
    import_source: record.import_source || '',
    archived: Boolean(record.archived)
  };
}

export function classifyFinanceRecordAuditAction(operation, record = {}) {
  if (record.type === 'percentage_rule') {
    if (operation === 'delete') return 'percentage_rule.delete';
    if (operation === 'upsert') return 'percentage_rule.save';
    if (operation === 'update') return 'percentage_rule.update';
    return 'percentage_rule.create';
  }

  if (record.import_source && operation === 'create') return 'import.record_create';

  if (['pessoa', 'macro', 'categoria', 'salario_historico'].includes(record.type)) {
    if (operation === 'delete') return 'settings.record_delete';
    if (operation === 'update' || operation === 'upsert') return 'settings.record_update';
    return 'settings.record_create';
  }

  if (operation === 'delete') return 'finance_record.delete';
  if (operation === 'create') return 'finance_record.create';
  if (operation === 'upsert') return 'finance_record.upsert';
  if (operation === 'update' && record.archived === true) return 'finance_record.archive';
  if (operation === 'update' && record.status === 'Pago') return 'finance_record.mark_paid';
  return 'finance_record.update';
}
