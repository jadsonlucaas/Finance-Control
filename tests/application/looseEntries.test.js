import { describe, expect, it } from 'vitest';
import {
  buildLooseEntryRecord,
  isLooseEntry,
  selectLooseEntries
} from '../../src/application/selectors/looseEntries.js';

const records = [
  { id: 'sal', type: 'entrada', person: 'Ana', subcategory: 'Salário', amount: 5000, competence: '2026-11' },
  { id: 'he', type: 'entrada', person: 'Ana', earning_type: 'Hora extra', amount: 300, competence: '2026-11' },
  { id: 'inss', type: 'entrada', person: 'Ana', description: 'INSS', amount: 400, competence: '2026-11' },
  { id: 'ded', type: 'entrada', person: 'Ana', macro_category: 'Deduções', description: 'Plano', amount: 90, competence: '2026-11' },
  { id: 'adj', type: 'entrada', person: 'Ana', entry_discount_adjustment: true, description: 'Ajuste', amount: 20, competence: '2026-11' },
  { id: 'arch', type: 'entrada', person: 'Ana', description: 'Venda antiga', amount: 50, competence: '2026-11', archived: true },
  { id: 'zero', type: 'entrada', person: 'Ana', description: 'Nada', amount: 0, competence: '2026-11' },
  { id: 'out', type: 'saida', person: 'Ana', description: 'Mercado', amount: 70, competence: '2026-11' },
  { id: 'freela', type: 'entrada', person: 'Ana', description: 'Freela site', amount: 800, occurred_date: '2026-11-10', competence: '2026-11' },
  { id: 'venda', type: 'entrada', person: 'Bruno', description: 'Venda bicicleta', amount: 450.5, occurred_date: '2026-11-20', competence: '2026-11' },
  { id: 'dez', type: 'entrada', person: 'Bruno', description: 'Presente', amount: 100, occurred_date: '2026-12-02' }
];

describe('isLooseEntry', () => {
  it('ignora salario, hora extra, impostos, deducoes, ajustes, arquivadas, zeradas e saidas', () => {
    const loose = records.filter((record) => isLooseEntry(record)).map((record) => record.id);
    expect(loose).toEqual(['freela', 'venda', 'dez']);
  });

  it('usa as regras do app para arquivada e salario de referencia', () => {
    expect(isLooseEntry(records[8], { isArchivedRecord: () => true })).toBe(false);
    expect(isLooseEntry(records[8], { isReferenceSalaryRecord: () => true })).toBe(false);
  });
});

describe('selectLooseEntries', () => {
  it('filtra pelo mes, ordena da mais recente e soma o total', () => {
    const result = selectLooseEntries(records, { competence: '2026-11' });
    expect(result.items.map((record) => record.id)).toEqual(['venda', 'freela']);
    expect(result.count).toBe(2);
    expect(result.total).toBe(1250.5);
  });

  it('sem mes mostra todas e usa a data quando nao ha competencia', () => {
    expect(selectLooseEntries(records).count).toBe(3);
    expect(selectLooseEntries(records, { competence: '2026-12' }).items.map((record) => record.id)).toEqual(['dez']);
  });

  it('aplica a busca na descricao e na pessoa', () => {
    expect(selectLooseEntries(records, { search: 'bruno' }).items.map((record) => record.id)).toEqual(['dez', 'venda']);
    expect(selectLooseEntries(records, { search: 'FREELA' }).items.map((record) => record.id)).toEqual(['freela']);
  });
});

describe('buildLooseEntryRecord', () => {
  const now = new Date('2026-11-18T12:00:00Z');

  it('valida os campos obrigatorios', () => {
    expect(buildLooseEntryRecord({}, null, now)).toEqual({
      ok: false,
      errors: ['DESCRIPTION_REQUIRED', 'AMOUNT_REQUIRED', 'DATE_REQUIRED', 'PERSON_REQUIRED']
    });
    expect(buildLooseEntryRecord({ person: 'Ana', date: '2026-11-10', description: 'X', amount: '0' }, null, now).errors)
      .toEqual(['AMOUNT_REQUIRED']);
  });

  it('monta uma nova entrada como "Outras receitas" paga', () => {
    const result = buildLooseEntryRecord({ person: ' Ana ', date: '2026-11-10', description: 'Freela', amount: '1234,5' }, null, now);
    expect(result.ok).toBe(true);
    expect(result.record).toMatchObject({
      type: 'entrada',
      person: 'Ana',
      competence: '2026-11',
      occurred_date: '2026-11-10',
      macro_category: 'Rendimento',
      subcategory: 'Outras receitas',
      earning_type: 'Outras receitas',
      description: 'Freela',
      amount: 1234.5,
      status: 'Pago',
      paid_at: '2026-11-10',
      created_at: now.toISOString()
    });
    expect(isLooseEntry(result.record)).toBe(true);
  });

  it('na edicao mantem id, categoria e data de criacao do registro original', () => {
    const existing = { id: 'x1', type: 'entrada', subcategory: 'Bonus', created_at: '2026-01-01T00:00:00.000Z', user_id: 'u1' };
    const result = buildLooseEntryRecord({ person: 'Ana', date: '2026-12-05', description: 'Bônus', amount: 200 }, existing, now);
    expect(result.record).toMatchObject({
      id: 'x1',
      user_id: 'u1',
      subcategory: 'Bonus',
      competence: '2026-12',
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: now.toISOString()
    });
  });
});
