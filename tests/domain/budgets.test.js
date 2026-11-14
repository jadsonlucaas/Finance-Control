import { describe, expect, it } from 'vitest';
import {
  budgetIdFor,
  budgetIdForCategory,
  buildBudgetDocument,
  buildBudgetStatus,
  findCategoryBudgetStatus,
  limitForCompetence,
  normalizeBudget,
  normalizeBudgetAmount,
  setLimitFrom
} from '../../src/domain/budgets.js';

const expense = (overrides = {}) => ({
  type: 'saida',
  status: 'Pago',
  amount: 10,
  category_name: 'Alimentação',
  competence: '2026-11',
  ...overrides
});

describe('orcamentos: ids e normalizacao', () => {
  it('gera id deterministico por categoria, sem acento e caixa', () => {
    expect(budgetIdForCategory('Alimentação')).toBe('cat_alimentacao');
    expect(budgetIdForCategory('  alimentacao ')).toBe('cat_alimentacao');
    expect(budgetIdForCategory('Casa & Contas')).toBe('cat_casa_contas');
    expect(budgetIdFor({ scope: 'total' })).toBe('total');
  });

  it('aceita valores com virgula e recusa negativos ou invalidos', () => {
    expect(normalizeBudgetAmount('500,5')).toBe(500.5);
    expect(normalizeBudgetAmount(0)).toBe(0);
    expect(normalizeBudgetAmount(-1)).toBeNull();
    expect(normalizeBudgetAmount('abc')).toBeNull();
  });

  it('descarta documentos invalidos e limites mal formados', () => {
    expect(normalizeBudget({ scope: 'category' })).toBeNull();
    expect(normalizeBudget({ scope: 'x', category_name: 'A' })).toBeNull();
    const budget = normalizeBudget({ scope: 'category', category_name: 'Lazer', limits: { '2026-11': 100, abc: 5, '2026-12': -3 } }, 'cat_lazer');
    expect(budget.limits).toEqual({ '2026-11': 100 });
  });
});

describe('orcamentos: historico de limites', () => {
  const budget = { scope: 'category', category_name: 'Lazer', limits: { '2026-09': 100, '2026-11': 200 } };

  it('usa o limite vigente do mes e nada antes do primeiro', () => {
    expect(limitForCompetence(budget, '2026-08')).toBeNull();
    expect(limitForCompetence(budget, '2026-09')).toBe(100);
    expect(limitForCompetence(budget, '2026-10')).toBe(100);
    expect(limitForCompetence(budget, '2027-03')).toBe(200);
  });

  it('mudar a partir de um mes preserva os anteriores e substitui os seguintes', () => {
    expect(setLimitFrom(budget.limits, '2026-10', 150)).toEqual({ '2026-09': 100, '2026-10': 150 });
    expect(setLimitFrom({}, '2026-11', '300')).toEqual({ '2026-11': 300 });
    expect(() => setLimitFrom({}, '2026-13', 1)).toThrow('INVALID_COMPETENCE');
    expect(() => setLimitFrom({}, '2026-11', -1)).toThrow('INVALID_AMOUNT');
  });

  it('monta o documento de categoria e o total sem nome de categoria', () => {
    expect(buildBudgetDocument({ scope: 'total', category_name: 'x', limits: { '2026-11': 1 } })).toEqual({ scope: 'total', limits: { '2026-11': 1 }, schema_version: 1 });
    expect(buildBudgetDocument({ scope: 'category', category_name: ' Lazer ', limits: {} }).category_name).toBe('Lazer');
    expect(() => buildBudgetDocument({ scope: 'category', category_name: ' ', limits: {} })).toThrow('INVALID_CATEGORY');
  });
});

describe('orcamentos: calculo do mes', () => {
  const budgets = [
    { id: 'cat_alimentacao', scope: 'category', category_name: 'Alimentação', limits: { '2026-11': 500 } },
    { id: 'cat_lazer', scope: 'category', category_name: 'Lazer', limits: { '2026-11': 100 } },
    { id: 'total', scope: 'total', limits: { '2026-10': 1000 } }
  ];
  const records = [
    expense({ amount: 200 }),
    expense({ amount: 150, status: 'Em aberto', category_name: 'alimentacao' }),
    expense({ amount: 50, status: 'Vencido' }),
    expense({ amount: 999, status: 'Cancelado' }),
    expense({ amount: 999, archived: true }),
    expense({ amount: 999, competence: '2026-10' }),
    expense({ amount: 999, type: 'entrada' }),
    expense({ amount: 120, category_name: 'Lazer' }),
    expense({ amount: 30, category_name: 'Transporte', status: 'Em aberto' }),
    expense({ amount: 5, category_name: '', competence: undefined, due_date: '2026-11-20' })
  ];

  it('separa realizado (pago) e comprometido (em aberto/vencido) e ignora cancelados, arquivados, receitas e outros meses', () => {
    const status = buildBudgetStatus(records, budgets, '2026-11');
    const food = status.categorias.find((item) => item.id === 'cat_alimentacao');
    expect(food).toMatchObject({ limite: 500, realizado: 200, comprometido: 200, usado: 400, disponivel: 100, percentual: 80, estado: 'alerta', quantidade: 3 });
  });

  it('marca estourado, ordena por percentual e soma o que nao tem orcamento', () => {
    const status = buildBudgetStatus(records, budgets, '2026-11');
    expect(status.categorias.map((item) => item.id)).toEqual(['cat_lazer', 'cat_alimentacao']);
    expect(status.categorias[0]).toMatchObject({ usado: 120, disponivel: -20, estado: 'estourado' });
    expect(status.sem_orcamento).toEqual({ realizado: 5, comprometido: 30, quantidade: 2 });
  });

  it('limite total usa o valor vigente e todas as despesas do mes', () => {
    const status = buildBudgetStatus(records, budgets, '2026-11');
    expect(status.total).toMatchObject({ limite: 1000, realizado: 325, comprometido: 230, usado: 555, disponivel: 445, percentual: 55.5, estado: 'ok' });
    expect(status.gasto_mes).toEqual({ realizado: 325, comprometido: 230, quantidade: 6 });
  });

  it('meses antes do orcamento nao mostram linha; sem total fica null', () => {
    const status = buildBudgetStatus(records, budgets.slice(0, 2), '2026-10');
    expect(status.categorias).toEqual([]);
    expect(status.total).toBeNull();
  });

  it('limite zero com gasto conta como estourado', () => {
    const status = buildBudgetStatus([expense({ amount: 1 })], [{ scope: 'category', category_name: 'Alimentação', limits: { '2026-11': 0 } }], '2026-11');
    expect(status.categorias[0].estado).toBe('estourado');
  });

  it('recusa competencia invalida', () => {
    expect(() => buildBudgetStatus([], [], 'novembro')).toThrow('INVALID_COMPETENCE');
  });

  it('encontra a categoria pelo nome falado (sem acento, trecho)', () => {
    const status = buildBudgetStatus(records, budgets, '2026-11');
    expect(findCategoryBudgetStatus(status, 'alimentacao').id).toBe('cat_alimentacao');
    expect(findCategoryBudgetStatus(status, 'LAZER').id).toBe('cat_lazer');
    expect(findCategoryBudgetStatus(status, 'aliment').id).toBe('cat_alimentacao');
    expect(findCategoryBudgetStatus(status, 'saude')).toBeNull();
  });
});
