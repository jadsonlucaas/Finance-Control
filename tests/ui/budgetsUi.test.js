import { describe, expect, it, vi } from 'vitest';
import { collectCategoryNames, installBudgetsUi, renderBudgetsView } from '../../src/ui/budgets/budgetsUi.js';
import { ES_ES } from '../../src/i18n/es-ES.js';

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

const records = [
  { type: 'categoria', category_name: 'Lazer', macro_category: 'VARIAVEL' },
  { type: 'saida', status: 'Pago', amount: 300, category_name: 'Alimentação', competence: '2026-11' },
  { type: 'saida', status: 'Em aberto', amount: 150, category_name: 'alimentacao', competence: '2026-11' },
  { type: 'saida', status: 'Pago', amount: 80, category_name: 'Transporte', competence: '2026-11' }
];
const budgets = [
  { id: 'cat_alimentacao', scope: 'category', category_name: 'Alimentação', limits: { '2026-11': 500 } },
  { id: 'total', scope: 'total', limits: { '2026-11': 2000 } }
];

describe('tela de orcamentos: render', () => {
  it('lista categorias cadastradas e usadas, sem repetir', () => {
    expect(collectCategoryNames(records)).toEqual(['Alimentação', 'Lazer', 'Transporte']);
  });

  it('mostra total, categoria com barra e percentual, e gasto sem limite', () => {
    const html = renderBudgetsView({ competence: '2026-11', records, budgets, categories: collectCategoryNames(records), form: {} });
    expect(html).toContain('Orçamento total do mês');
    expect(html).toContain('data-budget-row="total"');
    expect(html).toContain('data-budget-row="cat_alimentacao"');
    expect(html).toContain('90%');
    expect(html).toContain('Perto do limite');
    expect(html).toContain('aria-valuenow="90"');
    expect(html).toContain('Gastos em categorias sem limite');
    // nome da categoria nao e traduzido
    expect(html).toMatch(/data-i18n-skip>Alimentação</);
  });

  it('estados de carregamento, erro e vazio', () => {
    expect(renderBudgetsView({ competence: '2026-11', loading: true })).toContain('aria-busy="true"');
    expect(renderBudgetsView({ competence: '2026-11', error: new Error('x') })).toContain('data-budget-retry');
    const empty = renderBudgetsView({ competence: '2026-11', records: [], budgets: [], categories: [], form: {} });
    expect(empty).toContain('Você ainda não definiu um limite total');
    expect(empty).toContain('Nenhum limite por categoria neste mês');
  });

  it('escapa nomes de categoria', () => {
    const html = renderBudgetsView({
      competence: '2026-11',
      records: [],
      budgets: [{ id: 'cat_x', scope: 'category', category_name: '<img src=x>', limits: { '2026-11': 1 } }],
      categories: ['<b>'],
      form: {}
    });
    expect(html).not.toContain('<img src=x>');
    expect(html).not.toContain('<b>');
  });

  it('textos da tela tem traducao para espanhol', () => {
    ['Orçamentos', 'Orçamento total do mês', 'Limites por categoria', 'Perto do limite', 'Total do mês (todas as categorias)']
      .forEach((text) => expect(ES_ES.messages[text]).toBeTruthy());
    const [pattern, replacement] = ES_ES.patterns.find(([regex]) => regex.test('Vale a partir de nov/2026 e se repete nos meses seguintes. Os meses anteriores não mudam.'));
    expect('Vale a partir de nov/2026 e se repete nos meses seguintes. Os meses anteriores não mudam.'.replace(pattern, replacement)).toContain('Se aplica desde nov/2026');
  });
});

function fakeWindow() {
  const listeners = {};
  const view = { classList: { contains: () => false }, innerHTML: '' };
  const inputs = { 'budget-target': { value: '' }, 'budget-amount': { value: '' } };
  const documentRef = {
    getElementById: (id) => (id === 'view-orcamentos' ? view : (inputs[id] || null)),
    addEventListener: (type, fn) => { (listeners[type] ||= []).push(fn); }
  };
  const target = { document: documentRef, financeApp: {}, allRecords: records, addEventListener: () => {} };
  const form = { querySelector: (selector) => inputs[selector.slice(1)] };
  const submit = () => (listeners.submit || []).forEach((fn) => fn({ target: { closest: (sel) => (sel === '[data-budget-form]' ? form : null) }, preventDefault: vi.fn() }));
  const click = (attrs) => (listeners.click || []).forEach((fn) => fn({
    target: { closest: () => ({ hasAttribute: (name) => name in attrs, getAttribute: (name) => attrs[name] }) }
  }));
  const change = (id, value) => (listeners.change || []).forEach((fn) => fn({ target: { id, value } }));
  return { target, view, inputs, submit, click, change };
}

function fakeService() {
  let listener;
  return {
    subscribeBudgets: vi.fn((uid, onChange) => { listener = onChange; return vi.fn(); }),
    emit: (list) => listener(list),
    saveBudgetLimit: vi.fn(async () => ({})),
    deleteBudget: vi.fn(async () => {})
  };
}

describe('tela de orcamentos: interacao', () => {
  function setup() {
    const fake = fakeWindow();
    const service = fakeService();
    const api = installBudgetsUi(fake.target, { getService: () => service, getUid: () => 'alice' });
    api.state.competence = '2026-11';
    return { ...fake, service, api };
  }

  it('escuta os orcamentos em tempo real e redesenha quando mudam', () => {
    const { target, view, service } = setup();
    target.renderOrcamentos();
    expect(service.subscribeBudgets).toHaveBeenCalledWith('alice', expect.any(Function), expect.any(Function));
    expect(view.innerHTML).toContain('aria-busy="true"');
    service.emit(budgets);
    expect(view.innerHTML).toContain('data-budget-row="cat_alimentacao"');
    service.emit([]);
    expect(view.innerHTML).not.toContain('data-budget-row="cat_alimentacao"');
  });

  it('salva limite do mes escolhido aceitando "1.234,56"', async () => {
    const { target, inputs, submit, service, view } = setup();
    target.renderOrcamentos();
    service.emit([]);
    inputs['budget-target'].value = 'Lazer';
    inputs['budget-amount'].value = '1.234,56';
    submit();
    await flush();
    expect(service.saveBudgetLimit).toHaveBeenCalledWith('alice', { scope: 'category', category_name: 'Lazer', competence: '2026-11', amount: 1234.56 });
    expect(view.innerHTML).toContain('Limite salvo.');
  });

  it('total do mes e validacao de valor', async () => {
    const { target, inputs, submit, service, view } = setup();
    target.renderOrcamentos();
    service.emit([]);
    inputs['budget-target'].value = '__total__';
    inputs['budget-amount'].value = 'abc';
    submit();
    await flush();
    expect(service.saveBudgetLimit).not.toHaveBeenCalled();
    expect(view.innerHTML).toContain('Informe um valor válido');
    inputs['budget-amount'].value = '3000';
    submit();
    await flush();
    expect(service.saveBudgetLimit).toHaveBeenCalledWith('alice', { scope: 'total', category_name: '', competence: '2026-11', amount: 3000 });
  });

  it('remover pede confirmacao antes de apagar', async () => {
    const { target, click, service, view } = setup();
    target.renderOrcamentos();
    service.emit(budgets);
    click({ 'data-budget-delete': 'cat_alimentacao' });
    expect(view.innerHTML).toContain('Confirmar remoção');
    expect(service.deleteBudget).not.toHaveBeenCalled();
    click({ 'data-budget-delete-confirm': 'cat_alimentacao' });
    await flush();
    expect(service.deleteBudget).toHaveBeenCalledWith('alice', 'cat_alimentacao');
  });

  it('trocar o mes recalcula sem nova assinatura', () => {
    const { target, change, service, view } = setup();
    target.renderOrcamentos();
    service.emit(budgets);
    change('budget-month', '2026-10');
    expect(view.innerHTML).toContain('value="2026-10"');
    expect(view.innerHTML).not.toContain('data-budget-row="cat_alimentacao"');
    expect(service.subscribeBudgets).toHaveBeenCalledTimes(1);
  });
});
