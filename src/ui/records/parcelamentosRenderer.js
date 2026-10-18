import {
    getInstallmentCard,
    getInstallmentNo,
    getInstallmentParentId,
    getInstallmentPurchaseName,
    getInstallmentRecordKey,
    getTotalInstallments,
    isInstallmentRecord
} from '../../domain/installments.js';

function roundMoney(value = 0) {
    return Math.round((Number(value) || 0) * 100) / 100;
}

function escapeHtml(value = '') {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function monthKey(record = {}) {
    return String(record.competence || record.due_date || record.occurred_date || '').slice(0, 7);
}

function localMonth() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function localDateKey() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function formatDate(value = '') {
    const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) return value || '-';
    return `${match[3]}/${match[2]}/${match[1]}`;
}

function getStatus(record = {}, today = localDateKey()) {
    if (record.status === 'Pago') return 'pago';
    const due = String(record.due_date || '');
    return due && due < today ? 'atrasado' : 'em aberto';
}

function statusBadge(status = '') {
    if (status === 'pago') return '<span class="px-2 py-0.5 rounded-full border border-success/20 bg-success/10 text-success text-[11px] font-semibold">Pago</span>';
    if (status === 'atrasado') return '<span class="px-2 py-0.5 rounded-full border border-danger/20 bg-danger/10 text-danger text-[11px] font-semibold">Atrasado</span>';
    return '<span class="px-2 py-0.5 rounded-full border border-warn/20 bg-warn/10 text-warn text-[11px] font-semibold">Em aberto</span>';
}

function recordActions(record = {}) {
    const recordId = escapeHtml(record.id || '');
    if (!recordId) return '';
    const isPaid = record.status === 'Pago';
    return `
        <div class="flex items-center justify-end gap-1">
            <button type="button" data-finance-record-action="edit" data-finance-record-id="${recordId}" title="Editar parcela" class="text-textSecondary hover:text-accent p-1 rounded-md hover:bg-surfaceLight">
                <i data-lucide="pencil" class="w-4 h-4"></i>
            </button>
            <button type="button" data-finance-record-action="toggle-paid" data-finance-record-id="${recordId}" title="${isPaid ? 'Reabrir parcela' : 'Marcar como pago'}" class="text-textSecondary hover:text-success p-1 rounded-md hover:bg-surfaceLight">
                <i data-lucide="${isPaid ? 'check-circle' : 'circle'}" class="w-4 h-4"></i>
            </button>
            <button type="button" data-delete-action="true" data-finance-record-action="delete" data-finance-record-id="${recordId}" title="Excluir parcela" class="text-textSecondary hover:text-danger p-1 rounded-md hover:bg-surfaceLight">
                <i data-lucide="trash-2" class="w-4 h-4"></i>
            </button>
        </div>
    `;
}

function getInstallments(records = []) {
    const unique = new Map();
    (Array.isArray(records) ? records : []).forEach((record) => {
        if (!isInstallmentRecord(record)) return;
        if (record.archived === true || record.status === 'Cancelado') return;
        const key = getInstallmentRecordKey(record);
        if (!unique.has(key)) unique.set(key, record);
    });
    return [...unique.values()];
}

function buildSummary(records = [], month = localMonth()) {
    const today = localDateKey();
    const installments = getInstallments(records);
    const groups = new Map();
    const months = new Map();

    installments.forEach((record) => {
        const parentId = getInstallmentParentId(record) || getInstallmentRecordKey(record);
        const amount = Number(record.amount) || 0;
        const group = groups.get(parentId) || {
            parentId,
            purchaseName: getInstallmentPurchaseName(record),
            person: record.person || '-',
            card: getInstallmentCard(record),
            totalInstallments: getTotalInstallments(record),
            totalAmount: 0,
            paidAmount: 0,
            remainingAmount: 0,
            paidCount: 0,
            remainingCount: 0,
            installments: []
        };
        group.installments.push(record);
        group.totalInstallments = Math.max(group.totalInstallments, getTotalInstallments(record));
        group.totalAmount = roundMoney(group.totalAmount + amount);
        if (record.status === 'Pago') {
            group.paidAmount = roundMoney(group.paidAmount + amount);
            group.paidCount += 1;
        } else {
            group.remainingAmount = roundMoney(group.remainingAmount + amount);
            group.remainingCount += 1;
        }
        groups.set(parentId, group);

        const key = monthKey(record);
        if (key) {
            const monthItem = months.get(key) || { month: key, total: 0, count: 0, paid: 0, open: 0, late: 0 };
            monthItem.total = roundMoney(monthItem.total + amount);
            monthItem.count += 1;
            const status = getStatus(record, today);
            if (status === 'pago') monthItem.paid += 1;
            else if (status === 'atrasado') monthItem.late += 1;
            else monthItem.open += 1;
            months.set(key, monthItem);
        }
    });

    const groupList = [...groups.values()]
        .map((group) => {
            const totalInstallments = group.totalInstallments || group.installments.length;
            const progress = totalInstallments ? Math.min(100, Math.round((group.paidCount / totalInstallments) * 100)) : 0;
            return { ...group, totalInstallments, progress, status: group.remainingCount > 0 ? 'Ativo' : 'Quitado' };
        })
        .sort((a, b) => b.remainingAmount - a.remainingAmount);
    const monthRecords = installments
        .filter((record) => monthKey(record) === month)
        .sort((a, b) => String(a.due_date || '').localeCompare(String(b.due_date || '')));
    const paidRecords = installments
        .filter((record) => record.status === 'Pago')
        .sort((a, b) => String(b.paid_at || b.due_date || '').localeCompare(String(a.paid_at || a.due_date || '')));
    const monthList = [...months.values()].sort((a, b) => a.month.localeCompare(b.month));
    const committedGroups = groupList.filter((group) => group.remainingAmount > 0);
    const totalRemaining = roundMoney(groupList.reduce((sum, group) => sum + group.remainingAmount, 0));
    const totalPaid = roundMoney(paidRecords.reduce((sum, record) => sum + (Number(record.amount) || 0), 0));
    const monthTotal = roundMoney(monthRecords.reduce((sum, record) => sum + (Number(record.amount) || 0), 0));
    const biggestPurchase = groupList.reduce((best, group) => group.totalAmount > best.totalAmount ? group : best, { purchaseName: '-', totalAmount: 0 });
    const biggestMonth = monthList.reduce((best, item) => item.total > best.total ? item : best, { month: '-', total: 0, count: 0 });
    const averageMonthly = monthList.length ? roundMoney(monthList.reduce((sum, item) => sum + item.total, 0) / monthList.length) : 0;

    return {
        today,
        month,
        installments,
        groupList,
        committedGroups,
        monthRecords,
        paidRecords,
        monthList,
        totalRemaining,
        totalPaid,
        monthTotal,
        monthPaidCount: monthRecords.filter((record) => record.status === 'Pago').length,
        monthOpenCount: monthRecords.filter((record) => record.status !== 'Pago').length,
        paidPurchaseCount: new Set(paidRecords.map((record) => getInstallmentParentId(record) || record.id)).size,
        activePurchaseCount: committedGroups.length,
        biggestPurchase,
        biggestMonth,
        averageMonthly
    };
}

function formatMonth(value = '', target = globalThis) {
    return typeof target.formatCompetence === 'function' ? target.formatCompetence(value) : value || '-';
}

function money(value, target = globalThis) {
    return typeof target.fmt === 'function' ? target.fmt(value) : `R$ ${Number(value || 0).toFixed(2).replace('.', ',')}`;
}

function metric(label, value, className = 'text-textPrimary', caption = '') {
    return `
        <div class="rounded-xl border border-surfaceLight bg-surfaceLight/30 px-4 py-3">
            <p class="text-xs text-textSecondary">${escapeHtml(label)}</p>
            <p class="text-lg font-semibold mt-1 ${className}">${escapeHtml(value)}</p>
            ${caption ? `<p class="text-xs text-textSecondary mt-1">${escapeHtml(caption)}</p>` : ''}
        </div>
    `;
}

function groupRow(group, target) {
    return `
        <div class="rounded-xl border border-surfaceLight bg-surfaceLight/30 p-3">
            <div class="flex items-start justify-between gap-3 flex-wrap">
                <div class="min-w-0 flex-1">
                    <div class="flex items-center gap-2 flex-wrap">
                        <p class="text-sm font-semibold text-textPrimary truncate">${escapeHtml(group.purchaseName)}</p>
                        <span class="px-2 py-0.5 rounded-full border ${group.status === 'Quitado' ? 'border-success/20 bg-success/10 text-success' : 'border-accent/20 bg-accent/10 text-accent'} text-[11px] font-semibold">${group.status}</span>
                    </div>
                    <p class="text-xs text-textSecondary mt-1">${escapeHtml(group.person)} | ${escapeHtml(group.card)} | ${group.paidCount}/${group.totalInstallments} pagas</p>
                </div>
                <div class="grid grid-cols-3 gap-2 text-right text-xs min-w-[260px]">
                    <div><span class="text-textSecondary">Total</span><p class="font-semibold text-textPrimary">${money(group.totalAmount, target)}</p></div>
                    <div><span class="text-textSecondary">Pago</span><p class="font-semibold text-success">${money(group.paidAmount, target)}</p></div>
                    <div><span class="text-textSecondary">Restante</span><p class="font-semibold text-warn">${money(group.remainingAmount, target)}</p></div>
                </div>
            </div>
            <div class="mt-3">
                <div class="flex justify-between text-[11px] text-textSecondary mb-1">
                    <span>${group.remainingCount} parcela(s) restante(s)</span>
                    <span>${group.progress}%</span>
                </div>
                <div class="h-2 rounded-full bg-surfaceLight overflow-hidden">
                    <div class="h-full ${group.status === 'Quitado' ? 'bg-success' : 'bg-accent'}" style="width: ${group.progress}%"></div>
                </div>
            </div>
        </div>
    `;
}

function monthParcelRow(record, target, today) {
    const status = getStatus(record, today);
    return `
        <div class="rounded-xl border border-surfaceLight bg-surfaceLight/30 p-3 flex items-start justify-between gap-3 flex-wrap">
            <div class="min-w-0 flex-1">
                <p class="text-sm font-semibold text-textPrimary truncate">${escapeHtml(getInstallmentPurchaseName(record))}</p>
                <p class="text-xs text-textSecondary mt-1">${escapeHtml(record.person || '-')} | ${escapeHtml(getInstallmentCard(record))} | parcela ${getInstallmentNo(record) || 0}/${getTotalInstallments(record) || 0} | venc. ${formatDate(record.due_date || '')}</p>
            </div>
            <div class="text-right flex flex-col items-end gap-2">
                <p class="text-sm font-semibold text-textPrimary">${money(record.amount, target)}</p>
                ${statusBadge(status)}
                ${recordActions(record)}
            </div>
        </div>
    `;
}

function paidParcelRow(record, target) {
    return `
        <div class="rounded-xl border border-surfaceLight bg-surfaceLight/30 p-3 flex items-start justify-between gap-3 flex-wrap">
            <div class="min-w-0 flex-1">
                <p class="text-sm font-semibold text-textPrimary truncate">${escapeHtml(getInstallmentPurchaseName(record))}</p>
                <p class="text-xs text-textSecondary mt-1">${escapeHtml(record.person || '-')} | ${escapeHtml(getInstallmentCard(record))} | parcela ${getInstallmentNo(record) || 0}/${getTotalInstallments(record) || 0} | ${formatDate(record.paid_at || record.due_date || '')}</p>
            </div>
            <div class="text-right flex flex-col items-end gap-2">
                <p class="text-sm font-semibold text-success">${money(record.amount, target)}</p>
                ${recordActions(record)}
            </div>
        </div>
    `;
}

function monthSummaryRow(item, target) {
    const predominant = item.paid >= item.open && item.paid >= item.late ? 'Pago' : item.late > item.open ? 'Atrasado' : 'Em aberto';
    return `
        <div class="rounded-xl border border-surfaceLight bg-surfaceLight/30 p-3 flex items-center justify-between gap-3">
            <div>
                <p class="text-sm font-semibold text-textPrimary">${escapeHtml(formatMonth(item.month, target))}</p>
                <p class="text-xs text-textSecondary mt-1">${item.count} parcela(s) | status predominante: ${predominant}</p>
            </div>
            <p class="text-sm font-semibold text-warn">${money(item.total, target)}</p>
        </div>
    `;
}

export function buildParcelamentosMonthlyChartData(groups = [], target = globalThis) {
    const months = new Map();
    (Array.isArray(groups) ? groups : []).forEach((group) => {
        (Array.isArray(group.installments) ? group.installments : []).forEach((record) => {
            const key = monthKey(record);
            if (!key) return;
            const current = months.get(key) || { month: key, total: 0 };
            current.total = roundMoney(current.total + (Number(record.amount) || 0));
            months.set(key, current);
        });
    });

    const items = [...months.values()].sort((a, b) => a.month.localeCompare(b.month));
    return {
        months: items.map((item) => item.month),
        labels: items.map((item) => formatMonth(item.month, target)),
        values: items.map((item) => item.total),
        total: roundMoney(items.reduce((sum, item) => sum + item.total, 0))
    };
}

function openMonthDetail(month = '', groups = [], target = globalThis) {
    const selectedMonth = String(month || '').slice(0, 7);
    if (!selectedMonth) return;
    const records = (Array.isArray(groups) ? groups : [])
        .flatMap((group) => Array.isArray(group.installments) ? group.installments : [])
        .filter((record) => monthKey(record) === selectedMonth)
        .sort((a, b) => String(a.due_date || '').localeCompare(String(b.due_date || '')));
    const modal = ensureParcelamentosModal(target);
    const title = target.document.getElementById('parcelamentos-detail-title');
    const subtitle = target.document.getElementById('parcelamentos-detail-subtitle');
    const summaryEl = target.document.getElementById('parcelamentos-detail-summary');
    const listEl = target.document.getElementById('parcelamentos-detail-list');
    if (!modal || !title || !subtitle || !summaryEl || !listEl) return;

    const total = roundMoney(records.reduce((sum, record) => sum + (Number(record.amount) || 0), 0));
    const paidCount = records.filter((record) => record.status === 'Pago').length;
    const openCount = records.filter((record) => record.status !== 'Pago').length;
    const lateCount = records.filter((record) => getStatus(record) === 'atrasado').length;

    title.textContent = `Parcelas de ${formatMonth(selectedMonth, target)}`;
    subtitle.textContent = 'Detalhe do mes selecionado no grafico';
    summaryEl.innerHTML = [
        metric('Total do mes', money(total, target), 'text-warn'),
        metric('Parcelas', String(records.length), 'text-textPrimary'),
        metric('Pagas', String(paidCount), 'text-success'),
        metric('Em aberto', String(openCount), lateCount ? `${lateCount} atrasada(s)` : '')
    ].join('');
    listEl.innerHTML = records.length
        ? records.map((record) => monthParcelRow(record, target, localDateKey())).join('')
        : '<p class="text-sm text-textSecondary text-center py-6">Nenhuma parcela encontrada para este mes.</p>';

    modal.querySelector('.dashboard-detail-modal-panel')?.scrollTo({ top: 0, behavior: 'auto' });
    listEl.scrollTo({ top: 0, behavior: 'auto' });
    modal.classList.remove('hidden');
    target.lucide?.createIcons?.();
}

function renderMonthlyChart(groups = [], target = globalThis) {
    const canvas = target.document?.getElementById('parcelamentos-monthly-chart');
    const empty = target.document?.getElementById('parcelamentos-chart-empty');
    const totalEl = target.document?.getElementById('parcelamentos-chart-total');
    const caption = target.document?.getElementById('parcelamentos-chart-caption');
    const ChartCtor = target.Chart;
    if (!canvas || !ChartCtor) return;

    const data = buildParcelamentosMonthlyChartData(groups, target);
    if (totalEl) totalEl.textContent = money(data.total, target);
    if (caption) {
        caption.textContent = data.labels.length
            ? `${data.labels.length} mes(es) no recorte atual`
            : 'Valores por competencia';
    }

    const hasData = data.values.some((value) => value > 0);
    empty?.classList.toggle('hidden', hasData);
    empty?.classList.toggle('flex', !hasData);
    canvas.classList.toggle('opacity-20', !hasData);
    const chart = target.__parcelamentosMonthlyChart;
    if (!hasData) {
        if (chart?.data) {
            chart.data.labels = [];
            chart.data.datasets[0].data = [];
            chart.update?.('none');
        }
        return;
    }

    if (chart?.data) {
        chart.$parcelamentosMonths = data.months;
        chart.$parcelamentosGroups = groups;
        chart.data.labels = data.labels;
        chart.data.datasets[0].data = data.values;
        chart.update('none');
        return;
    }

    target.__parcelamentosMonthlyChart = new ChartCtor(canvas, {
        type: 'bar',
        data: {
            labels: data.labels,
            datasets: [{
                label: 'Valor das parcelas',
                data: data.values,
                backgroundColor: 'rgba(14, 165, 233, 0.42)',
                borderColor: 'rgba(14, 165, 233, 0.95)',
                borderWidth: 1,
                borderRadius: 6,
                maxBarThickness: 42
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            onClick: (event, elements, chartInstance) => {
                const index = elements?.[0]?.index;
                if (index === undefined || index === null) return;
                const selectedMonth = chartInstance.$parcelamentosMonths?.[index];
                openMonthDetail(selectedMonth, chartInstance.$parcelamentosGroups || [], target);
            },
            onHover: (event, elements) => {
                if (event?.native?.target) {
                    event.native.target.style.cursor = elements?.length ? 'pointer' : 'default';
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (context) => money(context.parsed.y, target)
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { color: '#64748b' }
                },
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(148, 163, 184, 0.18)' },
                    ticks: {
                        color: '#64748b',
                        callback: (value) => money(value, target)
                    }
                }
            }
        }
    });
    target.__parcelamentosMonthlyChart.$parcelamentosMonths = data.months;
    target.__parcelamentosMonthlyChart.$parcelamentosGroups = groups;
}

function ensureParcelamentosModal(target) {
    const doc = target.document;
    let modal = doc.getElementById('parcelamentos-detail-modal');
    if (modal) return modal;
    modal = doc.createElement('div');
    modal.id = 'parcelamentos-detail-modal';
    modal.className = 'hidden fixed inset-0 bg-black/60 z-[300] p-3 sm:p-4 overflow-y-auto flex items-start sm:items-center justify-center dashboard-detail-modal';
    modal.innerHTML = `
        <div class="dashboard-detail-modal-panel bg-surface rounded-xl p-5 border border-surfaceLight max-w-5xl mx-auto w-full my-auto max-h-[calc(100dvh-1.5rem)] sm:max-h-[90vh] overflow-y-auto overscroll-contain">
            <div class="finance-modal-header flex items-start justify-between gap-3 mb-4">
                <div>
                    <h3 class="font-semibold" id="parcelamentos-detail-title">Parcelamentos</h3>
                    <p class="text-xs text-textSecondary mt-1" id="parcelamentos-detail-subtitle"></p>
                </div>
                <button type="button" id="btn-close-parcelamentos-detail" class="finance-modal-close p-2 rounded-lg hover:bg-surfaceLight text-textSecondary">
                    <i data-lucide="x" class="w-4 h-4"></i>
                </button>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4" id="parcelamentos-detail-summary"></div>
            <div class="space-y-2 max-h-[56dvh] sm:max-h-[60vh] overflow-y-auto overscroll-contain pr-1" id="parcelamentos-detail-list"></div>
        </div>
    `;
    doc.body.appendChild(modal);
    doc.getElementById('btn-close-parcelamentos-detail')?.addEventListener('click', () => modal.classList.add('hidden'));
    modal.addEventListener('click', (event) => {
        if (event.target === modal) modal.classList.add('hidden');
    });
    return modal;
}

function openDetail(kind, target) {
    const summary = buildSummary(target.allRecords || []);
    const modal = ensureParcelamentosModal(target);
    const title = target.document.getElementById('parcelamentos-detail-title');
    const subtitle = target.document.getElementById('parcelamentos-detail-subtitle');
    const summaryEl = target.document.getElementById('parcelamentos-detail-summary');
    const listEl = target.document.getElementById('parcelamentos-detail-list');
    if (!modal || !title || !subtitle || !summaryEl || !listEl) return;

    if (kind === 'comprometido') {
        title.textContent = 'Total Comprometido';
        subtitle.textContent = 'Compras parceladas com saldo em aberto';
        summaryEl.innerHTML = [
            metric('Total comprometido', money(summary.totalRemaining, target), 'text-danger'),
            metric('Compras ativas', String(summary.activePurchaseCount), 'text-accent'),
            metric('Valor em aberto', money(summary.totalRemaining, target), 'text-warn'),
            metric('Maior compra', money(summary.biggestPurchase.totalAmount, target), 'text-textPrimary', summary.biggestPurchase.purchaseName)
        ].join('');
        listEl.innerHTML = summary.committedGroups.length
            ? summary.committedGroups.map((group) => groupRow(group, target)).join('')
            : '<p class="text-sm text-textSecondary text-center py-6">Nenhuma compra parcelada em aberto.</p>';
    } else if (kind === 'mes') {
        title.textContent = 'Parcelas deste Mes';
        subtitle.textContent = formatMonth(summary.month, target);
        summaryEl.innerHTML = [
            metric('Total do mes', money(summary.monthTotal, target), 'text-warn'),
            metric('Quantidade', String(summary.monthRecords.length), 'text-textPrimary'),
            metric('Pagas', String(summary.monthPaidCount), 'text-success'),
            metric('Em aberto', String(summary.monthOpenCount), 'text-danger')
        ].join('');
        listEl.innerHTML = summary.monthRecords.length
            ? summary.monthRecords.map((record) => monthParcelRow(record, target, summary.today)).join('')
            : '<p class="text-sm text-textSecondary text-center py-6">Nenhuma parcela neste mes.</p>';
    } else if (kind === 'pago') {
        title.textContent = 'Total ja Pago';
        subtitle.textContent = 'Parcelas quitadas';
        summaryEl.innerHTML = [
            metric('Valor total pago', money(summary.totalPaid, target), 'text-success'),
            metric('Parcelas pagas', String(summary.paidRecords.length), 'text-success'),
            metric('Compras com pagas', String(summary.paidPurchaseCount), 'text-textPrimary'),
            metric('Total de compras', String(summary.groupList.length), 'text-accent')
        ].join('');
        listEl.innerHTML = summary.paidRecords.length
            ? summary.paidRecords.map((record) => paidParcelRow(record, target)).join('')
            : '<p class="text-sm text-textSecondary text-center py-6">Nenhuma parcela paga encontrada.</p>';
    } else {
        title.textContent = 'Meses com Parcelas';
        subtitle.textContent = 'Distribuicao mensal dos parcelamentos';
        summaryEl.innerHTML = [
            metric('Meses com parcelas', String(summary.monthList.length), 'text-textPrimary'),
            metric('Maior valor', summary.biggestMonth.month !== '-' ? formatMonth(summary.biggestMonth.month, target) : '-', 'text-warn', money(summary.biggestMonth.total, target)),
            metric('Media mensal', money(summary.averageMonthly, target), 'text-accent'),
            metric('Parcelas totais', String(summary.installments.length), 'text-textPrimary')
        ].join('');
        listEl.innerHTML = summary.monthList.length
            ? summary.monthList.map((item) => monthSummaryRow(item, target)).join('')
            : '<p class="text-sm text-textSecondary text-center py-6">Nenhum mes com parcelas encontrado.</p>';
    }

    modal.querySelector('.dashboard-detail-modal-panel')?.scrollTo({ top: 0, behavior: 'auto' });
    listEl.scrollTo({ top: 0, behavior: 'auto' });
    modal.classList.remove('hidden');
    target.lucide?.createIcons?.();
}

export function installParcelamentosRenderer(target = globalThis) {
    let detailBound = false;
    let scheduledRender = 0;

    const scheduleParcelamentosRender = () => {
        if (scheduledRender) return;
        const requestFrame = target.requestAnimationFrame || ((callback) => target.setTimeout(callback, 16));
        scheduledRender = requestFrame(() => {
            scheduledRender = 0;
            target.renderParcelamentos?.();
        });
    };

    function bindParcelamentoDetails() {
        const doc = target.document;
        if (detailBound) return;
        detailBound = true;
        doc.addEventListener('click', (event) => {
            const button = event.target.closest?.('[data-parcelamentos-detail]');
            if (!button || !doc.getElementById('view-parcelamentos')?.contains(button)) return;
            event.preventDefault();
            openDetail(button.dataset.parcelamentosDetail, target);
        });
    }

    target.renderParcelamentos = function () {
        const summary = buildSummary(target.allRecords || []);
        let groupList = [...summary.groupList];

        const searchVal = target.document.getElementById('parcelamentos-search')?.value.toLowerCase() || '';
        const statusVal = target.document.getElementById('parcelamentos-status-filter')?.value || 'ativos';
        const cardVal = target.document.getElementById('parcelamentos-card-filter')?.value || '';
        const personVal = target.document.getElementById('parcelamentos-person-filter')?.value || '';

        if (searchVal) {
            groupList = groupList.filter((group) =>
                group.purchaseName.toLowerCase().includes(searchVal) ||
                group.card.toLowerCase().includes(searchVal)
            );
        }
        if (statusVal === 'ativos') {
            groupList = groupList.filter((group) => group.status !== 'Quitado');
        } else if (statusVal === 'concluidos') {
            groupList = groupList.filter((group) => group.status === 'Quitado');
        }
        if (cardVal) groupList = groupList.filter((group) => group.card === cardVal);
        if (personVal) groupList = groupList.filter((group) => group.person === personVal);

        renderMonthlyChart(groupList, target);

        const setText = (id, text) => {
            const el = target.document.getElementById(id);
            if (el) el.textContent = text;
        };

        setText('parcelamentos-total-comprometido', money(summary.totalRemaining, target));
        setText('parcelamentos-total-mes', money(summary.monthTotal, target));
        setText('parcelamentos-total-pago', money(summary.totalPaid, target));
        setText('parcelamentos-meses-ativos', String(summary.monthList.length));

        const cardSelect = target.document.getElementById('parcelamentos-card-filter');
        const personSelect = target.document.getElementById('parcelamentos-person-filter');
        if (cardSelect) {
            const value = cardSelect.value;
            const cards = [...new Set(summary.groupList.map((group) => group.card).filter((item) => item && item !== '-'))].sort();
            cardSelect.innerHTML = '<option value="">Todos</option>' + cards.map((item) => `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`).join('');
            cardSelect.value = value;
        }
        if (personSelect) {
            const value = personSelect.value;
            const people = [...new Set(summary.groupList.map((group) => group.person).filter((item) => item && item !== '-'))].sort();
            personSelect.innerHTML = '<option value="">Todas</option>' + people.map((item) => `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`).join('');
            personSelect.value = value;
        }

        const listEl = target.document.getElementById('parcelamentos-list');
        if (!listEl) return;
        listEl.innerHTML = groupList.length
            ? groupList.map((group) => {
                const isDone = group.status === 'Quitado';
                return `
                    <div class="grid grid-cols-12 gap-3 p-3 items-center text-sm hover:bg-surfaceLight/30 transition-colors">
                        <div class="col-span-3">
                            <p class="font-medium truncate" title="${escapeHtml(group.purchaseName)}">${escapeHtml(group.purchaseName)}</p>
                            <p class="text-[11px] text-textSecondary mt-0.5">${group.status}</p>
                        </div>
                        <div class="col-span-2">
                            <span class="px-2 py-0.5 rounded-full bg-surfaceLight border border-surfaceLight text-xs">${escapeHtml(group.card)}</span>
                        </div>
                        <div class="col-span-2">
                            <div class="flex items-center justify-between text-[11px] mb-1">
                                <span class="${isDone ? 'text-success' : 'text-textSecondary'}">${group.paidCount}/${group.totalInstallments} Pagas</span>
                                <span>${group.progress}%</span>
                            </div>
                            <div class="w-full h-1.5 bg-surfaceLight rounded-full overflow-hidden">
                                <div class="h-full ${isDone ? 'bg-success' : 'bg-accent'}" style="width: ${group.progress}%"></div>
                            </div>
                        </div>
                        <div class="col-span-2 text-right">
                            <span class="font-medium">${money(group.totalAmount, target)}</span>
                        </div>
                        <div class="col-span-3 text-right">
                            <span class="font-semibold ${isDone ? 'text-success' : 'text-danger'}">${isDone ? 'Totalmente Pago' : money(group.remainingAmount, target)}</span>
                        </div>
                    </div>`;
            }).join('')
            : '<div class="p-8 text-center text-textSecondary text-sm">Nenhum parcelamento encontrado com os filtros atuais.</div>';

        bindParcelamentoFilters();
        bindParcelamentoDetails();
        target.lucide?.createIcons?.();
    };

    const bindParcelamentoFilters = () => {
        ['parcelamentos-search', 'parcelamentos-status-filter', 'parcelamentos-card-filter', 'parcelamentos-person-filter'].forEach((id) => {
            const el = target.document.getElementById(id);
            if (el && !el.dataset.bound) {
                el.addEventListener('change', scheduleParcelamentosRender);
                if (id === 'parcelamentos-search') el.addEventListener('input', scheduleParcelamentosRender);
                el.dataset.bound = 'true';
            }
        });
    };

    const originalSwitchTab = target.switchTab;
    target.switchTab = function (tab, options) {
        if (originalSwitchTab) originalSwitchTab.call(target, tab, options);
        if (tab === 'parcelamentos') {
            bindParcelamentoFilters();
            bindParcelamentoDetails();
            target.renderParcelamentos();
        }
    };
}
