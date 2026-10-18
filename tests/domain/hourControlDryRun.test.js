import { describe, expect, it } from 'vitest';
import { buildHourControlDryRun, classifyHourControlRecord } from '../../src/domain/hourControlDryRun.js';

describe('hour control dry-run', () => {
  it('detects possible legacy night shifts without writing', () => {
    const result = classifyHourControlRecord({
      id: 'night',
      type: 'controle_horas',
      hour_control_type: 'Hora Extra',
      start_time: '22:00',
      end_time: '06:00',
      quantidadeHoras: 0,
      financial_total: 0
    });
    expect(result.wrote).toBe(false);
    expect(result.classification).toBe('review_required');
    expect(result.issues.map((issue) => issue.code)).toContain('POSSIBLE_NIGHT_SHIFT');
  });

  it('detects hour, value and DSR review issues deterministically', () => {
    const records = [
      {
        id: 'divergent',
        type: 'controle_horas',
        hour_control_type: 'Hora Extra',
        start_time: '08:00',
        end_time: '10:00',
        quantidadeHoras: 1,
        quantidadeHorasFormatada: '01:00',
        hour_value_base: 20,
        percentualUsado: 50,
        financial_total: 10,
        observation: 'Possivel DSR'
      }
    ];
    const first = buildHourControlDryRun(records);
    const second = buildHourControlDryRun(records);
    expect(first).toEqual(second);
    expect(first.wrote).toBe(false);
    expect(first.total).toBe(1);
    expect(first.analyzed[0].issues.map((issue) => issue.code)).toEqual(expect.arrayContaining([
      'LEGACY_FIELDS',
      'HOUR_QUANTITY_DIVERGENCE',
      'VALUE_DIVERGENCE',
      'POSSIBLE_DSR_DUPLICATE'
    ]));
  });

  it('classifies current records as current', () => {
    expect(classifyHourControlRecord({
      id: 'current',
      type: 'controle_horas',
      hour_control_type: 'Banco de Horas',
      bank_nature: 'debito',
      start_time: '08:00',
      end_time: '09:00',
      gross_minutes: 60,
      net_minutes: 60,
      break_minutes: 0,
      quantidadeHoras: 1,
      quantidadeHorasFormatada: '01:00',
      calculation_version: 1
    })).toMatchObject({ classification: 'current', wrote: false });
  });
});
