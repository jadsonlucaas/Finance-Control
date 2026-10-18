import { buildPlannerReadModel } from '../../application/readModels/plannerReadModel.js';
import { createPlannerLocalEventStore } from '../../application/planner/plannerLocalEventStore.js';
import { createPlannerPresenter } from './plannerPresenter.js';

function todayIso() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function thisMonth() {
  return todayIso().slice(0, 7);
}

function shiftMonth(month = thisMonth(), delta = 0) {
  const [year, value] = String(month || thisMonth()).split('-').map(Number);
  const date = new Date(year || new Date().getFullYear(), (value || new Date().getMonth() + 1) - 1 + Number(delta || 0), 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function getMonthFromDocument(documentRef) {
  return documentRef?.getElementById?.('planner-month')?.value
    || documentRef?.getElementById?.('f-comp-start')?.value
    || thisMonth();
}

function readForm(documentRef) {
  return {
    date: documentRef.getElementById('planner-date')?.value || '',
    type: documentRef.getElementById('planner-type')?.value || 'commitment',
    title: documentRef.getElementById('planner-title')?.value || '',
    note: documentRef.getElementById('planner-note')?.value || ''
  };
}

function clearForm(documentRef) {
  const title = documentRef.getElementById('planner-title');
  const note = documentRef.getElementById('planner-note');
  if (title) title.value = '';
  if (note) note.value = '';
}

function successful(result = {}) {
  return result.success === true || result.isOk === true || result.ok === true;
}

export function createPlannerController(dependencies = {}) {
  const target = dependencies.target || globalThis;
  const documentRef = dependencies.document || target.document;
  const storage = dependencies.storage || target.localStorage;
  const ownerProvider = dependencies.ownerProvider || (() => target.currentUser?.uid || target.auth?.currentUser?.uid || target.currentUserProfile?.uid || '');
  const localEventStore = dependencies.localEventStore || createPlannerLocalEventStore({ storage });
  const financialActions = dependencies.financialActions || {};
  const presenter = dependencies.presenter || createPlannerPresenter({ document: documentRef });
  const readModel = dependencies.readModel || buildPlannerReadModel;
  const readSource = dependencies.readSource || {
    read: async () => ({ records: target.allRecords || [] }),
    subscribe: null
  };
  const now = dependencies.now || (() => new Date().toISOString());
  const toast = dependencies.toast || ((message, isError) => target.showToast?.(message, isError));
  const subscriptions = new Set();
  let state = {
    month: getMonthFromDocument(documentRef),
    selectedDate: '',
    model: null,
    ownerUid: ''
  };

  function getOwnerUid() {
    return String(ownerProvider() || '').trim();
  }

  function resetOwnerState(ownerUid = '') {
    if (state.ownerUid === ownerUid) return;
    state = {
      ...state,
      selectedDate: '',
      model: null,
      ownerUid
    };
  }

  function buildModel(payload = {}) {
    const ownerUid = getOwnerUid();
    resetOwnerState(ownerUid);
    const plannerEvents = payload.plannerEvents || localEventStore.list({ ownerUid });
    return readModel({
      records: payload.records || [],
      plannerEvents,
      filters: {
        ...(payload.filters || {}),
        month: state.month,
        start: state.month,
        end: state.month
      },
      metadata: payload.metadata || {}
    });
  }

  async function load() {
    const ownerUid = getOwnerUid();
    resetOwnerState(ownerUid);
    const payload = await readSource.read({ month: state.month });
    state.model = buildModel(payload || {});
    presenter.render({ model: state.model, selectedDate: state.selectedDate });
    return state.model;
  }

  async function open() {
    resetOwnerState(getOwnerUid());
    presenter.ensureModal();
    state.month = getMonthFromDocument(documentRef);
    state.selectedDate = '';
    await load();
    presenter.show();
    target.lucide?.createIcons?.();
  }

  function close() {
    presenter.hide();
  }

  async function render() {
    state.month = getMonthFromDocument(documentRef);
    await load();
    target.lucide?.createIcons?.();
  }

  async function saveLocalEvent() {
    const ownerUid = getOwnerUid();
    resetOwnerState(ownerUid);
    const form = readForm(documentRef);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.date)) {
      toast('Informe uma data valida para o Planner.', true);
      return { success: false, code: 'PLANNER_DATE_REQUIRED' };
    }
    const event = {
      id: `planner-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      date: form.date,
      type: form.type,
      title: form.title.trim() || (form.type === 'holiday' ? 'Feriado' : 'Compromisso'),
      note: form.note.trim(),
      created_at: now()
    };
    localEventStore.save(event, { ownerUid });
    clearForm(documentRef);
    state.month = form.date.slice(0, 7);
    state.selectedDate = form.date;
    await load();
    toast('Evento salvo no Planner.');
    return { success: true, data: event };
  }

  async function deleteLocalEvent(id = '') {
    const ownerUid = getOwnerUid();
    resetOwnerState(ownerUid);
    localEventStore.remove(id, { ownerUid });
    await load();
    toast('Evento removido do Planner.');
    return { success: true, id };
  }

  async function selectDate(date = '') {
    state.selectedDate = state.selectedDate === date ? '' : date;
    const input = documentRef.getElementById('planner-date');
    if (input && date) input.value = date;
    await load();
  }

  async function changeMonth(delta = 0) {
    state.month = shiftMonth(state.month || getMonthFromDocument(documentRef), delta);
    state.selectedDate = '';
    await load();
  }

  function getEventById(eventId = '') {
    return state.model?.getById?.(eventId) || null;
  }

  async function delegateExpenseAction(action = '', eventId = '') {
    const event = getEventById(eventId);
    if (!event || event.kind !== 'expense' || !event.sourceRecordId) {
      return { success: false, code: 'PLANNER_EVENT_NOT_FOUND' };
    }
    const input = { expenseId: event.sourceRecordId, id: event.sourceRecordId };
    let result = null;
    if (action === 'mark-paid') result = await financialActions.markExpenseAsPaid?.(input, { sourceReferenceId: 'planner' });
    if (action === 'update') result = await financialActions.updateExpense?.(input, { sourceReferenceId: 'planner' });
    if (action === 'archive') result = await financialActions.archiveExpense?.(input, { sourceReferenceId: 'planner' });
    if (action === 'delete') result = await financialActions.deleteExpense?.(input, { sourceReferenceId: 'planner' });
    if (!result) return { success: false, code: 'PLANNER_ACTION_UNAVAILABLE' };
    if (successful(result)) await load();
    return result;
  }

  function subscribe() {
    const unsubscribe = typeof readSource.subscribe === 'function'
      ? readSource.subscribe({ month: state.month }, (payload = {}) => {
          state.model = buildModel(payload || {});
          presenter.render({ model: state.model, selectedDate: state.selectedDate });
        })
      : null;
    if (typeof unsubscribe === 'function') subscriptions.add(unsubscribe);
    return unsubscribe;
  }

  function destroy() {
    for (const unsubscribe of subscriptions) unsubscribe();
    subscriptions.clear();
    state = {
      ...state,
      selectedDate: '',
      model: null,
      ownerUid: ''
    };
  }

  return {
    open,
    close,
    render,
    load,
    saveLocalEvent,
    deleteLocalEvent,
    selectDate,
    shiftMonth: changeMonth,
    delegateExpenseAction,
    subscribe,
    destroy,
    getState: () => ({ ...state }),
    getSubscriptionCount: () => subscriptions.size
  };
}
