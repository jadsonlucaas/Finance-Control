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

export const MAX_CHOICE_OPTIONS = 10;
const ELLIPSIS = /(?:…|\.\.\.)\s*$/;

/** Compara um texto com uma opcao; aceita a opcao cortada pelo WhatsApp ("Cartão de Crédito - Nub…"). */
function sameOption(option, value) {
  const raw = String(value ?? '').trim();
  if (ELLIPSIS.test(raw)) {
    const prefix = normalizeKey(raw.replace(ELLIPSIS, ''));
    return Boolean(prefix) && normalizeKey(option).startsWith(prefix);
  }
  return normalizeKey(option) === normalizeKey(raw);
}

function uniqueBy(items, key) {
  const seen = new Set();
  return items.filter((item) => {
    const k = normalizeKey(key(item));
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** Lista de opcoes clicaveis: ate 10; se passar disso, 9 + "Outra". */
export function choiceList(names) {
  const list = uniqueBy(names, (name) => name);
  return list.length <= MAX_CHOICE_OPTIONS ? list : [...list.slice(0, MAX_CHOICE_OPTIONS - 1), 'Outra'];
}

function askChoice(code, question, options, extra = {}) {
  const line = `[opcoes: ${options.join(' | ')}]`;
  return badRequest(code, `${question} Pergunte ao usuario e termine a mensagem com esta linha: ${line}`, { pergunta: question, opcoes: options, ...extra });
}

/**
 * Valida a categoria de uma despesa contra o catalogo e devolve os nomes canonicos.
 * A macro e preenchida pela categoria quando ela existe em uma so macro.
 */
export function resolveExpenseCategory(catalog, categoria, macro) {
  const hasCategory = Boolean(normalizeKey(categoria));
  const hasMacro = Boolean(normalizeKey(macro));
  let macroName;
  if (hasMacro) {
    macroName = catalog.macros.find((item) => sameOption(item, macro));
    if (!macroName) throw askChoice('MACRO_NOT_FOUND', `A macro ${String(macro).trim()} nao existe. Qual macro?`, choiceList(catalog.macros));
  }
  const byName = hasCategory ? catalog.categorias.filter((item) => sameOption(item.nome, categoria)) : [];

  if (!macroName) {
    const macrosOfCategory = uniqueBy(byName.map((item) => item.macro), (item) => item);
    if (macrosOfCategory.length === 1) return { category_name: byName[0].nome, macro_category: byName[0].macro };
    const options = macrosOfCategory.length > 1 ? macrosOfCategory : catalog.macros;
    const question = macrosOfCategory.length > 1
      ? `A categoria ${byName[0].nome} existe em mais de uma macro. Qual macro?`
      : hasCategory ? `A categoria ${String(categoria).trim()} nao esta cadastrada. Primeiro, qual macro?` : 'Qual a macro da despesa?';
    throw askChoice(hasCategory && !byName.length ? 'CATEGORY_NOT_FOUND' : 'MACRO_REQUIRED', question, choiceList(options));
  }

  const inMacro = catalog.categorias.filter((item) => normalizeKey(item.macro) === normalizeKey(macroName));
  const match = byName.find((item) => normalizeKey(item.macro) === normalizeKey(macroName));
  if (match) return { category_name: match.nome, macro_category: match.macro };
  const names = inMacro.map((item) => item.nome);
  if (normalizeKey(categoria) === 'outra' && names.length > MAX_CHOICE_OPTIONS) {
    throw askChoice('CATEGORY_REQUIRED', `Outras categorias de ${macroName}:`, choiceList(names.slice(MAX_CHOICE_OPTIONS - 1)), { macro: macroName });
  }
  const options = choiceList(names);
  if (!hasCategory) throw askChoice('CATEGORY_REQUIRED', `Qual a categoria (${macroName})?`, options, { macro: macroName });
  if (byName.length) {
    throw askChoice('CATEGORY_MACRO_MISMATCH', `A categoria ${byName[0].nome} nao existe em ${macroName}. Qual categoria de ${macroName}?`, options, { macro: macroName });
  }
  throw askChoice('CATEGORY_NOT_FOUND', `A categoria ${String(categoria).trim()} nao esta cadastrada em ${macroName}. Qual categoria?`, options, { macro: macroName });
}

/** Exige a forma de pagamento da despesa e reaproveita a grafia de uma ja usada. */
export function resolvePaymentMethod(paymentMethods, value) {
  const raw = String(value ?? '').trim();
  if (!normalizeKey(raw) || normalizeKey(raw) === 'outra') {
    const options = choiceList([...paymentMethods.slice(0, MAX_CHOICE_OPTIONS - 1), 'Outra']);
    if (!paymentMethods.length || normalizeKey(raw) === 'outra') {
      throw badRequest('PAYMENT_REQUIRED', 'Qual a forma de pagamento? Peca para o usuario digitar (ex.: Pix, Dinheiro, Cartao Nubank).', { pergunta: 'Qual a forma de pagamento?', opcoes: [] });
    }
    throw askChoice('PAYMENT_REQUIRED', 'Qual a forma de pagamento?', options);
  }
  return paymentMethods.find((item) => sameOption(item, raw)) || raw.replace(ELLIPSIS, '').trim();
}

/** Reaproveita a grafia exata de uma forma de pagamento ja usada (comparacao sem acento/caixa). */
export function canonicalPaymentMethod(paymentMethods, value) {
  const key = normalizeKey(value);
  if (!key) return undefined;
  return paymentMethods.find((item) => sameOption(item, value)) || String(value).trim();
}
