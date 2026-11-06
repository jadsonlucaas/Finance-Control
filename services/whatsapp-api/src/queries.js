import { getRecordCompetence } from '../../../src/application/selectors/dashboardFilters.js';
import { getConsolidatedEntryAmount } from '../../../src/application/selectors/financialSelectors.js';
import { badRequest } from './errors.js';
import { addDays, currentCompetence, isCompetence, isDate, todayIn } from './dates.js';
import { formatBRL, roundCurrency } from './money.js';

export const EXPENSE_OPEN_STATUSES = Object.freeze(['Em aberto', 'Vencido', '']);
export const MAX_LIST_LIMIT = 50;
export const DEFAULT_LIST_LIMIT = 20;

const TYPE_ALIASES = Object.freeze({ despesa: 'saida', saida: 'saida', receita: 'entrada', entrada: 'entrada' });

function sum(records, valueOf) {
  return roundCurrency(records.reduce((acc, record) => acc + (Number(valueOf(record)) || 0), 0));
}

function expenseAmount(record) {
  return roundCurrency(Number(record.amount) || 0);
}

export function recordAmount(record) {
  return record.type === 'entrada' ? getConsolidatedEntryAmount(record) : expenseAmount(record);
}

function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

export function resolveCompetence(value, now) {
  if (value === undefined || value === null || value === '') return currentCompetence(now);
  if (!isCompetence(value)) throw badRequest('INVALID_COMPETENCE', 'Competencia deve usar o formato YYYY-MM.');
  return String(value);
}

export const MAX_PERIOD_MONTHS = 24;

function competenceIndex(competence) {
  const [year, month] = competence.split('-').map(Number);
  return year * 12 + (month - 1);
}

function competenceFromIndex(index) {
  const year = Math.floor(index / 12);
  const month = (index % 12) + 1;
  return `${year}-${String(month).padStart(2, '0')}`;
}

/**
 * Resolve um mes (competencia) ou um periodo (competencia_inicio..competencia_fim).
 * Devolve { inicio, fim, meses: [YYYY-MM...] }. Periodo maximo de 24 meses.
 */
export function resolvePeriod(body = {}, now) {
  const hasStart = body.competencia_inicio !== undefined && body.competencia_inicio !== null && body.competencia_inicio !== '';
  const hasEnd = body.competencia_fim !== undefined && body.competencia_fim !== null && body.competencia_fim !== '';
  if (!hasStart && !hasEnd) {
    const competence = resolveCompetence(body.competencia, now);
    return { inicio: competence, fim: competence, meses: [competence] };
  }
  const inicio = resolveCompetence(hasStart ? body.competencia_inicio : body.competencia_fim, now);
  const fim = resolveCompetence(hasEnd ? body.competencia_fim : currentCompetence(now), now);
  const start = competenceIndex(inicio);
  const end = competenceIndex(fim);
  if (start > end) throw badRequest('INVALID_PERIOD', 'competencia_inicio deve ser anterior ou igual a competencia_fim.');
  if (end - start + 1 > MAX_PERIOD_MONTHS) throw badRequest('INVALID_PERIOD', `Periodo maximo de ${MAX_PERIOD_MONTHS} meses.`);
  const meses = [];
  for (let index = start; index <= end; index += 1) meses.push(competenceFromIndex(index));
  return { inicio, fim, meses };
}

function isPeriod(period) {
  return period.meses.length > 1;
}

function periodInfo(period) {
  return { inicio: period.inicio, fim: period.fim, quantidade_meses: period.meses.length, meses: period.meses };
}

function byPeriod(records, period) {
  const months = new Set(period.meses);
  return records.filter((record) => months.has(getRecordCompetence(record)));
}

export function activeFinanceRecords(records = []) {
  return records.filter((record) => record && record.archived !== true && (record.type === 'saida' || record.type === 'entrada'));
}

function byCompetence(records, competence) {
  return records.filter((record) => getRecordCompetence(record) === competence);
}

export function toPublicRecord(record) {
  return {
    id: record.id,
    tipo: record.type === 'entrada' ? 'receita' : 'despesa',
    descricao: record.description || record.purchase_name || record.category_name || '',
    valor: recordAmount(record),
    valor_formatado: formatBRL(recordAmount(record)),
    status: record.status || '',
    categoria: record.category_name || record.subcategory || '',
    macro_categoria: record.macro_category || '',
    competencia: getRecordCompetence(record),
    vencimento: record.due_date || '',
    data: record.occurred_date || '',
    pago_em: record.paid_at || '',
    pessoa: record.person || '',
    forma_pagamento: record.payment_method || '',
    parcela: Number(record.total_installments || 0) > 1
      ? `${Number(record.installment_no || 0)}/${Number(record.total_installments)}`
      : ''
  };
}

export function splitExpenses(saidas) {
  const valid = saidas.filter((record) => record.status !== 'Cancelado');
  const pagas = valid.filter((record) => record.status === 'Pago');
  const abertas = valid.filter((record) => EXPENSE_OPEN_STATUSES.includes(record.status || ''));
  return { valid, pagas, abertas };
}

export function splitIncomes(entradas) {
  const valid = entradas.filter((record) => record.status !== 'Cancelado');
  const pendentes = valid.filter((record) => record.status === 'Pendente');
  const recebidas = valid.filter((record) => record.status !== 'Pendente');
  return { valid, pendentes, recebidas };
}

/** Contrato compativel com a API readonly atual (/internal/whatsapp/despesas). */
export function buildLegacyDespesas(records, competence) {
  const saidas = byCompetence(activeFinanceRecords(records), competence).filter((record) => record.type === 'saida');
  const { valid, pagas } = splitExpenses(saidas);
  return {
    competencia: competence,
    totalDespesas: sum(valid, expenseAmount),
    despesasPagas: sum(pagas, expenseAmount),
    quantidadeDespesas: valid.length,
    quantidadePagas: pagas.length
  };
}

function summarizeRecords(monthRecords) {
  const saidas = monthRecords.filter((record) => record.type === 'saida');
  const entradas = monthRecords.filter((record) => record.type === 'entrada');
  const despesas = splitExpenses(saidas);
  const receitas = splitIncomes(entradas);

  const totalDespesas = sum(despesas.valid, expenseAmount);
  const despesasPagas = sum(despesas.pagas, expenseAmount);
  const despesasEmAberto = sum(despesas.abertas, expenseAmount);
  const totalReceitas = sum(receitas.valid, getConsolidatedEntryAmount);
  const receitasRecebidas = sum(receitas.recebidas, getConsolidatedEntryAmount);
  const receitasPendentes = sum(receitas.pendentes, getConsolidatedEntryAmount);
  const saldoRealizado = roundCurrency(receitasRecebidas - despesasPagas);
  const saldoPrevisto = roundCurrency(totalReceitas - totalDespesas);

  const values = {
    total_despesas: totalDespesas,
    despesas_pagas: despesasPagas,
    despesas_em_aberto: despesasEmAberto,
    total_receitas: totalReceitas,
    receitas_recebidas: receitasRecebidas,
    receitas_pendentes: receitasPendentes,
    saldo_realizado: saldoRealizado,
    saldo_previsto: saldoPrevisto
  };

  return {
    values,
    quantidade: {
      despesas: despesas.valid.length,
      despesas_pagas: despesas.pagas.length,
      despesas_em_aberto: despesas.abertas.length,
      receitas: receitas.valid.length,
      receitas_pendentes: receitas.pendentes.length
    }
  };
}

function formatValues(values) {
  return Object.fromEntries(Object.entries(values).map(([key, value]) => [key, formatBRL(value)]));
}

const RESUMO_RULES = Object.freeze({
  saldo_realizado: 'receitas recebidas - despesas pagas',
  saldo_previsto: 'total de receitas - total de despesas (cancelados ficam de fora)'
});

/** Aceita uma competencia (YYYY-MM) ou um periodo vindo de resolvePeriod. */
export function buildResumo(records, competenceOrPeriod) {
  const period = typeof competenceOrPeriod === 'string'
    ? { inicio: competenceOrPeriod, fim: competenceOrPeriod, meses: [competenceOrPeriod] }
    : competenceOrPeriod;
  const active = activeFinanceRecords(records);
  const { values, quantidade } = summarizeRecords(byPeriod(active, period));

  if (!isPeriod(period)) {
    return { competencia: period.inicio, ...values, formatado: formatValues(values), quantidade, regras: RESUMO_RULES };
  }

  const porMes = period.meses.map((competence) => {
    const month = summarizeRecords(byCompetence(active, competence)).values;
    return {
      competencia: competence,
      total_despesas: month.total_despesas,
      total_receitas: month.total_receitas,
      saldo_previsto: month.saldo_previsto,
      formatado: {
        total_despesas: formatBRL(month.total_despesas),
        total_receitas: formatBRL(month.total_receitas),
        saldo_previsto: formatBRL(month.saldo_previsto)
      }
    };
  });

  return {
    periodo: periodInfo(period),
    ...values,
    formatado: formatValues(values),
    quantidade,
    por_mes: porMes,
    regras: RESUMO_RULES
  };
}

export function parseListFilters(body = {}, now) {
  const filters = {};
  if (body.competencia !== undefined && body.competencia !== null && body.competencia !== '') {
    filters.competencia = resolveCompetence(body.competencia, now);
  }
  if (body.tipo) {
    const type = TYPE_ALIASES[normalizeText(body.tipo)];
    if (!type) throw badRequest('INVALID_TYPE', 'Tipo deve ser despesa ou receita.');
    filters.type = type;
  }
  if (body.status) filters.status = String(body.status);
  if (body.categoria) filters.categoria = normalizeText(body.categoria);
  if (body.busca) filters.busca = normalizeText(body.busca);
  const limit = body.limite === undefined ? DEFAULT_LIST_LIMIT : Number(body.limite);
  if (!Number.isInteger(limit) || limit < 1) throw badRequest('INVALID_LIMIT', 'Limite deve ser inteiro positivo.');
  filters.limit = Math.min(limit, MAX_LIST_LIMIT);
  return filters;
}

function sortKey(record) {
  return String(record.due_date || record.occurred_date || record.competence || '');
}

export function buildLancamentos(records, filters) {
  let list = activeFinanceRecords(records);
  if (filters.competencia) list = byCompetence(list, filters.competencia);
  if (filters.type) list = list.filter((record) => record.type === filters.type);
  if (filters.status) {
    const status = normalizeText(filters.status);
    list = list.filter((record) => {
      const current = normalizeText(record.status);
      if (status === 'em aberto' || status === 'aberto' || status === 'pendente') {
        return record.type === 'saida' ? EXPENSE_OPEN_STATUSES.includes(record.status || '') : record.status === 'Pendente';
      }
      return current === status;
    });
  }
  if (filters.categoria) {
    list = list.filter((record) =>
      normalizeText(record.category_name).includes(filters.categoria) ||
      normalizeText(record.macro_category).includes(filters.categoria) ||
      normalizeText(record.subcategory).includes(filters.categoria));
  }
  if (filters.busca) {
    list = list.filter((record) =>
      normalizeText(record.description).includes(filters.busca) ||
      normalizeText(record.purchase_name).includes(filters.busca) ||
      normalizeText(record.category_name).includes(filters.busca) ||
      normalizeText(record.person).includes(filters.busca));
  }
  const sorted = [...list].sort((a, b) => sortKey(b).localeCompare(sortKey(a)));
  const items = sorted.slice(0, filters.limit).map(toPublicRecord);
  const total = sum(list, recordAmount);
  return {
    filtros: {
      competencia: filters.competencia || '',
      tipo: filters.type ? (filters.type === 'entrada' ? 'receita' : 'despesa') : '',
      status: filters.status || '',
      categoria: filters.categoria || '',
      busca: filters.busca || ''
    },
    quantidade_encontrada: list.length,
    quantidade_retornada: items.length,
    valor_total: total,
    valor_total_formatado: formatBRL(total),
    truncado: list.length > items.length,
    lancamentos: items
  };
}

/** Aceita uma competencia (YYYY-MM) ou um periodo vindo de resolvePeriod. */
export function buildCategorias(records, competenceOrPeriod) {
  const period = typeof competenceOrPeriod === 'string'
    ? { inicio: competenceOrPeriod, fim: competenceOrPeriod, meses: [competenceOrPeriod] }
    : competenceOrPeriod;
  const saidas = byPeriod(activeFinanceRecords(records), period)
    .filter((record) => record.type === 'saida' && record.status !== 'Cancelado');
  const groups = new Map();
  saidas.forEach((record) => {
    const name = String(record.category_name || record.subcategory || 'Sem categoria').trim() || 'Sem categoria';
    const group = groups.get(name) || { categoria: name, macro_categoria: record.macro_category || '', total: 0, pago: 0, em_aberto: 0, quantidade: 0 };
    const value = expenseAmount(record);
    group.total = roundCurrency(group.total + value);
    if (record.status === 'Pago') group.pago = roundCurrency(group.pago + value);
    else group.em_aberto = roundCurrency(group.em_aberto + value);
    group.quantidade += 1;
    groups.set(name, group);
  });
  const total = sum(saidas, expenseAmount);
  const categorias = [...groups.values()]
    .sort((a, b) => b.total - a.total)
    .map((group) => ({
      ...group,
      total_formatado: formatBRL(group.total),
      percentual: total > 0 ? Math.round((group.total / total) * 1000) / 10 : 0
    }));
  const base = { total_despesas: total, total_despesas_formatado: formatBRL(total), categorias };
  return isPeriod(period) ? { periodo: periodInfo(period), ...base } : { competencia: period.inicio, ...base };
}

export function buildVencimentos(records, body = {}, now) {
  const days = body.dias === undefined ? 7 : Number(body.dias);
  if (!Number.isInteger(days) || days < 0 || days > 90) throw badRequest('INVALID_DAYS', 'Dias deve ser inteiro entre 0 e 90.');
  const today = todayIn(now);
  const limitDate = addDays(today, days);
  const open = activeFinanceRecords(records).filter((record) =>
    record.type === 'saida' &&
    EXPENSE_OPEN_STATUSES.includes(record.status || '') &&
    isDate(record.due_date) &&
    record.due_date <= limitDate);
  const atrasadas = open.filter((record) => record.due_date < today);
  const aVencer = open.filter((record) => record.due_date >= today);
  const map = (list) => list
    .sort((a, b) => a.due_date.localeCompare(b.due_date))
    .map((record) => ({ ...toPublicRecord(record), atrasado: record.due_date < today }));
  return {
    hoje: today,
    ate: limitDate,
    atrasadas: { quantidade: atrasadas.length, total: sum(atrasadas, expenseAmount), total_formatado: formatBRL(sum(atrasadas, expenseAmount)), itens: map(atrasadas).slice(0, MAX_LIST_LIMIT) },
    a_vencer: { quantidade: aVencer.length, total: sum(aVencer, expenseAmount), total_formatado: formatBRL(sum(aVencer, expenseAmount)), itens: map(aVencer).slice(0, MAX_LIST_LIMIT) }
  };
}
