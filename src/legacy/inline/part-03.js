// ============ STATE ============
        window.financeState?.installAppStateGlobals?.(window);
        let deleteTarget = null;
        let deletePerson = null;
        let deleteMacro = null;
        let tabHistory = [];
        let editingCategoryId = null;
        let selectedDashboardMonth = '';
        let monthlyDetailRenderToken = 0;
        let formCycle = '';
        let dashboardDetailContext = null;
        let dashboardDetailEditPending = false;
        let dashboardDetailReopenAfterDataChange = false;
        const MAX_TRANSACTION_RECORDS = 20000;
        const MAX_PEOPLE_RECORDS = 200;
        const MAX_MACRO_RECORDS = 200;
        const LIST_PAGE_SIZE = 25;
        const USER_RECORDS_CACHE_PREFIX = 'finance-control-user-records-cache-v1-';
        const USER_RECORDS_ACTIVE_CACHE_KEY = 'finance-control-user-records-cache-active-v1';
        const listArchiveFilters = { saidas: 'active', entradas: 'active' };
        const listPagination = { saidas: LIST_PAGE_SIZE, entradas: LIST_PAGE_SIZE };
        const listDetailFilters = { saidas: '', entradas: '' };
        const listPaymentFilters = { saidas: '' };
        const listPersonFilters = { saidas: '' };
        const listCycleFilters = { saidas: '' };
        const listMacroFilters = { saidas: '' };
        const listDateFilters = { saidas: { start: '', end: '' } };
        const listSearchFilters = { saidas: '', entradas: '' };
        let lastImportReport = null;
        let lastEntradasImportReport = null;
        let bulkOperationState = null;
        let deferredSnapshotData = null;
        let overtimeTypes = [];
        let editingOvertimeTypeId = null;
        let selectedSalaryHistoryPersonId = null;
        let selectedHourGroupKey = '';
        let selectedEntryDetailKey = '';

        const defaultConfig = {
            app_title: 'Controle Financeiro',
            background_color: '#0b1120',
            surface_color: '#1e293b',
            text_color: '#e2e8f0',
            accent_color: '#38bdf8',
            secondary_action_color: '#94a3b8',
            font_family: 'Segoe UI',
            font_size: 14
        };
        const OVERTIME_TYPES_STORAGE_KEY = 'finance-control-overtime-types-v1';

        function getHourExtraRecordDefaults() {
            return {
                nomeTipo: '',
                percentualUsado: 0,
                valorHoraCalculado: 0,
                valorTotalCalculado: 0,
                quantidadeHoras: 0,
                quantidadeHorasFormatada: '',
                valorBaseHora: 0,
                salary_base_reference: 0,
                monthly_hours_reference: 220,
                tipoFinanceiroUsado: false,
                horaInicial: '',
                horaFinal: ''
            };
        }

        function normalizeOvertimeType(item) {
            return {
                id: item.id || `he_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
                name: String(item.name || '').trim(),
                percentage: Number(item.percentage) || 0,
                financialType: Boolean(item.financialType),
                active: item.active !== false,
                createdAt: item.createdAt || new Date().toISOString(),
                updatedAt: item.updatedAt || new Date().toISOString()
            };
        }

        function loadOvertimeTypes() {
            try {
                const raw = localStorage.getItem(OVERTIME_TYPES_STORAGE_KEY);
                const parsed = raw ? JSON.parse(raw) : [];
                overtimeTypes = Array.isArray(parsed) ? parsed.map(normalizeOvertimeType) : [];
            } catch (error) {
                console.error('Erro ao carregar tipos de H.E.', error);
                overtimeTypes = [];
            }
        }

        function persistOvertimeTypes() {
            localStorage.setItem(OVERTIME_TYPES_STORAGE_KEY, JSON.stringify(overtimeTypes));
        }

        function getActiveOvertimeTypes() {
            return overtimeTypes
                .filter((item) => item.active)
                .sort((a, b) => a.name.localeCompare(b.name));
        }

        function findOvertimeTypeById(id) {
            return overtimeTypes.find((item) => item.id === id) || null;
        }

        loadOvertimeTypes();

        // ============ ELEMENT SDK ============
        if (window.elementSdk) {
            window.elementSdk.init({
                defaultConfig,
                onConfigChange: async (config) => {
                    const c = { ...defaultConfig, ...config };
                    document.getElementById('app-title').textContent = c.app_title;
                },
                mapToCapabilities: (config) => {
                    const c = { ...defaultConfig, ...config };
                    const mk = (key) => ({
                        get: () => c[key] || defaultConfig[key],
                        set: (v) => { c[key] = v; window.elementSdk.setConfig({ [key]: v }); }
                    });
                    return {
                        recolorables: [mk('background_color'), mk('surface_color'), mk('text_color'), mk('accent_color')],
                        borderables: [],
                        fontEditable: mk('font_family'),
                        fontSizeable: { get: () => c.font_size || defaultConfig.font_size, set: (v) => { c.font_size = v; window.elementSdk.setConfig({ font_size: v }); } }
                    };
                },
                mapToEditPanelValues: (config) => {
                    const c = { ...defaultConfig, ...config };
                    return new Map([['app_title', c.app_title || defaultConfig.app_title]]);
                }
            });
        }

        // ============ DATA SDK ============
        const dataHandler = {
            onDataChanged(data) {
                allRecords = data;
                window.__financeDataVersion = (window.__financeDataVersion || 0) + 1;
                if (bulkOperationState?.suspendLiveRender) {
                    deferredSnapshotData = data;
                    return;
                }
                renderAll();
                refreshDashboardDetailAfterDataChange();
            }
        };

        function beginBulkOperation(type, total = 0) {
            bulkOperationState = {
                type,
                total,
                processed: 0,
                suspendLiveRender: true
            };
            deferredSnapshotData = null;
        }

        function updateBulkOperation(processed) {
            if (!bulkOperationState) return;
            bulkOperationState.processed = processed;
        }

        function flushDeferredSnapshot() {
            if (deferredSnapshotData) {
                allRecords = deferredSnapshotData;
                window.__financeDataVersion = (window.__financeDataVersion || 0) + 1;
                deferredSnapshotData = null;
                renderAll();
            }
        }

        function endBulkOperation() {
            if (!bulkOperationState) return;
            bulkOperationState = null;
            flushDeferredSnapshot();
        }

        async function yieldToUi() {
            await new Promise((resolve) => setTimeout(resolve, 0));
        }

        function chunkArray(items, size = 50) {
            const chunks = [];
            for (let index = 0; index < items.length; index += size) {
                chunks.push(items.slice(index, index + size));
            }
            return chunks;
        }

        async function initSdk() {
            const r = await window.dataSdk.init(dataHandler);
            if (!r.isOk) console.error('Data SDK init failed');
        }

        if (!window.dataSdk) {
            window.addEventListener('firebasePronto', () => {
                if (window.authSdk?.getCurrentUser?.()) initSdk();
            }, { once: true });
        }

        // ============ SIDEBAR / TAB SWITCHING ============
        let isSidebarOpen = false;

        function toggleSidebar() {
            isSidebarOpen = window.financeApp.financeUiAdapters.toggleSidebar(isSidebarOpen);
        }

        function updateBackButton() {
            window.financeApp.financeUiAdapters.updateBackButton(tabHistory.length > 0);
        }

        function switchTab(tab, options = {}) {
            const { fromHistory = false, skipRender = false } = options;
            if (!fromHistory && currentTab && currentTab !== tab) {
                tabHistory.push(currentTab);
            }
            currentTab = tab;
            window.financeApp.financeUiAdapters.activateTab(tab);
            updateBackButton();
            if (!skipRender) renderCurrentTab();
            if (isSidebarOpen) toggleSidebar();
        }
        window.switchTab = switchTab;

        function goBackTab() {
            while (tabHistory.length) {
                const previousTab = tabHistory.pop();
                if (previousTab && previousTab !== currentTab) {
                    switchTab(previousTab, { fromHistory: true });
                    return;
                }
            }
            switchTab('dashboard', { fromHistory: true });
        }

        function openNewRecordFlow(type = 'saida') {
            cancelRecordEditing(true);
            switchTab('novo');
            resetRecordForm(type);
            if (type === 'entrada') {
                document.getElementById('form-earning-amount')?.focus();
            } else {
                document.getElementById('form-desc')?.focus();
            }
        }

        function goToDashboardHome() {
            focusedDashboardCard = null;
            switchTab('dashboard');
            const mainContent = document.getElementById('main-content');
            if (mainContent) mainContent.scrollTo({ top: 0, behavior: 'smooth' });
        }

        function toggleAdvancedFilters(forceOpen = null) {
            const panel = document.getElementById('advanced-filters-panel');
            const button = document.getElementById('btn-advanced-filters');
            if (!panel || !button) return;
            const shouldOpen = forceOpen === null ? panel.classList.contains('hidden') : forceOpen;
            panel.classList.toggle('hidden', !shouldOpen);
            button.className = shouldOpen
                ? 'text-xs bg-accent/10 hover:bg-accent hover:text-white px-3 py-2 rounded-lg text-accent flex items-center gap-1 transition-colors font-medium'
                : 'text-xs bg-surfaceLight hover:bg-surfaceLight/80 px-3 py-2 rounded-lg text-textSecondary hover:text-textPrimary flex items-center gap-1 transition-colors font-medium';
        }

        // ============ FORM HELPERS ============
        function toggleFormFields() {
            const t = document.getElementById('form-type').value;
            document.getElementById('saida-fields').classList.toggle('hidden', t !== 'saida');
            document.getElementById('entrada-fields').classList.toggle('hidden', t !== 'entrada');
            handleEarningTypeChange();
        }

        function setFormCycle(value) {
            formCycle = value;
            const isInicioMes = value === 'INICIO_MES';
            const isQuinzena = value === 'QUINZENA';
            const selected = 'px-3 py-2 rounded-full text-sm font-medium transition-colors bg-accent text-white';
            const idle = 'px-3 py-2 rounded-full text-sm font-medium transition-colors bg-transparent text-textSecondary hover:bg-surfaceLight';
            const inicioButtons = ['cycle-saida-inicio-mes', 'cycle-entrada-inicio-mes'];
            const quinzenaButtons = ['cycle-saida-quinzena', 'cycle-entrada-quinzena'];
            inicioButtons.forEach((id) => {
                const button = document.getElementById(id);
                if (button) button.className = isInicioMes ? selected : idle;
            });
            quinzenaButtons.forEach((id) => {
                const button = document.getElementById(id);
                if (button) button.className = isQuinzena ? selected : idle;
            });
        }

        function togglePaidAt() {
            document.getElementById('paid-at-wrap').classList.toggle('hidden', document.getElementById('form-status').value !== 'Pago');
        }

        function toggleInstallments() {
            const check = document.getElementById('form-installment-check');
            const expenseType = document.getElementById('form-expense-type');
            const fields = document.getElementById('installment-fields');
            if (fields) {
                const isInstallment = expenseType
                    ? expenseType.value === 'parcelada'
                    : Boolean(check?.checked);
                fields.classList.toggle('hidden', !isInstallment);
            }
            calculateInstallmentValue();
        }

        function toggleExpenseType() {
            const expenseType = document.getElementById('form-expense-type')?.value;
            const installmentFields = document.getElementById('installment-fields');
            if (installmentFields) {
                installmentFields.classList.toggle('hidden', expenseType !== 'parcelada');
            }
            if (expenseType === 'parcelada') {
                const recurrence = document.getElementById('form-recurrence');
                if (recurrence) recurrence.value = '';
            }
            calculateInstallmentValue();
            toggleRecurrenceFields();
        }

        function calculateInstallmentValue() {
            const total = Number(document.getElementById('form-amount')?.value) || 0;
            const count = Number(document.getElementById('form-installments')?.value) || 1;
            const installmentValueField = document.getElementById('form-installment-value');
            if (installmentValueField) {
                const preview = window.financeRecordPayloadBuilders?.createInstallmentSeries?.({
                    totalAmount: total,
                    totalInstallments: count,
                    firstDueDate: document.getElementById('form-due')?.value || today,
                    description: document.getElementById('form-desc')?.value || ''
                }, {
                    idFactory: () => 'preview'
                });
                const lastAmount = preview?.installments?.[preview.installments.length - 1]?.amount;
                installmentValueField.value = Number.isFinite(lastAmount) ? Number(lastAmount).toFixed(2) : '0.00';
            }
        }

        const formatPreviewCurrency = function(value = 0) {
            return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        };

        const recurrenceFrequencyLabel = function(value = '') {
            if (value === 'mensal' || value === 'monthly') return 'Mensal';
            if (value === 'anual' || value === 'yearly') return 'Anual';
            return '-';
        };

        const updateRecurrencePreview = function() {
            const recurrence = document.getElementById('form-recurrence')?.value || '';
            const frequencyEl = document.getElementById('recurrence-preview-frequency');
            const countEl = document.getElementById('recurrence-preview-count');
            const firstEl = document.getElementById('recurrence-preview-first');
            const lastEl = document.getElementById('recurrence-preview-last');
            const totalEl = document.getElementById('recurrence-preview-total');
            const reset = () => {
                if (frequencyEl) frequencyEl.textContent = '-';
                if (countEl) countEl.textContent = '-';
                if (firstEl) firstEl.textContent = '-';
                if (lastEl) lastEl.textContent = '-';
                if (totalEl) totalEl.textContent = 'R$ 0,00';
            };
            if (!recurrence) {
                reset();
                return null;
            }

            const termination = document.getElementById('form-recurrence-termination')?.value || 'count';
            const input = {
                amount: Number(document.getElementById('form-amount')?.value) || 0,
                recurrence,
                frequency: recurrence,
                firstDueDate: document.getElementById('form-due')?.value || today,
                recurrence_count: termination === 'count' ? Number(document.getElementById('form-recurrence-count')?.value) || 0 : 0,
                recurrence_end_date: termination === 'end_date' ? document.getElementById('form-recurrence-end-date')?.value || '' : '',
                status: document.getElementById('form-status')?.value || 'Em aberto'
            };
            const preview = window.financeRecordPayloadBuilders?.createRecurrenceSeries?.(input, {
                idFactory: () => 'preview'
            });
            if (!preview?.isValid) {
                reset();
                if (frequencyEl) frequencyEl.textContent = recurrenceFrequencyLabel(recurrence);
                return preview;
            }
            if (frequencyEl) frequencyEl.textContent = recurrenceFrequencyLabel(recurrence);
            if (countEl) countEl.textContent = String(preview.totalOccurrences);
            if (firstEl) firstEl.textContent = preview.firstDate || '-';
            if (lastEl) lastEl.textContent = preview.lastDate || '-';
            if (totalEl) totalEl.textContent = formatPreviewCurrency(preview.preview?.projectedTotal || 0);
            return preview;
        };

        const toggleRecurrenceFields = function() {
            const recurrence = document.getElementById('form-recurrence')?.value || '';
            const fields = document.getElementById('recurrence-fields');
            const termination = document.getElementById('form-recurrence-termination')?.value || 'count';
            const countWrap = document.getElementById('recurrence-count-wrap');
            const endDateWrap = document.getElementById('recurrence-end-date-wrap');
            const scopeFields = document.getElementById('recurrence-scope-fields');
            const editingRecord = getEditingRecord();
            if (fields) fields.classList.toggle('hidden', !recurrence);
            if (countWrap) countWrap.classList.toggle('hidden', termination !== 'count');
            if (endDateWrap) endDateWrap.classList.toggle('hidden', termination !== 'end_date');
            if (scopeFields) scopeFields.classList.toggle('hidden', !(editingRecord && recurrence));
            updateRecurrencePreview();
        };

        function getEditingRecord() {
            return allRecords.find((record) => record.id === editingRecordId) || null;
        }

        function updateFormModeUi() {
            const isEditing = Boolean(editingRecordId);
            const heading = document.getElementById('form-heading');
            const hint = document.getElementById('form-editing-hint');
            const cancel = document.getElementById('btn-cancel-edit');
            const btn = document.getElementById('btn-submit');

            if (heading) heading.textContent = isEditing ? 'Editar Lançamento' : 'Novo Lançamento';
            if (hint) hint.classList.toggle('hidden', !isEditing);
            if (cancel) cancel.classList.toggle('hidden', !isEditing);
            if (btn && !btn.disabled) {
                btn.innerHTML = `<i data-lucide="save" class="w-4 h-4"></i> ${isEditing ? 'Salvar Alterações' : 'Salvar Lançamento'}`;
            }
            lucide.createIcons();
        }

        function resetRecordForm(type = 'saida') {
            document.getElementById('form-type').value = type;
            toggleFormFields();

            document.getElementById('form-person').selectedIndex = 0;
            document.getElementById('form-payment').value = '';
            document.getElementById('form-desc').value = '';
            document.getElementById('form-amount').value = '';
            document.getElementById('form-status').value = 'Em aberto';
            document.getElementById('form-occurred').value = today;
            document.getElementById('form-due').value = '';
            document.getElementById('form-paid-at').value = '';
            document.getElementById('form-competence').value = thisMonth;
            document.getElementById('form-macro').value = '';
            updateCategoryOptions();
            document.getElementById('form-category').value = '';
            
            const check = document.getElementById('form-installment-check');
            if (check) check.checked = false;
            
            const expenseType = document.getElementById('form-expense-type');
            if (expenseType) expenseType.value = 'a_vista';
            
            const installments = document.getElementById('form-installments');
            if (installments) installments.value = 2;
            
            const totalAmount = document.getElementById('form-total-amount');
            if (totalAmount) totalAmount.value = '';
            
            const installmentValue = document.getElementById('form-installment-value');
            if (installmentValue) installmentValue.value = '';
            
            const card = document.getElementById('form-card');
            if (card) card.value = '';
            
            const recurrence = document.getElementById('form-recurrence');
            if (recurrence) recurrence.value = '';
            const recurrenceTermination = document.getElementById('form-recurrence-termination');
            if (recurrenceTermination) recurrenceTermination.value = 'count';
            const recurrenceCount = document.getElementById('form-recurrence-count');
            if (recurrenceCount) recurrenceCount.value = 1;
            const recurrenceEndDate = document.getElementById('form-recurrence-end-date');
            if (recurrenceEndDate) recurrenceEndDate.value = '';
            const recurrenceEditScope = document.getElementById('form-recurrence-edit-scope');
            if (recurrenceEditScope) recurrenceEditScope.value = 'only_this';
            const recurrenceDeleteScope = document.getElementById('form-recurrence-delete-scope');
            if (recurrenceDeleteScope) recurrenceDeleteScope.value = 'only_this';
            
            toggleInstallments();
            toggleExpenseType();
            toggleRecurrenceFields();
            togglePaidAt();

            document.getElementById('form-earning-type').value = 'Salário';
            document.getElementById('form-earning-desc').value = '';
            document.getElementById('form-earning-amount').value = '';
            document.getElementById('form-earning-comp').value = thisMonth;
            clearHourExtraForm(true);
            setFormCycle('');
            handleEarningTypeChange();
            syncPersonSalaryDefaults();
            updateFormModeUi();
        }

        function cancelRecordEditing(skipReset = false) {
            editingRecordId = null;
            dashboardDetailEditPending = false;
            dashboardDetailReopenAfterDataChange = false;
            if (skipReset) {
                updateFormModeUi();
                return;
            }
            resetRecordForm(document.getElementById('form-type')?.value || 'saida');
        }

        function openEditRecord(record) {
            if (!record || !isTransactionRecord(record)) return;

            if (isDashboardExpenseDetailVisible()) {
                dashboardDetailEditPending = true;
                document.getElementById('dashboard-expense-category-modal')?.classList.add('hidden');
            }
            editingRecordId = record.id || null;
            switchTab('novo');
            document.getElementById('form-type').value = record.type;
            toggleFormFields();
            document.getElementById('form-person').value = record.person || '';

            if (record.type === 'entrada') {
                document.getElementById('form-earning-type').value = record.earning_type || 'Salário';
                document.getElementById('form-earning-desc').value = record.description || '';
                document.getElementById('form-earning-comp').value = record.competence || thisMonth;
                clearHourExtraForm(false);
                setFormCycle(record.cycle || '');
                handleEarningTypeChange();

                if (record.earning_type === 'Hora Extra') {
                    const matchedType = overtimeTypes.find((item) => item.name === record.nomeTipo) || null;
                    syncOvertimeTypeOptions();
                    document.getElementById('form-he-type').value = matchedType?.id || '';
                    document.getElementById('form-he-start-time').value = record.horaInicial || '';
                    document.getElementById('form-he-end-time').value = record.horaFinal || '';
                    document.getElementById('form-he-hours').value = record.quantidadeHoras || '';
                    document.getElementById('form-he-hours-formatted').value = record.quantidadeHorasFormatada || '';
                    document.getElementById('form-he-base-salary').value = record.salary_base_reference || getPersonBaseSalary(record.person || '');
                    document.getElementById('form-he-monthly-hours').value = record.monthly_hours_reference || 220;
                    document.getElementById('form-he-base-hour').value = record.valorBaseHora || '';
                    document.getElementById('form-he-percentage').value = record.percentualUsado || '';
                    document.getElementById('form-he-hour-value').value = record.valorHoraCalculado ? Number(record.valorHoraCalculado).toFixed(2) : '';
                    document.getElementById('form-he-total-value').value = record.valorTotalCalculado ? Number(record.valorTotalCalculado).toFixed(2) : '';
                    document.getElementById('form-earning-amount').value = Number(record.amount || 0).toFixed(2);
                    handleOvertimeTypeSelect();
                } else {
                    document.getElementById('form-earning-amount').readOnly = false;
                    document.getElementById('form-earning-amount').value = record.amount ?? '';
                    syncPersonSalaryDefaults();
                }
            } else {
                document.getElementById('form-macro').value = record.macro_category || '';
                updateCategoryOptions();
                document.getElementById('form-category').value = record.subcategory || '';
                document.getElementById('form-desc').value = record.description || '';
                document.getElementById('form-amount').value = record.amount ?? '';
                document.getElementById('form-status').value = record.status || 'Em aberto';
                document.getElementById('form-payment').value = record.payment_method || '';
                document.getElementById('form-occurred').value = record.occurred_date || '';
                document.getElementById('form-due').value = record.due_date || '';
                document.getElementById('form-paid-at').value = record.paid_at || '';
                document.getElementById('form-competence').value = record.competence || '';
                const installmentCheck = document.getElementById('form-installment-check');
                if (installmentCheck) installmentCheck.checked = false;
                const expenseType = document.getElementById('form-expense-type');
                if (expenseType) expenseType.value = Number(record.total_installments || 0) > 0 ? 'parcelada' : 'a_vista';
                const recurrenceValue = record.recurrence || (record.recurrence_frequency === 'monthly' ? 'mensal' : (record.recurrence_frequency === 'yearly' ? 'anual' : ''));
                document.getElementById('form-recurrence').value = recurrenceValue;
                const recurrenceTermination = document.getElementById('form-recurrence-termination');
                const recurrenceCount = document.getElementById('form-recurrence-count');
                const recurrenceEndDate = document.getElementById('form-recurrence-end-date');
                if (recurrenceTermination) recurrenceTermination.value = record.recurrence_end_date ? 'end_date' : 'count';
                if (recurrenceCount) recurrenceCount.value = record.recurrence_total_occurrences || record.recurrence_count || 1;
                if (recurrenceEndDate) recurrenceEndDate.value = record.recurrence_end_date || '';
                const totalAmount = document.getElementById('form-total-amount');
                if (totalAmount) totalAmount.value = '';
                setFormCycle(record.cycle || '');
                toggleInstallments();
                toggleRecurrenceFields();
                togglePaidAt();
            }

            updateFormModeUi();
        }

        function updateCategoryOptions() {
            const input = document.getElementById('form-category');
            const list = document.getElementById('form-category-options');
            const categories = [...new Set(
                allRecords
                    .filter((record) => record.type === 'categoria')
                    .map((record) => String(record.category_name || '').trim())
                    .filter(Boolean)
            )].sort((a, b) => a.localeCompare(b, 'pt-BR'));

            if (list) {
                list.innerHTML = categories.map((category) => `<option value="${escapeHtml(category)}"></option>`).join('');
            }

            if (input) {
                input.placeholder = 'Selecione ou digite uma categoria';
            }
        }

        async function ensureSharedCategoryExists(macro, categoryName) {
            const normalizedMacro = String(macro || '').trim();
            const normalizedCategory = String(categoryName || '').trim();
            if (!normalizedMacro || !normalizedCategory) return;

            const exists = allRecords.some((record) =>
                record.type === 'categoria' &&
                String(record.macro_category || '').trim().toLowerCase() === normalizedMacro.toLowerCase() &&
                String(record.category_name || '').trim().toLowerCase() === normalizedCategory.toLowerCase()
            );

            if (exists) return;

            await window.dataSdk.create({
                type: 'categoria',
                person: '',
                macro_category: normalizedMacro,
                subcategory: '',
                description: '',
                amount: 0,
                status: '',
                payment_method: '',
                occurred_date: '',
                due_date: '',
                competence: '',
                paid_at: '',
                installment_no: 0,
                total_installments: 0,
                parent_id: '',
                earning_type: '',
                recurrence: '',
                created_at: new Date().toISOString(),
                category_id: 'cat_' + Date.now(),
                category_name: normalizedCategory,
                category_color: '#38bdf8',
                category_icon: 'tag',
                ...getHourExtraRecordDefaults()
            });
        }

        function syncOvertimeTypeOptions() {
            const select = document.getElementById('form-he-type');
            const emptyState = document.getElementById('hour-extra-empty-state');
            if (!select || !emptyState) return;

            const currentValue = select.value;
            const activeTypes = getActiveOvertimeTypes();
            const options = ['<option value="">Selecione um tipo ativo</option>']
                .concat(activeTypes.map((item) => `<option value="${item.id}" ${item.id === currentValue ? 'selected' : ''}>${escapeHtml(item.name)}${item.financialType ? '' : ' • Banco de Horas'}</option>`));
            select.innerHTML = options.join('');
            if (!activeTypes.some((item) => item.id === currentValue)) {
                select.value = '';
            }
            emptyState.classList.toggle('hidden', activeTypes.length > 0);
        }

        function clearHourExtraForm(resetAmount = false) {
            const fields = ['form-he-type', 'form-he-start-time', 'form-he-end-time', 'form-he-hours', 'form-he-hours-formatted', 'form-he-base-hour', 'form-he-base-salary', 'form-he-monthly-hours', 'form-he-percentage', 'form-he-hour-value', 'form-he-total-value'];
            fields.forEach((id) => {
                const el = document.getElementById(id);
                if (el) el.value = '';
            });
            const amountField = document.getElementById('form-earning-amount');
            if (amountField) {
                amountField.readOnly = false;
                if (resetAmount) amountField.value = '';
            }
            const badge = document.getElementById('hour-extra-mode-badge');
            if (badge) {
                badge.textContent = 'Financeiro';
                badge.className = 'px-2 py-1 rounded-full text-[11px] font-semibold bg-accent/10 text-accent';
            }
        }

        function isHourExtraEarningType() {
            return document.getElementById('form-earning-type')?.value === 'Hora Extra';
        }

        function handleEarningTypeChange() {
            const isHourExtra = isHourExtraEarningType();
            const heWrap = document.getElementById('hour-extra-fields');
            const amountField = document.getElementById('form-earning-amount');
            if (heWrap) heWrap.classList.toggle('hidden', !isHourExtra);
            if (!isHourExtra) {
                const hadHourExtraData = Boolean(
                    document.getElementById('form-he-type')?.value ||
                    document.getElementById('form-he-hours')?.value ||
                    document.getElementById('form-he-base-hour')?.value
                );
                clearHourExtraForm(hadHourExtraData);
                if (amountField) amountField.readOnly = false;
                return;
            }
            syncOvertimeTypeOptions();
            if (amountField) amountField.readOnly = true;
            syncPersonSalaryDefaults();
            handleOvertimeTypeSelect();
        }

        function handleOvertimeTypeSelect() {
            const type = findOvertimeTypeById(document.getElementById('form-he-type')?.value);
            const percentageField = document.getElementById('form-he-percentage');
            const badge = document.getElementById('hour-extra-mode-badge');
            if (percentageField) percentageField.value = type ? String(type.percentage) : '';
            if (badge) {
                const isFinancial = Boolean(type?.financialType);
                badge.textContent = type ? (isFinancial ? 'Financeiro' : 'Banco de Horas') : 'Seleção pendente';
                badge.className = `px-2 py-1 rounded-full text-[11px] font-semibold ${isFinancial ? 'bg-accent/10 text-accent' : 'bg-warn/10 text-warn'}`;
            }
            recalculateHourExtraValues();
        }

        function recalculateHourExtraValues() {
            const type = findOvertimeTypeById(document.getElementById('form-he-type')?.value);
            const startTime = document.getElementById('form-he-start-time')?.value || '';
            const endTime = document.getElementById('form-he-end-time')?.value || '';
            const startMinutes = parseTimeToMinutes(startTime);
            const endMinutes = parseTimeToMinutes(endTime);
            const intervalHours = startMinutes !== null && endMinutes !== null && endMinutes > startMinutes
                ? roundCurrency((endMinutes - startMinutes) / 60)
                : 0;
            const fallbackHours = Number(document.getElementById('form-he-hours')?.value) || 0;
            const hours = intervalHours || fallbackHours;
            const baseSalary = Number(document.getElementById('form-he-base-salary')?.value) || 0;
            const monthlyHours = getHourExtraMonthlyHours();
            const baseHour = monthlyHours > 0 ? roundCurrency(baseSalary / monthlyHours) : 0;
            const percentage = Number(type?.percentage) || 0;
            const hourValue = roundCurrency(baseHour * percentage);
            const totalValue = roundCurrency(hours * hourValue);
            const amountField = document.getElementById('form-earning-amount');

            if (intervalHours && document.getElementById('form-he-hours')) {
                document.getElementById('form-he-hours').value = intervalHours.toFixed(2);
            }
            document.getElementById('form-he-base-hour').value = baseHour ? baseHour.toFixed(2) : '';
            document.getElementById('form-he-percentage').value = type ? String(percentage) : '';
            document.getElementById('form-he-hours-formatted').value = hours ? formatHoursDecimal(hours) : '';
            document.getElementById('form-he-hour-value').value = hourValue ? hourValue.toFixed(2) : '';
            document.getElementById('form-he-total-value').value = totalValue ? totalValue.toFixed(2) : '';

            if (amountField) {
                amountField.readOnly = isHourExtraEarningType();
                amountField.value = type
                    ? ((type.financialType ? totalValue : 0).toFixed(2))
                    : '';
            }
        }

        function suggestCompetence() {
            const due = document.getElementById('form-due').value;
            const occ = document.getElementById('form-occurred').value;
            const base = due || occ;
            if (base) {
                const d = new Date(base + 'T00:00:00');
                const m = String(d.getMonth() + 1).padStart(2, '0');
                document.getElementById('form-competence').value = d.getFullYear() + '-' + m;
            }
        }
        document.getElementById('form-due')?.addEventListener('change', suggestCompetence);
        document.getElementById('form-occurred')?.addEventListener('change', suggestCompetence);
        document.getElementById('form-due')?.addEventListener('change', updateRecurrencePreview);
        document.getElementById('form-amount')?.addEventListener('input', () => {
            calculateInstallmentValue();
            updateRecurrencePreview();
        });
        document.getElementById('form-recurrence')?.addEventListener('change', toggleRecurrenceFields);
        document.getElementById('form-recurrence-termination')?.addEventListener('change', toggleRecurrenceFields);
        document.getElementById('form-recurrence-count')?.addEventListener('input', updateRecurrencePreview);
        document.getElementById('form-recurrence-end-date')?.addEventListener('change', updateRecurrencePreview);
        document.getElementById('form-status')?.addEventListener('change', updateRecurrencePreview);

        const today = new Date().toISOString().slice(0, 10);
        const thisMonth = today.slice(0, 7);
        document.getElementById('form-occurred').value = today;
        document.getElementById('form-competence').value = thisMonth;
        document.getElementById('form-earning-comp').value = thisMonth;
        setFormCycle('');
        toggleRecurrenceFields();
        updateFormModeUi();
        applyTheme(currentTheme, { rerender: false });
        hydrateDashboardFromWarmCache();

        // ============ SUBMIT ============
        async function handleSubmit(e) {
            e.preventDefault();
            const btn = document.getElementById('btn-submit');
            if (btn.dataset.saving === 'true') return;
            btn.dataset.saving = 'true';
            btn.disabled = true;
            btn.innerHTML = '<span class="animate-spin inline-block w-4 h-4 border-2 border-bg border-t-transparent rounded-full"></span> Salvando...';

            try {
                const formType = document.getElementById('form-type').value;
                const editingRecord = getEditingRecord();
                const financialCrud = window.financeApp?.financialCrud;
                const clearMutationAttempt = () => {
                    btn.__financeMutationAttempt = null;
                    financialCrud?.attemptStore?.clear?.('entry-form');
                };

                if (formType === 'entrada') {
                    const entradaValues = window.financeRecordFormReader.readEntradaFormValues(document, {
                        formCycle,
                        getHourExtraRecordDefaults,
                        findOvertimeTypeById,
                        formatHoursDecimal,
                        roundCurrency
                    });
                    const entradaValidationError = window.financeRecordFormValidation.validateEntradaForm(entradaValues, { parseTimeToMinutes });
                    if (entradaValidationError) { showToast(entradaValidationError, true); return; }

                    const entradaClassification = window.financeRecordPayloadBuilders.resolveEntradaClassification(entradaValues.earningType, entradaValues.hourExtraSnapshot);
                    const isHourBank = entradaClassification.isHourBank;

                    if (!editingRecord && !hasTransactionCapacity()) { showToast(`Limite de ${MAX_TRANSACTION_RECORDS} lancamentos atingido!`, true); return; }

                    const payload = window.financeRecordPayloadBuilders.buildEntradaPayload({
                        ...entradaValues.payloadInput,
                        editingRecord,
                        hourExtraSnapshot: entradaValues.hourExtraSnapshot
                    });
                    let result;
                    if (editingRecord) {
                        result = await window.financeRecordMutations.updateRecord(window.financeRecordPayloadBuilders.buildEditedEntradaPayload(editingRecord, payload));
                    } else {
                        result = financialCrud?.createIncome
                            ? await financialCrud.createIncome(payload, {
                                successMessage: '',
                                errorMessage: '',
                                uncertainMessage: '',
                                fallback: () => window.financeRecordMutations.createRecord(payload)
                            })
                            : await window.financeRecordMutations.createRecord(payload);
                    }
                    if (result.isOk || result.success) {
                        showToast(editingRecord ? 'Entrada atualizada!' : (isHourBank ? 'Hora extra em banco de horas salva!' : 'Entrada salva!'));
                        if (editingRecord) reopenDashboardDetailAfterSuccessfulEdit();
                        editingRecordId = null;
                        clearMutationAttempt();
                        resetRecordForm('entrada');
                    }
                    else if (result.data?.mutationOutcome === window.financeApp?.resilience?.MUTATION_OUTCOME_STATE?.UNCERTAIN) {
                        showToast('Nao foi possivel confirmar a gravacao. Verifique novamente antes de reenviar.', true);
                    } else showToast('Erro ao salvar', true);
                } else {
                    const saidaValues = window.financeRecordFormReader.readSaidaFormValues(document, {
                        formCycle,
                        getHourExtraRecordDefaults,
                        today
                    });
                    const saidaValidationError = window.financeRecordFormValidation.validateSaidaForm(saidaValues);
                    if (saidaValidationError) { showToast(saidaValidationError, true); return; }
                    const selectedMacro = saidaValues.selectedMacro;
                    const selectedCategory = saidaValues.selectedCategory;
                    const saidaPayloadInput = saidaValues.payloadInput;
                    const isInstallment = saidaValues.isInstallment;
                    const recurrence = saidaValues.recurrence;
                    const parentId = 'p_' + Date.now();
                    await ensureSharedCategoryExists(selectedMacro, selectedCategory);

                    if (editingRecord) {
                        const editedPayload = window.financeRecordPayloadBuilders.buildEditedSaidaPayload(editingRecord, saidaPayloadInput);
                        const result = financialCrud?.updateExpense
                            ? await financialCrud.updateExpense({
                                id: editingRecord.id,
                                fields: editedPayload
                            }, {
                                successMessage: '',
                                errorMessage: '',
                                uncertainMessage: '',
                                fallback: () => window.financeRecordMutations.updateRecord(editedPayload)
                            })
                            : await window.financeRecordMutations.updateRecord(editedPayload);
                        if (result.isOk || result.success) {
                            showToast('Saída atualizada!');
                            reopenDashboardDetailAfterSuccessfulEdit();
                            editingRecordId = null;
                            resetRecordForm('saida');
                        } else {
                            showToast('Erro ao salvar', true);
                        }
                    } else if (isInstallment) {
                        const payloads = window.financeRecordPayloadBuilders.buildInstallmentSaidaPayloads({
                            ...saidaPayloadInput,
                            installments: saidaValues.installments,
                            totalAmount: saidaValues.totalAmount,
                            baseDueDate: saidaValues.baseDueDate,
                            parentId
                        });

                        if (!payloads.length) { showToast('Parcelamento invalido', true); return; }
                        if (!hasTransactionCapacity(payloads.length)) { showToast(`Limite de ${MAX_TRANSACTION_RECORDS} lancamentos atingido!`, true); return; }
                        const result = await window.financeRecordMutations.createManyRecords(payloads);
                        if (result.isOk) {
                            showToast(`${result.count || payloads.length} parcela(s) criada(s)!`);
                        } else {
                            showToast('Erro ao salvar parcelamento', true);
                        }
                    } else if (recurrence) {
                        const seriesId = 'r_' + Date.now();
                        const series = window.financeRecordPayloadBuilders.createRecurrenceSeries({
                            ...saidaPayloadInput,
                            recurrence,
                            frequency: saidaValues.recurrenceFrequency,
                            baseDueDate: saidaValues.baseDueDate,
                            recurrence_count: saidaValues.recurrenceTermination === 'count' ? saidaValues.recurrenceCount : 0,
                            recurrence_end_date: saidaValues.recurrenceTermination === 'end_date' ? saidaValues.recurrenceEndDate : '',
                            seriesId
                        });

                        if (!series?.isValid || !series.occurrences?.length) {
                            showToast(series?.errors?.[0]?.message || 'Recorrencia invalida', true);
                            return;
                        }
                        if (!hasTransactionCapacity(series.occurrences.length)) { showToast(`Limite de ${MAX_TRANSACTION_RECORDS} lancamentos atingido!`, true); return; }
                        const result = await window.financeRecordMutations.createManyRecords(series.occurrences);
                        if (result.isOk) {
                            showToast(`Recorrencia ${recurrence} criada (${result.count || series.occurrences.length}x)!`);
                        } else {
                            showToast('Erro ao salvar recorrencia', true);
                        }
                    } else {
                        if (!hasTransactionCapacity()) { showToast(`Limite de ${MAX_TRANSACTION_RECORDS} lancamentos atingido!`, true); return; }
                        const expensePayload = { ...saidaPayloadInput, parentId: '' };
                        const result = financialCrud?.createExpense
                            ? await financialCrud.createExpense(expensePayload, {
                                successMessage: '',
                                errorMessage: '',
                                uncertainMessage: '',
                                fallback: () => window.financeRecordMutations.createRecord(window.financeRecordPayloadBuilders.buildSaidaPayload(expensePayload))
                            })
                            : await window.financeRecordMutations.createRecord(window.financeRecordPayloadBuilders.buildSaidaPayload(expensePayload));
                        if (!result.isOk && !result.success && result.data?.mutationOutcome === window.financeApp?.resilience?.MUTATION_OUTCOME_STATE?.UNCERTAIN) {
                            showToast('Nao foi possivel confirmar a gravacao. Verifique novamente antes de reenviar.', true);
                            return;
                        }
                        if (result.isOk || result.success) clearMutationAttempt();
                        if (result.isOk || result.success) showToast('Saída salva!');
                        else showToast('Erro ao salvar', true);
                    }
                    if (!editingRecord && !btn.__financeMutationAttempt) resetRecordForm('saida');
                }
            } finally {
                btn.dataset.saving = 'false';
                btn.disabled = false;
                updateFormModeUi();
                lucide.createIcons();
            }
        }

        // ============ TOAST ============
        function showToast(msg, isError = false) {
            window.financeApp.financeUiAdapters.showToast(msg, isError);
        }

        // ============ DELETE ============
        function showDeleteOverlay(overlayId) {
            window.financeApp.financeUiAdapters.showOverlay(overlayId);
        }

        function isDashboardExpenseDetailVisible() {
            const modal = document.getElementById('dashboard-expense-category-modal');
            return Boolean(modal && !modal.classList.contains('hidden'));
        }

        function inferDashboardDetailFilter(title = '') {
            const normalizedTitle = String(title || '').trim();
            const pairs = [
                ['Subcategoria: ', 'subcategory'],
                ['Categoria: ', 'macro'],
                ['Pessoa: ', 'person']
            ];
            for (const [prefix, mode] of pairs) {
                if (normalizedTitle.startsWith(prefix)) {
                    return { mode, label: normalizedTitle.slice(prefix.length).trim() };
                }
            }
            return { mode: 'ids', label: '' };
        }

        function setDashboardDetailContext(title = 'Detalhes', records = []) {
            const filter = inferDashboardDetailFilter(title);
            dashboardDetailContext = {
                title,
                mode: filter.mode,
                label: filter.label,
                ids: records.map((record) => record?.id).filter(Boolean),
                excludedIds: dashboardDetailContext?.title === title ? (dashboardDetailContext.excludedIds || []) : []
            };
        }

        function getDashboardDetailContextRecords() {
            if (!dashboardDetailContext) return [];
            if (dashboardDetailContext.mode !== 'ids') {
                const aggregations = getDashboardAggregations();
                const map = dashboardDetailContext.mode === 'person'
                    ? aggregations.registrosPorPessoa
                    : dashboardDetailContext.mode === 'macro'
                        ? aggregations.registrosPorCategoria
                        : aggregations.registrosPorSubcategoria;
                const excludedIds = new Set(dashboardDetailContext.excludedIds || []);
                return (map[dashboardDetailContext.label] || []).filter((record) => !excludedIds.has(record.id));
            }
            const ids = new Set(dashboardDetailContext.ids || []);
            const excludedIds = new Set(dashboardDetailContext.excludedIds || []);
            return getTransactionRecords({ archiveMode: 'all' }).filter((record) => ids.has(record.id) && !excludedIds.has(record.id));
        }

        function refreshDashboardDetailAfterDataChange() {
            if (!dashboardDetailContext) return;
            if (typeof openDashboardSaidasDetail !== 'function') return;
            const shouldReopen = dashboardDetailReopenAfterDataChange;
            const shouldRefreshVisible = isDashboardExpenseDetailVisible();
            if (!shouldReopen && !shouldRefreshVisible) return;

            const records = getDashboardDetailContextRecords();
            dashboardDetailReopenAfterDataChange = false;
            if (shouldReopen && currentTab !== 'dashboard') {
                switchTab('dashboard', { fromHistory: true });
            }
            openDashboardSaidasDetail(dashboardDetailContext.title, records);
        }

        function reopenDashboardDetailAfterSuccessfulEdit() {
            if (!dashboardDetailEditPending) return;
            dashboardDetailEditPending = false;
            dashboardDetailReopenAfterDataChange = true;
            setTimeout(refreshDashboardDetailAfterDataChange, 0);
        }

        function askDelete(record) {
            deleteTarget = record;
            showDeleteOverlay('delete-overlay');
        }

        function cancelDelete() {
            deleteTarget = null;
            window.financeApp.financeUiAdapters.hideOverlay('delete-overlay');
        }

        async function confirmDelete() {
            if (!deleteTarget) return;
            const deletedId = deleteTarget.id;
            window.financeApp.financeUiAdapters.hideOverlay('delete-overlay');
            if ((deleteTarget.type === 'macro' || deleteTarget.type === 'categoria') && hasReferenceUsage(deleteTarget)) {
                showToast('Referencia em uso por lancamentos. Exclusao bloqueada para preservar historico.', true);
                deleteTarget = null;
                return;
            }
            const financialCrud = window.financeApp?.financialCrud;
            const r = deleteTarget.type === 'saida' && financialCrud?.deleteExpense
                ? await financialCrud.deleteExpense({ id: deleteTarget.id }, {
                    successMessage: '',
                    errorMessage: '',
                    uncertainMessage: '',
                    fallback: () => window.financeRecordMutations.deleteRecord(deleteTarget)
                })
                : await window.financeRecordMutations.deleteRecord(deleteTarget);
            if (r.isOk || r.success) {
                showToast('Excluído!');
                if (dashboardDetailContext?.ids?.length && deletedId) {
                    dashboardDetailContext.ids = dashboardDetailContext.ids.filter((id) => id !== deletedId);
                }
                if (dashboardDetailContext && deletedId) {
                    dashboardDetailContext.excludedIds = [...new Set([...(dashboardDetailContext.excludedIds || []), deletedId])];
                }
                setTimeout(refreshDashboardDetailAfterDataChange, 0);
            } else showToast('Erro ao excluir', true);
            deleteTarget = null;
        }

        function askDeletePerson(person) {
            deletePerson = person;
            document.getElementById('delete-person-msg').textContent = `Tem certeza que deseja excluir "${person.person}"?`;
            showDeleteOverlay('delete-person-overlay');
        }

        function cancelDeletePerson() {
            deletePerson = null;
            window.financeApp.financeUiAdapters.hideOverlay('delete-person-overlay');
        }

        async function confirmDeletePerson() {
            if (!deletePerson) return;
            window.financeApp.financeUiAdapters.hideOverlay('delete-person-overlay');
            const r = await window.financeRecordMutations.deleteRecord(deletePerson);
            if (r.isOk) showToast('Pessoa removida!');
            else showToast('Erro ao remover', true);
            deletePerson = null;
        }

        function askDeleteMacro(macro) {
            if (!canMaintainReference(macro)) {
                showToast('Macro global so pode ser mantida por administrador', true);
                return;
            }
            if (hasReferenceUsage(macro)) {
                showToast('Macro em uso por lancamentos. Exclusao bloqueada para preservar historico.', true);
                return;
            }
            deleteMacro = macro;
            document.getElementById('delete-macro-msg').textContent = `Tem certeza que deseja excluir "${macro.macro_category}"?`;
            showDeleteOverlay('delete-macro-overlay');
        }

        function cancelDeleteMacro() {
            deleteMacro = null;
            window.financeApp.financeUiAdapters.hideOverlay('delete-macro-overlay');
        }

        async function confirmDeleteMacro() {
            if (!deleteMacro) return;
            window.financeApp.financeUiAdapters.hideOverlay('delete-macro-overlay');
            if (hasReferenceUsage(deleteMacro)) {
                showToast('Macro em uso por lancamentos. Exclusao bloqueada para preservar historico.', true);
                deleteMacro = null;
                return;
            }
            const r = await window.financeRecordMutations.deleteRecord(deleteMacro);
            if (r.isOk) showToast('Categoria macro removida!');
            else showToast('Erro ao remover', true);
            deleteMacro = null;
        }

        Object.assign(window, {
            askDelete,
            cancelDelete,
            confirmDelete,
            askDeletePerson,
            cancelDeletePerson,
            confirmDeletePerson,
            askDeleteMacro,
            cancelDeleteMacro,
            confirmDeleteMacro,
            setDashboardDetailContext,
            refreshDashboardDetailAfterDataChange,
            openMonthlyDetailTab
        });

        // ============ TOGGLE STATUS ============
        async function togglePago(record) {
            const updated = window.financeRecordMutations.buildPaidToggleRecord(record);
            const financialCrud = window.financeApp?.financialCrud;
            const r = record.type === 'saida' && record.status !== 'Pago' && financialCrud?.markExpenseAsPaid
                ? await financialCrud.markExpenseAsPaid({ expenseId: record.id, paidAt: updated.paid_at }, {
                    errorMessage: '',
                    uncertainMessage: '',
                    fallback: () => window.financeRecordMutations.updateRecord(updated)
                })
                : await window.financeRecordMutations.updateRecord(updated);
            if (r.isOk || r.success) setTimeout(refreshDashboardDetailAfterDataChange, 0);
            else showToast('Erro ao atualizar', true);
        }

        async function toggleArchiveRecord(record) {
            if (!isTransactionRecord(record)) return;
            const updated = window.financeRecordMutations.buildArchiveToggleRecord(record, { isArchivedRecord });
            const financialCrud = window.financeApp?.financialCrud;
            const r = record.type === 'saida' && !isArchivedRecord(record) && financialCrud?.archiveExpense
                ? await financialCrud.archiveExpense({ id: record.id }, {
                    successMessage: '',
                    errorMessage: '',
                    uncertainMessage: '',
                    fallback: () => window.financeRecordMutations.updateRecord(updated)
                })
                : await window.financeRecordMutations.updateRecord(updated);
            if (r.isOk || r.success) {
                showToast(updated.archived ? 'Lançamento arquivado!' : 'Lançamento reaberto!');
                setTimeout(refreshDashboardDetailAfterDataChange, 0);
            }
            else showToast('Erro ao atualizar histórico', true);
        }

        async function updateArchiveStateByCompetence(shouldArchive) {
            const cutoff = document.getElementById('archive-cutoff')?.value;
            if (!cutoff) { showToast('Informe a competência limite', true); return; }

            const targets = getTransactionRecords({ archiveMode: 'all' })
                .filter((record) => record.competence && record.competence <= cutoff && isArchivedRecord(record) !== shouldArchive);

            if (!targets.length) {
                showToast(shouldArchive ? 'Nenhum lançamento elegível para arquivar' : 'Nenhum lançamento arquivado nesse período', true);
                return;
            }

            for (const record of targets) {
                await window.dataSdk.update({
                    ...record,
                    archived: shouldArchive,
                    archived_at: shouldArchive ? new Date().toISOString() : ''
                });
            }

            showToast(shouldArchive ? `${targets.length} lançamento(s) arquivado(s)!` : `${targets.length} lançamento(s) reaberto(s)!`);
        }

        function archiveRecordsByCompetence() {
            return updateArchiveStateByCompetence(true);
        }

        function restoreArchivedRecordsByCompetence() {
            return updateArchiveStateByCompetence(false);
        }

        // ============ RENDER ============
        let isFirstRender = true;

        function renderAll() {
            if (isFirstRender) {
                const start = document.getElementById('f-comp-start');
                const end = document.getElementById('f-comp-end');
                const now = new Date();
                const currentMonth = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
                start.value = currentMonth;
                end.value = currentMonth;
                const dStart = new Date(now.getFullYear(), now.getMonth(), 1);
                dStart.setMonth(dStart.getMonth() - 6);
                const archiveCutoff = document.getElementById('archive-cutoff');
                if (archiveCutoff) archiveCutoff.value = dStart.getFullYear() + '-' + String(dStart.getMonth() + 1).padStart(2, '0');
                isFirstRender = false;
            }
            updatePersonFilters();
            updateMacroFilters();
            updateSaidasPaymentFilterOptions();
            updateArchiveSummary();
            syncOvertimeTypeOptions();
            handleEarningTypeChange();
            renderCurrentTab();
        }

        function renderCurrentTab() {
            if (currentTab === 'dashboard') renderDashboard();
            if (currentTab === 'mes-detalhe') renderMonthlyDetailTab();
            if (currentTab === 'saidas') renderSaidas();
            if (currentTab === 'entradas') renderEntradas();
            if (currentTab === 'controle-horas') renderControleHoras();
            if (currentTab === 'configuracoes') renderConfiguracoes();
        }

        function getFilteredForCompetence(competence) {
            if (!competence) return [];
            return getFiltered().filter((record) => record.competence === competence);
        }

        function openMonthlyDetailTab(competence) {
            if (window.financeMonthDetail?.openMonthlyDetailTab) {
                return window.financeMonthDetail.openMonthlyDetailTab(competence);
            }
            if (!competence) return;
            selectedDashboardMonth = competence;
            const renderToken = ++monthlyDetailRenderToken;
            switchTab('mes-detalhe', { skipRender: true });
            renderMonthlyDetailSkeleton(competence);
            scheduleMonthlyDetailWork(() => renderMonthlyDetailTab(renderToken), 120);
            const mainContent = document.getElementById('main-content');
            if (mainContent) mainContent.scrollTo({ top: 0, behavior: 'auto' });
        }

        function renderMetricBarList(items, emptyLabel, tone = 'accent') {
            if (typeof window.financeMonthDetailRenderer?.renderMetricBarList === 'function') {
                return window.financeMonthDetailRenderer.renderMetricBarList(items, emptyLabel, tone);
            }
            return `<p class="text-sm text-textSecondary">${emptyLabel}</p>`;
        }

        function renderPersonFinancialBreakdown(items) {
            if (typeof window.financeMonthDetailRenderer?.renderPersonFinancialBreakdown === 'function') {
                return window.financeMonthDetailRenderer.renderPersonFinancialBreakdown(items);
            }
            return '<p class="text-sm text-textSecondary">Nenhuma pessoa vinculada neste mês.</p>';
        }

        function getDashboardPersonBalances() {
            const filteredRecords = getFiltered();
            const map = {};
            const ensurePersonBalance = (key) => {
                if (!map[key]) {
                    map[key] = {
                        label: key,
                        receber: 0,
                        pagar: 0,
                        emAberto: 0,
                        sobra: 0,
                        ciclos: {
                            INICIO_MES: { receber: 0, pagar: 0, emAberto: 0, sobra: 0 },
                            QUINZENA: { receber: 0, pagar: 0, emAberto: 0, sobra: 0 }
                        }
                    };
                }
                return map[key];
            };

            filteredRecords
                .filter((record) => record.type === 'entrada' && !isReferenceSalaryRecord(record))
                .forEach((record) => {
                    const key = record.person || 'Sem pessoa';
                    const personBalance = ensurePersonBalance(key);
                    const value = Number(record.amount) || 0;
                    const adjustedValue = record.macro_category === 'Dedução' ? -value : value;
                    personBalance.receber += adjustedValue;
                    if (record.cycle && personBalance.ciclos[record.cycle]) {
                        personBalance.ciclos[record.cycle].receber += adjustedValue;
                    }
                });

            filteredRecords
                .filter((record) => record.type === 'saida' && record.status !== 'Cancelado')
                .forEach((record) => {
                    const key = record.person || 'Sem pessoa';
                    const personBalance = ensurePersonBalance(key);
                    const value = Number(record.amount) || 0;
                    if (record.status === 'Pago') {
                        personBalance.pagar += value;
                        if (record.cycle && personBalance.ciclos[record.cycle]) {
                            personBalance.ciclos[record.cycle].pagar += value;
                        }
                    }
                    if (record.status === 'Em aberto') {
                        personBalance.emAberto += value;
                        if (record.cycle && personBalance.ciclos[record.cycle]) {
                            personBalance.ciclos[record.cycle].emAberto += value;
                        }
                    }
                });

            return Object.values(map)
                .map((item) => ({
                    ...item,
                    sobra: item.receber - item.pagar - item.emAberto,
                    ciclos: {
                        INICIO_MES: {
                            ...item.ciclos.INICIO_MES,
                            sobra: item.ciclos.INICIO_MES.receber - item.ciclos.INICIO_MES.pagar - item.ciclos.INICIO_MES.emAberto
                        },
                        QUINZENA: {
                            ...item.ciclos.QUINZENA,
                            sobra: item.ciclos.QUINZENA.receber - item.ciclos.QUINZENA.pagar - item.ciclos.QUINZENA.emAberto
                        }
                    }
                }))
                .sort((a, b) => a.sobra - b.sobra);
        }

        function renderDashboardPersonBalanceCards() {
            const wrap = document.getElementById('person-balance-cards');
            const meta = document.getElementById('person-balance-meta');
            if (!wrap || !meta) return;

            const items = getDashboardPersonBalances();
            const start = document.getElementById('f-comp-start')?.value || '';
            const end = document.getElementById('f-comp-end')?.value || '';
            const periodLabel = start && end
                ? (start === end ? formatCompetence(start) : `${formatCompetence(start)} até ${formatCompetence(end)}`)
                : start
                    ? `A partir de ${formatCompetence(start)}`
                    : end
                        ? `Até ${formatCompetence(end)}`
                        : 'Todos os períodos';
            meta.textContent = `Período: ${periodLabel}`;

            if (!items.length) {
                wrap.innerHTML = '<p class="text-sm text-textSecondary">Nenhum lançamento encontrado para o período filtrado.</p>';
                return;
            }

            wrap.innerHTML = items.map((item) => {
                const tone = item.sobra >= 0
                    ? {
                        card: 'border-success/20',
                        pill: 'bg-success/10 text-success',
                        value: 'text-success'
                    }
                    : {
                        card: 'border-danger/20',
                        pill: 'bg-danger/10 text-danger',
                        value: 'text-danger'
                    };

                return `
                    <div class="rounded-xl border ${tone.card} bg-surfaceLight/20 p-4">
                        <div class="flex items-start justify-between gap-3 mb-4">
                            <div>
                                <p class="text-base font-semibold text-textPrimary">${escapeHtml(item.label)}</p>
                                <p class="text-xs text-textSecondary mt-1">Resumo previsto do período filtrado</p>
                            </div>
                            <span class="px-2 py-1 rounded-full text-[11px] font-semibold ${tone.pill}">${item.sobra >= 0 ? 'Positivo' : 'Atenção'}</span>
                        </div>
                        <div class="mb-4">
                            <p class="text-[11px] uppercase tracking-[0.14em] text-textSecondary">Saldo projetado</p>
                            <p class="mt-1 text-xl font-bold ${tone.value}">${fmt(item.sobra)}</p>
                        </div>
                        <div class="grid grid-cols-3 gap-2 text-xs">
                            <div class="rounded-lg border border-surfaceLight bg-surface px-3 py-2">
                                <p class="text-textSecondary">Receitas</p>
                                <p class="mt-1 font-semibold text-success">${fmt(item.receber)}</p>
                            </div>
                            <div class="rounded-lg border border-surfaceLight bg-surface px-3 py-2">
                                <p class="text-textSecondary">Despesas pagas</p>
                                <p class="mt-1 font-semibold text-danger">${fmt(item.pagar)}</p>
                            </div>
                            <div class="rounded-lg border border-surfaceLight bg-surface px-3 py-2">
                                <p class="text-textSecondary">Pendências</p>
                                <p class="mt-1 font-semibold text-warn">${fmt(item.emAberto)}</p>
                            </div>
                        </div>
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
                            <div class="rounded-lg border border-surfaceLight bg-surface px-3 py-3">
                                <p class="text-[11px] uppercase tracking-[0.12em] text-textSecondary">Início do mês</p>
                                <p class="mt-1 text-sm font-semibold ${item.ciclos.INICIO_MES.sobra >= 0 ? 'text-success' : 'text-danger'}">${fmt(item.ciclos.INICIO_MES.sobra)}</p>
                                <p class="mt-1 text-[11px] text-textSecondary">Recebe ${fmt(item.ciclos.INICIO_MES.receber)} • Paga ${fmt(item.ciclos.INICIO_MES.pagar + item.ciclos.INICIO_MES.emAberto)}</p>
                            </div>
                            <div class="rounded-lg border border-surfaceLight bg-surface px-3 py-3">
                                <p class="text-[11px] uppercase tracking-[0.12em] text-textSecondary">Quinzena</p>
                                <p class="mt-1 text-sm font-semibold ${item.ciclos.QUINZENA.sobra >= 0 ? 'text-success' : 'text-danger'}">${fmt(item.ciclos.QUINZENA.sobra)}</p>
                                <p class="mt-1 text-[11px] text-textSecondary">Recebe ${fmt(item.ciclos.QUINZENA.receber)} • Paga ${fmt(item.ciclos.QUINZENA.pagar + item.ciclos.QUINZENA.emAberto)}</p>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
        }

        function renderMonthlyDetailSkeleton(competence) {
            return window.financeMonthDetailRenderer?.renderMonthlyDetailSkeleton?.(competence);
        }

        function scheduleMonthlyDetailWork(callback, fallbackDelay = 80) {
            return window.financeMonthDetailRenderer?.scheduleMonthlyDetailWork?.(callback, fallbackDelay)
                || setTimeout(callback, fallbackDelay);
        }

        function renderMonthlyDetailRecords(records, renderToken) {
            return window.financeMonthDetailRenderer?.renderMonthlyDetailRecords?.(records, renderToken);
        }

        function getMonthlyDetailConsolidatedEntradas(competence) {
            const normalizedCompetence = normalizeCompetenceKey(competence);
            const selectedPerson = document.getElementById('f-person')?.value || '';

            if (!normalizedCompetence) return [];

            if (typeof getDashboardBaseEntradas === 'function') {
                try {
                    const entries = getDashboardBaseEntradas()
                        .filter((entry) => normalizeCompetenceKey(entry.competencia || entry.competence || '') === normalizedCompetence)
                        .filter((entry) => !selectedPerson || entry.person === selectedPerson);
                    if (entries.length) return entries;
                } catch (error) {
                    console.warn('Falha ao reutilizar entradas consolidadas do dashboard no detalhe mensal', error);
                }
            }

            if (
                typeof getPeopleRecords !== 'function'
                || typeof consolidarEntradaMensal !== 'function'
                || typeof mapEntradaToCycleView !== 'function'
            ) {
                return getFilteredForCompetence(normalizedCompetence)
                    .filter((record) => record.type === 'entrada' && isFinancialEntradaRecord(record))
                    .map((record) => ({
                        ...record,
                        cardLiquido: record.macro_category === 'Dedução'
                            ? -(Number(record.amount) || 0)
                            : Number(record.amount) || 0
                    }));
            }

            return getPeopleRecords()
                .filter((personRecord) => {
                    const personName = personRecord.person || '';
                    return personName && (!selectedPerson || personName === selectedPerson);
                })
                .flatMap((personRecord) => {
                    const consolidated = consolidarEntradaMensal(personRecord.person, normalizedCompetence);
                    if (!consolidated) return [];
                    return [
                        mapEntradaToCycleView(consolidated, 'INICIO_MES'),
                        mapEntradaToCycleView(consolidated, 'QUINZENA')
                    ];
                })
                .filter(Boolean)
                .filter((entry) => {
                    const value = window.financeMonthlyDetailSelectors.getMonthlyDetailEntradaValue(entry);
                    return value !== 0
                        || Number(entry.salaryBase || 0) > 0
                        || Number(entry.hourExtra || 0) > 0
                        || Number(entry.outrosProventos || 0) > 0
                        || Number(entry.outrosDescontos || 0) > 0
                        || Number(entry.inss || 0) > 0
                        || Number(entry.irrf || 0) > 0;
                });
        }

        function renderMonthlyDetailTab(renderToken) {
            if (window.financeMonthDetailRenderer?.renderMonthlyDetailTab) {
                return arguments.length
                    ? window.financeMonthDetailRenderer.renderMonthlyDetailTab(renderToken)
                    : window.financeMonthDetailRenderer.renderMonthlyDetailTab();
            }
            renderToken = renderToken || ++monthlyDetailRenderToken;
            if (renderToken !== monthlyDetailRenderToken || currentTab !== 'mes-detalhe') return;
            const competence = selectedDashboardMonth || document.getElementById('f-comp-start')?.value || thisMonth;
            const records = getFilteredForCompetence(competence);
            const title = document.getElementById('month-detail-title');
            const subtitle = document.getElementById('month-detail-subtitle');
            const summary = document.getElementById('month-detail-summary');
            const highlights = document.getElementById('month-detail-highlights');
            const categoriesWrap = document.getElementById('month-detail-categories');
            const peopleWrap = document.getElementById('month-detail-people');
            const recordsWrap = document.getElementById('month-detail-records');
            const recordsMeta = document.getElementById('month-detail-records-meta');
            const statusBadge = document.getElementById('month-detail-status-badge');

            const monthlyDetail = window.financeMonthlyDetailSelectors.selectMonthlyDetail({
                competence,
                records,
                consolidatedEntradas: getMonthlyDetailConsolidatedEntradas(competence)
            });
            const {
                totals: {
                    totalEntradas,
                    totalSaidas,
                    totalAberto,
                    sobra,
                    saldoProjetado,
                    comprometimento
                },
                statusTone,
                topCategories,
                personFinancialSummary,
                topExpense,
                topEntry
            } = monthlyDetail;

            if (title) title.textContent = `Visão de ${formatCompetence(competence)}`;
            if (subtitle) subtitle.textContent = 'Resumo tático do mês escolhido no gráfico mensal, com foco em receita, despesa, sobra e pendências.';
            if (statusBadge) {
                statusBadge.className = `px-3 py-1 rounded-full text-xs font-semibold border ${statusTone.badgeClass}`;
                statusBadge.textContent = statusTone.text;
            }

            if (summary) {
                summary.innerHTML = `
                    <div class="glass rounded-xl p-3 border border-surfaceLight">
                        <p class="text-xs text-textSecondary">Entradas</p>
                        <p class="text-lg font-bold text-success">${fmt(totalEntradas)}</p>
                    </div>
                    <div class="glass rounded-xl p-3 border border-surfaceLight">
                        <p class="text-xs text-textSecondary">Saídas pagas</p>
                        <p class="text-lg font-bold text-danger">${fmt(totalSaidas)}</p>
                    </div>
                    <div class="glass rounded-xl p-3 border border-surfaceLight">
                        <p class="text-xs text-textSecondary">Em aberto</p>
                        <p class="text-lg font-bold text-warn">${fmt(totalAberto)}</p>
                    </div>
                    <div class="glass rounded-xl p-3 border border-surfaceLight">
                        <p class="text-xs text-textSecondary">Sobra do mês</p>
                        <p class="text-lg font-bold ${sobra >= 0 ? 'text-success' : 'text-danger'}">${fmt(sobra)}</p>
                    </div>
                `;
            }

            if (highlights) {
                highlights.innerHTML = `
                    <div class="rounded-xl border border-surfaceLight bg-surfaceLight/25 p-4">
                        <p class="text-xs uppercase tracking-[0.14em] text-textSecondary">Saldo projetado</p>
                        <p class="mt-2 text-lg font-bold ${saldoProjetado >= 0 ? 'text-success' : 'text-danger'}">${fmt(saldoProjetado)}</p>
                        <p class="mt-1 text-xs text-textSecondary">Sobra após considerar pendências em aberto.</p>
                    </div>
                    <div class="rounded-xl border border-surfaceLight bg-surfaceLight/25 p-4">
                        <p class="text-xs uppercase tracking-[0.14em] text-textSecondary">Comprometimento</p>
                        <p class="mt-2 text-lg font-bold ${comprometimento >= 80 ? 'text-danger' : comprometimento >= 60 ? 'text-warn' : 'text-success'}">${comprometimento.toFixed(1).replace('.', ',')}%</p>
                        <p class="mt-1 text-xs text-textSecondary">Percentual das entradas já consumido por saídas pagas.</p>
                    </div>
                    <div class="rounded-xl border border-surfaceLight bg-surfaceLight/25 p-4">
                        <p class="text-xs uppercase tracking-[0.14em] text-textSecondary">Maior saída paga</p>
                        <p class="mt-2 text-base font-bold text-danger">${topExpense ? fmt(topExpense.amount) : 'R$ 0,00'}</p>
                        <p class="mt-1 text-xs text-textSecondary">${topExpense ? escapeHtml(topExpense.description || topExpense.subcategory || topExpense.macro_category || 'Sem descrição') : 'Sem saídas pagas no mês.'}</p>
                    </div>
                    <div class="rounded-xl border border-surfaceLight bg-surfaceLight/25 p-4">
                        <p class="text-xs uppercase tracking-[0.14em] text-textSecondary">Maior entrada</p>
                        <p class="mt-2 text-base font-bold text-success">${topEntry ? fmt(window.financeMonthlyDetailSelectors.getMonthlyDetailEntradaValue(topEntry)) : 'R$ 0,00'}</p>
                        <p class="mt-1 text-xs text-textSecondary">${topEntry ? escapeHtml(window.financeMonthlyDetailSelectors.getMonthlyDetailEntradaLabel(topEntry)) : 'Sem entradas financeiras no mês.'}</p>
                    </div>
                `;
            }

            if (categoriesWrap) categoriesWrap.innerHTML = renderMetricBarList(topCategories, 'Nenhuma categoria relevante neste mês.', 'danger');
            if (peopleWrap) peopleWrap.innerHTML = renderPersonFinancialBreakdown(personFinancialSummary);

            if (recordsMeta) recordsMeta.textContent = `Preparando lançamentos do mês...`;
            if (recordsWrap) {
                recordsWrap.innerHTML = '<p class="text-sm text-textSecondary text-center py-8">Carregando lançamentos do mês...</p>';
            }

            scheduleMonthlyDetailWork(() => renderMonthlyDetailRecords(records, renderToken), 60);
        }

        function getFiltered(typeFilter, options = {}) {
            const cStart = document.getElementById('f-comp-start').value;
            const cEnd = document.getElementById('f-comp-end').value;
            const person = document.getElementById('f-person').value;
            const macro = document.getElementById('f-macro').value;
            const cycle = document.getElementById('f-cycle').value;
            const archiveMode = options.archiveMode || 'active';
            return getTransactionRecords({
                type: typeFilter,
                archiveMode,
                competenceStart: cStart,
                competenceEnd: cEnd,
                person,
                macro,
                cycle
            });
        }

        function clearDashboardFilters() {
            document.getElementById('f-comp-start').value = thisMonth;
            document.getElementById('f-comp-end').value = thisMonth;
            document.getElementById('f-person').value = '';
            document.getElementById('f-macro').value = '';
            document.getElementById('f-cycle').value = '';
            setFocusedCard(null); // isso já chama renderDashboard()
        }

        function shiftMonthValue(monthValue, delta) {
            if (!monthValue || !/^\d{4}-\d{2}$/.test(monthValue)) return '';
            const [year, month] = monthValue.split('-').map(Number);
            const date = new Date(year, month - 1, 1);
            date.setMonth(date.getMonth() + delta);
            return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        }

        function shiftDashboardCompetenceRange(delta) {
            const startField = document.getElementById('f-comp-start');
            const endField = document.getElementById('f-comp-end');
            if (!startField || !endField) return;

            const baseStart = startField.value || thisMonth;
            const baseEnd = endField.value || baseStart;
            startField.value = shiftMonthValue(baseStart, delta) || baseStart;
            endField.value = shiftMonthValue(baseEnd, delta) || baseEnd;
            renderDashboard();
        }

        function updateDashboardFilterChipState() {
            const panel = document.getElementById('advanced-filters-panel');
            const person = document.getElementById('f-person').value;
            const macro = document.getElementById('f-macro').value;
            const cycle = document.getElementById('f-cycle').value;
            const hasAdvancedFilter = Boolean(person || macro || cycle);
            if (hasAdvancedFilter && panel?.classList.contains('hidden')) {
                toggleAdvancedFilters(true);
            }
        }

        function clearDashboardFilter(key) {
            const map = {
                start: 'f-comp-start',
                end: 'f-comp-end',
                person: 'f-person',
                macro: 'f-macro',
                cycle: 'f-cycle',
                card: null
            };

            if (key === 'card') {
                focusedDashboardCard = null;
                renderDashboard();
                return;
            }

            const fieldId = map[key];
            const field = fieldId ? document.getElementById(fieldId) : null;
            if (field) field.value = '';
            renderDashboard();
        }

        function renderActiveDashboardFilters() {
            const wrap = document.getElementById('dashboard-active-filters');
            if (!wrap) return;

            const filters = [];
            const start = document.getElementById('f-comp-start').value;
            const end = document.getElementById('f-comp-end').value;
            const person = document.getElementById('f-person').value;
            const macro = document.getElementById('f-macro').value;
            const cycle = document.getElementById('f-cycle').value;

            if (start) filters.push({ key: 'start', label: `De ${formatCompetence(start)}` });
            if (end) filters.push({ key: 'end', label: `Até ${formatCompetence(end)}` });
            if (person) filters.push({ key: 'person', label: `Pessoa: ${person}` });
            if (macro) filters.push({ key: 'macro', label: `Categoria: ${macro}` });
            if (cycle) filters.push({ key: 'cycle', label: `Ciclo: ${cycle === 'INICIO_MES' ? 'Início do mês' : 'Quinzena'}` });
            if (focusedDashboardCard) {
                const labels = {
                    entradas: 'Foco: entradas',
                    saidas: 'Foco: saídas',
                    saldo: 'Foco: saldo',
                    aberto: 'Foco: em aberto'
                };
                filters.push({ key: 'card', label: labels[focusedDashboardCard] || 'Foco ativo' });
            }

            if (!filters.length) {
                wrap.innerHTML = '<span class="text-xs text-textSecondary">Sem refinamentos ativos.</span>';
                toggleAdvancedFilters(false);
                return;
            }

            wrap.innerHTML = filters.map((filter) => `
                <button type="button" data-clear-dashboard-filter="${filter.key}" class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-surfaceLight text-textSecondary text-xs hover:text-textPrimary transition-colors">
                    <span>${filter.label}</span>
                    <i data-lucide="x" class="w-3.5 h-3.5"></i>
                </button>
            `).join('');
        }

        function getListRecords(tab) {
            const type = tab === 'saidas' ? 'saida' : 'entrada';
            let records = getFiltered(type, { archiveMode: listArchiveFilters[tab] });
            if (tab === 'saidas' && listPaymentFilters.saidas) {
                records = records.filter((record) => normalizePaymentFilterValue(record.payment_method) === listPaymentFilters.saidas);
            }
            if (tab === 'saidas') {
                records = applySaidasListFilters(records);
            }
            if (tab === 'saidas' && listDetailFilters.saidas === 'aberto') {
                records = records.filter((record) => record.status === 'Em aberto');
            } else if (tab === 'saidas' && listDetailFilters.saidas === 'pago') {
                records = records.filter((record) => record.status === 'Pago');
            }
            records = records.filter((record) => matchesListSearch(record, tab));
            return sortRecordsNewestFirst(records);
        }

        function normalizeListSearchValue(value) {
            return String(value || '')
                .normalize('NFD')
                .replace(/[̀-ͯ]/g, '')
                .toLowerCase()
                .trim();
        }

        function getSaidaExactDate(record) {
            return String(record?.occurred_date || record?.due_date || '').trim();
        }

        function formatExactDateLabel(value) {
            const text = String(value || '').trim();
            const match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
            if (!match) return '';
            return `${match[3]}/${match[2]}/${match[1]}`;
        }

        function getListSearchHaystack(record) {
            return normalizeListSearchValue([
                record?.subcategory,
                record?.earning_type,
                record?.person,
                record?.macro_category,
                record?.payment_method,
                record?.status,
                record?.competence,
                getSaidaExactDate(record),
                formatExactDateLabel(getSaidaExactDate(record)),
                formatCompetence(record?.competence)
            ].filter(Boolean).join(' '));
        }

        function matchesListSearch(record, tab) {
            const searchTerm = normalizeListSearchValue(listSearchFilters[tab]);
            if (!searchTerm) return true;

            const descriptionText = normalizeListSearchValue(record?.description || '');
            if (descriptionText.includes(searchTerm)) return true;

            return getListSearchHaystack(record).includes(searchTerm);
        }

        function setListSearchFilter(tab, value) {
            listSearchFilters[tab] = value || '';
            listPagination[tab] = LIST_PAGE_SIZE;
            if (tab === 'saidas') renderSaidas();
            if (tab === 'entradas') renderEntradas();
        }

        function clearListDetailFilter(tab) {
            listDetailFilters[tab] = '';
            if (tab === 'saidas') renderSaidas();
            if (tab === 'entradas') renderEntradas();
        }

        function setListArchiveFilter(tab, mode) {
            listArchiveFilters[tab] = mode;
            listPagination[tab] = LIST_PAGE_SIZE;
            const activeClass = tab === 'entradas' ? 'bg-success text-bg' : 'bg-accent text-white';
            ['active', 'archived', 'all'].forEach((itemMode) => {
                const button = document.getElementById(`${tab}-filter-${itemMode}`);
                if (!button) return;
                button.className = `px-3 py-1.5 text-xs rounded-md ${mode === itemMode ? activeClass : 'text-textSecondary'}`;
            });
            if (tab === 'saidas') renderSaidas();
            if (tab === 'entradas') renderEntradas();
        }

        function loadMoreRecords(tab) {
            listPagination[tab] += LIST_PAGE_SIZE;
            if (tab === 'saidas') renderSaidas();
            if (tab === 'entradas') renderEntradas();
        }

        function updateArchiveSummary() {
            const activeCount = getTransactionRecords({ archiveMode: 'active' }).length;
            const archivedCount = getTransactionRecords({ archiveMode: 'archived' }).length;
            const summary = document.getElementById('archive-summary');
            if (summary) summary.textContent = `${activeCount} lançamento(s) ativos e ${archivedCount} arquivado(s).`;
        }

        function clearImportReport() {
            lastImportReport = null;
            renderImportReport();
        }

        function clearEntradasImportReport() {
            lastEntradasImportReport = null;
            renderEntradasImportReport();
        }

        function renderSpreadsheetReport(report, ids) {
            const wrap = document.getElementById(ids.wrap);
            const summary = document.getElementById(ids.summary);
            const list = document.getElementById(ids.list);
            if (!wrap || !summary || !list) return;

            if (!report) {
                wrap.classList.add('hidden');
                summary.textContent = '';
                list.innerHTML = '';
                return;
            }

            wrap.classList.remove('hidden');
            const preview = report.summary || {};
            const readyText = Number.isFinite(Number(preview.readyRows)) ? `, ${preview.readyRows} pronta(s)` : '';
            const amountText = Number.isFinite(Number(preview.readyAmountTotal)) ? `, total pronto ${formatPreviewCurrency(preview.readyAmountTotal)}` : '';
            summary.textContent = `${report.imported} importada(s)${readyText}, ${report.duplicates.length} duplicada(s)/já importada(s), ${report.invalid.length} inválida(s), ${(report.conflicts || []).length} conflito(s), ${report.capacitySkipped} fora do limite${amountText}.`;

            const entries = [
                ...report.duplicates.map(item => ({ ...item, type: 'duplicate' })),
                ...(report.conflicts || []).map(item => ({ ...item, type: 'conflict' })),
                ...report.invalid.map(item => ({ ...item, type: 'invalid' })),
                ...report.capacity.map(item => ({ ...item, type: 'capacity' }))
            ];

            if (!entries.length) {
                list.innerHTML = '<p class="text-xs text-textSecondary">Nenhuma linha rejeitada nesta importação.</p>';
                return;
            }

            list.innerHTML = entries.map((item) => {
                const badge = item.type === 'duplicate'
                    ? 'bg-accent/10 text-accent'
                    : item.type === 'conflict'
                        ? 'bg-danger/10 text-danger'
                        : item.type === 'capacity'
                        ? 'bg-warn/10 text-warn'
                        : 'bg-danger/10 text-danger';
                const title = item.type === 'duplicate'
                    ? 'Duplicada / já importada'
                    : item.type === 'conflict'
                        ? 'Conflito'
                        : item.type === 'capacity'
                        ? 'Fora do limite'
                        : 'Inválida';
                const description = escapeHtml(item.description || item.subcategory || item.earning_type || '-');
                const reason = escapeHtml(item.reason || '');
                return `<div class="rounded-lg bg-surface border border-surfaceLight p-3 text-xs">
    <div class="flex justify-between items-start gap-3">
      <div>
        <p class="font-semibold text-textPrimary">Linha ${item.sourceIndex} • ${description}</p>
        <p class="text-textSecondary mt-1">${escapeHtml(item.person || '')} • ${escapeHtml(item.competence || '')} • ${escapeHtml(item.amount || '')}</p>
      </div>
      <span class="px-2 py-1 rounded-full ${badge}">${title}</span>
    </div>
    <p class="text-textSecondary mt-2">${reason}</p>
  </div>`;
            }).join('');
        }

        function renderImportReport() {
            renderSpreadsheetReport(lastImportReport, {
                wrap: 'import-report',
                summary: 'import-report-summary',
                list: 'import-report-list'
            });
        }

        function renderEntradasImportReport() {
            renderSpreadsheetReport(lastEntradasImportReport, {
                wrap: 'import-entradas-report',
                summary: 'import-entradas-report-summary',
                list: 'import-entradas-report-list'
            });
        }
        function updatePersonFilters() {
            const pessoas = allRecords.filter(r => r.type === 'pessoa').map(p => p.person).sort();
            const selDashboard = document.getElementById('f-person');
            const selForm = document.getElementById('form-person');
            const selSaidas = document.getElementById('saidas-person-filter');

            const currentDash = selDashboard?.value || '';
            const currentForm = selForm?.value || '';
            const currentSaidas = pessoas.includes(listPersonFilters.saidas) ? listPersonFilters.saidas : '';
            if (currentSaidas !== listPersonFilters.saidas) listPersonFilters.saidas = currentSaidas;

            const dashOptions = '<option value="">Todas Pessoas</option>' + pessoas.map(p => `<option value="${p}" ${p === currentDash ? 'selected' : ''}>${p}</option>`).join('');
            const formOptions = pessoas.map(p => `<option value="${p}" ${p === currentForm ? 'selected' : ''}>${p}</option>`).join('');
            const saidasOptions = '<option value="">Todas pessoas</option>' + pessoas.map(p => `<option value="${p}" ${p === currentSaidas ? 'selected' : ''}>${p}</option>`).join('');

            if (selDashboard && selDashboard.innerHTML !== dashOptions) selDashboard.innerHTML = dashOptions;
            if (selForm && selForm.innerHTML !== formOptions) selForm.innerHTML = formOptions;
            if (selSaidas && selSaidas.innerHTML !== saidasOptions) selSaidas.innerHTML = saidasOptions;
            if (selSaidas) selSaidas.value = currentSaidas;
            syncPersonSalaryDefaults();
        }

        function getPersonRecord(personName = '') {
            return allRecords.find((record) =>
                record?.type === 'pessoa' &&
                String(record?.person || '').trim() === String(personName || '').trim()
            ) || null;
        }

        function getPersonBaseSalary(personName = '') {
            const personRecord = getPersonRecord(personName);
            return roundCurrency(personRecord?.salary_base || 0);
        }

        function getHourExtraMonthlyHours() {
            const field = document.getElementById('form-he-monthly-hours');
            return Number(field?.value) || 220;
        }

        function syncPersonSalaryDefaults() {
            const person = document.getElementById('form-person')?.value || '';
            const baseSalary = getPersonBaseSalary(person);
            const earningType = document.getElementById('form-earning-type')?.value || '';
            const amountField = document.getElementById('form-earning-amount');
            const hourExtraBaseSalaryField = document.getElementById('form-he-base-salary');
            const hourExtraMonthlyHoursField = document.getElementById('form-he-monthly-hours');

            if (earningType === 'Salário' && formCycle === 'QUINZENA' && amountField) {
                amountField.value = roundCurrency(baseSalary * 0.4).toFixed(2);
            }

            if (hourExtraBaseSalaryField) {
                hourExtraBaseSalaryField.value = baseSalary > 0 ? baseSalary.toFixed(2) : '';
            }

            if (hourExtraMonthlyHoursField && !hourExtraMonthlyHoursField.value) {
                hourExtraMonthlyHoursField.value = '220';
            }

            if (earningType === 'Hora Extra') {
                recalculateHourExtraValues();
            }
        }

        async function updatePersonBaseSalary(personId, value) {
            const current = allRecords.find((record) => record.id === personId && record.type === 'pessoa');
            if (!current) return;

            const result = await window.dataSdk.update({
                ...current,
                id: current.id,
                salary_base: roundCurrency(value)
            });

            if (!result.isOk) {
                showToast('Erro ao atualizar salário base', true);
                return;
            }

            syncPersonSalaryDefaults();
        }

        function getPeopleRecords() {
            return allRecords
                .filter((record) => record.type === 'pessoa')
                .sort((a, b) => String(a.person || '').localeCompare(String(b.person || ''), 'pt-BR'));
        }

        function getSalaryHistoryRecords(personName = '') {
            const normalizedPerson = String(personName || '').trim().toLowerCase();
            const explicitHistory = allRecords
                .filter((record) =>
                    record.type === 'salario_historico' &&
                    String(record.person || '').trim().toLowerCase() === normalizedPerson
                )
                .map((record) => ({
                    ...record,
                    competenciaInicio: normalizeCompetenceKey(record.vigencia_inicio || record.start_date || record.competence),
                    competenciaFim: normalizeCompetenceKey(record.vigencia_fim || record.end_date || ''),
                    salarioBase: roundCurrency(record.salary_base || record.amount || 0),
                    observacao: record.observation || record.description || ''
                }))
                .filter((record) => record.competenciaInicio)
                .sort((a, b) => (b.competenciaInicio || '').localeCompare(a.competenciaInicio || ''));

            if (explicitHistory.length) return explicitHistory;

            const personRecord = getPersonRecord(personName);
            if (!personRecord || !(Number(personRecord.salary_base) > 0)) return [];

            return [{
                id: `legacy_salary_${personRecord.id}`,
                type: 'salario_historico_legacy',
                person: personRecord.person,
                competenciaInicio: '1900-01',
                competenciaFim: '',
                salarioBase: roundCurrency(personRecord.salary_base || 0),
                observacao: 'Salário base legado',
                created_at: personRecord.created_at || ''
            }];
        }

        function getSalarioVigente(personName = '', competence = thisMonth) {
            const normalizedCompetence = normalizeCompetenceKey(competence) || thisMonth;
            const history = getSalaryHistoryRecords(personName);
            const active = history.find((record) =>
                record.competenciaInicio <= normalizedCompetence &&
                (!record.competenciaFim || record.competenciaFim >= normalizedCompetence)
            );

            if (active) {
                return {
                    ...active,
                    salary_base: active.salarioBase,
                    amount: active.salarioBase
                };
            }

            return history[0]
                ? { ...history[0], salary_base: history[0].salarioBase, amount: history[0].salarioBase }
                : null;
        }

        function getHourControlRecords(options = {}) {
            const { person = '', competence = '' } = options;
            return allRecords.filter((record) => {
                if (record.type !== 'controle_horas') return false;
                if (person && String(record.person || '').trim() !== String(person || '').trim()) return false;
                if (competence && normalizeCompetenceKey(record.competence) !== normalizeCompetenceKey(competence)) return false;
                return true;
            });
        }

        function calcularSaldoBanco(personName = '', competence = thisMonth) {
            const normalizedCompetence = normalizeCompetenceKey(competence) || thisMonth;
            if (typeof buildHourPeriodSummary === 'function') {
                const summary = buildHourPeriodSummary(allRecords, {
                    start: normalizedCompetence,
                    end: normalizedCompetence,
                    person: personName
                });
                return {
                    saldoAnterior: roundCurrency(summary.openingBankHours || 0),
                    horasDebito: roundCurrency(summary.bankDebitHours || 0),
                    horasCredito: roundCurrency(summary.bankCreditHours || 0),
                    saldoAtual: roundCurrency(summary.bankNetHours || 0)
                };
            }
            const bankRecords = getHourControlRecords({ person: personName })
                .filter((record) => String(record.hour_control_type || '') === 'Banco de Horas');

            let saldoAnterior = 0;
            let horasDebito = 0;
            let horasCredito = 0;

            bankRecords.forEach((record) => {
                const movement = calcularBancoHoras({
                    quantityHours: Number(record.quantidadeHoras) || 0,
                    natureza: record.bank_nature || 'Debito'
                });

                if (normalizeCompetenceKey(record.competence) < normalizedCompetence) {
                    saldoAnterior += movement.saldo;
                    return;
                }

                if (normalizeCompetenceKey(record.competence) === normalizedCompetence) {
                    horasDebito += movement.debito;
                    horasCredito += movement.credito;
                }
            });

            return {
                saldoAnterior: roundCurrency(saldoAnterior),
                horasDebito: roundCurrency(horasDebito),
                horasCredito: roundCurrency(horasCredito),
                saldoAtual: roundCurrency(saldoAnterior + horasDebito - horasCredito)
            };
        }

        function consolidarEntradaMensal(personName = '', competence = thisMonth) {
            if (typeof window.financeEntryApplication?.consolidatePersonMonthlyEntry === 'function') {
                return window.financeEntryApplication.consolidatePersonMonthlyEntry(personName, competence, { target: window, records: allRecords });
            }
            return null;
        }

        function getRelevantCompetenceRange() {
            const competences = [];

            allRecords.forEach((record) => {
                const competence = normalizeCompetenceKey(record.competence || record.vigencia_inicio || record.start_date || '');
                if (competence) competences.push(competence);
                const endCompetence = normalizeCompetenceKey(record.vigencia_fim || record.end_date || '');
                if (endCompetence) competences.push(endCompetence);
            });

            competences.push(thisMonth);
            competences.sort();
            return {
                min: competences[0] || thisMonth,
                max: competences[competences.length - 1] || thisMonth
            };
        }

        function buildCompetenceSequence(start, end) {
            const sequence = [];
            let cursor = start;
            while (cursor && cursor <= end) {
                sequence.push(cursor);
                cursor = shiftMonthValue(cursor, 1);
                if (sequence.length > 240) break;
            }
            return sequence;
        }

        function getConsolidatedEntradas() {
            return typeof window.getEntradasConsolidadas === 'function'
                ? window.getEntradasConsolidadas()
                : [];
        }

        function getGroupedHourControlSummaries() {
            const groups = {};

            getHourControlRecords().forEach((record) => {
                const competence = normalizeCompetenceKey(record.competence);
                const key = `${record.person}|${competence}`;
                if (!groups[key]) {
                    groups[key] = {
                        key,
                        person: record.person,
                        competence,
                        records: []
                    };
                }
                groups[key].records.push(record);
            });

            return Object.values(groups).map((group) => {
                const hourExtraTotal = roundCurrency(group.records
                    .filter((record) => String(record.hour_control_type || '') === 'Hora Extra')
                    .reduce((sum, record) => sum + (Number(record.valorTotalCalculado) || 0), 0));
                const bankSummary = calcularSaldoBanco(group.person, group.competence);

                return {
                    ...group,
                    totalHoraExtra: hourExtraTotal,
                    bankSummary
                };
            }).sort((a, b) => {
                const competenceCompare = (b.competence || '').localeCompare(a.competence || '');
                if (competenceCompare !== 0) return competenceCompare;
                return String(a.person || '').localeCompare(String(b.person || ''), 'pt-BR');
            });
        }

        function getCurrentSalaryHighlight(personName = '') {
            const current = getSalarioVigente(personName, thisMonth);
            return roundCurrency(current?.salary_base || getPersonBaseSalary(personName) || 0);
        }

        async function syncPersonCurrentSalary(personRecord) {
            if (!personRecord || personRecord.type !== 'pessoa') return;
            const highlightedSalary = getCurrentSalaryHighlight(personRecord.person);
            if (roundCurrency(personRecord.salary_base || 0) === highlightedSalary) return;

            await window.dataSdk.update({
                ...personRecord,
                id: personRecord.id,
                salary_base: highlightedSalary
            });
        }

        function updateMacroFilters() {
            const macros = allRecords.filter(r => r.type === 'macro').map(m => m.macro_category).sort();
            const selDashboard = document.getElementById('f-macro');
            const selForm = document.getElementById('form-macro');
            const selSaidas = document.getElementById('saidas-macro-filter');

            const currentDash = selDashboard?.value || '';
            const currentForm = selForm?.value || '';
            const currentSaidas = macros.includes(listMacroFilters.saidas) ? listMacroFilters.saidas : '';
            if (currentSaidas !== listMacroFilters.saidas) listMacroFilters.saidas = currentSaidas;

            const dashOptions = '<option value="">Todas Categorias</option>' + macros.map(m => `<option value="${m}" ${m === currentDash ? 'selected' : ''}>${m}</option>`).join('');
            const formOptions = '<option value="">Selecione...</option>' + macros.map(m => `<option value="${m}" ${m === currentForm ? 'selected' : ''}>${m}</option>`).join('');
            const saidasOptions = '<option value="">Todas categorias</option>' + macros.map(m => `<option value="${m}" ${m === currentSaidas ? 'selected' : ''}>${m}</option>`).join('');

            if (selDashboard && selDashboard.innerHTML !== dashOptions) selDashboard.innerHTML = dashOptions;
            if (selForm && selForm.innerHTML !== formOptions) selForm.innerHTML = formOptions;
            if (selSaidas && selSaidas.innerHTML !== saidasOptions) selSaidas.innerHTML = saidasOptions;
            if (selSaidas) selSaidas.value = currentSaidas;
        }

        function applySaidasListFilters(records) {
            return records.filter((record) => {
                if (listPersonFilters.saidas && record.person !== listPersonFilters.saidas) return false;
                if (listCycleFilters.saidas && record.cycle !== listCycleFilters.saidas) return false;
                if (listMacroFilters.saidas && record.macro_category !== listMacroFilters.saidas) return false;
                const exactDate = getSaidaExactDate(record);
                if (listDateFilters.saidas.start && (!exactDate || exactDate < listDateFilters.saidas.start)) return false;
                if (listDateFilters.saidas.end && (!exactDate || exactDate > listDateFilters.saidas.end)) return false;
                return true;
            });
        }

        function updateSaidasPaymentFilterOptions() {
            let baseRecords = getFiltered('saida', { archiveMode: listArchiveFilters.saidas });
            if (listDetailFilters.saidas === 'aberto') {
                baseRecords = baseRecords.filter((record) => record.status === 'Em aberto');
            } else if (listDetailFilters.saidas === 'pago') {
                baseRecords = baseRecords.filter((record) => record.status === 'Pago');
            }
            baseRecords = applySaidasListFilters(baseRecords);

            const payments = [...new Set(
                baseRecords
                    .map((record) => normalizePaymentFilterValue(record.payment_method))
                    .filter(Boolean)
            )].sort((a, b) => a.localeCompare(b, 'pt-BR'));
            const select = document.getElementById('saidas-payment-filter');
            if (!select) return;

            const currentValue = payments.includes(listPaymentFilters.saidas) ? listPaymentFilters.saidas : '';
            if (currentValue !== listPaymentFilters.saidas) {
                listPaymentFilters.saidas = currentValue;
            }
            const options = '<option value="">Todos pagamentos</option>' + payments.map((payment) => `<option value="${payment}" ${payment === currentValue ? 'selected' : ''}>${payment}</option>`).join('');
            if (select.innerHTML !== options) select.innerHTML = options;
            select.value = currentValue;
        }

        function setSaidasPaymentFilter(value) {
            listPaymentFilters.saidas = value || '';
            listPagination.saidas = LIST_PAGE_SIZE;
            renderSaidas();
        }

        function setSaidasPersonFilter(value) {
            listPersonFilters.saidas = value || '';
            listPagination.saidas = LIST_PAGE_SIZE;
            updateSaidasPaymentFilterOptions();
            renderSaidas();
        }

        function setSaidasCycleFilter(value) {
            listCycleFilters.saidas = value || '';
            listPagination.saidas = LIST_PAGE_SIZE;
            updateSaidasPaymentFilterOptions();
            renderSaidas();
        }

        function setSaidasMacroFilter(value) {
            listMacroFilters.saidas = value || '';
            listPagination.saidas = LIST_PAGE_SIZE;
            updateSaidasPaymentFilterOptions();
            renderSaidas();
        }

        function setSaidasDateStartFilter(value) {
            listDateFilters.saidas.start = value || '';
            listPagination.saidas = LIST_PAGE_SIZE;
            updateSaidasPaymentFilterOptions();
            renderSaidas();
        }

        function setSaidasDateEndFilter(value) {
            listDateFilters.saidas.end = value || '';
            listPagination.saidas = LIST_PAGE_SIZE;
            updateSaidasPaymentFilterOptions();
            renderSaidas();
        }

        function getFinancialStatusTone(value) {
            return (Number(value) || 0) >= 0
                ? {
                    text: 'Positivo',
                    valueClass: 'text-success',
                    badgeClass: 'bg-success/10 text-success border-success/20'
                }
                : {
                    text: 'Negativo',
                    valueClass: 'text-danger',
                    badgeClass: 'bg-danger/10 text-danger border-danger/20'
                };
        }

        function renderTrendInsights(summary) {
            const wrap = document.getElementById('trend-insights');
            if (!wrap) return;

            if (!summary) {
                wrap.innerHTML = '';
                wrap.className = 'hidden';
                return;
            }

            const statusTone = getFinancialStatusTone(summary.currentValue);
            wrap.className = 'grid grid-cols-2 xl:grid-cols-4 gap-3 mb-4';
            wrap.innerHTML = `
                <div class="rounded-xl border border-surfaceLight bg-surfaceLight/35 px-4 py-3">
                    <p class="text-[11px] uppercase tracking-[0.14em] text-textSecondary">Sobra média mensal</p>
                    <p class="mt-2 text-base font-bold ${getFinancialStatusTone(summary.average).valueClass}">${fmt(summary.average)}</p>
                </div>
                <div class="rounded-xl border border-surfaceLight bg-surfaceLight/35 px-4 py-3">
                    <p class="text-[11px] uppercase tracking-[0.14em] text-textSecondary">Melhor mês</p>
                    <p class="mt-2 text-base font-bold text-success">${fmt(summary.bestValue)}</p>
                    <p class="mt-1 text-xs text-textSecondary">${summary.bestLabel}</p>
                </div>
                <div class="rounded-xl border border-surfaceLight bg-surfaceLight/35 px-4 py-3">
                    <p class="text-[11px] uppercase tracking-[0.14em] text-textSecondary">Pior mês</p>
                    <p class="mt-2 text-base font-bold ${getFinancialStatusTone(summary.worstValue).valueClass}">${fmt(summary.worstValue)}</p>
                    <p class="mt-1 text-xs text-textSecondary">${summary.worstLabel}</p>
                </div>
                <div class="rounded-xl border ${statusTone.badgeClass} bg-surface px-4 py-3">
                    <p class="text-[11px] uppercase tracking-[0.14em] text-textSecondary">Situação atual</p>
                    <p class="mt-2 text-base font-bold ${statusTone.valueClass}">${statusTone.text}</p>
                    <p class="mt-1 text-xs text-textSecondary">${summary.currentLabel} • ${fmt(summary.currentValue)}</p>
                </div>
            `;
        }

        function renderDailyTrendInsights(summary) {
            const wrap = document.getElementById('trend-insights');
            if (!wrap) return;

            if (!summary) {
                wrap.innerHTML = '';
                wrap.className = 'hidden';
                return;
            }

            wrap.className = 'grid grid-cols-2 xl:grid-cols-4 gap-3 mb-4';
            wrap.innerHTML = `
                <div class="rounded-xl border border-surfaceLight bg-surfaceLight/35 px-4 py-3">
                    <p class="text-[11px] uppercase tracking-[0.14em] text-textSecondary">Total do mês</p>
                    <p class="mt-2 text-base font-bold text-danger">${fmt(summary.total)}</p>
                </div>
                <div class="rounded-xl border border-surfaceLight bg-surfaceLight/35 px-4 py-3">
                    <p class="text-[11px] uppercase tracking-[0.14em] text-textSecondary">Dia mais pesado</p>
                    <p class="mt-2 text-base font-bold text-danger">${fmt(summary.peakValue)}</p>
                    <p class="mt-1 text-xs text-textSecondary">Dia ${summary.peakLabel}</p>
                </div>
                <div class="rounded-xl border border-surfaceLight bg-surfaceLight/35 px-4 py-3">
                    <p class="text-[11px] uppercase tracking-[0.14em] text-textSecondary">Média por dia com gasto</p>
                    <p class="mt-2 text-base font-bold ${summary.averageActive > 0 ? 'text-warn' : 'text-textPrimary'}">${fmt(summary.averageActive)}</p>
                    <p class="mt-1 text-xs text-textSecondary">${summary.activeDays} dia(s) com movimento</p>
                </div>
                <div class="rounded-xl border border-surfaceLight bg-surfaceLight/35 px-4 py-3">
                    <p class="text-[11px] uppercase tracking-[0.14em] text-textSecondary">Semana mais forte</p>
                    <p class="mt-2 text-base font-bold text-danger">${fmt(summary.peakWeekValue)}</p>
                    <p class="mt-1 text-xs text-textSecondary">${summary.peakWeekLabel}</p>
                </div>
            `;
        }

        window.dashboardDataLabelPlugin = {
            id: 'dashboardDataLabelPlugin',
            beforeDatasetsDraw(chart, args, pluginOptions) {
                if (pluginOptions?.mode !== 'financial-combo-monthly') return;

                const yScale = chart.scales?.y;
                const chartArea = chart.chartArea;
                if (!yScale || !chartArea) return;

                const zeroY = yScale.getPixelForValue(0);
                if (!Number.isFinite(zeroY) || zeroY < chartArea.top || zeroY > chartArea.bottom) return;

                const ctx = chart.ctx;
                ctx.save();
                ctx.beginPath();
                ctx.moveTo(chartArea.left, zeroY);
                ctx.lineTo(chartArea.right, zeroY);
                ctx.lineWidth = 1.5;
                ctx.strokeStyle = getThemeChartColor('--chart-grid-color', 'rgba(15, 23, 42, 0.35)');
                ctx.stroke();
                ctx.restore();
            },
            afterDatasetsDraw(chart, args, pluginOptions) {
                const mode = pluginOptions?.mode;
                if (!mode) return;

                const ctx = chart.ctx;
                const chartArea = chart.chartArea || {};

                ctx.save();
                ctx.font = '600 11px "Segoe UI", sans-serif';
                ctx.textBaseline = 'middle';
                ctx.strokeStyle = getThemeSurfaceStrokeColor();
                ctx.lineWidth = currentTheme === 'dark' ? 4 : 3;
                ctx.lineJoin = 'round';

                if (mode === 'daily-spend-objective') {
                    const datasetIndex = Number.isInteger(pluginOptions?.datasetIndex) ? pluginOptions.datasetIndex : 0;
                    const dataset = chart.data.datasets?.[datasetIndex];
                    const meta = chart.getDatasetMeta(datasetIndex);
                    const elements = meta?.data || [];
                    if (!dataset || !elements.length) {
                        ctx.restore();
                        return;
                    }

                    const values = (dataset.data || []).map((value) => Number(value) || 0);
                    const nonZeroIndexes = values
                        .map((value, index) => ({ value, index }))
                        .filter((item) => item.value > 0);

                    if (nonZeroIndexes.length) {
                        const lastNonZero = nonZeroIndexes[nonZeroIndexes.length - 1].index;
                        const peakIndex = nonZeroIndexes.reduce((best, item) => item.value > values[best] ? item.index : best, nonZeroIndexes[0].index);
                        const indexes = new Set([lastNonZero, peakIndex]);

                        [...indexes].forEach((index) => {
                            const element = elements[index];
                            if (!element) return;
                            const value = values[index];
                            const text = fmtCompactCurrency(value);
                            const y = Math.max(element.y - 12, chartArea.top + 12);
                            ctx.fillStyle = getThemeChartColor('--chart-negative-color', '#be123c');
                            ctx.textAlign = 'center';
                            ctx.strokeText(text, element.x, y);
                            ctx.fillText(text, element.x, y);
                        });
                    }

                    const weekLabels = pluginOptions?.weekLabels || [];
                    if (weekLabels.length) {
                        const xScale = chart.scales?.x;
                        if (xScale) {
                            ctx.font = '600 10px "Segoe UI", sans-serif';
                            ctx.fillStyle = getThemeChartColor('--chart-muted-color', '#94a3b8');
                            ctx.strokeStyle = 'transparent';
                            ctx.textAlign = 'center';
                            const labelY = chartArea.bottom + 24;

                            weekLabels.forEach((week) => {
                                const firstX = xScale.getPixelForTick(week.startIndex);
                                const lastX = xScale.getPixelForTick(week.endIndex);
                                const centerX = (firstX + lastX) / 2;
                                ctx.fillText(week.label, centerX, labelY);

                                if (week.endIndex < (chart.data.labels?.length || 0) - 1) {
                                    const boundaryX = (lastX + xScale.getPixelForTick(week.endIndex + 1)) / 2;
                                    ctx.save();
                                    ctx.beginPath();
                                    ctx.moveTo(boundaryX, chartArea.bottom + 4);
                                    ctx.lineTo(boundaryX, chartArea.bottom + 16);
                                    ctx.lineWidth = 1;
                                    ctx.strokeStyle = getThemeChartColor('--chart-divider-color', 'rgba(148, 163, 184, 0.45)');
                                    ctx.stroke();
                                    ctx.restore();
                                }
                            });
                        }
                    }

                    ctx.restore();
                    return;
                }

                if (mode === 'financial-combo-monthly') {
                    const datasetIndex = Number.isInteger(pluginOptions?.datasetIndex) ? pluginOptions.datasetIndex : (chart.data.datasets?.length || 1) - 1;
                    const dataset = chart.data.datasets?.[datasetIndex];
                    const meta = chart.getDatasetMeta(datasetIndex);
                    const elements = meta?.data || [];
                    if (!dataset || !elements.length) {
                        ctx.restore();
                        return;
                    }

                    const values = (dataset.data || []).map((value) => Number(value) || 0);
                    const indexes = new Set([values.length - 1]);
                    let maxIndex = 0;
                    let minIndex = 0;
                    values.forEach((value, index) => {
                        if (value > values[maxIndex]) maxIndex = index;
                        if (value < values[minIndex]) minIndex = index;
                    });
                    indexes.add(maxIndex);
                    indexes.add(minIndex);

                    [...indexes].forEach((index) => {
                        const element = elements[index];
                        if (!element) return;
                        const value = values[index];
                        const text = fmtCompactCurrency(value);
                        const yOffset = value >= 0 ? -14 : 16;
                        const y = Math.min(Math.max(element.y + yOffset, chartArea.top + 12), chartArea.bottom - 12);
                        ctx.fillStyle = value >= 0
                            ? getThemeChartColor('--chart-positive-color', '#0f766e')
                            : getThemeChartColor('--chart-negative-color', '#be123c');
                        ctx.textAlign = 'center';
                        ctx.strokeText(text, element.x, y);
                        ctx.fillText(text, element.x, y);
                    });
                    ctx.restore();
                    return;
                }

                const dataset = chart.data.datasets?.[0];
                const meta = chart.getDatasetMeta(0);
                const elements = meta?.data || [];
                if (!dataset || !elements.length) {
                    ctx.restore();
                    return;
                }

                const values = (dataset.data || []).map((value) => Number(value) || 0);
                const total = values.reduce((sum, value) => sum + value, 0);
                ctx.fillStyle = getThemeChartColor('--chart-label-color', '#0f172a');

                elements.forEach((element, index) => {
                    const value = values[index];
                    if (!value) return;

                    let text = '';
                    let x = 0;
                    let y = 0;
                    let textAlign = 'center';

                    if (mode === 'doughnut-percentage') {
                        if (!total) return;
                        const ratio = (value / total) * 100;
                        if (ratio < 7) return;
                        const percentage = ratio.toFixed(1).replace('.', ',') + '%';
                        const angle = (element.startAngle + element.endAngle) / 2;
                        const radius = element.innerRadius + ((element.outerRadius - element.innerRadius) * 0.62);
                        x = element.x + Math.cos(angle) * radius;
                        y = element.y + Math.sin(angle) * radius;
                        text = percentage;
                    } else if (mode === 'bar-currency-vertical') {
                        x = element.x;
                        y = Math.max(element.y - 10, chartArea.top + 10);
                        text = fmtCompactCurrency(value);
                    } else if (mode === 'bar-currency-horizontal') {
                        x = Math.min(element.x + 10, (chartArea.right || element.x) - 4);
                        y = element.y;
                        text = fmtCompactCurrency(value);
                        textAlign = x >= (chartArea.right || x) - 8 ? 'right' : 'left';
                    } else {
                        return;
                    }

                    ctx.textAlign = textAlign;
                    ctx.strokeText(text, x, y);
                    ctx.fillText(text, x, y);
                });

                ctx.restore();
            }
        };

        function formatCompetence(comp) {
            if (!comp) return '';
            const parts = comp.split('-');
            if (parts.length !== 2) return comp;
            const months = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
            const m = parseInt(parts[1], 10) - 1;
            return `${months[m]}/${parts[0]}`;
        }

        function formatDayLabel(isoDate) {
            if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return isoDate || '';
            return isoDate.slice(8, 10);
        }

        function getDaysInCompetenceMonth(competence) {
            const normalized = normalizeCompetenceValue(competence);
            if (!normalized) return 0;
            const [year, month] = normalized.split('-').map(Number);
            return new Date(year, month, 0).getDate();
        }

        function getSaidaTrendDate(record, targetMonth = '') {
            const candidates = [
                record.status === 'Pago' ? record.paid_at : '',
                record.due_date,
                record.occurred_date,
                competenceToIsoDate(record.competence)
            ].filter(Boolean);

            if (targetMonth) {
                const inTargetMonth = candidates.find((dateValue) => dateValue.startsWith(`${targetMonth}-`));
                if (inTargetMonth) return inTargetMonth;
            }

            return candidates[0] || '';
        }

        function getRecordSortDate(record) {
            if (!record) return '';
            if (record.type === 'saida') {
                return record.paid_at || record.due_date || record.occurred_date || competenceToIsoDate(record.competence) || record.created_at || '';
            }
            if (record.type === 'entrada') {
                return record.occurred_date || record.due_date || competenceToIsoDate(record.competence) || record.created_at || '';
            }
            return record.created_at || '';
        }

        function dateValueToTimestamp(value) {
            if (!value) return Number.NEGATIVE_INFINITY;
            if (value instanceof Date) {
                const time = value.getTime();
                return Number.isNaN(time) ? Number.NEGATIVE_INFINITY : time;
            }

            const normalizedValue = String(value).trim();
            if (!normalizedValue) return Number.NEGATIVE_INFINITY;

            const brMatch = normalizedValue.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
            if (brMatch) {
                const time = new Date(`${brMatch[3]}-${brMatch[2]}-${brMatch[1]}T00:00:00`).getTime();
                return Number.isNaN(time) ? Number.NEGATIVE_INFINITY : time;
            }

            const competenceMatch = normalizedValue.match(/^(\d{4})-(\d{2})$/);
            if (competenceMatch) {
                const time = new Date(`${normalizedValue}-01T00:00:00`).getTime();
                return Number.isNaN(time) ? Number.NEGATIVE_INFINITY : time;
            }

            const isoDateMatch = normalizedValue.match(/^(\d{4})-(\d{2})-(\d{2})$/);
            if (isoDateMatch) {
                const time = new Date(`${normalizedValue}T00:00:00`).getTime();
                return Number.isNaN(time) ? Number.NEGATIVE_INFINITY : time;
            }

            const time = new Date(normalizedValue).getTime();
            return Number.isNaN(time) ? Number.NEGATIVE_INFINITY : time;
        }

        function sortRecordsNewestFirst(records = []) {
            return [...records].sort((a, b) => {
                const primary = dateValueToTimestamp(getRecordSortDate(b)) - dateValueToTimestamp(getRecordSortDate(a));
                if (primary !== 0) return primary;
                return dateValueToTimestamp(b.created_at) - dateValueToTimestamp(a.created_at);
            });
        }

        function setFocusedCard(card) {
            if (focusedDashboardCard === card) focusedDashboardCard = null;
            else focusedDashboardCard = card;
            renderDashboard();
            if (focusedDashboardCard) {
                document.getElementById('recent-container').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        }

        function ensureDashboardChartLayout() {
            const grid = document.getElementById('dashboard-chart-grid');
            const categoryCanvas = document.getElementById('chart-category');
            const detailCanvas = document.getElementById('chart-category-detail');
            const personCanvas = document.getElementById('chart-person');
            if (!grid || !categoryCanvas || !detailCanvas || !personCanvas) return;

            const categoryCard = categoryCanvas.closest('.glass');
            const detailCard = detailCanvas.closest('.glass');
            const personCard = personCanvas.closest('.glass');
            if (!categoryCard || !detailCard || !personCard) return;

            let stack = document.getElementById('dashboard-chart-left-stack');
            if (!stack) {
                stack = document.createElement('div');
                stack.id = 'dashboard-chart-left-stack';
                stack.className = 'space-y-4 xl:col-span-1';
                grid.insertBefore(stack, detailCard);
            }

            if (categoryCard.parentElement !== stack) stack.appendChild(categoryCard);
            if (personCard.parentElement !== stack) stack.appendChild(personCard);
            detailCard.classList.add('xl:col-span-2');
        }

        function openDashboardDetail(mode) {
            if (!mode) return;

            listDetailFilters.saidas = '';
            listDetailFilters.entradas = '';

            if (mode === 'entradas') {
                switchTab('entradas');
                return;
            }

            if (mode === 'saidas') {
                listDetailFilters.saidas = 'pago';
                switchTab('saidas');
                return;
            }

            if (mode === 'aberto') {
                listDetailFilters.saidas = 'aberto';
                switchTab('saidas');
                return;
            }

            if (mode === 'saldo') {
                focusedDashboardCard = 'saldo';
                switchTab('dashboard');
                document.getElementById('recent-container')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        }

        function openDashboardCategoryDetail(label) {
            const detailLabel = String(label || '').trim();
            if (!detailLabel) return;

            listDetailFilters.saidas = '';
            listPaymentFilters.saidas = '';
            listSearchFilters.saidas = detailLabel;
            listPagination.saidas = LIST_PAGE_SIZE;

            switchTab('saidas');

            const searchInput = document.getElementById('saidas-search');
            if (searchInput) searchInput.value = detailLabel;
        }

        function renderDashboardLegacyFallback() {
            updateDashboardFilterChipState();
            const filteredRecords = getFiltered();
            const saidas = filteredRecords.filter(r => r.type === 'saida');
            const entradas = filteredRecords.filter(r => r.type === 'entrada');
            const financialEntradas = entradas.filter(isFinancialEntradaRecord);
            const paidSaidas = saidas.filter((r) => r.status === 'Pago');
            const openSaidas = saidas.filter((r) => r.status === 'Em aberto');

            const totalEntradas = financialEntradas.reduce((s, r) => {
                const v = Number(r.amount) || 0;
                return r.macro_category === 'Dedução' ? s - v : s + v;
            }, 0);
            const totalSaidas = paidSaidas.reduce((s, r) => s + (Number(r.amount) || 0), 0);
            const totalAberto = openSaidas.reduce((s, r) => s + (Number(r.amount) || 0), 0);
            const saldo = totalEntradas - totalSaidas - totalAberto;

            document.getElementById('summary-cards').innerHTML = `
    <div data-dashboard-card="entradas" class="glass rounded-xl p-3 card-hover transition-colors ${focusedDashboardCard === 'entradas' ? 'border-success shadow-[0_0_15px_rgba(52,211,153,0.3)]' : 'border-surfaceLight'}" title="Filtrar detalhes de entradas">
      <p class="text-xs text-textSecondary">Entradas</p>
      <p class="text-lg font-bold text-success">${fmt(totalEntradas)}</p>
      <button type="button" data-dashboard-open-detail="entradas" class="mt-3 text-xs text-success font-semibold hover:underline">Abrir lista</button>
    </div>
    <div data-dashboard-card="saidas" class="glass rounded-xl p-3 card-hover transition-colors ${focusedDashboardCard === 'saidas' ? 'border-danger shadow-[0_0_15px_rgba(244,63,94,0.3)]' : 'border-surfaceLight'}" title="Filtrar detalhes de saídas">
      <p class="text-xs text-textSecondary">Saídas</p>
      <p class="text-lg font-bold text-danger">${fmt(totalSaidas)}</p>
      <button type="button" data-dashboard-open-detail="saidas" class="mt-3 text-xs text-danger font-semibold hover:underline">Abrir lista</button>
    </div>
    <div data-dashboard-card="aberto" class="glass rounded-xl p-3 card-hover transition-colors ${focusedDashboardCard === 'aberto' ? 'border-warn shadow-[0_0_15px_rgba(251,191,36,0.3)]' : 'border-surfaceLight'}" title="Filtrar contas em aberto">
      <p class="text-xs text-textSecondary">Em Aberto</p>
      <p class="text-lg font-bold text-warn">${fmt(totalAberto)}</p>
      <button type="button" data-dashboard-open-detail="aberto" class="mt-3 text-xs text-warn font-semibold hover:underline">Ver pendências</button>
    </div>
    <div data-dashboard-card="saldo" class="glass rounded-xl p-3 card-hover transition-colors ${focusedDashboardCard === 'saldo' ? 'border-accent shadow-[0_0_15px_rgba(56,189,248,0.3)]' : 'border-surfaceLight'}" title="Filtrar movimentações gerais">
      <p class="text-xs text-textSecondary">Saldo</p>
      <p class="text-lg font-bold ${saldo >= 0 ? 'text-success' : 'text-danger'}">${fmt(saldo)}</p>
      <button type="button" data-dashboard-open-detail="saldo" class="mt-3 text-xs text-accent font-semibold hover:underline">Ver detalhes</button>
    </div>
  `;
            renderActiveDashboardFilters();
            renderDashboardPersonBalanceCards();
            ensureDashboardChartLayout();

            const byCat = {};
            paidSaidas.forEach(r => {
                const k = r.macro_category || 'Outros';
                byCat[k] = (byCat[k] || 0) + (Number(r.amount) || 0);
            });

            const bySubcategory = {};
            paidSaidas.forEach((r) => {
                const key = r.subcategory || r.description || 'Sem detalhe';
                bySubcategory[key] = (bySubcategory[key] || 0) + (Number(r.amount) || 0);
            });
            const topSubcategories = Object.entries(bySubcategory)
                .sort((a, b) => b[1] - a[1]);

            const catCtx = document.getElementById('chart-category');
            if (chartInstances.category) chartInstances.category.destroy();
            chartInstances.category = new Chart(catCtx, {
                type: 'doughnut',
                plugins: [dashboardDataLabelPlugin],
                data: {
                    labels: Object.keys(byCat),
                    datasets: [{
                        data: Object.values(byCat),
                        backgroundColor: ['#38bdf8', '#fbbf24', '#34d399'],
                        borderColor: currentTheme === 'dark' ? '#0f172a' : '#ffffff',
                        borderWidth: 3,
                        hoverOffset: 6
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: '62%',
                    layout: { padding: 8 },
                    onClick: (event, elements, chart) => {
                        if (elements.length > 0) {
                            const index = elements[0].index;
                            const label = chart.data.labels[index];
                            document.getElementById('f-macro').value = label;
                            renderDashboard();
                            document.getElementById('summary-cards').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                        }
                    },
                    plugins: {
                        dashboardDataLabelPlugin: {
                            mode: 'doughnut-percentage'
                        },
                        legend: {
                            position: 'bottom',
                            labels: {
                                color: getThemeTextSecondaryColor(),
                                font: { size: 10 },
                                padding: 8,
                                usePointStyle: true,
                                pointStyle: 'circle',
                                boxWidth: 8
                            }
                        },
                        tooltip: {
                            callbacks: {
                                label: (context) => {
                                    const totalValue = context.dataset.data.reduce((sum, item) => sum + (Number(item) || 0), 0);
                                    const currentValue = Number(context.parsed) || 0;
                                    const percent = totalValue ? ((currentValue / totalValue) * 100).toFixed(1).replace('.', ',') : '0,0';
                                    return `${context.label}: ${fmt(currentValue)} (${percent}%)`;
                                }
                            }
                        }
                    }
                }
            });

            const categoryDetailCtx = document.getElementById('chart-category-detail');
            const categoryDetailWrap = categoryDetailCtx?.parentElement || null;
            if (categoryDetailWrap) {
                categoryDetailWrap.style.height = `${Math.max(320, topSubcategories.length * 34)}px`;
            }
            if (chartInstances.categoryDetail) chartInstances.categoryDetail.destroy();
            chartInstances.categoryDetail = new Chart(categoryDetailCtx, {
                type: 'bar',
                plugins: [dashboardDataLabelPlugin],
                data: {
                    labels: topSubcategories.map(([label]) => label),
                    datasets: [{
                        label: 'Saídas por subcategoria',
                        data: topSubcategories.map(([, value]) => value),
                        backgroundColor: topSubcategories.map((_, index) => {
                            const palette = ['#0ea5e9', '#38bdf8', '#7dd3fc', '#67e8f9', '#a5f3fc', '#bae6fd'];
                            return palette[index % palette.length];
                        }),
                        borderRadius: 6,
                        borderWidth: 0,
                        barPercentage: 0.72,
                        categoryPercentage: 0.86
                    }]
                },
                options: {
                    indexAxis: 'y',
                    responsive: true,
                    maintainAspectRatio: false,
                    layout: { padding: { top: 12, right: 18 } },
                    onClick: (event, elements, chart) => {
                        if (elements.length > 0) {
                            const index = elements[0].index;
                            const label = chart.data.labels[index];
                            openDashboardCategoryDetail(label);
                        }
                    },
                    plugins: {
                        dashboardDataLabelPlugin: {
                            mode: 'bar-currency-horizontal'
                        },
                        legend: { display: false }
                    },
                    scales: {
                        x: {
                            grid: { display: false, drawBorder: false },
                            ticks: {
                                display: false
                            }
                        },
                        y: {
                            grid: { display: false, drawBorder: false },
                            ticks: {
                                color: getThemeTextSecondaryColor(),
                                font: { size: 10 },
                                autoSkip: false,
                                callback: function(value) {
                                    const label = this.getLabelForValue(value);
                                    return label && label.length > 28 ? `${label.slice(0, 28)}...` : label;
                                }
                            }
                        }
                    }
                }
            });

            const byPerson = {};
            paidSaidas.forEach(r => {
                const k = r.person || '?';
                byPerson[k] = (byPerson[k] || 0) + (Number(r.amount) || 0);
            });
            const sortedPeople = Object.entries(byPerson).sort((a, b) => b[1] - a[1]);

            const personCtx = document.getElementById('chart-person');
            if (chartInstances.person) chartInstances.person.destroy();
            chartInstances.person = new Chart(personCtx, {
                type: 'bar',
                plugins: [dashboardDataLabelPlugin],
                data: {
                    labels: sortedPeople.map(([label]) => label),
                    datasets: [{
                        label: 'Gastos',
                        data: sortedPeople.map(([, value]) => value),
                        backgroundColor: '#38bdf8',
                        borderColor: '#0284c7',
                        borderWidth: 1,
                        borderRadius: 4,
                        barPercentage: 0.6,
                        categoryPercentage: 0.7
                    }]
                },
                options: {
                    indexAxis: 'y',
                    responsive: true,
                    maintainAspectRatio: false,
                    layout: { padding: { right: 18 } },
                    onClick: (event, elements, chart) => {
                        if (elements.length > 0) {
                            const index = elements[0].index;
                            const label = chart.data.labels[index];
                            document.getElementById('f-person').value = label;
                            renderDashboard();
                            document.getElementById('summary-cards').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                        }
                    },
                    plugins: {
                        dashboardDataLabelPlugin: {
                            mode: 'bar-currency-horizontal'
                        },
                        legend: { display: false }
                    },
                    scales: {
                        x: {
                            grid: { display: false, drawBorder: false },
                            ticks: { display: false }
                        },
                        y: {
                            ticks: { color: getThemeTextSecondaryColor(), font: { size: 11 } },
                            grid: { display: false }
                        }
                    }
                }
            });

            const startVal = document.getElementById('f-comp-start').value;
            const endVal = document.getElementById('f-comp-end').value;
            const trendTitle = document.getElementById('chart-trend-title');
            const trendInsights = document.getElementById('trend-insights');
            const isSingleSelectedMonth = Boolean(startVal && endVal && startVal === endVal);
            const trendLabels = [];
            const trendDatasets = [];
            let trendSummary = null;
            let trendChartType = 'line';
            let dailyWeekLabels = [];
            let monthlyTrendKeys = [];

            if (isSingleSelectedMonth) {
                const daysInMonth = getDaysInCompetenceMonth(startVal);
                const dailyData = {};
                for (let day = 1; day <= daysInMonth; day++) {
                    const dayStr = String(day).padStart(2, '0');
                    dailyData[`${startVal}-${dayStr}`] = 0;
                }

                filteredRecords.forEach((record) => {
                    if (record.type !== 'saida' || (record.status !== 'Pago' && record.status !== 'Em aberto')) return;
                    const trendDate = getSaidaTrendDate(record, startVal);
                    if (dailyData[trendDate] !== undefined) {
                        dailyData[trendDate] += Number(record.amount) || 0;
                    }
                });

                if (trendTitle) trendTitle.textContent = `Gastos Diários (${formatCompetence(startVal)})`;
                const dailyValues = Object.values(dailyData);
                const activeDailyValues = dailyValues.filter((value) => value > 0);
                let peakDayIndex = 0;
                dailyValues.forEach((value, index) => {
                    if (value > dailyValues[peakDayIndex]) peakDayIndex = index;
                });

                dailyWeekLabels = Array.from({ length: Math.ceil(daysInMonth / 7) }, (_, weekIndex) => ({
                    label: `Sem ${weekIndex + 1}`,
                    startIndex: weekIndex * 7,
                    endIndex: Math.min(daysInMonth - 1, (weekIndex * 7) + 6)
                }));
                const weeklyTotals = dailyWeekLabels.map((week) => ({
                    label: week.label,
                    total: dailyValues.slice(week.startIndex, week.endIndex + 1).reduce((sum, value) => sum + value, 0)
                }));
                const peakWeek = weeklyTotals.reduce((best, item) => item.total > best.total ? item : best, weeklyTotals[0] || { label: 'Sem 1', total: 0 });

                renderDailyTrendInsights({
                    total: dailyValues.reduce((sum, value) => sum + value, 0),
                    peakLabel: formatDayLabel(Object.keys(dailyData)[peakDayIndex] || ''),
                    peakValue: dailyValues[peakDayIndex] || 0,
                    averageActive: activeDailyValues.length ? activeDailyValues.reduce((sum, value) => sum + value, 0) / activeDailyValues.length : 0,
                    activeDays: activeDailyValues.length,
                    peakWeekLabel: peakWeek.label,
                    peakWeekValue: peakWeek.total
                });

                trendLabels.push(...Object.keys(dailyData).map(formatDayLabel));
                trendChartType = 'bar';
                trendDatasets.push({
                    type: 'bar',
                    label: 'Gastos diários',
                    data: dailyValues,
                    backgroundColor: dailyValues.map((value, index) => {
                        if (!value) return 'rgba(226, 232, 240, 0.55)';
                        if (index === peakDayIndex) return 'rgba(225, 29, 72, 0.85)';
                        return 'rgba(244, 63, 94, 0.45)';
                    }),
                    borderColor: dailyValues.map((value, index) => index === peakDayIndex ? '#be123c' : '#f43f5e'),
                    borderWidth: dailyValues.map((value) => value > 0 ? 1 : 0),
                    borderRadius: 6,
                    categoryPercentage: 0.92,
                    barPercentage: 0.92
                }, {
                    type: 'line',
                    label: 'Média diária',
                    data: dailyValues.map(() => activeDailyValues.length ? activeDailyValues.reduce((sum, value) => sum + value, 0) / activeDailyValues.length : 0),
                    borderColor: 'rgba(71, 85, 105, 0.9)',
                    backgroundColor: 'transparent',
                    tension: 0,
                    fill: false,
                    borderWidth: 1.5,
                    borderDash: [5, 5],
                    pointRadius: 0,
                    pointHoverRadius: 0
                });
            } else {
                const monthsData = {};
                let tmpStrStart = startVal || thisMonth;
                let tmpStrEnd = endVal || thisMonth;

                let [sy, sm] = tmpStrStart.split('-').map(Number);
                let [ey, em] = tmpStrEnd.split('-').map(Number);

                let count = 0;
                const tmpd = new Date(sy, sm - 1, 1);
                while (count < 120 && (tmpd.getFullYear() < ey || (tmpd.getFullYear() === ey && tmpd.getMonth() + 1 <= em))) {
                    const monthStr = tmpd.getFullYear() + '-' + String(tmpd.getMonth() + 1).padStart(2, '0');
                    monthsData[monthStr] = { entrada: 0, saida: 0 };
                    tmpd.setMonth(tmpd.getMonth() + 1);
                    count++;
                }

                filteredRecords.forEach((record) => {
                    const comp = record.competence;
                    if (monthsData[comp] !== undefined) {
                        if (record.type === 'entrada' && isFinancialEntradaRecord(record)) {
                            const v = Number(record.amount) || 0;
                            monthsData[comp].entrada += record.macro_category === 'Dedução' ? -v : v;
                        } else if (record.type === 'saida' && (record.status === 'Pago' || record.status === 'Em aberto')) {
                            monthsData[comp].saida += Number(record.amount) || 0;
                        }
                    }
                });

                if (trendTitle) trendTitle.textContent = 'Fluxo Financeiro Mensal';
                monthlyTrendKeys = Object.keys(monthsData);
                const monthlyLabels = monthlyTrendKeys.map(formatCompetence);
                const monthlyValues = Object.values(monthsData);
                const monthlyEntradas = monthlyValues.map((month) => month.entrada);
                const monthlySaidas = monthlyValues.map((month) => month.saida);
                const monthlyBalance = monthlyValues.map((month) => month.entrada - month.saida);
                const averageBalance = monthlyBalance.length
                    ? monthlyBalance.reduce((sum, value) => sum + value, 0) / monthlyBalance.length
                    : 0;
                let bestIndex = 0;
                let worstIndex = 0;
                monthlyBalance.forEach((value, index) => {
                    if (value > monthlyBalance[bestIndex]) bestIndex = index;
                    if (value < monthlyBalance[worstIndex]) worstIndex = index;
                });

                trendSummary = {
                    average: averageBalance,
                    bestLabel: monthlyLabels[bestIndex] || '-',
                    bestValue: monthlyBalance[bestIndex] || 0,
                    worstLabel: monthlyLabels[worstIndex] || '-',
                    worstValue: monthlyBalance[worstIndex] || 0,
                    currentLabel: monthlyLabels[monthlyLabels.length - 1] || '-',
                    currentValue: monthlyBalance[monthlyBalance.length - 1] || 0
                };
                renderTrendInsights(trendSummary);

                trendLabels.push(...monthlyLabels);
                trendChartType = 'bar';
                trendDatasets.push(
                    {
                        type: 'bar',
                        label: 'Entradas',
                        data: monthlyEntradas,
                        backgroundColor: 'rgba(52, 211, 153, 0.32)',
                        borderColor: 'rgba(52, 211, 153, 0.75)',
                        borderWidth: 1,
                        borderRadius: 8,
                        categoryPercentage: 0.7,
                        barPercentage: 0.82,
                        order: 3
                    },
                    {
                        type: 'bar',
                        label: 'Saídas',
                        data: monthlySaidas,
                        backgroundColor: 'rgba(244, 63, 94, 0.26)',
                        borderColor: 'rgba(244, 63, 94, 0.7)',
                        borderWidth: 1,
                        borderRadius: 8,
                        categoryPercentage: 0.7,
                        barPercentage: 0.82,
                        order: 3
                    },
                    {
                        type: 'line',
                        label: 'Sobra',
                        data: monthlyBalance,
                        borderColor: '#0369a1',
                        backgroundColor: 'rgba(3, 105, 161, 0.12)',
                        tension: monthlyLabels.length <= 1 ? 0 : 0.28,
                        fill: false,
                        borderWidth: 3,
                        pointBackgroundColor: monthlyBalance.map((value) => value >= 0 ? '#0369a1' : '#e11d48'),
                        pointBorderColor: monthlyBalance.map((value) => value >= 0 ? '#e0f2fe' : '#ffe4e6'),
                        pointBorderWidth: 2,
                        pointRadius: monthlyBalance.map((value) => value < 0 ? 5 : 4),
                        pointHoverRadius: monthlyBalance.map((value) => value < 0 ? 6 : 5),
                        order: 1
                    },
                    {
                        type: 'line',
                        label: 'Média da sobra',
                        data: monthlyBalance.map(() => averageBalance),
                        borderColor: 'rgba(71, 85, 105, 0.9)',
                        backgroundColor: 'transparent',
                        tension: 0,
                        fill: false,
                        borderWidth: 1.5,
                        borderDash: [5, 5],
                        pointRadius: 0,
                        pointHoverRadius: 0,
                        order: 2
                    }
                );
            }

            if (!trendSummary && !isSingleSelectedMonth) {
                renderTrendInsights(null);
            }

            const trendCtx = document.getElementById('chart-trend');
            if (chartInstances.trend) chartInstances.trend.destroy();
            const trendValues = trendDatasets.flatMap((dataset) => dataset.data);
            const trendMin = trendValues.length ? Math.min(...trendValues) : 0;
            const trendMax = trendValues.length ? Math.max(...trendValues) : 0;
            const singleMonthTrend = trendLabels.length <= 1;
            const trendPadding = singleMonthTrend ? Math.max(200, Math.abs(trendMax - trendMin) * 0.4 || Math.abs(trendMax || trendMin) * 0.2 || 200) : 0;
            chartInstances.trend = new Chart(trendCtx, {
                type: trendChartType,
                plugins: [dashboardDataLabelPlugin],
                data: {
                    labels: trendLabels,
                    datasets: trendDatasets
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    layout: { padding: { top: 26, right: 14, left: 6, bottom: isSingleSelectedMonth ? 34 : 0 } },
                    interaction: { mode: 'index', intersect: false },
                    onClick: isSingleSelectedMonth ? undefined : (event, elements, chart) => {
                        if (!elements.length) return;
                        const index = elements[0].index;
                        const monthKey = monthlyTrendKeys[index];
                        openMonthlyDetailTab(monthKey);
                    },
                    plugins: {
                        dashboardDataLabelPlugin: isSingleSelectedMonth ? {
                            mode: 'daily-spend-objective',
                            datasetIndex: 0,
                            weekLabels: dailyWeekLabels
                        } : {
                            mode: 'financial-combo-monthly',
                            datasetIndex: 2
                        },
                        legend: {
                            labels: {
                                color: '#64748b',
                                font: { size: 10 },
                                padding: 12,
                                usePointStyle: true,
                                pointStyle: 'line',
                                boxWidth: 8
                            }
                        },
                        tooltip: {
                            callbacks: {
                                label: (context) => `${context.dataset.label}: ${fmt(context.parsed.y)}`
                            }
                        }
                    },
                    scales: {
                        x: {
                            grid: { display: false, drawBorder: false },
                            ticks: { color: '#64748b', font: { size: 11 } },
                            offset: singleMonthTrend
                        },
                        y: {
                            grid: { color: 'rgba(226, 232, 240, 0.8)', drawBorder: false },
                            ticks: {
                                display: true,
                                color: '#64748b',
                                font: { size: 11 },
                                callback: (value) => fmtCompactCurrency(value)
                            },
                            beginAtZero: !isSingleSelectedMonth,
                            suggestedMin: singleMonthTrend ? trendMin - trendPadding : undefined,
                            suggestedMax: singleMonthTrend ? trendMax + trendPadding : undefined
                        }
                    }
                }
            });

            let recentSource = [];
            let recentTitle = "Movimentações no recorte";
            
            if (focusedDashboardCard === 'entradas') {
                recentSource = financialEntradas;
                recentTitle = "Detalhes: Todas Entradas";
            } else if (focusedDashboardCard === 'saidas') {
                recentSource = paidSaidas;
                recentTitle = "Detalhes: Saídas Pagas";
            } else if (focusedDashboardCard === 'saldo') {
                recentSource = [...financialEntradas, ...paidSaidas, ...openSaidas];
                recentTitle = "Detalhes: Entradas, Saídas Pagas e Em Aberto";
            } else if (focusedDashboardCard === 'aberto') {
                recentSource = openSaidas;
                recentTitle = "Detalhes: Contas em Aberto";
            } else {
                recentSource = filteredRecords;
            }

            const contextParts = [];
            const activePerson = document.getElementById('f-person').value;
            const activeMacro = document.getElementById('f-macro').value;
            if (activePerson) contextParts.push(activePerson);
            if (activeMacro) contextParts.push(activeMacro);
            if (focusedDashboardCard === 'aberto') contextParts.push('somente em aberto');
            if (contextParts.length) recentTitle += ` • ${contextParts.join(' • ')}`;

            const limit = focusedDashboardCard ? 50 : 10;
            const recent = sortRecordsNewestFirst(recentSource).slice(0, limit);
            
            document.getElementById('recent-title').textContent = recentTitle;
            const btnClear = document.getElementById('btn-clear-card');
            if (focusedDashboardCard) {
                btnClear.classList.remove('hidden');
            } else {
                btnClear.classList.add('hidden');
            }

            document.getElementById('recent-list').innerHTML = recent.map(r => renderRow(r)).join('') || '<p class="text-xs text-textSecondary text-center py-4">Sem lançamentos correspondentes</p>';
            lucide.createIcons();
        }
        window.renderDashboard = window.renderDashboard || renderDashboardLegacyFallback;

        function renderRow(r) {
            const isEntrada = r.type === 'entrada';
            const statusBadge = r.status === 'Pago' ? 'bg-success/20 text-success' : r.status === 'Cancelado' ? 'bg-danger/20 text-danger' : 'bg-warn/20 text-warn';
            const icon = isEntrada ? 'arrow-down-left' : 'arrow-up-right';
            const color = isEntrada ? 'text-success' : 'text-danger';
            const desc = r.description || r.subcategory || r.earning_type || '';
            const installTxt = r.total_installments > 0 ? ` (${r.installment_no}/${r.total_installments})` : '';
            const archiveButtonTitle = isArchivedRecord(r) ? 'Reabrir lançamento' : 'Arquivar lançamento';
            const archiveIcon = isArchivedRecord(r) ? 'archive-restore' : 'archive';
            const archiveColor = isArchivedRecord(r) ? 'hover:text-accent' : 'hover:text-warn';
            const isReference = isReferenceSalaryRecord(r);
            const paymentLabel = r.payment_method ? ` • ${r.payment_method}` : '';
            const exactDateLabel = formatExactDateLabel(getSaidaExactDate(r));
            const recordId = escapeHtml(r.id || '');

            return `<div class="mobile-list-row finance-record-row flex items-center gap-3 bg-surfaceLight/50 rounded-lg p-2.5 text-sm">
    <i data-lucide="${icon}" class="mobile-list-icon w-4 h-4 ${color} flex-shrink-0"></i>
    <div class="mobile-list-main flex-1 min-w-0">
      <p class="mobile-list-title font-medium">${desc}${installTxt}</p>
      <p class="mobile-list-meta text-xs text-textSecondary">${r.person || ''} • ${formatCompetence(r.competence)} • ${r.macro_category || ''}${exactDateLabel ? ` • ${exactDateLabel}` : ''}${paymentLabel}${isReference ? ' • Referência' : ''}${isArchivedRecord(r) ? ' • Arquivado' : ''}</p>
    </div>
    <span class="mobile-list-status text-xs px-2 py-0.5 rounded-full ${statusBadge}">${r.status}</span>
    <span class="mobile-list-value font-semibold ${color} whitespace-nowrap">${isEntrada && r.macro_category === 'Dedução' ? '-' : ''}${fmt(r.amount)}</span>
    <div class="mobile-list-actions flex items-center gap-1">
    <button type="button" data-finance-record-action="edit" data-finance-record-id="${recordId}" title="Editar lançamento" class="text-textSecondary hover:text-accent p-1">
      <i data-lucide="pencil" class="w-4 h-4"></i>
    </button>
    <button type="button" data-finance-record-action="toggle-paid" data-finance-record-id="${recordId}" title="${r.status === 'Pago' ? 'Reabrir lançamento' : 'Marcar lançamento como pago'}" aria-label="${r.status === 'Pago' ? 'Reabrir lançamento' : 'Marcar lançamento como pago'}" class="text-textSecondary hover:text-success p-1">
      <i data-lucide="${r.status === 'Pago' ? 'check-circle' : 'circle'}" class="w-4 h-4"></i>
    </button>
    <button type="button" data-finance-record-action="toggle-archive" data-finance-record-id="${recordId}" title="${archiveButtonTitle}" class="text-textSecondary ${archiveColor} p-1">
      <i data-lucide="${archiveIcon}" class="w-4 h-4"></i>
    </button>
    <button type="button" data-delete-action="true" data-finance-record-action="delete" data-finance-record-id="${recordId}" title="Excluir lançamento" aria-label="Excluir lançamento" class="text-textSecondary hover:text-danger p-1">
      <i data-lucide="trash-2" class="w-4 h-4"></i>
    </button>
    </div>
  </div>`;
        }

        function renderSaidas() {
            updateSaidasPaymentFilterOptions();
            ['active', 'archived', 'all'].forEach((mode) => {
                const button = document.getElementById(`saidas-filter-${mode}`);
                if (button) button.className = `px-3 py-1.5 text-xs rounded-md ${listArchiveFilters.saidas === mode ? 'bg-accent text-white' : 'text-textSecondary'}`;
            });
            const startDateInput = document.getElementById('saidas-date-start-filter');
            const endDateInput = document.getElementById('saidas-date-end-filter');
            if (startDateInput) startDateInput.value = listDateFilters.saidas.start || '';
            if (endDateInput) endDateInput.value = listDateFilters.saidas.end || '';
            const saidas = getListRecords('saidas');
            const totalBox = document.getElementById('saidas-total');
            const counts = getArchiveCounts('saida');
            const hasSearch = Boolean(normalizeListSearchValue(listSearchFilters.saidas));
            const visibleRecords = hasSearch ? saidas : saidas.slice(0, listPagination.saidas);
            const totalVisible = visibleRecords.reduce((sum, record) => sum + (Number(record.amount) || 0), 0);
            const detailLabel = listDetailFilters.saidas === 'aberto'
                ? 'somente em aberto'
                : listDetailFilters.saidas === 'pago'
                    ? 'somente pago'
                    : '';
            const paymentLabel = listPaymentFilters.saidas ? ` • pagamento: ${listPaymentFilters.saidas}` : '';
            const personLabel = listPersonFilters.saidas ? ` • pessoa: ${listPersonFilters.saidas}` : '';
            const cycleLabel = listCycleFilters.saidas ? ` • ciclo: ${listCycleFilters.saidas === 'QUINZENA' ? 'Quinzena' : 'Inicio do mes'}` : '';
            const macroLabel = listMacroFilters.saidas ? ` • categoria: ${listMacroFilters.saidas}` : '';
            const startDateLabel = listDateFilters.saidas.start ? ` • de: ${formatExactDateLabel(listDateFilters.saidas.start)}` : '';
            const endDateLabel = listDateFilters.saidas.end ? ` • até: ${formatExactDateLabel(listDateFilters.saidas.end)}` : '';
            const paymentClearAction = listPaymentFilters.saidas
                ? ' <button type="button" data-clear-saidas-payment-filter class="text-accent hover:underline ml-1">limpar pagamento</button>'
                : '';
            const detail = detailLabel ? ` • filtro: ${detailLabel}` : '';
            const clearAction = detailLabel
                ? ' <button type="button" data-clear-list-detail-filter="saidas" class="text-accent hover:underline ml-1">limpar</button>'
                : '';
            const searchLabel = listSearchFilters.saidas ? ` • busca: ${listSearchFilters.saidas}` : '';
            window.financeApp.financeUiAdapters.renderListState({
                listId: 'saidas-list',
                emptyId: 'saidas-empty',
                metaId: 'saidas-meta',
                paginationId: 'saidas-pagination',
                nodes: window.financeRecordListRenderer
                    ? window.financeRecordListRenderer.createRecordRowNodes(visibleRecords)
                    : null,
                html: window.financeRecordListRenderer ? '' : visibleRecords.map(r => renderRow(r)).join(''),
                hasItems: saidas.length > 0,
                metaHtml: `${visibleRecords.length} de ${saidas.length} exibidos • ${counts.active} ativos • ${counts.archived} arquivados${personLabel}${cycleLabel}${macroLabel}${startDateLabel}${endDateLabel}${paymentLabel}${paymentClearAction}${detail}${clearAction}${searchLabel}`,
                showPagination: !hasSearch && saidas.length > visibleRecords.length
            });
            if (totalBox) {
                window.financeApp.financeUiAdapters.renderTotalBox('saidas-total', `
                        <div class="flex items-center justify-between gap-3">
                            <span class="text-sm font-medium text-textSecondary">Total dos lançamentos exibidos</span>
                            <span class="text-lg font-bold text-danger">${fmt(totalVisible)}</span>
                        </div>
                    `, Boolean(visibleRecords.length));
            }
            lucide.createIcons();
        }

        function renderEntradas() {
            ['active', 'archived', 'all'].forEach((mode) => {
                const button = document.getElementById(`entradas-filter-${mode}`);
                if (button) button.className = `px-3 py-1.5 text-xs rounded-md ${listArchiveFilters.entradas === mode ? 'bg-success text-bg' : 'text-textSecondary'}`;
            });
            const entradas = getListRecords('entradas');
            const list = document.getElementById('entradas-list');
            const empty = document.getElementById('entradas-empty');
            const meta = document.getElementById('entradas-meta');
            const pagination = document.getElementById('entradas-pagination');
            const counts = getArchiveCounts('entrada');
            const visibleEntries = entradas.slice(0, listPagination.entradas);

            const groups = {};
            visibleEntries.forEach(r => {
                const key = `${r.person}|${r.competence}`;
                if (!groups[key]) groups[key] = { person: r.person, competence: r.competence, items: [] };
                groups[key].items.push(r);
            });

            let html = '';
            Object.values(groups).sort((a, b) => (b.competence || '').localeCompare(a.competence || '')).forEach(g => {
                const financialItems = g.items.filter(isFinancialEntradaRecord);
                const referenceItems = g.items.filter(isReferenceSalaryRecord);
                const earnings = financialItems.filter(i => i.macro_category === 'Rendimento').reduce((s, i) => s + (Number(i.amount) || 0), 0);
                const benefits = g.items.filter(i => i.macro_category === 'Benefício').reduce((s, i) => s + (Number(i.amount) || 0), 0);
                const deductions = g.items.filter(i => i.macro_category === 'Dedução').reduce((s, i) => s + (Number(i.amount) || 0), 0);
                const net = earnings + benefits - deductions;
                const legacyReferenceSalary = referenceItems.length ? referenceItems[referenceItems.length - 1] : null;
                const configuredBaseSalary = getPersonBaseSalary(g.person);
                const resolvedBaseSalary = configuredBaseSalary > 0 ? configuredBaseSalary : (Number(legacyReferenceSalary?.amount) || 0);
                const referenceSalary = resolvedBaseSalary > 0 ? { amount: resolvedBaseSalary } : null;

                html += `<div class="bg-surface rounded-xl p-3 border border-surfaceLight mb-3">
      <div class="flex justify-between items-center mb-2">
        <h3 class="font-semibold text-sm">${g.person} - ${formatCompetence(g.competence)}</h3>
        <span class="text-success font-bold text-sm">Líquido: ${fmt(net)}</span>
      </div>
      <div class="flex gap-3 text-xs text-textSecondary mb-2">
        <span>Rendimentos: ${fmt(earnings)}</span>
        <span>Benefícios: ${fmt(benefits)}</span>
        <span>Deduções: -${fmt(deductions)}</span>
      </div>
      ${referenceSalary ? `<div class="mb-2 text-xs text-accent font-medium">Salário base de referência: ${fmt(referenceSalary.amount)}</div>` : ''}
      <div class="space-y-1">${sortRecordsNewestFirst(g.items).map(r => renderRow(r)).join('')}</div>
    </div>`;
            });

            list.innerHTML = html;
            empty.classList.toggle('hidden', entradas.length > 0);
            if (meta) {
                const searchLabel = listSearchFilters.entradas ? ` • busca: ${listSearchFilters.entradas}` : '';
                meta.textContent = `${visibleEntries.length} de ${entradas.length} exibidos • ${counts.active} ativos • ${counts.archived} arquivados${searchLabel}`;
            }
            pagination.classList.toggle('hidden', entradas.length <= visibleEntries.length);
            lucide.createIcons();
        }

        function renderEntradas() {
            const list = document.getElementById('entradas-list');
            const empty = document.getElementById('entradas-empty');
            const meta = document.getElementById('entradas-meta');
            const search = normalizeImportText(listSearchFilters.entradas || '').toLowerCase();
            const competenceFilter = normalizeCompetenceKey(document.getElementById('entradas-competence-filter')?.value || '');
            const entries = getConsolidatedEntradas().filter((item) => {
                if (competenceFilter && item.competence !== competenceFilter) return false;
                if (!search) return true;
                return normalizeImportText(`${item.person} ${item.competence} ${formatCompetence(item.competence)}`).toLowerCase().includes(search);
            });

            list.innerHTML = entries.map((item) => `
                <div class="glass rounded-2xl p-4">
                    <div class="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                        <div>
                            <p class="text-xs uppercase tracking-[0.18em] text-textSecondary">Competência</p>
                            <h3 class="text-lg font-bold text-textPrimary">${escapeHtml(item.person)} • ${formatCompetence(item.competence)}</h3>
                            <p class="text-xs text-textSecondary mt-1">Financeiro consolidado do mês com horas e descontos separados do banco de horas.</p>
                        </div>
                        <button type="button" data-open-entry-detail="${escapeHtml(item.key)}" class="px-3 py-2 rounded-lg bg-accent text-white text-sm font-semibold hover:bg-accentDark transition-colors">Visualizar</button>
                    </div>
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
                        <div class="finance-highlight-card finance-highlight-salary">
                            <span class="finance-highlight-label">Salário Base</span>
                            <strong class="finance-highlight-value">${fmt(item.salarioBase)}</strong>
                        </div>
                        <div class="finance-highlight-card finance-highlight-overtime">
                            <span class="finance-highlight-label">Hora Extra</span>
                            <strong class="finance-highlight-value">${fmt(item.horaExtra)}</strong>
                        </div>
                        <div class="finance-highlight-card finance-highlight-net">
                            <span class="finance-highlight-label">Líquido Final</span>
                            <strong class="finance-highlight-value">${fmt(item.liquidoFinal)}</strong>
                        </div>
                    </div>
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
                        <div class="rounded-xl border border-surfaceLight bg-surfaceLight/40 p-3">
                            <p class="text-[11px] uppercase tracking-[0.16em] text-textSecondary">Descontos</p>
                            <p class="text-base font-semibold text-danger mt-2">-${fmt(item.outrosDescontos)}</p>
                        </div>
                        <div class="rounded-xl border border-surfaceLight bg-surfaceLight/40 p-3">
                            <p class="text-[11px] uppercase tracking-[0.16em] text-textSecondary">INSS</p>
                            <p class="text-base font-semibold text-danger mt-2">-${fmt(item.inss)}</p>
                        </div>
                        <div class="rounded-xl border border-surfaceLight bg-surfaceLight/40 p-3">
                            <p class="text-[11px] uppercase tracking-[0.16em] text-textSecondary">IRRF</p>
                            <p class="text-base font-semibold text-danger mt-2">-${fmt(item.irrf)}</p>
                        </div>
                    </div>
                </div>
            `).join('');

            empty.classList.toggle('hidden', entries.length > 0);
            if (meta) {
                const total = entries.reduce((sum, item) => sum + item.liquidoFinal, 0);
                meta.textContent = `${entries.length} competência(s) consolidadas • líquido somado ${fmt(total)}`;
            }
            lucide.createIcons();
        }

        function renderControleHoras() {
            const list = document.getElementById('controle-horas-list');
            const empty = document.getElementById('controle-horas-empty');
            const meta = document.getElementById('controle-horas-meta');
            const saldoList = document.getElementById('controle-horas-saldos');
            const competenceFilter = normalizeCompetenceKey(document.getElementById('controle-horas-competencia')?.value || '');
            const search = normalizeImportText(document.getElementById('controle-horas-search')?.value || '').toLowerCase();

            const groups = getGroupedHourControlSummaries().filter((group) => {
                if (competenceFilter && group.competence !== competenceFilter) return false;
                if (!search) return true;
                return normalizeImportText(`${group.person} ${group.competence} ${formatCompetence(group.competence)}`).toLowerCase().includes(search);
            });

            if (competenceFilter) {
                const existingKeys = new Set(groups.map((group) => group.key));
                getPeopleRecords().forEach((personRecord) => {
                    const personName = personRecord?.person || '';
                    if (!personName) return;
                    const key = `${personName}|${competenceFilter}`;
                    if (existingKeys.has(key)) return;
                    const bankSummary = calcularSaldoBanco(personName, competenceFilter);
                    const hasCarryOver = (
                        Number(bankSummary?.saldoAnterior || 0) !== 0 ||
                        Number(bankSummary?.horasDebito || 0) !== 0 ||
                        Number(bankSummary?.horasCredito || 0) !== 0 ||
                        Number(bankSummary?.saldoAtual || 0) !== 0
                    );
                    if (!hasCarryOver) return;
                    groups.push({
                        key,
                        person: personName,
                        competence: competenceFilter,
                        records: [],
                        totalHoraExtra: 0,
                        bankSummary
                    });
                    existingKeys.add(key);
                });

                groups.sort((a, b) => {
                    const competenceCompare = (b.competence || '').localeCompare(a.competence || '');
                    if (competenceCompare !== 0) return competenceCompare;
                    return String(a.person || '').localeCompare(String(b.person || ''), 'pt-BR');
                });
            }

            list.innerHTML = groups.map((group) => `
                <div class="glass rounded-2xl p-4">
                    <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                        <div>
                            <h3 class="text-lg font-bold text-textPrimary">${escapeHtml(group.person)} • ${formatCompetence(group.competence)}</h3>
                            <p class="text-xs text-textSecondary mt-1">Resumo de hora extra financeira e saldo do banco do período.</p>
                        </div>
                        <button type="button" data-open-hour-detail="${escapeHtml(group.key)}" class="px-3 py-2 rounded-lg bg-surfaceLight text-textPrimary text-sm font-semibold hover:bg-surfaceLight/80 transition-colors">Detalhar</button>
                    </div>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
                        <div class="hours-highlight-card hours-highlight-financial">
                            <span class="finance-highlight-label">Total H.E.</span>
                            <strong class="finance-highlight-value">${fmt(group.totalHoraExtra)}</strong>
                        </div>
                        <div class="hours-highlight-card hours-highlight-bank">
                            <span class="finance-highlight-label">Saldo Banco</span>
                            <strong class="finance-highlight-value">${group.bankSummary.saldoAtual >= 0 ? '+' : '-'}${formatHoursDecimal(Math.abs(group.bankSummary.saldoAtual))}</strong>
                        </div>
                    </div>
                </div>
            `).join('');

            if (saldoList) {
                const people = getPeopleRecords();
                saldoList.innerHTML = people.map((person) => {
                    const competence = competenceFilter || thisMonth;
                    const summary = calcularSaldoBanco(person.person, competence);
                    return `
                        <div class="rounded-xl border border-surfaceLight bg-surfaceLight/40 p-3">
                            <p class="font-semibold text-sm text-textPrimary">${escapeHtml(person.person)}</p>
                            <div class="mt-3 space-y-2 text-xs text-textSecondary">
                                <div class="flex justify-between gap-2"><span>Saldo anterior</span><strong class="text-textPrimary">${formatHoursDecimal(Math.abs(summary.saldoAnterior))}</strong></div>
                                <div class="flex justify-between gap-2"><span>Horas débito</span><strong class="text-accent">${formatHoursDecimal(summary.horasDebito)}</strong></div>
                                <div class="flex justify-between gap-2"><span>Horas crédito</span><strong class="text-warn">${formatHoursDecimal(summary.horasCredito)}</strong></div>
                                <div class="flex justify-between gap-2"><span>Saldo atual</span><strong class="text-textPrimary">${summary.saldoAtual >= 0 ? '+' : '-'}${formatHoursDecimal(Math.abs(summary.saldoAtual))}</strong></div>
                            </div>
                        </div>
                    `;
                }).join('');
            }

            empty.classList.toggle('hidden', groups.length > 0);
            if (meta) meta.textContent = `${groups.length} agrupamento(s) por pessoa e competência`;
            lucide.createIcons();
        }

        function openSalaryHistoryModal(personId) {
            const person = allRecords.find((record) => record.type === 'pessoa' && record.id === personId);
            if (!person) return;

            selectedSalaryHistoryPersonId = personId;
            document.getElementById('salary-history-title').textContent = `Histórico Salarial • ${person.person}`;
            document.getElementById('salary-history-amount').value = '';
            document.getElementById('salary-history-start').value = `${thisMonth}-01`;
            document.getElementById('salary-history-end').value = '';
            document.getElementById('salary-history-note').value = '';
            renderSalaryHistoryList(person.person);
            document.getElementById('salary-history-modal').classList.remove('hidden');
            lucide.createIcons();
        }

        function renderSalaryHistoryList(personName) {
            const list = document.getElementById('salary-history-list');
            if (!list) return;
            const history = getSalaryHistoryRecords(personName);
            list.innerHTML = history.length
                ? history.map((record) => `
                    <div class="rounded-xl border border-surfaceLight bg-surfaceLight/30 p-3">
                        <p class="text-sm font-semibold text-textPrimary">${fmt(record.salarioBase)}</p>
                        <p class="text-xs text-textSecondary mt-1">Início: ${formatCompetence(record.competenciaInicio)}${record.competenciaFim ? ` • Fim: ${formatCompetence(record.competenciaFim)}` : ' • Vigente'}</p>
                        ${record.observacao ? `<p class="text-xs text-textSecondary mt-2">${escapeHtml(record.observacao)}</p>` : ''}
                    </div>
                `).join('')
                : '<p class="text-xs text-textSecondary text-center py-4">Nenhum histórico salarial cadastrado.</p>';
        }

        function closeSalaryHistoryModal() {
            document.getElementById('salary-history-modal')?.classList.add('hidden');
            selectedSalaryHistoryPersonId = null;
        }

        async function saveSalaryHistoryRecord() {
            const person = allRecords.find((record) => record.type === 'pessoa' && record.id === selectedSalaryHistoryPersonId);
            const amount = Number(document.getElementById('salary-history-amount')?.value) || 0;
            const start = normalizeCompetenceKey(document.getElementById('salary-history-start')?.value || '');
            const end = normalizeCompetenceKey(document.getElementById('salary-history-end')?.value || '');
            const note = document.getElementById('salary-history-note')?.value || '';

            if (!person) { showToast('Pessoa não encontrada', true); return; }
            if (amount <= 0) { showToast('Informe um salário base válido', true); return; }
            if (!start) { showToast('Informe o início da vigência', true); return; }
            if (end && end < start) { showToast('O fim da vigência não pode ser menor que o início', true); return; }

            const existingOpen = allRecords.find((record) =>
                record.type === 'salario_historico' &&
                String(record.person || '').trim() === String(person.person || '').trim() &&
                normalizeCompetenceKey(record.vigencia_inicio || record.start_date || '') < start &&
                !normalizeCompetenceKey(record.vigencia_fim || record.end_date || '')
            );

            if (existingOpen) {
                await window.dataSdk.update({
                    ...existingOpen,
                    id: existingOpen.id,
                    vigencia_fim: shiftMonthValue(start, -1)
                });
            }

            const result = await window.dataSdk.create({
                type: 'salario_historico',
                person: person.person,
                person_id: person.id,
                salary_base: roundCurrency(amount),
                amount: roundCurrency(amount),
                vigencia_inicio: start,
                vigencia_fim: end,
                observation: note,
                description: note,
                created_at: new Date().toISOString(),
                ...getHourExtraRecordDefaults()
            });

            if (!result.isOk) {
                showToast('Erro ao salvar histórico salarial', true);
                return;
            }

            await syncPersonCurrentSalary(person);
            showToast('Histórico salarial atualizado!');
            renderSalaryHistoryList(person.person);
            document.getElementById('salary-history-amount').value = '';
            document.getElementById('salary-history-end').value = '';
            document.getElementById('salary-history-note').value = '';
        }

        function closeHourControlModal() {
            document.getElementById('hour-control-modal')?.classList.add('hidden');
        }

        function handleHourControlTypeChange() {
            const type = document.getElementById('hour-type')?.value || 'Hora Extra';
            document.getElementById('hour-nature-wrap')?.classList.toggle('hidden', type !== 'Banco de Horas');
            document.getElementById('hour-percentage-wrap')?.classList.toggle('hidden', type !== 'Hora Extra');
            updateHourControlCalculatedFields();
        }

        function updateHourControlCalculatedFields() {
            const person = document.getElementById('hour-person')?.value || '';
            const competence = normalizeCompetenceKey(document.getElementById('hour-competence')?.value || '') || thisMonth;
            const type = document.getElementById('hour-type')?.value || 'Hora Extra';
            const quantity = calcularHoras(document.getElementById('hour-start')?.value || '', document.getElementById('hour-end')?.value || '');
            const salaryRecord = getSalarioVigente(person, competence);
            const salaryBase = roundCurrency(salaryRecord?.salary_base || 0);
            const overtime = calcularHoraExtra({
                salaryBase,
                quantityHours: quantity.quantidade,
                percentage: Number(document.getElementById('hour-percentage')?.value) || 0
            });

            if (document.getElementById('hour-quantity')) document.getElementById('hour-quantity').value = quantity.quantidade ? quantity.quantidade.toFixed(2) : '';
            if (document.getElementById('hour-salary-base')) document.getElementById('hour-salary-base').value = salaryBase ? Number(salaryBase).toFixed(2) : '';

            const preview = document.getElementById('hour-calculation-preview');
            if (!preview) return;

            if (type === 'Banco de Horas') {
                const bank = calcularBancoHoras({
                    quantityHours: quantity.quantidade,
                    natureza: document.getElementById('hour-bank-nature')?.value || 'Débito'
                });
                preview.innerHTML = `
                    <p class="text-xs uppercase tracking-[0.16em] text-textSecondary">Prévia</p>
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
                        <div class="rounded-xl border border-surfaceLight bg-surface p-3"><p class="text-xs text-textSecondary">Horas</p><p class="text-lg font-bold text-accent mt-2">${quantity.quantidadeFormatada}</p></div>
                        <div class="rounded-xl border border-surfaceLight bg-surface p-3"><p class="text-xs text-textSecondary">Débito</p><p class="text-lg font-bold text-accent mt-2">${formatHoursDecimal(bank.debito)}</p></div>
                        <div class="rounded-xl border border-surfaceLight bg-surface p-3"><p class="text-xs text-textSecondary">Crédito</p><p class="text-lg font-bold text-warn mt-2">${formatHoursDecimal(bank.credito)}</p></div>
                    </div>
                `;
                return;
            }

            preview.innerHTML = `
                <p class="text-xs uppercase tracking-[0.16em] text-textSecondary">Prévia financeira</p>
                <div class="grid grid-cols-1 md:grid-cols-4 gap-3 mt-3">
                    <div class="rounded-xl border border-surfaceLight bg-surface p-3"><p class="text-xs text-textSecondary">Horas</p><p class="text-lg font-bold text-accent mt-2">${quantity.quantidadeFormatada}</p></div>
                    <div class="rounded-xl border border-surfaceLight bg-surface p-3"><p class="text-xs text-textSecondary">Hora normal</p><p class="text-lg font-bold text-textPrimary mt-2">${fmt(overtime.valorHoraNormal)}</p></div>
                    <div class="rounded-xl border border-surfaceLight bg-surface p-3"><p class="text-xs text-textSecondary">Valor H.E.</p><p class="text-lg font-bold text-success mt-2">${fmt(overtime.valorHoraExtra)}</p></div>
                    <div class="rounded-xl border border-surfaceLight bg-surface p-3"><p class="text-xs text-textSecondary">Total H.E.</p><p class="text-lg font-bold text-success mt-2">${fmt(overtime.totalHoraExtra)}</p></div>
                </div>
            `;
        }

        function openHourControlModal() {
            const people = getPeopleRecords();
            const personSelect = document.getElementById('hour-person');
            if (personSelect) {
                personSelect.innerHTML = people.map((person) => `<option value="${escapeHtml(person.person)}">${escapeHtml(person.person)}</option>`).join('');
            }

            document.getElementById('hour-competence').value = thisMonth;
            document.getElementById('hour-date').value = today;
            document.getElementById('hour-start').value = '';
            document.getElementById('hour-end').value = '';
            document.getElementById('hour-quantity').value = '';
            document.getElementById('hour-type').value = 'Hora Extra';
            document.getElementById('hour-bank-nature').value = 'Débito';
            document.getElementById('hour-percentage').value = '110';
            document.getElementById('hour-note').value = '';
            handleHourControlTypeChange();
            document.getElementById('hour-control-modal').classList.remove('hidden');
            lucide.createIcons();
        }

        async function saveHourControlRecord() {
            const person = document.getElementById('hour-person')?.value || '';
            const competence = normalizeCompetenceKey(document.getElementById('hour-competence')?.value || '');
            const date = document.getElementById('hour-date')?.value || '';
            const type = document.getElementById('hour-type')?.value || 'Hora Extra';
            const quantity = calcularHoras(document.getElementById('hour-start')?.value || '', document.getElementById('hour-end')?.value || '');
            const salaryRecord = getSalarioVigente(person, competence);
            const salaryBase = roundCurrency(salaryRecord?.salary_base || 0);

            if (!person) { showToast('Selecione a pessoa', true); return; }
            if (!competence) { showToast('Informe a competência', true); return; }
            if (!date) { showToast('Informe a data', true); return; }
            if (!quantity.quantidade) { showToast('A hora final deve ser maior que a inicial', true); return; }

            let payload = {
                type: 'controle_horas',
                person,
                competence,
                occurred_date: date,
                hour_control_type: type,
                horaInicial: document.getElementById('hour-start')?.value || '',
                horaFinal: document.getElementById('hour-end')?.value || '',
                quantidadeHoras: quantity.quantidade,
                quantidadeHorasFormatada: quantity.quantidadeFormatada,
                description: document.getElementById('hour-note')?.value || '',
                observation: document.getElementById('hour-note')?.value || '',
                salary_base_reference: salaryBase,
                created_at: new Date().toISOString(),
                ...getHourExtraRecordDefaults()
            };

            if (type === 'Hora Extra') {
                const percentualUsado = Number(document.getElementById('hour-percentage')?.value) || 0;
                const overtime = calcularHoraExtra({ salaryBase, quantityHours: quantity.quantidade, percentage: percentualUsado });
                payload = {
                    ...payload,
                    percentualUsado,
                    bank_nature: '',
                    valorBaseHora: overtime.valorHoraNormal,
                    valorHoraCalculado: overtime.valorHoraExtra,
                    valorTotalCalculado: overtime.totalHoraExtra,
                    amount: overtime.totalHoraExtra
                };
            } else {
                payload = {
                    ...payload,
                    bank_nature: document.getElementById('hour-bank-nature')?.value || 'Débito',
                    percentualUsado: 0,
                    valorBaseHora: 0,
                    valorHoraCalculado: 0,
                    valorTotalCalculado: 0,
                    amount: 0
                };
            }

            const result = await window.dataSdk.create(payload);
            if (!result.isOk) {
                showToast('Erro ao salvar lançamento de horas', true);
                return;
            }

            showToast(type === 'Hora Extra' ? 'Hora extra salva!' : 'Banco de horas salvo!');
            closeHourControlModal();
        }

        function openHourDetailModal(groupKey) {
            const [person, competence] = groupKey.split('|');
            const records = getHourControlRecords({ person, competence }).sort((a, b) => (b.occurred_date || '').localeCompare(a.occurred_date || ''));
            const summary = calcularSaldoBanco(person, competence);
            const recordsHtml = records.length
                ? records.map((record) => `
                    <div class="rounded-xl border border-surfaceLight bg-surface p-3">
                        <div class="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                            <div>
                                <p class="font-semibold text-sm text-textPrimary">${record.hour_control_type}${record.bank_nature ? ` • ${record.bank_nature}` : ''}</p>
                                <p class="text-xs text-textSecondary mt-1">${record.occurred_date ? record.occurred_date.split('-').reverse().join('/') : ''} • ${record.quantidadeHorasFormatada || formatHoursDecimal(record.quantidadeHoras || 0)}</p>
                                ${record.description ? `<p class="text-xs text-textSecondary mt-2">${escapeHtml(record.description)}</p>` : ''}
                            </div>
                            <div class="text-right">
                                <p class="text-xs text-textSecondary">${record.hour_control_type === 'Hora Extra' ? 'Valor calculado' : 'Impacto no saldo'}</p>
                                <p class="text-lg font-bold ${record.hour_control_type === 'Hora Extra' ? 'text-success' : 'text-accent'} mt-2">${record.hour_control_type === 'Hora Extra' ? fmt(record.valorTotalCalculado || 0) : `${String(record.bank_nature || '').toLowerCase().startsWith('d') ? '+' : '-'}${record.quantidadeHorasFormatada || formatHoursDecimal(record.quantidadeHoras || 0)}`}</p>
                            </div>
                        </div>
                    </div>
                `).join('')
                : '<div class="rounded-xl border border-surfaceLight bg-surface p-4 text-sm text-textSecondary">Sem lançamentos novos nesta competência. O saldo exibido acima é o acumulado trazido do histórico anterior.</div>';
            document.getElementById('hour-detail-title').textContent = `Controle de Horas • ${person}`;
            document.getElementById('hour-detail-subtitle').textContent = formatCompetence(competence);
            document.getElementById('hour-detail-content').innerHTML = `
                <div class="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div class="rounded-xl border border-surfaceLight bg-surfaceLight/30 p-3"><p class="text-xs text-textSecondary">Saldo anterior</p><p class="text-lg font-bold text-textPrimary mt-2">${formatHoursDecimal(Math.abs(summary.saldoAnterior))}</p></div>
                    <div class="rounded-xl border border-surfaceLight bg-surfaceLight/30 p-3"><p class="text-xs text-textSecondary">Horas débito</p><p class="text-lg font-bold text-accent mt-2">${formatHoursDecimal(summary.horasDebito)}</p></div>
                    <div class="rounded-xl border border-surfaceLight bg-surfaceLight/30 p-3"><p class="text-xs text-textSecondary">Horas crédito</p><p class="text-lg font-bold text-warn mt-2">${formatHoursDecimal(summary.horasCredito)}</p></div>
                    <div class="rounded-xl border border-surfaceLight bg-surfaceLight/30 p-3"><p class="text-xs text-textSecondary">Saldo atual</p><p class="text-lg font-bold text-textPrimary mt-2">${summary.saldoAtual >= 0 ? '+' : '-'}${formatHoursDecimal(Math.abs(summary.saldoAtual))}</p></div>
                </div>
                ${recordsHtml}
            `;
            document.getElementById('hour-detail-modal').classList.remove('hidden');
            lucide.createIcons();
        }

        function closeHourDetailModal() {
            document.getElementById('hour-detail-modal')?.classList.add('hidden');
        }

        function openEntryDetailModal(entryKey) {
            const [person, competence] = entryKey.split('|');
            const detail = consolidarEntradaMensal(person, competence);
            const hoursHtml = detail.hourExtraRecords.length
                ? detail.hourExtraRecords.map((record) => `
                    <div class="entry-detail-movement-row">
                        <div>
                            <p class="font-semibold text-sm text-textPrimary">${record.occurred_date ? record.occurred_date.split('-').reverse().join('/') : formatCompetence(detail.competence)}</p>
                            <p class="text-xs text-textSecondary mt-1">${record.quantidadeHorasFormatada || formatHoursDecimal(record.quantidadeHoras || 0)} • ${Number(record.percentualUsado || 0)}%</p>
                        </div>
                        <strong class="text-success">${fmt(record.valorTotalCalculado || 0)}</strong>
                    </div>
                `).join('')
                : '<p class="text-xs text-textSecondary">Nenhum lançamento de hora extra no período.</p>';
            const descontos = detail.descontoDetalhes.length
                ? detail.descontoDetalhes.map((item) => `<div><span>${escapeHtml(item.label)}</span><strong class="text-danger">-${fmt(item.valor)}</strong></div>`).join('')
                : '<div><span>Sem descontos adicionais</span><strong>R$ 0,00</strong></div>';

            document.getElementById('entry-detail-title').textContent = `Detalhe da Entrada • ${person}`;
            document.getElementById('entry-detail-subtitle').textContent = formatCompetence(competence);
            document.getElementById('entry-detail-content').innerHTML = `
                <div class="entry-detail-hero mb-4">
                    <div class="entry-detail-hero-main">
                        <span class="entry-detail-kicker">Líquido Final</span>
                        <div class="entry-detail-hero-value">${fmt(detail.liquidoFinal)}</div>
                        <div class="entry-detail-hero-sub">Base Total ${fmt(detail.baseTotal)}</div>
                        <div class="entry-detail-hero-note">Salário base ${fmt(detail.salarioBase)} • Hora extra ${fmt(detail.horaExtra)}</div>
                    </div>
                    <div class="entry-detail-metrics">
                        <div class="entry-detail-metric-card"><span class="entry-detail-metric-label">Salário Base</span><strong class="entry-detail-metric-value">${fmt(detail.salarioBase)}</strong></div>
                        <div class="entry-detail-metric-card"><span class="entry-detail-metric-label">Hora Extra</span><strong class="entry-detail-metric-value">${fmt(detail.horaExtra)}</strong></div>
                        <div class="entry-detail-metric-card"><span class="entry-detail-metric-label">Base Total</span><strong class="entry-detail-metric-value">${fmt(detail.baseTotal)}</strong></div>
                    </div>
                </div>
                <div class="entry-detail-grid mb-4">
                    <section class="entry-detail-panel">
                        <h4 class="font-semibold text-sm text-textPrimary mb-3">Bloco financeiro</h4>
                        <div class="entry-detail-keyvals">
                            <div><span>Salário Base</span><strong>${fmt(detail.salarioBase)}</strong></div>
                            <div><span>Hora Extra</span><strong>${fmt(detail.horaExtra)}</strong></div>
                            <div><span>Base Total</span><strong>${fmt(detail.baseTotal)}</strong></div>
                            <div><span>INSS</span><strong class="text-danger">-${fmt(detail.inss)}</strong></div>
                            <div><span>IRRF</span><strong class="text-danger">-${fmt(detail.irrf)}</strong></div>
                            <div><span>Outros descontos</span><strong class="text-danger">-${fmt(detail.outrosDescontos)}</strong></div>
                            <div><span>Líquido final</span><strong class="text-success">${fmt(detail.liquidoFinal)}</strong></div>
                        </div>
                    </section>
                    <section class="entry-detail-panel">
                        <h4 class="font-semibold text-sm text-textPrimary mb-3">Bloco banco de horas</h4>
                        <div class="entry-detail-keyvals">
                            <div><span>Saldo anterior</span><strong>${formatHoursDecimal(Math.abs(detail.bankSummary.saldoAnterior))}</strong></div>
                            <div><span>Horas débito</span><strong class="text-accent">${formatHoursDecimal(detail.bankSummary.horasDebito)}</strong></div>
                            <div><span>Horas crédito</span><strong class="text-warn">${formatHoursDecimal(detail.bankSummary.horasCredito)}</strong></div>
                            <div><span>Saldo atual</span><strong>${detail.bankSummary.saldoAtual >= 0 ? '+' : '-'}${formatHoursDecimal(Math.abs(detail.bankSummary.saldoAtual))}</strong></div>
                        </div>
                    </section>
                </div>
                <div class="entry-detail-grid mb-4">
                    <section class="entry-detail-panel">
                        <h4 class="font-semibold text-sm text-textPrimary mb-3">Bloco hora extra</h4>
                        <div class="space-y-3">${hoursHtml}</div>
                    </section>
                    <section class="entry-detail-panel">
                        <h4 class="font-semibold text-sm text-textPrimary mb-3">Bloco descontos</h4>
                        <div class="entry-detail-keyvals">${descontos}</div>
                    </section>
                </div>
                <details class="entry-detail-disclosure">
                    <summary>Memória de cálculo</summary>
                    <div class="entry-detail-keyvals mt-4">
                        <div><span>Valor hora normal</span><strong>${fmt(detail.memoriaCalculo.valorHoraNormal)}</strong></div>
                        <div><span>Percentual aplicado</span><strong>${Number(detail.memoriaCalculo.percentualAplicado || 0)}%</strong></div>
                        <div><span>Cálculo da H.E.</span><strong>${fmt(detail.horaExtra)}</strong></div>
                        <div><span>Base INSS</span><strong>${fmt(detail.memoriaCalculo.baseINSS)}</strong></div>
                        <div><span>Base IRRF</span><strong>${fmt(detail.memoriaCalculo.baseIRRF)}</strong></div>
                        <div><span>Cálculo do IRRF</span><strong>${fmt(detail.memoriaCalculo.calculoIRRF.valor)}</strong></div>
                    </div>
                </details>
            `;
            document.getElementById('entry-detail-modal').classList.remove('hidden');
            lucide.createIcons();
        }

        function closeEntryDetailModal() {
            document.getElementById('entry-detail-modal')?.classList.add('hidden');
        }

        // ============ EXPORT PDF ============
        function getPdfFilteredRecords() {
            let records = getFiltered().filter((r) => r.type === 'entrada' || r.type === 'saida');
            if (focusedDashboardCard === 'aberto') {
                records = records.filter((r) => r.type === 'saida' && r.status === 'Em aberto');
            }
            return records;
        }

        function getPdfFilterLabels() {
            const labels = [];
            const start = document.getElementById('f-comp-start')?.value;
            const end = document.getElementById('f-comp-end')?.value;
            const person = document.getElementById('f-person')?.value;
            const macro = document.getElementById('f-macro')?.value;
            const cycle = document.getElementById('f-cycle')?.value;

            labels.push(`Período analisado: ${start || 'início'} até ${end || 'fim'}`);
            if (person) labels.push(`Pessoa: ${person}`);
            if (macro) labels.push(`Categoria macro: ${macro}`);
            if (cycle) labels.push(`Ciclo: ${cycle === 'INICIO_MES' ? 'Início do mês' : 'Quinzena'}`);
            if (focusedDashboardCard === 'aberto') labels.push('Foco do dashboard: somente em aberto');
            return labels;
        }

        function getPdfHourSummary() {
            const start = document.getElementById('f-comp-start')?.value || '';
            const end = document.getElementById('f-comp-end')?.value || start;
            const person = document.getElementById('f-person')?.value || '';
            if (typeof buildHourPeriodSummary !== 'function') {
                return {
                    overtimeHours: 0,
                    overtimeAmount: 0,
                    bankDebitHours: 0,
                    bankCreditHours: 0,
                    bankNetHours: 0,
                    recordsCount: 0,
                    peopleCount: 0,
                    byPerson: []
                };
            }
            return buildHourPeriodSummary(allRecords, { start, end, person });
        }

        function getPdfDashboardFinancialData() {
            const fallbackRecords = getPdfFilteredRecords();
            const fallbackBaseRecords = getFiltered().filter((r) => r.type === 'entrada' || r.type === 'saida');
            const fallbackEntradas = fallbackBaseRecords.filter((r) => r.type === 'entrada' && isFinancialEntradaRecord(r));
            const fallbackSaidas = fallbackBaseRecords.filter((r) => r.type === 'saida');

            if (
                typeof getDashboardAggregations !== 'function' ||
                typeof getDashboardBaseEntradas !== 'function' ||
                typeof window.financeFinancialSelectors?.selectPdfFinancialReport !== 'function'
            ) {
                return {
                    detailedRecords: fallbackRecords,
                    financialEntradas: fallbackEntradas,
                    saidas: fallbackSaidas,
                    dashboardEntradas: fallbackEntradas,
                    totals: null
                };
            }

            const aggregations = getDashboardAggregations();
            const dashboardEntradas = getDashboardBaseEntradas();
            const saidas = Array.isArray(aggregations?.base) ? aggregations.base : fallbackSaidas;
            return window.financeFinancialSelectors.selectPdfFinancialReport({
                detailedRecords: fallbackRecords,
                dashboardEntradas,
                saidas,
                focusedDashboardCard
            });
        }

        function readDashboardWarmCache() {
            try {
                const activeKey = localStorage.getItem(USER_RECORDS_ACTIVE_CACHE_KEY);
                const candidateKeys = [];
                if (activeKey) candidateKeys.push(activeKey);
                for (let index = 0; index < localStorage.length; index += 1) {
                    const key = localStorage.key(index);
                    if (key?.startsWith(USER_RECORDS_CACHE_PREFIX) && !candidateKeys.includes(key)) {
                        candidateKeys.push(key);
                    }
                }

                let best = null;
                candidateKeys.forEach((key) => {
                    const raw = localStorage.getItem(key);
                    if (!raw) return;
                    const parsed = JSON.parse(raw);
                    if (!Array.isArray(parsed?.records) || !parsed.records.length) return;
                    if (!best || String(parsed.saved_at || '') > String(best.saved_at || '')) {
                        best = parsed;
                    }
                });

                return Array.isArray(best?.records) ? best.records : [];
            } catch {
                return [];
            }
        }

        function hydrateDashboardFromWarmCache() {
            if (Array.isArray(allRecords) && allRecords.length) return false;
            const cachedRecords = readDashboardWarmCache();
            if (!cachedRecords.length) return false;
            allRecords = cachedRecords;
            window.__financeDataVersion = (window.__financeDataVersion || 0) + 1;
            window.__financeDashboardHydratedFromCache = true;
            requestAnimationFrame(() => renderAll());
            return true;
        }

        function classifyExpenseGroup(record) {
            const macro = normalizeImportText(record?.macro_category || '').toUpperCase()
                .normalize('NFD').replace(/[̀-ͯ]/g, '');
            const desc = normalizeImportText(record?.description || record?.subcategory || '').toUpperCase()
                .normalize('NFD').replace(/[̀-ͯ]/g, '');

            if (macro.includes('FIXO')) return 'Despesas fixas';
            if (macro.includes('VARIAVEL')) return 'Despesas variáveis';
            if (macro.includes('RESERVA')) return 'Reservas';
            if (macro.includes('INVEST')) return 'Investimentos';
            if (macro.includes('SUPERFLUO') || desc.includes('LAZER') || desc.includes('DELIVERY')) return 'Supérfluos';
            return 'Despesas variáveis';
        }

        function pdfNormalizeText(value = '') {
            return normalizeImportText(value || '')
                .toUpperCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '');
        }

        function pdfExpenseText(record = {}) {
            return pdfNormalizeText([
                record.macro_category,
                record.subcategory,
                record.category_name,
                record.description
            ].filter(Boolean).join(' '));
        }

        function pdfIsTransfer(record = {}) {
            const text = pdfExpenseText(record);
            return text.includes('TRANSFER') || text.includes('TRANSF');
        }

        function pdfIsInvestment(record = {}) {
            const text = pdfExpenseText(record);
            return text.includes('INVEST') || text.includes('APLICACAO') || text.includes('TESOURO') || text.includes('RENDA FIXA');
        }

        function pdfIsReserve(record = {}) {
            const text = pdfExpenseText(record);
            return text.includes('RESERVA');
        }

        function pdfIsFixedExpense(record = {}) {
            const text = pdfExpenseText(record);
            return text.includes('FIXO') || text.includes('ALUGUEL') || text.includes('FINANCIAMENTO') || text.includes('ASSINATURA');
        }

        function pdfIsNonEssential(record = {}) {
            const text = pdfExpenseText(record);
            return text.includes('SUPERFLUO') || text.includes('LAZER') || text.includes('DELIVERY') || text.includes('IFOOD') || text.includes('RESTAURANTE') || text.includes('SHOPPING');
        }

        function pdfGetEntradaValue(entry = {}) {
            return roundCurrency(Number(entry.cardLiquido ?? entry.liquido ?? entry.amount ?? 0) || 0);
        }

        function pdfGetVariableRevenue(entry = {}) {
            const total = pdfGetEntradaValue(entry);
            const hourExtra = Math.max(0, Number(entry.cardHourExtra ?? entry.hourExtra ?? 0) || 0);
            const text = pdfNormalizeText([entry.receivingType, entry.earning_type, entry.description, entry.macro_category].filter(Boolean).join(' '));
            if (text.includes('HORA EXTRA') || text.includes('BONUS') || text.includes('VARIAVEL')) return total;
            return roundCurrency(Math.min(total, hourExtra));
        }

        function pdfClassifyImpact(record = {}) {
            if (pdfIsTransfer(record)) return 'Transferência';
            if (pdfIsInvestment(record) || pdfIsReserve(record)) return 'Estrutural';
            if (pdfIsFixedExpense(record)) return 'Estrutural';
            if (pdfIsNonEssential(record)) return 'Comportamental';
            return 'Eventual';
        }

        function pdfFormatRatio(value) {
            const numeric = Number(value) || 0;
            if (!Number.isFinite(numeric)) return '0,00x';
            return `${numeric.toFixed(2).replace('.', ',')}x`;
        }

        function pdfTopExpenseLabel(record = {}) {
            return record.description || record.subcategory || record.category_name || record.macro_category || '-';
        }

        function buildPdfInsights(financialEntradas, saidas, realTotals = null) {
            const saidasPagas = saidas.filter((item) => item.status === 'Pago');
            const saidasEmAberto = saidas.filter((item) => item.status === 'Em aberto');
            const saidasPagasSemTransferencia = saidasPagas.filter((item) => !pdfIsTransfer(item));
            const saidasOperacionais = saidasPagasSemTransferencia.filter((item) => !pdfIsInvestment(item) && !pdfIsReserve(item));
            const saidasFixas = saidasOperacionais.filter(pdfIsFixedExpense);
            const saidasVariaveis = saidasOperacionais.filter((item) => !pdfIsFixedExpense(item));
            const saidasNaoEssenciais = saidasOperacionais.filter(pdfIsNonEssential);
            const saidasVencidas = saidasEmAberto.filter((item) => {
                const dueDate = item.due_date || item.occurred_date || '';
                return dueDate && dueDate < new Date().toISOString().slice(0, 10);
            });
            const receitas = realTotals
                ? realTotals.receitas
                : financialEntradas.reduce((sum, item) => sum + ((item.macro_category === 'Dedução') ? -(Number(item.amount) || 0) : (Number(item.amount) || 0)), 0);
            const receitaVariavel = roundCurrency(financialEntradas.reduce((sum, item) => sum + pdfGetVariableRevenue(item), 0));
            const receitaRecorrente = roundCurrency(Math.max(0, receitas - receitaVariavel));
            const despesas = realTotals
                ? realTotals.despesas
                : saidasPagasSemTransferencia.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
            const emAberto = realTotals
                ? realTotals.emAberto
                : saidasEmAberto.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
            const despesaFixa = roundCurrency(saidasFixas.reduce((sum, item) => sum + (Number(item.amount) || 0), 0));
            const despesaVariavel = roundCurrency(saidasVariaveis.reduce((sum, item) => sum + (Number(item.amount) || 0), 0));
            const despesaNaoEssencial = roundCurrency(saidasNaoEssenciais.reduce((sum, item) => sum + (Number(item.amount) || 0), 0));
            const despesaOperacional = roundCurrency(saidasOperacionais.reduce((sum, item) => sum + (Number(item.amount) || 0), 0));
            const resultadoOperacional = roundCurrency(receitas - despesaOperacional);
            const valoresVencidos = roundCurrency(saidasVencidas.reduce((sum, item) => sum + (Number(item.amount) || 0), 0));
            const saldoRealizado = realTotals ? realTotals.saldoRealizado : receitas - despesas;
            const saldoLiquido = realTotals ? realTotals.saldoLiquido : saldoRealizado - emAberto;
            const saldoProjetado = realTotals ? realTotals.saldoProjetado : saldoLiquido;
            const comprometimento = realTotals ? realTotals.comprometimento : (receitas > 0 ? (despesas / receitas) * 100 : 0);
            const indicadores = {
                comprometimento,
                taxaPoupanca: receitas > 0 ? (saldoLiquido / receitas) * 100 : 0,
                custoFixoSobreReceita: receitas > 0 ? (despesaFixa / receitas) * 100 : 0,
                burnRateMensal: despesas,
                coberturaFinanceira: (despesas + emAberto) > 0 ? receitas / (despesas + emAberto) : 0,
                percentualNaoEssencial: despesas > 0 ? (despesaNaoEssencial / despesas) * 100 : 0
            };

            const groupTotals = {
                'Despesas fixas': 0,
                'Despesas variáveis': 0,
                'Investimentos': 0,
                'Supérfluos': 0,
                'Reservas': 0
            };
            const byCategory = {};

            saidasPagasSemTransferencia.forEach((item) => {
                const amount = Number(item.amount) || 0;
                groupTotals[classifyExpenseGroup(item)] += amount;
                const category = item.macro_category || 'Outros';
                byCategory[category] = (byCategory[category] || 0) + amount;
            });

            const topCategoryEntry = Object.entries(byCategory).sort((a, b) => b[1] - a[1])[0];
            const topCategoryShare = topCategoryEntry && despesas > 0 ? (topCategoryEntry[1] / despesas) * 100 : 0;
            const topSaidas = [...saidasPagasSemTransferencia]
                .sort((a, b) => (Number(b.amount) || 0) - (Number(a.amount) || 0))
                .slice(0, 5);

            const diagnostics = [];
            if (receitas <= 0) diagnostics.push('Sem receita líquida no período filtrado.');
            else if (saldoLiquido < 0) diagnostics.push('O período opera com déficit e requer ajuste imediato.');
            else if (comprometimento >= 80) diagnostics.push('A renda está altamente comprometida e a margem de manobra é curta.');
            else if (saldoLiquido / receitas < 0.2) diagnostics.push('O período fecha positivo, mas com margem de segurança baixa.');
            else diagnostics.push('O período apresenta folga financeira e boa capacidade de absorver variações.');

            if (emAberto > 0 && receitas > 0) {
                const openRatio = (emAberto / receitas) * 100;
                if (openRatio >= 25) diagnostics.push('Há excesso de contas em aberto pressionando o caixa projetado.');
                else diagnostics.push('Existem pendências relevantes que merecem acompanhamento no curto prazo.');
            }

            if (topCategoryShare >= 35 && topCategoryEntry) {
                diagnostics.push(`Os gastos estão concentrados em ${topCategoryEntry[0]}, o que aumenta o risco de pressão pontual.`);
            }

            const alerts = [];
            if (saldoLiquido < 0) alerts.push('Despesa maior que receita no período.');
            if (comprometimento >= 80) alerts.push(`Comprometimento de renda em ${comprometimento.toFixed(1)}%.`);
            if (emAberto > 0 && receitas > 0 && (emAberto / receitas) * 100 >= 20) alerts.push('Contas em aberto acima de 20% da receita.');
            if (topCategoryShare >= 35 && topCategoryEntry) alerts.push(`Concentração excessiva de gasto em ${topCategoryEntry[0]}.`);
            if (saldoProjetado < 0) alerts.push('Saldo projetado fica negativo ao considerar pendências.');
            if (!alerts.length) alerts.push('Nenhum alerta crítico no recorte atual.');

            const recommendations = [];
            if (saldoLiquido < 0) recommendations.push('Segurar novos compromissos até recuperar o saldo operacional.');
            if (comprometimento >= 80) recommendations.push('Revisar gastos recorrentes e renegociar despesas fixas.');
            if (topCategoryShare >= 35 && topCategoryEntry) recommendations.push(`Reduzir ou redistribuir gastos na categoria ${topCategoryEntry[0]}.`);
            if (emAberto > 0) recommendations.push('Priorizar quitação das contas em aberto com maior impacto no caixa.');
            if (saldoLiquido > 0 && comprometimento < 70) recommendations.push('Existe margem para reforçar reserva ou investimento com disciplina.');
            if (!recommendations.length) recommendations.push('Manter o padrão atual e monitorar os indicadores do próximo período.');

            return {
                receitas,
                receitaRecorrente,
                receitaVariavel,
                despesas,
                despesaFixa,
                despesaVariavel,
                despesaNaoEssencial,
                despesaOperacional,
                resultadoOperacional,
                saldoRealizado,
                saldoLiquido,
                emAberto,
                saldoProjetado,
                comprometimento,
                valoresVencidos,
                totalAPagar: roundCurrency(despesas + emAberto),
                totalAReceber: receitas,
                indicadores,
                groupTotals,
                topSaidas,
                topCategoryEntry,
                topCategoryShare,
                diagnostics,
                alerts,
                recommendations,
                byCategory
            };
        }

        function pdfBuildExecutiveSummary(insights) {
            const resultLabel = insights.saldoLiquido >= 0 ? 'superávit' : 'déficit';
            const topCategory = insights.topCategoryEntry?.[0] || 'sem concentração relevante';
            const risk = insights.saldoLiquido < 0 || insights.comprometimento >= 80 ? 'alto' : insights.emAberto > 0 || insights.comprometimento >= 60 ? 'moderado' : 'baixo';
            return [
                `Situação geral: ${resultLabel} de ${fmt(Math.abs(insights.saldoLiquido))} no recorte analisado.`,
                `Principal driver: despesas pagas de ${fmt(insights.despesas)} contra receita de ${fmt(insights.receitas)}.`,
                `Risco financeiro: ${risk}, com ${fmt(insights.emAberto)} em contas ainda pendentes.`,
                `Comportamento relevante: maior concentração em ${topCategory}${insights.topCategoryShare ? ` (${pdfFormatPercent(insights.topCategoryShare)} das despesas pagas)` : ''}.`
            ];
        }

        function pdfBuildManagementInsights(insights) {
            const topCategory = insights.topCategoryEntry?.[0] || 'nenhuma categoria dominante';
            const topCategoryValue = insights.topCategoryEntry?.[1] || 0;
            return {
                resultadoOperacional: [
                    `Resultado operacional de ${fmt(insights.resultadoOperacional)} após excluir investimento, reserva e transferência do custo operacional.`,
                    insights.resultadoOperacional < 0
                        ? `A causa principal é despesa operacional superior à capacidade de receita em ${fmt(Math.abs(insights.resultadoOperacional))}.`
                        : `A operação cobre seus custos diretos com folga de ${fmt(insights.resultadoOperacional)}.`
                ],
                pressaoCaixa: [
                    `Cobertura financeira de ${pdfFormatRatio(insights.indicadores.coberturaFinanceira)} para obrigações pagas e em aberto.`,
                    insights.emAberto > 0
                        ? `Pendências de ${fmt(insights.emAberto)} reduzem o saldo projetado e exigem priorização de caixa.`
                        : 'Não há pressão relevante de contas em aberto no período.'
                ],
                concentracao: [
                    `Categoria dominante: ${topCategory}, com ${fmt(topCategoryValue)}.`,
                    insights.topCategoryShare >= 35
                        ? 'A concentração aumenta a dependência de uma única frente de gasto e reduz flexibilidade de ajuste.'
                        : 'A distribuição de gastos não indica dependência crítica de uma única categoria.'
                ],
                disciplina: [
                    `Gastos não essenciais representam ${pdfFormatPercent(insights.indicadores.percentualNaoEssencial)} da despesa paga.`,
                    insights.indicadores.percentualNaoEssencial > 15
                        ? `Há potencial de ajuste rápido em consumo discricionário estimado em ${fmt(insights.despesaNaoEssencial)}.`
                        : 'O consumo discricionário está controlado dentro do recorte atual.'
                ]
            };
        }

        function pdfBuildCauseDiagnosis(insights) {
            const topExpense = insights.topSaidas[0];
            const secondExpense = insights.topSaidas[1];
            const structuralShare = insights.despesas > 0 ? (insights.despesaFixa / insights.despesas) * 100 : 0;
            return [
                `Principal causa: ${insights.saldoLiquido < 0 ? 'despesa e pendência superam a receita disponível' : 'resultado sustentado por receita superior aos compromissos'} (${fmt(insights.saldoLiquido)}).`,
                `Segunda causa relevante: ${topExpense ? `${pdfTopExpenseLabel(topExpense)} consome ${fmt(topExpense.amount)}` : 'sem despesa dominante identificada'}.`,
                `Natureza do resultado: ${structuralShare >= 50 ? 'predominantemente estrutural, puxado por custos fixos' : secondExpense ? 'misto, com peso de gastos variáveis/eventuais' : 'pontual no recorte analisado'}.`
            ];
        }

        function pdfBuildProjectionLines(insights) {
            const adjustableCut = roundCurrency(insights.despesaNaoEssencial * 0.3);
            const adjustedBalance = roundCurrency(insights.saldoProjetado + adjustableCut);
            const ruptureRisk = insights.saldoProjetado < 0 ? 'existe risco de ruptura de caixa se o padrão for mantido' : 'não há ruptura projetada no recorte atual';
            return [
                `Cenário atual: saldo projetado de ${fmt(insights.saldoProjetado)} mantendo o padrão de gasto.`,
                `Cenário ajustado: corte de 30% nos não essenciais (${fmt(adjustableCut)}) elevaria o saldo para ${fmt(adjustedBalance)}.`,
                `Risco de ruptura de caixa: ${ruptureRisk}.`
            ];
        }

        function pdfBuildActionRecommendations(insights) {
            const topNonEssential = insights.topSaidas.find((item) => pdfIsNonEssential(item));
            const topFixed = insights.topSaidas.find((item) => pdfIsFixedExpense(item));
            const actions = [];
            if (topNonEssential) actions.push(`Cortar primeiro: ${pdfTopExpenseLabel(topNonEssential)}, impacto de ${fmt(topNonEssential.amount)} (${pdfFormatPercent(((Number(topNonEssential.amount) || 0) / Math.max(insights.despesas, 1)) * 100)} da despesa).`);
            if (insights.emAberto > 0) actions.push(`Priorizar pagamento/renegociação de contas em aberto: ${fmt(insights.emAberto)}.`);
            if (topFixed) actions.push(`Revisar custo fixo relevante: ${pdfTopExpenseLabel(topFixed)} (${fmt(topFixed.amount)}).`);
            actions.push(insights.despesaOperacional > 0 ? 'Não mexer inicialmente em investimentos/reservas antes de ajustar o consumo operacional.' : 'Manter investimentos/reservas fora da leitura de custo operacional.');
            actions.push(insights.saldoLiquido < 0 ? 'Prioridade: recuperar saldo projetado para zero antes de assumir novos compromissos.' : 'Prioridade: preservar o saldo positivo e reforçar reserva com excedente recorrente.');
            return actions;
        }

        function pdfStatusColor(kind, value) {
            if (kind === 'saldo') {
                if (value < 0) return [225, 29, 72];
                if (value === 0) return [245, 158, 11];
                return [16, 185, 129];
            }
            if (kind === 'comprometimento') {
                if (value >= 80) return [225, 29, 72];
                if (value >= 60) return [245, 158, 11];
                return [16, 185, 129];
            }
            if (kind === 'aberto') {
                if (value > 0) return [245, 158, 11];
                return [16, 185, 129];
            }
            return [14, 165, 233];
        }

        function drawPdfMetricCard(doc, x, y, w, h, label, value, color, helper = '') {
            doc.setFillColor(248, 250, 252);
            doc.setDrawColor(color[0], color[1], color[2]);
            doc.roundedRect(x, y, w, h, 10, 10, 'FD');
            doc.setFontSize(9);
            doc.setTextColor(100);
            doc.text(label, x + 12, y + 18);
            doc.setFontSize(15);
            doc.setTextColor(color[0], color[1], color[2]);
            doc.text(value, x + 12, y + 40);
            if (helper) {
                doc.setFontSize(8);
                doc.setTextColor(100);
                doc.text(helper, x + 12, y + 56);
            }
        }

        async function renderPdfChart(config, width = 900, height = 320) {
            if (!window.Chart) return null;
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const chart = new Chart(canvas.getContext('2d'), {
                ...config,
                options: {
                    responsive: false,
                    animation: false,
                    ...config.options
                }
            });
            await new Promise((resolve) => setTimeout(resolve, 30));
            const image = canvas.toDataURL('image/png', 1);
            chart.destroy();
            return image;
        }

        function pdfFormatPercent(value) {
            return `${(Number(value) || 0).toFixed(1)}%`;
        }

        function pdfFormatHours(value) {
            return formatHoursDecimal(Math.abs(Number(value) || 0));
        }

        function pdfFormatSignedHours(value) {
            const numeric = Number(value) || 0;
            if (numeric === 0) return '00:00';
            return `${numeric > 0 ? '+' : '-'}${pdfFormatHours(numeric)}`;
        }

        function pdfDrawRoundedBlock(doc, x, y, w, h, fillColor, strokeColor = null, radius = 12) {
            doc.setFillColor(fillColor[0], fillColor[1], fillColor[2]);
            if (strokeColor) {
                doc.setDrawColor(strokeColor[0], strokeColor[1], strokeColor[2]);
                doc.roundedRect(x, y, w, h, radius, radius, 'FD');
            } else {
                doc.roundedRect(x, y, w, h, radius, radius, 'F');
            }
        }

        function pdfDrawChip(doc, x, y, text, fill = [241, 245, 249], color = [71, 85, 105]) {
            const width = Math.min(220, doc.getTextWidth(text) + 18);
            pdfDrawRoundedBlock(doc, x, y - 9, width, 18, fill, null, 8);
            doc.setTextColor(color[0], color[1], color[2]);
            doc.setFontSize(8);
            doc.text(text, x + 9, y + 3);
            return width;
        }

        function pdfDrawExecutiveCard(doc, x, y, w, h, label, value, helper, color) {
            pdfDrawRoundedBlock(doc, x, y, w, h, [255, 255, 255], [226, 232, 240], 14);
            doc.setFillColor(color[0], color[1], color[2]);
            doc.roundedRect(x, y, 6, h, 6, 6, 'F');
            doc.setTextColor(100, 116, 139);
            doc.setFontSize(9);
            doc.text(label, x + 18, y + 18);
            doc.setTextColor(15, 23, 42);
            doc.setFontSize(18);
            doc.text(value, x + 18, y + 41);
            if (helper) {
                doc.setTextColor(100, 116, 139);
                doc.setFontSize(8);
                doc.text(helper, x + 18, y + 57);
            }
        }

        function pdfDrawTextPanel(doc, x, y, w, title, lines, tone = 'neutral') {
            const tones = {
                neutral: { bg: [248, 250, 252], title: [15, 23, 42], text: [71, 85, 105] },
                success: { bg: [240, 253, 244], title: [21, 128, 61], text: [22, 101, 52] },
                warn: { bg: [255, 251, 235], title: [180, 83, 9], text: [146, 64, 14] },
                danger: { bg: [255, 241, 242], title: [190, 24, 93], text: [159, 18, 57] }
            };
            const palette = tones[tone] || tones.neutral;
            const content = Array.isArray(lines) ? lines : [lines];
            const textLines = content.flatMap((item) => doc.splitTextToSize(`• ${item}`, w - 24));
            const h = Math.max(84, 26 + (textLines.length * 11) + 14);
            pdfDrawRoundedBlock(doc, x, y, w, h, palette.bg, null, 12);
            doc.setTextColor(palette.title[0], palette.title[1], palette.title[2]);
            doc.setFontSize(11);
            doc.text(title, x + 12, y + 18);
            doc.setTextColor(palette.text[0], palette.text[1], palette.text[2]);
            doc.setFontSize(8.5);
            let lineY = y + 36;
            textLines.forEach((line) => {
                doc.text(line, x + 12, lineY);
                lineY += 11;
            });
            return h;
        }

        function pdfDrawMiniTable(doc, x, y, w, title, headers, rows, accentColor, columnWidths = []) {
            const headerHeight = 18;
            const rowHeight = 16;
            const titleHeight = 18;
            const tableRows = rows.length ? rows : [['Sem dados', '', '', ''].slice(0, headers.length)];
            const h = titleHeight + headerHeight + (tableRows.length * rowHeight) + 12;
            pdfDrawRoundedBlock(doc, x, y, w, h, [255, 255, 255], [226, 232, 240], 12);

            doc.setTextColor(15, 23, 42);
            doc.setFontSize(11);
            doc.text(title, x + 12, y + 16);

            const innerX = x + 10;
            const innerY = y + 24;
            const innerW = w - 20;
            const widths = columnWidths.length
                ? columnWidths
                : headers.map(() => innerW / headers.length);

            doc.setFillColor(accentColor[0], accentColor[1], accentColor[2]);
            doc.roundedRect(innerX, innerY, innerW, headerHeight, 6, 6, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(7.5);
            let cursorX = innerX + 8;
            headers.forEach((header, index) => {
                doc.text(header, cursorX, innerY + 12);
                cursorX += widths[index];
            });

            doc.setFontSize(7.5);
            tableRows.forEach((row, rowIndex) => {
                const rowY = innerY + headerHeight + (rowIndex * rowHeight);
                if (rowIndex % 2 === 0) {
                    doc.setFillColor(248, 250, 252);
                    doc.rect(innerX, rowY, innerW, rowHeight, 'F');
                }
                doc.setTextColor(71, 85, 105);
                let valueX = innerX + 8;
                row.forEach((cell, cellIndex) => {
                    const text = String(cell ?? '');
                    const maxWidth = Math.max(22, widths[cellIndex] - 10);
                    const clipped = text.length > 42 ? `${text.slice(0, 39)}...` : text;
                    doc.text(doc.splitTextToSize(clipped, maxWidth)[0] || '', valueX, rowY + 11);
                    valueX += widths[cellIndex];
                });
            });

            return h;
        }

        function pdfGetExecutiveStatus(insights) {
            if (insights.saldoLiquido < 0 || insights.saldoProjetado < 0) {
                return { label: 'Situação crítica', tone: 'danger', note: 'Caixa pressionado e necessidade imediata de ajuste.' };
            }
            if (insights.comprometimento >= 80 || insights.emAberto > 0) {
                return { label: 'Situação de atenção', tone: 'warn', note: 'O período exige acompanhamento próximo de despesas e pendências.' };
            }
            return { label: 'Situação saudável', tone: 'success', note: 'O período apresenta boa folga e controle operacional.' };
        }

        function pdfGetReportStatusMeta(status) {
            const normalized = String(status || '').trim().toLowerCase();
            if (normalized === 'pago') {
                return {
                    label: 'Pago',
                    dot: [34, 197, 94],
                    bg: [240, 253, 244],
                    text: [21, 128, 61]
                };
            }
            if (normalized === 'em aberto') {
                return {
                    label: 'Em aberto',
                    dot: [245, 158, 11],
                    bg: [255, 251, 235],
                    text: [180, 83, 9]
                };
            }
            if (normalized === 'cancelado') {
                return {
                    label: 'Cancelado',
                    dot: [148, 163, 184],
                    bg: [248, 250, 252],
                    text: [100, 116, 139]
                };
            }
            return {
                label: status || '-',
                dot: [148, 163, 184],
                bg: [248, 250, 252],
                text: [71, 85, 105]
            };
        }

        function pdfDrawStatusBadge(doc, cell, status) {
            const meta = pdfGetReportStatusMeta(status);
            const badgeHeight = 12;
            const badgeWidth = Math.min(cell.width - 8, Math.max(34, doc.getTextWidth(meta.label) + 22));
            const badgeX = cell.x + 4;
            const badgeY = cell.y + ((cell.height - badgeHeight) / 2);

            doc.setFillColor(meta.bg[0], meta.bg[1], meta.bg[2]);
            doc.roundedRect(badgeX, badgeY, badgeWidth, badgeHeight, 6, 6, 'F');
            doc.setFillColor(meta.dot[0], meta.dot[1], meta.dot[2]);
            doc.circle(badgeX + 6.5, badgeY + (badgeHeight / 2), 2.2, 'F');
            doc.setTextColor(meta.text[0], meta.text[1], meta.text[2]);
            doc.setFontSize(7.3);
            doc.text(meta.label, badgeX + 12, badgeY + 8.2);
        }

        function pdfGetRecordType(record = {}) {
            if (record.type === 'saida') return 'Saida';
            return 'Entrada';
        }

        function pdfGetRecordAmount(record = {}) {
            if (record.type === 'saida') return Number(record.amount) || 0;
            return Number(record.cardLiquido ?? record.liquido ?? record.amount ?? 0) || 0;
        }

        function pdfGetRecordDateKey(record = {}) {
            return record.occurred_date || record.due_date || (record.competence || record.competencia ? `${record.competence || record.competencia}-01` : '');
        }

        async function exportPDF() {
            const pdfFinancialData = getPdfDashboardFinancialData();
            const lancamentos = pdfFinancialData.detailedRecords;
            if (!lancamentos.length && Number(pdfFinancialData.totals?.receitas || 0) <= 0) { showToast('Sem lançamentos para exportar no filtro atual', true); return; }
            try {
                await ensurePdfLibraries();
            } catch (error) {
                showToast('Não foi possível carregar a biblioteca de PDF', true);
                return;
            }
            if (!window.jspdf?.jsPDF) { showToast('Biblioteca de PDF não carregada', true); return; }

            const { jsPDF } = window.jspdf;
            const doc = new jsPDF('l', 'pt', 'a4');
            const autoTable = doc.autoTable || window.jspdf.autoTable;
            if (!autoTable) { showToast('Tabela do PDF não está disponível', true); return; }

            const financialEntradas = pdfFinancialData.financialEntradas;
            const saidas = pdfFinancialData.saidas;
            const insights = buildPdfInsights(financialEntradas, saidas, pdfFinancialData.totals);
            const hourSummary = getPdfHourSummary();
            const hoje = new Date().toLocaleDateString('pt-BR');
            const filterLabels = getPdfFilterLabels();
            const titulo = focusedDashboardCard === 'aberto' ? 'Relatório Financeiro Gerencial - Em Aberto' : 'Relatório Financeiro Gerencial';
            const executiveStatus = pdfGetExecutiveStatus(insights);
            const pageWidth = 842;
            const contentWidth = 762;
            const left = 40;
            const top = 34;

            doc.setFillColor(15, 23, 42);
            doc.rect(0, 0, pageWidth, 128, 'F');
            doc.setFillColor(30, 41, 59);
            doc.circle(720, 24, 120, 'F');
            doc.circle(785, 108, 88, 'F');

            doc.setTextColor(255, 255, 255);
            doc.setFontSize(24);
            doc.text(titulo, left, top + 4);
            doc.setFontSize(10);
            doc.text(`Gerado em ${hoje}`, left, top + 26);
            doc.text(filterLabels[0], left, top + 42);

            let chipX = left;
            let chipY = top + 68;
            filterLabels.slice(1).forEach((label) => {
                const width = pdfDrawChip(doc, chipX, chipY, label, [30, 41, 59], [226, 232, 240]);
                chipX += width + 8;
                if (chipX > 700) {
                    chipX = left;
                    chipY += 22;
                }
            });

            pdfDrawRoundedBlock(doc, 600, 28, 202, 70, executiveStatus.tone === 'danger' ? [69, 10, 10] : executiveStatus.tone === 'warn' ? [69, 26, 3] : [6, 78, 59], null, 16);
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(11);
            doc.text('Resumo executivo', 616, 50);
            doc.setFontSize(18);
            doc.text(executiveStatus.label, 616, 74);
            doc.setFontSize(8.5);
            doc.text(doc.splitTextToSize(executiveStatus.note, 170), 616, 90);

            const executiveSummary = pdfBuildExecutiveSummary(insights);
            const managementInsights = pdfBuildManagementInsights(insights);
            const causeDiagnosis = pdfBuildCauseDiagnosis(insights);
            const projectionLines = pdfBuildProjectionLines(insights);
            const actionRecommendations = pdfBuildActionRecommendations(insights);

            let y = 136;
            const cardGap = 12;
            const cardW = (contentWidth - (cardGap * 3)) / 4;
            const executiveCards = [
                ['Receita total', fmt(insights.receitas), 'base líquida real', [16, 185, 129]],
                ['Receita recorrente', fmt(insights.receitaRecorrente), 'parte previsível', [14, 165, 233]],
                ['Receita variável', fmt(insights.receitaVariavel), 'horas/ajustes', [99, 102, 241]],
                ['Despesa total', fmt(insights.despesas), 'sem transferências', [244, 63, 94]],
                ['Despesa fixa', fmt(insights.despesaFixa), 'custo estrutural', [225, 29, 72]],
                ['Despesa variável', fmt(insights.despesaVariavel), 'consumo operacional', [245, 158, 11]],
                ['Resultado operacional', fmt(insights.resultadoOperacional), 'sem investimento/reserva', pdfStatusColor('saldo', insights.resultadoOperacional)],
                ['Saldo projetado', fmt(insights.saldoProjetado), 'com contas em aberto', pdfStatusColor('saldo', insights.saldoProjetado)]
            ];
            executiveCards.forEach((card, index) => {
                const row = Math.floor(index / 4);
                const col = index % 4;
                pdfDrawExecutiveCard(doc, left + ((cardW + cardGap) * col), y + (row * 82), cardW, 66, card[0], card[1], card[2], card[3]);
            });

            y += 176;
            const leftColW = 360;
            const rightColW = 390;
            const indicatorRows = [
                ['Comprometimento da renda', pdfFormatPercent(insights.indicadores.comprometimento)],
                ['Taxa de poupança', pdfFormatPercent(insights.indicadores.taxaPoupanca)],
                ['Custo fixo / receita', pdfFormatPercent(insights.indicadores.custoFixoSobreReceita)],
                ['Burn rate mensal', fmt(insights.indicadores.burnRateMensal)],
                ['Cobertura financeira', pdfFormatRatio(insights.indicadores.coberturaFinanceira)],
                ['Despesas não essenciais', pdfFormatPercent(insights.indicadores.percentualNaoEssencial)]
            ];
            const cashRows = [
                ['Total a receber', fmt(insights.totalAReceber)],
                ['Total a pagar', fmt(insights.totalAPagar)],
                ['Valores vencidos', fmt(insights.valoresVencidos)],
                ['Saldo projetado', fmt(insights.saldoProjetado)],
                ['Cobertura', pdfFormatRatio(insights.indicadores.coberturaFinanceira)]
            ];
            const indicatorsH = pdfDrawMiniTable(doc, left, y, leftColW, 'Indicadores chave', ['Indicador', 'Valor'], indicatorRows, [14, 165, 233], [230, 100]);
            const cashH = pdfDrawMiniTable(doc, left + leftColW + 12, y, rightColW, 'Estrutura de caixa', ['Item', 'Valor'], cashRows, [16, 185, 129], [230, 120]);
            y += Math.max(indicatorsH, cashH) + 14;

            doc.addPage();
            y = 34;
            doc.setTextColor(15, 23, 42);
            doc.setFontSize(18);
            doc.text('Leitura gerencial', left, y);
            doc.setFontSize(9);
            doc.setTextColor(100, 116, 139);
            doc.text('Interpretação executiva orientada a causa, impacto, risco e ação.', left, y + 18);
            y += 36;

            const summaryH = pdfDrawTextPanel(doc, left, y, leftColW, 'Resumo executivo do período', executiveSummary, executiveStatus.tone);
            const opH = pdfDrawTextPanel(doc, left + leftColW + 12, y, rightColW, 'Resultado operacional', managementInsights.resultadoOperacional, insights.resultadoOperacional < 0 ? 'danger' : 'success');
            y += Math.max(summaryH, opH) + 12;

            const pressureH = pdfDrawTextPanel(doc, left, y, leftColW, 'Pressão de caixa', managementInsights.pressaoCaixa, insights.emAberto > 0 ? 'warn' : 'success');
            const concentrationH = pdfDrawTextPanel(doc, left + leftColW + 12, y, rightColW, 'Concentração de gastos', managementInsights.concentracao, insights.topCategoryShare >= 35 ? 'warn' : 'neutral');
            y += Math.max(pressureH, concentrationH) + 12;

            const disciplineH = pdfDrawTextPanel(doc, left, y, leftColW, 'Disciplina financeira', managementInsights.disciplina, insights.indicadores.percentualNaoEssencial > 15 ? 'warn' : 'neutral');
            const causeH = pdfDrawTextPanel(doc, left + leftColW + 12, y, rightColW, 'Diagnóstico de causa', causeDiagnosis, executiveStatus.tone);
            y += Math.max(disciplineH, causeH) + 12;

            const projectionH = pdfDrawTextPanel(doc, left, y, leftColW, 'Projeção financeira', projectionLines, insights.saldoProjetado < 0 ? 'danger' : 'neutral');
            const actionsH = pdfDrawTextPanel(doc, left + leftColW + 12, y, rightColW, 'Recomendações práticas', actionRecommendations, 'neutral');
            y += Math.max(projectionH, actionsH) + 14;

            if (y > 420) {
                doc.addPage();
                y = 40;
            }
            doc.setTextColor(15, 23, 42);
            doc.setFontSize(16);
            doc.text('Estrutura e impacto dos gastos', left, y);
            doc.setFontSize(9);
            doc.setTextColor(100, 116, 139);
            doc.text('Investimentos e transferências não são tratados como despesa operacional.', left, y + 16);
            y += 30;

            const groupRows = [
                'Despesas fixas',
                'Despesas variáveis',
                'Investimentos',
                'Supérfluos',
                'Reservas'
            ].map((group) => {
                const value = insights.groupTotals[group] || 0;
                const percent = insights.receitas > 0 ? pdfFormatPercent((value / insights.receitas) * 100) : '0,0%';
                return [group, fmt(value), percent];
            });
            const top5Rows = insights.topSaidas.map((item, index) => [
                `${index + 1}. ${item.description || item.subcategory || '-'}`,
                item.macro_category || '-',
                fmt(item.amount),
                pdfFormatPercent(((Number(item.amount) || 0) / Math.max(insights.despesas, 1)) * 100),
                pdfClassifyImpact(item)
            ]);

            const groupTableHeight = pdfDrawMiniTable(
                doc,
                left,
                y,
                360,
                'Análise por grupo de gasto',
                ['Grupo', 'Valor', '% receita'],
                groupRows,
                [14, 165, 233],
                [180, 90, 70]
            );
            const topTableHeight = pdfDrawMiniTable(
                doc,
                left + leftColW + 12,
                y,
                390,
                'Ranking de impacto financeiro',
                ['Nome', 'Categoria', 'Valor', '%', 'Classe'],
                top5Rows,
                [244, 63, 94],
                [130, 70, 65, 40, 70]
            );
            y += Math.max(groupTableHeight, topTableHeight) + 16;

            const categoryEntries = Object.entries(insights.byCategory).sort((a, b) => b[1] - a[1]);
            const rankingChart = await renderPdfChart({
                type: 'bar',
                data: {
                    labels: insights.topSaidas.map((item) => (item.description || item.subcategory || '-').slice(0, 18)),
                    datasets: [{
                        label: 'Maiores gastos',
                        data: insights.topSaidas.map((item) => Number(item.amount) || 0),
                        backgroundColor: '#f43f5e',
                        borderRadius: 4
                    }]
                },
                options: {
                    plugins: { legend: { display: false } },
                    scales: {
                        x: { ticks: { color: '#64748b', font: { size: 10 } }, grid: { display: false } },
                        y: { ticks: { color: '#64748b', callback: (value) => fmt(value) }, grid: { color: '#e2e8f0' } }
                    }
                }
            }, 900, 260);
            const compareChart = await renderPdfChart({
                type: 'bar',
                data: {
                    labels: ['Entradas', 'Saídas', 'Em aberto'],
                    datasets: [{
                        label: 'Resumo',
                        data: [insights.receitas, insights.despesas, insights.emAberto],
                        backgroundColor: ['#34d399', '#f43f5e', '#f59e0b'],
                        borderRadius: 6
                    }]
                },
                options: {
                    plugins: { legend: { display: false } },
                    scales: {
                        x: { ticks: { color: '#64748b', font: { size: 10 } }, grid: { display: false } },
                        y: { ticks: { color: '#64748b', callback: (value) => fmt(value) }, grid: { color: '#e2e8f0' } }
                    }
                }
            }, 900, 260);
            const donutChart = await renderPdfChart({
                type: 'doughnut',
                data: {
                    labels: categoryEntries.map((entry) => entry[0]),
                    datasets: [{
                        data: categoryEntries.map((entry) => entry[1]),
                        backgroundColor: ['#38bdf8', '#f43f5e', '#34d399', '#f59e0b', '#6366f1', '#94a3b8'],
                        borderWidth: 0
                    }]
                },
                options: {
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: { color: '#64748b', font: { size: 10 }, padding: 8 }
                        }
                    }
                }
            }, 600, 300);

            doc.addPage();
            y = 40;
            doc.setTextColor(15, 23, 42);
            doc.setFontSize(18);
            doc.text('Gráficos de decisão', left, y);
            doc.setFontSize(9);
            doc.setTextColor(100, 116, 139);
            doc.text('Todos os gráficos e indicadores usam o mesmo recorte já aplicado no dashboard.', left, y + 18);
            y += 36;

            const hourCardGap = 12;
            const hourCardW = (contentWidth - (hourCardGap * 4)) / 5;
            pdfDrawExecutiveCard(doc, left, y, hourCardW, 74, 'H.E. realizadas', pdfFormatHours(hourSummary.overtimeHours), `${hourSummary.recordsCount} registro(s) de horas`, [14, 165, 233]);
            pdfDrawExecutiveCard(doc, left + (hourCardW + hourCardGap), y, hourCardW, 74, 'Valor H.E.', fmt(hourSummary.overtimeAmount), 'total financeiro calculado', [16, 185, 129]);
            pdfDrawExecutiveCard(doc, left + ((hourCardW + hourCardGap) * 2), y, hourCardW, 74, 'Banco débito', pdfFormatHours(hourSummary.bankDebitHours), 'horas que somam saldo', [245, 158, 11]);
            pdfDrawExecutiveCard(doc, left + ((hourCardW + hourCardGap) * 3), y, hourCardW, 74, 'Banco crédito', pdfFormatHours(hourSummary.bankCreditHours), 'horas que reduzem saldo', [99, 102, 241]);
            pdfDrawExecutiveCard(doc, left + ((hourCardW + hourCardGap) * 4), y, hourCardW, 74, 'Saldo banco', pdfFormatSignedHours(hourSummary.bankNetHours), 'saldo acumulado até o fim do período', pdfStatusColor('saldo', hourSummary.bankNetHours));
            y += 92;

            const hourRows = hourSummary.byPerson.slice(0, 8).map((item) => [
                item.person,
                pdfFormatHours(item.overtimeHours),
                fmt(item.overtimeAmount),
                pdfFormatHours(item.bankDebitHours),
                pdfFormatHours(item.bankCreditHours),
                pdfFormatSignedHours(item.bankNetHours)
            ]);
            y += pdfDrawMiniTable(
                doc,
                left,
                y,
                contentWidth,
                'Resumo de horas extras e banco de horas',
                ['Pessoa', 'H.E.', 'Valor H.E.', 'Débito', 'Crédito', 'Saldo'],
                hourRows,
                [14, 165, 233],
                [170, 90, 110, 90, 90, 90]
            ) + 18;

            try {
                pdfDrawRoundedBlock(doc, left, y, 240, 184, [255, 255, 255], [226, 232, 240], 16);
                pdfDrawRoundedBlock(doc, 294, y, 240, 184, [255, 255, 255], [226, 232, 240], 16);
                pdfDrawRoundedBlock(doc, 548, y, 254, 184, [255, 255, 255], [226, 232, 240], 16);
                doc.setFontSize(11);
                doc.setTextColor(15, 23, 42);
                doc.text('Distribuição por categoria', left + 12, y + 18);
                doc.text('Entradas x saídas', 306, y + 18);
                doc.text('Ranking dos maiores gastos', 560, y + 18);
                if (donutChart) doc.addImage(donutChart, 'PNG', left + 8, y + 28, 224, 144);
                if (compareChart) doc.addImage(compareChart, 'PNG', 302, y + 30, 224, 140);
                if (rankingChart) doc.addImage(rankingChart, 'PNG', 556, y + 30, 238, 138);
            } catch (error) {
                console.warn('Falha ao renderizar gráficos do PDF', error);
            }

            doc.addPage();
            const detailedRecords = [...lancamentos]
                .sort((a, b) => pdfGetRecordDateKey(a).localeCompare(pdfGetRecordDateKey(b)));
            const polishedTableRows = detailedRecords.map((record) => ({
                data: (pdfGetRecordDateKey(record) ? pdfGetRecordDateKey(record).split('-').reverse().join('/') : ''),
                tipo: pdfGetRecordType(record),
                pessoa: record.person || '-',
                categoria: record.macro_category || record.subcategory || record.receivingType || '-',
                descricao: record.description || record.subcategory || record.earning_type || (record.cycleView === 'QUINZENA' ? 'Entrada consolidada - Quinzena' : 'Entrada consolidada - Início do mês'),
                valor: fmt(pdfGetRecordAmount(record)),
                status: record.status || '-',
                competencia: record.competence || record.competencia || '-'
            }));
            const pagosCount = detailedRecords.filter((record) => String(record.status || '').trim() === 'Pago').length;
            const abertoCount = detailedRecords.filter((record) => String(record.status || '').trim() === 'Em aberto').length;

            pdfDrawRoundedBlock(doc, left, 28, contentWidth, 68, [248, 250, 252], [226, 232, 240], 16);
            doc.setFillColor(15, 23, 42);
            doc.roundedRect(left, 28, 8, 68, 8, 8, 'F');
            doc.setFontSize(18);
            doc.setTextColor(15, 23, 42);
            doc.text('Tabela detalhada final', left + 22, 54);
            doc.setFontSize(9);
            doc.setTextColor(100, 116, 139);
            doc.text('Base integral do mesmo período e filtros usados na tela no momento da exportação.', left + 22, 72);

            let tableChipX = 560;
            const tableChipY = 54;
            [
                `${polishedTableRows.length} lancamentos`,
                `${pagosCount} pagos`,
                `${abertoCount} em aberto`
            ].forEach((label, index) => {
                const fill = index === 1 ? [240, 253, 244] : index === 2 ? [255, 251, 235] : [226, 232, 240];
                const text = index === 1 ? [21, 128, 61] : index === 2 ? [180, 83, 9] : [51, 65, 85];
                tableChipX += pdfDrawChip(doc, tableChipX, tableChipY, label, fill, text) + 8;
            });

            autoTable.call(doc, {
                startY: 112,
                columns: [
                    { header: 'Data', dataKey: 'data' },
                    { header: 'Tipo', dataKey: 'tipo' },
                    { header: 'Pessoa', dataKey: 'pessoa' },
                    { header: 'Categoria', dataKey: 'categoria' },
                    { header: 'Descricao', dataKey: 'descricao' },
                    { header: 'Valor', dataKey: 'valor' },
                    { header: 'Status', dataKey: 'status' },
                    { header: 'Competencia', dataKey: 'competencia' }
                ],
                body: polishedTableRows,
                theme: 'plain',
                margin: { left: 24, right: 24, bottom: 26 },
                tableWidth: 794,
                headStyles: {
                    fillColor: [15, 23, 42],
                    textColor: [255, 255, 255],
                    fontSize: 8,
                    fontStyle: 'bold',
                    cellPadding: { top: 6, right: 8, bottom: 6, left: 8 },
                    halign: 'left',
                    valign: 'middle'
                },
                bodyStyles: {
                    textColor: [71, 85, 105],
                    fontSize: 7.6,
                    cellPadding: { top: 6, right: 8, bottom: 6, left: 8 },
                    lineColor: [241, 245, 249],
                    lineWidth: 0.6,
                    valign: 'middle'
                },
                alternateRowStyles: {
                    fillColor: [250, 252, 255]
                },
                styles: {
                    overflow: 'linebreak'
                },
                columnStyles: {
                    data: { cellWidth: 60 },
                    tipo: { cellWidth: 52 },
                    pessoa: { cellWidth: 76 },
                    categoria: { cellWidth: 98 },
                    descricao: { cellWidth: 270 },
                    valor: { cellWidth: 74, halign: 'right', fontStyle: 'bold', textColor: [15, 23, 42] },
                    status: { cellWidth: 76 },
                    competencia: { cellWidth: 72, halign: 'center' }
                },
                didParseCell(data) {
                    if (data.section === 'body' && data.column.dataKey === 'status') {
                        data.cell.text = [''];
                    }
                },
                didDrawCell(data) {
                    if (data.section === 'body' && data.column.dataKey === 'status') {
                        pdfDrawStatusBadge(doc, data.cell, data.row.raw.status);
                    }
                }
            });

            const totalPages = doc.getNumberOfPages();
            for (let page = 1; page <= totalPages; page++) {
                doc.setPage(page);
                const pageHeight = doc.internal.pageSize.getHeight();
                doc.setDrawColor(226, 232, 240);
                doc.line(24, pageHeight - 18, 818, pageHeight - 18);
                doc.setFontSize(8);
                doc.setTextColor(148, 163, 184);
                doc.text('Relatório Financeiro Gerencial', 24, pageHeight - 7);
                doc.text(`Pagina ${page} de ${totalPages}`, 770, pageHeight - 7, { align: 'right' });
            }

            doc.save(`Relatorio_Financeiro_${hoje.replace(/\//g, '-')}.pdf`);
            showToast('Relatório PDF exportado!');
            return;

            const tableRows = [...lancamentos]
                .sort((a, b) => ((a.occurred_date || a.due_date || '')).localeCompare(b.occurred_date || b.due_date || ''))
                .map((r) => [
                    ((r.occurred_date || r.due_date || '') ? (r.occurred_date || r.due_date).split('-').reverse().join('/') : ''),
                    r.type === 'entrada' ? 'Entrada' : 'Saída',
                    r.person || '-',
                    r.macro_category || r.subcategory || '-',
                    r.description || r.subcategory || r.earning_type || '-',
                    fmt(r.amount),
                    r.status || '-',
                    r.competence || '-'
                ]);

            doc.setFontSize(18);
            doc.setTextColor(15, 23, 42);
            doc.text('Tabela detalhada final', left, 40);
            doc.setFontSize(9);
            doc.setTextColor(100, 116, 139);
            doc.text('Base integral do mesmo período e filtros usados na tela no momento da exportação.', left, 58);
            autoTable.call(doc, {
                startY: 74,
                head: [['Data', 'Tipo', 'Pessoa', 'Categoria', 'Descrição', 'Valor', 'Status', 'Competência']],
                body: tableRows,
                theme: 'striped',
                headStyles: { fillColor: [15, 23, 42] },
                alternateRowStyles: { fillColor: [248, 250, 252] },
                styles: { fontSize: 7.5, cellPadding: 4, overflow: 'linebreak' },
                margin: { left: 24, right: 24 },
                columnStyles: {
                    0: { cellWidth: 52 },
                    1: { cellWidth: 44 },
                    2: { cellWidth: 72 },
                    3: { cellWidth: 88 },
                    4: { cellWidth: 250 },
                    5: { cellWidth: 62, halign: 'right' },
                    6: { cellWidth: 56 },
                    7: { cellWidth: 66 }
                }
            });

            doc.save(`Relatorio_Financeiro_${hoje.replace(/\//g, '-')}.pdf`);
            showToast('Relatório PDF exportado!');
        }
        // ============ CATEGORY MANAGEMENT ============
        function getReferenceScope(record) {
            return record?.shared_scope === 'global' ? 'global' : 'personal';
        }

        function getReferenceScopeLabel(record) {
            return getReferenceScope(record) === 'global' ? 'Global' : 'Pessoal';
        }

        function canMaintainReference(record = {}) {
            return getReferenceScope(record) !== 'global' || window.isCurrentUserAdmin?.() === true;
        }

        function referenceScopeBadge(record) {
            const scope = getReferenceScope(record);
            const classes = scope === 'global'
                ? 'bg-accent/10 text-accent border-accent/20'
                : 'bg-success/10 text-success border-success/20';
            return `<span class="inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold ${classes}">${getReferenceScopeLabel(record)}</span>`;
        }

        function hasReferenceUsage(reference = {}) {
            if (!reference?.type) return false;
            if (reference.type === 'macro') {
                const macroName = String(reference.macro_category || '').trim();
                const macroId = String(reference.macro_id || reference.id || '').trim();
                return allRecords.some((record) =>
                    (record.type === 'saida' || record.type === 'entrada' || record.type === 'percentage_rule') &&
                    ((macroId && String(record.macro_id || '') === macroId) || (macroName && String(record.macro_category || '') === macroName))
                );
            }
            if (reference.type === 'categoria') {
                const categoryName = String(reference.category_name || reference.subcategory || '').trim();
                const categoryId = String(reference.category_id || reference.id || '').trim();
                const macroName = String(reference.macro_category || '').trim();
                return allRecords.some((record) =>
                    (record.type === 'saida' || record.type === 'entrada' || record.type === 'percentage_rule') &&
                    ((categoryId && String(record.category_id || '') === categoryId) || (categoryName && String(record.subcategory || record.category_name || record.description || '') === categoryName && (!macroName || String(record.macro_category || '') === macroName)))
                );
            }
            return false;
        }

        function configureReferenceScopeInput(id, wrapId, value = 'personal', locked = false) {
            const select = document.getElementById(id);
            const wrap = document.getElementById(wrapId);
            const isAdmin = window.isCurrentUserAdmin?.() === true;
            if (!select) return;
            select.value = isAdmin ? value : 'personal';
            select.disabled = locked || !isAdmin;
            if (wrap) wrap.classList.toggle('hidden', !isAdmin && value !== 'global');
        }

        function openCategoryForm() {
            editingCategoryId = null;
            const modal = document.getElementById('category-modal');
            if (modal && modal.parentElement?.id === 'view-categorias') {
                document.getElementById('app')?.appendChild(modal);
            }
            document.getElementById('category-modal-title').textContent = 'Nova Categoria';
            document.getElementById('category-save-button').textContent = 'Salvar';
            document.getElementById('cat-name').value = '';
            document.getElementById('cat-macro').value = 'FIXO';
            document.getElementById('cat-color').value = '#38bdf8';
            document.getElementById('cat-icon').value = 'tag';
            configureReferenceScopeInput('cat-scope', 'cat-scope-wrap', 'personal', false);
            selectColor('#38bdf8');
            modal?.classList.remove('hidden');
        }

        function openEditCategory(categoryId) {
            const category = allRecords.find((record) => record.type === 'categoria' && record.id === categoryId);
            if (!category) {
                showToast('Categoria não encontrada', true);
                return;
            }
            if (!canMaintainReference(category)) {
                showToast('Categoria global so pode ser mantida por administrador', true);
                return;
            }

            const modal = document.getElementById('category-modal');
            if (modal && modal.parentElement?.id === 'view-categorias') {
                document.getElementById('app')?.appendChild(modal);
            }

            editingCategoryId = category.id;
            document.getElementById('category-modal-title').textContent = 'Editar Categoria';
            document.getElementById('category-save-button').textContent = 'Salvar alterações';
            document.getElementById('cat-name').value = category.category_name || '';
            document.getElementById('cat-macro').value = category.macro_category || 'FIXO';
            document.getElementById('cat-color').value = category.category_color || '#38bdf8';
            document.getElementById('cat-icon').value = category.category_icon || 'tag';
            configureReferenceScopeInput('cat-scope', 'cat-scope-wrap', getReferenceScope(category), true);
            selectColor(category.category_color || '#38bdf8');
            modal?.classList.remove('hidden');
        }

        function closeCategoryForm() {
            document.getElementById('category-modal')?.classList.add('hidden');
            editingCategoryId = null;
        }

        function selectColor(color) {
            document.getElementById('cat-color').value = color;
            document.querySelectorAll('#category-modal button[onclick*="selectColor"]').forEach(b => {
                b.style.borderColor = b.onclick?.toString().includes(color) ? '#e2e8f0' : '#94a3b8';
                b.style.borderWidth = b.onclick?.toString().includes(color) ? '3px' : '2px';
            });
        }

        async function saveCategory() {
            const name = document.getElementById('cat-name').value.trim();
            const macro = document.getElementById('cat-macro').value;
            const color = document.getElementById('cat-color').value;
            const icon = document.getElementById('cat-icon').value || 'tag';
            const scope = window.isCurrentUserAdmin?.() === true
                ? (document.getElementById('cat-scope')?.value || 'personal')
                : 'personal';
            const isEditing = Boolean(editingCategoryId);
            const currentCategory = isEditing
                ? allRecords.find((record) => record.type === 'categoria' && record.id === editingCategoryId)
                : null;

            if (!name) { showToast('Informe o nome da categoria', true); return; }

            try {
                if (!isEditing && allRecords.filter(r => r.type === 'categoria').length >= 50) { showToast('Limite de 50 categorias!', true); return; }

                const duplicate = allRecords.find((record) =>
                    record.type === 'categoria' &&
                    record.id !== editingCategoryId &&
                    String(record.category_name || '').trim().toLowerCase() === name.toLowerCase() &&
                    String(record.macro_category || '') === macro
                );
                if (duplicate) {
                    showToast('Já existe uma categoria com esse nome nessa macro', true);
                    return;
                }

                let r;
                if (isEditing) {
                    if (!currentCategory) {
                        showToast('Categoria não encontrada', true);
                        return;
                    }
                    r = await window.dataSdk.update({
                        ...currentCategory,
                        category_name: name,
                        macro_category: macro,
                        category_color: color,
                        category_icon: icon,
                        shared_scope: getReferenceScope(currentCategory),
                        id: currentCategory.id
                    });
                } else {
                    r = await window.dataSdk.create({
                        type: 'categoria',
                        person: '',
                        macro_category: macro,
                        subcategory: '',
                        description: '',
                        amount: 0,
                        status: '',
                        payment_method: '',
                        occurred_date: '',
                        due_date: '',
                        competence: '',
                        paid_at: '',
                        installment_no: 0,
                        total_installments: 0,
                        parent_id: '',
                        earning_type: '',
                        recurrence: '',
                        created_at: new Date().toISOString(),
                        shared_scope: scope,
                        category_id: 'cat_' + Date.now(),
                        category_name: name,
                        category_color: color,
                        category_icon: icon,
                        ...getHourExtraRecordDefaults()
                    });
                }

                if (r.isOk) showToast(isEditing ? 'Categoria atualizada!' : 'Categoria criada!');
                else showToast(isEditing ? 'Erro ao atualizar' : 'Erro ao criar', true);
                closeCategoryForm();
            } catch (err) {
                showToast('Erro ao salvar', true);
            }
        }

        function renderCategorias() {
            const categories = allRecords
                .filter(r => r.type === 'categoria')
                .sort((a, b) => {
                    const macroCompare = String(a.macro_category || '').localeCompare(String(b.macro_category || ''), 'pt-BR');
                    if (macroCompare !== 0) return macroCompare;
                    return String(a.category_name || '').localeCompare(String(b.category_name || ''), 'pt-BR');
                });
            const list = document.getElementById('categories-list');
            const empty = document.getElementById('categories-empty');

            if (!categories.length) {
                list.innerHTML = '';
                empty.classList.remove('hidden');
                return;
            }

            empty.classList.add('hidden');
            list.innerHTML = categories.map(cat => `
    <div class="bg-surface rounded-xl p-4 border border-surfaceLight flex items-center justify-between card-hover">
      <div class="flex items-center gap-3">
        <div class="w-12 h-12 rounded-lg flex items-center justify-center" style="background: ${cat.category_color}20; color: ${cat.category_color};">
          <i data-lucide="${cat.category_icon}" class="w-6 h-6"></i>
        </div>
        <div>
          <div class="flex items-center gap-2 flex-wrap"><h3 class="font-semibold">${cat.category_name}</h3>${referenceScopeBadge(cat)}</div>
          <p class="text-xs text-textSecondary">${cat.macro_category}</p>
        </div>
      </div>
      <div class="flex gap-2">
        ${canMaintainReference(cat) ? `<button type="button" data-open-edit-category="${escapeHtml(cat.id)}" class="text-textSecondary hover:text-accent p-2" title="Editar categoria" aria-label="Editar categoria ${escapeHtml(cat.category_name || '')}">
          <i data-lucide="pencil" class="w-4 h-4"></i>
        </button>
        <button type="button" data-delete-category-id="${escapeHtml(cat.id)}" class="text-textSecondary hover:text-danger p-2" title="Excluir categoria" aria-label="Excluir categoria ${escapeHtml(cat.category_name || '')}">
          <i data-lucide="trash-2" class="w-4 h-4"></i>
        </button>` : ''}
      </div>
    </div>
  `).join('');
            lucide.createIcons();
        }

        function openOvertimeTypeModal(typeId = null) {
            editingOvertimeTypeId = typeId;
            const current = typeId ? findOvertimeTypeById(typeId) : null;
            document.getElementById('overtime-type-modal-title').textContent = current ? 'Editar Tipo de Hora Extra' : 'Novo Tipo de Hora Extra';
            document.getElementById('overtime-type-name').value = current?.name || '';
            document.getElementById('overtime-type-percentage').value = current ? String(current.percentage) : '';
            document.getElementById('overtime-type-financial').checked = current ? Boolean(current.financialType) : true;
            document.getElementById('overtime-type-active').checked = current ? Boolean(current.active) : true;
            handleOvertimeFinancialToggle();
            document.getElementById('overtime-type-modal').classList.remove('hidden');
        }

        function closeOvertimeTypeModal() {
            editingOvertimeTypeId = null;
            document.getElementById('overtime-type-modal').classList.add('hidden');
        }

        function handleOvertimeFinancialToggle() {
            const isFinancial = document.getElementById('overtime-type-financial').checked;
            const percentageField = document.getElementById('overtime-type-percentage');
            if (!percentageField) return;
            percentageField.min = isFinancial ? '0.01' : '0';
            percentageField.placeholder = isFinancial ? 'Ex: 1.5' : '0 para BH';
        }

        function renderOvertimeTypesSettings() {
            const list = document.getElementById('overtime-types-list');
            const empty = document.getElementById('overtime-types-empty');
            if (!list || !empty) return;

            const sorted = [...overtimeTypes].sort((a, b) => a.name.localeCompare(b.name));
            if (!sorted.length) {
                list.innerHTML = '';
                empty.classList.remove('hidden');
                return;
            }

            empty.classList.add('hidden');
            list.innerHTML = sorted.map((item) => `
                <div class="rounded-xl border border-surfaceLight bg-surfaceLight/40 p-3">
                    <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                        <div>
                            <div class="flex items-center gap-2 flex-wrap">
                                <h4 class="font-semibold text-sm text-textPrimary">${escapeHtml(item.name)}</h4>
                                <span class="px-2 py-1 rounded-full text-[11px] font-semibold ${item.financialType ? 'bg-accent/10 text-accent' : 'bg-warn/10 text-warn'}">${item.financialType ? 'Financeiro' : 'Banco de Horas'}</span>
                                <span class="px-2 py-1 rounded-full text-[11px] font-semibold ${item.active ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}">${item.active ? 'Ativo' : 'Inativo'}</span>
                            </div>
                            <p class="text-xs text-textSecondary mt-1">Percentual: ${item.percentage}</p>
                        </div>
                        <div class="flex gap-2 flex-wrap">
                            <button type="button" data-open-overtime-type="${escapeHtml(item.id)}" class="px-3 py-1.5 rounded-lg text-xs font-semibold bg-surface text-textSecondary border border-surfaceLight hover:text-textPrimary">Editar</button>
                            <button type="button" data-toggle-overtime-type="${escapeHtml(item.id)}" class="px-3 py-1.5 rounded-lg text-xs font-semibold ${item.active ? 'bg-danger/10 text-danger hover:bg-danger hover:text-white' : 'bg-success/10 text-success hover:bg-success hover:text-white'} transition-colors">${item.active ? 'Inativar' : 'Ativar'}</button>
                        </div>
                    </div>
                </div>
            `).join('');
            lucide.createIcons();
        }

        function validateOvertimeTypeForm(name, percentage, isFinancial) {
            if (!name) {
                showToast('Informe o nome do tipo de H.E.', true);
                return false;
            }

            const duplicated = overtimeTypes.some((item) =>
                item.id !== editingOvertimeTypeId &&
                item.name.trim().toLowerCase() === name.trim().toLowerCase()
            );
            if (duplicated) {
                showToast('Já existe um tipo de H.E. com esse nome', true);
                return false;
            }

            if (Number.isNaN(percentage) || (!isFinancial && percentage < 0) || (isFinancial && percentage <= 0)) {
                showToast(isFinancial ? 'Percentual deve ser maior que zero' : 'Percentual inválido para banco de horas', true);
                return false;
            }

            return true;
        }

        function saveOvertimeType() {
            const name = document.getElementById('overtime-type-name').value.trim();
            const percentage = Number(document.getElementById('overtime-type-percentage').value);
            const financialType = document.getElementById('overtime-type-financial').checked;
            const active = document.getElementById('overtime-type-active').checked;
            if (!validateOvertimeTypeForm(name, percentage, financialType)) return;

            const now = new Date().toISOString();
            if (editingOvertimeTypeId) {
                overtimeTypes = overtimeTypes.map((item) => item.id === editingOvertimeTypeId
                    ? normalizeOvertimeType({
                        ...item,
                        name,
                        percentage,
                        financialType,
                        active,
                        updatedAt: now
                    })
                    : item);
                showToast('Tipo de H.E. atualizado!');
            } else {
                overtimeTypes.push(normalizeOvertimeType({
                    id: `he_${Date.now()}`,
                    name,
                    percentage,
                    financialType,
                    active,
                    createdAt: now,
                    updatedAt: now
                }));
                showToast('Tipo de H.E. criado!');
            }

            persistOvertimeTypes();
            renderOvertimeTypesSettings();
            syncOvertimeTypeOptions();
            if (isHourExtraEarningType()) handleOvertimeTypeSelect();
            closeOvertimeTypeModal();
        }

        function toggleOvertimeTypeStatus(typeId) {
            overtimeTypes = overtimeTypes.map((item) => item.id === typeId
                ? { ...item, active: !item.active, updatedAt: new Date().toISOString() }
                : item);
            persistOvertimeTypes();
            renderOvertimeTypesSettings();
            syncOvertimeTypeOptions();
            if (isHourExtraEarningType()) handleOvertimeTypeSelect();
            showToast('Status do tipo de H.E. atualizado!');
        }

        // ============ CONFIGURAÇÕES ============
        function addPerson() {
            document.getElementById('person-input').value = '';
            document.getElementById('person-base-salary').value = '';
            document.getElementById('add-person-modal').classList.remove('hidden');
            document.getElementById('person-input').focus();
        }

        function closeAddPersonModal() {
            document.getElementById('add-person-modal').classList.add('hidden');
        }

        async function savePerson() {
            const name = document.getElementById('person-input').value.trim();
            const salaryBase = Number(document.getElementById('person-base-salary').value) || 0;
            if (!name) { showToast('Informe um nome', true); return; }

            if (countRecordsByType('pessoa') >= MAX_PEOPLE_RECORDS) { showToast(`Limite de ${MAX_PEOPLE_RECORDS} pessoas atingido!`, true); return; }

            const r = await window.financeRecordMutations.createRecord({
                type: 'pessoa',
                person: name,
                macro_category: '',
                subcategory: '',
                description: '',
                amount: 0,
                status: '',
                payment_method: '',
                occurred_date: '',
                due_date: '',
                competence: '',
                paid_at: '',
                installment_no: 0,
                total_installments: 0,
                parent_id: '',
                earning_type: '',
                recurrence: '',
                created_at: new Date().toISOString(),
                category_id: '',
                category_name: '',
                category_color: '',
                category_icon: '',
                salary_base: roundCurrency(salaryBase),
                ...getHourExtraRecordDefaults()
            });

            if (r.isOk) {
                showToast('Pessoa adicionada!');
                closeAddPersonModal();
            } else {
                showToast('Erro ao adicionar', true);
            }
        }

        function addMacroCategory() {
            document.getElementById('macro-input').value = '';
            configureReferenceScopeInput('macro-scope', 'macro-scope-wrap', 'personal', false);
            document.getElementById('add-macro-modal').classList.remove('hidden');
            document.getElementById('macro-input').focus();
        }

        function closeAddMacroModal() {
            document.getElementById('add-macro-modal').classList.add('hidden');
        }

        async function saveMacroCategory() {
            const name = document.getElementById('macro-input').value.trim();
            if (!name) { showToast('Informe um nome', true); return; }
            const scope = window.isCurrentUserAdmin?.() === true
                ? (document.getElementById('macro-scope')?.value || 'personal')
                : 'personal';

            if (countRecordsByType('macro') >= MAX_MACRO_RECORDS) { showToast(`Limite de ${MAX_MACRO_RECORDS} macros atingido!`, true); return; }
            const duplicate = allRecords.find((record) =>
                record.type === 'macro' &&
                String(record.macro_category || '').trim().toLowerCase() === name.toLowerCase()
            );
            if (duplicate) { showToast('Essa categoria macro já existe', true); return; }

            const r = await window.financeRecordMutations.createRecord({
                type: 'macro',
                person: '',
                macro_category: name,
                subcategory: '',
                description: '',
                amount: 0,
                status: '',
                payment_method: '',
                occurred_date: '',
                due_date: '',
                competence: '',
                paid_at: '',
                installment_no: 0,
                total_installments: 0,
                parent_id: '',
                earning_type: '',
                recurrence: '',
                created_at: new Date().toISOString(),
                shared_scope: scope,
                category_id: '',
                category_name: '',
                category_color: '',
                category_icon: '',
                ...getHourExtraRecordDefaults()
            });

            if (r.isOk) {
                showToast('Categoria macro adicionada!');
                closeAddMacroModal();
            } else {
                showToast('Erro ao adicionar', true);
            }
        }

        function parseInstallmentValue(value) {
            const base = normalizeImportText(value);
            if (!base || base === '-') return { installmentNo: 0, totalInstallments: 0 };
            const match = base.match(/(\d+)\s*\/\s*(\d+)/);
            if (!match) return { installmentNo: 0, totalInstallments: 0 };
            return {
                installmentNo: parseInt(match[1], 10) || 0,
                totalInstallments: parseInt(match[2], 10) || 0
            };
        }

        function excelSerialToIsoDate(value) {
            if (value === null || value === undefined || value === '') return '';
            if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) return value.trim();
            if (value instanceof Date && !Number.isNaN(value.getTime())) {
                const year = value.getFullYear();
                const month = String(value.getMonth() + 1).padStart(2, '0');
                const day = String(value.getDate()).padStart(2, '0');
                return `${year}-${month}-${day}`;
            }
            const brDate = String(value).trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
            if (brDate) return `${brDate[3]}-${brDate[2]}-${brDate[1]}`;
            const numeric = Number(value);
            if (!Number.isFinite(numeric)) return '';
            const utcDays = Math.floor(numeric - 25569);
            const utcValue = utcDays * 86400;
            const dateInfo = new Date(utcValue * 1000);
            if (Number.isNaN(dateInfo.getTime())) return '';
            const year = dateInfo.getUTCFullYear();
            const month = String(dateInfo.getUTCMonth() + 1).padStart(2, '0');
            const day = String(dateInfo.getUTCDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        }

        function normalizeCompetenceValue(value) {
            const base = normalizeImportText(value);
            if (!base) return '';
            if (/^\d{4}-\d{2}$/.test(base)) return base;
            const slashMatch = base.match(/^(\d{2})\/(\d{4})$/);
            if (slashMatch) return `${slashMatch[2]}-${slashMatch[1]}`;
            const isoDateMatch = base.match(/^(\d{4})-(\d{2})-\d{2}$/);
            if (isoDateMatch) return `${isoDateMatch[1]}-${isoDateMatch[2]}`;
            return '';
        }

        function competenceToIsoDate(competence) {
            const normalized = normalizeCompetenceValue(competence);
            return normalized ? `${normalized}-01` : '';
        }

        function buildImportRowKey(row) {
            return [
                row.person,
                row.macro_category,
                row.subcategory,
                row.description,
                row.amount,
                row.status,
                row.payment_method,
                row.occurred_date,
                row.due_date,
                row.competence,
                row.installment_no,
                row.total_installments
            ].join('|');
        }

        function buildImportRowCoreKey(row) {
            return [
                row.person,
                row.macro_category,
                row.subcategory,
                row.description,
                row.amount,
                row.competence,
                row.installment_no,
                row.total_installments
            ].join('|');
        }

        function incrementMapCount(map, key) {
            map.set(key, (map.get(key) || 0) + 1);
        }

        function decrementMapCount(map, key) {
            const current = map.get(key) || 0;
            if (current <= 1) map.delete(key);
            else map.set(key, current - 1);
        }

        async function ensureImportSupportRecords(rows) {
            const existingPeople = new Set(allRecords.filter(r => r.type === 'pessoa').map(r => r.person));
            const existingMacros = new Set(allRecords.filter(r => r.type === 'macro').map(r => r.macro_category));
            const existingCategories = new Set(allRecords.filter(r => r.type === 'categoria').map(r => `${r.macro_category}|${r.category_name}`));

            for (const row of rows) {
                if (row.person && !existingPeople.has(row.person)) {
                    const r = await window.dataSdk.create({
                        type: 'pessoa',
                        person: row.person,
                        macro_category: '',
                        subcategory: '',
                        description: '',
                        amount: 0,
                        status: '',
                        payment_method: '',
                        occurred_date: '',
                        due_date: '',
                        competence: '',
                        paid_at: '',
                        installment_no: 0,
                        total_installments: 0,
                        parent_id: '',
                        earning_type: '',
                        recurrence: '',
                        cycle: '',
                        created_at: new Date().toISOString(),
                        category_id: '',
                        category_name: '',
                        category_color: '',
                        category_icon: '',
                        ...getHourExtraRecordDefaults()
                    });
                    if (r.isOk) existingPeople.add(row.person);
                }

                if (row.macro_category && !existingMacros.has(row.macro_category)) {
                    const r = await window.dataSdk.create({
                        type: 'macro',
                        person: '',
                        macro_category: row.macro_category,
                        subcategory: '',
                        description: '',
                        amount: 0,
                        status: '',
                        payment_method: '',
                        occurred_date: '',
                        due_date: '',
                        competence: '',
                        paid_at: '',
                        installment_no: 0,
                        total_installments: 0,
                        parent_id: '',
                        earning_type: '',
                        recurrence: '',
                        cycle: '',
                        created_at: new Date().toISOString(),
                        category_id: '',
                        category_name: '',
                        category_color: '',
                        category_icon: '',
                        ...getHourExtraRecordDefaults()
                    });
                    if (r.isOk) existingMacros.add(row.macro_category);
                }

                const categoryKey = `${row.macro_category}|${row.subcategory}`;
                if (row.subcategory && row.macro_category && !existingCategories.has(categoryKey)) {
                    const r = await window.dataSdk.create({
                        type: 'categoria',
                        person: '',
                        macro_category: row.macro_category,
                        subcategory: '',
                        description: '',
                        amount: 0,
                        status: '',
                        payment_method: '',
                        occurred_date: '',
                        due_date: '',
                        competence: '',
                        paid_at: '',
                        installment_no: 0,
                        total_installments: 0,
                        parent_id: '',
                        earning_type: '',
                        recurrence: '',
                        cycle: '',
                        created_at: new Date().toISOString(),
                        category_id: 'cat_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
                        category_name: row.subcategory,
                        category_color: '#38bdf8',
                        category_icon: 'tag',
                        ...getHourExtraRecordDefaults()
                    });
                    if (r.isOk) existingCategories.add(categoryKey);
                }
            }
        }

        function mapSpreadsheetRows(rows) {
            const validRows = [];
            const invalidRows = [];

            rows.forEach((row, index) => {
                const person = normalizeImportText(row['Quem paga']);
                const macroCategory = normalizeImportText(row['Categoria_macro']);
                const category = normalizeImportText(row['Categoria']);
                const description = normalizeImportText(row['Descrição']);
                const amount = parseCurrencyValue(row['Valor Orçado']);
                const competence = normalizeCompetenceValue(row['Data competencia']);
                const importedDate = excelSerialToIsoDate(row['Data']);
                const dueDate = competenceToIsoDate(competence) || importedDate;
                const paymentMethod = normalizeImportText(row['Pagamento']);
                const cycle = normalizeCycleValue(row['Classe']);
                const installments = parseInstallmentValue(row['Parcela']);
                const status = normalizeStatusValue(row['STATUS']);
                const mappedRow = {
                    sourceIndex: index + 2,
                    person,
                    macro_category: macroCategory,
                    subcategory: category,
                    description,
                    amount,
                    status,
                    payment_method: paymentMethod,
                    competence,
                    due_date: dueDate,
                    occurred_date: importedDate,
                    paid_at: status === 'Pago' ? importedDate : '',
                    cycle,
                    installment_no: installments.installmentNo,
                    total_installments: installments.totalInstallments
                };

                const reasons = [];
                if (!person) reasons.push('Quem paga ausente');
                if (!macroCategory) reasons.push('Categoria_macro ausente');
                if (!category) reasons.push('Categoria ausente');
                if (!description) reasons.push('Descrição ausente');
                if (!(amount > 0)) reasons.push('Valor Orçado inválido');
                if (!competence) reasons.push('Data competencia inválida');
                if (!cycle) reasons.push('Classe inválida');
                if (!importedDate) reasons.push('Data inválida');

                if (reasons.length) {
                    invalidRows.push({ ...mappedRow, rawRow: row, reason: reasons.join('; ') });
                    return;
                }

                validRows.push(mappedRow);
            });

            return { validRows, invalidRows };
        }

        function normalizeEntradaDescription(value) {
            const base = normalizeImportText(value);
            const key = base.toUpperCase()
                .normalize('NFD').replace(/[̀-ͯ]/g, '');

            if (key === 'INICIO DO MES') {
                return {
                    description: 'Início do mês',
                    earning_type: 'Início do mês',
                    macro_category: 'Rendimento',
                    cycle: 'INICIO_MES',
                    isFinancial: true
                };
            }
            if (key === 'QUINZENA') {
                return {
                    description: 'Quinzena',
                    earning_type: 'Quinzena',
                    macro_category: 'Rendimento',
                    cycle: 'QUINZENA',
                    isFinancial: true
                };
            }
            if (key === 'HE') {
                return {
                    description: 'Hora Extra',
                    earning_type: 'Hora Extra',
                    macro_category: 'Rendimento',
                    cycle: '',
                    isFinancial: true
                };
            }
            if (key === 'DSR H.E' || key === 'DSR H E' || key === 'DSR HE') {
                return {
                    description: 'DSR H.E.',
                    earning_type: 'DSR H.E.',
                    macro_category: 'Rendimento',
                    cycle: '',
                    isFinancial: true
                };
            }
            if (key === 'SALARIO BASE') {
                return {
                    description: 'Salário Base',
                    earning_type: 'Salário Base',
                    macro_category: 'Referência Salarial',
                    cycle: '',
                    isFinancial: false
                };
            }
            if (key === 'SALARIO BRUTO') {
                return {
                    description: 'Salário Bruto',
                    earning_type: 'Salário Bruto',
                    macro_category: 'Referência Salarial',
                    cycle: '',
                    isFinancial: false
                };
            }

            return null;
        }

        function buildEntradaImportRowKey(row) {
            return [
                row.person,
                row.earning_type,
                row.description,
                row.amount,
                row.competence,
                row.cycle,
                row.macro_category
            ].join('|');
        }

        function mapEntradasSpreadsheetRows(rows) {
            const validRows = [];
            const invalidRows = [];

            rows.forEach((row, index) => {
                const competence = normalizeCompetenceValue(row['Competência']);
                const amount = parseCurrencyValue(row['Valores']);
                const person = normalizeImportText(row['Pessoa']);
                const mapping = normalizeEntradaDescription(row['Desc']);
                const competenceDate = competenceToIsoDate(competence);
                const mappedRow = {
                    sourceIndex: index + 2,
                    competence,
                    person,
                    amount,
                    occurred_date: competenceDate,
                    due_date: competenceDate,
                    paid_at: '',
                    description: mapping?.description || normalizeImportText(row['Desc']),
                    earning_type: mapping?.earning_type || '',
                    macro_category: mapping?.macro_category || '',
                    cycle: mapping?.cycle || '',
                    isFinancial: mapping?.isFinancial ? true : false
                };

                const reasons = [];
                if (!competence) reasons.push('Competência inválida');
                if (!(amount >= 0)) reasons.push('Valor inválido');
                if ([null, undefined, ''].includes(row['Valores']) || normalizeImportText(row['Valores']) === '') reasons.push('Valor ausente');
                if (!person) reasons.push('Pessoa ausente');
                if (!mapping) reasons.push('Desc não suportada para importação');

                if (reasons.length) {
                    invalidRows.push({ ...mappedRow, rawRow: row, reason: reasons.join('; ') });
                    return;
                }

                validRows.push(mappedRow);
            });

            return { validRows, invalidRows };
        }

        async function readSaidasWorkbookFromInput() {
            const input = document.getElementById('import-saidas-file');
            const file = input?.files?.[0];

            if (!file) throw new Error('NO_FILE');
            await ensureSpreadsheetLibrary();
            if (!window.XLSX) throw new Error('NO_XLSX');

            const buffer = await file.arrayBuffer();
            const workbook = window.XLSX.read(buffer, { type: 'array', cellDates: false });
            const sheetName = workbook.SheetNames[0];
            if (!sheetName) throw new Error('NO_SHEET');

            const sheet = workbook.Sheets[sheetName];
            const rawRows = window.XLSX.utils.sheet_to_json(sheet, { defval: '' });
            if (!rawRows.length) throw new Error('NO_ROWS');

            const pipeline = window.financeApp?.importPipeline;
            if (!pipeline?.parseSpreadsheetImport) throw new Error('NO_IMPORT_PIPELINE');
            const parsed = await pipeline.parseSpreadsheetImport(rawRows, {
                kind: pipeline.SPREADSHEET_IMPORT_KINDS.EXPENSES,
                sheetName
            });
            if (!parsed.rows.length) throw new Error('NO_VALID_ROWS');

            return { input, file, sheetName, rawRows, parsed };
        }

        async function readEntradasWorkbookFromInput() {
            const input = document.getElementById('import-entradas-file');
            const file = input?.files?.[0];

            if (!file) throw new Error('NO_FILE');
            await ensureSpreadsheetLibrary();
            if (!window.XLSX) throw new Error('NO_XLSX');

            const buffer = await file.arrayBuffer();
            const workbook = window.XLSX.read(buffer, { type: 'array', cellDates: false });
            const sheetName = workbook.SheetNames[0];
            if (!sheetName) throw new Error('NO_SHEET');

            const sheet = workbook.Sheets[sheetName];
            const rawRows = window.XLSX.utils.sheet_to_json(sheet, { defval: '' });
            if (!rawRows.length) throw new Error('NO_ROWS');

            const pipeline = window.financeApp?.importPipeline;
            if (!pipeline?.parseSpreadsheetImport) throw new Error('NO_IMPORT_PIPELINE');
            const parsed = await pipeline.parseSpreadsheetImport(rawRows, {
                kind: pipeline.SPREADSHEET_IMPORT_KINDS.INCOMES,
                sheetName
            });
            if (!parsed.rows.length) throw new Error('NO_VALID_ROWS');

            return { input, file, sheetName, rawRows, parsed };
        }

        function spreadsheetParserErrorsToReportRows(parsed = {}) {
            return (parsed.errors || []).map((item) => ({
                sourceIndex: item.row_index || item.sourceIndex || '-',
                description: item.payload?.description || '',
                person: item.payload?.person || '',
                competence: item.payload?.competence || '',
                amount: item.payload?.amount || '',
                reason: (item.errors || parsed.errors || [])
                    .map((error) => `${error.field || error.code || 'linha'}: ${error.message || error.code || 'inválida'}`)
                    .join('; ')
            }));
        }

        function spreadsheetCandidateToReportRow(candidate = {}, type = '') {
            const payload = candidate.normalized_payload || {};
            return {
                sourceIndex: candidate.source_row_reference || candidate.row_index || '-',
                description: payload.description || payload.subcategory || payload.earning_type || '',
                person: payload.person || '',
                competence: payload.competence || '',
                amount: payload.amount || '',
                reason: candidate.conflict_reason || candidate.validation_errors?.map((error) => `${error.field}: ${error.code}`).join('; ') || type
            };
        }

        function buildSpreadsheetImportReport(prepared = {}, parsed = {}, imported = 0) {
            const candidates = prepared.candidates || [];
            const invalidCandidates = candidates.filter((candidate) => candidate.status === 'invalid');
            const duplicateCandidates = candidates.filter((candidate) =>
                candidate.status === 'duplicate_in_file' ||
                candidate.status === 'already_imported' ||
                candidate.status === 'legacy_match'
            );
            const conflictCandidates = candidates.filter((candidate) => candidate.status === 'conflict');
            const invalid = invalidCandidates.length
                ? invalidCandidates.map((candidate) => spreadsheetCandidateToReportRow(candidate, 'invalid'))
                : spreadsheetParserErrorsToReportRows(parsed);
            return {
                imported,
                duplicates: duplicateCandidates.map((candidate) => spreadsheetCandidateToReportRow(candidate, candidate.status)),
                invalid,
                conflicts: conflictCandidates.map((candidate) => spreadsheetCandidateToReportRow(candidate, 'conflict')),
                capacity: [],
                capacitySkipped: 0,
                summary: prepared.summary || {},
                batch: prepared.batch || null,
                sheetName: parsed.sheetName || ''
            };
        }

        async function importSaidasSpreadsheet(forceImport = false) {
            const button = document.getElementById(forceImport ? 'btn-import-saidas-force' : 'btn-import-saidas');
            const otherButton = document.getElementById(forceImport ? 'btn-import-saidas' : 'btn-import-saidas-force');

            button.disabled = true;
            if (otherButton) otherButton.disabled = true;
            button.innerHTML = forceImport
                ? '<span class="animate-spin inline-block w-3 h-3 border-2 border-warn border-t-transparent rounded-full"></span> Importando tudo...'
                : '<span class="animate-spin inline-block w-3 h-3 border-2 border-bg border-t-transparent rounded-full"></span> Importando...';

            try {
                const pipeline = window.financeApp?.importPipeline;
                if (!pipeline?.prepareSpreadsheetImport || !pipeline?.commitPreparedImport) throw new Error('NO_IMPORT_PIPELINE');

                const { input, file, parsed } = await readSaidasWorkbookFromInput();
                const preparedEnvelope = await pipeline.prepareSpreadsheetImport({
                    parsed,
                    kind: pipeline.SPREADSHEET_IMPORT_KINDS.EXPENSES,
                    originalFilename: file?.name || 'saidas.xlsx',
                    fileContent: parsed.rows
                });
                if (!preparedEnvelope.success) throw new Error('PREPARE_FAILED');

                lastImportReport = buildSpreadsheetImportReport(preparedEnvelope.prepared, parsed, 0);
                renderImportReport();

                const readyCandidates = (preparedEnvelope.prepared?.candidates || [])
                    .filter((candidate) => candidate.status === 'ready');
                let selectedCandidateIds = readyCandidates.map((candidate) => candidate.candidate_id);

                if (!selectedCandidateIds.length) {
                    renderImportReport();
                    showToast(forceImport ? 'Nenhuma linha valida para importar' : 'Nenhuma linha nova para importar', true);
                    return;
                }

                if (!forceImport) {
                    if (!hasTransactionCapacity()) {
                        lastImportReport.capacity = readyCandidates.map((candidate) => spreadsheetCandidateToReportRow(candidate, 'saida'));
                        lastImportReport.capacitySkipped = readyCandidates.length;
                        renderImportReport();
                        showToast(`Limite de ${MAX_TRANSACTION_RECORDS} lancamentos atingido!`, true);
                        return;
                    }

                    const availableSlots = getRemainingTransactionSlots();
                    const limitedCandidates = readyCandidates.slice(0, availableSlots);
                    const capacityCandidates = readyCandidates.slice(availableSlots);
                    selectedCandidateIds = limitedCandidates.map((candidate) => candidate.candidate_id);
                    lastImportReport.capacity = capacityCandidates.map((candidate) => spreadsheetCandidateToReportRow(candidate, 'saida'));
                    lastImportReport.capacitySkipped = capacityCandidates.length;

                    if (limitedCandidates.length < readyCandidates.length) {
                        showToast(`Importacao limitada a ${availableSlots} lancamento(s) por causa do teto atual`, true);
                    }
                } else {
                    lastImportReport.capacity = [];
                    lastImportReport.capacitySkipped = 0;
                }

                beginBulkOperation('import', selectedCandidateIds.length);
                const commitResult = await pipeline.commitPreparedImport({
                    preparedBatch: preparedEnvelope.prepared,
                    selectedCandidateIds,
                    context: preparedEnvelope.context,
                    repositories: preparedEnvelope.repositories
                });
                updateBulkOperation(selectedCandidateIds.length);
                if (!commitResult.success) throw new Error(commitResult.message || 'COMMIT_FAILED');

                const imported = commitResult.data?.imported || commitResult.entityIds?.length || 0;
                lastImportReport = buildSpreadsheetImportReport(preparedEnvelope.prepared, parsed, imported);
                renderImportReport();

                showToast(`${imported} lancamentos importados!`);
                input.value = '';
            } catch (error) {
                console.error(error);
                const code = error?.message || '';
                renderImportReport();
                if (code === 'NO_FILE') showToast('Selecione a planilha para importar', true);
                else if (code === 'NO_XLSX') showToast('Leitor de planilha nao carregado', true);
                else if (code === 'NO_IMPORT_PIPELINE') showToast('Pipeline de importacao nao carregado', true);
                else if (code === 'NO_SHEET' || code === 'NO_ROWS' || code === 'NO_VALID_ROWS') showToast('Planilha invalida para importacao', true);
                else showToast('Erro ao importar a planilha', true);
            } finally {
                endBulkOperation();
                button.disabled = false;
                if (otherButton) otherButton.disabled = false;
                button.innerHTML = '<i data-lucide="upload" class="w-3 h-3"></i> Importar Planilha';
                if (forceImport) button.innerHTML = '<i data-lucide="database" class="w-3 h-3"></i> Importar Tudo';
                if (otherButton) otherButton.innerHTML = forceImport
                    ? '<i data-lucide="upload" class="w-3 h-3"></i> Importar Planilha'
                    : '<i data-lucide="database" class="w-3 h-3"></i> Importar Tudo';
                lucide.createIcons();
            }
        }
        async function importEntradasSpreadsheet(forceImport = false) {
            const button = document.getElementById(forceImport ? 'btn-import-entradas-force' : 'btn-import-entradas');
            const otherButton = document.getElementById(forceImport ? 'btn-import-entradas' : 'btn-import-entradas-force');

            button.disabled = true;
            if (otherButton) otherButton.disabled = true;
            button.innerHTML = forceImport
                ? '<span class="animate-spin inline-block w-3 h-3 border-2 border-warn border-t-transparent rounded-full"></span> Importando tudo...'
                : '<span class="animate-spin inline-block w-3 h-3 border-2 border-bg border-t-transparent rounded-full"></span> Importando...';

            try {
                const pipeline = window.financeApp?.importPipeline;
                if (!pipeline?.prepareSpreadsheetImport || !pipeline?.commitPreparedImport) throw new Error('NO_IMPORT_PIPELINE');

                const { input, file, parsed } = await readEntradasWorkbookFromInput();
                const preparedEnvelope = await pipeline.prepareSpreadsheetImport({
                    parsed,
                    kind: pipeline.SPREADSHEET_IMPORT_KINDS.INCOMES,
                    originalFilename: file?.name || 'entradas.xlsx',
                    fileContent: parsed.rows
                });
                if (!preparedEnvelope.success) throw new Error('PREPARE_FAILED');

                lastEntradasImportReport = buildSpreadsheetImportReport(preparedEnvelope.prepared, parsed, 0);
                renderEntradasImportReport();

                const readyCandidates = (preparedEnvelope.prepared?.candidates || [])
                    .filter((candidate) => candidate.status === 'ready');
                let selectedCandidateIds = readyCandidates.map((candidate) => candidate.candidate_id);

                if (!selectedCandidateIds.length) {
                    renderEntradasImportReport();
                    showToast(forceImport ? 'Nenhuma linha valida para importar' : 'Nenhuma linha nova para importar', true);
                    return;
                }

                if (!forceImport) {
                    if (!hasTransactionCapacity()) {
                        lastEntradasImportReport.capacity = readyCandidates.map((candidate) => spreadsheetCandidateToReportRow(candidate, 'entrada'));
                        lastEntradasImportReport.capacitySkipped = readyCandidates.length;
                        renderEntradasImportReport();
                        showToast(`Limite de ${MAX_TRANSACTION_RECORDS} lancamentos atingido!`, true);
                        return;
                    }

                    const availableSlots = getRemainingTransactionSlots();
                    const limitedCandidates = readyCandidates.slice(0, availableSlots);
                    const capacityCandidates = readyCandidates.slice(availableSlots);
                    selectedCandidateIds = limitedCandidates.map((candidate) => candidate.candidate_id);
                    lastEntradasImportReport.capacity = capacityCandidates.map((candidate) => spreadsheetCandidateToReportRow(candidate, 'entrada'));
                    lastEntradasImportReport.capacitySkipped = capacityCandidates.length;

                    if (limitedCandidates.length < readyCandidates.length) {
                        showToast(`Importacao limitada a ${availableSlots} lancamento(s) por causa do teto atual`, true);
                    }
                } else {
                    lastEntradasImportReport.capacity = [];
                    lastEntradasImportReport.capacitySkipped = 0;
                }

                beginBulkOperation('import_entradas', selectedCandidateIds.length);
                const commitResult = await pipeline.commitPreparedImport({
                    preparedBatch: preparedEnvelope.prepared,
                    selectedCandidateIds,
                    context: preparedEnvelope.context,
                    repositories: preparedEnvelope.repositories
                });
                updateBulkOperation(selectedCandidateIds.length);
                if (!commitResult.success) throw new Error(commitResult.message || 'COMMIT_FAILED');

                const imported = commitResult.data?.imported || commitResult.entityIds?.length || 0;
                lastEntradasImportReport = buildSpreadsheetImportReport(preparedEnvelope.prepared, parsed, imported);
                renderEntradasImportReport();
                showToast(`${imported} entradas importadas!`);
                input.value = '';
            } catch (error) {
                console.error(error);
                const code = error?.message || '';
                renderEntradasImportReport();
                if (code === 'NO_FILE') showToast('Selecione a planilha para importar', true);
                else if (code === 'NO_XLSX') showToast('Leitor de planilha nao carregado', true);
                else if (code === 'NO_IMPORT_PIPELINE') showToast('Pipeline de importacao nao carregado', true);
                else if (code === 'NO_SHEET' || code === 'NO_ROWS' || code === 'NO_VALID_ROWS') showToast('Planilha invalida para importacao', true);
                else showToast('Erro ao importar a planilha de entradas', true);
            } finally {
                endBulkOperation();
                button.disabled = false;
                if (otherButton) otherButton.disabled = false;
                button.innerHTML = '<i data-lucide="upload" class="w-3 h-3"></i> Importar Planilha';
                if (forceImport) button.innerHTML = '<i data-lucide="database" class="w-3 h-3"></i> Importar Tudo';
                if (otherButton) otherButton.innerHTML = forceImport
                    ? '<i data-lucide="upload" class="w-3 h-3"></i> Importar Planilha'
                    : '<i data-lucide="database" class="w-3 h-3"></i> Importar Tudo';
                lucide.createIcons();
            }
        }
        async function removeSaidasSpreadsheet() {
            const button = document.getElementById('btn-remove-saidas');
            const importButton = document.getElementById('btn-import-saidas');
            const importAllButton = document.getElementById('btn-import-saidas-force');
            const removeAllButton = document.getElementById('btn-remove-all-saidas');
            button.disabled = true;
            if (importButton) importButton.disabled = true;
            if (importAllButton) importAllButton.disabled = true;
            if (removeAllButton) removeAllButton.disabled = true;
            button.innerHTML = '<span class="animate-spin inline-block w-3 h-3 border-2 border-danger border-t-transparent rounded-full"></span> Removendo...';

            try {
                const user = window.authSdk?.getCurrentUser?.();
                if (!user?.uid) throw new Error('AUTH_REQUIRED');

                const { mappedRows } = await readSaidasWorkbookFromInput();
                const exactKeysToRemove = new Set(mappedRows.map(row => buildImportRowKey(row)));
                const coreKeysToRemove = new Set(mappedRows.map(row => buildImportRowCoreKey(row)));
                const matchingRecords = allRecords
                    .filter(r => r.type === 'saida')
                    .filter((r) => {
                        const normalizedRecord = {
                            person: r.person || '',
                            macro_category: r.macro_category || '',
                            subcategory: r.subcategory || '',
                            description: r.description || '',
                            amount: Math.round((Number(r.amount) || 0) * 100) / 100,
                            status: r.status || '',
                            payment_method: r.payment_method || '',
                            occurred_date: r.occurred_date || '',
                            due_date: r.due_date || '',
                            competence: r.competence || '',
                            installment_no: Number(r.installment_no) || 0,
                            total_installments: Number(r.total_installments) || 0
                        };
                        const exactKey = buildImportRowKey(normalizedRecord);
                        const coreKey = buildImportRowCoreKey(normalizedRecord);
                        return exactKeysToRemove.has(r.import_signature || '')
                            || coreKeysToRemove.has(r.import_core_signature || '')
                            || exactKeysToRemove.has(exactKey)
                            || coreKeysToRemove.has(coreKey);
                    });

                if (!matchingRecords.length) { showToast('Nenhum lançamento correspondente foi encontrado', true); return; }

                beginBulkOperation('remove', matchingRecords.length);
                let removed = 0;
                let processed = 0;
                for (const chunk of chunkArray(matchingRecords, 200)) {
                    await window.firebaseBatchDeleteRecords(user.uid, chunk, 200);
                    removed += chunk.length;
                    processed += chunk.length;
                    updateBulkOperation(processed);
                    button.innerHTML = `<span class="animate-spin inline-block w-3 h-3 border-2 border-danger border-t-transparent rounded-full"></span> Removendo... ${processed}/${matchingRecords.length}`;
                    await yieldToUi();
                }

                showToast(`${removed} lançamentos removidos!`);
            } catch (error) {
                console.error(error);
                const code = error?.message || '';
                if (code === 'NO_FILE') showToast('Selecione a planilha para remover a importação', true);
                else if (code === 'NO_XLSX') showToast('Leitor de planilha não carregado', true);
                else if (code === 'NO_SHEET' || code === 'NO_ROWS' || code === 'NO_VALID_ROWS') showToast('Planilha inválida para remoção', true);
                else if (code === 'AUTH_REQUIRED') showToast('Faça login novamente para remover a importação', true);
                else showToast('Erro ao remover a importação', true);
            } finally {
                endBulkOperation();
                button.disabled = false;
                if (importButton) importButton.disabled = false;
                if (importAllButton) importAllButton.disabled = false;
                if (removeAllButton) removeAllButton.disabled = false;
                button.innerHTML = '<i data-lucide="trash-2" class="w-3 h-3"></i> Remover Importação';
                lucide.createIcons();
            }
        }

        async function removeAllSaidas() {
            const button = document.getElementById('btn-remove-all-saidas');
            const importButton = document.getElementById('btn-import-saidas');
            const importAllButton = document.getElementById('btn-import-saidas-force');
            const removeImportButton = document.getElementById('btn-remove-saidas');

            const saidas = allRecords.filter((record) => record.type === 'saida');
            if (!saidas.length) {
                showToast('Nenhuma saída encontrada para excluir', true);
                return;
            }

            const confirmed = window.confirm(`Isso vai excluir ${saidas.length} saída(s) da conta logada. Deseja continuar?`);
            if (!confirmed) return;

            button.disabled = true;
            if (importButton) importButton.disabled = true;
            if (importAllButton) importAllButton.disabled = true;
            if (removeImportButton) removeImportButton.disabled = true;
            button.innerHTML = '<span class="animate-spin inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full"></span> Excluindo...';

            try {
                const user = window.authSdk?.getCurrentUser?.();
                if (!user?.uid) throw new Error('AUTH_REQUIRED');

                beginBulkOperation('remove_all_saidas', saidas.length);
                let removed = 0;
                let processed = 0;
                for (const chunk of chunkArray(saidas, 200)) {
                    await window.firebaseBatchDeleteRecords(user.uid, chunk, 200);
                    removed += chunk.length;
                    processed += chunk.length;
                    updateBulkOperation(processed);
                    button.innerHTML = `<span class="animate-spin inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full"></span> Excluindo... ${processed}/${saidas.length}`;
                    await yieldToUi();
                }

                showToast(`${removed} saída(s) excluída(s)!`);
            } catch (error) {
                console.error(error);
                const code = error?.message || '';
                if (code === 'AUTH_REQUIRED') showToast('Faça login novamente para excluir as saídas', true);
                else showToast('Erro ao excluir todas as saídas', true);
            } finally {
                endBulkOperation();
                button.disabled = false;
                if (importButton) importButton.disabled = false;
                if (importAllButton) importAllButton.disabled = false;
                if (removeImportButton) removeImportButton.disabled = false;
                button.innerHTML = '<i data-lucide="trash" class="w-3 h-3"></i> Excluir Todas as Saídas';
                lucide.createIcons();
            }
        }
        function renderConfiguracoes() {
            renderImportReport();
            renderEntradasImportReport();
            renderCategorias();
            renderOvertimeTypesSettings();
            const pessoas = allRecords.filter(r => r.type === 'pessoa');
            const pessoasList = document.getElementById('pessoas-list');
            const pessoasEmpty = document.getElementById('pessoas-empty');

            if (!pessoas.length) {
                pessoasList.innerHTML = '';
                pessoasEmpty.classList.remove('hidden');
            } else {
                pessoasEmpty.classList.add('hidden');
                pessoasList.innerHTML = pessoas.map(p => `
      <div class="flex items-end justify-between gap-3 bg-surfaceLight/50 rounded-lg p-2.5">
        <div class="flex-1 min-w-0">
          <span class="text-sm font-medium">${p.person}</span>
          <div class="mt-2">
            <label class="text-[11px] text-textSecondary mb-1 block">Salário base</label>
            <input type="number" step="0.01" min="0" value="${Number(p.salary_base || 0).toFixed(2)}" class="w-full text-sm" data-update-person-base-salary="${escapeHtml(p.id)}">
          </div>
        </div>
        <button type="button" data-delete-person-id="${escapeHtml(p.id)}" class="text-textSecondary hover:text-danger p-1">
          <i data-lucide="trash-2" class="w-4 h-4"></i>
        </button>
      </div>
    `).join('');
            }

            const macros = allRecords.filter(r => r.type === 'macro');
            const macroList = document.getElementById('macro-list');
            const macroEmpty = document.getElementById('macro-empty');

            if (!macros.length) {
                macroList.innerHTML = '';
                macroEmpty.classList.remove('hidden');
            } else {
                macroEmpty.classList.add('hidden');
                macroList.innerHTML = macros.map(m => `
      <div class="flex items-center justify-between bg-surfaceLight/50 rounded-lg p-2.5">
        <div class="flex items-center gap-2 flex-wrap"><span class="text-sm">${escapeHtml(m.macro_category || '')}</span>${referenceScopeBadge(m)}</div>
        ${canMaintainReference(m) ? `<button type="button" data-delete-macro-id="${escapeHtml(m.id)}" class="text-textSecondary hover:text-danger p-1" title="Excluir macro" aria-label="Excluir macro ${escapeHtml(m.macro_category || '')}">
          <i data-lucide="trash-2" class="w-4 h-4"></i>
        </button>` : ''}
      </div>
    `).join('');
            }

            lucide.createIcons();
        }

        lucide.createIcons();
