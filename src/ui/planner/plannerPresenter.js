function currency(value = 0) {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
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

function monthName(month = '') {
  if (!/^\d{4}-\d{2}$/.test(month)) return month || '';
  const [year, value] = month.split('-').map(Number);
  return new Date(year, value - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}

function tone(event = {}) {
  if (event.kind === 'expense') return 'border-rose-200 bg-rose-50 text-rose-700';
  if (event.kind === 'income') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (event.kind === 'holiday') return 'border-amber-200 bg-amber-50 text-amber-700';
  if (event.kind === 'hour_extra') return 'border-sky-200 bg-sky-50 text-sky-700';
  if (event.kind === 'bank_hours') return 'border-indigo-200 bg-indigo-50 text-indigo-700';
  return 'border-slate-200 bg-slate-50 text-slate-700';
}

function badgeLabel(event = {}) {
  if (event.kind === 'expense') return 'Saida';
  if (event.kind === 'income') return 'Entrada';
  if (event.kind === 'holiday') return 'Feriado';
  if (event.kind === 'hour_extra') return 'H.E';
  if (event.kind === 'bank_hours') return 'Banco';
  return 'Agenda';
}

function ensureModal(documentRef) {
  let modal = documentRef.getElementById('planner-modal');
  if (modal) return modal;

  modal = documentRef.createElement('div');
  modal.id = 'planner-modal';
  modal.className = 'hidden fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-sm overflow-y-auto';
  modal.innerHTML = `
    <div class="min-h-full px-4 py-6 flex items-start justify-center">
      <div class="w-full max-w-6xl rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
        <div class="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div>
            <h2 class="text-xl font-bold text-slate-900">Planner Mensal</h2>
            <p class="text-sm text-slate-500">Feriados, compromissos e registros financeiros persistidos</p>
          </div>
          <button type="button" class="h-9 w-9 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200" data-close-modal="planner-modal" aria-label="Fechar">x</button>
        </div>
        <div class="grid gap-4 p-5 lg:grid-cols-[minmax(0,1fr)_360px]">
          <section class="space-y-4">
            <div class="flex flex-wrap items-center gap-2">
              <button type="button" class="px-3 py-2 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200" data-shift-planner-month="-1" aria-label="Mes anterior">&lt;</button>
              <input id="planner-month" type="month" class="rounded-lg border border-slate-300 px-3 py-2 text-sm" data-legacy-change="renderPlannerModal">
              <button type="button" class="px-3 py-2 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200" data-shift-planner-month="1" aria-label="Proximo mes">&gt;</button>
            </div>
            <div class="grid grid-cols-7 gap-1 text-center text-xs font-semibold uppercase text-slate-400">
              <span>Dom</span><span>Seg</span><span>Ter</span><span>Qua</span><span>Qui</span><span>Sex</span><span>Sab</span>
            </div>
            <div id="planner-calendar-grid" class="grid grid-cols-7 gap-2"></div>
          </section>
          <aside class="space-y-4">
            <div class="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <h3 class="font-semibold text-slate-900">Novo evento</h3>
              <div class="mt-3 grid gap-2">
                <input id="planner-date" type="date" class="rounded-lg border border-slate-300 px-3 py-2 text-sm">
                <select id="planner-type" class="rounded-lg border border-slate-300 px-3 py-2 text-sm">
                  <option value="commitment">Compromisso</option>
                  <option value="holiday">Feriado</option>
                </select>
                <input id="planner-title" type="text" class="rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Titulo">
                <textarea id="planner-note" class="min-h-20 rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Observacao"></textarea>
                <button type="button" class="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-700" data-legacy-click="savePlannerEvent">Salvar evento</button>
              </div>
            </div>
            <div class="rounded-xl border border-slate-200 p-4">
              <h3 id="planner-detail-title" class="font-semibold text-slate-900">Resumo do mes</h3>
              <p id="planner-selected-date-label" class="text-sm text-slate-500"></p>
              <div id="planner-selected-date-details" class="mt-3 space-y-2"></div>
            </div>
          </aside>
        </div>
      </div>
    </div>`;
  documentRef.body.appendChild(modal);
  return modal;
}

function renderEventBadge(event = {}) {
  return `<span class="block truncate rounded-md border px-1.5 py-0.5 text-[11px] ${tone(event)}">${escapeHtml(badgeLabel(event))}</span>`;
}

function renderCalendarDay({ day, date, events = [], selectedDate, currentDate }) {
  const selected = date === selectedDate ? 'ring-2 ring-cyan-500' : '';
  const today = date === currentDate ? 'border-cyan-300' : 'border-slate-200';
  const badges = events.slice(0, 3).map(renderEventBadge).join('');
  const extra = events.length > 3 ? `<span class="text-[11px] text-slate-400">+${events.length - 3}</span>` : '';
  return `
    <button type="button" data-select-planner-date="${escapeHtml(date)}" class="min-h-24 rounded-xl border ${today} ${selected} bg-white p-2 text-left hover:border-cyan-300">
      <span class="text-sm font-semibold text-slate-800">${day}</span>
      <span class="mt-2 block space-y-1">${badges}${extra}</span>
    </button>`;
}

function renderEventDetail(event = {}) {
  const amount = event.amount ? `<strong class="${event.kind === 'expense' ? 'text-rose-600' : 'text-emerald-600'}">${currency(event.amount)}</strong>` : '';
  const meta = [event.person, event.status, event.macro, event.category].filter(Boolean).map(escapeHtml).join(' • ');
  const series = [
    event.installment ? `Parcela ${event.installmentNumber || ''}/${event.totalInstallments || ''}`.trim() : '',
    event.recurrence ? 'Recorrencia' : ''
  ].filter(Boolean).map(escapeHtml).join(' • ');
  const actions = event.source === 'planner_local' && event.actions?.canDelete
    ? `<button type="button" class="text-xs font-semibold text-rose-600 hover:text-rose-700" data-delete-planner-event="${escapeHtml(event.sourceRecordId)}">Excluir</button>`
    : event.kind === 'expense'
      ? `<div class="flex flex-wrap gap-2">
          ${event.actions?.canMarkPaid ? `<button type="button" class="rounded-md bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700" data-planner-action="mark-paid" data-planner-event-id="${escapeHtml(event.eventId)}">Marcar pago</button>` : ''}
          ${event.actions?.canArchive ? `<button type="button" class="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700" data-planner-action="archive" data-planner-event-id="${escapeHtml(event.eventId)}">Arquivar</button>` : ''}
          ${event.actions?.canDelete ? `<button type="button" class="rounded-md bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-700" data-planner-action="delete" data-planner-event-id="${escapeHtml(event.eventId)}">Excluir</button>` : ''}
        </div>`
      : '';

  return `
    <article class="rounded-xl border p-3 ${tone(event)}" data-planner-source-id="${escapeHtml(event.sourceRecordId)}">
      <div class="flex items-start justify-between gap-3">
        <div>
          <p class="text-sm font-semibold">${escapeHtml(event.title)}</p>
          <p class="text-xs opacity-80">${escapeHtml(formatDate(event.date))}${meta ? ` • ${meta}` : ''}</p>
          ${series ? `<p class="text-xs opacity-80">${series}</p>` : ''}
        </div>
        ${amount}
      </div>
      ${event.description ? `<p class="mt-2 text-xs opacity-90">${escapeHtml(event.description)}</p>` : ''}
      ${actions ? `<div class="mt-3">${actions}</div>` : ''}
    </article>`;
}

function renderDetails(model = {}, selectedDate = '') {
  const source = selectedDate ? model.byDay?.[selectedDate] || [] : model.events || [];
  if (!source.length) return '<p class="text-sm text-slate-500">Nenhum item para exibir.</p>';
  return source.map(renderEventDetail).join('');
}

function renderSummary(model = {}) {
  return `
    <div class="grid grid-cols-2 gap-2 text-xs text-slate-600">
      <span>Entradas</span><strong class="text-right text-emerald-600">${currency(model.summary?.income || 0)}</strong>
      <span>Saidas</span><strong class="text-right text-rose-600">${currency(model.summary?.expense || 0)}</strong>
      <span>Saldo previsto</span><strong class="text-right text-slate-900">${currency(model.summary?.balance || 0)}</strong>
      <span>Itens</span><strong class="text-right text-slate-900">${model.summary?.count || 0}</strong>
    </div>`;
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
      const dateInput = modal.querySelector('#planner-date');
      const grid = modal.querySelector('#planner-calendar-grid');
      const title = modal.querySelector('#planner-detail-title');
      const selectedLabel = modal.querySelector('#planner-selected-date-label');
      const details = modal.querySelector('#planner-selected-date-details');

      if (monthInput) monthInput.value = month;
      if (dateInput && !dateInput.value) dateInput.value = selectedDate || `${month}-01`;
      if (dateInput) dateInput.dataset.selectedPlannerDate = selectedDate;

      const blanks = Array.from({ length: firstDayOffset(month) }, () => '<div></div>').join('');
      const currentDate = todayIso();
      const days = Array.from({ length: daysInMonth(month) }, (_, index) => {
        const day = index + 1;
        const date = `${month}-${String(day).padStart(2, '0')}`;
        return renderCalendarDay({ day, date, events: model.byDay?.[date] || [], selectedDate, currentDate });
      }).join('');

      if (grid) grid.innerHTML = blanks + days;
      if (title) title.textContent = selectedDate ? 'Itens do dia' : 'Resumo do mes';
      if (selectedLabel) selectedLabel.textContent = selectedDate ? formatDate(selectedDate) : monthName(month);
      if (details) details.innerHTML = selectedDate ? renderDetails(model, selectedDate) : `${renderSummary(model)}<div class="mt-3 space-y-2">${renderDetails(model)}</div>`;
    }
  };
}
