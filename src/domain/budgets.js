// Orcamentos mensais: limite por categoria e limite total do mes.
//
// Regra unica usada pelo Dashboard e pela whatsapp-api, para que os dois
// mostrem sempre os mesmos numeros.
//
// Modelo (users/{uid}/budgets/{budgetId}):
//   budgetId  'total' para o limite total do mes, ou 'cat_<slug>' por categoria
//             (id deterministico: duas telas criando a mesma categoria gravam o
//             mesmo documento, sem duplicar).
//   scope     'total' | 'category'
//   category_name  nome exibido da categoria (so quando scope = 'category')
//   limits    { 'YYYY-MM': valor } historico do limite. O limite de um mes e o da
//             maior chave <= aquele mes; antes da primeira chave nao ha orcamento.
//             Mudar o valor "a partir de" um mes nao altera os meses anteriores.
//
// Calculo do mes (mesma regra das consultas do WhatsApp):
//   so despesas (type 'saida'), nao arquivadas, da competencia do mes
//   Cancelado fica de fora; Pago = realizado; o resto (Em aberto, Vencido...) = comprometido
//   disponivel = limite - realizado - comprometido (pode ficar negativo)

import { roundCurrency } from '../core/money.js';
import { normalizeCompetenceKey } from '../core/dates.js';

export const BUDGET_SCHEMA_VERSION = 1;
export const BUDGET_SCOPES = Object.freeze({ TOTAL: 'total', CATEGORY: 'category' });
export const TOTAL_BUDGET_ID = 'total';
export const MAX_BUDGET_AMOUNT = 100000000;
export const MAX_BUDGET_HISTORY = 120;
export const MAX_CATEGORY_NAME_LENGTH = 80;
export const BUDGET_WARNING_PERCENT = 80;

const COMPETENCE_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export function isBudgetCompetence(value) {
  return COMPETENCE_RE.test(String(value || ''));
}

export function normalizeBudgetName(value = '') {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

export function cleanCategoryName(value = '') {
  return String(value ?? '').trim().replace(/\s+/g, ' ').slice(0, MAX_CATEGORY_NAME_LENGTH);
}

export function budgetIdForCategory(categoryName = '') {
  const slug = normalizeBudgetName(categoryName).replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return `cat_${slug || 'sem_categoria'}`;
}

export function budgetIdFor({ scope, category_name: categoryName } = {}) {
  return scope === BUDGET_SCOPES.TOTAL ? TOTAL_BUDGET_ID : budgetIdForCategory(categoryName);
}

/** Valor de limite valido (>= 0, 2 casas) ou null. */
export function normalizeBudgetAmount(value) {
  const number = typeof value === 'string' ? Number(value.replace(',', '.')) : Number(value);
  if (!Number.isFinite(number) || number < 0 || number > MAX_BUDGET_AMOUNT) return null;
  return roundCurrency(number);
}

function normalizeLimits(limits) {
  const clean = {};
  if (!limits || typeof limits !== 'object') return clean;
  Object.entries(limits).forEach(([competence, value]) => {
    const amount = normalizeBudgetAmount(value);
    if (isBudgetCompetence(competence) && amount !== null) clean[competence] = amount;
  });
  return clean;
}

/** Normaliza um documento lido do Firestore. Devolve null se for invalido. */
export function normalizeBudget(raw = {}, id = raw?.id) {
  if (!raw || typeof raw !== 'object') return null;
  const scope = raw.scope === BUDGET_SCOPES.TOTAL ? BUDGET_SCOPES.TOTAL : (raw.scope === BUDGET_SCOPES.CATEGORY ? BUDGET_SCOPES.CATEGORY : null);
  if (!scope) return null;
  const categoryName = scope === BUDGET_SCOPES.CATEGORY ? cleanCategoryName(raw.category_name) : '';
  if (scope === BUDGET_SCOPES.CATEGORY && !categoryName) return null;
  return {
    id: id || budgetIdFor({ scope, category_name: categoryName }),
    scope,
    category_name: categoryName,
    limits: normalizeLimits(raw.limits),
    updated_at: typeof raw.updated_at === 'string' ? raw.updated_at : ''
  };
}

/** Limite vigente no mes, ou null se o orcamento ainda nao existia naquele mes. */
export function limitForCompetence(budget, competence) {
  const target = normalizeCompetenceKey(competence || '');
  if (!budget || !target) return null;
  const keys = Object.keys(budget.limits || {}).filter((key) => key <= target).sort();
  if (!keys.length) return null;
  return budget.limits[keys[keys.length - 1]];
}

/**
 * Novo historico de limites ao definir `amount` a partir de `competence`.
 * Remove os valores de meses posteriores (a nova escolha vale dali em diante)
 * e preserva os meses anteriores.
 */
export function setLimitFrom(limits = {}, competence, amount) {
  if (!isBudgetCompetence(competence)) throw new Error('INVALID_COMPETENCE');
  const value = normalizeBudgetAmount(amount);
  if (value === null) throw new Error('INVALID_AMOUNT');
  const next = {};
  Object.entries(normalizeLimits(limits)).forEach(([key, current]) => {
    if (key < competence) next[key] = current;
  });
  next[competence] = value;
  const keys = Object.keys(next).sort();
  // Guarda so o historico mais recente para o documento nao crescer sem limite.
  return Object.fromEntries(keys.slice(-MAX_BUDGET_HISTORY).map((key) => [key, next[key]]));
}

/** Documento pronto para gravar (sem owner/updated_at, que o servico acrescenta). */
export function buildBudgetDocument({ scope, category_name: categoryName, limits }) {
  const isTotal = scope === BUDGET_SCOPES.TOTAL;
  const name = isTotal ? '' : cleanCategoryName(categoryName);
  if (!isTotal && !name) throw new Error('INVALID_CATEGORY');
  const doc = {
    scope: isTotal ? BUDGET_SCOPES.TOTAL : BUDGET_SCOPES.CATEGORY,
    limits: normalizeLimits(limits),
    schema_version: BUDGET_SCHEMA_VERSION
  };
  if (!isTotal) doc.category_name = name;
  return doc;
}

// Mesma regra de getRecordCompetence (application/selectors/dashboardFilters.js).
function recordCompetence(record = {}) {
  return normalizeCompetenceKey(record.competence || record.competencia || record.due_date || record.occurred_date || '') || '';
}

function recordCategoryName(record = {}) {
  return String(record.category_name || record.subcategory || '').trim();
}

/** Despesas validas do mes: nao arquivadas, nao canceladas, da competencia. */
export function budgetExpensesFor(records = [], competence) {
  const target = normalizeCompetenceKey(competence || '');
  return (Array.isArray(records) ? records : []).filter((record) =>
    record
    && record.type === 'saida'
    && record.archived !== true
    && record.status !== 'Cancelado'
    && recordCompetence(record) === target);
}

function spendOf(expenses) {
  let realizado = 0;
  let comprometido = 0;
  expenses.forEach((record) => {
    const value = Number(record.amount) || 0;
    if (record.status === 'Pago') realizado += value;
    else comprometido += value;
  });
  return { realizado: roundCurrency(realizado), comprometido: roundCurrency(comprometido), quantidade: expenses.length };
}

export function budgetState(percent) {
  if (percent > 100) return 'estourado';
  if (percent >= 100) return 'no_limite';
  if (percent >= BUDGET_WARNING_PERCENT) return 'alerta';
  return 'ok';
}

function statusLine(limit, spend) {
  const usado = roundCurrency(spend.realizado + spend.comprometido);
  const disponivel = roundCurrency(limit - usado);
  const percentual = limit > 0 ? Math.round((usado / limit) * 1000) / 10 : (usado > 0 ? 100.1 : 0);
  return {
    limite: limit,
    realizado: spend.realizado,
    comprometido: spend.comprometido,
    usado,
    disponivel,
    percentual,
    estado: budgetState(percentual),
    quantidade: spend.quantidade
  };
}

/**
 * Situacao dos orcamentos no mes.
 * Devolve { competencia, total, categorias[], sem_orcamento }.
 *  total: linha do limite total (null se nao houver limite total no mes); sempre
 *         considera todas as despesas do mes.
 *  categorias: uma linha por orcamento de categoria vigente no mes.
 *  sem_orcamento: gasto do mes em categorias sem limite (realizado/comprometido).
 */
export function buildBudgetStatus(records = [], budgets = [], competence) {
  const target = normalizeCompetenceKey(competence || '');
  if (!isBudgetCompetence(target)) throw new Error('INVALID_COMPETENCE');
  const expenses = budgetExpensesFor(records, target);
  const normalized = (Array.isArray(budgets) ? budgets : []).map((budget) => normalizeBudget(budget)).filter(Boolean);

  const byCategory = new Map();
  expenses.forEach((record) => {
    const key = normalizeBudgetName(recordCategoryName(record));
    const list = byCategory.get(key) || [];
    list.push(record);
    byCategory.set(key, list);
  });

  const covered = new Set();
  const categorias = normalized
    .filter((budget) => budget.scope === BUDGET_SCOPES.CATEGORY)
    .map((budget) => {
      const limit = limitForCompetence(budget, target);
      if (limit === null) return null;
      const key = normalizeBudgetName(budget.category_name);
      covered.add(key);
      return { id: budget.id, categoria: budget.category_name, ...statusLine(limit, spendOf(byCategory.get(key) || [])) };
    })
    .filter(Boolean)
    .sort((a, b) => b.percentual - a.percentual || a.categoria.localeCompare(b.categoria));

  const totalBudget = normalized.find((budget) => budget.scope === BUDGET_SCOPES.TOTAL);
  const totalLimit = totalBudget ? limitForCompetence(totalBudget, target) : null;
  const allSpend = spendOf(expenses);
  const uncovered = expenses.filter((record) => !covered.has(normalizeBudgetName(recordCategoryName(record))));

  return {
    competencia: target,
    total: totalLimit === null ? null : { id: TOTAL_BUDGET_ID, ...statusLine(totalLimit, allSpend) },
    gasto_mes: allSpend,
    categorias,
    sem_orcamento: spendOf(uncovered)
  };
}

/** Procura o orcamento de uma categoria pelo nome (sem acento/caixa; aceita trecho). */
export function findCategoryBudgetStatus(status, categoryName = '') {
  const wanted = normalizeBudgetName(categoryName);
  if (!wanted || !status) return null;
  const list = status.categorias || [];
  return list.find((item) => normalizeBudgetName(item.categoria) === wanted)
    || list.find((item) => normalizeBudgetName(item.categoria).includes(wanted) || wanted.includes(normalizeBudgetName(item.categoria)))
    || null;
}
