import { describe, expect, it } from 'vitest';
import {
  FINANCE_RECORD_TYPES,
  buildFinanceRecordDryRun,
  detectLegacyFinanceRecordIssues,
  getFinanceRecordSchema,
  migrateFinanceRecordInMemory,
  normalizeFinanceRecord,
  validateFinanceRecord
} from '../../src/domain/records/index.js';

const owner = { owner_uid: 'uid-a', owner_email: 'a@example.test' };

function expectInvalid(record, code, context = {}) {
  const result = validateFinanceRecord(normalizeFinanceRecord(record), context);
  expect(result.isValid).toBe(false);
  expect(result.errors.map((error) => error.code)).toContain(code);
  return result;
}

describe('finance record central contracts', () => {
  it('01 schema exists for every supported type', () => {
    Object.values(FINANCE_RECORD_TYPES).forEach((type) => {
      expect(getFinanceRecordSchema(type)).toMatchObject({ type, version: 1 });
    });
  });

  it('02 rejects unknown types with structured errors', () => {
    const result = validateFinanceRecord({ type: 'legacy_aux' });
    expect(result).toMatchObject({ isValid: false });
    expect(result.errors[0]).toMatchObject({ field: 'type', code: 'UNKNOWN_TYPE', severity: 'error' });
  });

  it('03 normalizes legacy aliases without dropping original fields', () => {
    expect(normalizeFinanceRecord({ type: 'salario_historico', person: 'Ana', amount: '4500', start_date: '2026-07' }))
      .toMatchObject({ salary_base: 4500, amount: 4500, vigencia_inicio: '2026-07', start_date: '2026-07' });
    expect(normalizeFinanceRecord({ type: 'controle_horas', hour_entry_type: 'Hora Extra', financial_total: '120' }))
      .toMatchObject({ hour_control_type: 'Hora Extra', valorTotalCalculado: 120 });
    expect(normalizeFinanceRecord({ type: 'percentage_rule', percentual: '15', base: 'salario' }))
      .toMatchObject({ percentage: 15, base_type: 'salario' });
  });

  it('04 returns structured warnings for legacy records and schema_version absence', () => {
    const migration = migrateFinanceRecordInMemory({ type: 'saida', amount: 10, subcategory: 'Casa' });
    expect(migration.wrote).toBe(false);
    expect(migration.validation.warnings.map((warning) => warning.code)).toContain('LEGACY_SCHEMA_VERSION_MISSING');
  });

  it('05 validates schema_version and optional source metadata', () => {
    expect(validateFinanceRecord(normalizeFinanceRecord({
      type: 'saida',
      amount: '12',
      schema_version: '1',
      source_channel: 'future_integration',
      source_reference_id: 'cmd-1',
      created_by_type: 'integration',
      created_by_id: 'backend',
      idempotency_key: 'idem-1',
      correlation_id: 'corr-1',
      received_at: '2026-07-18T00:00:00.000Z',
      processed_at: '2026-07-18T00:00:01.000Z'
    }))).toMatchObject({ isValid: true });
    expectInvalid({ type: 'saida', amount: 10, schema_version: 0 }, 'INVALID_FIELD_TYPE');
    expectInvalid({ type: 'saida', amount: 10, source_channel: 'whatsapp' }, 'INVALID_FIELD_TYPE');
    expectInvalid({ type: 'saida', amount: 10, idempotency_key: '' }, 'INVALID_FIELD_TYPE');
  });

  it('06 never introduces phone or WhatsApp fields during normalization', () => {
    const normalized = normalizeFinanceRecord({
      type: 'pessoa',
      person: 'Ana',
      salary_base: 1000,
      phone: '123',
      whatsapp_phone: '123'
    });
    expect(normalized.phone).toBeUndefined();
    expect(normalized.whatsapp_phone).toBeUndefined();
    expect(validateFinanceRecord({ ...normalized, telefone: '123' }).errors.map((error) => error.code)).toContain('DISALLOWED_FIELD');
  });

  it('07 preserves owner and enforces immutable owner/type/scope on update', () => {
    const currentRecord = { id: 'r1', type: 'saida', owner_uid: 'uid-a', owner_email: 'a@example.test' };
    expectInvalid({ id: 'r1', type: 'entrada', ...owner }, 'TYPE_IMMUTABLE', { operation: 'update', currentRecord });
    expectInvalid({ id: 'r1', type: 'saida', owner_uid: 'uid-b', owner_email: 'a@example.test' }, 'OWNER_IMMUTABLE', { operation: 'update', currentRecord });
    expectInvalid(
      { id: 'm1', type: 'macro', macro_category: 'Pessoal', shared_scope: 'global', ...owner },
      'SCOPE_IMMUTABLE',
      { operation: 'update', currentRecord: { id: 'm1', type: 'macro', shared_scope: 'personal', ...owner } }
    );
  });

  it('08 validates saida contract rules', () => {
    expect(validateFinanceRecord(normalizeFinanceRecord({ type: 'saida', person: 'Ana', amount: '15.50', competence: '2026-07', status: 'Pago', paid_at: '2026-07-10', ...owner }), { requireOwner: true }))
      .toMatchObject({ isValid: true });
    expectInvalid({ type: 'saida', amount: Number.NaN }, 'INVALID_FIELD_TYPE');
    expectInvalid({ type: 'saida', amount: -1 }, 'INVALID_FIELD_TYPE');
    expectInvalid({ type: 'saida', amount: 1, competence: '07/2026' }, 'INVALID_FIELD_TYPE');
    expectInvalid({ type: 'saida', amount: 1, status: 'Quitado' }, 'INVALID_FIELD_TYPE');
    expectInvalid({ type: 'saida', amount: 1, archived: 'nope' }, 'INVALID_FIELD_TYPE');
    expectInvalid({ type: 'saida', amount: 1, installment_no: 3, total_installments: 2 }, 'INSTALLMENT_OUT_OF_RANGE');
  });

  it('09 keeps paid_at and import validations explicit for saida', () => {
    const warning = validateFinanceRecord(normalizeFinanceRecord({ type: 'saida', amount: 1, status: 'Pago' }));
    expect(warning.warnings.map((item) => item.code)).toContain('PAID_AT_MISSING');
    expect(validateFinanceRecord(normalizeFinanceRecord({
      type: 'saida',
      amount: 1,
      import_source: 'spreadsheet',
      import_batch_id: 'batch-1',
      import_signature: 'sig-1'
    })).isValid).toBe(true);
  });

  it('10 validates entrada without recalculating taxes', () => {
    const normalized = normalizeFinanceRecord({ type: 'entrada', person: 'Ana', amount: '3000', competence: '2026-07', INSS: '300', IRRF: '100', liquido: '2999' });
    const result = validateFinanceRecord(normalized);
    expect(result.isValid).toBe(true);
    expect(normalized.INSS).toBe(300);
    expect(normalized.IRRF).toBe(100);
    expectInvalid({ type: 'entrada', amount: 'abc' }, 'INVALID_FIELD_TYPE');
    expectInvalid({ type: 'entrada', amount: 1, competence: '202607' }, 'INVALID_FIELD_TYPE');
  });

  it('11 warns on entrada derived divergence and rejects empty person when required externally', () => {
    const result = validateFinanceRecord(normalizeFinanceRecord({ type: 'entrada', proventos: 100, descontos: 30, liquido: 90 }));
    expect(result.warnings.map((warning) => warning.code)).toContain('DERIVED_VALUE_DIVERGENCE');
  });

  it('12 validates pessoa contract and duplicate detection', () => {
    expect(validateFinanceRecord(normalizeFinanceRecord({ type: 'pessoa', person: 'Ana', salary_base: '5000' }))).toMatchObject({ isValid: true });
    expectInvalid({ type: 'pessoa', person: '', salary_base: 10 }, 'REQUIRED_FIELD');
    expectInvalid({ type: 'pessoa', person: 'Ana', salary_base: -1 }, 'INVALID_FIELD_TYPE');
    const duplicate = validateFinanceRecord(normalizeFinanceRecord({ id: 'p2', type: 'pessoa', person: 'Ana' }), {
      existingRecords: [{ id: 'p1', type: 'pessoa', person: 'ana' }]
    });
    expect(duplicate.errors.map((error) => error.code)).toContain('DUPLICATE_PERSON');
  });

  it('13 validates controle_horas without changing calculated values', () => {
    const record = normalizeFinanceRecord({
      type: 'controle_horas',
      person: 'Ana',
      competence: '2026-07',
      hour_control_type: 'Hora Extra',
      quantidadeHoras: '2',
      quantidadeHorasFormatada: '3',
      percentualUsado: '50',
      valorTotalCalculado: '123.45'
    });
    const result = validateFinanceRecord(record);
    expect(result.isValid).toBe(true);
    expect(record.valorTotalCalculado).toBe(123.45);
    expect(result.warnings.map((warning) => warning.code)).toContain('HOUR_FORMAT_DIVERGENCE');
    expect(validateFinanceRecord(normalizeFinanceRecord({
      type: 'controle_horas',
      person: 'Ana',
      competence: '2026-07',
      occurred_date: '2026-07-31',
      hour_control_type: 'Hora Extra',
      start_time: '22:00',
      end_time: '06:00',
      crosses_midnight: true,
      gross_minutes: 480,
      break_minutes: 0,
      net_minutes: 480,
      overtime_percentage: 50,
      base_hourly_rate_cents: 2000,
      calculated_value_cents: 24000,
      calculation_version: 1
    }))).toMatchObject({ isValid: true });
    expectInvalid({ type: 'controle_horas', hour_control_type: 'Plantao' }, 'INVALID_FIELD_TYPE');
    expectInvalid({ type: 'controle_horas', quantidadeHoras: -1 }, 'INVALID_FIELD_TYPE');
    expectInvalid({ type: 'controle_horas', percentualUsado: 1001 }, 'INVALID_FIELD_TYPE');
    expectInvalid({ type: 'controle_horas', start_time: '25:00' }, 'INVALID_CLOCK');
    expectInvalid({ type: 'controle_horas', break_minutes: -1 }, 'INVALID_FIELD_TYPE');
  });

  it('14 validates salary history', () => {
    expect(validateFinanceRecord(normalizeFinanceRecord({ type: 'salario_historico', person: 'Ana', salary_base: '5000', vigencia_inicio: '2026-01', vigencia_fim: '2026-07' }))).toMatchObject({ isValid: true });
    expectInvalid({ type: 'salario_historico', person: 'Ana', salary_base: 0 }, 'INVALID_FIELD_TYPE');
    expectInvalid({ type: 'salario_historico', person: 'Ana', salary_base: 100, vigencia_inicio: '2026-08', vigencia_fim: '2026-07' }, 'INVALID_PERIOD');
  });

  it('15 validates percentage rule without materializing records', () => {
    const migration = migrateFinanceRecordInMemory({ type: 'percentage_rule', percentage: 10, base_type: 'salario', cycle: 'INICIO_MES', startCompetence: '2026-01', endCompetence: '2026-12' });
    expect(migration.validation.isValid).toBe(true);
    expect(migration.normalized.type).toBe('percentage_rule');
    expect(migration.wrote).toBe(false);
    expectInvalid({ type: 'percentage_rule', percentage: 101 }, 'INVALID_FIELD_TYPE');
    expectInvalid({ type: 'percentage_rule', percentage: 10, cycle: 'diario' }, 'INVALID_FIELD_TYPE');
    expectInvalid({ type: 'percentage_rule', percentage: 10, startCompetence: '2026-12', endCompetence: '2026-01' }, 'INVALID_PERIOD');
  });

  it('16 preserves reference data policy for macro and categoria', () => {
    expect(validateFinanceRecord(normalizeFinanceRecord({ type: 'macro', macro_category: 'FIXO', shared_scope: 'global', ...owner }), { requireOwner: true }))
      .toMatchObject({ isValid: true });
    expect(validateFinanceRecord(normalizeFinanceRecord({ type: 'categoria', macro_category: 'FIXO', category_name: 'Moradia', shared_scope: 'personal', ...owner }), { requireOwner: true }))
      .toMatchObject({ isValid: true });
    expectInvalid({ type: 'macro', macro_category: 'FIXO', shared_scope: 'external' }, 'INVALID_FIELD_TYPE');
    expectInvalid({ type: 'categoria', macro_category: '', category_name: 'Casa' }, 'REQUIRED_FIELD');
  });

  it('17 dry-run is deterministic and never writes data', () => {
    const records = [
      { id: 'ok', type: 'saida', amount: 10, schema_version: 1 },
      { id: 'legacy', type: 'saida', amount: 10 },
      { id: 'bad', type: 'saida', amount: -1 }
    ];
    const first = buildFinanceRecordDryRun(records);
    const second = buildFinanceRecordDryRun(records);
    expect(first).toEqual(second);
    expect(first.wrote).toBe(false);
    expect(first.total).toBe(3);
    expect(first.byType.saida).toMatchObject({ total: 3, invalid: 1 });
  });

  it('18 exposes legacy issue detector', () => {
    const issues = detectLegacyFinanceRecordIssues({ type: 'saida', amount: 10, unknown_flag: true });
    expect(issues.map((issue) => issue.code)).toEqual(expect.arrayContaining(['LEGACY_SCHEMA_VERSION_MISSING', 'UNKNOWN_FIELD']));
  });
});
