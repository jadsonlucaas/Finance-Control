import { badRequest } from './errors.js';

/** Mesmos padroes que o app cria em shared_macros/shared_categories (src/services/dataSdk.js). */
export const DEFAULT_MACROS = Object.freeze(['FIXO', 'VARIAVEL', 'RESERVA']);
export const DEFAULT_CATEGORIES = Object.freeze([
  { macro: 'FIXO', nome: 'Habitação' },
  { macro: 'FIXO', nome: 'Assinaturas' },
  { macro: 'FIXO', nome: 'Educação' },
  { macro: 'FIXO', nome: 'Transporte' },
  { macro: 'VARIAVEL', nome: 'Alimentação' },
  { macro: 'VARIAVEL', nome: 'Lazer' },
  { macro: 'VARIAVEL', nome: 'Vestuário' },
  { macro: 'VARIAVEL', nome: 'Cuidados pessoais' },
  { macro: 'VARIAVEL', nome: 'Outros' },
  { macro: 'RESERVA', nome: 'Investimentos' },
  { macro: 'RESERVA', nome: 'Reserva de emergência' }
]);
export const MAX_PAYMENT_OPTIONS = 15;
const IGNORED_PAYMENT_METHODS = new Set(['regra percentual']);

export function normalizeKey(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function macroOrder(macro) {
  const index = DEFAULT_MACROS.indexOf(String(macro || '').toUpperCase());
  return index === -1 ? DEFAULT_MACROS.length : index;
}

function isActiveReference(record) {
  return record && record.archived !== true && record.deleted !== true;
}

/** Macros e categorias efetivas (globais + pessoais), sem duplicatas. */
export function buildReferenceCatalog(referenceRecords = []) {
  const active = referenceRecords.filter(isActiveReference);
  const macros = new Map();
  const categories = new Map();

  active.forEach((record) => {
    const macro = String(record.macro_category || '').trim();
    if (macro) macros.set(normalizeKey(macro), macro);
    if (record.type !== 'categoria') return;
    const nome = String(record.category_name || record.subcategory || '').trim();
    if (!nome) return;
    const key = `${normalizeKey(macro)}|${normalizeKey(nome)}`;
    if (!categories.has(key)) categories.set(key, { nome, macro });
  });

  if (!categories.size) {
    DEFAULT_CATEGORIES.forEach((item) => {
      categories.set(`${normalizeKey(item.macro)}|${normalizeKey(item.nome)}`, { ...item });
      macros.set(normalizeKey(item.macro), item.macro);
    });
  }
  if (!macros.size) DEFAULT_MACROS.forEach((macro) => macros.set(normalizeKey(macro), macro));

  const macroList = [...macros.values()].sort((a, b) => macroOrder(a) - macroOrder(b) || a.localeCompare(b, 'pt-BR'));
  const categoryList = [...categories.values()].sort((a, b) =>
    macroOrder(a.macro) - macroOrder(b.macro) || a.nome.localeCompare(b.nome, 'pt-BR'));
  return { macros: macroList, categorias: categoryList };
}

/** Formas de pagamento ja usadas pelo usuario em despesas, das mais usadas para as menos usadas. */
export function buildPaymentMethods(financeRecords = [], limit = MAX_PAYMENT_OPTIONS) {
  const counts = new Map();
  financeRecords
    .filter((record) => record && record.type === 'saida' && record.archived !== true)
    .forEach((record) => {
      const label = String(record.payment_method || '').trim();
      const key = normalizeKey(label);
      if (!key || IGNORED_PAYMENT_METHODS.has(key)) return;
      const current = counts.get(key) || { nome: label, quantidade: 0 };
      current.quantidade += 1;
      counts.set(key, current);
    });
  return [...counts.values()]
    .sort((a, b) => b.quantidade - a.quantidade || a.nome.localeCompare(b.nome, 'pt-BR'))
    .slice(0, limit)
    .map((item) => item.nome);
}

export function buildOpcoes(referenceRecords, financeRecords, body = {}) {
  const catalog = buildReferenceCatalog(referenceRecords);
  let categorias = catalog.categorias;
  if (body.macro) {
    const wanted = normalizeKey(body.macro);
    categorias = categorias.filter((item) => normalizeKey(item.macro) === wanted);
  }
  return {
    macros: catalog.macros,
    categorias,
    formas_pagamento: buildPaymentMethods(financeRecords),
    regras: {
      categoria: 'Despesas precisam de uma categoria desta lista; a macro vem da categoria.',
      forma_pagamento: 'Use uma das formas listadas ou um texto novo, se o usuario pedir.'
    }
  };
}

/**
 * Valida a categoria de uma despesa contra o catalogo e devolve os nomes canonicos.
 * A macro e preenchida pela categoria quando nao for informada.
 */
export function resolveExpenseCategory(catalog, categoria, macro) {
  const nameKey = normalizeKey(categoria);
  if (!nameKey) throw badRequest('CATEGORY_REQUIRED', 'Informe a categoria da despesa.');
  let matches = catalog.categorias.filter((item) => normalizeKey(item.nome) === nameKey);
  if (macro) {
    const macroKey = normalizeKey(macro);
    const sameMacro = matches.filter((item) => normalizeKey(item.macro) === macroKey);
    if (!sameMacro.length && matches.length) {
      throw badRequest('CATEGORY_MACRO_MISMATCH', `A categoria ${matches[0].nome} pertence a ${matches.map((item) => item.macro).join(' ou ')}.`);
    }
    matches = sameMacro;
  }
  if (!matches.length) {
    const sugestoes = catalog.categorias.slice(0, 12).map((item) => item.nome).join(', ');
    throw badRequest('CATEGORY_NOT_FOUND', `Categoria nao cadastrada. Opcoes: ${sugestoes}.`);
  }
  return { category_name: matches[0].nome, macro_category: matches[0].macro };
}

/** Reaproveita a grafia exata de uma forma de pagamento ja usada (comparacao sem acento/caixa). */
export function canonicalPaymentMethod(paymentMethods, value) {
  const key = normalizeKey(value);
  if (!key) return undefined;
  return paymentMethods.find((item) => normalizeKey(item) === key) || String(value).trim();
}
