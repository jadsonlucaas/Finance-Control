import { formatCurrency as formatDisplayCurrency } from '../../core/formatters.js';

/*
 * Planner mensal (v3): usa os tokens de tema (claro/escuro) definidos em styles/shell.css.
 * - O mes fica limpo: cada dia mostra so pontos coloridos por tipo (e o saldo do dia no computador).
 * - Tocar num dia abre uma janela com os itens daquele dia; cada item tem seta para os detalhes.
 * - "Novo evento" abre o formulario em outra janela.
 */
const MODAL_VERSION = '3';
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
            <p class="planner-subheading">Escolha um dia para ver o que vence, entra ou acontece nele</p>
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
          <button type="button" class="planner-primary-button planner-new-event-button" data-planner-new-event>${ICONS.plus}<span>Novo evento</span></button>
        </div>
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
      </div>
      <div id="planner-day-dialog" class="planner-dialog hidden">
        <div class="planner-dialog-scrim" data-planner-close-day></div>
        <div class="planner-dialog-card" role="dialog" aria-modal="true" aria-labelledby="planner-detail-title">
          <div class="planner-dialog-head">
            <div class="planner-dialog-heading">
              <h3 id="planner-detail-title" class="planner-dialog-title"></h3>
              <p id="planner-selected-date-label" class="planner-dialog-meta"></p>
            </div>
            <button type="button" class="planner-icon-button" data-planner-close-day aria-label="Fechar dia">${ICONS.close}</button>
          </div>
          <div class="planner-dialog-tools">
            <span id="planner-day-net" class="planner-day-net"></span>
            <button type="button" class="planner-text-button planner-expand-all" data-planner-expand-all aria-expanded="false">
              <span data-planner-expand-label>Expandir</span>${ICONS.chevron}
            </button>
          </div>
          <div id="planner-selected-date-details" class="planner-details"></div>
          <div class="planner-dialog-foot">
            <button type="button" class="planner-secondary-button" data-planner-new-event>${ICONS.plus}<span>Adicionar evento neste dia</span></button>
          </div>
        </div>
      </div>
      <div id="planner-new-event-dialog" class="planner-dialog planner-dialog-top hidden">
        <div class="planner-dialog-scrim" data-planner-close-new-event></div>
        <div class="planner-dialog-card" role="dialog" aria-modal="true" aria-labelledby="planner-new-event-title">
          <div class="planner-dialog-head">
            <h3 id="planner-new-event-title" class="planner-dialog-title">Novo evento</h3>
            <button type="button" class="planner-icon-button" data-planner-close-new-event aria-label="Cancelar">${ICONS.close}</button>
          </div>
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
  const dots = groupByKind(events).slice(0, 4)
    .map((group) => `<i class="planner-dot" data-kind="${group.kind}"></i>`).join('');
  const net = dayNet(events);
  const note = net
    ? `<span class="planner-cell-net" data-tone="${net < 0 ? 'negative' : 'positive'}">${escapeHtml(currency(net))}</span>`
    : (events[0] ? `<span class="planner-cell-note">${escapeHtml(events[0].title)}</span>` : '');
  return `
    <button type="button" data-select-planner-date="${escapeHtml(date)}" class="${classes.join(' ')}" aria-label="${escapeHtml(describeDay(date, events))}">
      <span class="planner-cell-day">${day}</span>
      ${dots ? `<span class="planner-cell-dots">${dots}</span>` : ''}
      ${note}
    </button>`;
}

/* ---------- Itens do dia ---------- */

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

function renderEventDetail(event = {}, { open = false } = {}) {
  const kind = kindKey(event);
  const signed = signedAmount(event);
  const amount = signed
    ? `<span class="planner-item-amount" data-tone="${signed < 0 ? 'negative' : 'positive'}">${escapeHtml(currency(event.amount))}</span>`
    : '';
  const subline = [kindLabel(kind), event.status].filter(Boolean).map(escapeHtml).join(' · ');
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

function renderDayAgenda(events = []) {
  if (!events.length) return '<p class="planner-empty">Nada marcado neste dia.</p>';
  // Dia com poucos itens ja abre os detalhes (acoes a um toque); com muitos, fica compacto.
  const open = events.length <= 3;
  return events.map((event) => renderEventDetail(event, { open })).join('');
}

function renderSummary(summary = {}) {
  const income = summary.income || 0;
  const expense = summary.expense || 0;
  const balance = summary.balance || 0;
  return `
    <div class="planner-stat" data-tone="positive"><dt>Entradas</dt><dd>${escapeHtml(currency(income))}</dd></div>
    <div class="planner-stat" data-tone="negative"><dt>Saídas</dt><dd>${escapeHtml(currency(expense))}</dd></div>
    <div class="planner-stat" data-tone="${balance < 0 ? 'negative' : 'neutral'}"><dt>Saldo previsto</dt><dd>${escapeHtml(currency(balance))}</dd></div>`;
}

function expandableItems(modal) {
  return [...modal.querySelectorAll('#planner-selected-date-details details.planner-item')]
    .filter((item) => item.querySelector('.planner-item-body'));
}

function syncExpandAll(modal) {
  const button = modal.querySelector('[data-planner-expand-all]');
  if (!button) return;
  const items = expandableItems(modal);
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
  const items = expandableItems(modal);
  const shouldOpen = !items.every((item) => item.open);
  items.forEach((item) => { item.open = shouldOpen; });
  syncExpandAll(modal);
}

export function setPlannerNewEventOpen(documentRef = globalThis.document, open = true) {
  const dialog = documentRef?.getElementById?.('planner-new-event-dialog');
  if (!dialog) return;
  dialog.classList.toggle('hidden', !open);
  if (open) documentRef.getElementById('planner-title')?.focus?.();
}

export function createPlannerPresenter({ document: documentRef = globalThis.document } = {}) {
  return {
    ensureModal: () => ensureModal(documentRef),
    show() {
      ensureModal(documentRef).classList.remove('hidden');
    },
    hide() {
      const modal = documentRef.getElementById('planner-modal');
      modal?.classList.add('hidden');
      modal?.querySelector('#planner-new-event-dialog')?.classList.add('hidden');
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
      const dayDialog = modal.querySelector('#planner-day-dialog');
      const title = modal.querySelector('#planner-detail-title');
      const selectedLabel = modal.querySelector('#planner-selected-date-label');
      const details = modal.querySelector('#planner-selected-date-details');
      const dayNetEl = modal.querySelector('#planner-day-net');
      const summary = modal.querySelector('#planner-summary');

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
      if (summary) summary.innerHTML = renderSummary(state.summary || model.summary || {});

      const events = selectedDate ? model.byDay?.[selectedDate] || [] : [];
      if (dayDialog) {
        dayDialog.classList.toggle('hidden', !selectedDate);
        dayDialog.querySelectorAll('[data-planner-close-day]').forEach((button) => {
          button.dataset.plannerPickDate = selectedDate;
        });
      }
      if (title) title.textContent = selectedDate ? `${weekdayLabel(selectedDate, documentRef)}, ${selectedDate.slice(8, 10)}` : '';
      if (selectedLabel) {
        selectedLabel.textContent = selectedDate
          ? `${formatDate(selectedDate)} · ${events.length} ${events.length === 1 ? 'item' : 'itens'}`
          : '';
      }
      if (dayNetEl) {
        const net = dayNet(events);
        dayNetEl.textContent = net ? `Saldo do dia: ${currency(net)}` : '';
        dayNetEl.dataset.tone = net < 0 ? 'negative' : 'positive';
      }
      if (details) details.innerHTML = selectedDate ? renderDayAgenda(events) : '';
      syncExpandAll(modal);
    }
  };
}
