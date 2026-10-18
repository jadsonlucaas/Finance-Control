import { describe, expect, it } from 'vitest';
import {
  createFinanceRecordIndex,
  getFinanceRecordIndex,
  installFinanceRecordIndexGlobals,
  queryFinanceRecords
} from '../../src/state/financeRecordIndex.js';

const records = [
  { id: 's1', type: 'saida', person: 'Jadson', amount: 100, status: 'Pago', competence: '2026-04', macro_category: 'FIXO', cycle: 'INICIO_MES' },
  { id: 's2', type: 'saida', person: 'Luana', amount: 50, status: 'Em aberto', competence: '2026-04', macro_category: 'VARIAVEL', cycle: 'QUINZENA' },
  { id: 's3', type: 'saida', person: 'Jadson', amount: 30, status: 'Pago', competence: '2026-05', archived: true },
  { id: 'e1', type: 'entrada', person: 'Jadson', amount: 2000, status: 'Pago', competence: '2026-04' },
  { id: 'p1', type: 'pessoa', person: 'Jadson' }
];

describe('finance record index', () => {
  it('queries by indexed dimensions and archive mode', () => {
    const index = createFinanceRecordIndex(records);

    expect(queryFinanceRecords(index, { type: 'saida', archiveMode: 'active' }).map((record) => record.id)).toEqual(['s1', 's2']);
    expect(queryFinanceRecords(index, { type: 'saida', archiveMode: 'archived' }).map((record) => record.id)).toEqual(['s3']);
    expect(queryFinanceRecords(index, { person: 'Jadson', competenceStart: '2026-04', competenceEnd: '2026-04' }).map((record) => record.id)).toEqual(['s1', 'e1']);
    expect(queryFinanceRecords(index, { type: 'saida', status: 'Pago', macro: 'FIXO', cycle: 'INICIO_MES' }).map((record) => record.id)).toEqual(['s1']);
  });

  it('caches equivalent query results per index', () => {
    const index = createFinanceRecordIndex(records);
    const first = queryFinanceRecords(index, { type: 'saida', archiveMode: 'active' });
    const second = queryFinanceRecords(index, { type: 'saida', archiveMode: 'active' });

    expect(first).toBe(second);
  });

  it('reuses an index until record version changes', () => {
    const first = getFinanceRecordIndex(records, { version: 1 });
    const second = getFinanceRecordIndex(records, { version: 1 });
    const third = getFinanceRecordIndex(records, { version: 2 });

    expect(first).toBe(second);
    expect(third).not.toBe(first);
  });

  it('installs compatibility globals for legacy list filters', () => {
    const target = {
      allRecords: records,
      __financeDataVersion: 1
    };
    installFinanceRecordIndexGlobals(target);

    expect(target.getFinanceRecordsByType('pessoa')).toEqual([{ id: 'p1', type: 'pessoa', person: 'Jadson' }]);
    expect(target.queryFinanceRecords({ type: 'entrada' }).map((record) => record.id)).toEqual(['e1']);
  });
});
