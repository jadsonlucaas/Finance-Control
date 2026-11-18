import { describe, expect, it } from 'vitest';
import { buildBreakdowns, displayLabel, percentLabel } from '../../src/ui/dashboard/dashboardBreakdowns.js';

describe('distribuicao dos gastos no Inicio', () => {
  const aggregations = {
    total: 1000,
    porCategoria: { FIXO: 965, VARIAVEL: 35 },
    registrosPorCategoria: { FIXO: [{ id: 'a' }], VARIAVEL: [{ id: 'b' }] },
    porSubcategoria: { Lazer: 56, Investimentos: 600, Educação: 344, Vazio: 0 },
    registrosPorSubcategoria: {},
    porPessoa: { Luana: 400, Jadson: 600 },
    registrosPorPessoa: {}
  };

  it('ordena do maior para o menor, ignora zerados e calcula a fatia de cada item', () => {
    const data = buildBreakdowns(aggregations);
    expect(data.total).toBe(1000);
    expect(data.categories.map((item) => [item.name, item.share])).toEqual([['Fixo', 0.965], ['Variável', 0.035]]);
    expect(data.categories[0].records).toEqual([{ id: 'a' }]);
    expect(data.subcategories.map((item) => item.name)).toEqual(['Investimentos', 'Educação', 'Lazer']);
    expect(data.people.map((item) => item.name)).toEqual(['Jadson', 'Luana']);
  });

  it('nomes em caixa alta ficam legiveis; nomes da pessoa ficam como estao', () => {
    expect(displayLabel('VARIAVEL')).toBe('Variável');
    expect(displayLabel('FIXO')).toBe('Fixo');
    expect(displayLabel('MERCADO')).toBe('Mercado');
    expect(displayLabel('Cuidados pessoais')).toBe('Cuidados pessoais');
    expect(displayLabel('')).toBe('Sem categoria');
  });

  it('porcentagem com virgula e no maximo uma casa', () => {
    expect(percentLabel(965, 1000)).toBe('96,5%');
    expect(percentLabel(500, 1000)).toBe('50%');
    expect(percentLabel(35, 1000)).toBe('3,5%');
    expect(percentLabel(0, 1000)).toBe('0%');
    expect(percentLabel(10, 0)).toBe('0%');
  });

  it('FIXO e FIXA viram uma linha so, somando valores e lancamentos', () => {
    const data = buildBreakdowns({
      total: 300,
      porCategoria: { FIXO: 100, FIXA: 150, VARIAVEL: 50 },
      registrosPorCategoria: { FIXO: [{ id: 1 }], FIXA: [{ id: 2 }], VARIAVEL: [{ id: 3 }] }
    });
    expect(data.categories.map((item) => [item.name, item.value, item.records.length])).toEqual([['Fixo', 250, 2], ['Variável', 50, 1]]);
  });

  it('sem gastos devolve listas vazias', () => {
    const data = buildBreakdowns({ total: 0 });
    expect(data.categories).toEqual([]);
    expect(data.people).toEqual([]);
  });
});
