import { roundCurrency } from '../../core/money.js';
import { createMemoryMutationAttemptStore } from '../records/mutationAttemptStore.js';
import { createHourControlController } from './hourControlController.js';
import { createHourControlPresenter } from './hourControlPresenter.js';

export const HOUR_CONTROL_ACTIVE_UI_RUNTIME_MARKER = 'finance-hour-control-active-ui-runtime';

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[char]);
}

function byId(target, id) {
  return target.document?.getElementById(id) || null;
}

function setFieldValue(target, id, value = '') {
  const element = byId(target, id);
  if (element) element.value = value;
}

function getEngine(target) {
  return target.financeApp?.workSessionEngine || {};
}

function fmt(target, value = 0) {
  if (typeof target.fmt === 'function') return target.fmt(value);
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value) || 0);
}

function formatCompetence(target, competence = '') {
  if (typeof target.formatCompetence === 'function') return target.formatCompetence(competence);
  return competence || '-';
}

function formatHours(target, hours = 0) {
  if (typeof target.formatHoursDecimal === 'function') return target.formatHoursDecimal(hours);
  return getEngine(target).formatHoursDecimal?.(hours) || '00:00';
}

function getAuthContext(target) {
  const authUser = target.authSdk?.getCurrentUser?.() || target.currentUser || {};
  const profile = target.currentUserProfile || {};
  const uid = authUser.uid || profile.uid || '';
  return {
    actorUid: uid,
    uid,
    actorType: profile.role === 'admin' || profile.role === 'owner' ? 'admin' : 'user',
    role: profile.role || target.currentUserRole || 'user',
    accountStatus: profile.status || target.currentAccountStatus || 'active',
    ownerUid: uid,
    ownerEmail: authUser.email || profile.email || '',
    permissions: target.currentUserPermissions || { canManageRecords: true }
  };
}

function createLocalIdempotencyRepository(target) {
  let sequence = 0;
  return {
    reserve: async (input = {}) => ({
      ok: true,
      id: `hour-local-${sequence += 1}`,
      data: { ...input, reservation_status: 'reserved' }
    }),
    complete: async (id = '', result = {}) => ({ ok: true, id, data: { result_reference: result } }),
    fail: async (id = '', result = {}) => ({ ok: true, id, data: { result_reference: result } }),
    find: async () => ({ ok: false, code: 'REPOSITORY_NOT_FOUND' }),
    getById: async () => ({ ok: false, code: 'REPOSITORY_NOT_FOUND' }),
    cleanupExpired: async () => ({ ok: true, count: 0 }),
    list: async () => ({ ok: true, items: [], data: [], count: 0 })
  };
}

function isLocalMockMode(target) {
  return Array.isArray(target.__smokeRecords) || Array.isArray(target.__regressionRecords);
}

function getGateway(target) {
  if (!isLocalMockMode(target)) return target.financeApp?.applicationGateway || null;
  if (!target.financeApp?.createDefaultApplicationGateway || !target.financeApp?.applicationDependencies) {
    return target.financeApp?.applicationGateway || null;
  }
  target.financeApp.__hourControlLocalGateway ||= target.financeApp.createDefaultApplicationGateway({
    dependencies: target.financeApp.applicationDependencies,
    idempotencyRepository: createLocalIdempotencyRepository(target)
  });
  return target.financeApp.__hourControlLocalGateway;
}

function getPeople(target) {
  return (Array.isArray(target.allRecords) ? target.allRecords : [])
    .filter((record) => record?.type === 'pessoa')
    .map((record) => record.person || record.name || '')
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

function syncPersonOptions(target) {
  const select = byId(target, 'hour-person');
  if (!select) return;
  const current = select.value;
  select.innerHTML = getPeople(target)
    .map((person) => `<option value="${escapeHtml(person)}" ${person === current ? 'selected' : ''}>${escapeHtml(person)}</option>`)
    .join('');
}

function formInput(target) {
  return {
    person: byId(target, 'hour-person')?.value || '',
    competence: byId(target, 'hour-competence')?.value || '',
    occurredDate: byId(target, 'hour-date')?.value || '',
    startTime: byId(target, 'hour-start')?.value || '',
    endTime: byId(target, 'hour-end')?.value || '',
    breakStartTime: byId(target, 'hour-break-start')?.value || '',
    breakEndTime: byId(target, 'hour-break-end')?.value || '',
    hourControlType: byId(target, 'hour-type')?.value || 'Hora Extra',
    bankNature: byId(target, 'hour-bank-nature')?.value || 'Debito',
    overtimePercentage: Number(byId(target, 'hour-percentage')?.value || 0),
    observation: byId(target, 'hour-note')?.value || ''
  };
}

function resolveSalary(target, input = {}, existingRecord = null) {
  const engine = getEngine(target);
  const personRecord = (target.allRecords || []).find((record) => record?.type === 'pessoa' && record.person === input.person) || null;
  const salary = engine.ResolveEffectiveSalary?.({
    person: input.person,
    competence: input.competence || input.occurredDate,
    salaryHistory: target.allRecords || [],
    personRecord
  });
  const fallback = Number(existingRecord?.salary_base_snapshot ?? existingRecord?.salary_base_reference ?? personRecord?.salary_base ?? 0) || 0;
  return Number(salary?.salary || salary?.salario || fallback || 0) || 0;
}

function previewWorkSession(target, input = {}) {
  return getEngine(target).CalculateWorkSession?.({
    ...input,
    allowCrossMidnight: true,
    salaryBase: resolveSalary(target, input),
    monthlyHours: 220
  }) || { isValid: false, errors: [{ code: 'ENGINE_UNAVAILABLE' }] };
}

function updatePreview(target) {
  const input = formInput(target);
  const session = previewWorkSession(target, input);
  const salaryBase = resolveSalary(target, input);
  const quantity = roundCurrency((session.netMinutes || 0) / 60);
  const preview = byId(target, 'hour-calculation-preview');
  const quantityInput = byId(target, 'hour-quantity');
  const salaryInput = byId(target, 'hour-salary-base');
  const natureWrap = byId(target, 'hour-nature-wrap');
  const percentageWrap = byId(target, 'hour-percentage-wrap');

  if (natureWrap) natureWrap.classList.toggle('hidden', input.hourControlType !== 'Banco de Horas');
  if (percentageWrap) percentageWrap.classList.toggle('hidden', input.hourControlType !== 'Hora Extra');
  if (quantityInput) quantityInput.value = quantity ? quantity.toFixed(2) : '';
  if (salaryInput) salaryInput.value = salaryBase ? salaryBase.toFixed(2) : '';
  if (!preview) return;

  if (!session.isValid) {
    preview.innerHTML = '<div class="time-metric-card"><p class="text-sm text-textSecondary">Informe um intervalo valido para visualizar o calculo.</p></div>';
    return;
  }

  const gross = formatHours(target, (session.grossMinutes || 0) / 60);
  const interval = formatHours(target, (session.breakMinutes || 0) / 60);
  const net = getEngine(target).formatMinutesToClock?.(session.netMinutes || 0) || formatHours(target, quantity);
  if (input.hourControlType === 'Banco de Horas') {
    preview.innerHTML = `<div class="bank-metric-card"><p class="text-xs uppercase tracking-[0.16em] text-textSecondary">Banco de Horas</p><div class="entry-consolidated-grid mt-3"><div><p class="text-xs text-textSecondary">Horas brutas</p><p class="text-lg font-semibold text-textPrimary">${gross}</p></div><div><p class="text-xs text-textSecondary">Intervalo</p><p class="text-lg font-semibold text-warn">-${interval}</p></div><div><p class="text-xs text-textSecondary">Horas liquidas</p><p class="text-lg font-semibold text-accent">${net}</p></div></div><p class="text-xs text-textSecondary mt-3">${escapeHtml(input.bankNature)} movimenta o saldo e nao gera valor financeiro.</p></div>`;
    return;
  }

  const total = roundCurrency((session.calculatedValueCents || 0) / 100);
  const hourBase = roundCurrency((session.baseHourlyRateCents || 0) / 100);
  const hourValue = quantity > 0 ? roundCurrency(total / quantity) : 0;
  preview.innerHTML = `<div class="time-metric-card"><p class="text-xs uppercase tracking-[0.16em] text-textSecondary">Memoria de calculo da H.E.</p><div class="entry-consolidated-grid mt-3"><div><p class="text-xs text-textSecondary">Horas brutas</p><p class="text-lg font-semibold text-textPrimary">${gross}</p></div><div><p class="text-xs text-textSecondary">Intervalo</p><p class="text-lg font-semibold text-warn">-${interval}</p></div><div><p class="text-xs text-textSecondary">Horas liquidas</p><p class="text-lg font-semibold text-accent">${net}</p></div><div><p class="text-xs text-textSecondary">Valor hora normal</p><p class="text-lg font-semibold text-textPrimary">${fmt(target, hourBase)}</p></div><div><p class="text-xs text-textSecondary">Valor hora extra</p><p class="text-lg font-semibold text-success">${fmt(target, hourValue)}</p></div><div><p class="text-xs text-textSecondary">Total</p><p class="text-lg font-semibold text-success">${fmt(target, total)}</p></div></div></div>`;
}

function currentFilters(target) {
  const competence = byId(target, 'controle-horas-competencia')?.value || target.thisMonth || '';
  return {
    start: competence,
    end: competence,
    search: byId(target, 'controle-horas-search')?.value || ''
  };
}

function groupEntries(entries = []) {
  const grouped = new Map();
  entries.forEach((entry) => {
    const key = `${entry.person}|${entry.competence}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(entry);
  });
  return [...grouped.entries()].map(([key, items]) => {
    const [person, competence] = key.split('|');
    return { person, competence, items };
  });
}

function renderEntries(target, entries, model) {
  const list = byId(target, 'controle-horas-list');
  const empty = byId(target, 'controle-horas-empty');
  if (!list || !empty) return;
  const groups = groupEntries(entries);
  list.innerHTML = groups.map((group) => {
    const totalHE = roundCurrency(group.items
      .filter((item) => item.hourControlType === 'Hora Extra')
      .reduce((sum, item) => sum + item.financialTotal, 0));
    const saldo = model.summary.byPerson.find((item) => item.person === group.person)?.bankNetHours ?? 0;
    return `<div class="rounded-2xl border border-surfaceLight bg-surface p-4" data-hour-control-modern-group="${escapeHtml(group.person)}|${group.competence}"><div class="flex items-start justify-between gap-3 flex-wrap"><div><h3 class="font-semibold text-sm">${escapeHtml(group.person)} - ${formatCompetence(target, group.competence)}</h3><p class="text-xs text-textSecondary mt-1">Total H.E.: ${fmt(target, totalHE)} - Saldo banco: ${saldo >= 0 ? '+' : '-'}${formatHours(target, Math.abs(saldo))}</p></div><button type="button" data-open-hour-detail="${escapeHtml(group.person)}|${group.competence}" class="px-3 py-1.5 text-xs rounded-lg bg-surfaceLight text-textSecondary hover:text-textPrimary">Detalhar</button></div></div>`;
  }).join('');
  empty.classList.toggle('hidden', entries.length > 0);
}

function renderBank(target, bank, model) {
  const wrap = byId(target, 'controle-horas-saldos');
  if (!wrap) return;
  const people = model.summary.byPerson.length
    ? model.summary.byPerson
    : getPeople(target).map((person) => ({ person, bankNetHours: 0, openingBankHours: 0, bankDebitHours: 0, bankCreditHours: 0 }));
  wrap.innerHTML = people.map((item) => `<div class="bank-metric-card"><p class="text-xs uppercase tracking-[0.16em] text-textSecondary">${escapeHtml(item.person)}</p><p class="kpi-value text-warn mt-2">${item.bankNetHours >= 0 ? '+' : '-'}${formatHours(target, Math.abs(item.bankNetHours))}</p><div class="grid grid-cols-2 gap-2 mt-3 text-xs"><div><span class="text-textSecondary">Anterior</span><p class="font-semibold">${formatHours(target, Math.abs(item.openingBankHours || 0))}</p></div><div><span class="text-textSecondary">Debito</span><p class="font-semibold text-accent">${formatHours(target, item.bankDebitHours || 0)}</p></div><div><span class="text-textSecondary">Credito</span><p class="font-semibold text-danger">${formatHours(target, item.bankCreditHours || 0)}</p></div><div><span class="text-textSecondary">Atual</span><p class="font-semibold text-warn">${item.bankNetHours >= 0 ? '+' : '-'}${formatHours(target, Math.abs(item.bankNetHours || 0))}</p></div></div></div>`).join('');
}

function renderSummary(target, summary) {
  const meta = byId(target, 'controle-horas-meta');
  const competence = byId(target, 'controle-horas-competencia')?.value || target.thisMonth || '';
  if (meta) meta.textContent = `${summary.recordsCount} lancamento(s) - competencia ${formatCompetence(target, competence)}`;
}

function fillForm(target, record = null) {
  syncPersonOptions(target);
  const today = target.today || new Date().toISOString().slice(0, 10);
  const title = byId(target, 'hour-control-title');
  const save = byId(target, 'btn-save-hour-control');
  if (title) title.textContent = record?.id ? 'Editar Lancamento de Horas' : 'Novo Lancamento de Horas';
  if (save) save.textContent = record?.id ? 'Salvar alteracoes' : 'Salvar';
  setFieldValue(target, 'hour-person', record?.person || byId(target, 'hour-person')?.value || '');
  setFieldValue(target, 'hour-competence', record?.competence || byId(target, 'controle-horas-competencia')?.value || target.thisMonth || '');
  setFieldValue(target, 'hour-date', record?.occurred_date || today);
  setFieldValue(target, 'hour-start', record?.start_time || record?.horaInicial || '');
  setFieldValue(target, 'hour-end', record?.end_time || record?.horaFinal || '');
  setFieldValue(target, 'hour-break-start', record?.break_start || record?.break_start_time || '');
  setFieldValue(target, 'hour-break-end', record?.break_end || record?.break_end_time || '');
  setFieldValue(target, 'hour-type', record?.hour_control_type || record?.hour_entry_type || 'Hora Extra');
  setFieldValue(target, 'hour-bank-nature', record?.bank_nature || 'Debito');
  setFieldValue(target, 'hour-percentage', Number(record?.overtime_percentage ?? record?.percentualUsado ?? 110) || 0);
  setFieldValue(target, 'hour-note', record?.observation || record?.description || '');
  updatePreview(target);
}

function updateLocalRecords(target, result, input = {}, id = '') {
  if (!result?.success && !result?.isOk) return;
  const data = result.data || {};
  const record = { ...data, id: data.id || result.entityId || id };
  if (!record.id || !Array.isArray(target.allRecords)) return;
  const index = target.allRecords.findIndex((item) => item.id === record.id);
  if (index >= 0) target.allRecords[index] = { ...target.allRecords[index], ...record };
  else target.allRecords.push(record);
  if (Array.isArray(target.__smokeRecords)) {
    const smokeIndex = target.__smokeRecords.findIndex((item) => item.id === record.id);
    if (smokeIndex >= 0) target.__smokeRecords[smokeIndex] = { ...target.__smokeRecords[smokeIndex], ...record };
    else target.__smokeRecords.push(record);
  }
  if (Array.isArray(target.__regressionRecords)) {
    const regressionIndex = target.__regressionRecords.findIndex((item) => item.id === record.id);
    if (regressionIndex >= 0) target.__regressionRecords[regressionIndex] = { ...target.__regressionRecords[regressionIndex], ...record };
    else target.__regressionRecords.push(record);
  }
  target.__financeDataVersion = (target.__financeDataVersion || 0) + 1;
}

export function installHourControlActiveUi(target = globalThis) {
  if (!target?.document || target.__financeHourControlActiveUiInstalled) return null;
  target.__financeHourControlActiveUiInstalled = true;

  let editingRecordId = '';
  let editingDetailKey = '';

  const presenter = createHourControlPresenter({
    renderSummary: (summary) => renderSummary(target, summary),
    renderBank: (bank, model) => renderBank(target, bank, model),
    renderEntries: (entries, model) => renderEntries(target, entries, model),
    presentMutation: (result, options = {}) => {
      if (result?.success || result?.isOk) {
        target.showToast?.(options.successMessage || 'Lancamento de horas salvo!');
        options.refreshAfterMutation?.();
        return;
      }
      if (result?.data?.mutationOutcome === 'uncertain') {
        target.showToast?.(options.uncertainMessage || 'Nao foi possivel confirmar o lancamento de horas.', true);
        return;
      }
      target.showToast?.(options.errorMessage || result?.message || 'Erro ao salvar lancamento de horas', true);
    }
  });
  const controller = createHourControlController({
    readSource: {
      read: async () => ({ records: target.allRecords || [] })
    },
    gatewayProvider: () => getGateway(target),
    authContextProvider: () => getAuthContext(target),
    attemptStore: createMemoryMutationAttemptStore({ now: () => new Date().toISOString() }),
    presenter
  });

  function renderControleHorasModern() {
    const competence = byId(target, 'controle-horas-competencia');
    if (competence && !competence.value) competence.value = target.thisMonth || '';
    return controller.load(currentFilters(target)).finally(() => target.lucide?.createIcons?.());
  }

  function openHourControlModalModern() {
    const modal = byId(target, 'hour-control-modal');
    if (modal && target.document?.body && modal.parentElement !== target.document.body) {
      target.document.body.appendChild(modal);
    }
    if (modal) modal.style.zIndex = '340';
    editingRecordId = '';
    editingDetailKey = '';
    fillForm(target, null);
    modal?.classList.remove('hidden');
    target.lucide?.createIcons?.();
  }

  function closeHourControlModalModern() {
    editingRecordId = '';
    editingDetailKey = '';
    byId(target, 'hour-control-modal')?.classList.add('hidden');
  }

  function openEditHourControlRecordModern(recordId, groupKey = '') {
    const record = (target.allRecords || []).find((item) => item?.id === recordId && item.type === 'controle_horas');
    if (!record) {
      target.showToast?.('Lancamento nao encontrado para edicao', true);
      return;
    }
    editingRecordId = record.id;
    editingDetailKey = groupKey || `${record.person || ''}|${record.competence || ''}`;
    fillForm(target, record);
    const modal = byId(target, 'hour-control-modal');
    if (modal && target.document?.body && modal.parentElement !== target.document.body) {
      target.document.body.appendChild(modal);
    }
    if (modal) modal.style.zIndex = '340';
    modal?.classList.remove('hidden');
    target.lucide?.createIcons?.();
  }

  async function saveHourControlRecordModern() {
    const input = formInput(target);
    if (!input.person || !input.competence || !input.occurredDate) {
      target.showToast?.('Preencha pessoa, competencia e data', true);
      return { success: false, code: 'CLIENT_VALIDATION_ERROR' };
    }
    const session = previewWorkSession(target, input);
    if (!session.isValid || !session.netMinutes) {
      target.showToast?.('Informe um intervalo de horas valido', true);
      return { success: false, code: 'CLIENT_VALIDATION_ERROR', validationErrors: session.errors || [] };
    }
    if (input.hourControlType === 'Hora Extra' && resolveSalary(target, input) <= 0) {
      target.showToast?.('Cadastre um salario vigente para calcular a hora extra', true);
      return { success: false, code: 'CLIENT_VALIDATION_ERROR' };
    }

    const saveButton = byId(target, 'btn-save-hour-control');
    if (saveButton) saveButton.disabled = true;
    const payload = {
      ...input,
      salaryBase: resolveSalary(target, input),
      allowCrossMidnight: true,
      monthlyHours: 220
    };
    try {
      const result = editingRecordId
        ? await controller.updateHourEntry({ id: editingRecordId, fields: payload }, { attemptKey: `hour:${editingRecordId}` })
        : await controller.createHourEntry(payload, { attemptKey: `hour:${input.person}:${input.competence}:${input.occurredDate}:${input.startTime}:${input.endTime}` });
      updateLocalRecords(target, result, input, editingRecordId);
      if (result?.success || result?.isOk) {
        const reopenKey = editingDetailKey;
        closeHourControlModalModern();
        await renderControleHorasModern();
        target.renderEntradas?.();
        if (reopenKey) target.openHourDetailModal?.(reopenKey);
      }
      return result;
    } finally {
      if (saveButton) saveButton.disabled = false;
    }
  }

  Object.defineProperties(renderControleHorasModern, {
    __financeModernHourControl: { value: true },
    __usesHourControlController: { value: true },
    __controller: { value: controller },
    __presenter: { value: presenter }
  });
  Object.defineProperty(openHourControlModalModern, '__financeModernHourControl', { value: true });
  Object.defineProperty(openEditHourControlRecordModern, '__financeModernHourControl', { value: true });
  Object.defineProperties(saveHourControlRecordModern, {
    __financeModernHourControl: { value: true },
    __usesHourControlController: { value: true },
    __controller: { value: controller },
    __presenter: { value: presenter }
  });

  target.renderControleHoras = renderControleHorasModern;
  target.openHourControlModal = openHourControlModalModern;
  target.closeHourControlModal = closeHourControlModalModern;
  target.handleHourControlTypeChange = () => updatePreview(target);
  target.updateHourControlCalculatedFields = () => updatePreview(target);
  target.openEditHourControlRecord = openEditHourControlRecordModern;
  target.saveHourControlRecord = saveHourControlRecordModern;

  return {
    controller,
    presenter,
    renderControleHoras: renderControleHorasModern,
    saveHourControlRecord: saveHourControlRecordModern
  };
}
