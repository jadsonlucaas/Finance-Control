/**
 * Alertas automaticos (Etapa 3): o que avisar a cada usuario, e o texto no idioma dele.
 * Puro, sem banco: recebe lancamentos, orcamentos e preferencias e devolve as mensagens.
 *
 * Cada alerta tem uma chave estavel (dedupKey) para nunca repetir o mesmo aviso:
 * - due_soon:{id}:{vencimento}   conta em aberto que vence entre hoje e hoje+N dias (um aviso por conta);
 * - overdue:{id}:{vencimento}    conta vencida ate 7 dias atras e nao paga (um aviso por conta);
 * - budget:{id}:{competencia}:{80|100}  orcamento do mes que passou de 80% / 100% (um aviso por faixa);
 * - summary:{competencia}        resumo do mes anterior, nos dias 1 a 3 (um por mes).
 *
 * Os valores saem do mesmo calculo das consultas (queries.js) e do Dashboard (src/domain/budgets.js).
 */
import { buildBudgetStatus } from '../../../src/domain/budgets.js';
import { ES_CATEGORIES } from './confirmationText.js';
import { addDays, isDate } from './dates.js';
import { formatMoney, roundCurrency } from './money.js';
import { activeFinanceRecords, buildResumo, EXPENSE_OPEN_STATUSES, toPublicRecord } from './queries.js';

export const OVERDUE_LOOKBACK_DAYS = 7;
export const SUMMARY_DAYS = 3;
export const MAX_ITEMS_PER_MESSAGE = 8;
export const BUDGET_THRESHOLDS = Object.freeze([80, 100]);

const isSpanish = (locale) => String(locale || '').toLowerCase().startsWith('es');

function dayMonth(isoDate) {
  const [, month, day] = String(isoDate).split('-');
  return `${day}/${month}`;
}

function monthYear(competence) {
  const [year, month] = String(competence).split('-');
  return `${month}/${year}`;
}

function previousCompetence(competence) {
  const [year, month] = competence.split('-').map(Number);
  const index = year * 12 + (month - 1) - 1;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`;
}

function categoryLabel(name, es) {
  return es ? ES_CATEGORIES[name] || name : name;
}

function stopFooter(es) {
  return es
    ? 'Para dejar de recibir estas alertas, responde "parar alertas".'
    : 'Para parar estes alertas, responda "parar alertas".';
}

function itemLabel(item, es) {
  return item.descricao || categoryLabel(item.categoria, es) || (es ? 'Gasto' : 'Despesa');
}

function openExpenses(records) {
  return activeFinanceRecords(records).filter((record) =>
    record.type === 'saida'
    && EXPENSE_OPEN_STATUSES.includes(record.status || '')
    && isDate(record.due_date));
}

function listLines(items, es, verb) {
  const shown = items.slice(0, MAX_ITEMS_PER_MESSAGE).map((item) => `• ${itemLabel(item, es)}: ${item.valor_formatado} (${verb(item.vencimento)})`);
  const rest = items.length - shown.length;
  if (rest > 0) shown.push(es ? `• y ${rest} más` : `• e mais ${rest}`);
  return shown;
}

function dueSoonMessage(items, { days, today, es }) {
  const total = formatMoney(roundCurrency(items.reduce((acc, item) => acc + item.valor, 0)));
  const verb = (date) => {
    if (date === today) return es ? 'vence hoy' : 'vence hoje';
    if (date === addDays(today, 1)) return es ? 'vence mañana' : 'vence amanhã';
    return es ? `vence el ${dayMonth(date)}` : `vence em ${dayMonth(date)}`;
  };
  const title = es
    ? `🔔 Facturas que vencen en los próximos ${days} ${days === 1 ? 'día' : 'días'}:`
    : `🔔 Contas que vencem nos próximos ${days} ${days === 1 ? 'dia' : 'dias'}:`;
  const texto = [title, ...listLines(items, es, verb), es ? `Total: ${total}` : `Total: ${total}`, '', stopFooter(es)].join('\n');
  return {
    texto,
    parametros: [String(items.length), total, dayMonth(items[0].vencimento)]
  };
}

function overdueMessage(items, { es }) {
  const total = formatMoney(roundCurrency(items.reduce((acc, item) => acc + item.valor, 0)));
  const verb = (date) => (es ? `venció el ${dayMonth(date)}` : `venceu em ${dayMonth(date)}`);
  const title = es
    ? (items.length === 1 ? '⚠️ Tienes una factura vencida sin pagar:' : `⚠️ Tienes ${items.length} facturas vencidas sin pagar:`)
    : (items.length === 1 ? '⚠️ Você tem uma conta vencida e não paga:' : `⚠️ Você tem ${items.length} contas vencidas e não pagas:`);
  const hint = es ? 'Si ya la pagaste, avísame por aquí y la marco como pagada.' : 'Se já pagou, me avise por aqui que eu marco como paga.';
  const texto = [title, ...listLines(items, es, verb), `Total: ${total}`, hint, '', stopFooter(es)].join('\n');
  return { texto, parametros: [String(items.length), total] };
}

function percentText(value) {
  return `${String(Math.round(Number(value) || 0))}%`;
}

function budgetMessage(line, threshold, { es }) {
  const label = line.id === 'total'
    ? (es ? 'presupuesto total del mes' : 'orçamento total do mês')
    : (es ? `presupuesto de ${categoryLabel(line.categoria, es)}` : `orçamento de ${line.categoria}`);
  const used = formatMoney(line.usado);
  const limit = formatMoney(line.limite);
  let texto;
  if (threshold >= 100) {
    texto = es
      ? `🚨 Llegaste al 100% del ${label}: usaste ${used} de ${limit}${line.disponivel < 0 ? ` (te pasaste en ${formatMoney(Math.abs(line.disponivel))})` : ''}.`
      : `🚨 Você atingiu 100% do ${label}: usou ${used} de ${limit}${line.disponivel < 0 ? ` (passou ${formatMoney(Math.abs(line.disponivel))})` : ''}.`;
  } else {
    texto = es
      ? `📊 Ya usaste el ${percentText(line.percentual)} del ${label} (${used} de ${limit}). Te quedan ${formatMoney(line.disponivel)}.`
      : `📊 Você já usou ${percentText(line.percentual)} do ${label} (${used} de ${limit}). Ainda restam ${formatMoney(line.disponivel)}.`;
  }
  const name = line.id === 'total' ? (es ? 'Total del mes' : 'Total do mês') : categoryLabel(line.categoria, es);
  return { texto: `${texto}\n\n${stopFooter(es)}`, parametros: [name, percentText(line.percentual), used, limit] };
}

function summaryMessage(previous, commitments, { es }) {
  const f = previous.formatado;
  const month = monthYear(previous.competencia);
  const lines = es
    ? [`📅 Resumen de ${month}:`, `• Ingresos: ${f.total_receitas}`, `• Gastos: ${f.total_despesas}`, `• Saldo: ${f.saldo_previsto}`]
    : [`📅 Resumo de ${month}:`, `• Receitas: ${f.total_receitas}`, `• Despesas: ${f.total_despesas}`, `• Saldo: ${f.saldo_previsto}`];
  if (previous.despesas_em_aberto > 0) {
    lines.push(es ? `• Aún pendiente de ese mes: ${f.despesas_em_aberto}` : `• Ainda em aberto daquele mês: ${f.despesas_em_aberto}`);
  }
  if (commitments.quantidade > 0) {
    lines.push(es
      ? `Compromisos de este mes: ${commitments.total_formatado} en ${commitments.quantidade} ${commitments.quantidade === 1 ? 'factura' : 'facturas'}.`
      : `Compromissos deste mês: ${commitments.total_formatado} em ${commitments.quantidade} ${commitments.quantidade === 1 ? 'conta' : 'contas'}.`);
  }
  lines.push('', stopFooter(es));
  return { texto: lines.join('\n'), parametros: [month, f.total_receitas, f.total_despesas, f.saldo_previsto] };
}

/**
 * @param input {
 *   records, budgets, settings (resolveNotificationSettings), locale,
 *   today (YYYY-MM-DD no fuso do usuario), competence (YYYY-MM atual), alreadySent: Set<dedupKey>
 * }
 * @returns [{ tipo, chaves: [dedupKey], texto, parametros: [string] }]
 */
export function buildUserAlerts({ records = [], budgets = [], settings, locale = 'pt-BR', today, competence, alreadySent = new Set() }) {
  const es = isSpanish(locale);
  const out = [];
  const fresh = (key) => !alreadySent.has(key);

  const open = (settings.due_soon_enabled || settings.overdue_enabled || settings.monthly_summary_enabled) ? openExpenses(records) : [];

  if (settings.due_soon_enabled) {
    const limit = addDays(today, settings.due_soon_days);
    const items = open
      .filter((record) => record.due_date >= today && record.due_date <= limit)
      .map((record) => ({ ...toPublicRecord(record), chave: `due_soon:${record.id}:${record.due_date}` }))
      .filter((item) => fresh(item.chave))
      .sort((a, b) => a.vencimento.localeCompare(b.vencimento));
    if (items.length) out.push({ tipo: 'due_soon', chaves: items.map((item) => item.chave), ...dueSoonMessage(items, { days: settings.due_soon_days, today, es }) });
  }

  if (settings.overdue_enabled) {
    const from = addDays(today, -OVERDUE_LOOKBACK_DAYS);
    const items = open
      .filter((record) => record.due_date < today && record.due_date >= from)
      .map((record) => ({ ...toPublicRecord(record), chave: `overdue:${record.id}:${record.due_date}` }))
      .filter((item) => fresh(item.chave))
      .sort((a, b) => a.vencimento.localeCompare(b.vencimento));
    if (items.length) out.push({ tipo: 'overdue', chaves: items.map((item) => item.chave), ...overdueMessage(items, { es }) });
  }

  if (settings.budget_enabled && budgets.length) {
    const status = buildBudgetStatus(records, budgets, competence);
    const lines = [...(status.total ? [status.total] : []), ...status.categorias].filter((line) => Number(line.limite) > 0);
    for (const line of lines) {
      const crossed = BUDGET_THRESHOLDS.filter((threshold) => Number(line.percentual) >= threshold);
      if (!crossed.length) continue;
      const top = crossed[crossed.length - 1];
      const keys = crossed.map((threshold) => `budget:${line.id}:${competence}:${threshold}`);
      // Ja avisou a faixa mais alta: nada a fazer. Passou de 80 direto para 100: um aviso so (o de 100).
      if (!fresh(`budget:${line.id}:${competence}:${top}`)) continue;
      out.push({ tipo: 'budget', chaves: keys.filter(fresh), ...budgetMessage(line, top, { es }) });
    }
  }

  if (settings.monthly_summary_enabled) {
    const day = Number(today.slice(8, 10));
    const previous = previousCompetence(competence);
    const key = `summary:${previous}`;
    if (day <= SUMMARY_DAYS && fresh(key)) {
      const resumo = buildResumo(records, previous);
      const hasData = Object.values(resumo.quantidade || {}).some((value) => value > 0);
      if (hasData) {
        const pending = open.filter((record) => String(record.due_date).slice(0, 7) === competence);
        const total = roundCurrency(pending.reduce((acc, record) => acc + (Number(record.amount) || 0), 0));
        out.push({
          tipo: 'monthly_summary',
          chaves: [key],
          ...summaryMessage(resumo, { quantidade: pending.length, total_formatado: formatMoney(total) }, { es })
        });
      }
    }
  }

  return out;
}

/** Texto curto devolvido quando o usuario manda "parar alertas" no WhatsApp. */
export function stopAlertsReply(locale, { alreadyStopped = false } = {}) {
  const es = isSpanish(locale);
  if (alreadyStopped) {
    return es
      ? 'Las alertas por WhatsApp ya estaban desactivadas. Puedes activarlas de nuevo en el Dashboard, en Configuración > Notificaciones.'
      : 'Os alertas no WhatsApp já estavam desligados. Você pode ligar de novo no Dashboard, em Configurações > Notificações.';
  }
  return es
    ? 'Listo, no te enviaré más alertas por WhatsApp. Puedes seguir usando el asistente con normalidad. Para activarlas de nuevo, ve al Dashboard, en Configuración > Notificaciones.'
    : 'Pronto, não vou mais enviar alertas pelo WhatsApp. Você continua usando o assistente normalmente. Para ligar de novo, vá no Dashboard, em Configurações > Notificações.';
}
