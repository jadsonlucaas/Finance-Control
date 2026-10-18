import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildHourControlReadModel } from '../../../src/application/readModels/hourControlReadModel.js';
import {
  applyHourControlFilters,
  filterHourEntriesByCompetence,
  filterHourEntriesByPerson,
  filterHourEntriesByPeriod,
  filterHourEntriesByStatus
} from '../../../src/application/selectors/hourControlFilters.js';
import { buildHourPeriodSummary } from '../../../src/domain/hourPeriodSummary.js';

const records = [
  { id: 'p-jadson', type: 'pessoa', person: 'Jadson', salary_base: 5000 },
  { id: 'sal-old', type: 'salario_historico', person: 'Jadson', competence: '2026-01', salary_base: 4800 },
  { id: 'sal-current', type: 'salario_historico', person: 'Jadson', competence: '2026-06', salary_base: 5459 },
  {
    id: 'he-1',
    type: 'controle_horas',
    person: 'Jadson',
    competence: '2026-06',
    occurred_date: '2026-06-13',
    hour_control_type: 'Hora Extra',
    hour_entry_type: 'Hora Extra',
    start_time: '18:00',
    end_time: '20:00',
    net_minutes: 120,
    quantidadeHoras: 2,
    valorTotalCalculado: 74.44,
    source_channel: 'future-channel'
  },
  {
    id: 'bank-before',
    type: 'controle_horas',
    person: 'Jadson',
    competence: '2026-05',
    occurred_date: '2026-05-20',
    hour_control_type: 'Banco de Horas',
    bank_nature: 'Debito',
    quantidadeHoras: 1
  },
  {
    id: 'bank-credit',
    type: 'controle_horas',
    person: 'Jadson',
    competence: '2026-06',
    occurred_date: '2026-06-14',
    hour_control_type: 'Banco de Horas',
    bank_nature: 'Credito',
    quantidadeHoras: 0.5,
    status: 'Compensado'
  },
  {
    id: 'other-person',
    type: 'controle_horas',
    person: 'Luana',
    competence: '2026-06',
    occurred_date: '2026-06-11',
    hour_control_type: 'Hora Extra',
    quantidadeHoras: 3,
    valorTotalCalculado: 100
  },
  {
    id: 'archived',
    type: 'controle_horas',
    person: 'Jadson',
    competence: '2026-06',
    occurred_date: '2026-06-10',
    hour_control_type: 'Hora Extra',
    quantidadeHoras: 9,
    valorTotalCalculado: 999,
    archived: true
  }
];

describe('hour control read model', () => {
  it('is deterministic, local and does not mutate input records', () => {
    const source = structuredClone(records);
    const before = JSON.stringify(source);
    const first = buildHourControlReadModel({ records: source, filters: { start: '2026-06', end: '2026-06', person: 'Jadson' } });
    const second = buildHourControlReadModel({ records: source, filters: { start: '2026-06', end: '2026-06', person: 'Jadson' } });

    expect(JSON.stringify(source)).toBe(before);
    expect(second).toEqual(first);
    expect(first.entries.map((entry) => entry.id)).toEqual(['bank-credit', 'he-1']);
    expect(first.effectiveSalary).toMatchObject({ isValid: true, salary: 5459, sourceRecordId: 'sal-current' });
  });

  it('uses the canonical period summary instead of rebuilding bank rules in the UI', () => {
    const model = buildHourControlReadModel({ records, filters: { start: '2026-06', end: '2026-06', person: 'Jadson' } });
    const canonical = buildHourPeriodSummary(records.filter((record) => record.archived !== true), { start: '2026-06', end: '2026-06', person: 'Jadson' });

    expect(model.summary).toEqual(canonical);
    expect(model.overtime).toMatchObject({ hours: 2, amount: 74.44, entriesCount: 1 });
    expect(model.bank).toMatchObject({
      openingHours: 1,
      creditHours: 0.5,
      periodNetHours: -0.5,
      netHours: 0.5
    });
  });

  it('keeps source_channel neutral for calculations and filters', () => {
    const base = buildHourControlReadModel({ records, filters: { start: '2026-06', end: '2026-06' } });
    const withoutChannel = buildHourControlReadModel({
      records: records.map(({ source_channel, ...record }) => record),
      filters: { start: '2026-06', end: '2026-06' }
    });

    expect(base.summary).toEqual(withoutChannel.summary);
    expect(base.monthlyTotals).toEqual(withoutChannel.monthlyTotals);
  });

  it('keeps filter order semantically equivalent', () => {
    const filters = { start: '2026-06', end: '2026-06', person: 'Jadson', status: 'Compensado' };
    const centralized = applyHourControlFilters(records, filters).map((record) => record.id);
    const manual = filterHourEntriesByStatus(
      filterHourEntriesByPerson(
        filterHourEntriesByPeriod(records.filter((record) => record.type === 'controle_horas' && record.archived !== true), filters),
        'Jadson'
      ),
      'Compensado'
    ).map((record) => record.id);

    expect(centralized).toEqual(manual);
    expect(filterHourEntriesByCompetence(records, '2026-06').map((record) => record.id)).toContain('he-1');
  });

  it('does not include a second work-session or overtime formula in the read model', () => {
    const source = readFileSync('src/application/readModels/hourControlReadModel.js', 'utf8');
    expect(source).not.toMatch(/CalculateWorkSession|calcularHoras|calcularHoraExtra|calcularBancoHoras|CalculateDSR/);
  });
});
