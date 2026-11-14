/**
 * Consulta de orcamento pelo WhatsApp ("quanto ainda posso gastar em alimentacao?").
 *
 * O calculo e o mesmo do Dashboard (src/domain/budgets.js). Aqui so se escolhe a
 * categoria a partir do que o usuario disse (pt ou es, palavras como "comida") e se
 * monta uma frase pronta no idioma dele, que o agente repassa como esta.
 */
import {
  BUDGET_SCOPES,
  TOTAL_BUDGET_ID,
  budgetIdFor,
  buildBudgetDocument,
  buildBudgetStatus,
  findCategoryBudgetStatus,
  normalizeBudget,
  normalizeBudgetAmount,
  normalizeBudgetName,
  setLimitFrom
} from '../../../src/domain/budgets.js';
import { ES_CATEGORIES } from './confirmationText.js';
import { buildReferenceCatalog, keywordCategory } from './references.js';
import { ApiError } from './errors.js';
import { formatMoney, roundCurrency } from './money.js';

const PT_FROM_ES = new Map(Object.entries(ES_CATEGORIES).map(([pt, es]) => [normalizeBudgetName(es), pt]));

function isSpanish(locale) {
  return String(locale || '').toLowerCase().startsWith('es');
}

function categoryLabel(name, es) {
  return es ? ES_CATEGORIES[name] || name : name;
}

function percentText(value) {
  return `${String(value).replace('.', ',')}%`;
}

function monthLabel(competence, currentCompetence, es) {
  if (competence === currentCompetence) return es ? 'este mes' : 'este mês';
  const [year, month] = competence.split('-');
  return es ? `en ${month}/${year}` : `em ${month}/${year}`;
}

/** Categoria pedida -> linha do orcamento (nome direto, nome em espanhol ou palavra-chave). */
export function matchBudgetCategory(status, text = '') {
  const asked = String(text || '').trim();
  if (!asked) return null;
  const direct = findCategoryBudgetStatus(status, asked);
  if (direct) return direct;
  const fromSpanish = PT_FROM_ES.get(normalizeBudgetName(asked));
  if (fromSpanish) {
    const found = findCategoryBudgetStatus(status, fromSpanish);
    if (found) return found;
  }
  const guess = keywordCategory(asked);
  return guess ? findCategoryBudgetStatus(status, guess) : null;
}

/** Nome canonico (pt) da categoria pedida, mesmo sem orcamento, para somar o gasto. */
function canonicalCategory(text) {
  const asked = String(text || '').trim();
  return PT_FROM_ES.get(normalizeBudgetName(asked)) || keywordCategory(asked) || asked;
}

function spentInCategory(records, competence, name) {
  const key = normalizeBudgetName(name);
  const status = buildBudgetStatus(records, [{ scope: 'category', category_name: name, limits: { [competence]: 0 } }], competence);
  const line = status.categorias.find((item) => normalizeBudgetName(item.categoria) === key);
  return line ? line.usado : 0;
}

function lineSentence(label, line, when, es) {
  const used = formatMoney(line.usado);
  const limit = formatMoney(line.limite);
  if (line.disponivel >= 0) {
    return es
      ? `${label}: aún puedes gastar ${formatMoney(line.disponivel)} ${when} (usado ${used} de ${limit}, ${percentText(line.percentual)}).`
      : `${label}: você ainda pode gastar ${formatMoney(line.disponivel)} ${when} (usou ${used} de ${limit}, ${percentText(line.percentual)}).`;
  }
  const over = formatMoney(Math.abs(line.disponivel));
  return es
    ? `${label}: te pasaste del límite en ${over} ${when} (usado ${used} de ${limit}).`
    : `${label}: você passou do limite em ${over} ${when} (usou ${used} de ${limit}).`;
}

function withFormatted(line) {
  if (!line) return line;
  return {
    ...line,
    formatado: {
      limite: formatMoney(line.limite),
      realizado: formatMoney(line.realizado),
      comprometido: formatMoney(line.comprometido),
      usado: formatMoney(line.usado),
      disponivel: formatMoney(line.disponivel)
    }
  };
}

/**
 * @param records lancamentos do usuario
 * @param budgets orcamentos (users/{uid}/budgets)
 * @param options { competencia, categoria, currentCompetence, locale }
 */
export function buildOrcamento(records, budgets, { competencia, categoria = '', currentCompetence, locale = 'pt-BR' } = {}) {
  const es = isSpanish(locale);
  const status = buildBudgetStatus(records, budgets, competencia);
  const when = monthLabel(competencia, currentCompetence || competencia, es);
  const asked = String(categoria || '').trim();
  const base = {
    competencia,
    total: withFormatted(status.total),
    categorias: status.categorias.map(withFormatted),
    gasto_mes: { ...status.gasto_mes, formatado: { realizado: formatMoney(status.gasto_mes.realizado), comprometido: formatMoney(status.gasto_mes.comprometido) } },
    regras: {
      realizado: 'despesas pagas da competencia',
      comprometido: 'despesas lancadas e nao pagas (em aberto ou vencidas); canceladas ficam de fora',
      disponivel: 'limite - realizado - comprometido'
    }
  };

  if (asked) {
    const line = matchBudgetCategory(status, asked);
    if (line) {
      return {
        ...base,
        categoria_consultada: withFormatted(line),
        resposta_usuario: lineSentence(categoryLabel(line.categoria, es), line, when, es)
      };
    }
    const canonical = canonicalCategory(asked);
    // Usa o nome como aparece nos lancamentos ("saude" -> "Saúde").
    const known = records.find((record) => record && normalizeBudgetName(record.category_name) === normalizeBudgetName(canonical));
    const name = known ? String(known.category_name).trim() : canonical.charAt(0).toUpperCase() + canonical.slice(1);
    const spent = roundCurrency(spentInCategory(records, competencia, name));
    const label = categoryLabel(name, es);
    const spentText = spent > 0
      ? (es ? ` ${when[0].toUpperCase()}${when.slice(1)} ya gastaste ${formatMoney(spent)} en ella.` : ` ${when[0].toUpperCase()}${when.slice(1)} você já gastou ${formatMoney(spent)} nela.`)
      : '';
    return {
      ...base,
      categoria_consultada: null,
      categoria_sem_orcamento: label,
      gasto_categoria: spent,
      resposta_usuario: es
        ? `Aún no tienes un límite para ${label}.${spentText} Puedes crearlo en el Dashboard, en Presupuestos.`
        : `Você ainda não definiu um limite para ${label}.${spentText} Dá para criar no Dashboard, em Orçamentos.`
    };
  }

  if (!status.total && !status.categorias.length) {
    return {
      ...base,
      resposta_usuario: es
        ? 'Aún no tienes presupuestos. Crea tus límites en el Dashboard, en Presupuestos.'
        : 'Você ainda não tem orçamentos. Crie seus limites no Dashboard, em Orçamentos.'
    };
  }

  const lines = [];
  if (status.total) lines.push(lineSentence(es ? 'Total del mes' : 'Total do mês', status.total, when, es));
  status.categorias.forEach((line) => lines.push(`• ${lineSentence(categoryLabel(line.categoria, es), line, when, es)}`));
  return { ...base, resposta_usuario: lines.join('\n') };
}

// ---------------------------------------------------------------------------
// Definir orcamento pelo WhatsApp ("coloque uma meta de 357 para transporte").
// Grava no mesmo documento que a tela Orcamentos usa (users/{uid}/budgets/{id}),
// com o mesmo historico de limites: o valor vale a partir do mes pedido.

const TOTAL_WORDS = new Set(['total', 'geral', 'general', 'mes', 'mes todo', 'todo', 'tudo', 'todo el mes', 'mensal', 'mensual', 'total do mes', 'total del mes']);

export function isTotalBudgetRequest(text = '') {
  const key = normalizeBudgetName(text);
  return !key || TOTAL_WORDS.has(key);
}

/**
 * Nome da categoria que o usuario ja usa (orcamentos, catalogo ou lancamentos)
 * a partir do que ele disse: nome direto, nome em espanhol ou palavra do dia a dia.
 * Devolve '' quando nao reconhece, para nunca criar categoria inventada.
 */
export function resolveBudgetCategoryName(text, names = []) {
  const byKey = new Map();
  names.forEach((name) => {
    const clean = String(name || '').trim();
    const key = normalizeBudgetName(clean);
    if (key && !byKey.has(key)) byKey.set(key, clean);
  });
  const asked = String(text || '').trim();
  if (!asked) return '';
  const candidates = [asked, PT_FROM_ES.get(normalizeBudgetName(asked)), keywordCategory(asked)];
  for (const candidate of candidates) {
    const found = candidate && byKey.get(normalizeBudgetName(candidate));
    if (found) return found;
  }
  return '';
}

function knownCategoryNames(budgets, referenceRecords, records) {
  const catalog = buildReferenceCatalog(referenceRecords);
  return [
    ...budgets.filter((item) => item && item.scope !== BUDGET_SCOPES.TOTAL).map((item) => item.category_name),
    ...catalog.categorias.map((item) => item.nome),
    ...records.filter((record) => record && record.type === 'saida').map((record) => record.category_name)
  ];
}

function competenceText(competence) {
  const [year, month] = competence.split('-');
  return `${month}/${year}`;
}

/**
 * @param store precisa de listBudgets, listFinanceRecords, listReferenceRecords e saveBudget
 * @param body { categoria?, valor, competencia? (YYYY-MM, ja validada) }
 */
export async function defineBudget(store, uid, { categoria = '', valor, competencia, currentCompetence, locale = 'pt-BR', nowIso }) {
  if (typeof store.saveBudget !== 'function') throw new ApiError(503, 'BUDGETS_NOT_CONFIGURED', 'Orcamentos indisponiveis.');
  const es = isSpanish(locale);
  const amount = normalizeBudgetAmount(valor);
  if (amount === null || amount <= 0) throw new ApiError(400, 'INVALID_AMOUNT', 'Valor do orcamento deve ser maior que zero.');

  const asked = String(categoria || '').trim().slice(0, 80);
  const [budgets, references, records] = await Promise.all([
    store.listBudgets(uid),
    store.listReferenceRecords(uid),
    store.listFinanceRecords(uid)
  ]);
  const isTotal = isTotalBudgetRequest(asked);
  const categoryName = isTotal ? '' : resolveBudgetCategoryName(asked, knownCategoryNames(budgets, references, records));

  if (!isTotal && !categoryName) {
    const options = [...new Set(buildReferenceCatalog(references).categorias.map((item) => item.nome))].slice(0, 12);
    const list = options.map((name) => categoryLabel(name, es)).join(', ');
    return {
      status: 'categoria_nao_encontrada',
      categorias_disponiveis: options,
      resposta_usuario: es
        ? `No encontré la categoría "${asked}". Dime una de estas: ${list}.`
        : `Não encontrei a categoria "${asked}". Me diga uma destas: ${list}.`
    };
  }

  const scope = isTotal ? BUDGET_SCOPES.TOTAL : BUDGET_SCOPES.CATEGORY;
  const id = isTotal ? TOTAL_BUDGET_ID : budgetIdFor({ scope, category_name: categoryName });
  const saved = await store.saveBudget(uid, id, (existing) => {
    const current = existing ? normalizeBudget(existing, id) : null;
    return {
      ...buildBudgetDocument({ scope, category_name: current?.category_name || categoryName, limits: setLimitFrom(current?.limits || {}, competencia, amount) }),
      owner_uid: uid,
      updated_at: nowIso
    };
  });

  const merged = [...budgets.filter((item) => item && item.id !== id), { ...saved, id }];
  const status = buildBudgetStatus(records, merged, competencia);
  const line = isTotal ? status.total : findCategoryBudgetStatus(status, saved.category_name);
  const label = isTotal ? (es ? 'Total del mes' : 'Total do mês') : categoryLabel(saved.category_name, es);
  const when = monthLabel(competencia, currentCompetence || competencia, es);
  const usage = line && line.usado > 0
    ? (es
      ? ` ${when[0].toUpperCase()}${when.slice(1)} ya usaste ${formatMoney(line.usado)} (${percentText(line.percentual)}).`
      : ` ${when[0].toUpperCase()}${when.slice(1)} você já usou ${formatMoney(line.usado)} (${percentText(line.percentual)}).`)
    : '';
  return {
    status: 'orcamento_definido',
    orcamento_id: id,
    competencia,
    limite: amount,
    orcamento: withFormatted(line),
    resposta_usuario: es
      ? `Listo: límite de ${label} en ${formatMoney(amount)} desde ${competenceText(competencia)} (sigue igual en los meses siguientes).${usage}`
      : `Pronto: limite de ${label} em ${formatMoney(amount)} a partir de ${competenceText(competencia)} (vale também para os meses seguintes).${usage}`
  };
}
