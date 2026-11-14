/**
 * Consulta de orcamento pelo WhatsApp ("quanto ainda posso gastar em alimentacao?").
 *
 * O calculo e o mesmo do Dashboard (src/domain/budgets.js). Aqui so se escolhe a
 * categoria a partir do que o usuario disse (pt ou es, palavras como "comida") e se
 * monta uma frase pronta no idioma dele, que o agente repassa como esta.
 */
import {
  buildBudgetStatus,
  findCategoryBudgetStatus,
  normalizeBudgetName
} from '../../../src/domain/budgets.js';
import { ES_CATEGORIES } from './confirmationText.js';
import { keywordCategory } from './references.js';
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
