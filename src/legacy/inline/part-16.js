function normalizeEntryDiscountCycle(value = '') {
            return value === 'QUINZENA' ? 'QUINZENA' : 'INICIO_MES';
        }

        getEntryDiscountAdjustmentRecord = function (person = '', competencia = '', cycle = 'INICIO_MES') {
            const normalizedCycle = normalizeEntryDiscountCycle(cycle);
            return allRecords.find((record) =>
                record?.type === 'entrada' &&
                record.person === person &&
                record.competence === competencia &&
                record.entry_discount_adjustment === true &&
                normalizeEntryDiscountCycle(record.entry_discount_cycle || record.cycle || '') === normalizedCycle
            ) || null;
        };

        buildEntryDiscountInputId = function (person = '', competencia = '', cycle = 'INICIO_MES') {
            return `entry-discount-${normalizeEntryDiscountCycle(cycle)}-${encodeURIComponent(`${person}|${competencia}`).replace(/[^a-zA-Z0-9]/g, '_')}`;
        };

        function buildEntryDiscountObservationId(person = '', competencia = '', cycle = 'INICIO_MES') {
            return `entry-discount-note-${normalizeEntryDiscountCycle(cycle)}-${encodeURIComponent(`${person}|${competencia}`).replace(/[^a-zA-Z0-9]/g, '_')}`;
        }

        function getEntryDiscountHistoryItems(record = {}) {
            return Array.isArray(record.entry_discount_history) ? record.entry_discount_history : [];
        }

        function getEntryDiscountHistoryTotal(record = {}) {
            return roundCurrency(getEntryDiscountHistoryItems(record).reduce((sum, item) => sum + (Number(item.amount) || 0), 0));
        }

        function getEntryDiscountRecordTotal(record = {}) {
            const historyTotal = getEntryDiscountHistoryTotal(record);
            return record.entry_discount_adjustment === true && historyTotal > 0
                ? historyTotal
                : roundCurrency(Number(record.amount || 0));
        }

        function getEntryDiscountDisplayItemCount(record = {}) {
            const history = getEntryDiscountHistoryItems(record);
            if (record.entry_discount_adjustment === true && history.length) return history.length;
            return record && Object.keys(record).length ? 1 : 0;
        }

        function buildEntryDiscountHistoryEntry({ amount = 0, observation = '', cycle = 'INICIO_MES', previous = null } = {}) {
            const addedAmount = roundCurrency(Number(amount) || 0);
            const previousAmount = previous ? getEntryDiscountRecordTotal(previous) : 0;
            return {
                id: globalThis.crypto?.randomUUID?.() || `discount_history_${Date.now()}_${Math.random().toString(36).slice(2)}`,
                amount: addedAmount,
                observation: String(observation || '').trim(),
                cycle: normalizeEntryDiscountCycle(cycle),
                previous_amount: previous ? previousAmount : null,
                resulting_amount: roundCurrency(previousAmount + addedAmount),
                previous_observation: previous ? String(previous.observation || previous.description || '').trim() : '',
                saved_at: new Date().toISOString()
            };
        }

        function getEntryPeriodDiscountRecords(person = '', competencia = '') {
            return (Array.isArray(allRecords) ? allRecords : [])
                .filter((record) =>
                    record?.type === 'entrada' &&
                    record.person === person &&
                    record.competence === competencia &&
                    (
                        record.entry_discount_adjustment === true ||
                        isDeductionLikeMacro(record.macro_category || '') ||
                        String(record.earning_type || record.subcategory || record.description || '').toUpperCase().includes('DESCONTO') ||
                        String(record.earning_type || record.subcategory || record.description || '').toUpperCase().includes('INSS') ||
                        String(record.earning_type || record.subcategory || record.description || '').toUpperCase().includes('IRRF') ||
                        String(record.earning_type || record.subcategory || record.description || '').toUpperCase().includes('IRPF')
                    )
                )
                .sort((a, b) => {
                    const cycleCompare = normalizeEntryDiscountCycle(a.entry_discount_cycle || a.cycle || '').localeCompare(normalizeEntryDiscountCycle(b.entry_discount_cycle || b.cycle || ''));
                    if (cycleCompare !== 0) return cycleCompare;
                    return String(b.updated_at || b.created_at || '').localeCompare(String(a.updated_at || a.created_at || ''));
                });
        }

        window.getEntryOtherRevenueRecords = function (person = '', competencia = '') {
            return (Array.isArray(allRecords) ? allRecords : [])
                .filter((record) => {
                    if (record?.type !== 'entrada') return false;
                    if (record.person !== person || record.competence !== competencia) return false;
                    if (typeof isArchivedRecord === 'function' && isArchivedRecord(record)) return false;
                    if (typeof isReferenceSalaryRecord === 'function' && isReferenceSalaryRecord(record)) return false;
                    if (record.entry_discount_adjustment === true) return false;

                    const label = String(record.subcategory || record.earning_type || record.description || '').toUpperCase();
                    const macro = String(record.macro_category || '').toUpperCase();
                    if (macro.includes('DEDU')) return false;
                    if (label.includes('SAL')) return false;
                    if (label.includes('HORA EXTRA')) return false;
                    if (label.includes('DSR')) return false;
                    if (label.includes('INSS') || label.includes('IRRF') || label.includes('IRPF')) return false;
                    if (label.includes('DESCONTO')) return false;
                    return Number(record.amount || 0) > 0;
                })
                .sort((a, b) => String(b.updated_at || b.created_at || '').localeCompare(String(a.updated_at || a.created_at || '')));
        };

        let editingOtherRevenueRecordId = '';

        function ensureEntryOtherRevenuesModal() {
            if (document.getElementById('entry-other-revenues-modal')) return;
            const modal = document.createElement('div');
            modal.id = 'entry-other-revenues-modal';
            modal.className = 'hidden fixed inset-0 bg-black/60 flex items-center justify-center z-[330] p-4';
            modal.innerHTML = `
                <div class="bg-surface rounded-xl border border-surfaceLight max-w-5xl w-full max-h-[90vh] overflow-y-auto p-5">
                    <div class="flex items-start justify-between gap-3 mb-4">
                        <div>
                            <h3 id="entry-other-revenues-title" class="font-semibold">Outras receitas</h3>
                            <p id="entry-other-revenues-subtitle" class="text-xs text-textSecondary mt-1"></p>
                        </div>
                        <button type="button" data-close-entry-other-revenues class="p-2 rounded-lg hover:bg-surfaceLight text-textSecondary">
                            <i data-lucide="x" class="w-4 h-4"></i>
                        </button>
                    </div>
                    <div class="grid grid-cols-1 md:grid-cols-[1.4fr_0.7fr_auto_auto] gap-2 mb-4">
                        <input id="entry-other-revenue-description" type="text" placeholder="Descricao da receita" class="bg-surface border border-surfaceLight rounded-xl px-3 py-2 text-sm text-textPrimary">
                        <input id="entry-other-revenue-amount" type="number" step="0.01" min="0" placeholder="Valor" class="bg-surface border border-surfaceLight rounded-xl px-3 py-2 text-sm text-textPrimary">
                        <button id="entry-other-revenue-save" type="button" class="px-3 py-2 text-xs rounded-xl bg-success/10 text-success hover:bg-success hover:text-bg transition-colors font-semibold">Incluir receita</button>
                        <button id="entry-other-revenue-cancel" type="button" class="hidden px-3 py-2 text-xs rounded-xl bg-surfaceLight text-textSecondary hover:text-textPrimary transition-colors font-semibold">Cancelar</button>
                    </div>
                    <div id="entry-other-revenues-summary" class="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4"></div>
                    <div id="entry-other-revenues-list" class="space-y-2"></div>
                    <p id="entry-other-revenues-empty" class="text-sm text-textSecondary text-center py-6 hidden">Nenhuma outra receita cadastrada.</p>
                </div>
            `;
            document.body.appendChild(modal);
            modal.querySelector('[data-close-entry-other-revenues]')?.addEventListener('click', () => closeEntryOtherRevenuesModal());
            modal.querySelector('#entry-other-revenue-save')?.addEventListener('click', () => saveEntryOtherRevenue());
            modal.querySelector('#entry-other-revenue-cancel')?.addEventListener('click', () => clearEntryOtherRevenueForm());
        }

        function clearEntryOtherRevenueForm() {
            editingOtherRevenueRecordId = '';
            const description = document.getElementById('entry-other-revenue-description');
            const amount = document.getElementById('entry-other-revenue-amount');
            const save = document.getElementById('entry-other-revenue-save');
            const cancel = document.getElementById('entry-other-revenue-cancel');
            if (description) description.value = '';
            if (amount) amount.value = '';
            if (save) save.textContent = 'Incluir receita';
            cancel?.classList.add('hidden');
        }

        function closeEntryOtherRevenuesModal() {
            document.getElementById('entry-other-revenues-modal')?.classList.add('hidden');
            clearEntryOtherRevenueForm();
        }

        function renderEntryOtherRevenuesModal() {
            const modal = document.getElementById('entry-other-revenues-modal');
            if (!modal) return;
            const person = modal.dataset.person || '';
            const competencia = modal.dataset.competencia || '';
            const records = window.getEntryOtherRevenueRecords(person, competencia);
            const total = roundCurrency(records.reduce((sum, record) => sum + (Number(record.amount) || 0), 0));
            const subtitle = document.getElementById('entry-other-revenues-subtitle');
            const summary = document.getElementById('entry-other-revenues-summary');
            const list = document.getElementById('entry-other-revenues-list');
            const empty = document.getElementById('entry-other-revenues-empty');

            if (subtitle) subtitle.textContent = `${person} - ${formatCompetence(competencia)}`;
            if (summary) {
                summary.innerHTML = `
                    <div class="rounded-xl border border-surfaceLight bg-surfaceLight/30 px-4 py-3">
                        <p class="text-xs text-textSecondary">Total cadastrado</p>
                        <p class="text-lg font-semibold text-success mt-1">${fmt(total)}</p>
                    </div>
                    <div class="rounded-xl border border-surfaceLight bg-surfaceLight/30 px-4 py-3">
                        <p class="text-xs text-textSecondary">Itens</p>
                        <p class="text-lg font-semibold text-textPrimary mt-1">${records.length}</p>
                    </div>
                    <div class="rounded-xl border border-surfaceLight bg-surfaceLight/30 px-4 py-3">
                        <p class="text-xs text-textSecondary">Base percentual</p>
                        <p class="text-lg font-semibold text-accent mt-1">Nao entra</p>
                    </div>
                `;
            }

            if (list) {
                list.innerHTML = records.map((record) => `
                    <div class="rounded-xl border border-surfaceLight bg-surfaceLight/30 p-3 flex items-center justify-between gap-3 flex-wrap">
                        <div>
                            <p class="text-sm font-semibold text-textPrimary">${escapeHtml(record.description || record.subcategory || record.earning_type || 'Outra receita')}</p>
                            <p class="text-xs text-textSecondary mt-1">${escapeHtml(record.subcategory || record.earning_type || 'Outras receitas')}</p>
                        </div>
                        <div class="flex items-center gap-2">
                            <strong class="text-success whitespace-nowrap">${fmt(record.amount)}</strong>
                            <button type="button" data-other-revenue-edit="${record.id}" class="px-2 py-1 text-xs rounded-lg border border-surfaceLight text-textSecondary hover:text-accent hover:border-accent/30 transition-colors">Editar</button>
                            <button type="button" data-other-revenue-delete="${record.id}" class="px-2 py-1 text-xs rounded-lg border border-surfaceLight text-textSecondary hover:text-danger hover:border-danger/30 transition-colors">Excluir</button>
                        </div>
                    </div>
                `).join('');
                list.querySelectorAll('[data-other-revenue-edit]').forEach((button) => {
                    button.addEventListener('click', () => editEntryOtherRevenue(button.dataset.otherRevenueEdit || ''));
                });
                list.querySelectorAll('[data-other-revenue-delete]').forEach((button) => {
                    button.addEventListener('click', () => deleteEntryOtherRevenue(button.dataset.otherRevenueDelete || ''));
                });
            }

            empty?.classList.toggle('hidden', records.length > 0);
            lucide.createIcons();
        }

        window.openEntryOtherRevenuesModal = function (person = '', competencia = '') {
            ensureEntryOtherRevenuesModal();
            const modal = document.getElementById('entry-other-revenues-modal');
            if (!modal) return;
            modal.dataset.person = person;
            modal.dataset.competencia = competencia;
            clearEntryOtherRevenueForm();
            renderEntryOtherRevenuesModal();
            modal.classList.remove('hidden');
        };

        function editEntryOtherRevenue(recordId = '') {
            const modal = document.getElementById('entry-other-revenues-modal');
            const record = window.getEntryOtherRevenueRecords(modal?.dataset.person || '', modal?.dataset.competencia || '')
                .find((item) => String(item.id || '') === String(recordId || ''));
            if (!record) return;
            editingOtherRevenueRecordId = record.id || '';
            document.getElementById('entry-other-revenue-description').value = record.description || record.subcategory || record.earning_type || '';
            document.getElementById('entry-other-revenue-amount').value = Number(record.amount || 0).toFixed(2);
            document.getElementById('entry-other-revenue-save').textContent = 'Salvar alteracao';
            document.getElementById('entry-other-revenue-cancel')?.classList.remove('hidden');
        }

        async function saveEntryOtherRevenue() {
            const modal = document.getElementById('entry-other-revenues-modal');
            const person = modal?.dataset.person || '';
            const competencia = modal?.dataset.competencia || '';
            const description = String(document.getElementById('entry-other-revenue-description')?.value || '').trim();
            const amount = roundCurrency(Number(document.getElementById('entry-other-revenue-amount')?.value || 0));
            if (!person || !competencia) return;
            if (!description) { showToast('Informe a descricao da receita', true); return; }
            if (!(amount > 0)) { showToast('Informe um valor valido', true); return; }

            const existing = editingOtherRevenueRecordId
                ? allRecords.find((record) => String(record.id || '') === String(editingOtherRevenueRecordId))
                : null;
            const payload = {
                ...(existing || {}),
                type: 'entrada',
                person,
                competence: competencia,
                macro_category: 'Rendimento',
                subcategory: 'Outras receitas',
                description,
                earning_type: 'Outras receitas',
                amount,
                status: 'Pago',
                payment_method: '',
                occurred_date: existing?.occurred_date || '',
                due_date: existing?.due_date || '',
                paid_at: existing?.paid_at || '',
                cycle: existing?.cycle || '',
                recurrence: existing?.recurrence || '',
                installment_no: existing?.installment_no || 0,
                total_installments: existing?.total_installments || 0,
                parent_id: existing?.parent_id || '',
                created_at: existing?.created_at || new Date().toISOString(),
                updated_at: new Date().toISOString()
            };

            const result = existing
                ? await window.dataSdk.update({ ...payload, id: existing.id })
                : await window.dataSdk.create(payload);
            if (!result?.isOk) {
                showToast('Erro ao salvar outra receita', true);
                return;
            }

            if (existing) {
                const index = allRecords.findIndex((record) => record.id === existing.id);
                if (index >= 0) allRecords[index] = { ...payload, id: existing.id };
            } else {
                allRecords.push({ ...payload, id: result.id });
            }

            showToast(existing ? 'Outra receita atualizada!' : 'Outra receita cadastrada!');
            clearEntryOtherRevenueForm();
            renderEntryOtherRevenuesModal();
            renderCurrentTab();
        }

        async function deleteEntryOtherRevenue(recordId = '') {
            const record = allRecords.find((item) => String(item.id || '') === String(recordId || ''));
            if (!record) return;
            if (!confirm('Excluir esta outra receita?')) return;
            const result = await window.dataSdk.delete(record);
            if (!result?.isOk) {
                showToast('Erro ao excluir outra receita', true);
                return;
            }
            allRecords = allRecords.filter((item) => String(item.id || '') !== String(recordId || ''));
            showToast('Outra receita excluida!');
            clearEntryOtherRevenueForm();
            renderEntryOtherRevenuesModal();
            renderCurrentTab();
        }

        function ensureEntryDiscountHistoryModal() {
            if (document.getElementById('entry-discount-history-modal')) return;
            const modal = document.createElement('div');
            modal.id = 'entry-discount-history-modal';
            modal.className = 'hidden fixed inset-0 bg-black/60 flex items-center justify-center z-[320] p-4';
            modal.innerHTML = `
                <div class="bg-surface rounded-xl border border-surfaceLight max-w-4xl w-full max-h-[90vh] overflow-y-auto p-5">
                    <div class="flex items-start justify-between gap-3 mb-4">
                        <div>
                            <h3 id="entry-discount-history-title" class="font-semibold">Histórico de descontos</h3>
                            <p id="entry-discount-history-subtitle" class="text-xs text-textSecondary mt-1"></p>
                        </div>
                        <button type="button" data-close-entry-discount-history class="p-2 rounded-lg hover:bg-surfaceLight text-textSecondary">
                            <i data-lucide="x" class="w-4 h-4"></i>
                        </button>
                    </div>
                    <div id="entry-discount-history-summary" class="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4"></div>
                    <div id="entry-discount-history-list" class="space-y-2"></div>
                </div>
            `;
            document.body.appendChild(modal);
            const closeButton = modal.querySelector('[data-close-entry-discount-history]') || modal.querySelector('[data-close-action="entry-discount-history"]');
            closeButton?.addEventListener('click', () => {
                modal.classList.add('hidden');
            });
        }

        function formatEntryDiscountHistoryDate(value = '') {
            if (!value) return '-';
            try {
                return new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
            } catch {
                return value;
            }
        }

        window.openEntryDiscountHistoryModal = function (person = '', competencia = '', cycle = getEntradasCycleFilterValue()) {
            ensureEntryDiscountHistoryModal();
            const normalizedCycle = normalizeEntryDiscountCycle(cycle);
            const records = getEntryPeriodDiscountRecords(person, competencia);
            const manualRecords = records.filter((record) => record.entry_discount_adjustment === true);
            const manualCycleRecords = manualRecords.filter((record) => normalizeEntryDiscountCycle(record.entry_discount_cycle || record.cycle || '') === normalizedCycle);
            const total = roundCurrency(records.reduce((sum, record) => sum + getEntryDiscountRecordTotal(record), 0));
            const manualTotal = roundCurrency(manualRecords.reduce((sum, record) => sum + getEntryDiscountRecordTotal(record), 0));
            const cycleTotal = roundCurrency(manualCycleRecords.reduce((sum, record) => sum + getEntryDiscountRecordTotal(record), 0));
            const title = document.getElementById('entry-discount-history-title');
            const subtitle = document.getElementById('entry-discount-history-subtitle');
            const summary = document.getElementById('entry-discount-history-summary');
            const list = document.getElementById('entry-discount-history-list');

            if (title) title.textContent = 'Histórico de descontos';
            if (subtitle) subtitle.textContent = `${person} • ${formatCompetence(competencia)} • ${normalizedCycle === 'QUINZENA' ? 'Quinzena' : 'Início do mês'}`;
            if (summary) {
                summary.innerHTML = `
                    <div class="rounded-xl border border-surfaceLight bg-surfaceLight/30 px-4 py-3"><p class="text-xs text-textSecondary">Total do período</p><p class="text-lg font-semibold text-danger mt-1">-${fmt(total)}</p></div>
                    <div class="rounded-xl border border-surfaceLight bg-surfaceLight/30 px-4 py-3"><p class="text-xs text-textSecondary">Ajustes manuais</p><p class="text-lg font-semibold text-danger mt-1">-${fmt(manualTotal)}</p></div>
                    <div class="rounded-xl border border-surfaceLight bg-surfaceLight/30 px-4 py-3"><p class="text-xs text-textSecondary">Ciclo atual</p><p class="text-lg font-semibold text-danger mt-1">-${fmt(cycleTotal)}</p></div>
                `;
            }

            if (list) {
                const rows = [];
                const personAttr = escapeHtml(person);
                const competenciaAttr = escapeHtml(competencia);
                records.forEach((record) => {
                    const recordCycle = normalizeEntryDiscountCycle(record.entry_discount_cycle || record.cycle || '');
                    const history = getEntryDiscountHistoryItems(record);
                    const displayHistory = history.length
                        ? history.map((item, index) => ({ item, index }))
                        : (record.entry_discount_adjustment === true
                            ? [{
                                item: {
                                    amount: getEntryDiscountRecordTotal(record),
                                    observation: record.observation || record.description || '',
                                    saved_at: record.updated_at || record.created_at || ''
                                },
                                index: 0
                            }]
                            : []);
                    const canDeleteHistoryItems = record.entry_discount_adjustment === true;
                    rows.push(`
                        <div class="rounded-xl border border-surfaceLight bg-surfaceLight/30 p-3">
                            <div class="flex items-start justify-between gap-3">
                                <div>
                                    <p class="text-sm font-semibold text-textPrimary">${escapeHtml(record.description || record.subcategory || record.earning_type || 'Desconto')}</p>
                                    <p class="text-xs text-textSecondary mt-1">${recordCycle === 'QUINZENA' ? 'Quinzena' : 'Início do mês'}${record.entry_discount_adjustment ? ' • ajuste manual' : ''}${record.observation ? ` • ${escapeHtml(record.observation)}` : ''}</p>
                                </div>
                                <div class="flex items-center gap-2">
                                    <strong class="text-danger whitespace-nowrap">-${fmt(getEntryDiscountRecordTotal(record))}</strong>
                                </div>
                            </div>
                            ${displayHistory.length ? `<div class="mt-3 border-t border-surfaceLight pt-3 space-y-2">
                                ${displayHistory.slice().reverse().map(({ item, index }) => `
                                    <div class="text-xs text-textSecondary flex items-center justify-between gap-3">
                                        <span>${formatEntryDiscountHistoryDate(item.saved_at)}${item.observation ? ` • ${escapeHtml(item.observation)}` : ''}</span>
                                        <span class="inline-flex items-center gap-2">
                                            <span class="text-danger whitespace-nowrap">-${fmt(item.amount)}</span>
                                            ${canDeleteHistoryItems ? `<button
                                                type="button"
                                                data-entry-discount-history-delete
                                                data-person="${personAttr}"
                                                data-competencia="${competenciaAttr}"
                                                data-cycle="${recordCycle}"
                                                data-history-index="${index}"
                                                class="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-lg border border-surfaceLight text-textSecondary hover:text-danger hover:border-danger/30 transition-colors"
                                                title="Excluir este desconto"
                                            ><i data-lucide="trash-2" class="w-3 h-3"></i><span>Excluir</span></button>` : ''}
                                        </span>
                                    </div>
                                `).join('')}
                            </div>` : ''}
                        </div>
                    `);
                });
                list.innerHTML = rows.length
                    ? rows.join('')
                    : '<p class="text-sm text-textSecondary text-center py-6">Nenhum desconto encontrado para este período.</p>';
            }

            if (list) {
                list.querySelectorAll('[data-entry-discount-history-delete]').forEach((button) => {
                    button.addEventListener('click', async () => {
                        const deletePerson = button.dataset.person || '';
                        const deleteCompetencia = button.dataset.competencia || '';
                        const deleteCycle = button.dataset.cycle || 'INICIO_MES';
                        const historyIndex = Number(button.dataset.historyIndex);
                        await deleteEntryDiscountHistoryItem(deletePerson, deleteCompetencia, deleteCycle, historyIndex);
                        openEntryDiscountHistoryModal(deletePerson, deleteCompetencia, deleteCycle);
                    });
                });
            }

            document.getElementById('entry-discount-history-modal')?.classList.remove('hidden');
            lucide.createIcons();
        };

        saveEntryDiscountAdjustmentByEntry = async function (person = '', competencia = '', cycle = getEntradasCycleFilterValue()) {
            const normalizedCycle = normalizeEntryDiscountCycle(cycle);
            const input = document.getElementById(buildEntryDiscountInputId(person, competencia, normalizedCycle));
            const observationInput = document.getElementById(buildEntryDiscountObservationId(person, competencia, normalizedCycle));
            if (!person || !competencia || !input) return;

            const amount = roundCurrency(Number(input.value || 0));
            const observation = String(observationInput?.value || '').trim();
            if (Number.isNaN(amount) || amount <= 0) {
                showToast('Informe um desconto válido', true);
                return;
            }

            const existing = getEntryDiscountAdjustmentRecord(person, competencia, normalizedCycle);
            const previousHistory = existing ? getEntryDiscountHistoryItems(existing) : [];
            const accumulatedAmount = roundCurrency(getEntryDiscountRecordTotal(existing || {}) + amount);
            const payload = {
                type: 'entrada',
                person,
                competence: competencia,
                macro_category: getDeductionMacroValue(),
                subcategory: normalizedCycle === 'QUINZENA' ? 'Outros descontos quinzena' : 'Outros descontos',
                description: observation || (normalizedCycle === 'QUINZENA' ? 'Outros descontos (ajuste manual da quinzena)' : 'Outros descontos (ajuste manual)'),
                observation,
                amount: accumulatedAmount,
                earning_type: normalizedCycle === 'QUINZENA' ? 'Outros descontos quinzena' : 'Outros descontos',
                status: 'Pago',
                payment_method: '',
                occurred_date: '',
                due_date: '',
                paid_at: '',
                cycle: '',
                installment_no: 0,
                total_installments: 0,
                parent_id: '',
                recurrence: '',
                category_id: '',
                category_name: '',
                category_color: '',
                category_icon: '',
                archived: existing?.archived || false,
                archived_at: existing?.archived_at || '',
                entry_discount_adjustment: true,
                entry_discount_cycle: normalizedCycle,
                entry_discount_history: [
                    ...previousHistory,
                    buildEntryDiscountHistoryEntry({ amount, observation, cycle: normalizedCycle, previous: existing })
                ],
                created_at: existing?.created_at || new Date().toISOString(),
                updated_at: new Date().toISOString(),
                ...getHourExtraRecordDefaults()
            };

            const result = existing
                ? await window.dataSdk.update({ ...existing, ...payload, id: existing.id })
                : await window.dataSdk.create(payload);

            if (!result?.isOk) {
                showToast(`Erro ao salvar desconto${result?.error ? `: ${result.error}` : ''}`, true);
                return;
            }

            const optimisticRecord = { ...existing, ...payload, id: existing?.id || `local_discount_${normalizedCycle}_${Date.now()}` };
            const recordIndex = allRecords.findIndex((record) =>
                record?.type === 'entrada' &&
                record.person === person &&
                record.competence === competencia &&
                record.entry_discount_adjustment === true &&
                normalizeEntryDiscountCycle(record.entry_discount_cycle || record.cycle || '') === normalizedCycle
            );

            if (recordIndex >= 0) {
                allRecords[recordIndex] = optimisticRecord;
            } else {
                allRecords.push(optimisticRecord);
            }

            input.value = '';
            if (observationInput) observationInput.value = '';
            showToast('Desconto adicionado ao histórico!');
            renderCurrentTab();
        };

        async function deleteEntryDiscountAdjustmentByEntry(person = '', competencia = '', cycle = getEntradasCycleFilterValue()) {
            const normalizedCycle = normalizeEntryDiscountCycle(cycle);
            const existing = getEntryDiscountAdjustmentRecord(person, competencia, normalizedCycle);
            if (!existing) {
                showToast('Nenhum desconto para excluir', true);
                return;
            }

            const result = await window.dataSdk.delete(existing);
            if (!result?.isOk) {
                showToast(`Erro ao excluir desconto${result?.error ? `: ${result.error}` : ''}`, true);
                return;
            }

            allRecords = allRecords.filter((record) => record.id !== existing.id);
            showToast('Desconto excluído!');
            renderCurrentTab();
        }

        async function deleteEntryDiscountHistoryItem(person = '', competencia = '', cycle = getEntradasCycleFilterValue(), historyIndex = -1) {
            const normalizedCycle = normalizeEntryDiscountCycle(cycle);
            const existing = getEntryDiscountAdjustmentRecord(person, competencia, normalizedCycle);
            if (!existing) {
                showToast('Nenhum desconto para excluir', true);
                return;
            }

            const history = getEntryDiscountHistoryItems(existing);
            const index = Number(historyIndex);
            if (!Number.isInteger(index) || index < 0) {
                showToast('Item de desconto inválido', true);
                return;
            }

            if (!history.length && index === 0) {
                await deleteEntryDiscountAdjustmentByEntry(person, competencia, normalizedCycle);
                return;
            }

            if (index >= history.length) {
                showToast('Item de desconto não encontrado', true);
                return;
            }

            const nextHistory = history.filter((_, itemIndex) => itemIndex !== index);
            if (!nextHistory.length) {
                await deleteEntryDiscountAdjustmentByEntry(person, competencia, normalizedCycle);
                return;
            }

            const nextAmount = roundCurrency(nextHistory.reduce((sum, item) => sum + (Number(item.amount) || 0), 0));
            const lastHistoryItem = nextHistory[nextHistory.length - 1] || {};
            const updatedRecord = {
                ...existing,
                amount: nextAmount,
                observation: String(lastHistoryItem.observation || existing.observation || '').trim(),
                entry_discount_history: nextHistory,
                updated_at: new Date().toISOString()
            };

            const result = await window.dataSdk.update(updatedRecord);
            if (!result?.isOk) {
                showToast(`Erro ao excluir item${result?.error ? `: ${result.error}` : ''}`, true);
                return;
            }

            const recordIndex = allRecords.findIndex((record) => record.id === existing.id);
            if (recordIndex >= 0) allRecords[recordIndex] = updatedRecord;

            showToast('Item de desconto excluído!');
            renderCurrentTab();
        }

        mapEntradaToCycleView = function (entry, cycleFilter) {
            const isQuinzenal = entry.receivingType === 'quinzenal';
            const quinzenaDiscount = getEntryDiscountRecordTotal(getEntryDiscountAdjustmentRecord(entry.person, entry.competencia, 'QUINZENA') || {});
            const inicioMesDiscount = getEntryDiscountRecordTotal(getEntryDiscountAdjustmentRecord(entry.person, entry.competencia, 'INICIO_MES') || {});

            if (cycleFilter === 'QUINZENA') {
                if (!isQuinzenal) return null;
                const quinzenaValue = roundCurrency(entry.adiantamentoQuinzena || 0);
                return {
                    ...entry,
                    cycleView: 'QUINZENA',
                    cardSalaryBase: quinzenaValue,
                    cardHourExtra: 0,
                    cardOutrosProventos: 0,
                    cardLiquido: roundCurrency(quinzenaValue - quinzenaDiscount),
                    cardDescontos: quinzenaDiscount,
                    cardInss: 0,
                    cardIrrf: 0,
                    cycleDiscountValue: quinzenaDiscount
                };
            }

            return {
                ...entry,
                cycleView: 'INICIO_MES',
                cardSalaryBase: entry.salaryBase,
                cardHourExtra: entry.hourExtra,
                cardOutrosProventos: roundCurrency(entry.outrosProventos || 0),
                cardLiquido: entry.liquido,
                cardDescontos: entry.outrosDescontos,
                cardInss: entry.inss,
                cardIrrf: entry.irrf,
                cycleDiscountValue: inicioMesDiscount
            };
        };

        renderEntradas = function () {
            ensureEntradasCycleFilter();
            const competenceFilter = normalizeCompetenceKey(document.getElementById('entradas-competence-filter')?.value || '');
            const cycleFilter = getEntradasCycleFilterValue();
            const allEntries = getEntradasConsolidadas();
            const entries = allEntries
                .filter((entry) => !competenceFilter || normalizeCompetenceKey(entry.competencia) === competenceFilter)
                .map((entry) => mapEntradaToCycleView(entry, cycleFilter))
                .filter(Boolean);

            const list = document.getElementById('entradas-list');
            const empty = document.getElementById('entradas-empty');
            const meta = document.getElementById('entradas-meta');
            const pagination = document.getElementById('entradas-pagination');
            if (!list || !empty || !meta) return;

            list.innerHTML = entries.map((entry) => {
                const inputId = buildEntryDiscountInputId(entry.person, entry.competencia, entry.cycleView);
                const observationId = buildEntryDiscountObservationId(entry.person, entry.competencia, entry.cycleView);
                const personAttr = escapeHtml(entry.person);
                const competenciaAttr = escapeHtml(entry.competencia);
                const cycleLabel = entry.cycleView === 'QUINZENA' ? 'Quinzena' : 'Início do mês';
                const isQuinzenaView = entry.cycleView === 'QUINZENA';
                const cycleAdjustment = getEntryDiscountAdjustmentRecord(entry.person, entry.competencia, entry.cycleView);
                const currentDiscountTotal = getEntryDiscountRecordTotal(cycleAdjustment || {});
                const currentDiscountItems = getEntryDiscountDisplayItemCount(cycleAdjustment || {});

                return `<div class="glass rounded-2xl p-4 border border-surfaceLight">
                    <div class="flex items-start justify-between gap-3 flex-wrap mb-4">
                        <div>
                            <p class="text-xs uppercase tracking-[0.16em] text-textSecondary">Competência</p>
                            <h3 class="text-lg font-semibold mt-1">${formatCompetence(entry.competencia)} • ${personAttr}</h3>
                            <p class="text-xs text-textSecondary mt-1">${cycleLabel}</p>
                        </div>
                        <button
                            data-entry-action="view"
                            data-person="${personAttr}"
                            data-competencia="${competenciaAttr}"
                            class="px-3 py-1.5 text-xs rounded-lg bg-accent/10 text-accent hover:bg-accent hover:text-white transition-colors"
                        >Visualizar</button>
                    </div>
                    <div class="entry-consolidated-grid">
                        <div class="money-metric-card">
                            <p class="text-xs uppercase tracking-[0.16em] text-textSecondary">${isQuinzenaView ? 'Quinzena (40%)' : 'Salário Base'}</p>
                            <p class="kpi-value text-textPrimary mt-3">${fmt(entry.cardSalaryBase)}</p>
                        </div>
                        <div class="time-metric-card">
                            <p class="text-xs uppercase tracking-[0.16em] text-textSecondary">Hora Extra</p>
                            <p class="kpi-value text-accent mt-3">${fmt(entry.cardHourExtra)}</p>
                        </div>
                        <div class="money-metric-card">
                            <p class="text-xs uppercase tracking-[0.16em] text-textSecondary">Outras receitas</p>
                            <p class="kpi-value text-success mt-3">${fmt(entry.cardOutrosProventos || 0)}</p>
                            <button
                                data-entry-action="view-other-revenues"
                                data-person="${personAttr}"
                                data-competencia="${competenciaAttr}"
                                class="mt-3 px-3 py-1.5 text-xs rounded-lg bg-success/10 text-success hover:bg-success hover:text-bg transition-colors font-semibold"
                            >Ver itens</button>
                        </div>
                        <div class="money-metric-card">
                            <p class="text-xs uppercase tracking-[0.16em] text-textSecondary">${isQuinzenaView ? 'Valor da quinzena' : 'Líquido Final'}</p>
                            <p class="kpi-value text-success mt-3">${fmt(entry.cardLiquido)}</p>
                        </div>
                    </div>
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4 text-xs text-textSecondary">
                        <div class="rounded-xl border border-surfaceLight bg-surfaceLight/30 px-3 py-2">Descontos: <strong class="text-danger">-${fmt(entry.cardDescontos)}</strong></div>
                        <div class="rounded-xl border border-surfaceLight bg-surfaceLight/30 px-3 py-2">INSS: <strong class="text-danger">-${fmt(entry.cardInss)}</strong></div>
                        <div class="rounded-xl border border-surfaceLight bg-surfaceLight/30 px-3 py-2">IRRF: <strong class="text-danger">-${fmt(entry.cardIrrf)}</strong></div>
                    </div>
                    <div class="rounded-xl border border-surfaceLight bg-surfaceLight/20 p-3 mt-4">
                        <div class="flex items-center justify-between gap-3 flex-wrap mb-2">
                            <p class="text-xs uppercase tracking-[0.16em] text-textSecondary">${isQuinzenaView ? 'Descontos da quinzena' : 'Outros descontos'}</p>
                            <p class="text-[11px] text-textSecondary">Total manual salvo: <strong class="text-danger">-${fmt(currentDiscountTotal)}</strong>${currentDiscountItems ? ` • ${currentDiscountItems} item(ns)` : ''}</p>
                        </div>
                        <div class="grid grid-cols-1 lg:grid-cols-[1fr_1.3fr_auto_auto] gap-2">
                            <input id="${inputId}" type="number" step="0.01" min="0" value="" placeholder="Valor a adicionar" class="flex-1 bg-surface border border-surfaceLight rounded-xl px-3 py-2 text-sm text-textPrimary">
                            <input id="${observationId}" type="text" value="" placeholder="Observação do novo desconto" class="bg-surface border border-surfaceLight rounded-xl px-3 py-2 text-sm text-textPrimary">
                            <button
                                data-entry-action="save-discount"
                                data-person="${personAttr}"
                                data-competencia="${competenciaAttr}"
                                data-cycle="${entry.cycleView}"
                                class="px-3 py-2 text-xs rounded-xl bg-danger/10 text-danger hover:bg-danger hover:text-white transition-colors font-semibold"
                            >Salvar desconto</button>
                            <button
                                data-entry-action="view-discount-history"
                                data-person="${personAttr}"
                                data-competencia="${competenciaAttr}"
                                data-cycle="${entry.cycleView}"
                                class="px-3 py-2 text-xs rounded-xl bg-accent/10 text-accent hover:bg-accent hover:text-white transition-colors font-semibold"
                            >Visualizar todos os descontos</button>
                        </div>
                    </div>
                </div>`;
            }).join('');

            list.querySelectorAll('[data-entry-action="view"]').forEach((button) => {
                button.addEventListener('click', () => {
                    openEntryDetailModal(button.dataset.person || '', button.dataset.competencia || '');
                });
            });

            list.querySelectorAll('[data-entry-action="save-discount"]').forEach((button) => {
                button.addEventListener('click', () => {
                    saveEntryDiscountAdjustmentByEntry(button.dataset.person || '', button.dataset.competencia || '', button.dataset.cycle || 'INICIO_MES');
                });
            });

            list.querySelectorAll('[data-entry-action="view-discount-history"]').forEach((button) => {
                button.addEventListener('click', () => {
                    openEntryDiscountHistoryModal(button.dataset.person || '', button.dataset.competencia || '', button.dataset.cycle || 'INICIO_MES');
                });
            });

            list.querySelectorAll('[data-entry-action="view-other-revenues"]').forEach((button) => {
                button.addEventListener('click', () => {
                    openEntryOtherRevenuesModal(button.dataset.person || '', button.dataset.competencia || '');
                });
            });

            meta.textContent = `${entries.length} competência(s) consolidadas${competenceFilter ? ` • ${formatCompetence(competenceFilter)}` : ''} • ${cycleFilter === 'QUINZENA' ? 'Quinzena' : 'Início do mês'}${listSearchFilters.entradas ? ` • busca: ${listSearchFilters.entradas}` : ''}`;
            empty.classList.toggle('hidden', entries.length > 0);
            if (pagination) pagination.classList.add('hidden');
            lucide.createIcons();
        };

        function createEntryDiscountHistoryMetricCardDom(label = '', value = '') {
            if (window.financeUiComponents?.createMetricCard) {
                return window.financeUiComponents.createMetricCard({
                    label,
                    value,
                    valueClassName: 'text-lg font-semibold text-danger mt-1'
                });
            }
            const card = document.createElement('div');
            card.className = 'rounded-xl border border-surfaceLight bg-surfaceLight/30 px-4 py-3';
            const labelEl = document.createElement('p');
            labelEl.className = 'text-xs text-textSecondary';
            labelEl.textContent = label;
            const valueEl = document.createElement('p');
            valueEl.className = 'text-lg font-semibold text-danger mt-1';
            valueEl.textContent = value;
            card.append(labelEl, valueEl);
            return card;
        }

        function createEntryDiscountHistoryDeleteButtonDom(person = '', competencia = '', cycle = 'INICIO_MES', historyIndex = 0) {
            if (window.financeUiComponents?.createActionButton) {
                return window.financeUiComponents.createActionButton({
                    label: 'Excluir',
                    icon: 'trash-2',
                    className: 'inline-flex items-center gap-1 px-2 py-1 text-xs rounded-lg border border-surfaceLight text-textSecondary hover:text-danger hover:border-danger/30 transition-colors',
                    title: 'Excluir este desconto',
                    dataset: {
                        entryDiscountHistoryDelete: 'true',
                        person,
                        competencia,
                        cycle,
                        historyIndex
                    },
                    iconClassName: 'w-3 h-3'
                });
            }
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'inline-flex items-center gap-1 px-2 py-1 text-xs rounded-lg border border-surfaceLight text-textSecondary hover:text-danger hover:border-danger/30 transition-colors';
            button.title = 'Excluir este desconto';
            button.dataset.entryDiscountHistoryDelete = 'true';
            button.dataset.person = person;
            button.dataset.competencia = competencia;
            button.dataset.cycle = cycle;
            button.dataset.historyIndex = String(historyIndex);
            const icon = document.createElement('i');
            icon.setAttribute('data-lucide', 'trash-2');
            icon.className = 'w-3 h-3';
            const label = document.createElement('span');
            label.textContent = 'Excluir';
            button.append(icon, label);
            return button;
        }

        function createEntryDiscountHistoryRecordNodeDom(record = {}, person = '', competencia = '') {
            const recordCycle = normalizeEntryDiscountCycle(record.entry_discount_cycle || record.cycle || '');
            const history = getEntryDiscountHistoryItems(record);
            const displayHistory = history.length
                ? history.map((item, index) => ({ item, index }))
                : (record.entry_discount_adjustment === true
                    ? [{
                        item: {
                            amount: getEntryDiscountRecordTotal(record),
                            observation: record.observation || record.description || '',
                            saved_at: record.updated_at || record.created_at || ''
                        },
                        index: 0
                    }]
                    : []);
            const canDeleteHistoryItems = record.entry_discount_adjustment === true;

            const wrapper = document.createElement('div');
            wrapper.className = 'rounded-xl border border-surfaceLight bg-surfaceLight/30 p-3';

            const header = document.createElement('div');
            header.className = 'flex items-start justify-between gap-3';
            const content = document.createElement('div');
            const title = document.createElement('p');
            title.className = 'text-sm font-semibold text-textPrimary';
            title.textContent = String(record.description || record.subcategory || record.earning_type || 'Desconto');
            const subtitle = document.createElement('p');
            subtitle.className = 'text-xs text-textSecondary mt-1';
            const subtitleParts = [recordCycle === 'QUINZENA' ? 'Quinzena' : 'Inicio do mes'];
            if (record.entry_discount_adjustment) subtitleParts.push('ajuste manual');
            if (record.observation) subtitleParts.push(String(record.observation));
            subtitle.textContent = subtitleParts.join(' • ');
            content.append(title, subtitle);

            const amountWrap = document.createElement('div');
            amountWrap.className = 'flex items-center gap-2';
            const amount = document.createElement('strong');
            amount.className = 'text-danger whitespace-nowrap';
            amount.textContent = `-${fmt(getEntryDiscountRecordTotal(record))}`;
            amountWrap.appendChild(amount);
            header.append(content, amountWrap);
            wrapper.appendChild(header);

            if (displayHistory.length) {
                const historyWrap = document.createElement('div');
                historyWrap.className = 'mt-3 border-t border-surfaceLight pt-3 space-y-2';
                displayHistory.slice().reverse().forEach(({ item, index }) => {
                    const row = document.createElement('div');
                    row.className = 'text-xs text-textSecondary flex items-center justify-between gap-3';

                    const text = document.createElement('span');
                    const parts = [formatEntryDiscountHistoryDate(item.saved_at)];
                    if (item.observation) parts.push(String(item.observation));
                    text.textContent = parts.join(' • ');

                    const right = document.createElement('span');
                    right.className = 'inline-flex items-center gap-2';
                    const itemAmount = document.createElement('span');
                    itemAmount.className = 'text-danger whitespace-nowrap';
                    itemAmount.textContent = `-${fmt(item.amount)}`;
                    right.appendChild(itemAmount);

                    if (canDeleteHistoryItems) {
                        right.appendChild(createEntryDiscountHistoryDeleteButtonDom(person, competencia, recordCycle, index));
                    }

                    row.append(text, right);
                    historyWrap.appendChild(row);
                });
                wrapper.appendChild(historyWrap);
            }

            return wrapper;
        }

        window.openEntryDiscountHistoryModal = function (person = '', competencia = '', cycle = getEntradasCycleFilterValue()) {
            const modal = window.financeUiComponents?.ensureModalShell
                ? window.financeUiComponents.ensureModalShell({
                    id: 'entry-discount-history-modal',
                    titleId: 'entry-discount-history-title',
                    subtitleId: 'entry-discount-history-subtitle',
                    rootClassName: 'hidden fixed inset-0 bg-black/60 flex items-center justify-center z-[320] p-4',
                    panelClassName: 'bg-surface rounded-xl border border-surfaceLight max-w-4xl w-full max-h-[90vh] overflow-y-auto p-5',
                    title: 'Historico de descontos',
                    closeAction: 'entry-discount-history',
                    summaryId: 'entry-discount-history-summary',
                    listId: 'entry-discount-history-list'
                })
                : document.getElementById('entry-discount-history-modal');
            if (!modal) return;

            const closeButton = modal.querySelector('[data-close-entry-discount-history]') || modal.querySelector('[data-close-action="entry-discount-history"]');
            closeButton?.addEventListener('click', () => {
                modal.classList.add('hidden');
            });

            const normalizedCycle = normalizeEntryDiscountCycle(cycle);
            const records = getEntryPeriodDiscountRecords(person, competencia);
            const manualRecords = records.filter((record) => record.entry_discount_adjustment === true);
            const manualCycleRecords = manualRecords.filter((record) => normalizeEntryDiscountCycle(record.entry_discount_cycle || record.cycle || '') === normalizedCycle);
            const total = roundCurrency(records.reduce((sum, record) => sum + getEntryDiscountRecordTotal(record), 0));
            const manualTotal = roundCurrency(manualRecords.reduce((sum, record) => sum + getEntryDiscountRecordTotal(record), 0));
            const cycleTotal = roundCurrency(manualCycleRecords.reduce((sum, record) => sum + getEntryDiscountRecordTotal(record), 0));
            const title = document.getElementById('entry-discount-history-modal-title') || document.getElementById('entry-discount-history-title');
            const subtitle = document.getElementById('entry-discount-history-modal-subtitle') || document.getElementById('entry-discount-history-subtitle');
            const summary = document.getElementById('entry-discount-history-summary');
            const list = document.getElementById('entry-discount-history-list');

            if (title) title.textContent = 'Historico de descontos';
            if (subtitle) subtitle.textContent = `${person} • ${formatCompetence(competencia)} • ${normalizedCycle === 'QUINZENA' ? 'Quinzena' : 'Inicio do mes'}`;
            if (summary) {
                summary.replaceChildren(
                    createEntryDiscountHistoryMetricCardDom('Total do periodo', `-${fmt(total)}`),
                    createEntryDiscountHistoryMetricCardDom('Ajustes manuais', `-${fmt(manualTotal)}`),
                    createEntryDiscountHistoryMetricCardDom('Ciclo atual', `-${fmt(cycleTotal)}`)
                );
            }

            if (list) {
                const nodes = records.map((record) => createEntryDiscountHistoryRecordNodeDom(record, person, competencia)).filter(Boolean);
                if (nodes.length) {
                    list.replaceChildren(...nodes);
                } else {
                    const empty = document.createElement('p');
                    empty.className = 'text-sm text-textSecondary text-center py-6';
                    empty.textContent = 'Nenhum desconto encontrado para este periodo.';
                    list.replaceChildren(empty);
                }

                list.querySelectorAll('[data-entry-discount-history-delete]').forEach((button) => {
                    button.addEventListener('click', async () => {
                        const deletePerson = button.dataset.person || '';
                        const deleteCompetencia = button.dataset.competencia || '';
                        const deleteCycle = button.dataset.cycle || 'INICIO_MES';
                        const historyIndex = Number(button.dataset.historyIndex);
                        await deleteEntryDiscountHistoryItem(deletePerson, deleteCompetencia, deleteCycle, historyIndex);
                        openEntryDiscountHistoryModal(deletePerson, deleteCompetencia, deleteCycle);
                    });
                });
            }

            modal.classList.remove('hidden');
            lucide.createIcons();
        };
