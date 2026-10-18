import { roundCurrency } from '../../core/money.js';
import {
  getInstallmentCard,
  getInstallmentNo,
  getInstallmentParentId,
  getInstallmentPurchaseName,
  getInstallmentRecordKey,
  getTotalInstallments,
  isInstallmentRecord
} from '../../domain/installments.js';
import { appState } from '../../state/appState.js';
import { createActionButton } from '../components/actionButton.js';
import { createMetricCard } from '../components/metricCard.js';
import { ensureModalShell } from '../components/modal.js';
import { createElement } from '../dom/createElement.js';
import { renderRecordRowsProgressively } from '../components/recordRow.js';
import { scheduleIconRender } from '../icons.js';
import {
  getDashboardAggregations,
  getDashboardBaseSaidas,
  getDashboardTotals
} from './dashboardData.js';

function createDashboardSummaryCard({ key, label, value, detail, valueClassName, activeClassName }) {
  const card = createElement('div', {
    className: `dashboard-summary-card glass rounded-2xl p-4 card-hover transition-colors ${appState.focusedDashboardCard === key ? activeClassName : 'border-surfaceLight'}`,
    dataset: { dashboardCard: key }
  });
  if (!card) return null;

  card.append(
    createElement('p', { className: 'dashboard-summary-card-label text-xs text-textSecondary', text: label }),
    createElement('p', { className: `dashboard-summary-card-value text-lg font-bold ${valueClassName}`, text: value }),
    createActionButton({
      label: detail === 'entradas' || detail === 'saidas-pagas' ? 'Abrir lista' : detail === 'saidas-abertas' ? 'Ver pendencias' : 'Ver detalhes',
      className: `dashboard-summary-card-link mt-3 text-xs font-semibold hover:underline ${valueClassName}`,
      dataset: { dashboardDetail: detail }
    })
  );

  return card;
}

function renderEmptyMessage(container, message, className = 'text-xs text-textSecondary text-center py-4') {
  container.replaceChildren(createElement('p', { className, text: message }));
}

function getLocalMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function getLocalDateKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function shiftMonth(month = getLocalMonth(), offset = 0) {
  const [year, monthNumber] = String(month || '').split('-').map(Number);
  if (!year || !monthNumber) return month;
  const date = new Date(year, monthNumber - 1 + offset, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function formatDateLabel(value = '') {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return value || '-';
  return `${match[3]}/${match[2]}/${match[1]}`;
}

function formatCompetenceLabel(value = '') {
  if (typeof window.formatCompetence === 'function') return window.formatCompetence(value);
  return value || '-';
}

function formatMoney(value = 0) {
  return typeof window.fmt === 'function' ? window.fmt(value) : `R$ ${Number(value || 0).toFixed(2).replace('.', ',')}`;
}

function getInstallmentMonth(record = {}) {
  return String(record.competence || record.due_date || record.occurred_date || '').slice(0, 7);
}

function getInstallmentStatus(record = {}, today = getLocalDateKey()) {
  if (record.status === 'Pago') return 'pago';
  const dueDate = String(record.due_date || '');
  if (dueDate && dueDate < today) return 'atrasado';
  return 'em aberto';
}

function getInstallmentStatusClasses(status = '') {
  if (status === 'pago') return 'bg-success/10 text-success border-success/20';
  if (status === 'atrasado') return 'bg-danger/10 text-danger border-danger/20';
  return 'bg-warn/10 text-warn border-warn/20';
}

function sortInstallmentsForAction(records = []) {
  return [...records].sort((left, right) => {
    const leftNo = getInstallmentNo(left) || 0;
    const rightNo = getInstallmentNo(right) || 0;
    if (leftNo !== rightNo) return leftNo - rightNo;
    return String(left.due_date || left.competence || '').localeCompare(String(right.due_date || right.competence || ''));
  });
}

function getInstallmentActionRecord(records = []) {
  const sorted = sortInstallmentsForAction(records);
  return sorted.find((record) => record.status !== 'Pago') || sorted[sorted.length - 1] || null;
}

function findInstallmentRecordById(recordId = '') {
  const targetId = String(recordId || '');
  if (!targetId) return null;
  return (Array.isArray(window.allRecords) ? window.allRecords : []).find((record) => String(record?.id || '') === targetId) || null;
}

function handleInstallmentModalAction(action = '', recordId = '') {
  const record = findInstallmentRecordById(recordId);
  if (!record) return;
  if (action === 'edit') {
    closeDashboardInstallmentsModal();
    window.openEditRecord?.(record);
    return;
  }
  if (action === 'delete') {
    window.askDelete?.(record);
  }
}

export function getDashboardInstallmentRecords(records = window.allRecords || []) {
  const unique = new Map();
  (Array.isArray(records) ? records : []).forEach((record) => {
    if (!isInstallmentRecord(record)) return;
    if (record.archived === true || record.status === 'Cancelado') return;
    const key = getInstallmentRecordKey(record);
    if (!unique.has(key)) unique.set(key, record);
  });
  return [...unique.values()];
}

export function buildDashboardInstallmentSummary(records = window.allRecords || [], month = getLocalMonth()) {
  const today = getLocalDateKey();
  const installments = getDashboardInstallmentRecords(records);
  const monthRecords = installments
    .filter((record) => getInstallmentMonth(record) === month)
    .sort((a, b) => String(a.due_date || a.competence || '').localeCompare(String(b.due_date || b.competence || '')));
  const futureRecords = installments.filter((record) => record.status !== 'Pago' && getInstallmentMonth(record) >= month);
  const next3Limit = shiftMonth(month, 3);
  const next12Limit = shiftMonth(month, 12);
  const monthlyFuture = new Map();
  const groups = new Map();

  installments.forEach((record) => {
    const parentId = getInstallmentParentId(record) || getInstallmentRecordKey(record);
    const amount = Number(record.amount) || 0;
    const existing = groups.get(parentId) || {
      parentId,
      name: getInstallmentPurchaseName(record),
      person: record.person || '-',
      card: getInstallmentCard(record),
      totalAmount: 0,
      paidAmount: 0,
      remainingAmount: 0,
      paidCount: 0,
      remainingCount: 0,
      totalInstallments: getTotalInstallments(record),
      actionRecordId: '',
      installments: []
    };
    existing.installments.push(record);
    existing.totalAmount = roundCurrency(existing.totalAmount + amount);
    existing.totalInstallments = Math.max(existing.totalInstallments, getTotalInstallments(record));
    if (record.status === 'Pago') {
      existing.paidAmount = roundCurrency(existing.paidAmount + amount);
      existing.paidCount += 1;
    } else {
      existing.remainingAmount = roundCurrency(existing.remainingAmount + amount);
      existing.remainingCount += 1;
    }
    if (!existing.person || existing.person === '-') existing.person = record.person || '-';
    if (!existing.card || existing.card === '-') existing.card = getInstallmentCard(record);
    groups.set(parentId, existing);
  });

  futureRecords.forEach((record) => {
    const recordMonth = getInstallmentMonth(record);
    if (!recordMonth) return;
    const current = monthlyFuture.get(recordMonth) || { month: recordMonth, count: 0, total: 0 };
    current.count += 1;
    current.total = roundCurrency(current.total + (Number(record.amount) || 0));
    monthlyFuture.set(recordMonth, current);
  });

  const monthlySummary = [...monthlyFuture.values()].sort((a, b) => a.month.localeCompare(b.month));
  const totalFutureCommitted = roundCurrency(futureRecords.reduce((sum, record) => sum + (Number(record.amount) || 0), 0));
  const next3Total = roundCurrency(futureRecords
    .filter((record) => {
      const recordMonth = getInstallmentMonth(record);
      return recordMonth >= month && recordMonth < next3Limit;
    })
    .reduce((sum, record) => sum + (Number(record.amount) || 0), 0));
  const next12Total = roundCurrency(futureRecords
    .filter((record) => {
      const recordMonth = getInstallmentMonth(record);
      return recordMonth >= month && recordMonth < next12Limit;
    })
    .reduce((sum, record) => sum + (Number(record.amount) || 0), 0));
  const biggestMonth = monthlySummary.reduce((best, item) => item.total > best.total ? item : best, { month: '', total: 0, count: 0 });

  const groupList = [...groups.values()]
    .map((group) => {
      const totalInstallments = group.totalInstallments || group.installments.length;
      const progress = totalInstallments > 0 ? Math.min(100, Math.round((group.paidCount / totalInstallments) * 100)) : 0;
      return {
        ...group,
        totalInstallments,
        progress,
        actionRecordId: getInstallmentActionRecord(group.installments)?.id || '',
        status: group.remainingCount > 0 ? 'ativo' : 'quitado'
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    month,
    today,
    installments,
    monthRecords,
    monthTotal: roundCurrency(monthRecords.reduce((sum, record) => sum + (Number(record.amount) || 0), 0)),
    monthPaidTotal: roundCurrency(monthRecords
      .filter((record) => record.status === 'Pago')
      .reduce((sum, record) => sum + (Number(record.amount) || 0), 0)),
    monthOpenTotal: roundCurrency(monthRecords
      .filter((record) => record.status !== 'Pago')
      .reduce((sum, record) => sum + (Number(record.amount) || 0), 0)),
    monthPaidCount: monthRecords.filter((record) => record.status === 'Pago').length,
    monthOpenCount: monthRecords.filter((record) => record.status !== 'Pago').length,
    futureRecords,
    totalFutureCommitted,
    next3Total,
    next12Total,
    activePurchaseCount: groupList.filter((group) => group.status === 'ativo').length,
    biggestMonth,
    monthlySummary,
    groupList
  };
}

function createInstallmentStatusBadge(status) {
  const label = status === 'pago' ? 'Pago' : status === 'atrasado' ? 'Atrasado' : 'Em aberto';
  return createElement('span', {
    className: `inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${getInstallmentStatusClasses(status)}`,
    text: label
  });
}

export function renderDashboardSummaryFromBase(aggregations = getDashboardAggregations()) {
  const {
    totalEntradas,
    totalSaidasPagas,
    totalAberto,
    saldoProjetado
  } = getDashboardTotals();
  const summary = document.getElementById('summary-cards');
  if (!summary) return;
  summary.replaceChildren(
    createDashboardSummaryCard({
      key: 'entradas',
      label: 'Entradas',
      value: window.fmt(totalEntradas),
      detail: 'entradas',
      valueClassName: 'text-success',
      activeClassName: 'border-success shadow-[0_0_15px_rgba(52,211,153,0.3)]'
    }),
    createDashboardSummaryCard({
      key: 'saidas',
      label: 'Saidas pagas',
      value: window.fmt(totalSaidasPagas),
      detail: 'saidas-pagas',
      valueClassName: 'text-danger',
      activeClassName: 'border-danger shadow-[0_0_15px_rgba(244,63,94,0.3)]'
    }),
    createDashboardSummaryCard({
      key: 'aberto',
      label: 'Em aberto',
      value: window.fmt(totalAberto),
      detail: 'saidas-abertas',
      valueClassName: 'text-warn',
      activeClassName: 'border-warn shadow-[0_0_15px_rgba(251,191,36,0.3)]'
    }),
    createDashboardSummaryCard({
      key: 'saldo',
      label: 'Saldo',
      value: window.fmt(saldoProjetado),
      detail: 'saidas-filtro',
      valueClassName: saldoProjetado >= 0 ? 'text-success' : 'text-danger',
      activeClassName: 'border-accent shadow-[0_0_15px_rgba(56,189,248,0.3)]'
    })
  );
}

export function renderDashboardPersonBalanceCards() {
  if (typeof window.__legacyRenderDashboardPersonBalanceCards === 'function') {
    window.__legacyRenderDashboardPersonBalanceCards();
  } else if (typeof window.renderDashboardPersonBalanceCards === 'function' && window.renderDashboardPersonBalanceCards !== renderDashboardPersonBalanceCards) {
    window.renderDashboardPersonBalanceCards();
  }
}

export function renderDashboardRecentListFromBase(aggregations = getDashboardAggregations()) {
  const title = document.getElementById('recent-title');
  const list = document.getElementById('recent-list');
  if (!title || !list) return;
  let records = aggregations.base;
  let label = 'Saidas no filtro atual';
  if (appState.focusedDashboardCard === 'aberto') {
    records = records.filter((record) => record.status === 'Em aberto');
    label = 'Saidas em aberto no filtro atual';
  } else if (appState.focusedDashboardCard === 'saidas') {
    records = records.filter((record) => record.status === 'Pago');
    label = 'Saidas pagas no filtro atual';
  }
  title.textContent = label;
  const sorted = window.sortRecordsNewestFirst(records).slice(0, appState.focusedDashboardCard ? 50 : 10);
  if (sorted.length) {
    renderRecordRowsProgressively(list, sorted, {
      fmt: window.fmt,
      formatCompetence: window.formatCompetence,
      isArchivedRecord: window.isArchivedRecord,
      isReferenceSalaryRecord: window.isReferenceSalaryRecord,
      initialCount: 12,
      chunkSize: 24,
      onProgress: () => scheduleIconRender(list, window.lucide),
      onComplete: () => scheduleIconRender(list, window.lucide)
    });
  } else {
    renderEmptyMessage(list, 'Sem saidas correspondentes');
  }
  const clear = document.getElementById('btn-clear-card');
  if (clear) clear.classList.toggle('hidden', !appState.focusedDashboardCard);
}

export function ensureDashboardExpenseCategoryModal() {
  const modal = ensureModalShell({
    id: 'dashboard-expense-category-modal',
    titleId: 'dashboard-expense-category-title',
    subtitleId: 'dashboard-expense-category-subtitle',
    rootClassName: 'hidden fixed inset-0 bg-black/60 z-[300] p-3 sm:p-4 overflow-y-auto flex items-start sm:items-center justify-center dashboard-detail-modal',
    panelClassName: 'dashboard-detail-modal-panel bg-surface rounded-xl p-5 border border-surfaceLight max-w-4xl mx-auto w-full my-auto max-h-[calc(100dvh-1.5rem)] sm:max-h-[90vh] overflow-y-auto overscroll-contain',
    title: 'Despesas',
    closeButtonId: 'btn-close-expense-modal',
    summaryId: 'dashboard-expense-category-summary',
    listId: 'dashboard-expense-category-list'
  });
  if (!modal) return;

  document.getElementById('dashboard-expense-category-list')?.classList.add(
    'max-h-[56dvh]',
    'sm:max-h-[60vh]',
    'overflow-y-auto',
    'overscroll-contain',
    'pr-1'
  );

  document.getElementById('btn-close-expense-modal')?.addEventListener('click', () => {
    window.closeDashboardExpenseCategoryModal?.();
  });
}

export function closeDashboardExpenseCategoryModal() {
  document.getElementById('dashboard-expense-category-modal')?.classList.add('hidden');
}

export function openDashboardSaidasDetail(title, records = []) {
  ensureDashboardExpenseCategoryModal();
  const modal = document.getElementById('dashboard-expense-category-modal');
  const titleEl = document.getElementById('dashboard-expense-category-title');
  const subtitleEl = document.getElementById('dashboard-expense-category-subtitle');
  const summaryEl = document.getElementById('dashboard-expense-category-summary');
  const listEl = document.getElementById('dashboard-expense-category-list');
  if (!modal || !titleEl || !subtitleEl || !summaryEl || !listEl) return;
  window.setDashboardDetailContext?.(title, records);

  const sorted = window.sortRecordsNewestFirst(records);
  const total = roundCurrency(sorted.reduce((sum, record) => sum + (Number(record.amount) || 0), 0));
  const paidCount = sorted.filter((record) => record.status === 'Pago').length;
  const openCount = sorted.filter((record) => record.status === 'Em aberto').length;

  titleEl.textContent = title;
  subtitleEl.textContent = `${sorted.length} saida(s) no filtro atual`;
  summaryEl.replaceChildren(
    createMetricCard({ label: 'Total', value: window.fmt(total), valueClassName: 'text-lg font-semibold text-danger mt-1' }),
    createMetricCard({ label: 'Pagas', value: String(paidCount), valueClassName: 'text-lg font-semibold text-success mt-1' }),
    createMetricCard({ label: 'Em aberto', value: String(openCount), valueClassName: 'text-lg font-semibold text-warn mt-1' })
  );
  if (sorted.length) {
    renderRecordRowsProgressively(listEl, sorted, {
      fmt: window.fmt,
      formatCompetence: window.formatCompetence,
      isArchivedRecord: window.isArchivedRecord,
      isReferenceSalaryRecord: window.isReferenceSalaryRecord,
      initialCount: 20,
      chunkSize: 40,
      onProgress: () => scheduleIconRender(listEl, window.lucide),
      onComplete: () => scheduleIconRender(listEl, window.lucide)
    });
  } else {
    renderEmptyMessage(listEl, 'Nenhuma saida encontrada para esse filtro.', 'text-sm text-textSecondary text-center py-6');
  }
  modal.querySelector('.dashboard-detail-modal-panel')?.scrollTo({ top: 0, behavior: 'auto' });
  listEl.scrollTo({ top: 0, behavior: 'auto' });
  modal.classList.remove('hidden');
  scheduleIconRender(modal, window.lucide);
}

export function openDashboardExpenseRecordsModal(title = 'Detalhes', subtitle = '', records = []) {
  openDashboardSaidasDetail(title, records);
  const subtitleEl = document.getElementById('dashboard-expense-category-subtitle');
  if (subtitleEl && subtitle) subtitleEl.textContent = subtitle;
}

export function openDashboardExpenseCategoryModal(mode = 'subcategory', label = '') {
  const aggregations = getDashboardAggregations();
  const map = mode === 'person'
    ? aggregations.registrosPorPessoa
    : mode === 'macro'
      ? aggregations.registrosPorCategoria
      : aggregations.registrosPorSubcategoria;
  const title = mode === 'person'
    ? `Pessoa: ${label}`
    : mode === 'macro'
      ? `Categoria: ${label}`
      : `Subcategoria: ${label}`;
  openDashboardSaidasDetail(title, map[String(label || '').trim()] || []);
}

export function openDashboardSummaryDetail(kind) {
  if (kind === 'parcelas-mes' || kind === 'parcelas-futuro') {
    openDashboardParcelamentosDetail(kind);
    return;
  }
  if (kind === 'entradas') {
    window.openDashboardDetail?.('entradas');
    return;
  }
  if (kind === 'saidas-pagas') {
    openDashboardSaidasDetail('Saidas pagas', getDashboardBaseSaidas().filter((record) => record.status === 'Pago'));
    return;
  }
  if (kind === 'saidas-abertas') {
    openDashboardSaidasDetail('Saidas em aberto', getDashboardBaseSaidas().filter((record) => record.status === 'Em aberto'));
    return;
  }
  openDashboardSaidasDetail('Saidas do filtro', getDashboardBaseSaidas());
}

function ensureDashboardInstallmentsModal() {
  const modal = ensureModalShell({
    id: 'dashboard-installments-modal',
    titleId: 'dashboard-installments-title',
    subtitleId: 'dashboard-installments-subtitle',
    rootClassName: 'hidden fixed inset-0 bg-black/60 z-[300] p-3 sm:p-4 overflow-y-auto flex items-start sm:items-center justify-center dashboard-detail-modal',
    panelClassName: 'dashboard-detail-modal-panel bg-surface rounded-xl p-5 border border-surfaceLight max-w-5xl mx-auto w-full my-auto max-h-[calc(100dvh-1.5rem)] sm:max-h-[90vh] overflow-y-auto overscroll-contain',
    title: 'Parcelamentos',
    closeButtonId: 'btn-close-installments-modal',
    summaryId: 'dashboard-installments-summary',
    listId: 'dashboard-installments-list'
  });
  if (!modal) return null;

  document.getElementById('dashboard-installments-summary')?.classList.add('md:grid-cols-4');
  document.getElementById('dashboard-installments-list')?.classList.add(
    'max-h-[56dvh]',
    'sm:max-h-[60vh]',
    'overflow-y-auto',
    'overscroll-contain',
    'pr-1'
  );
  const closeButton = document.getElementById('btn-close-installments-modal');
  if (closeButton && closeButton.dataset.installmentsCloseBound !== 'true') {
    closeButton.dataset.installmentsCloseBound = 'true';
    closeButton.addEventListener('click', () => closeDashboardInstallmentsModal());
  }
  if (modal.dataset.installmentsBackdropBound !== 'true') {
    modal.dataset.installmentsBackdropBound = 'true';
    modal.addEventListener('click', (event) => {
      if (event.target === modal) closeDashboardInstallmentsModal();
    });
  }
  if (modal.dataset.installmentsActionsBound !== 'true') {
    modal.dataset.installmentsActionsBound = 'true';
    modal.addEventListener('click', (event) => {
      const button = event.target.closest('[data-installment-action]');
      if (!button) return;
      event.preventDefault();
      event.stopPropagation();
      handleInstallmentModalAction(button.dataset.installmentAction, button.dataset.installmentRecordId);
    });
  }
  return modal;
}

export function closeDashboardInstallmentsModal() {
  document.getElementById('dashboard-installments-modal')?.classList.add('hidden');
}

function createMonthInstallmentRow(record, today) {
  const status = getInstallmentStatus(record, today);
  const installmentText = `${getInstallmentNo(record) || 0}/${getTotalInstallments(record) || 0}`;
  return createElement('div', {
    className: 'rounded-xl border border-surfaceLight bg-surfaceLight/30 p-3',
    children: [
      createElement('div', {
        className: 'flex items-start justify-between gap-3 flex-wrap',
        children: [
          createElement('div', {
            className: 'min-w-0',
            children: [
              createElement('p', {
                className: 'text-sm font-semibold text-textPrimary truncate',
                text: getInstallmentPurchaseName(record)
              }),
              createElement('p', {
                className: 'text-xs text-textSecondary mt-1',
                text: `${record.person || '-'} | ${getInstallmentCard(record)} | parcela ${installmentText} | venc. ${formatDateLabel(record.due_date || '')}`
              })
            ]
          }),
          createElement('div', {
            className: 'text-right flex flex-col items-end gap-2',
            children: [
              createElement('p', { className: 'text-sm font-semibold text-textPrimary', text: formatMoney(record.amount || 0) }),
              createInstallmentStatusBadge(status),
              createElement('div', {
                className: 'flex items-center gap-1',
                children: [
                  createActionButton({
                    icon: 'pencil',
                    title: 'Editar lancamento',
                    className: 'p-1 rounded-lg text-textSecondary hover:text-accent hover:bg-surfaceLight',
                    dataset: { installmentAction: 'edit', installmentRecordId: record.id || '' }
                  }),
                  createActionButton({
                    icon: 'trash-2',
                    title: 'Excluir lancamento',
                    className: 'p-1 rounded-lg text-textSecondary hover:text-danger hover:bg-surfaceLight',
                    dataset: { installmentAction: 'delete', installmentRecordId: record.id || '' }
                  })
                ]
              })
            ]
          })
        ]
      })
    ]
  });
}

function createInstallmentGroupRow(group) {
  const isPaid = group.status === 'quitado';
  const actionRecordId = group.actionRecordId || getInstallmentActionRecord(group.installments)?.id || '';
  return createElement('div', {
    className: 'rounded-xl border border-surfaceLight bg-surfaceLight/30 p-3',
    children: [
      createElement('div', {
        className: 'flex items-start justify-between gap-3 flex-wrap',
        children: [
          createElement('div', {
            className: 'min-w-0 flex-1',
            children: [
              createElement('div', {
                className: 'flex items-center gap-2 flex-wrap',
                children: [
                  createElement('p', { className: 'text-sm font-semibold text-textPrimary truncate', text: group.name }),
                  createElement('span', {
                    className: `inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${isPaid ? 'bg-success/10 text-success border-success/20' : 'bg-accent/10 text-accent border-accent/20'}`,
                    text: isPaid ? 'Quitado' : 'Ativo'
                  }),
                  createActionButton({
                    icon: 'pencil',
                    label: 'Editar',
                    title: 'Editar lancamento',
                    className: 'inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-textSecondary hover:text-accent hover:bg-surfaceLight',
                    dataset: { installmentAction: 'edit', installmentRecordId: actionRecordId }
                  }),
                  createActionButton({
                    icon: 'trash-2',
                    label: 'Excluir',
                    title: 'Excluir lancamento',
                    className: 'inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-textSecondary hover:text-danger hover:bg-surfaceLight',
                    dataset: { installmentAction: 'delete', installmentRecordId: actionRecordId }
                  })
                ]
              }),
              createElement('p', {
                className: 'text-xs text-textSecondary mt-1',
                text: `${group.person || '-'} | ${group.card || '-'} | ${group.paidCount}/${group.totalInstallments} pagas`
              })
            ]
          }),
          createElement('div', {
            className: 'grid grid-cols-2 sm:grid-cols-3 gap-2 text-right text-xs min-w-[260px]',
            children: [
              createElement('div', { html: `<span class="text-textSecondary">Total</span><p class="font-semibold text-textPrimary">${formatMoney(group.totalAmount)}</p>` }),
              createElement('div', { html: `<span class="text-textSecondary">Pago</span><p class="font-semibold text-success">${formatMoney(group.paidAmount)}</p>` }),
              createElement('div', { html: `<span class="text-textSecondary">Restante</span><p class="font-semibold text-warn">${formatMoney(group.remainingAmount)}</p>` })
            ]
          })
        ]
      }),
      createElement('div', {
        className: 'mt-3',
        children: [
          createElement('div', {
            className: 'flex justify-between text-[11px] text-textSecondary mb-1',
            children: [
              createElement('span', { text: `${group.remainingCount} parcela(s) restante(s)` }),
              createElement('span', { text: `${group.progress}%` })
            ]
          }),
          createElement('div', {
            className: 'h-2 rounded-full bg-surfaceLight overflow-hidden',
            children: [
              createElement('div', {
                className: `h-full ${isPaid ? 'bg-success' : 'bg-accent'}`,
                style: { width: `${group.progress}%` }
              })
            ]
          })
        ]
      })
    ]
  });
}

function createMonthlySummaryRow(item) {
  return createElement('div', {
    className: 'flex items-center justify-between gap-3 rounded-lg border border-surfaceLight bg-surfaceLight/20 px-3 py-2 text-sm',
    children: [
      createElement('div', {
        children: [
          createElement('p', { className: 'font-semibold text-textPrimary', text: formatCompetenceLabel(item.month) }),
          createElement('p', { className: 'text-xs text-textSecondary', text: `${item.count} parcela(s)` })
        ]
      }),
      createElement('p', { className: 'font-semibold text-warn', text: formatMoney(item.total) })
    ]
  });
}

function openMonthInstallmentsModal(summary) {
  const modal = ensureDashboardInstallmentsModal();
  const titleEl = document.getElementById('dashboard-installments-title');
  const subtitleEl = document.getElementById('dashboard-installments-subtitle');
  const summaryEl = document.getElementById('dashboard-installments-summary');
  const listEl = document.getElementById('dashboard-installments-list');
  if (!modal || !titleEl || !subtitleEl || !summaryEl || !listEl) return;

  titleEl.textContent = 'Parcelas do Mes';
  subtitleEl.textContent = formatCompetenceLabel(summary.month);
  summaryEl.replaceChildren(
    createMetricCard({ label: 'Parcelas no mes', value: String(summary.monthRecords.length), valueClassName: 'text-lg font-semibold text-textPrimary mt-1' }),
    createMetricCard({ label: 'Valor do mes', value: formatMoney(summary.monthTotal), valueClassName: 'text-lg font-semibold text-warn mt-1' }),
    createMetricCard({ label: 'Pagas', value: String(summary.monthPaidCount), valueClassName: 'text-lg font-semibold text-success mt-1' }),
    createMetricCard({ label: 'Em aberto', value: String(summary.monthOpenCount), valueClassName: 'text-lg font-semibold text-danger mt-1' })
  );
  if (summary.monthRecords.length) {
    listEl.replaceChildren(...summary.monthRecords.map((record) => createMonthInstallmentRow(record, summary.today)));
  } else {
    renderEmptyMessage(listEl, 'Nenhuma parcela encontrada para este mes.', 'text-sm text-textSecondary text-center py-6');
  }
  modal.querySelector('.dashboard-detail-modal-panel')?.scrollTo({ top: 0, behavior: 'auto' });
  listEl.scrollTo({ top: 0, behavior: 'auto' });
  modal.classList.remove('hidden');
  scheduleIconRender(modal, window.lucide);
}

function openFutureInstallmentsModal(summary) {
  const modal = ensureDashboardInstallmentsModal();
  const titleEl = document.getElementById('dashboard-installments-title');
  const subtitleEl = document.getElementById('dashboard-installments-subtitle');
  const summaryEl = document.getElementById('dashboard-installments-summary');
  const listEl = document.getElementById('dashboard-installments-list');
  if (!modal || !titleEl || !subtitleEl || !summaryEl || !listEl) return;

  const biggestMonthLabel = summary.biggestMonth.month
    ? `${formatCompetenceLabel(summary.biggestMonth.month)} | ${formatMoney(summary.biggestMonth.total)}`
    : '-';
  titleEl.textContent = 'Comprometimento Futuro';
  subtitleEl.textContent = `A partir de ${formatCompetenceLabel(summary.month)}`;
  summaryEl.replaceChildren(
    createMetricCard({ label: 'Total futuro', value: formatMoney(summary.totalFutureCommitted), valueClassName: 'text-lg font-semibold text-warn mt-1' }),
    createMetricCard({ label: 'Proximos 3 meses', value: formatMoney(summary.next3Total), valueClassName: 'text-lg font-semibold text-textPrimary mt-1' }),
    createMetricCard({ label: 'Proximos 12 meses', value: formatMoney(summary.next12Total), valueClassName: 'text-lg font-semibold text-textPrimary mt-1' }),
    createMetricCard({ label: 'Compras ativas', value: String(summary.activePurchaseCount), caption: `Maior mes: ${biggestMonthLabel}`, valueClassName: 'text-lg font-semibold text-accent mt-1' })
  );

  const monthlySummary = createElement('div', {
    className: 'rounded-xl border border-surfaceLight bg-surface/40 p-3',
    children: [
      createElement('p', { className: 'text-xs font-semibold text-textSecondary mb-2', text: 'Resumo por mes' }),
      createElement('div', {
        className: 'grid grid-cols-1 md:grid-cols-2 gap-2',
        children: summary.monthlySummary.length
          ? summary.monthlySummary.slice(0, 12).map(createMonthlySummaryRow)
          : [createElement('p', { className: 'text-sm text-textSecondary py-3', text: 'Sem parcelas futuras em aberto.' })]
      })
    ]
  });
  const groups = createElement('div', {
    className: 'space-y-2',
    children: summary.groupList.length
      ? summary.groupList.map(createInstallmentGroupRow)
      : [createElement('p', { className: 'text-sm text-textSecondary text-center py-6', text: 'Nenhum parcelamento encontrado.' })]
  });
  listEl.replaceChildren(monthlySummary, groups);
  modal.querySelector('.dashboard-detail-modal-panel')?.scrollTo({ top: 0, behavior: 'auto' });
  listEl.scrollTo({ top: 0, behavior: 'auto' });
  modal.classList.remove('hidden');
  scheduleIconRender(modal, window.lucide);
}

export function openDashboardParcelamentosDetail(kind) {
  const summary = buildDashboardInstallmentSummary();
  if (kind === 'parcelas-futuro') {
    openFutureInstallmentsModal(summary);
    return;
  }
  openMonthInstallmentsModal(summary);
}

export function renderDashboardParcelamentosCards() {
  const summaryContainer = document.getElementById('dashboard-parcelamentos-cards');
  if (!summaryContainer) return;

  const installmentSummary = buildDashboardInstallmentSummary();
  const showAlert = installmentSummary.totalFutureCommitted > 0 && installmentSummary.totalFutureCommitted > 5000;
  const alertEl = document.getElementById('dashboard-parcelamentos-alert');
  const alertTextEl = document.getElementById('dashboard-parcelamentos-alert-text');
  
  if (alertEl && alertTextEl) {
      if (showAlert) {
          alertEl.classList.remove('hidden');
          alertTextEl.textContent = `Atencao: voce tem ${formatMoney(installmentSummary.totalFutureCommitted)} em parcelamentos futuros.`;
      } else {
          alertEl.classList.add('hidden');
      }
  }

  summaryContainer.replaceChildren(
    createDashboardSummaryCard({
      key: 'parcelas-mes-aberto',
      label: 'Valor em aberto',
      value: formatMoney(installmentSummary.monthOpenTotal),
      detail: 'parcelas-mes',
      valueClassName: 'text-danger',
      activeClassName: 'border-surfaceLight'
    }),
    createDashboardSummaryCard({
      key: 'parcelas-mes-pago',
      label: 'Valor pago',
      value: formatMoney(installmentSummary.monthPaidTotal),
      detail: 'parcelas-mes',
      valueClassName: 'text-success',
      activeClassName: 'border-surfaceLight'
    }),
    createDashboardSummaryCard({
      key: 'parcelas-futuro',
      label: 'Comprometido Futuro',
      value: formatMoney(installmentSummary.totalFutureCommitted),
      detail: 'parcelas-futuro',
      valueClassName: 'text-warn',
      activeClassName: 'border-surfaceLight'
    })
  );
}

export function installDashboardCardGlobals(target = window) {
  Object.assign(target, {
    renderDashboardSummaryFromBase,
    renderDashboardPersonBalanceCards,
    renderDashboardRecentListFromBase,
    renderDashboardParcelamentosCards,
    openDashboardParcelamentosDetail,
    openDashboardSaidasDetail,
    openDashboardExpenseRecordsModal,
    openDashboardExpenseCategoryModal,
    ensureDashboardExpenseCategoryModal,
    closeDashboardExpenseCategoryModal,
    closeDashboardInstallmentsModal
  });
}

