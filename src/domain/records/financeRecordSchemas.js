export const FINANCE_RECORD_SCHEMA_VERSION = 1;

export const FINANCE_RECORD_TYPES = Object.freeze({
  SAIDA: 'saida',
  ENTRADA: 'entrada',
  PESSOA: 'pessoa',
  CATEGORIA: 'categoria',
  MACRO: 'macro',
  CONTROLE_HORAS: 'controle_horas',
  SALARIO_HISTORICO: 'salario_historico',
  PERCENTAGE_RULE: 'percentage_rule'
});

export const KNOWN_FINANCE_RECORD_TYPES = Object.freeze(Object.values(FINANCE_RECORD_TYPES));

export const SOURCE_CHANNELS = Object.freeze([
  'web',
  'bank_import',
  'spreadsheet_import',
  'system',
  'migration',
  'future_integration'
]);

export const CREATED_BY_TYPES = Object.freeze(['user', 'admin', 'system', 'integration']);
export const REFERENCE_SCOPES = Object.freeze(['global', 'personal']);
export const EXPENSE_STATUSES = Object.freeze(['Em aberto', 'Pago', 'Cancelado', 'Vencido', '']);
export const ENTRY_STATUSES = Object.freeze(['Pago', 'Pendente', 'Cancelado', '']);
export const PERCENTAGE_RULE_STATUSES = Object.freeze(['active', 'inactive', 'ativo', 'inativo', '']);
export const CYCLES = Object.freeze(['INICIO_MES', 'QUINZENA', 'FIM_MES', 'MENSAL', 'inicio', 'quinzena', 'fim', '']);
export const SOURCE_MODES = Object.freeze(['manual', 'import', 'recurring', 'installment', 'system', '']);
export const RECURRENCE_FREQUENCIES = Object.freeze(['monthly', 'yearly', 'mensal', 'anual', '']);
export const HOUR_CONTROL_TYPES = Object.freeze(['Hora Extra', 'Banco de Horas', 'Ajuste', 'Folga', '']);
export const BANK_NATURES = Object.freeze(['credito', 'debito', 'neutro', 'Credito', 'Debito', 'Crédito', 'Débito', '']);
export const PERCENTAGE_BASE_TYPES = Object.freeze(['salario', 'entrada', 'liquido', 'manual', 'base_total', 'base', '']);

export const DISALLOWED_FINANCE_RECORD_FIELDS = Object.freeze([
  'phone',
  'phone_number',
  'telefone',
  'whatsapp',
  'whatsapp_phone',
  'provider_phone',
  'chatbot',
  'webhook'
]);

export const COMMON_FIELDS = Object.freeze({
  id: { kind: 'string', optional: true },
  type: { kind: 'string', required: true },
  owner_uid: { kind: 'string', optional: true },
  owner_email: { kind: 'string', optional: true },
  created_at: { kind: 'isoDateTime', optional: true },
  updated_at: { kind: 'isoDateTime', optional: true },
  schema_version: { kind: 'positiveInteger', optional: true },
  archived: { kind: 'boolean', optional: true, default: false },
  archived_at: { kind: 'isoDateTime', optional: true },
  description: { kind: 'string', optional: true },
  observation: { kind: 'string', optional: true }
});

export const SOURCE_METADATA_FIELDS = Object.freeze({
  source_channel: { kind: 'enum', values: SOURCE_CHANNELS, optional: true },
  source_reference_id: { kind: 'nonEmptyString', optional: true },
  created_by_type: { kind: 'enum', values: CREATED_BY_TYPES, optional: true },
  created_by_id: { kind: 'nonEmptyString', optional: true },
  idempotency_key: { kind: 'nonEmptyString', optional: true },
  correlation_id: { kind: 'nonEmptyString', optional: true },
  received_at: { kind: 'isoDateTime', optional: true },
  processed_at: { kind: 'isoDateTime', optional: true }
});

function fields(typeFields) {
  return Object.freeze({
    ...COMMON_FIELDS,
    ...SOURCE_METADATA_FIELDS,
    ...typeFields
  });
}

export const FINANCE_RECORD_SCHEMAS = Object.freeze({
  [FINANCE_RECORD_TYPES.SAIDA]: Object.freeze({
    type: FINANCE_RECORD_TYPES.SAIDA,
    version: FINANCE_RECORD_SCHEMA_VERSION,
    required: ['type'],
    aliases: Object.freeze({ category_name: ['subcategory'] }),
    fields: fields({
      person: { kind: 'string', optional: true },
      amount: { kind: 'moneyNonNegative', optional: true, default: 0 },
      macro_category: { kind: 'string', optional: true },
      macro_id: { kind: 'string', optional: true },
      category_id: { kind: 'string', optional: true },
      category_name: { kind: 'string', optional: true },
      subcategory: { kind: 'string', optional: true },
      category_color: { kind: 'string', optional: true },
      category_icon: { kind: 'string', optional: true },
      category_snapshot: { kind: 'object', optional: true },
      payment_method: { kind: 'string', optional: true },
      status: { kind: 'enum', values: EXPENSE_STATUSES, optional: true, default: 'Em aberto' },
      occurred_date: { kind: 'date', optional: true },
      due_date: { kind: 'date', optional: true },
      competence: { kind: 'competence', optional: true },
      paid_at: { kind: 'dateOrIso', optional: true },
      installment_no: { kind: 'integerNonNegative', optional: true, default: 0 },
      total_installments: { kind: 'integerNonNegative', optional: true, default: 0 },
      parent_id: { kind: 'string', optional: true },
      recurrence: { kind: 'string', optional: true },
      recurrence_frequency: { kind: 'enum', values: RECURRENCE_FREQUENCIES, optional: true },
      recurrence_count: { kind: 'integerNonNegative', optional: true, default: 0 },
      recurrence_end_date: { kind: 'date', optional: true },
      recurrence_series_id: { kind: 'string', optional: true },
      recurrence_sequence_no: { kind: 'integerNonNegative', optional: true, default: 0 },
      recurrence_total_occurrences: { kind: 'integerNonNegative', optional: true, default: 0 },
      cycle: { kind: 'enum', values: CYCLES, optional: true },
      source_mode: { kind: 'enum', values: SOURCE_MODES, optional: true },
      import_source: { kind: 'string', optional: true },
      import_batch_id: { kind: 'string', optional: true },
      import_signature: { kind: 'string', optional: true },
      import_core_signature: { kind: 'string', optional: true },
      generated_percentage_rule: { kind: 'boolean', optional: true },
      percentage_rule_id: { kind: 'string', optional: true },
      percentage_occurrence_key: { kind: 'string', optional: true },
      percentage_rule_version: { kind: 'positiveInteger', optional: true },
      percentage_materialized_at: { kind: 'isoDateTime', optional: true },
      percentage_calculation_version: { kind: 'positiveInteger', optional: true },
      percentage_rate: { kind: 'number', optional: true },
      percentage_base: { kind: 'string', optional: true },
      percentage_base_amount: { kind: 'number', optional: true },
      percentage_base_amount_cents: { kind: 'integerNonNegative', optional: true },
      percentage_calculated_amount_cents: { kind: 'integerNonNegative', optional: true },
      virtual_record: { kind: 'boolean', optional: true },
      is_installment: { kind: 'boolean', optional: true },
      purchase_name: { kind: 'string', optional: true },
      card: { kind: 'string', optional: true },
      earning_type: { kind: 'string', optional: true }
    })
  }),

  [FINANCE_RECORD_TYPES.ENTRADA]: Object.freeze({
    type: FINANCE_RECORD_TYPES.ENTRADA,
    version: FINANCE_RECORD_SCHEMA_VERSION,
    required: ['type'],
    aliases: Object.freeze({ liquido: ['liquido_final', 'salario_liquido'] }),
    fields: fields({
      person: { kind: 'string', optional: true },
      amount: { kind: 'money', optional: true, default: 0 },
      macro_category: { kind: 'string', optional: true },
      macro_id: { kind: 'string', optional: true },
      category_id: { kind: 'string', optional: true },
      category_name: { kind: 'string', optional: true },
      subcategory: { kind: 'string', optional: true },
      category_color: { kind: 'string', optional: true },
      category_icon: { kind: 'string', optional: true },
      competence: { kind: 'competence', optional: true },
      occurred_date: { kind: 'date', optional: true },
      due_date: { kind: 'date', optional: true },
      status: { kind: 'enum', values: ENTRY_STATUSES, optional: true, default: 'Pago' },
      earning_type: { kind: 'string', optional: true },
      recurrence: { kind: 'string', optional: true },
      cycle: { kind: 'enum', values: CYCLES, optional: true },
      salary_base: { kind: 'moneyNonNegative', optional: true },
      proventos: { kind: 'money', optional: true },
      descontos: { kind: 'money', optional: true },
      INSS: { kind: 'money', optional: true },
      IRRF: { kind: 'money', optional: true },
      inss: { kind: 'money', optional: true },
      irrf: { kind: 'money', optional: true },
      liquido: { kind: 'money', optional: true },
      inss_parameter_version: { kind: 'string', optional: true },
      irrf_parameter_version: { kind: 'string', optional: true },
      tax_calculated_at: { kind: 'isoDateTime', optional: true },
      tax_calculation_schema_version: { kind: 'positiveInteger', optional: true },
      source: { kind: 'string', optional: true },
      nomeTipo: { kind: 'string', optional: true },
      percentualUsado: { kind: 'number', optional: true },
      valorHoraCalculado: { kind: 'number', optional: true },
      valorTotalCalculado: { kind: 'number', optional: true },
      quantidadeHoras: { kind: 'numberNonNegative', optional: true },
      quantidadeHorasFormatada: { kind: 'string', optional: true },
      valorBaseHora: { kind: 'numberNonNegative', optional: true },
      salary_base_reference: { kind: 'numberNonNegative', optional: true },
      monthly_hours_reference: { kind: 'numberNonNegative', optional: true },
      tipoFinanceiroUsado: { kind: 'boolean', optional: true },
      horaInicial: { kind: 'string', optional: true },
      horaFinal: { kind: 'string', optional: true },
      import_source: { kind: 'string', optional: true },
      import_batch_id: { kind: 'string', optional: true },
      import_signature: { kind: 'string', optional: true },
      import_core_signature: { kind: 'string', optional: true }
    })
  }),

  [FINANCE_RECORD_TYPES.PESSOA]: Object.freeze({
    type: FINANCE_RECORD_TYPES.PESSOA,
    version: FINANCE_RECORD_SCHEMA_VERSION,
    required: ['type', 'person'],
    aliases: Object.freeze({ salary_base: ['amount'] }),
    fields: fields({
      person: { kind: 'nonEmptyString', required: true },
      salary_base: { kind: 'moneyNonNegative', optional: true, default: 0 },
      amount: { kind: 'moneyNonNegative', optional: true },
      regime: { kind: 'string', optional: true },
      receiving_type: { kind: 'string', optional: true },
      status: { kind: 'string', optional: true }
    })
  }),

  [FINANCE_RECORD_TYPES.CONTROLE_HORAS]: Object.freeze({
    type: FINANCE_RECORD_TYPES.CONTROLE_HORAS,
    version: FINANCE_RECORD_SCHEMA_VERSION,
    required: ['type'],
    aliases: Object.freeze({
      hour_control_type: ['hour_entry_type'],
      valorTotalCalculado: ['financial_total'],
      start_time: ['horaInicial'],
      end_time: ['horaFinal'],
      net_minutes: ['minutes']
    }),
    fields: fields({
      person: { kind: 'string', optional: true },
      competence: { kind: 'competence', optional: true },
      occurred_date: { kind: 'date', optional: true },
      hour_control_type: { kind: 'enum', values: HOUR_CONTROL_TYPES, optional: true },
      hour_entry_type: { kind: 'string', optional: true },
      start_time: { kind: 'string', optional: true },
      end_time: { kind: 'string', optional: true },
      crosses_midnight: { kind: 'boolean', optional: true },
      break_start_time: { kind: 'string', optional: true },
      break_end_time: { kind: 'string', optional: true },
      break_minutes: { kind: 'integerNonNegative', optional: true },
      gross_minutes: { kind: 'integerNonNegative', optional: true },
      net_minutes: { kind: 'integerNonNegative', optional: true },
      bank_minutes: { kind: 'number', optional: true },
      horaInicial: { kind: 'string', optional: true },
      horaFinal: { kind: 'string', optional: true },
      quantidadeHoras: { kind: 'numberNonNegative', optional: true, default: 0 },
      quantidadeHorasFormatada: { kind: 'string', optional: true },
      hours_quantity: { kind: 'numberNonNegative', optional: true },
      hours_formatted: { kind: 'string', optional: true },
      bank_nature: { kind: 'enum', values: BANK_NATURES, optional: true },
      percentualUsado: { kind: 'percentageReasonable', optional: true },
      overtime_percentage: { kind: 'percentageReasonable', optional: true },
      valorBaseHora: { kind: 'numberNonNegative', optional: true },
      valorHoraCalculado: { kind: 'number', optional: true },
      valorTotalCalculado: { kind: 'number', optional: true },
      financial_total: { kind: 'number', optional: true },
      financial_hour_value: { kind: 'number', optional: true },
      hour_value_base: { kind: 'numberNonNegative', optional: true },
      salary_base_reference: { kind: 'numberNonNegative', optional: true },
      salary_base_snapshot: { kind: 'numberNonNegative', optional: true },
      monthly_hours_reference: { kind: 'numberNonNegative', optional: true },
      base_hourly_rate_cents: { kind: 'integerNonNegative', optional: true },
      calculated_value_cents: { kind: 'integerNonNegative', optional: true },
      dsr_value_cents: { kind: 'integerNonNegative', optional: true },
      calculation_version: { kind: 'positiveInteger', optional: true },
      salary_source_record_id: { kind: 'string', optional: true },
      amount: { kind: 'number', optional: true }
    })
  }),

  [FINANCE_RECORD_TYPES.SALARIO_HISTORICO]: Object.freeze({
    type: FINANCE_RECORD_TYPES.SALARIO_HISTORICO,
    version: FINANCE_RECORD_SCHEMA_VERSION,
    required: ['type', 'person'],
    aliases: Object.freeze({
      salary_base: ['amount'],
      vigencia_inicio: ['start_date'],
      vigencia_fim: ['end_date']
    }),
    fields: fields({
      person: { kind: 'nonEmptyString', required: true },
      person_id: { kind: 'string', optional: true },
      salary_base: { kind: 'positiveMoney', optional: true },
      amount: { kind: 'positiveMoney', optional: true },
      start_date: { kind: 'dateOrCompetence', optional: true },
      end_date: { kind: 'dateOrCompetence', optional: true },
      vigencia_inicio: { kind: 'competence', optional: true },
      vigencia_fim: { kind: 'competence', optional: true }
    })
  }),

  [FINANCE_RECORD_TYPES.PERCENTAGE_RULE]: Object.freeze({
    type: FINANCE_RECORD_TYPES.PERCENTAGE_RULE,
    version: FINANCE_RECORD_SCHEMA_VERSION,
    required: ['type'],
    aliases: Object.freeze({
      percentage: ['percentual'],
      base_type: ['base'],
      start_competence: ['startCompetence'],
      end_competence: ['endCompetence']
    }),
    fields: fields({
      name: { kind: 'string', optional: true },
      person: { kind: 'string', optional: true },
      percentage: { kind: 'percentageLimit', optional: true },
      percentual: { kind: 'percentageLimit', optional: true },
      base: { kind: 'string', optional: true },
      base_type: { kind: 'enum', values: PERCENTAGE_BASE_TYPES, optional: true },
      macro: { kind: 'string', optional: true },
      macro_category: { kind: 'string', optional: true },
      category: { kind: 'string', optional: true },
      category_id: { kind: 'string', optional: true },
      category_name: { kind: 'string', optional: true },
      cycle: { kind: 'enum', values: CYCLES, optional: true },
      status: { kind: 'enum', values: PERCENTAGE_RULE_STATUSES, optional: true },
      startCompetence: { kind: 'competence', optional: true },
      endCompetence: { kind: 'competence', optional: true },
      start_competence: { kind: 'competence', optional: true },
      end_competence: { kind: 'competence', optional: true },
      active: { kind: 'boolean', optional: true, default: true }
    })
  }),

  [FINANCE_RECORD_TYPES.MACRO]: Object.freeze({
    type: FINANCE_RECORD_TYPES.MACRO,
    version: FINANCE_RECORD_SCHEMA_VERSION,
    required: ['type', 'macro_category'],
    fields: fields({
      macro_id: { kind: 'string', optional: true },
      macro_category: { kind: 'nonEmptyString', required: true },
      shared_scope: { kind: 'enum', values: REFERENCE_SCOPES, optional: true },
      person: { kind: 'string', optional: true },
      subcategory: { kind: 'string', optional: true },
      amount: { kind: 'moneyNonNegative', optional: true }
    })
  }),

  [FINANCE_RECORD_TYPES.CATEGORIA]: Object.freeze({
    type: FINANCE_RECORD_TYPES.CATEGORIA,
    version: FINANCE_RECORD_SCHEMA_VERSION,
    required: ['type', 'macro_category', 'category_name'],
    aliases: Object.freeze({ category_name: ['subcategory'] }),
    fields: fields({
      category_id: { kind: 'string', optional: true },
      category_name: { kind: 'nonEmptyString', required: true },
      macro_id: { kind: 'string', optional: true },
      macro_category: { kind: 'nonEmptyString', required: true },
      subcategory: { kind: 'string', optional: true },
      category_color: { kind: 'string', optional: true },
      category_icon: { kind: 'string', optional: true },
      shared_scope: { kind: 'enum', values: REFERENCE_SCOPES, optional: true },
      person: { kind: 'string', optional: true },
      amount: { kind: 'moneyNonNegative', optional: true }
    })
  })
});

export function isKnownFinanceRecordType(type = '') {
  return KNOWN_FINANCE_RECORD_TYPES.includes(type);
}

export function getFinanceRecordSchema(type = '') {
  return FINANCE_RECORD_SCHEMAS[type] || null;
}
