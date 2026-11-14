/**
 * Tela "Orçamentos" (#/orcamentos).
 *
 * Mostra, para o mes escolhido, o limite total e os limites por categoria com
 * realizado (pago), comprometido (lancado e nao pago), disponivel e percentual usado.
 * O calculo vem de src/domain/budgets.js, o mesmo usado pelo WhatsApp.
 *
 * Os orcamentos sao escutados em tempo real (budgetsSdk.subscribeBudgets) e os
 * lancamentos vem de window.allRecords, que o app ja mantem em tempo real. Assim, o
 * que muda em outra aba ou pelo WhatsApp aparece aqui sem recarregar.
 */
import {
  BUDGET_SCOPES,
  buildBudgetStatus,
  isBudgetCompetence,
  normalizeBudgetAmount,
  normalizeBudgetName
} from '../../domain/budgets.js';
import { currentCompetenceKey } from '../../core/dates.js';
import { formatCurrency } from '../../core/formatters.js';
import { formatCompetenceLabel } from '../../core/i18n.js';

export const BUDGETS_TAB = 'orcamentos';
const TOTAL_OPTION = '__total__';

const BUTTON = 'text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed';

const STATE_STYLE = Object.freeze({
  ok: { bar: 'bg-success', text: 'text-success', label: 'Dentro do limite' },
  alerta: { bar: 'bg-warn', text: 'text-warn', label: 'Perto do limite' },
  no_limite: { bar: 'bg-warn', text: 'text-warn', label: 'Limite atingido' },
  estourado: { bar: 'bg-danger', text: 'text-danger', label: 'Limite ultrapassado' }
});

function escapeHtml(value = '') {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));
}

function money(value) {
  return escapeHtml(formatCurrency(value));
}

function monthLabel(competence) {
  try {
    return formatCompetenceLabel(competence) || competence;
  } catch {
    return competence;
  }
}

/** Nomes de categoria disponiveis: cadastradas (tipo 'categoria') + usadas em despesas. */
export function collectCategoryNames(records = []) {
  const names = new Map();
  (Array.isArray(records) ? records : []).forEach((record) => {
    if (!record || record.archived === true) return;
    const isCategory = record.type === 'categoria';
    const isExpense = record.type === 'saida';
    if (!isCategory && !isExpense) return;
    const name = String(record.category_name || (isExpense ? record.subcategory : '') || '').trim();
    const key = normalizeBudgetName(name);
    if (name && !names.has(key)) names.set(key, name);
  });
  return [...names.values()].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

function progressBar(line) {
  const style = STATE_STYLE[line.estado] || STATE_STYLE.ok;
  const width = Math.max(0, Math.min(100, line.percentual));
  const percentText = `${String(line.percentual).replace('.', ',')}%`;
  return `
    <div class="mt-2">
      <div class="h-2 w-full rounded-full bg-surfaceLight overflow-hidden" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(width)}" aria-label="${escapeHtml(style.label)}">
        <div class="h-full rounded-full ${style.bar} transition-[width] duration-300 motion-reduce:transition-none" style="width:${width}%"></div>
      </div>
      <div class="flex items-center justify-between mt-1 text-[11px]">
        <span class="font-semibold ${style.text}">${escapeHtml(style.label)}</span>
        <span class="font-semibold ${style.text}">${escapeHtml(percentText)}</span>
      </div>
    </div>`;
}

function availableText(line) {
  return line.disponivel >= 0
    ? `<span class="text-textSecondary">Disponível:</span> <span class="font-semibold text-textPrimary">${money(line.disponivel)}</span>`
    : `<span class="text-textSecondary">Passou do limite em</span> <span class="font-semibold text-danger">${money(Math.abs(line.disponivel))}</span>`;
}

function breakdown(line) {
  return `
    <div class="grid grid-cols-3 gap-2 mt-3 text-xs">
      <div><p class="text-textSecondary">Pago</p><p class="font-semibold">${money(line.realizado)}</p></div>
      <div><p class="text-textSecondary">A pagar</p><p class="font-semibold">${money(line.comprometido)}</p></div>
      <div><p class="text-textSecondary">Limite</p><p class="font-semibold">${money(line.limite)}</p></div>
    </div>`;
}

function rowActions(id, pendingDelete) {
  if (pendingDelete === id) {
    return `
      <div class="flex gap-2">
        <button type="button" data-budget-delete-confirm="${escapeHtml(id)}" class="${BUTTON} bg-danger text-white hover:bg-danger/90">Confirmar remoção</button>
        <button type="button" data-budget-delete-cancel class="${BUTTON} bg-surfaceLight text-textSecondary hover:text-textPrimary">Cancelar</button>
      </div>`;
  }
  return `
    <div class="flex gap-2">
      <button type="button" data-budget-edit="${escapeHtml(id)}" class="${BUTTON} bg-surfaceLight text-textSecondary hover:text-textPrimary">Editar</button>
      <button type="button" data-budget-delete="${escapeHtml(id)}" class="${BUTTON} bg-surfaceLight text-textSecondary hover:text-danger">Remover</button>
    </div>`;
}

function totalCard(status, pendingDelete) {
  if (!status.total) {
    return `
      <div class="bg-surface rounded-xl p-4 border border-surfaceLight">
        <h3 class="font-semibold text-sm">Orçamento total do mês</h3>
        <p class="text-xs text-textSecondary mt-1">Você ainda não definiu um limite total. Gasto do mês até agora:</p>
        <p class="text-lg font-bold mt-2">${money(status.gasto_mes.realizado + status.gasto_mes.comprometido)}</p>
        <p class="text-xs text-textSecondary mt-1">Pago ${money(status.gasto_mes.realizado)} · A pagar ${money(status.gasto_mes.comprometido)}</p>
      </div>`;
  }
  const line = status.total;
  return `
    <div class="bg-surface rounded-xl p-4 border border-surfaceLight" data-budget-row="total">
      <div class="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 class="font-semibold text-sm">Orçamento total do mês</h3>
          <p class="text-lg font-bold mt-1">${money(line.usado)} <span class="text-sm font-normal text-textSecondary">de ${money(line.limite)}</span></p>
          <p class="text-xs mt-1">${availableText(line)}</p>
        </div>
        ${rowActions('total', pendingDelete)}
      </div>
      ${progressBar(line)}
      ${breakdown(line)}
    </div>`;
}

function categoryRow(line, pendingDelete) {
  return `
    <li class="rounded-xl border border-surfaceLight bg-surfaceLight/30 p-3" data-budget-row="${escapeHtml(line.id)}">
      <div class="flex items-start justify-between gap-3 flex-wrap">
        <div class="min-w-0">
          <p class="text-sm font-semibold truncate" data-i18n-skip>${escapeHtml(line.categoria)}</p>
          <p class="text-sm mt-1">${money(line.usado)} <span class="text-xs text-textSecondary">de ${money(line.limite)}</span></p>
          <p class="text-xs mt-1">${availableText(line)}</p>
        </div>
        ${rowActions(line.id, pendingDelete)}
      </div>
      ${progressBar(line)}
      ${breakdown(line)}
    </li>`;
}

function formCard({ competence, categories, form, saving, message }) {
  const selected = form.target || '';
  const options = [
    `<option value="${TOTAL_OPTION}"${selected === TOTAL_OPTION ? ' selected' : ''}>Total do mês (todas as categorias)</option>`,
    ...categories.map((name) => `<option value="${escapeHtml(name)}"${normalizeBudgetName(name) === normalizeBudgetName(selected) ? ' selected' : ''} data-i18n-skip>${escapeHtml(name)}</option>`)
  ].join('');
  const messageHtml = message
    ? `<p class="text-xs mt-2 ${message.type === 'error' ? 'text-danger' : 'text-success'}" role="status">${escapeHtml(message.text)}</p>`
    : '';
  return `
    <form class="bg-surface rounded-xl p-4 border border-surfaceLight" data-budget-form novalidate>
      <h3 class="font-semibold text-sm">${form.editing ? 'Editar limite' : 'Definir limite'}</h3>
      <p class="text-xs text-textSecondary mt-1">Vale a partir de ${escapeHtml(monthLabel(competence))} e se repete nos meses seguintes. Os meses anteriores não mudam.</p>
      <div class="grid grid-cols-1 sm:grid-cols-[1fr_10rem_auto] gap-2 mt-3 items-end">
        <label class="text-xs text-textSecondary">Categoria
          <select id="budget-target" name="target" class="mt-1 w-full bg-surfaceLight border border-surfaceLight rounded-lg px-3 py-2 text-sm text-textPrimary">
            <option value=""${selected ? '' : ' selected'} disabled>Escolha a categoria</option>
            ${options}
          </select>
        </label>
        <label class="text-xs text-textSecondary">Limite por mês
          <input id="budget-amount" name="amount" type="text" inputmode="decimal" autocomplete="off" value="${escapeHtml(form.amount || '')}" placeholder="0,00" class="mt-1 w-full bg-surfaceLight border border-surfaceLight rounded-lg px-3 py-2 text-sm text-textPrimary">
        </label>
        <button type="submit" class="${BUTTON} py-2 bg-accent hover:bg-accentDark text-bg"${saving ? ' disabled' : ''}>${saving ? 'Salvando...' : 'Salvar'}</button>
      </div>
      ${messageHtml}
    </form>`;
}

/** HTML completo da tela a partir do estado. Funcao pura (testavel). */
export function renderBudgetsView(state = {}) {
  const competence = state.competence;
  const header = `
    <div class="flex items-end justify-between gap-3 flex-wrap mb-4">
      <div>
        <h2 class="text-xl font-bold mb-1">Orçamentos</h2>
        <p class="text-sm text-textSecondary">Defina quanto quer gastar por mês e acompanhe o quanto já usou.</p>
      </div>
      <label class="text-xs text-textSecondary">Mês
        <input id="budget-month" type="month" value="${escapeHtml(competence)}" class="mt-1 block bg-surfaceLight border border-surfaceLight rounded-lg px-3 py-2 text-sm text-textPrimary">
      </label>
    </div>`;

  if (state.loading) {
    return `${header}
      <div class="space-y-3" aria-busy="true">
        <div class="h-28 rounded-xl bg-surfaceLight/60 animate-pulse motion-reduce:animate-none"></div>
        <div class="h-20 rounded-xl bg-surfaceLight/60 animate-pulse motion-reduce:animate-none"></div>
      </div>`;
  }
  if (state.error) {
    return `${header}
      <div class="bg-surface rounded-xl p-4 border border-danger/40 text-sm">
        <p class="font-semibold text-danger">Não foi possível carregar os orçamentos.</p>
        <p class="text-xs text-textSecondary mt-1">Verifique sua conexão e tente de novo.</p>
        <button type="button" data-budget-retry class="${BUTTON} mt-3 bg-surfaceLight text-textPrimary">Tentar de novo</button>
      </div>`;
  }

  const status = buildBudgetStatus(state.records || [], state.budgets || [], competence);
  const rows = status.categorias.length
    ? `<ul class="space-y-2">${status.categorias.map((line) => categoryRow(line, state.pendingDelete)).join('')}</ul>`
    : `<p class="text-xs text-textSecondary text-center py-6">Nenhum limite por categoria neste mês. Escolha uma categoria acima para começar.</p>`;
  const uncovered = status.categorias.length && (status.sem_orcamento.realizado + status.sem_orcamento.comprometido) > 0
    ? `<p class="text-xs text-textSecondary mt-3">Gastos em categorias sem limite: <span class="font-semibold text-textPrimary">${money(status.sem_orcamento.realizado + status.sem_orcamento.comprometido)}</span></p>`
    : '';

  return `${header}
    <div class="space-y-4">
      ${totalCard(status, state.pendingDelete)}
      ${formCard({ competence, categories: state.categories || [], form: state.form || {}, saving: state.saving, message: state.message })}
      <div class="bg-surface rounded-xl p-4 border border-surfaceLight">
        <h3 class="font-semibold text-sm mb-3">Limites por categoria</h3>
        ${rows}
        ${uncovered}
      </div>
    </div>`;
}

function errorText(error) {
  const code = String(error?.message || error?.code || '');
  if (code === 'INVALID_AMOUNT') return 'Informe um valor válido (ex.: 500 ou 500,00).';
  if (code === 'INVALID_CATEGORY') return 'Escolha a categoria.';
  if (code.includes('permission')) return 'Sem permissão para salvar. Entre de novo na sua conta.';
  return 'Não foi possível salvar. Tente de novo.';
}

export function installBudgetsUi(target = globalThis, options = {}) {
  const documentRef = target?.document;
  if (!documentRef) return null;
  if (target.financeApp?.budgetsUi?.installed) return target.financeApp.budgetsUi;

  const getService = options.getService || (() => target.budgetsSdk);
  const getUid = options.getUid || (() => target.authSdk?.getCurrentUser?.()?.uid || '');
  const getRecords = options.getRecords || (() => (Array.isArray(target.allRecords) ? target.allRecords : []));

  const state = {
    competence: currentCompetenceKey(),
    budgets: [],
    loading: true,
    error: null,
    saving: false,
    message: null,
    pendingDelete: '',
    form: { target: '', amount: '', editing: false }
  };
  let subscription = null;

  const view = () => documentRef.getElementById('view-orcamentos');
  const isVisible = () => {
    const el = view();
    return Boolean(el && !el.classList?.contains?.('hidden'));
  };

  function paint() {
    const el = view();
    if (!el) return;
    const records = getRecords();
    el.innerHTML = renderBudgetsView({ ...state, records, categories: collectCategoryNames(records) });
    target.lucide?.createIcons?.();
  }

  function ensureSubscription() {
    const uid = getUid();
    const service = getService();
    if (!uid || !service) return;
    if (subscription?.uid === uid) return;
    subscription?.unsubscribe?.();
    state.loading = true;
    state.error = null;
    try {
      const unsubscribe = service.subscribeBudgets(
        uid,
        (budgets) => {
          state.budgets = budgets;
          state.loading = false;
          state.error = null;
          if (isVisible()) paint();
        },
        (error) => {
          state.loading = false;
          state.error = error;
          subscription = null;
          target.financeApp?.resilience?.errorReporter?.report?.({ error, operation: 'budgets_subscribe' });
          if (isVisible()) paint();
        }
      );
      subscription = { uid, unsubscribe };
    } catch (error) {
      state.loading = false;
      state.error = error;
    }
  }

  function render() {
    ensureSubscription();
    paint();
  }

  function selectedLabel(value) {
    return value === TOTAL_OPTION ? { scope: BUDGET_SCOPES.TOTAL, category_name: '' } : { scope: BUDGET_SCOPES.CATEGORY, category_name: value };
  }

  async function save(formElement) {
    const targetValue = formElement.querySelector?.('#budget-target')?.value || '';
    const amountRaw = formElement.querySelector?.('#budget-amount')?.value || '';
    state.form = { ...state.form, target: targetValue, amount: amountRaw };
    // "1.234,56" -> 1234.56; "500.5" e "500,5" -> 500.5
    const raw = String(amountRaw).trim();
    const amount = normalizeBudgetAmount(raw.includes(',') ? raw.replace(/\./g, '') : raw);
    if (!targetValue) {
      state.message = { type: 'error', text: errorText({ message: 'INVALID_CATEGORY' }) };
      return paint();
    }
    if (amount === null || raw === '') {
      state.message = { type: 'error', text: errorText({ message: 'INVALID_AMOUNT' }) };
      return paint();
    }
    const uid = getUid();
    const service = getService();
    if (!uid || !service) return;
    state.saving = true;
    state.message = null;
    paint();
    try {
      await service.saveBudgetLimit(uid, { ...selectedLabel(targetValue), competence: state.competence, amount });
      state.form = { target: '', amount: '', editing: false };
      state.message = { type: 'success', text: 'Limite salvo.' };
    } catch (error) {
      state.message = { type: 'error', text: errorText(error) };
      target.financeApp?.resilience?.errorReporter?.report?.({ error, operation: 'budgets_save' });
    } finally {
      state.saving = false;
      paint();
    }
  }

  async function remove(id) {
    const uid = getUid();
    const service = getService();
    state.pendingDelete = '';
    if (!uid || !service) return paint();
    try {
      await service.deleteBudget(uid, id);
      state.message = { type: 'success', text: 'Limite removido.' };
    } catch (error) {
      state.message = { type: 'error', text: 'Não foi possível remover. Tente de novo.' };
      target.financeApp?.resilience?.errorReporter?.report?.({ error, operation: 'budgets_delete' });
    }
    paint();
  }

  function startEdit(id) {
    const status = buildBudgetStatus(getRecords(), state.budgets, state.competence);
    const line = id === 'total' ? status.total : status.categorias.find((item) => item.id === id);
    if (!line) return;
    state.form = {
      target: id === 'total' ? TOTAL_OPTION : line.categoria,
      amount: String(line.limite).replace('.', ','),
      editing: true
    };
    state.message = null;
    paint();
    documentRef.getElementById('budget-amount')?.focus?.();
  }

  documentRef.addEventListener('submit', (event) => {
    const form = event.target?.closest?.('[data-budget-form]');
    if (!form) return;
    event.preventDefault();
    save(form);
  });

  documentRef.addEventListener('change', (event) => {
    if (event.target?.id !== 'budget-month') return;
    const value = event.target.value;
    if (!isBudgetCompetence(value)) return;
    state.competence = value;
    state.message = null;
    state.pendingDelete = '';
    paint();
  });

  documentRef.addEventListener('click', (event) => {
    const el = event.target?.closest?.('[data-budget-edit],[data-budget-delete],[data-budget-delete-confirm],[data-budget-delete-cancel],[data-budget-retry]');
    if (!el) return;
    if (el.hasAttribute('data-budget-retry')) {
      subscription = null;
      render();
    } else if (el.hasAttribute('data-budget-edit')) {
      startEdit(el.getAttribute('data-budget-edit'));
    } else if (el.hasAttribute('data-budget-delete')) {
      state.pendingDelete = el.getAttribute('data-budget-delete');
      paint();
    } else if (el.hasAttribute('data-budget-delete-confirm')) {
      remove(el.getAttribute('data-budget-delete-confirm'));
    } else {
      state.pendingDelete = '';
      paint();
    }
  });

  // Ao sair da conta, para de escutar e limpa o estado.
  target.addEventListener?.('authStateChanged', () => {
    const uid = getUid();
    if (subscription && subscription.uid !== uid) {
      subscription.unsubscribe?.();
      subscription = null;
      state.budgets = [];
      state.loading = true;
    }
  });

  target.renderOrcamentos = render;
  const api = { installed: true, render, paint, state };
  target.financeApp = target.financeApp || {};
  target.financeApp.budgetsUi = api;
  return api;
}
