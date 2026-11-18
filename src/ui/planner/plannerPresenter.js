import { formatCurrency as formatDisplayCurrency } from '../../core/formatters.js';

/*
 * Planner mensal (v2): usa os tokens de tema (claro/escuro) definidos em styles/shell.css.
 * - Celular: celulas compactas com pontos coloridos por tipo e a agenda do dia logo abaixo.
 * - Computador: celulas com descricao e valor (ou resumo por tipo quando o dia tem muitos itens)
 *   e lista de detalhes com seta para expandir cada item (ou todos de uma vez).
 */
const MODAL_VERSION = '2';
const KIND_ORDER = ['expense', 'income', 'holiday', 'commitment', 'hour_extra', 'bank_hours'];

function currency(value = 0) {
  return formatDisplayCurrency(value);
}

function escapeHtml(value = '') {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function todayIso() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function daysInMonth(month = '') {
  const [year, value] = String(month || '').split('-').map(Number);
  if (!year || !value) return 31;
  return new Date(year, value, 0).getDate();
}

function firstDayOffset(month = '') {
  const [year, value] = String(month || '').split('-').map(Number);
  if (!year || !value) return 0;
  return new Date(year, value - 1, 1).getDay();
}

function formatDate(date = '') {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return date || 'Sem data';
  const [year, month, day] = date.split('-');
  return `${day}/${month}/${year}`;
}

function locale(documentRef) {
  return documentRef?.documentElement?.lang || 'pt-BR';
}

function capitalize(value = '') {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}

function monthName(month = '', documentRef) {
  if (!/^\d{4}-\d{2}$/.test(month)) return month || '';
  const [year, value] = month.split('-').map(Number);
  return capitalize(new Date(year, value - 1, 1).toLocaleDateString(locale(documentRef), { month: 'long', year: 'numeric' }));
}

function weekdayLabel(date = '', documentRef) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return '';
  const [year, month, day] = date.split('-').map(Number);
  const weekday = new Date(year, month - 1, day).toLocaleDateString(locale(documentRef), { weekday: 'long' });
  return capitalize(weekday);
}

function kindKey(event = {}) {
  return KIND_ORDER.includes(event.kind) ? event.kind : 'commitment';
}

function kindLabel(kind = '', count = 1) {
  const plural = count !== 1;
  if (kind === 'expense') return plural ? 'Saídas' : 'Saída';
  if (kind === 'income') return plural ? 'Entradas' : 'Entrada';
  if (kind === 'holiday') return plural ? 'Feriados' : 'Feriado';
  if (kind === 'hour_extra') return 'Hora extra';
  if (kind === 'bank_hours') return 'Banco de horas';
  return plural ? 'Compromissos' : 'Compromisso';
}

function signedAmount(event = {}) {
  const amount = Number(event.amount) || 0;
  if (event.kind === 'expense') return -amount;
  if (event.kind === 'income') return amount;
  return 0;
}

function dayNet(events = []) {
  return events.reduce((total, event) => total + signedAmount(event), 0);
}

function groupByKind(events = []) {
  const groups = new Map();
  events.forEach((event) => {
    const kind = kindKey(event);
    const group = groups.get(kind) || { kind, count: 0, amount: 0 };
    group.count += 1;
    group.amount += Number(event.amount) || 0;
    groups.set(kind, group);
  });
  return KIND_ORDER.filter((kind) => groups.has(kind)).map((kind) => groups.get(kind));
}

const ICONS = {
  close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>',
  prev: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>',
  next: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>',
  chevron: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>',
  plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>'
};

function modalMarkup() {
  return `
    <div class="planner-backdrop">
      <div class="planner-sheet" role="dialog" aria-modal="true" aria-labelledby="planner-heading">
        <header class="planner-header">
          <div class="planner-heading-text">
            <h2 id="planner-heading" class="planner-heading">Planner mensal</h2>
            <p class="planner-subheading">Contas, entradas, feriados e compromissos do mês</p>
          </div>
          <button type="button" class="planner-icon-button" data-close-modal="planner-modal" aria-label="Fechar">${ICONS.close}</button>
        </header>
        <div class="planner-toolbar">
          <div class="planner-month-stepper">
            <button type="button" class="planner-icon-button" data-shift-planner-month="-1" aria-label="Mes anterior">${ICONS.prev}</button>
            <label class="planner-month-field">
              <span id="planner-month-label" class="planner-month-label"></span>
              <input id="planner-month" type="month" class="planner-month-input" aria-label="Escolher mês" data-legacy-change="renderPlannerModal">
            </label>
            <button type="button" class="planner-icon-button" data-shift-planner-month="1" aria-label="Próximo mês">${ICONS.next}</button>
          </div>
          <dl id="planner-summary" class="planner-summary"></dl>
        </div>
        <div class="planner-body">
          <section class="planner-calendar" aria-label="Calendário do mês">
            <div class="planner-weekdays" aria-hidden="true">
              <span>Dom</span><span>Seg</span><span>Ter</span><span>Qua</span><span>Qui</span><span>Sex</span><span>Sáb</span>
            </div>
            <div id="planner-calendar-grid" class="planner-grid"></div>
            <p class="planner-legend" aria-hidden="true">
              <span><i class="planner-dot" data-kind="expense"></i>Saídas</span>
              <span><i class="planner-dot" data-kind="income"></i>Entradas</span>
              <span><i class="planner-dot" data-kind="holiday"></i>Feriados</span>
              <span><i class="planner-dot" data-kind="commitment"></i>Outros</span>
            </p>
          </section>
          <aside class="planner-side">
            <section class="planner-panel planner-details-panel">
              <div class="planner-panel-head">
                <div>
                  <h3 id="planner-detail-title" class="planner-panel-title">Agenda do mês</h3>
                  <p id="planner-selected-date-label" class="planner-panel-meta"></p>
                </div>
                <div class="planner-panel-actions">
                  <button type="button" id="planner-clear-date" class="planner-text-button hidden">Ver mês</button>
                  <button type="button" class="planner-text-button planner-expand-all" data-planner-expand-all aria-expanded="false">
                    <span data-planner-expand-label>Expandir</span>${ICONS.chevron}
                  </button>
                </div>
              </div>
              <div id="planner-selected-date-details" class="planner-details"></div>
            </section>
            <details class="planner-panel planner-new-event">
              <summary class="planner-new-event-summary">
                <span class="planner-new-event-icon">${ICONS.plus}</span>
                <span class="planner-panel-title">Novo evento</span>
                <span class="planner-chevron">${ICONS.chevron}</span>
              </summary>
              <div class="planner-form">
                <label class="planner-field"><span>Data</span><input id="planner-date" type="date"></label>
                <label class="planner-field"><span>Tipo</span>
                  <select id="planner-type">
                    <option value="commitment">Compromisso</option>
                    <option value="holiday">Feriado</option>
                  </select>
                </label>
                <label class="planner-field"><span>Título</span><input id="planner-title" type="text" placeholder="Ex.: Consulta médica"></label>
                <label class="planner-field"><span>Observação</span><textarea id="planner-note" rows="3"></textarea></label>
                <button type="button" class="planner-primary-button" data-legacy-click="savePlannerEvent">Salvar evento</button>
              </div>
            </details>
          </aside>
        </div>
      </div>
    </div>`;
}

function ensureModal(documentRef) {
  let modal = documentRef.getElementById('planner-modal');
  if (modal && modal.dataset.plannerVersion === MODAL_VERSION) return modal;

  if (!modal) {
    modal = documentRef.createElement('div');
    modal.id = 'planner-modal';
    documentRef.body.appendChild(modal);
  }
  const wasHidden = modal.classList.contains('hidden') || !modal.className;
  modal.className = `planner-modal${wasHidden ? ' hidden' : ''}`;
  modal.dataset.plannerVersion = MODAL_VERSION;
  modal.innerHTML = modalMarkup();
  return modal;
}

/* ---------- Calendario ---------- */

function renderDesktopCell(events = []) {
  if (!events.length) return '';
  if (events.length <= 2) {
    return events.map((event) => {
      const amount = signedAmount(event) ? `<span class="planner-chip-amount">${escapeHtml(currency(event.amount))}</span>` : '';
      return `<span class="planner-chip" data-kind="${kindKey(event)}" title="${escapeHtml(event.title)}"><span class="planner-chip-title">${escapeHtml(event.title)}</span>${amount}</span>`;
    }).join('');
  }
  return groupByKind(events).map((group) => {
    const amount = group.kind === 'expense' || group.kind === 'income'
      ? `<span class="planner-chip-amount">${escapeHtml(currency(group.amount))}</span>`
      : '';
    return `<span class="planner-chip planner-chip-group" data-kind="${group.kind}"><span class="planner-chip-title">${group.count} ${escapeHtml(kindLabel(group.kind, group.count).toLowerCase())}</span>${amount}</span>`;
  }).join('');
}

function renderMobileCell(events = []) {
  if (!events.length) return '';
  const dots = groupByKind(events).slice(0, 3)
    .map((group) => `<i class="planner-dot" data-kind="${group.kind}"></i>`).join('');
  return `<span class="planner-cell-dots">${dots}</span>`;
}

function describeDay(date, events = []) {
  if (!events.length) return formatDate(date);
  const parts = groupByKind(events).map((group) => `${group.count} ${kindLabel(group.kind, group.count).toLowerCase()}`);
  return `${formatDate(date)}: ${parts.join(', ')}`;
}

function renderCalendarDay({ day, date, events = [], selectedDate, currentDate }) {
  const classes = ['planner-cell'];
  if (date === selectedDate) classes.push('is-selected');
  if (date === currentDate) classes.push('is-today');
  if (events.length) classes.push('has-events');
  return `
    <button type="button" data-select-planner-date="${escapeHtml(date)}" class="${classes.join(' ')}" aria-pressed="${date === selectedDate}" aria-label="${escapeHtml(describeDay(date, events))}">
      <span class="planner-cell-head"><span class="planner-cell-day">${day}</span></span>
      <span class="planner-cell-desktop">${renderDesktopCell(events)}</span>
      <span class="planner-cell-mobile">${renderMobileCell(events)}</span>
    </button>`;
}

/* ---------- Lista de detalhes ---------- */

function renderActions(event = {}) {
  if (event.source === 'planner_local' && event.actions?.canDelete) {
    return `<button type="button" class="planner-action" data-tone="danger" data-delete-planner-event="${escapeHtml(event.sourceRecordId)}">Excluir</button>`;
  }
  if (event.kind !== 'expense') return '';
  return [
    event.actions?.canMarkPaid ? `<button type="button" class="planner-action" data-tone="success" data-planner-action="mark-paid" data-planner-event-id="${escapeHtml(event.eventId)}">Marcar como pago</button>` : '',
    event.actions?.canArchive ? `<button type="button" class="planner-action" data-planner-action="archive" data-planner-event-id="${escapeHtml(event.eventId)}">Arquivar</button>` : '',
    event.actions?.canDelete ? `<button type="button" class="planner-action" data-tone="danger" data-planner-action="delete" data-planner-event-id="${escapeHtml(event.eventId)}">Excluir</button>` : ''
  ].join('');
}

function renderEventDetail(event = {}, { open = false, showDate = false } = {}) {
  const kind = kindKey(event);
  const signed = signedAmount(event);
  const amount = signed
    ? `<span class="planner-item-amount" data-tone="${signed < 0 ? 'negative' : 'positive'}">${escapeHtml(currency(event.amount))}</span>`
    : '';
  const subline = [showDate ? formatDate(event.date) : '', kindLabel(kind), event.status].filter(Boolean).map(escapeHtml).join(' · ');
  const facts = [
    ['Pessoa', event.person],
    ['Grupo', event.macro],
    ['Categoria', event.category],
    ['Parcela', event.installment ? `${event.installmentNumber || ''}/${event.totalInstallments || ''}` : ''],
    ['Repete', event.recurrence ? 'Recorrência' : '']
  ].filter(([, value]) => value)
    .map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join('');
  const description = event.description && event.description !== event.title
    ? `<p class="planner-item-note">${escapeHtml(event.description)}</p>`
    : '';
  const actions = renderActions(event);
  const hasBody = facts || description || actions;

  return `
    <details class="planner-item" data-kind="${kind}" data-planner-source-id="${escapeHtml(event.sourceRecordId)}"${open && hasBody ? ' open' : ''}>
      <summary class="planner-item-summary">
        <i class="planner-dot" data-kind="${kind}"></i>
        <span class="planner-item-text">
          <span class="planner-item-title">${escapeHtml(event.title)}</span>
          ${subline ? `<span class="planner-item-sub">${subline}</span>` : ''}
        </span>
        ${amount}
        ${hasBody ? `<span class="planner-chevron" aria-hidden="true">${ICONS.chevron}</span>` : '<span class="planner-chevron-spacer"></span>'}
      </summary>
      ${hasBody ? `<div class="planner-item-body">
        ${facts ? `<dl class="planner-item-facts">${facts}</dl>` : ''}
        ${description}
        ${actions ? `<div class="planner-item-actions">${actions}</div>` : ''}
      </div>` : ''}
    </details>`;
}

function renderEmpty(message) {
  return `<p class="planner-empty">${escapeHtml(message)}</p>`;
}

function renderDayGroup(date, events = [], documentRef) {
  const net = dayNet(events);
  const netMarkup = net
    ? `<span class="planner-day-net" data-tone="${net < 0 ? 'negative' : 'positive'}">${escapeHtml(currency(net))}</span>`
    : '';
  return `
    <section class="planner-day-group">
      <button type="button" class="planner-day-head" data-planner-pick-date="${escapeHtml(date)}" aria-label="${escapeHtml(`Ver só ${formatDate(date)}`)}">
        <span class="planner-day-date">${escapeHtml(date.slice(8, 10))}</span>
        <span class="planner-day-weekday">${escapeHtml(weekdayLabel(date, documentRef))}</span>
        ${netMarkup}
      </button>
      <div class="planner-day-items">${events.map((event) => renderEventDetail(event)).join('')}</div>
    </section>`;
}

function renderMonthAgenda(model = {}, documentRef) {
  const events = model.events || [];
  if (!events.length) return renderEmpty('Nada marcado neste mês. Use "Novo evento" para adicionar um compromisso ou feriado.');
  const byDate = new Map();
  events.forEach((event) => {
    const date = event.date || '';
    if (!byDate.has(date)) byDate.set(date, []);
    byDate.get(date).push(event);
  });
  return [...byDate.entries()].map(([date, items]) => renderDayGroup(date, items, documentRef)).join('');
}

function renderDayAgenda(model = {}, selectedDate = '') {
  const events = model.byDay?.[selectedDate] || [];
  if (!events.length) return renderEmpty('Nada marcado neste dia.');
  // Dia com poucos itens ja abre os detalhes (acoes a um toque); com muitos, fica compacto.
  const open = events.length <= 3;
  return events.map((event) => renderEventDetail(event, { open })).join('');
}

function renderSummary(model = {}) {
  const income = model.summary?.income || 0;
  const expense = model.summary?.expense || 0;
  const balance = model.summary?.balance || 0;
  return `
    <div class="planner-stat" data-tone="positive"><dt>Entradas</dt><dd>${escapeHtml(currency(income))}</dd></div>
    <div class="planner-stat" data-tone="negative"><dt>Saídas</dt><dd>${escapeHtml(currency(expense))}</dd></div>
    <div class="planner-stat" data-tone="${balance < 0 ? 'negative' : 'neutral'}"><dt>Saldo previsto</dt><dd>${escapeHtml(currency(balance))}</dd></div>`;
}

function syncExpandAll(modal) {
  const button = modal.querySelector('[data-planner-expand-all]');
  const items = [...modal.querySelectorAll('#planner-selected-date-details details.planner-item')]
    .filter((item) => item.querySelector('.planner-item-body'));
  if (!button) return;
  const allOpen = items.length > 0 && items.every((item) => item.open);
  button.classList.toggle('hidden', items.length === 0);
  button.setAttribute('aria-expanded', String(allOpen));
  const label = button.querySelector('[data-planner-expand-label]');
  if (label) label.textContent = allOpen ? 'Recolher' : 'Expandir';
}

export function syncPlannerExpandAll(documentRef = globalThis.document) {
  const modal = documentRef?.getElementById?.('planner-modal');
  if (modal) syncExpandAll(modal);
}

export function togglePlannerDetails(documentRef = globalThis.document) {
  const modal = documentRef?.getElementById?.('planner-modal');
  if (!modal) return;
  const items = [...modal.querySelectorAll('#planner-selected-date-details details.planner-item')]
    .filter((item) => item.querySelector('.planner-item-body'));
  const shouldOpen = !items.every((item) => item.open);
  items.forEach((item) => { item.open = shouldOpen; });
  syncExpandAll(modal);
}

export function createPlannerPresenter({ document: documentRef = globalThis.document } = {}) {
  return {
    ensureModal: () => ensureModal(documentRef),
    show() {
      ensureModal(documentRef).classList.remove('hidden');
    },
    hide() {
      documentRef.getElementById('planner-modal')?.classList.add('hidden');
    },
    render(state = {}) {
      const model = state.model || state.data || state;
      const filters = model.metadata?.filters || {};
      const month = filters.month || filters.start || todayIso().slice(0, 7);
      const selectedDate = state.selectedDate || '';
      const modal = ensureModal(documentRef);
      const monthInput = modal.querySelector('#planner-month');
      const monthLabel = modal.querySelector('#planner-month-label');
      const dateInput = modal.querySelector('#planner-date');
      const grid = modal.querySelector('#planner-calendar-grid');
      const title = modal.querySelector('#planner-detail-title');
      const selectedLabel = modal.querySelector('#planner-selected-date-label');
      const details = modal.querySelector('#planner-selected-date-details');
      const summary = modal.querySelector('#planner-summary');
      const clearDate = modal.querySelector('#planner-clear-date');

      if (monthInput) monthInput.value = month;
      if (monthLabel) monthLabel.textContent = monthName(month, documentRef);
      if (dateInput && !dateInput.value) dateInput.value = selectedDate || `${month}-01`;
      if (dateInput) dateInput.dataset.selectedPlannerDate = selectedDate;

      const blanks = Array.from({ length: firstDayOffset(month) }, () => '<span class="planner-cell-blank"></span>').join('');
      const currentDate = todayIso();
      const days = Array.from({ length: daysInMonth(month) }, (_, index) => {
        const day = index + 1;
        const date = `${month}-${String(day).padStart(2, '0')}`;
        return renderCalendarDay({ day, date, events: model.byDay?.[date] || [], selectedDate, currentDate });
      }).join('');

      if (grid) grid.innerHTML = blanks + days;
      if (summary) summary.innerHTML = renderSummary(model);
      if (title) title.textContent = selectedDate ? weekdayLabel(selectedDate, documentRef) || 'Itens do dia' : 'Agenda do mês';
      if (selectedLabel) {
        const count = selectedDate ? (model.byDay?.[selectedDate] || []).length : (model.events || []).length;
        const scope = selectedDate ? formatDate(selectedDate) : monthName(month, documentRef);
        selectedLabel.textContent = `${scope} · ${count} ${count === 1 ? 'item' : 'itens'}`;
      }
      if (clearDate) {
        clearDate.classList.toggle('hidden', !selectedDate);
        clearDate.dataset.plannerPickDate = selectedDate;
      }
      if (details) details.innerHTML = selectedDate ? renderDayAgenda(model, selectedDate) : renderMonthAgenda(model, documentRef);
      syncExpandAll(modal);
    }
  };
}
