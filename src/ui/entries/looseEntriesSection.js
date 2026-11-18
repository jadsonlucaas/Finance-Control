import { buildLooseEntryRecord, selectLooseEntries } from '../../application/selectors/looseEntries.js';
import { formatCurrency } from '../../core/formatters.js';
import { showToast as showModernToast } from '../toast.js';

/*
 * Entradas avulsas na tela de Entradas: freelas, bonus, vendas e outras receitas que nao
 * fazem parte do salario. Lista limpa por mes, com janela para incluir, editar e excluir.
 */

const SECTION_ID = 'loose-entries';
const DIALOG_ID = 'loose-entry-dialog';

const ICONS = {
  plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
  close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>',
  edit: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>'
};

function escapeHtml(value = '') {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDate(date = '') {
  if (!/^\d{4}-\d{2}-\d{2}/.test(date)) return '';
  const [year, month, day] = date.slice(0, 10).split('-');
  return `${day}/${month}/${year}`;
}

function today() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function toast(target, message, isError = false) {
  if (typeof target.showToast === 'function') return target.showToast(message, isError);
  return showModernToast(message, isError);
}

function records(target) {
  return Array.isArray(target.allRecords) ? target.allRecords : [];
}

function selectedCompetence(documentRef) {
  return String(documentRef.getElementById('entradas-competence-filter')?.value || '').slice(0, 7);
}

function peopleNames(target) {
  const fromPeople = typeof target.getPeopleRecords === 'function'
    ? target.getPeopleRecords().map((record) => record.person)
    : [];
  const fromEntries = records(target).filter((record) => record.type === 'entrada').map((record) => record.person);
  return [...new Set([...fromPeople, ...fromEntries].map((name) => String(name || '').trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

function ensureSection(documentRef) {
  let section = documentRef.getElementById(SECTION_ID);
  if (section) return section;
  const view = documentRef.getElementById('view-entradas');
  if (!view) return null;
  section = documentRef.createElement('section');
  section.id = SECTION_ID;
  section.className = 'loose-entries';
  section.setAttribute('aria-labelledby', 'loose-entries-title');
  section.innerHTML = `
    <div class="loose-entries-head">
      <div>
        <h3 id="loose-entries-title" class="loose-entries-title">Entradas avulsas</h3>
        <p id="loose-entries-meta" class="loose-entries-meta"></p>
      </div>
      <button type="button" class="loose-entries-add" data-loose-entry-new aria-label="Nova entrada avulsa">${ICONS.plus}<span>Nova entrada avulsa</span></button>
    </div>
    <div id="loose-entries-list" class="loose-entries-list"></div>`;
  view.appendChild(section);
  return section;
}

function renderRow(record) {
  const sub = [record.person, formatDate(record.occurred_date || record.date || record.paid_at)]
    .filter(Boolean).map(escapeHtml).join(' · ');
  return `
    <button type="button" class="loose-entry-row" data-loose-entry-edit="${escapeHtml(record.id)}">
      <span class="loose-entry-text">
        <span class="loose-entry-title">${escapeHtml(record.description || record.subcategory || record.earning_type || 'Entrada')}</span>
        ${sub ? `<span class="loose-entry-sub">${sub}</span>` : ''}
      </span>
      <span class="loose-entry-amount">${escapeHtml(formatCurrency(record.amount))}</span>
      <span class="loose-entry-edit" aria-hidden="true">${ICONS.edit}</span>
    </button>`;
}

export function renderLooseEntriesSection(target = globalThis) {
  const documentRef = target.document;
  if (!documentRef) return null;
  const section = ensureSection(documentRef);
  if (!section) return null;
  const competence = selectedCompetence(documentRef);
  const { items, total, count } = selectLooseEntries(records(target), {
    competence,
    search: documentRef.getElementById('entradas-search')?.value || '',
    isArchivedRecord: target.isArchivedRecord,
    isReferenceSalaryRecord: target.isReferenceSalaryRecord
  });
  const meta = section.querySelector('#loose-entries-meta');
  const list = section.querySelector('#loose-entries-list');
  if (meta) {
    meta.textContent = count
      ? `${count} ${count === 1 ? 'entrada' : 'entradas'} · ${formatCurrency(total)}`
      : 'Freelas, vendas, presentes e outras receitas fora do salário.';
  }
  if (list) {
    list.innerHTML = count
      ? items.map(renderRow).join('')
      : `<p class="loose-entries-empty">Nenhuma entrada avulsa ${competence ? 'neste mês' : 'cadastrada'}.</p>`;
  }
  return { count, total };
}

/* ---------- Janela de incluir/editar ---------- */

function ensureDialog(documentRef) {
  let dialog = documentRef.getElementById(DIALOG_ID);
  if (dialog) return dialog;
  dialog = documentRef.createElement('div');
  dialog.id = DIALOG_ID;
  dialog.className = 'loose-dialog hidden';
  dialog.innerHTML = `
    <div class="loose-dialog-scrim" data-loose-entry-close></div>
    <div class="loose-dialog-card" role="dialog" aria-modal="true" aria-labelledby="loose-entry-dialog-title">
      <div class="loose-dialog-head">
        <h3 id="loose-entry-dialog-title" class="loose-dialog-title">Nova entrada avulsa</h3>
        <button type="button" class="loose-icon-button" data-loose-entry-close aria-label="Fechar">${ICONS.close}</button>
      </div>
      <form class="loose-form" novalidate>
        <label class="loose-field"><span>Descrição</span><input id="loose-entry-description" type="text" placeholder="Ex.: Freela de design" autocomplete="off"></label>
        <label class="loose-field"><span>Valor</span><input id="loose-entry-amount" type="number" inputmode="decimal" step="0.01" min="0" placeholder="0,00"></label>
        <div class="loose-form-row">
          <label class="loose-field"><span>Data</span><input id="loose-entry-date" type="date"></label>
          <label class="loose-field"><span>Pessoa</span><input id="loose-entry-person" type="text" list="loose-entry-people" autocomplete="off"></label>
        </div>
        <datalist id="loose-entry-people"></datalist>
        <p id="loose-entry-error" class="loose-form-error" role="alert"></p>
        <div class="loose-form-actions">
          <button type="button" class="loose-delete hidden" data-loose-entry-delete>Excluir</button>
          <button type="submit" class="loose-save">Salvar</button>
        </div>
      </form>
    </div>`;
  documentRef.body.appendChild(dialog);
  return dialog;
}

const ERROR_MESSAGES = {
  DESCRIPTION_REQUIRED: 'Informe a descrição.',
  AMOUNT_REQUIRED: 'Informe um valor maior que zero.',
  DATE_REQUIRED: 'Informe a data.',
  PERSON_REQUIRED: 'Informe a pessoa.'
};

export function openLooseEntryDialog(target = globalThis, recordId = '') {
  const documentRef = target.document;
  const dialog = ensureDialog(documentRef);
  const existing = recordId ? records(target).find((record) => String(record.id) === String(recordId)) : null;
  const people = peopleNames(target);
  dialog.dataset.recordId = existing?.id || '';
  dialog.querySelector('#loose-entry-dialog-title').textContent = existing ? 'Editar entrada avulsa' : 'Nova entrada avulsa';
  dialog.querySelector('#loose-entry-people').innerHTML = people.map((name) => `<option value="${escapeHtml(name)}"></option>`).join('');
  const competence = selectedCompetence(documentRef);
  const defaultDate = competence && competence !== today().slice(0, 7) ? `${competence}-01` : today();
  dialog.querySelector('#loose-entry-description').value = existing?.description || '';
  dialog.querySelector('#loose-entry-amount').value = existing ? Number(existing.amount || 0).toFixed(2) : '';
  dialog.querySelector('#loose-entry-date').value = String(existing?.occurred_date || existing?.paid_at || defaultDate).slice(0, 10);
  dialog.querySelector('#loose-entry-person').value = existing?.person || (people.length === 1 ? people[0] : '');
  dialog.querySelector('#loose-entry-error').textContent = '';
  const deleteButton = dialog.querySelector('[data-loose-entry-delete]');
  deleteButton.classList.toggle('hidden', !existing);
  deleteButton.dataset.confirming = '';
  deleteButton.textContent = 'Excluir';
  dialog.classList.remove('hidden');
  dialog.querySelector('#loose-entry-description').focus();
}

function closeDialog(documentRef) {
  documentRef.getElementById(DIALOG_ID)?.classList.add('hidden');
}

function refreshLists(target) {
  if (typeof target.renderCurrentTab === 'function') target.renderCurrentTab();
  else renderLooseEntriesSection(target);
}

async function saveDialog(target) {
  const documentRef = target.document;
  const dialog = documentRef.getElementById(DIALOG_ID);
  const recordId = dialog?.dataset.recordId || '';
  const existing = recordId ? records(target).find((record) => String(record.id) === recordId) : null;
  const built = buildLooseEntryRecord({
    description: dialog.querySelector('#loose-entry-description').value,
    amount: dialog.querySelector('#loose-entry-amount').value,
    date: dialog.querySelector('#loose-entry-date').value,
    person: dialog.querySelector('#loose-entry-person').value
  }, existing);
  const errorEl = dialog.querySelector('#loose-entry-error');
  if (!built.ok) {
    errorEl.textContent = ERROR_MESSAGES[built.errors[0]] || 'Confira os campos.';
    return { success: false };
  }
  const mutations = target.financeRecordMutations;
  if (!mutations) {
    errorEl.textContent = 'Não foi possível salvar agora. Tente novamente.';
    return { success: false };
  }
  const saveButton = dialog.querySelector('.loose-save');
  saveButton.disabled = true;
  try {
    const result = existing
      ? await mutations.updateRecord({ ...built.record, id: existing.id })
      : await mutations.createRecord(built.record);
    if (!(result?.isOk || result?.success)) {
      errorEl.textContent = 'Não foi possível salvar agora. Tente novamente.';
      return { success: false };
    }
    const list = records(target);
    if (existing) {
      const index = list.findIndex((record) => record.id === existing.id);
      if (index >= 0) list[index] = { ...built.record, id: existing.id };
    } else if (result.id && !list.some((record) => record.id === result.id)) {
      list.push({ ...built.record, id: result.id });
    }
    closeDialog(documentRef);
    toast(target, existing ? 'Entrada atualizada!' : 'Entrada salva!');
    refreshLists(target);
    return { success: true };
  } finally {
    saveButton.disabled = false;
  }
}

async function deleteFromDialog(target, button) {
  const documentRef = target.document;
  if (button.dataset.confirming !== 'true') {
    button.dataset.confirming = 'true';
    button.textContent = 'Confirmar exclusão';
    return;
  }
  const dialog = documentRef.getElementById(DIALOG_ID);
  const existing = records(target).find((record) => String(record.id) === String(dialog?.dataset.recordId || ''));
  if (!existing || !target.financeRecordMutations) return;
  button.disabled = true;
  try {
    const result = await target.financeRecordMutations.deleteRecord(existing);
    if (!(result?.isOk || result?.success)) {
      toast(target, 'Não foi possível excluir. Tente novamente.', true);
      return;
    }
    const list = records(target);
    const index = list.findIndex((record) => record.id === existing.id);
    if (index >= 0) list.splice(index, 1);
    closeDialog(documentRef);
    toast(target, 'Excluído!');
    refreshLists(target);
  } finally {
    button.disabled = false;
  }
}

export function installLooseEntriesSection(target = globalThis) {
  const documentRef = target?.document;
  if (!documentRef || target.__financeLooseEntriesInstalled) return false;
  target.__financeLooseEntriesInstalled = true;

  // A tela de Entradas e montada pelo legado: depois de cada renderEntradas, monta a lista avulsa.
  const original = target.renderEntradas;
  if (typeof original === 'function') {
    target.renderEntradas = function renderEntradasWithLooseEntries(...args) {
      const result = original.apply(this, args);
      try {
        renderLooseEntriesSection(target);
      } catch (error) {
        target.console?.warn?.('[loose-entries] render failed', error);
      }
      return result;
    };
  }

  documentRef.addEventListener('click', (event) => {
    if (event.target.closest?.('[data-loose-entry-new]')) {
      event.preventDefault();
      openLooseEntryDialog(target);
      return;
    }
    const edit = event.target.closest?.('[data-loose-entry-edit]');
    if (edit) {
      event.preventDefault();
      openLooseEntryDialog(target, edit.dataset.looseEntryEdit);
      return;
    }
    if (event.target.closest?.('[data-loose-entry-close]')) {
      event.preventDefault();
      closeDialog(documentRef);
      return;
    }
    const remove = event.target.closest?.('[data-loose-entry-delete]');
    if (remove) {
      event.preventDefault();
      deleteFromDialog(target, remove);
    }
  });
  documentRef.addEventListener('submit', (event) => {
    if (!event.target.closest?.(`#${DIALOG_ID}`)) return;
    event.preventDefault();
    saveDialog(target);
  });
  documentRef.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    const dialog = documentRef.getElementById(DIALOG_ID);
    if (!dialog || dialog.classList.contains('hidden')) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    closeDialog(documentRef);
  }, true);

  if (!documentRef.getElementById('view-entradas')?.classList.contains('hidden')) {
    renderLooseEntriesSection(target);
  }
  return true;
}
