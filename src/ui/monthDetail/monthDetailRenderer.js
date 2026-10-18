import { renderRecordRowsProgressively } from '../components/recordRow.js';
import { scheduleIconRender } from '../icons.js';
import { buildMonthlyDetailViewModel } from './monthDetailData.js';

let monthlyDetailRenderToken = 0;
let selectedMonthlyDetailCompetence = '';

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }[char]));
}

function formatCompetence(value, target = window) {
  return typeof target.formatCompetence === 'function' ? target.formatCompetence(value) : value;
}

function fmt(value, target = window) {
  return typeof target.fmt === 'function' ? target.fmt(value) : String(value ?? '');
}

export function scheduleMonthlyDetailWork(callback, fallbackDelay = 80, target = window) {
  if (typeof target.requestIdleCallback === 'function') {
    target.requestIdleCallback(callback, { timeout: 350 });
    return;
  }
  target.setTimeout(callback, fallbackDelay);
}

export function renderMetricBarList(items, emptyLabel, tone = 'accent', target = window) {
  if (!items.length) {
    return `<p class="text-sm text-textSecondary">${escapeHtml(emptyLabel)}</p>`;
  }

  const maxValue = Math.max(...items.map((item) => Number(item.value) || 0), 0);
  const palette = tone === 'danger'
    ? { bar: 'bg-danger/70', text: 'text-danger' }
    : { bar: 'bg-accent/70', text: 'text-accent' };

  return items.map((item) => {
    const width = maxValue > 0 ? Math.max(6, ((Number(item.value) || 0) / maxValue) * 100) : 6;
    return `
      <div class="space-y-2">
        <div class="flex items-center justify-between gap-3">
          <span class="text-sm text-textPrimary">${escapeHtml(item.label)}</span>
          <span class="text-sm font-semibold ${palette.text}">${fmt(item.value, target)}</span>
        </div>
        <div class="h-2 rounded-full bg-surfaceLight overflow-hidden">
          <div class="h-full rounded-full ${palette.bar}" style="width:${width}%"></div>
        </div>
      </div>
    `;
  }).join('');
}

export function renderPersonFinancialBreakdown(items, target = window) {
  if (!items.length) {
    return '<p class="text-sm text-textSecondary">Nenhuma pessoa vinculada neste mes.</p>';
  }

  const maxBase = Math.max(...items.map((item) => Math.max(item.receber, item.pagar, Math.abs(item.sobra))), 0);

  return items.map((item) => {
    const receiveWidth = maxBase > 0 ? Math.max(8, (item.receber / maxBase) * 100) : 8;
    const payWidth = maxBase > 0 ? Math.max(8, (item.pagar / maxBase) * 100) : 8;
    const sobraWidth = maxBase > 0 ? Math.max(8, (Math.abs(item.sobra) / maxBase) * 100) : 8;
    return `
      <div class="rounded-xl border border-surfaceLight bg-surfaceLight/20 p-4">
        <div class="flex items-center justify-between gap-3 mb-3">
          <div>
            <p class="text-base font-semibold text-textPrimary">${escapeHtml(item.label)}</p>
            <p class="text-xs text-textSecondary mt-1">Resumo individual do mes selecionado</p>
          </div>
          <span class="text-sm font-bold ${item.sobra >= 0 ? 'text-success' : 'text-danger'}">Sobra: ${fmt(item.sobra, target)}</span>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          <div class="rounded-lg border border-surfaceLight bg-surface px-3 py-2">
            <p class="text-[11px] uppercase tracking-[0.12em] text-textSecondary">Vai receber</p>
            <p class="mt-1 text-sm font-semibold text-success">${fmt(item.receber, target)}</p>
          </div>
          <div class="rounded-lg border border-surfaceLight bg-surface px-3 py-2">
            <p class="text-[11px] uppercase tracking-[0.12em] text-textSecondary">Vai pagar</p>
            <p class="mt-1 text-sm font-semibold text-danger">${fmt(item.pagar, target)}</p>
          </div>
          <div class="rounded-lg border border-surfaceLight bg-surface px-3 py-2">
            <p class="text-[11px] uppercase tracking-[0.12em] text-textSecondary">Vai sobrar</p>
            <p class="mt-1 text-sm font-semibold ${item.sobra >= 0 ? 'text-accent' : 'text-danger'}">${fmt(item.sobra, target)}</p>
          </div>
        </div>
        <div class="space-y-3">
          <div>
            <div class="flex items-center justify-between gap-3 mb-1">
              <span class="text-xs uppercase tracking-[0.12em] text-textSecondary">Receber</span>
              <span class="text-sm font-semibold text-success">${fmt(item.receber, target)}</span>
            </div>
            <div class="h-2 rounded-full bg-surfaceLight overflow-hidden">
              <div class="h-full rounded-full bg-success/70" style="width:${receiveWidth}%"></div>
            </div>
          </div>
          <div>
            <div class="flex items-center justify-between gap-3 mb-1">
              <span class="text-xs uppercase tracking-[0.12em] text-textSecondary">Pagar</span>
              <span class="text-sm font-semibold text-danger">${fmt(item.pagar, target)}</span>
            </div>
            <div class="h-2 rounded-full bg-surfaceLight overflow-hidden">
              <div class="h-full rounded-full bg-danger/70" style="width:${payWidth}%"></div>
            </div>
          </div>
          <div>
            <div class="flex items-center justify-between gap-3 mb-1">
              <span class="text-xs uppercase tracking-[0.12em] text-textSecondary">Sobra</span>
              <span class="text-sm font-semibold ${item.sobra >= 0 ? 'text-accent' : 'text-danger'}">${fmt(item.sobra, target)}</span>
            </div>
            <div class="h-2 rounded-full bg-surfaceLight overflow-hidden">
              <div class="h-full rounded-full ${item.sobra >= 0 ? 'bg-accent/70' : 'bg-danger/60'}" style="width:${sobraWidth}%"></div>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

export function renderMonthlyDetailSkeleton(competence, target = window) {
  const doc = target.document;
  const title = doc.getElementById('month-detail-title');
  const subtitle = doc.getElementById('month-detail-subtitle');
  const summary = doc.getElementById('month-detail-summary');
  const highlights = doc.getElementById('month-detail-highlights');
  const categoriesWrap = doc.getElementById('month-detail-categories');
  const peopleWrap = doc.getElementById('month-detail-people');
  const recordsWrap = doc.getElementById('month-detail-records');
  const recordsMeta = doc.getElementById('month-detail-records-meta');
  const statusBadge = doc.getElementById('month-detail-status-badge');

  if (title) title.textContent = `Visao de ${formatCompetence(competence, target)}`;
  if (subtitle) subtitle.textContent = 'Carregando resumo do mes selecionado...';
  if (statusBadge) {
    statusBadge.className = 'px-3 py-1 rounded-full text-xs font-semibold bg-surfaceLight text-textSecondary';
    statusBadge.textContent = 'Carregando';
  }
  const skeletonCards = Array.from({ length: 4 }, () => '<div class="glass rounded-xl p-3 border border-surfaceLight min-h-[76px] animate-pulse bg-surfaceLight/40"></div>').join('');
  if (summary) summary.innerHTML = skeletonCards;
  if (highlights) highlights.innerHTML = skeletonCards;
  if (categoriesWrap) categoriesWrap.innerHTML = '<p class="text-sm text-textSecondary">Preparando categorias...</p>';
  if (peopleWrap) peopleWrap.innerHTML = '<p class="text-sm text-textSecondary">Preparando pessoas...</p>';
  if (recordsMeta) recordsMeta.textContent = 'Preparando lancamentos...';
  if (recordsWrap) recordsWrap.innerHTML = '<p class="text-sm text-textSecondary text-center py-8">Carregando lancamentos do mes...</p>';
}

export function renderMonthlyDetailRecords(records, renderToken, target = window) {
  if (renderToken !== monthlyDetailRenderToken || target.currentTab !== 'mes-detalhe') return;
  const doc = target.document;
  const recordsWrap = doc.getElementById('month-detail-records');
  const recordsMeta = doc.getElementById('month-detail-records-meta');
  if (!recordsWrap) return;

  const sorted = typeof target.sortRecordsNewestFirst === 'function'
    ? target.sortRecordsNewestFirst(records)
    : [...records];

  if (recordsMeta) recordsMeta.textContent = `0 de ${records.length} lancamento(s) exibidos`;
  if (sorted.length && target.financeRecordListRenderer) {
    renderRecordRowsProgressively(recordsWrap, sorted, {
      target,
      initialCount: 20,
      chunkSize: 40,
      onProgress: ({ rendered, total }) => {
        if (renderToken !== monthlyDetailRenderToken || target.currentTab !== 'mes-detalhe') return;
        if (recordsMeta) recordsMeta.textContent = `${rendered} de ${total} lancamento(s) exibidos`;
        scheduleIconRender(recordsWrap, target.lucide);
      },
      onComplete: () => scheduleIconRender(recordsWrap, target.lucide)
    });
  } else {
    recordsWrap.innerHTML = sorted.length
      ? sorted.map((record) => target.renderRow?.(record) || '').join('')
      : '<p class="text-sm text-textSecondary text-center py-8">Sem lancamentos neste mes dentro do filtro atual.</p>';
  }
  scheduleIconRender(recordsWrap, target.lucide);
}

export function renderMonthlyDetailTab(renderToken = ++monthlyDetailRenderToken, target = window) {
  if (renderToken !== monthlyDetailRenderToken || target.currentTab !== 'mes-detalhe') return;
  const doc = target.document;
  const competence = selectedMonthlyDetailCompetence || doc.getElementById('f-comp-start')?.value || target.thisMonth || '';
  const monthlyDetail = buildMonthlyDetailViewModel(competence, target);
  const records = monthlyDetail.records;
  const title = doc.getElementById('month-detail-title');
  const subtitle = doc.getElementById('month-detail-subtitle');
  const summary = doc.getElementById('month-detail-summary');
  const highlights = doc.getElementById('month-detail-highlights');
  const categoriesWrap = doc.getElementById('month-detail-categories');
  const peopleWrap = doc.getElementById('month-detail-people');
  const recordsWrap = doc.getElementById('month-detail-records');
  const recordsMeta = doc.getElementById('month-detail-records-meta');
  const statusBadge = doc.getElementById('month-detail-status-badge');
  const {
    totals: { totalEntradas, totalSaidas, totalAberto, sobra, saldoProjetado, comprometimento },
    statusTone,
    topCategories,
    personFinancialSummary,
    topExpense,
    topEntry
  } = monthlyDetail;

  if (title) title.textContent = `Visao de ${formatCompetence(competence, target)}`;
  if (subtitle) subtitle.textContent = 'Resumo tatico do mes escolhido no grafico mensal, com foco em receita, despesa, sobra e pendencias.';
  const monthDetailView = doc.getElementById('view-mes-detalhe');
  if (monthDetailView?.scrollIntoView) monthDetailView.scrollIntoView({ block: 'start', behavior: 'auto' });
  if (statusBadge) {
    statusBadge.className = `px-3 py-1 rounded-full text-xs font-semibold border ${statusTone.badgeClass}`;
    statusBadge.textContent = statusTone.text;
  }

  if (summary) {
    summary.innerHTML = `
      <div class="glass rounded-xl p-3 border border-surfaceLight"><p class="text-xs text-textSecondary">Entradas</p><p class="text-lg font-bold text-success">${fmt(totalEntradas, target)}</p></div>
      <div class="glass rounded-xl p-3 border border-surfaceLight"><p class="text-xs text-textSecondary">Saidas pagas</p><p class="text-lg font-bold text-danger">${fmt(totalSaidas, target)}</p></div>
      <div class="glass rounded-xl p-3 border border-surfaceLight"><p class="text-xs text-textSecondary">Em aberto</p><p class="text-lg font-bold text-warn">${fmt(totalAberto, target)}</p></div>
      <div class="glass rounded-xl p-3 border border-surfaceLight"><p class="text-xs text-textSecondary">Sobra do mes</p><p class="text-lg font-bold ${sobra >= 0 ? 'text-success' : 'text-danger'}">${fmt(sobra, target)}</p></div>
    `;
  }

  if (highlights) {
    const entryValue = topEntry ? target.financeMonthlyDetailSelectors.getMonthlyDetailEntradaValue(topEntry) : 0;
    const entryLabel = topEntry ? target.financeMonthlyDetailSelectors.getMonthlyDetailEntradaLabel(topEntry) : 'Sem entradas financeiras no mes.';
    highlights.innerHTML = `
      <div class="rounded-xl border border-surfaceLight bg-surfaceLight/25 p-4">
        <p class="text-xs uppercase tracking-[0.14em] text-textSecondary">Saldo projetado</p>
        <p class="mt-2 text-lg font-bold ${saldoProjetado >= 0 ? 'text-success' : 'text-danger'}">${fmt(saldoProjetado, target)}</p>
        <p class="mt-1 text-xs text-textSecondary">Sobra apos considerar pendencias em aberto.</p>
      </div>
      <div class="rounded-xl border border-surfaceLight bg-surfaceLight/25 p-4">
        <p class="text-xs uppercase tracking-[0.14em] text-textSecondary">Comprometimento</p>
        <p class="mt-2 text-lg font-bold ${comprometimento >= 80 ? 'text-danger' : comprometimento >= 60 ? 'text-warn' : 'text-success'}">${comprometimento.toFixed(1).replace('.', ',')}%</p>
        <p class="mt-1 text-xs text-textSecondary">Percentual das entradas ja consumido por saidas pagas.</p>
      </div>
      <div class="rounded-xl border border-surfaceLight bg-surfaceLight/25 p-4">
        <p class="text-xs uppercase tracking-[0.14em] text-textSecondary">Maior saida paga</p>
        <p class="mt-2 text-base font-bold text-danger">${topExpense ? fmt(topExpense.amount, target) : 'R$ 0,00'}</p>
        <p class="mt-1 text-xs text-textSecondary">${topExpense ? escapeHtml(topExpense.description || topExpense.subcategory || topExpense.macro_category || 'Sem descricao') : 'Sem saidas pagas no mes.'}</p>
      </div>
      <div class="rounded-xl border border-surfaceLight bg-surfaceLight/25 p-4">
        <p class="text-xs uppercase tracking-[0.14em] text-textSecondary">Maior entrada</p>
        <p class="mt-2 text-base font-bold text-success">${topEntry ? fmt(entryValue, target) : 'R$ 0,00'}</p>
        <p class="mt-1 text-xs text-textSecondary">${escapeHtml(entryLabel)}</p>
      </div>
    `;
  }

  scheduleMonthlyDetailWork(() => {
    if (renderToken !== monthlyDetailRenderToken || target.currentTab !== 'mes-detalhe') return;
    if (categoriesWrap) categoriesWrap.innerHTML = renderMetricBarList(topCategories, 'Nenhuma categoria relevante neste mes.', 'danger', target);
    if (peopleWrap) peopleWrap.innerHTML = renderPersonFinancialBreakdown(personFinancialSummary, target);
  }, 24, target);

  if (recordsMeta) recordsMeta.textContent = 'Preparando lancamentos do mes...';
  if (recordsWrap) recordsWrap.innerHTML = '<p class="text-sm text-textSecondary text-center py-8">Carregando lancamentos do mes...</p>';

  scheduleMonthlyDetailWork(() => renderMonthlyDetailRecords(records, renderToken, target), 60, target);
}

export function setSelectedMonthlyDetailCompetence(competence = '') {
  selectedMonthlyDetailCompetence = competence;
}

export function nextMonthlyDetailRenderToken() {
  monthlyDetailRenderToken += 1;
  return monthlyDetailRenderToken;
}

export function installMonthDetailRenderer(target = window) {
  target.financeMonthDetailRenderer = {
    renderMonthlyDetailTab: (renderToken) => renderMonthlyDetailTab(renderToken, target),
    renderMonthlyDetailSkeleton: (competence) => renderMonthlyDetailSkeleton(competence, target),
    renderMonthlyDetailRecords: (records, renderToken) => renderMonthlyDetailRecords(records, renderToken, target),
    scheduleMonthlyDetailWork: (callback, fallbackDelay) => scheduleMonthlyDetailWork(callback, fallbackDelay, target),
    setSelectedMonthlyDetailCompetence,
    nextMonthlyDetailRenderToken
  };

  target.renderMonthlyDetailTab = target.financeMonthDetailRenderer.renderMonthlyDetailTab;
  return target.financeMonthDetailRenderer;
}
